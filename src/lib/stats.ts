import { isOverdue, todayISO, type Profile, type Task, type TaskStatus } from "@/lib/domain"
import { timeSince } from "@/lib/time"

const DAY = 86_400_000

/** Lundi (00:00, heure locale) de la semaine contenant `date`. */
export function startOfWeek(date: Date) {
  const d = new Date(date.getFullYear(), date.getMonth(), date.getDate())
  d.setDate(d.getDate() - ((d.getDay() + 6) % 7))
  return d
}

export type WeekBucket = { start: Date; count: number }

/** Nombre de tâches terminées par semaine, des `weeks` dernières semaines (la plus ancienne d'abord). */
export function weeklyCompletions(tasks: Pick<Task, "completed_at">[], weeks: number, now = new Date()): WeekBucket[] {
  const current = startOfWeek(now)
  const buckets = Array.from({ length: weeks }, (_, i) => {
    const start = new Date(current)
    start.setDate(current.getDate() - (weeks - 1 - i) * 7)
    return { start, count: 0 }
  })
  const first = buckets[0]!.start.getTime()
  for (const task of tasks) {
    if (!task.completed_at) continue
    const time = new Date(task.completed_at).getTime()
    if (time < first) continue
    const index = Math.floor((startOfWeek(new Date(time)).getTime() - first) / (7 * DAY) + 0.5)
    if (index >= 0 && index < weeks) buckets[index]!.count++
  }
  return buckets
}

export function statusCounts(tasks: Pick<Task, "status">[]): Record<TaskStatus, number> {
  const counts: Record<TaskStatus, number> = { todo: 0, in_progress: 0, rescheduled: 0, done: 0 }
  for (const t of tasks) counts[t.status]++
  return counts
}

export type MemberStats = {
  id: string | null
  name: string
  status: Record<TaskStatus, number>
  total: number
  overdue: number
  blocked: number
  completedInPeriod: number
  /** Temps chronométré par la personne sur la période, toutes tâches visibles confondues (ms). */
  timeInPeriod: number
  completionRate: number
}

/**
 * Statistiques par responsable (une ligne « À assigner » pour les tâches sans responsable).
 * `since` borne le compteur « terminées sur la période ».
 */
export function memberStats(
  tasks: Task[],
  profiles: Profile[],
  since: Date,
  today = todayISO(),
  now = Date.now()
): MemberStats[] {
  const groups = Map.groupBy(tasks, (t) => t.assignee_id)
  const entries = Map.groupBy(
    tasks.flatMap((t) => t.time_entries),
    (e) => e.user_id
  )
  const rows: MemberStats[] = [...profiles.map((p) => ({ id: p.id, name: p.full_name })), { id: null, name: "À assigner" }]
    .map(({ id, name }) => {
      const own = groups.get(id) ?? []
      const status = statusCounts(own)
      return {
        id,
        name,
        status,
        total: own.length,
        overdue: own.filter((t) => isOverdue(t, today)).length,
        blocked: own.filter((t) => t.is_blocked && t.status !== "done").length,
        completedInPeriod: own.filter((t) => t.completed_at && new Date(t.completed_at) >= since).length,
        timeInPeriod: id ? timeSince(entries.get(id) ?? [], since, now) : 0,
        completionRate: own.length === 0 ? 0 : Math.round((status.done / own.length) * 100),
      }
    })
  return rows
    .filter((r) => r.id !== null || r.total > 0)
    .sort((a, b) => b.total - b.status.done - (a.total - a.status.done) || a.name.localeCompare(b.name, "fr"))
}
