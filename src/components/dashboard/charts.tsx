"use client"

import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { TASK_STATUS_LABELS, TASK_STATUSES, type TaskStatus } from "@/lib/domain"
import type { WeekBucket } from "@/lib/stats"
import { cn } from "@/lib/utils"

export const STATUS_FILL: Record<TaskStatus, string> = {
  todo: "bg-series-todo",
  in_progress: "bg-series-progress",
  rescheduled: "bg-series-rescheduled",
  done: "bg-series-done",
}

const plural = (n: number, word: string) => `${n} ${word}${n > 1 ? "s" : ""}`
const percent = (part: number, total: number) => (total === 0 ? 0 : Math.round((part / total) * 100))

/** Barre empilée par statut (survol / focus : détail de chaque segment). */
export function StatusBar({
  counts,
  label,
  className,
}: {
  counts: Record<TaskStatus, number>
  label: string
  className?: string
}) {
  const total = TASK_STATUSES.reduce((sum, s) => sum + counts[s], 0)
  if (total === 0) return <div className={cn("h-2.5 rounded-full bg-muted", className)} aria-label={`${label} : aucune tâche`} />
  return (
    <div role="group" aria-label={label} className={cn("flex h-2.5 gap-0.5", className)}>
      {TASK_STATUSES.filter((s) => counts[s] > 0).map((status) => (
        <Tooltip key={status}>
          <TooltipTrigger asChild>
            <button
              type="button"
              aria-label={`${TASK_STATUS_LABELS[status]} : ${counts[status]} (${percent(counts[status], total)} %)`}
              style={{ flexGrow: counts[status] }}
              className={cn(
                "min-w-1.5 basis-0 first:rounded-l-full last:rounded-r-full transition-opacity hover:opacity-80 focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none",
                STATUS_FILL[status]
              )}
            />
          </TooltipTrigger>
          <TooltipContent>
            {TASK_STATUS_LABELS[status]} : {plural(counts[status], "tâche")} · {percent(counts[status], total)} %
          </TooltipContent>
        </Tooltip>
      ))}
    </div>
  )
}

export function StatusLegend({ counts }: { counts: Record<TaskStatus, number> }) {
  const total = TASK_STATUSES.reduce((sum, s) => sum + counts[s], 0)
  return (
    <ul className="flex flex-wrap gap-x-5 gap-y-2 text-sm">
      {TASK_STATUSES.map((status) => (
        <li key={status} className="flex items-center gap-2">
          <span aria-hidden className={cn("size-2.5 rounded-sm", STATUS_FILL[status])} />
          <span className="text-muted-foreground">{TASK_STATUS_LABELS[status]}</span>
          <span className="font-medium tabular-nums">{counts[status]}</span>
          <span className="text-xs text-muted-foreground tabular-nums">{percent(counts[status], total)} %</span>
        </li>
      ))}
    </ul>
  )
}

const weekLabel = (date: Date) => date.toLocaleDateString("fr-FR", { day: "numeric", month: "short" })

/** Histogramme des tâches terminées par semaine (une seule série : le titre la nomme). */
export function WeeklyBars({ weeks }: { weeks: WeekBucket[] }) {
  const max = Math.max(1, ...weeks.map((w) => w.count))
  const labelEvery = weeks.length > 8 ? 2 : 1

  return (
    <div className="flex gap-2">
      <div className="flex h-44 flex-col justify-between pb-6 text-right text-xs text-muted-foreground tabular-nums" aria-hidden>
        <span>{max}</span>
        <span>0</span>
      </div>
      <div className="relative flex-1">
        <div aria-hidden className="absolute inset-x-0 top-2 border-t border-dashed" />
        <div aria-hidden className="absolute inset-x-0 bottom-6 border-t" />
        <ol className="relative flex h-44 items-end gap-1.5" aria-label="Tâches terminées par semaine">
          {weeks.map((week, index) => {
            const label = `Semaine du ${weekLabel(week.start)} : ${week.count} ${week.count > 1 ? "tâches terminées" : "tâche terminée"}`
            return (
              <li key={week.start.toISOString()} className="flex h-full flex-1 flex-col items-center justify-end">
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button
                      type="button"
                      aria-label={label}
                      className="group flex h-[calc(100%-1.5rem)] w-full max-w-10 items-end justify-center focus-visible:outline-none"
                    >
                      <span
                        className={cn(
                          "w-full rounded-t-[4px] bg-primary transition-[height,opacity] duration-300 group-hover:opacity-80 group-focus-visible:ring-3 group-focus-visible:ring-ring/50",
                          week.count === 0 && "bg-muted"
                        )}
                        style={{ height: week.count === 0 ? 2 : `calc(${(week.count / max) * 100}% - 0.5rem)` }}
                      />
                    </button>
                  </TooltipTrigger>
                  <TooltipContent>{label}</TooltipContent>
                </Tooltip>
                <span className="mt-1 h-5 text-[11px] whitespace-nowrap text-muted-foreground" aria-hidden>
                  {index % labelEvery === (weeks.length - 1) % labelEvery ? weekLabel(week.start) : ""}
                </span>
              </li>
            )
          })}
        </ol>
      </div>
    </div>
  )
}
