import type { Enums, Tables } from "@/lib/database.types"

export type Profile = Tables<"profiles">
export type Client = Tables<"clients">
/** Projet avec ses membres ; `manager_ids` : ses chefs de projet. */
export type Project = Tables<"projects"> & { member_ids: string[]; manager_ids: string[] }
export type Milestone = Tables<"project_milestones">
export type ChecklistItem = Pick<Tables<"task_checklist_items">, "id" | "label" | "done">
export type TimeEntry = Pick<Tables<"time_entries">, "user_id" | "started_at" | "ended_at"> &
  Partial<Pick<Tables<"time_entries">, "id" | "kind" | "description" | "source" | "edited_at" | "pause_reason">>
/** Collaborateur affecté à une tâche, avec son temps estimé (minutes). */
export type Assignment = Pick<Tables<"task_assignees">, "user_id" | "estimated_minutes">
/** Tâche avec sa checklist, ses collaborateurs affectés et le temps passé, visibles sur les cartes. */
export type Task = Tables<"tasks"> & {
  checklist: ChecklistItem[]
  assignees: Assignment[]
  time_entries: TimeEntry[]
  /** Nombre de commentaires et de liens (affichés sur la carte). */
  comment_count: number
  link_count: number
}
export type ProjectStatus = Enums<"project_status">
export type TaskStatus = Enums<"task_status">
export type TaskPriority = Enums<"task_priority">
export type Role = Enums<"app_role">
export type ProjectRole = "member" | "manager"

export const PROJECT_STATUS_LABELS: Record<ProjectStatus, string> = {
  planned: "Prévu",
  in_progress: "En cours",
  paused: "En pause",
  done: "Terminé",
}

export const TASK_STATUSES: TaskStatus[] = ["todo", "in_progress", "rescheduled", "done"]
export const TASK_STATUS_LABELS: Record<TaskStatus, string> = {
  todo: "À faire",
  in_progress: "En cours",
  rescheduled: "Reprogrammé",
  done: "Terminé",
}

export const TASK_PRIORITIES: TaskPriority[] = ["low", "normal", "high"]
export const TASK_PRIORITY_LABELS: Record<TaskPriority, string> = {
  low: "Basse",
  normal: "Normale",
  high: "Haute",
}

export const ROLE_LABELS: Record<Role, string> = {
  owner: "Administrateur",
  collaborator: "Collaborateur",
}

export const PROJECT_ROLE_LABELS: Record<ProjectRole, string> = {
  member: "Collaborateur",
  manager: "Chef de projet",
}

/** Tâche affectée à la personne (responsable principal ou collaborateur affecté). */
export const isAssigned = (task: Pick<Task, "assignee_id" | "assignees">, userId: string) =>
  task.assignee_id === userId || task.assignees.some((a) => a.user_id === userId)

/** Date du jour au format AAAA-MM-JJ, dans le fuseau local. */
export function todayISO(now = new Date()) {
  const offset = now.getTimezoneOffset() * 60_000
  return new Date(now.getTime() - offset).toISOString().slice(0, 10)
}

/** En retard : échéance dépassée et tâche non terminée. */
export function isOverdue(task: Pick<Task, "due_date" | "status">, today = todayISO()) {
  return task.due_date !== null && task.status !== "done" && task.due_date < today
}

export function projectProgress(tasks: Pick<Task, "status">[]) {
  const total = tasks.length
  const done = tasks.filter((t) => t.status === "done").length
  return {
    total,
    done,
    percent: total === 0 ? 0 : Math.round((done / total) * 100),
    label: total === 0 ? "Aucune tâche" : `${done} ${done > 1 ? "tâches terminées" : "tâche terminée"} sur ${total}`,
  }
}

/** Tri par échéance (sans échéance en dernier), puis priorité décroissante. */
export function compareByDueDate(a: Task, b: Task) {
  if (a.due_date !== b.due_date) {
    if (a.due_date === null) return 1
    if (b.due_date === null) return -1
    return a.due_date < b.due_date ? -1 : 1
  }
  return TASK_PRIORITIES.indexOf(b.priority) - TASK_PRIORITIES.indexOf(a.priority)
}

export function formatDate(iso: string | null) {
  if (!iso) return null
  const [y, m, d] = iso.slice(0, 10).split("-").map(Number)
  return new Date(y, m - 1, d).toLocaleDateString("fr-FR", { day: "numeric", month: "short", year: "numeric" })
}

export function initials(name: string) {
  return name
    .replace(/\(.*?\)/g, "")
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]!.toUpperCase())
    .join("")
}

/** Recherche insensible à la casse et aux accents. */
export function normalize(text: string) {
  return text.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase()
}

export type PauseReason = "meal" | "rest" | "meeting" | "personal" | "other"

/** Motifs de pause et durée au-delà de laquelle une pause est jugée anormalement longue (minutes). */
export const PAUSE_REASONS: Record<PauseReason, { label: string; maxMinutes: number }> = {
  meal: { label: "Repas", maxMinutes: 90 },
  rest: { label: "Repos", maxMinutes: 20 },
  meeting: { label: "Réunion", maxMinutes: 120 },
  personal: { label: "Personnel", maxMinutes: 30 },
  other: { label: "Autre", maxMinutes: 30 },
}

export const pauseReasonOf = (e: { pause_reason?: string | null }): PauseReason =>
  e.pause_reason && e.pause_reason in PAUSE_REASONS ? (e.pause_reason as PauseReason) : "other"

/** Pause anormalement longue : durée (en cours comprise) au-delà du seuil de son motif. */
export function isLongPause(e: TimeEntry, now = Date.now()) {
  if (e.kind !== "pause") return false
  const ms = (e.ended_at ? Date.parse(e.ended_at) : now) - Date.parse(e.started_at)
  return ms > PAUSE_REASONS[pauseReasonOf(e)].maxMinutes * 60_000
}

export type BudgetLevel = "ok" | "warning" | "over"

/** Consommation du budget d'heures : alerte à 80 %, dépassement au-delà de 100 %. */
export function budgetStatus(workMs: number, budgetMinutes: number | null) {
  if (!budgetMinutes) return null
  const budgetMs = budgetMinutes * 60_000
  const percent = Math.round((workMs / budgetMs) * 100)
  const level: BudgetLevel = workMs > budgetMs ? "over" : percent >= 80 ? "warning" : "ok"
  return { budgetMs, percent, level, overMs: Math.max(0, workMs - budgetMs) }
}

/** Tâches terminées, en cours et en retard. */
export function taskCounts(tasks: Pick<Task, "status" | "due_date">[], today = todayISO()) {
  return {
    done: tasks.filter((t) => t.status === "done").length,
    inProgress: tasks.filter((t) => t.status === "in_progress").length,
    late: tasks.filter((t) => isOverdue(t, today)).length,
  }
}

/** Jalon en retard : échéance passée sans être atteint. */
export const isMilestoneLate = (m: Pick<Milestone, "due_date" | "done_at">, today = todayISO()) =>
  !m.done_at && m.due_date < today
