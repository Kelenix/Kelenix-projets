"use client"

import { Pause, Play } from "lucide-react"
import { useEffect, useState } from "react"
import { Button } from "@/components/ui/button"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { initials, type Profile, type Task } from "@/lib/domain"
import { useTimer } from "@/lib/queries"
import { formatDuration, timeByUser } from "@/lib/time"
import { cn } from "@/lib/utils"
import { useDashboard } from "../state"

// Empêche le glisser-déposer de la carte de démarrer depuis ces contrôles.
const isolate = {
  onPointerDown: (e: React.PointerEvent) => e.stopPropagation(),
  onKeyDown: (e: React.KeyboardEvent) => e.stopPropagation(),
}

/** Heure courante, rafraîchie chaque seconde tant qu'un chronomètre tourne. */
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
 * Intervenants d'une tâche avec leur temps passé, et bouton Démarrer / Pause de l'utilisateur
 * connecté. Plusieurs personnes peuvent chronométrer la même tâche.
 */
export function TaskTime({ task, profiles, className }: { task: Task; profiles: Map<string, Profile>; className?: string }) {
  const { viewer } = useDashboard()
  const timer = useTimer(viewer.id)
  const running = task.time_entries.some((e) => !e.ended_at)
  const now = useNow(running)
  const rows = timeByUser(task.time_entries, now)
  const mine = task.time_entries.some((e) => e.user_id === viewer.id && !e.ended_at)

  return (
    <div {...isolate} className={cn("relative z-10 flex items-center gap-1.5", className)}>
      <ul aria-label="Temps passé par intervenant" className="flex min-w-0 flex-1 flex-wrap gap-1.5">
        {rows.map((row) => {
          const name = profiles.get(row.userId)?.full_name ?? "Ancien membre"
          const duration = formatDuration(row.ms, row.running)
          return (
            <li key={row.userId}>
              <Tooltip>
                <TooltipTrigger asChild>
                  <span
                    tabIndex={0}
                    className={cn(
                      "inline-flex items-center gap-1 rounded-full border py-0.5 pr-2 pl-0.5 text-xs tabular-nums outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
                      row.running ? "border-success/40 bg-success/10 font-medium" : "bg-muted/60 text-muted-foreground"
                    )}
                  >
                    <span className="grid size-5 place-items-center rounded-full bg-card text-[9px] font-semibold text-foreground">
                      {initials(name)}
                    </span>
                    {row.running && <span aria-hidden className="size-1.5 animate-pulse rounded-full bg-success" />}
                    {duration}
                  </span>
                </TooltipTrigger>
                <TooltipContent>
                  {name} : {duration}
                  {row.running ? " (en cours)" : ""}
                </TooltipContent>
              </Tooltip>
            </li>
          )
        })}
      </ul>
      <Button
        type="button"
        variant={mine ? "secondary" : "ghost"}
        size="icon-sm"
        disabled={timer.isPending}
        onClick={() => timer.mutate(mine ? null : task.id)}
        aria-label={mine ? `Mettre en pause « ${task.title} »` : `Démarrer le chrono sur « ${task.title} »`}
        title={mine ? "Mettre en pause" : "Démarrer le chrono"}
        className={cn("shrink-0", mine && "text-[oklch(0.42_0.11_155)]")}
      >
        {mine ? <Pause /> : <Play />}
      </Button>
    </div>
  )
}
