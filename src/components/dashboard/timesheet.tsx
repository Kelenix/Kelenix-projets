"use client"

import { ChevronLeft, ChevronRight, Clock } from "lucide-react"
import { useEffect, useMemo, useState } from "react"
import { NativeSelect } from "@/components/native-select"
import { Button } from "@/components/ui/button"
import { initials, todayISO, type Profile, type Task } from "@/lib/domain"
import { dailyTimesheet, formatDuration, weekDays } from "@/lib/time"
import { cn } from "@/lib/utils"
import { useDashboard } from "./state"

const iso = (d: Date) => todayISO(d)
const dayLabel = (d: Date) => d.toLocaleDateString("fr-FR", { weekday: "short", day: "2-digit" })
const rangeLabel = (days: Date[]) =>
  `${days[0]!.toLocaleDateString("fr-FR", { day: "numeric", month: "short" })} – ${days[6]!.toLocaleDateString("fr-FR", { day: "numeric", month: "short", year: "numeric" })}`

/** Rafraîchit le calcul toutes les 30 s tant qu'une session est ouverte. */
function useTick(active: boolean) {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    if (!active) return
    const id = setInterval(() => setNow(Date.now()), 30_000)
    return () => clearInterval(id)
  }, [active])
  return now
}

/**
 * Feuille de temps hebdomadaire : travail de chaque personne, jour par jour, total de la semaine
 * et temps de pause. `tasks` délimite le périmètre (un projet, une tâche, ou tous les projets).
 */
export function Timesheet({
  tasks,
  profiles,
  taskFilter = false,
  className,
}: {
  tasks: Task[]
  profiles: Profile[]
  /** Affiche un filtre « toutes les tâches / une tâche ». */
  taskFilter?: boolean
  className?: string
}) {
  const { viewer } = useDashboard()
  const [offset, setOffset] = useState(0)
  const [taskId, setTaskId] = useState("")
  const days = useMemo(() => weekDays(offset), [offset])
  const scoped = taskId ? tasks.filter((t) => t.id === taskId) : tasks
  const entries = scoped.flatMap((t) => t.time_entries)
  const now = useTick(entries.some((e) => !e.ended_at))
  const rows = dailyTimesheet(entries, days, now)
  const names = new Map(profiles.map((p) => [p.id, p.full_name]))
  const today = iso(new Date())
  const dayTotals = days.map((_, i) => rows.reduce((sum, r) => sum + r.perDay[i]!, 0))
  const cell = (ms: number) => (ms === 0 ? <span className="text-muted-foreground/60">—</span> : formatDuration(ms))

  return (
    <div className={cn("space-y-3", className)}>
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex items-center gap-1">
          <Button variant="outline" size="icon-sm" aria-label="Semaine précédente" onClick={() => setOffset((o) => o - 1)}>
            <ChevronLeft />
          </Button>
          <span className="min-w-44 text-center text-sm font-medium tabular-nums" aria-live="polite">
            {rangeLabel(days)}
          </span>
          <Button variant="outline" size="icon-sm" aria-label="Semaine suivante" onClick={() => setOffset((o) => o + 1)}>
            <ChevronRight />
          </Button>
        </div>
        {offset !== 0 && (
          <Button variant="ghost" size="sm" onClick={() => setOffset(0)}>
            Cette semaine
          </Button>
        )}
        {taskFilter && tasks.length > 1 && (
          <NativeSelect aria-label="Tâche" value={taskId} onChange={(e) => setTaskId(e.target.value)} className="ml-auto w-full sm:w-72">
            <option value="">Toutes les tâches</option>
            {tasks.map((t) => (
              <option key={t.id} value={t.id}>
                {t.title}
              </option>
            ))}
          </NativeSelect>
        )}
      </div>

      {rows.length === 0 ? (
        <p className="flex items-center justify-center gap-2 rounded-xl border border-dashed bg-card/60 px-6 py-8 text-sm text-muted-foreground">
          <Clock className="size-4" aria-hidden /> Aucun temps enregistré cette semaine.
        </p>
      ) : (
        <div className="overflow-x-auto rounded-xl border bg-card">
          <table className="w-full min-w-[720px] text-sm">
            <caption className="sr-only">Temps de travail par personne et par jour, semaine du {rangeLabel(days)}</caption>
            <thead>
              <tr className="border-b text-left text-xs text-muted-foreground">
                <th scope="col" className="px-3 py-2 font-medium">Personne</th>
                {days.map((d) => (
                  <th
                    key={iso(d)}
                    scope="col"
                    className={cn("px-2 py-2 text-right font-medium capitalize", iso(d) === today && "text-primary")}
                  >
                    {dayLabel(d)}
                  </th>
                ))}
                <th scope="col" className="px-3 py-2 text-right font-medium">Travail</th>
                <th scope="col" className="px-3 py-2 text-right font-medium">Pauses</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {rows.map((row) => {
                const name = names.get(row.userId) ?? "Ancien membre"
                return (
                  <tr key={row.userId}>
                    <th scope="row" className="px-3 py-2 text-left font-medium">
                      <span className="flex items-center gap-2">
                        <span className="grid size-6 shrink-0 place-items-center rounded-full bg-accent text-[10px] font-semibold text-accent-foreground">
                          {initials(name)}
                        </span>
                        <span className="truncate">
                          {name}
                          {row.userId === viewer.id && <span className="font-normal text-muted-foreground"> (vous)</span>}
                        </span>
                      </span>
                    </th>
                    {row.perDay.map((ms, i) => (
                      <td key={i} className={cn("px-2 py-2 text-right tabular-nums", iso(days[i]!) === today && "bg-accent/40")}>
                        {cell(ms)}
                      </td>
                    ))}
                    <td className="px-3 py-2 text-right font-semibold tabular-nums">{formatDuration(row.work)}</td>
                    <td className="px-3 py-2 text-right tabular-nums text-[oklch(0.5_0.14_55)]">{cell(row.pause)}</td>
                  </tr>
                )
              })}
            </tbody>
            {rows.length > 1 && (
              <tfoot>
                <tr className="border-t bg-muted/40 text-xs font-medium">
                  <th scope="row" className="px-3 py-2 text-left">Total</th>
                  {dayTotals.map((ms, i) => (
                    <td key={i} className="px-2 py-2 text-right tabular-nums">
                      {cell(ms)}
                    </td>
                  ))}
                  <td className="px-3 py-2 text-right tabular-nums">{formatDuration(rows.reduce((s, r) => s + r.work, 0))}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{cell(rows.reduce((s, r) => s + r.pause, 0))}</td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      )}
    </div>
  )
}
