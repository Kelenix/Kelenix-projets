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

export function Assignee({ profile, size = "sm" }: { profile?: Profile | null; size?: "sm" | "md" }) {
  const label = profile?.full_name ?? "À assigner"
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Avatar className={size === "sm" ? "size-6" : "size-8"} aria-label={`Responsable : ${label}`} role="img">
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
      <TooltipContent>{label}</TooltipContent>
    </Tooltip>
  )
}
