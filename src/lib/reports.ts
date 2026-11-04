import {
  isLongPause,
  PAUSE_REASONS,
  pauseReasonOf,
  PROJECT_STATUS_LABELS,
  TASK_STATUS_LABELS,
  type PauseReason,
  type Project,
  type Task,
  type TaskStatus,
  type TimeEntry,
} from "@/lib/domain"
import { entryMs, totals } from "@/lib/time"

export type ReportKind = "hours" | "projects" | "tasks" | "people" | "pauses" | "estimates"
export type Granularity = "day" | "week" | "month"

export const REPORTS: Record<ReportKind, string> = {
  hours: "Heures travaillées",
  projects: "Temps par projet",
  tasks: "Temps par tâche",
  people: "Temps par collaborateur",
  pauses: "Pauses par collaborateur",
  estimates: "Heures estimées / réelles",
}

export const GRANULARITIES: Record<Granularity, string> = { day: "Quotidien", week: "Hebdomadaire", month: "Mensuel" }

/** Colonne d'un rapport : une durée est en millisecondes, affichée « 1 h 30 » et exportée en heures décimales. */
export type Column = {
  key: string
  label: string
  kind: "text" | "duration" | "number" | "percent" | "money"
  /** Durée signée (écart) : « +1 h 00 » ou « -10 min ». */
  signed?: boolean
}
export type Row = Record<string, string | number | null>
export type Report = { title: string; columns: Column[]; rows: Row[]; total?: Row; note?: string }

export type ReportFilters = {
  /** Période [from, to[ en heure locale. */
  from: Date
  to: Date
  userId?: string
  projectId?: string
  taskId?: string
  status?: TaskStatus
}

type Input = {
  tasks: Task[]
  projects: Project[]
  names: Map<string, string>
  filters: ReportFilters
  granularity?: Granularity
  now?: number
}

const isWork = (e: TimeEntry) => e.kind !== "pause"
const day = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate())
const fmt = (d: Date, o: Intl.DateTimeFormatOptions) => d.toLocaleDateString("fr-FR", o)

/** Tâches retenues par les filtres projet / tâche / statut. */
function scopedTasks({ tasks, filters }: Input) {
  return tasks.filter(
    (t) =>
      (!filters.projectId || t.project_id === filters.projectId) &&
      (!filters.taskId || t.id === filters.taskId) &&
      (!filters.status || t.status === filters.status)
  )
}

/** Sessions d'une tâche retenues par le filtre collaborateur, avec leur durée dans la période. */
function sessions(task: Task, { filters, now = Date.now() }: Input) {
  const from = filters.from.getTime()
  const to = filters.to.getTime()
  return task.time_entries
    .filter((e) => !filters.userId || e.user_id === filters.userId)
    .map((e) => ({ entry: e, ms: entryMs(e, now, from, to) }))
    .filter((s) => s.ms > 0)
}

const sum = (rows: Row[], key: string) => rows.reduce((s, r) => s + (Number(r[key]) || 0), 0)

/** Découpage de la période en jours, semaines (du lundi) ou mois. */
export function buckets(from: Date, to: Date, granularity: Granularity) {
  const result: { start: Date; end: Date; label: string }[] = []
  let start = day(from)
  if (granularity === "week") start.setDate(start.getDate() - ((start.getDay() + 6) % 7))
  if (granularity === "month") start = new Date(start.getFullYear(), start.getMonth(), 1)
  while (start < to) {
    const end = new Date(start)
    if (granularity === "day") end.setDate(end.getDate() + 1)
    else if (granularity === "week") end.setDate(end.getDate() + 7)
    else end.setMonth(end.getMonth() + 1)
    const label =
      granularity === "day"
        ? fmt(start, { weekday: "short", day: "2-digit", month: "short", year: "numeric" })
        : granularity === "week"
          ? `Semaine du ${fmt(start, { day: "2-digit", month: "short", year: "numeric" })}`
          : fmt(start, { month: "long", year: "numeric" })
    result.push({ start, end, label })
    start = end
  }
  return result
}

/** 63–65 : heures travaillées par jour, semaine ou mois, une colonne par collaborateur. */
function hoursReport(input: Input): Report {
  const { filters, names, granularity = "day", now = Date.now() } = input
  const all = scopedTasks(input).flatMap((t) => t.time_entries.filter(isWork))
  const people = [...new Set(all.filter((e) => !filters.userId || e.user_id === filters.userId).map((e) => e.user_id))]
    .filter((id) => sessionsInPeriod(all, id, filters, now) > 0)
    .sort((a, b) => (names.get(a) ?? "").localeCompare(names.get(b) ?? "", "fr"))
  const rows = buckets(filters.from, filters.to, granularity).map((b) => {
    const from = Math.max(b.start.getTime(), filters.from.getTime())
    const to = Math.min(b.end.getTime(), filters.to.getTime())
    const row: Row = { period: b.label }
    for (const id of people)
      row[id] = all.filter((e) => e.user_id === id).reduce((s, e) => s + entryMs(e, now, from, to), 0)
    row.total = people.reduce((s, id) => s + Number(row[id]), 0)
    return row
  })
  const columns: Column[] = [
    { key: "period", label: "Période", kind: "text" },
    ...people.map((id) => ({ key: id, label: names.get(id) ?? "Ancien membre", kind: "duration" as const })),
    { key: "total", label: "Total", kind: "duration" },
  ]
  const total: Row = { period: "Total" }
  for (const c of columns.slice(1)) total[c.key] = sum(rows, c.key)
  return { title: `${REPORTS.hours} — ${GRANULARITIES[granularity].toLowerCase()}`, columns, rows, total }
}

function sessionsInPeriod(entries: TimeEntry[], userId: string, filters: ReportFilters, now: number) {
  return entries
    .filter((e) => e.user_id === userId)
    .reduce((s, e) => s + entryMs(e, now, filters.from.getTime(), filters.to.getTime()), 0)
}

/** 66 : temps par projet sur la période, avec la consommation totale du budget d'heures. */
function projectsReport(input: Input): Report {
  const { projects, now = Date.now() } = input
  const byProject = Map.groupBy(scopedTasks(input), (t) => t.project_id)
  const rows: Row[] = []
  for (const [projectId, tasks] of byProject) {
    const project = projects.find((p) => p.id === projectId)
    const s = tasks.flatMap((t) => sessions(t, input))
    if (s.length === 0) continue
    const allWork = totals(tasks.flatMap((t) => t.time_entries), now).work
    rows.push({
      name: project?.name ?? "—",
      status: project ? PROJECT_STATUS_LABELS[project.status] : "—",
      people: new Set(s.map((x) => x.entry.user_id)).size,
      work: s.filter((x) => isWork(x.entry)).reduce((a, x) => a + x.ms, 0),
      pause: s.filter((x) => !isWork(x.entry)).reduce((a, x) => a + x.ms, 0),
      budget: project?.budget_minutes ? project.budget_minutes * 60_000 : null,
      consumed: project?.budget_minutes ? Math.round((allWork / (project.budget_minutes * 60_000)) * 100) : null,
    })
  }
  rows.sort((a, b) => Number(b.work) - Number(a.work))
  return {
    title: REPORTS.projects,
    columns: [
      { key: "name", label: "Projet", kind: "text" },
      { key: "status", label: "Statut", kind: "text" },
      { key: "people", label: "Collaborateurs", kind: "number" },
      { key: "work", label: "Travail", kind: "duration" },
      { key: "pause", label: "Pauses", kind: "duration" },
      { key: "budget", label: "Budget", kind: "duration" },
      { key: "consumed", label: "Budget consommé (total)", kind: "percent" },
    ],
    rows,
    total: { name: "Total", work: sum(rows, "work"), pause: sum(rows, "pause") },
  }
}

/** 67 : temps par tâche sur la période. */
function tasksReport(input: Input): Report {
  const { projects } = input
  const names = new Map(projects.map((p) => [p.id, p.name]))
  const rows: Row[] = []
  for (const task of scopedTasks(input)) {
    const s = sessions(task, input)
    if (s.length === 0) continue
    rows.push({
      name: task.title,
      project: names.get(task.project_id) ?? "—",
      status: TASK_STATUS_LABELS[task.status],
      people: new Set(s.map((x) => x.entry.user_id)).size,
      work: s.filter((x) => isWork(x.entry)).reduce((a, x) => a + x.ms, 0),
      pause: s.filter((x) => !isWork(x.entry)).reduce((a, x) => a + x.ms, 0),
    })
  }
  rows.sort((a, b) => Number(b.work) - Number(a.work))
  return {
    title: REPORTS.tasks,
    columns: [
      { key: "name", label: "Tâche", kind: "text" },
      { key: "project", label: "Projet", kind: "text" },
      { key: "status", label: "Statut", kind: "text" },
      { key: "people", label: "Collaborateurs", kind: "number" },
      { key: "work", label: "Travail", kind: "duration" },
      { key: "pause", label: "Pauses", kind: "duration" },
    ],
    rows,
    total: { name: "Total", work: sum(rows, "work"), pause: sum(rows, "pause") },
  }
}

/** Sessions de la période regroupées par collaborateur. */
function byPerson(input: Input) {
  const all = scopedTasks(input).flatMap((t) => sessions(t, input).map((s) => ({ ...s, taskId: t.id })))
  return Map.groupBy(all, (s) => s.entry.user_id)
}

/** 68 : temps par collaborateur sur la période. */
function peopleReport(input: Input): Report {
  const rows: Row[] = []
  for (const [userId, s] of byPerson(input)) {
    const work = s.filter((x) => isWork(x.entry))
    const days = new Set(work.map((x) => day(new Date(x.entry.started_at)).getTime())).size
    const workMs = work.reduce((a, x) => a + x.ms, 0)
    rows.push({
      name: input.names.get(userId) ?? "Ancien membre",
      days,
      sessions: work.length,
      tasks: new Set(work.map((x) => x.taskId)).size,
      work: workMs,
      pause: s.filter((x) => !isWork(x.entry)).reduce((a, x) => a + x.ms, 0),
      average: days ? Math.round(workMs / days) : 0,
    })
  }
  rows.sort((a, b) => Number(b.work) - Number(a.work))
  return {
    title: REPORTS.people,
    columns: [
      { key: "name", label: "Collaborateur", kind: "text" },
      { key: "days", label: "Jours travaillés", kind: "number" },
      { key: "sessions", label: "Sessions", kind: "number" },
      { key: "tasks", label: "Tâches", kind: "number" },
      { key: "work", label: "Travail", kind: "duration" },
      { key: "pause", label: "Pauses", kind: "duration" },
      { key: "average", label: "Moyenne par jour travaillé", kind: "duration" },
    ],
    rows,
    total: { name: "Total", sessions: sum(rows, "sessions"), work: sum(rows, "work"), pause: sum(rows, "pause") },
  }
}

/** 69 : pauses par collaborateur, détaillées par motif. */
function pausesReport(input: Input): Report {
  const now = input.now ?? Date.now()
  const reasons = Object.keys(PAUSE_REASONS) as PauseReason[]
  const rows: Row[] = []
  for (const [userId, s] of byPerson(input)) {
    const pauses = s.filter((x) => !isWork(x.entry))
    if (pauses.length === 0) continue
    const row: Row = {
      name: input.names.get(userId) ?? "Ancien membre",
      count: pauses.length,
      long: pauses.filter((x) => isLongPause(x.entry, now)).length,
      total: pauses.reduce((a, x) => a + x.ms, 0),
    }
    for (const r of reasons) row[r] = pauses.filter((x) => pauseReasonOf(x.entry) === r).reduce((a, x) => a + x.ms, 0)
    rows.push(row)
  }
  rows.sort((a, b) => Number(b.total) - Number(a.total))
  const columns: Column[] = [
    { key: "name", label: "Collaborateur", kind: "text" },
    { key: "count", label: "Nombre de pauses", kind: "number" },
    { key: "long", label: "Pauses longues", kind: "number" },
    { key: "total", label: "Total des pauses", kind: "duration" },
    ...reasons.map((r) => ({ key: r, label: PAUSE_REASONS[r].label, kind: "duration" as const })),
  ]
  const total: Row = { name: "Total" }
  for (const c of columns.slice(1)) total[c.key] = sum(rows, c.key)
  return {
    title: REPORTS.pauses,
    columns,
    rows,
    total,
    note: "Seules les pauses que vos droits permettent de voir sont comptées (les vôtres, ou celles de votre équipe pour un chef de projet ou un administrateur).",
  }
}

/** 70 : heures estimées et réelles par tâche et collaborateur (temps réel cumulé depuis le début de la tâche). */
function estimatesReport(input: Input): Report {
  const { projects, names, filters, now = Date.now() } = input
  const projectNames = new Map(projects.map((p) => [p.id, p.name]))
  const rows: Row[] = []
  for (const task of scopedTasks(input))
    for (const a of task.assignees) {
      if (a.estimated_minutes === null || (filters.userId && a.user_id !== filters.userId)) continue
      const estimate = a.estimated_minutes * 60_000
      const actual = totals(task.time_entries.filter((e) => e.user_id === a.user_id), now).work
      rows.push({
        name: task.title,
        project: projectNames.get(task.project_id) ?? "—",
        person: names.get(a.user_id) ?? "Ancien membre",
        status: TASK_STATUS_LABELS[task.status],
        estimate,
        actual,
        gap: actual - estimate,
        consumed: estimate ? Math.round((actual / estimate) * 100) : null,
      })
    }
  rows.sort((a, b) => Number(b.gap) - Number(a.gap))
  const estimate = sum(rows, "estimate")
  const actual = sum(rows, "actual")
  return {
    title: REPORTS.estimates,
    columns: [
      { key: "name", label: "Tâche", kind: "text" },
      { key: "project", label: "Projet", kind: "text" },
      { key: "person", label: "Collaborateur", kind: "text" },
      { key: "status", label: "Statut", kind: "text" },
      { key: "estimate", label: "Estimé", kind: "duration" },
      { key: "actual", label: "Réel", kind: "duration" },
      { key: "gap", label: "Écart", kind: "duration", signed: true },
      { key: "consumed", label: "Consommé", kind: "percent" },
    ],
    rows,
    total: {
      name: "Total",
      estimate,
      actual,
      gap: actual - estimate,
      consumed: estimate ? Math.round((actual / estimate) * 100) : null,
    },
    note: "Le temps réel est cumulé depuis le début de chaque tâche, indépendamment de la période choisie.",
  }
}

export function buildReport(kind: ReportKind, input: Input): Report {
  return {
    hours: hoursReport,
    projects: projectsReport,
    tasks: tasksReport,
    people: peopleReport,
    pauses: pausesReport,
    estimates: estimatesReport,
  }[kind](input)
}

/** Heures décimales pour les exports (1 h 30 → 1,5). */
export const toHours = (ms: number) => Math.round((ms / 3_600_000) * 100) / 100
