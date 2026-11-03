"use client"

import { Coffee, Pause, Play, Square } from "lucide-react"
import { useEffect, useState } from "react"
import { Button } from "@/components/ui/button"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { initials, type Profile, type Task } from "@/lib/domain"
import { useTimer, type TimerAction } from "@/lib/queries"
import { formatDuration, timeByUser } from "@/lib/time"
import { cn } from "@/lib/utils"
import { useDashboard } from "../state"

// Empêche le glisser-déposer de la carte de démarrer depuis ces contrôles.
const isolate = {
  onPointerDown: (e: React.PointerEvent) => e.stopPropagation(),
  onKeyDown: (e: React.KeyboardEvent) => e.stopPropagation(),
}

/** Heure courante, rafraîchie chaque seconde tant qu'une session (travail ou pause) est ouverte. */
function useNow(active: boolean) {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    if (!active) return
    const id = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(id)
  }, [active])
  return now
}

/**
 * Intervenants d'une tâche avec leur temps de travail (et leur pause en cours), et les commandes
 * de l'utilisateur connecté : Démarrer, Pause, Reprendre, Terminer.
 */
export function TaskTime({ task, profiles, className }: { task: Task; profiles: Map<string, Profile>; className?: string }) {
  const { viewer } = useDashboard()
  const timer = useTimer(viewer.id)
  const open = task.time_entries.some((e) => !e.ended_at)
  const now = useNow(open)
  const rows = timeByUser(task.time_entries, now)
  const mine = task.time_entries.find((e) => e.user_id === viewer.id && !e.ended_at)
  const state = !mine ? "idle" : mine.kind === "pause" ? "paused" : "running"

  const act = (type: TimerAction["type"]) => timer.mutate({ type, taskId: task.id })
  const control = (type: TimerAction["type"], label: string, icon: React.ReactNode, title: string, accent?: string) => (
    <Button
      type="button"
      variant={type === "start" ? "ghost" : "secondary"}
      size="icon-sm"
      disabled={timer.isPending}
      onClick={() => act(type)}
      aria-label={`${label} « ${task.title} »`}
      title={title}
      className={cn("shrink-0", accent)}
    >
      {icon}
    </Button>
  )

  return (
    <div {...isolate} className={cn("relative z-10 flex items-center gap-1.5", className)}>
      <ul aria-label="Temps passé par intervenant" className="flex min-w-0 flex-1 flex-wrap gap-1.5">
        {rows.map((row) => {
          const name = profiles.get(row.userId)?.full_name ?? "Ancien membre"
          const work = formatDuration(row.ms, row.running)
          return (
            <li key={row.userId}>
              <Tooltip>
                <TooltipTrigger asChild>
                  <span
                    tabIndex={0}
                    className={cn(
                      "inline-flex items-center gap-1 rounded-full border py-0.5 pr-2 pl-0.5 text-xs tabular-nums outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
                      row.running
                        ? "border-success/40 bg-success/10 font-medium"
                        : row.paused
                          ? "border-warning/50 bg-warning/10 font-medium"
                          : "bg-muted/60 text-muted-foreground"
                    )}
                  >
                    <span className="grid size-5 place-items-center rounded-full bg-card text-[9px] font-semibold text-foreground">
                      {initials(name)}
                    </span>
                    {row.running && <span aria-hidden className="size-1.5 animate-pulse rounded-full bg-success" />}
                    {work}
                    {row.paused && (
                      <span className="inline-flex items-center gap-0.5 text-[oklch(0.5_0.14_55)]">
                        <Coffee className="size-3" aria-hidden />
                        <span className="sr-only">en pause depuis</span>
                        {formatDuration(row.currentPauseMs, true)}
                      </span>
                    )}
                  </span>
                </TooltipTrigger>
                <TooltipContent>
                  {name} : {work} de travail
                  {row.pauseMs > 0 && ` · ${formatDuration(row.pauseMs)} de pause`}
                  {row.running ? " (en cours)" : row.paused ? " (en pause)" : ""}
                </TooltipContent>
              </Tooltip>
            </li>
          )
        })}
      </ul>
      {state === "idle" && control("start", "Démarrer le chrono sur", <Play />, "Démarrer le chrono")}
      {state === "running" && control("pause", "Mettre en pause", <Pause />, "Pause (temps de pause compté à part)", "text-[oklch(0.42_0.11_155)]")}
      {state === "paused" && control("resume", "Reprendre", <Play />, "Reprendre le travail", "text-[oklch(0.5_0.14_55)]")}
      {state !== "idle" && control("stop", "Terminer la session sur", <Square />, "Terminer la session")}
    </div>
  )
}
