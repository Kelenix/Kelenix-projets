"use client"

import { Clock, Coffee, Play } from "lucide-react"
import { initials, isAssigned, PAUSE_REASONS, pauseReasonOf, todayISO, type Profile, type Task } from "@/lib/domain"
import { currentActivity, estimateVsActual, formatDuration, overrunTasks, workload } from "@/lib/time"
import { cn } from "@/lib/utils"
import { useDashboard } from "./state"
import { Gap } from "./tasks/task-meta"
import { useTick } from "./timesheet"

function Person({ name, self }: { name: string; self: boolean }) {
  return (
    <span className="flex min-w-0 items-center gap-2">
      <span className="grid size-6 shrink-0 place-items-center rounded-full bg-accent text-[10px] font-semibold text-accent-foreground">
        {initials(name)}
      </span>
      <span className="truncate font-medium">
        {name}
        {self && <span className="font-normal text-muted-foreground"> (vous)</span>}
      </span>
    </span>
  )
}

/**
 * Pour chaque collaborateur : la session en cours (travail ou pause, selon ce que ses droits
 * permettent de voir) et ses tâches « En cours ».
 */
export function TeamNow({ tasks, people }: { tasks: Task[]; people: Profile[] }) {
  const { viewer, navigate } = useDashboard()
  const activity = currentActivity(tasks)
  const now = useTick(activity.size > 0)
  const byId = new Map(tasks.map((t) => [t.id, t]))
  const open = (task: Task) => navigate({ taskId: task.id })

  return (
    <ul className="divide-y" aria-label="Activité de chaque collaborateur">
      {people.map((p) => {
        const current = activity.get(p.id)
        const task = current && byId.get(current.taskId)
        const inProgress = tasks.filter((t) => t.status === "in_progress" && isAssigned(t, p.id))
        const since = current ? formatDuration(now - Date.parse(current.entry.started_at)) : ""
        return (
          <li key={p.id} className="grid gap-2 py-3 sm:grid-cols-[minmax(0,14rem)_minmax(0,1fr)_minmax(0,1fr)] sm:items-start sm:gap-4">
            <Person name={p.full_name} self={p.id === viewer.id} />
            <div className="text-sm">
              {task && current.entry.kind === "pause" ? (
                <p className="flex items-center gap-1.5 text-[oklch(0.5_0.14_55)]">
                  <Coffee className="size-3.5 shrink-0" aria-hidden />
                  <span className="min-w-0">
                    En pause ({PAUSE_REASONS[pauseReasonOf(current.entry)].label.toLowerCase()}) depuis {since} ·{" "}
                    <button type="button" className="hover:underline" onClick={() => open(task)}>
                      {task.title}
                    </button>
                  </span>
                </p>
              ) : task ? (
                <p className="flex items-center gap-1.5 text-primary">
                  <Play className="size-3.5 shrink-0 fill-current" aria-hidden />
                  <span className="min-w-0">
                    Travaille depuis {since} sur{" "}
                    <button type="button" className="font-medium hover:underline" onClick={() => open(task)}>
                      {task.title}
                    </button>
                  </span>
                </p>
              ) : (
                <p className="flex items-center gap-1.5 text-muted-foreground">
                  <Clock className="size-3.5 shrink-0" aria-hidden /> Aucune session en cours
                </p>
              )}
            </div>
            <div className="text-sm">
              {inProgress.length === 0 ? (
                <span className="text-muted-foreground">Aucune tâche en cours</span>
              ) : (
                <>
                  <span className="text-xs text-muted-foreground">
                    {inProgress.length} tâche{inProgress.length > 1 ? "s" : ""} en cours :{" "}
                  </span>
                  {inProgress.slice(0, 3).map((t, i) => (
                    <span key={t.id}>
                      {i > 0 && ", "}
                      <button type="button" className="hover:underline" onClick={() => open(t)}>
                        {t.title}
                      </button>
                    </span>
                  ))}
                  {inProgress.length > 3 && <span className="text-muted-foreground"> et {inProgress.length - 3} autre(s)</span>}
                </>
              )}
            </div>
          </li>
        )
      })}
    </ul>
  )
}

/** Temps estimé et temps réellement passé par collaborateur, sur les tâches estimées. */
export function EstimateTable({ tasks, people }: { tasks: Task[]; people: Profile[] }) {
  const { viewer } = useDashboard()
  const rows = estimateVsActual(tasks)
  const names = new Map(people.map((p) => [p.id, p.full_name]))
  const shown = rows.filter((r) => names.has(r.userId)).sort((a, b) => b.estimatedMs - a.estimatedMs)

  if (shown.length === 0)
    return (
      <p className="text-sm text-muted-foreground">
        Aucune estimation pour l&apos;instant. Indiquez le temps estimé de chaque collaborateur dans le détail d&apos;une tâche.
      </p>
    )

  return (
    <div className="-mx-4 overflow-x-auto px-4">
      <table className="w-full min-w-[560px] text-sm">
        <caption className="sr-only">Temps estimé et temps réel par collaborateur</caption>
        <thead>
          <tr className="border-b text-left text-xs text-muted-foreground">
            <th scope="col" className="py-2 pr-4 font-medium">Collaborateur</th>
            <th scope="col" className="py-2 pr-4 text-right font-medium">Tâches estimées</th>
            <th scope="col" className="py-2 pr-4 text-right font-medium">Estimé</th>
            <th scope="col" className="py-2 pr-4 text-right font-medium">Réel</th>
            <th scope="col" className="py-2 pr-4 text-right font-medium">Écart</th>
            <th scope="col" className="w-1/5 py-2 font-medium">Consommé</th>
          </tr>
        </thead>
        <tbody className="divide-y">
          {shown.map((r) => {
            const percent = r.estimatedMs === 0 ? 0 : Math.round((r.actualMs / r.estimatedMs) * 100)
            return (
              <tr key={r.userId}>
                <th scope="row" className="py-2.5 pr-4 text-left">
                  <Person name={names.get(r.userId)!} self={r.userId === viewer.id} />
                </th>
                <td className="py-2.5 pr-4 text-right tabular-nums">{r.tasks}</td>
                <td className="py-2.5 pr-4 text-right tabular-nums">{formatDuration(r.estimatedMs)}</td>
                <td className="py-2.5 pr-4 text-right tabular-nums">{r.actualMs > 0 ? formatDuration(r.actualMs) : "0 min"}</td>
                <td className="py-2.5 pr-4 text-right tabular-nums">
                  <Gap estimated={r.estimatedMs} actual={r.actualMs} />
                </td>
                <td className="py-2.5">
                  <div className="flex items-center gap-2">
                    <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted" aria-hidden>
                      <div
                        className={percent > 100 ? "h-full bg-destructive" : "h-full bg-primary"}
                        style={{ width: `${Math.min(percent, 100)}%` }}
                      />
                    </div>
                    <span className="w-11 text-right text-xs tabular-nums">{percent} %</span>
                  </div>
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

/**
 * Charge de travail : tâches ouvertes, retards et reste à faire estimé de chaque collaborateur ;
 * la barre compare son reste à faire à celui du plus chargé.
 */
export function WorkloadTable({ tasks, people }: { tasks: Task[]; people: Profile[] }) {
  const { viewer } = useDashboard()
  const rows = workload(tasks, people.map((p) => p.id), todayISO())
  const names = new Map(people.map((p) => [p.id, p.full_name]))
  const max = Math.max(...rows.map((r) => r.remainingMs), 1)

  return (
    <div className="-mx-4 overflow-x-auto px-4">
      <table className="w-full min-w-[560px] text-sm">
        <caption className="sr-only">Charge de travail par collaborateur</caption>
        <thead>
          <tr className="border-b text-left text-xs text-muted-foreground">
            <th scope="col" className="py-2 pr-4 font-medium">Collaborateur</th>
            <th scope="col" className="py-2 pr-4 text-right font-medium">Tâches ouvertes</th>
            <th scope="col" className="py-2 pr-4 text-right font-medium">En retard</th>
            <th scope="col" className="py-2 pr-4 text-right font-medium">Reste à faire estimé</th>
            <th scope="col" className="w-1/4 py-2 font-medium">Charge</th>
          </tr>
        </thead>
        <tbody className="divide-y">
          {rows.map((r) => (
            <tr key={r.userId}>
              <th scope="row" className="py-2.5 pr-4 text-left">
                <Person name={names.get(r.userId)!} self={r.userId === viewer.id} />
              </th>
              <td className="py-2.5 pr-4 text-right tabular-nums">{r.open}</td>
              <td className={cn("py-2.5 pr-4 text-right tabular-nums", r.late > 0 && "font-medium text-destructive")}>{r.late}</td>
              <td className="py-2.5 pr-4 text-right tabular-nums">
                {r.remainingMs > 0 ? formatDuration(r.remainingMs) : "—"}
                {r.unestimated > 0 && (
                  <span className="block text-xs text-muted-foreground">
                    + {r.unestimated} non estimée{r.unestimated > 1 ? "s" : ""}
                  </span>
                )}
              </td>
              <td className="py-2.5">
                <div className="h-1.5 overflow-hidden rounded-full bg-muted" aria-hidden>
                  <div className="h-full bg-primary" style={{ width: `${Math.round((r.remainingMs / max) * 100)}%` }} />
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

/** Tâches dont le travail réel de l'équipe dépasse le temps estimé, les plus gros dépassements d'abord. */
export function OverrunList({ tasks }: { tasks: Task[] }) {
  const { navigate } = useDashboard()
  const rows = overrunTasks(tasks)
  const byId = new Map(tasks.map((t) => [t.id, t]))
  if (rows.length === 0)
    return <p className="text-sm text-muted-foreground">Aucune tâche ne dépasse son temps estimé.</p>
  return (
    <ul className="divide-y" aria-label="Tâches qui prennent plus de temps que prévu">
      {rows.map((r) => (
        <li key={r.taskId} className="flex flex-wrap items-center justify-between gap-2 py-2 text-sm">
          <button type="button" className="min-w-0 truncate text-left font-medium hover:underline" onClick={() => navigate({ taskId: r.taskId })}>
            {byId.get(r.taskId)?.title}
          </button>
          <span className="tabular-nums">
            <span className="text-muted-foreground">
              {formatDuration(r.actualMs)} / {formatDuration(r.estimatedMs)} estimé ·{" "}
            </span>
            <span className="font-medium text-destructive">+{formatDuration(r.overMs)}</span>
          </span>
        </li>
      ))}
    </ul>
  )
}
