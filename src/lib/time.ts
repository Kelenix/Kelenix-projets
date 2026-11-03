import { isLongPause, type Task, type TimeEntry } from "@/lib/domain"

const isWork = (e: TimeEntry) => e.kind !== "pause"

/** Durée d'une session, éventuellement limitée à l'intervalle [from, to[. */
const entryMs = (e: TimeEntry, now: number, from = 0, to = Infinity) => {
  const start = Math.max(new Date(e.started_at).getTime(), from)
  const end = Math.min(e.ended_at ? new Date(e.ended_at).getTime() : now, to)
  return Math.max(0, end - start)
}

export type UserTime = {
  userId: string
  /** Temps de travail cumulé (ms), pauses exclues. */
  ms: number
  /** Temps de pause cumulé (ms). */
  pauseMs: number
  running: boolean
  paused: boolean
  /** Durée de la pause en cours (ms), 0 sinon. */
  currentPauseMs: number
  /** Pause en cours (motif, détection de durée anormale). */
  currentPause?: TimeEntry
}

/** Temps par personne (session en cours comprise) : travail en cours d'abord, puis en pause, puis par temps. */
export function timeByUser(entries: TimeEntry[], now = Date.now()): UserTime[] {
  const totals = new Map<string, UserTime>()
  for (const e of entries) {
    const row = totals.get(e.user_id) ?? {
      userId: e.user_id,
      ms: 0,
      pauseMs: 0,
      running: false,
      paused: false,
      currentPauseMs: 0,
    }
    const ms = entryMs(e, now)
    if (isWork(e)) {
      row.ms += ms
      row.running ||= e.ended_at === null
    } else {
      row.pauseMs += ms
      if (e.ended_at === null) {
        row.paused = true
        row.currentPauseMs = ms
        row.currentPause = e
      }
    }
    totals.set(e.user_id, row)
  }
  const rank = (r: UserTime) => (r.running ? 2 : r.paused ? 1 : 0)
  return [...totals.values()].sort((a, b) => rank(b) - rank(a) || b.ms - a.ms)
}

/** Temps de travail depuis `since` (la part d'une session commencée avant est exclue ; pauses exclues). */
export function timeSince(entries: TimeEntry[], since: Date, now = Date.now()) {
  return entries.filter(isWork).reduce((sum, e) => sum + entryMs(e, now, since.getTime()), 0)
}

/** Totaux d'un ensemble de sessions (une tâche, un projet) : travail et pauses, en ms. */
export function totals(entries: TimeEntry[], now = Date.now()) {
  let work = 0
  let pause = 0
  for (const e of entries) {
    const ms = entryMs(e, now)
    if (isWork(e)) work += ms
    else pause += ms
  }
  return { work, pause }
}

export type Period = "day" | "week" | "month" | "year"
export type Bucket = { start: Date; end: Date; label: string }

const day = (y: number, m: number, d: number) => new Date(y, m, d)
const fmt = (d: Date, o: Intl.DateTimeFormatOptions) => d.toLocaleDateString("fr-FR", o)

/**
 * Colonnes d'une feuille de temps pour la période décalée de `offset` (0 = en cours) :
 * jour → ce jour ; semaine → 7 jours ; mois → semaines du mois ; année → 12 mois.
 */
export function periodBuckets(period: Period, offset = 0, now = new Date()) {
  const y = now.getFullYear()
  const m = now.getMonth()
  const d = now.getDate()
  if (period === "day") {
    const start = day(y, m, d + offset)
    return { title: fmt(start, { weekday: "long", day: "numeric", month: "long", year: "numeric" }), buckets: [{ start, end: day(y, m, d + offset + 1), label: fmt(start, { weekday: "short", day: "2-digit" }) }] }
  }
  if (period === "week") {
    const monday = day(y, m, d - ((now.getDay() + 6) % 7) + offset * 7)
    const buckets = Array.from({ length: 7 }, (_, i) => {
      const start = day(monday.getFullYear(), monday.getMonth(), monday.getDate() + i)
      return { start, end: day(start.getFullYear(), start.getMonth(), start.getDate() + 1), label: fmt(start, { weekday: "short", day: "2-digit" }) }
    })
    const title = `${fmt(buckets[0]!.start, { day: "numeric", month: "short" })} – ${fmt(buckets[6]!.start, { day: "numeric", month: "short", year: "numeric" })}`
    return { title, buckets }
  }
  if (period === "month") {
    const first = day(y, m + offset, 1)
    const next = day(first.getFullYear(), first.getMonth() + 1, 1)
    const buckets: Bucket[] = []
    for (let start = first; start < next; ) {
      const sunday = day(start.getFullYear(), start.getMonth(), start.getDate() + (7 - ((start.getDay() + 6) % 7)))
      const end = sunday < next ? sunday : next
      const last = day(end.getFullYear(), end.getMonth(), end.getDate() - 1)
      buckets.push({ start, end, label: `${start.getDate()}–${last.getDate()}` })
      start = end
    }
    return { title: fmt(first, { month: "long", year: "numeric" }), buckets }
  }
  const buckets = Array.from({ length: 12 }, (_, i) => {
    const start = day(y + offset, i, 1)
    return { start, end: day(y + offset, i + 1, 1), label: fmt(start, { month: "short" }) }
  })
  return { title: String(y + offset), buckets }
}

export type TimesheetRow = {
  userId: string
  /** Temps de travail par colonne (ms), dans l'ordre des colonnes. */
  perBucket: number[]
  /** Temps de pause par colonne (ms). */
  pausePerBucket: number[]
  work: number
  pause: number
  /** Nombre de pauses prises sur la période (commencées dans la période). */
  pauseCount: number
  /** Dont pauses anormalement longues. */
  longPauses: number
}

/**
 * Feuille de temps : travail par personne et par colonne (jours, semaines ou mois), plus le total
 * des pauses. Une session à cheval sur deux colonnes est répartie entre elles.
 */
export function timesheet(entries: TimeEntry[], buckets: Bucket[], now = Date.now()): TimesheetRow[] {
  if (buckets.length === 0) return []
  const from = buckets[0]!.start.getTime()
  const to = buckets[buckets.length - 1]!.end.getTime()
  const rows = new Map<string, TimesheetRow>()
  for (const e of entries) {
    if (entryMs(e, now, from, to) === 0) continue
    const row = rows.get(e.user_id) ?? {
      userId: e.user_id,
      perBucket: buckets.map(() => 0),
      pausePerBucket: buckets.map(() => 0),
      work: 0,
      pause: 0,
      pauseCount: 0,
      longPauses: 0,
    }
    const started = Date.parse(e.started_at)
    if (!isWork(e) && started >= from && started < to) {
      row.pauseCount++
      if (isLongPause(e, now)) row.longPauses++
    }
    buckets.forEach((b, i) => {
      const ms = entryMs(e, now, b.start.getTime(), b.end.getTime())
      if (isWork(e)) {
        row.perBucket[i]! += ms
        row.work += ms
      } else {
        row.pausePerBucket[i]! += ms
        row.pause += ms
      }
    })
    rows.set(e.user_id, row)
  }
  return [...rows.values()].sort((a, b) => b.work - a.work)
}

/** « 2 h 05 », « 12 min », « < 1 min » ; avec secondes pour une session en cours (« 12:04 »). */
export function formatDuration(ms: number, live = false) {
  const totalSeconds = Math.floor(ms / 1000)
  const h = Math.floor(totalSeconds / 3600)
  const m = Math.floor((totalSeconds % 3600) / 60)
  const s = totalSeconds % 60
  const pad = (n: number) => String(n).padStart(2, "0")
  if (live) return h > 0 ? `${h}:${pad(m)}:${pad(s)}` : `${pad(m)}:${pad(s)}`
  if (h > 0) return `${h} h ${pad(m)}`
  return m > 0 ? `${m} min` : "< 1 min"
}

export type EstimateRow = { userId: string; tasks: number; estimatedMs: number; actualMs: number }

/**
 * Temps estimé et temps de travail réellement passé par collaborateur, sur les tâches où une
 * estimation lui est attribuée (sans estimation, aucune comparaison possible).
 */
export function estimateVsActual(tasks: Pick<Task, "assignees" | "time_entries">[], now = Date.now()): EstimateRow[] {
  const rows = new Map<string, EstimateRow>()
  for (const task of tasks)
    for (const a of task.assignees) {
      if (a.estimated_minutes === null) continue
      const row = rows.get(a.user_id) ?? { userId: a.user_id, tasks: 0, estimatedMs: 0, actualMs: 0 }
      row.tasks++
      row.estimatedMs += a.estimated_minutes * 60_000
      row.actualMs += totals(task.time_entries.filter((e) => e.user_id === a.user_id), now).work
      rows.set(a.user_id, row)
    }
  return [...rows.values()]
}

export type Activity = { taskId: string; entry: TimeEntry }

/** Session ouverte de chaque personne (une au plus) : la tâche sur laquelle elle travaille ou est en pause. */
export function currentActivity(tasks: Pick<Task, "id" | "time_entries">[]) {
  const activity = new Map<string, Activity>()
  for (const task of tasks)
    for (const entry of task.time_entries) if (!entry.ended_at) activity.set(entry.user_id, { taskId: task.id, entry })
  return activity
}
