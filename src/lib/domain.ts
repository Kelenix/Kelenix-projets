import type { Enums, Tables } from "@/lib/database.types"

export type Profile = Tables<"profiles">
export type Client = Tables<"clients">
/** Projet avec ses membres ; `manager_ids` : ses chefs de projet. */
export type Project = Tables<"projects"> & { member_ids: string[]; manager_ids: string[]; tag_ids: string[] }
export type Milestone = Tables<"project_milestones">
export type ChecklistItem = Pick<Tables<"task_checklist_items">, "id" | "label" | "done">
export type TimeEntry = Pick<Tables<"time_entries">, "user_id" | "started_at" | "ended_at"> &
  Partial<Pick<Tables<"time_entries">, "id" | "kind" | "description" | "source" | "edited_at" | "pause_reason" | "billable" | "approved_at">>
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
  tag_ids: string[]
}
export type Tag = Tables<"tags">
export type Absence = Tables<"absences">
export type Holiday = Tables<"holidays">
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

// ─── Tags ───────────────────────────────────────────────────────────────────
export type TagColor = "slate" | "blue" | "green" | "amber" | "red" | "teal" | "orange" | "pink"
/** Couleurs des tags : fond léger et texte lisibles en clair comme en sombre. */
export const TAG_COLORS: Record<TagColor, string> = {
  slate: "bg-slate-500/15 text-slate-700 dark:text-slate-300",
  blue: "bg-blue-500/15 text-blue-700 dark:text-blue-300",
  green: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300",
  amber: "bg-amber-500/20 text-amber-800 dark:text-amber-300",
  red: "bg-red-500/15 text-red-700 dark:text-red-300",
  teal: "bg-teal-500/15 text-teal-700 dark:text-teal-300",
  orange: "bg-orange-500/15 text-orange-700 dark:text-orange-300",
  pink: "bg-pink-500/15 text-pink-700 dark:text-pink-300",
}

// ─── Absences et jours fériés ───────────────────────────────────────────────
export type AbsenceKind = "leave" | "sick" | "training" | "other"
export const ABSENCE_LABELS: Record<AbsenceKind, string> = {
  leave: "Congés",
  sick: "Maladie",
  training: "Formation",
  other: "Autre absence",
}

const iso = (y: number, m: number, d: number) => todayISO(new Date(y, m - 1, d))

/** Jours fériés en France pour une année (dont Pâques et les fêtes qui en dépendent). */
export function frenchHolidays(year: number): { day: string; name: string }[] {
  // Dimanche de Pâques (algorithme de Meeus / Jones / Butcher).
  const a = year % 19
  const b = Math.floor(year / 100)
  const c = year % 100
  const d = Math.floor(b / 4)
  const e = b % 4
  const f = Math.floor((b + 8) / 25)
  const g = Math.floor((b - f + 1) / 3)
  const h = (19 * a + b - d - g + 15) % 30
  const i = Math.floor(c / 4)
  const k = c % 4
  const l = (32 + 2 * e + 2 * i - h - k) % 7
  const m = Math.floor((a + 11 * h + 22 * l) / 451)
  const month = Math.floor((h + l - 7 * m + 114) / 31)
  const day = ((h + l - 7 * m + 114) % 31) + 1
  const easter = (offset: number) => iso(year, month, day + offset)
  return [
    { day: iso(year, 1, 1), name: "Jour de l'an" },
    { day: easter(1), name: "Lundi de Pâques" },
    { day: iso(year, 5, 1), name: "Fête du Travail" },
    { day: iso(year, 5, 8), name: "Victoire 1945" },
    { day: easter(39), name: "Ascension" },
    { day: easter(50), name: "Lundi de Pentecôte" },
    { day: iso(year, 7, 14), name: "Fête nationale" },
    { day: iso(year, 8, 15), name: "Assomption" },
    { day: iso(year, 11, 1), name: "Toussaint" },
    { day: iso(year, 11, 11), name: "Armistice 1918" },
    { day: iso(year, 12, 25), name: "Noël" },
  ]
}

/** Absences couvrant un jour donné. */
export const absencesOn = (absences: Absence[], day: string) => absences.filter((a) => a.start_date <= day && a.end_date >= day)

// ─── Sessions oubliées ──────────────────────────────────────────────────────
/** Au-delà de cette durée, une session de travail ouverte est probablement oubliée. */
export const FORGOTTEN_AFTER_HOURS = 10

/**
 * Session de l'utilisateur probablement oubliée : chronomètre ouvert depuis plus de 10 heures, ou
 * démarré un jour précédent (onglet fermé, ordinateur éteint…).
 */
export function forgottenSession(entries: (TimeEntry & { task_id?: string })[], userId: string, now = Date.now()) {
  const open = entries.find((e) => e.user_id === userId && !e.ended_at)
  if (!open) return null
  const started = Date.parse(open.started_at)
  const midnight = new Date(now)
  midnight.setHours(0, 0, 0, 0)
  const hours = (now - started) / 3_600_000
  return hours >= FORGOTTEN_AFTER_HOURS || started < midnight.getTime() ? { entry: open, hours } : null
}

// ─── Calendrier ─────────────────────────────────────────────────────────────
/** Semaines (du lundi au dimanche) couvrant le mois, jours hors mois inclus pour compléter. */
export function monthGrid(year: number, month: number) {
  const first = new Date(year, month, 1)
  const start = new Date(year, month, 1 - ((first.getDay() + 6) % 7))
  const last = new Date(year, month + 1, 0)
  const weeks: { day: string; inMonth: boolean }[][] = []
  for (let cursor = start; cursor <= last; ) {
    const week = Array.from({ length: 7 }, (_, i) => {
      const d = new Date(cursor.getFullYear(), cursor.getMonth(), cursor.getDate() + i)
      return { day: todayISO(d), inMonth: d.getMonth() === month }
    })
    weeks.push(week)
    cursor = new Date(cursor.getFullYear(), cursor.getMonth(), cursor.getDate() + 7)
  }
  return weeks
}
