import type { TimeEntry } from "@/lib/domain"

const DAY = 86_400_000

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

export type DailyRow = {
  userId: string
  /** Temps de travail par jour (ms), dans l'ordre de `days`. */
  perDay: number[]
  work: number
  pause: number
}

/**
 * Feuille de temps : travail par personne et par jour (minuit local), plus le total des pauses,
 * sur les jours donnés. Une session à cheval sur minuit est répartie sur les deux jours.
 */
export function dailyTimesheet(entries: TimeEntry[], days: Date[], now = Date.now()): DailyRow[] {
  if (days.length === 0) return []
  const from = days[0]!.getTime()
  const to = days[days.length - 1]!.getTime() + DAY
  const rows = new Map<string, DailyRow>()
  for (const e of entries) {
    if (entryMs(e, now, from, to) === 0) continue
    const row = rows.get(e.user_id) ?? { userId: e.user_id, perDay: days.map(() => 0), work: 0, pause: 0 }
    days.forEach((day, i) => {
      const start = day.getTime()
      const end = new Date(day.getFullYear(), day.getMonth(), day.getDate() + 1).getTime()
      const ms = entryMs(e, now, start, end)
      if (isWork(e)) {
        row.perDay[i]! += ms
        row.work += ms
      } else {
        row.pause += ms
      }
    })
    rows.set(e.user_id, row)
  }
  return [...rows.values()].sort((a, b) => b.work - a.work)
}

/** Les 7 jours (lundi → dimanche) de la semaine décalée de `offset` par rapport à la semaine courante. */
export function weekDays(offset = 0, now = new Date()) {
  const monday = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  monday.setDate(monday.getDate() - ((monday.getDay() + 6) % 7) + offset * 7)
  return Array.from({ length: 7 }, (_, i) => new Date(monday.getFullYear(), monday.getMonth(), monday.getDate() + i))
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
