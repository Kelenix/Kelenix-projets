import type { TimeEntry } from "@/lib/domain"

export type UserTime = { userId: string; ms: number; running: boolean }

const entryMs = (e: TimeEntry, now: number, since = 0) => {
  const start = Math.max(new Date(e.started_at).getTime(), since)
  const end = e.ended_at ? new Date(e.ended_at).getTime() : now
  return Math.max(0, end - start)
}

/** Temps passé par personne (chronomètre en cours compris), du plus grand au plus petit. */
export function timeByUser(entries: TimeEntry[], now = Date.now()): UserTime[] {
  const totals = new Map<string, UserTime>()
  for (const e of entries) {
    const row = totals.get(e.user_id) ?? { userId: e.user_id, ms: 0, running: false }
    row.ms += entryMs(e, now)
    row.running ||= e.ended_at === null
    totals.set(e.user_id, row)
  }
  return [...totals.values()].sort((a, b) => Number(b.running) - Number(a.running) || b.ms - a.ms)
}

/** Temps passé depuis `since` (la part d'une session commencée avant est exclue). */
export function timeSince(entries: TimeEntry[], since: Date, now = Date.now()) {
  return entries.reduce((sum, e) => sum + entryMs(e, now, since.getTime()), 0)
}

/** « 2 h 05 », « 12 min », « < 1 min » ; avec secondes pour un chronomètre en cours (« 12:04 »). */
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
