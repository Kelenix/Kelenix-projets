"use client"

import { useSearchParams } from "next/navigation"
import { createContext, useContext, useState, type ReactNode } from "react"
import type { Client, Profile, Project } from "@/lib/domain"
import { useProfiles, useProjects } from "@/lib/queries"

export type Section = "overview" | "projects" | "tasks" | "clients" | "stats" | "reports"
const SECTIONS: Section[] = ["overview", "projects", "tasks", "clients", "stats", "reports"]

export type DialogState =
  | { type: "project"; project?: Project }
  | { type: "client"; client?: Client }
  | { type: "task"; projectId?: string }
  | { type: "team" }
  | { type: "profile" }
  | null

type Navigation = { section: Section; projectId: string | null; taskId: string | null }

type DashboardContext = Navigation & {
  viewer: Profile
  /** Administrateur : tous les droits. */
  isOwner: boolean
  /** Administrateur ou chef du projet : modifie le projet, gère ses collaborateurs, voit les pauses. */
  canManage: (projectId: string) => boolean
  /** Accès aux rapports d'équipe (sinon, statistiques limitées à ses propres chiffres). */
  canViewReports: boolean
  navigate: (next: Partial<Navigation>) => void
  dialog: DialogState
  openDialog: (dialog: DialogState) => void
}

const Context = createContext<DashboardContext | null>(null)

/**
 * État de navigation du dashboard. Il est reflété dans l'URL (?s=&p=&t=) pour survivre à une
 * actualisation, sans créer de nouvelle page.
 */
export function DashboardProvider({ viewer, children }: { viewer: Profile; children: ReactNode }) {
  const params = useSearchParams()
  const [dialog, openDialog] = useState<DialogState>(null)
  const { data: projects } = useProjects()
  const { data: profiles } = useProfiles()
  // Profil à jour (un accès accordé pendant la session s'applique sans recharger la page).
  const me = profiles?.find((p) => p.id === viewer.id) ?? viewer
  const isOwner = me.role === "owner"
  const canManage = (id: string) => isOwner || !!projects?.find((p) => p.id === id)?.manager_ids.includes(viewer.id)

  const section = SECTIONS.find((s) => s === params.get("s")) ?? "overview"
  const projectId = section === "projects" ? params.get("p") : null
  const taskId = params.get("t")

  function navigate(next: Partial<Navigation>) {
    const merged = { section, projectId, taskId, ...next }
    if (next.section && next.section !== section) {
      merged.projectId = next.projectId ?? null
      merged.taskId = next.taskId ?? null
    }
    const query = new URLSearchParams()
    if (merged.section !== "overview") query.set("s", merged.section)
    if (merged.projectId) query.set("p", merged.projectId)
    if (merged.taskId) query.set("t", merged.taskId)
    const search = query.toString()
    window.history.pushState(null, "", search ? `?${search}` : window.location.pathname)
  }

  return (
    <Context
      value={{
        viewer: me,
        isOwner,
        canManage,
        canViewReports: isOwner || me.can_view_reports,
        section,
        projectId,
        taskId,
        navigate,
        dialog,
        openDialog,
      }}
    >
      {children}
    </Context>
  )
}

export function useDashboard() {
  const context = useContext(Context)
  if (!context) throw new Error("useDashboard doit être utilisé dans DashboardProvider")
  return context
}
