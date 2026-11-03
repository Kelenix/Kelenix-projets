"use client"

import { Ban, CalendarClock, CircleAlert } from "lucide-react"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import {
  formatDate,
  initials,
  isOverdue,
  PROJECT_STATUS_LABELS,
  TASK_PRIORITY_LABELS,
  TASK_STATUS_LABELS,
  type Profile,
  type ProjectStatus,
  type Task,
  type TaskPriority,
  type TaskStatus,
} from "@/lib/domain"
import { formatDuration } from "@/lib/time"
import { cn } from "@/lib/utils"

const PRIORITY_STYLES: Record<TaskPriority, string> = {
  low: "bg-muted text-muted-foreground",
  normal: "bg-accent text-accent-foreground",
  high: "bg-warning/15 text-[oklch(0.5_0.14_55)]",
}

export function PriorityBadge({ priority }: { priority: TaskPriority }) {
  return <Badge className={PRIORITY_STYLES[priority]}>{TASK_PRIORITY_LABELS[priority]}</Badge>
}

// Couleur de statut identique aux colonnes du Kanban et aux statistiques ; le texte reste
// en encre neutre (lisible), la couleur porte l'identité via la pastille et le fond.
const TASK_STATUS_STYLES: Record<TaskStatus, { badge: string; dot: string; accent: string }> = {
  todo: { badge: "border-series-todo/40 bg-series-todo/12", dot: "bg-series-todo", accent: "border-l-series-todo" },
  in_progress: { badge: "border-series-progress/40 bg-series-progress/12", dot: "bg-series-progress", accent: "border-l-series-progress" },
  rescheduled: { badge: "border-series-rescheduled/50 bg-series-rescheduled/15", dot: "bg-series-rescheduled", accent: "border-l-series-rescheduled" },
  done: { badge: "border-series-done/40 bg-series-done/12", dot: "bg-series-done", accent: "border-l-series-done" },
}

/** Classe de bordure gauche colorée selon le statut (cartes et lignes de liste). */
export const statusAccent = (status: TaskStatus) => TASK_STATUS_STYLES[status].accent

export function TaskStatusBadge({ status }: { status: TaskStatus }) {
  const style = TASK_STATUS_STYLES[status]
  return (
    <Badge className={cn("border text-foreground", style.badge)}>
      <span aria-hidden className={cn("size-1.5 rounded-full", style.dot)} />
      {TASK_STATUS_LABELS[status]}
    </Badge>
  )
}

const PROJECT_STATUS_STYLES: Record<ProjectStatus, string> = {
  planned: "bg-muted text-foreground",
  in_progress: "bg-accent text-accent-foreground",
  paused: "bg-warning/15 text-[oklch(0.5_0.14_55)]",
  done: "bg-success/15 text-[oklch(0.42_0.11_155)]",
}

export function ProjectStatusBadge({ status }: { status: ProjectStatus }) {
  return <Badge className={PROJECT_STATUS_STYLES[status]}>{PROJECT_STATUS_LABELS[status]}</Badge>
}

export function BlockedBadge() {
  return (
    <Badge variant="destructive">
      <Ban aria-hidden /> Bloquée
    </Badge>
  )
}

export function DueDate({ task }: { task: Pick<Task, "due_date" | "status"> }) {
  if (!task.due_date) return null
  const late = isOverdue(task)
  return (
    <span className={cn("inline-flex items-center gap-1 text-xs", late ? "font-medium text-destructive" : "text-muted-foreground")}>
      {late ? <CircleAlert className="size-3.5" aria-hidden /> : <CalendarClock className="size-3.5" aria-hidden />}
      {late && <span className="sr-only">En retard, échéance :</span>}
      {formatDate(task.due_date)}
    </span>
  )
}

export function Assignee({
  profile,
  size = "sm",
  role = "Responsable",
  className,
}: {
  profile?: Profile | null
  size?: "sm" | "md"
  role?: string
  className?: string
}) {
  const label = profile?.full_name ?? "À assigner"
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Avatar className={cn(size === "sm" ? "size-6" : "size-8", className)} aria-label={`${role} : ${label}`} role="img">
          <AvatarFallback
            className={cn(
              "text-[10px] font-semibold",
              profile ? "bg-accent text-accent-foreground" : "border border-dashed bg-card text-muted-foreground"
            )}
          >
            {profile ? initials(profile.full_name) : "?"}
          </AvatarFallback>
        </Avatar>
      </TooltipTrigger>
      <TooltipContent>
        {label}
        {role !== "Responsable" && ` · ${role.toLowerCase()}`}
      </TooltipContent>
    </Tooltip>
  )
}

/** Responsable puis autres collaborateurs affectés (deux au plus, puis « +N »). */
export function AssigneeStack({ task, profiles }: { task: Pick<Task, "assignee_id" | "assignees">; profiles: Map<string, Profile> }) {
  const others = task.assignees.map((a) => a.user_id).filter((id) => id !== task.assignee_id)
  return (
    <span className="flex items-center -space-x-1.5">
      <Assignee profile={task.assignee_id ? profiles.get(task.assignee_id) : undefined} className="ring-2 ring-card" />
      {others.slice(0, 2).map((id) => (
        <Assignee key={id} profile={profiles.get(id)} role="Affecté" className="ring-2 ring-card" />
      ))}
      {others.length > 2 && (
        <span
          className="relative grid size-6 place-items-center rounded-full border bg-card text-[10px] font-semibold text-muted-foreground ring-2 ring-card"
          aria-label={`${others.length - 2} autres collaborateurs affectés`}
          role="img"
        >
          +{others.length - 2}
        </span>
      )}
    </span>
  )
}

/** Écart réel − estimé : un dépassement est signalé par « + » et la couleur d'alerte. */
export function Gap({ estimated, actual }: { estimated: number | null; actual: number }) {
  if (estimated === null) return <span className="text-muted-foreground">—</span>
  const diff = actual - estimated
  if (Math.abs(diff) < 60_000) return <span className="text-muted-foreground">0</span>
  return (
    <span className={cn("font-medium", diff > 0 ? "text-destructive" : "text-[oklch(0.42_0.11_155)]")}>
      {diff > 0 ? "+" : "−"}
      {formatDuration(Math.abs(diff))}
      <span className="sr-only">{diff > 0 ? " de dépassement" : " sous l'estimation"}</span>
    </span>
  )
}
