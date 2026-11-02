import type { Enums, Tables } from "@/lib/database.types"

export type Profile = Tables<"profiles">
export type Client = Tables<"clients">
export type Project = Tables<"projects"> & { member_ids: string[] }
export type ChecklistItem = Pick<Tables<"task_checklist_items">, "id" | "label" | "done">
export type TimeEntry = Pick<Tables<"time_entries">, "user_id" | "started_at" | "ended_at">
/** Tâche avec sa checklist et le temps passé, visibles directement sur les cartes. */
export type Task = Tables<"tasks"> & { checklist: ChecklistItem[]; time_entries: TimeEntry[] }
export type ProjectStatus = Enums<"project_status">
export type TaskStatus = Enums<"task_status">
export type TaskPriority = Enums<"task_priority">
export type Role = Enums<"app_role">

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
  owner: "Propriétaire",
  collaborator: "Collaborateur",
}

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
