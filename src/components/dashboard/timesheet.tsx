"use client"

import { ChevronLeft, ChevronRight, Clock, TriangleAlert } from "lucide-react"
import { useEffect, useMemo, useState } from "react"
import { NativeSelect } from "@/components/native-select"
import { Button } from "@/components/ui/button"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { initials, type Profile, type Task } from "@/lib/domain"
import { formatDuration, periodBuckets, timesheet, type Period } from "@/lib/time"
import { cn } from "@/lib/utils"
import { useDashboard } from "./state"

const PERIODS: { value: Period; label: string }[] = [
  { value: "day", label: "Jour" },
  { value: "week", label: "Semaine" },
  { value: "month", label: "Mois" },
  { value: "year", label: "Année" },
]
const PERIOD_NOUN: Record<Period, string> = { day: "ce jour", week: "cette semaine", month: "ce mois", year: "cette année" }
const CURRENT: Record<Period, string> = { day: "Aujourd'hui", week: "Cette semaine", month: "Ce mois", year: "Cette année" }

/** Rafraîchit le calcul toutes les 30 s tant qu'une session est ouverte. */
export function useTick(active: boolean) {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    if (!active) return
    const id = setInterval(() => setNow(Date.now()), 30_000)
    return () => clearInterval(id)
  }, [active])
  return now
}

/**
 * Feuille de temps : travail de chaque personne par jour (vue jour ou semaine), par semaine
 * (vue mois) ou par mois (vue année), avec totaux et temps de pause. `tasks` délimite le
 * périmètre (une tâche, un projet ou tous les projets).
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
  const [period, setPeriod] = useState<Period>("week")
  const [offset, setOffset] = useState(0)
  const [taskId, setTaskId] = useState("")
  // Contenu des colonnes de la période : temps de travail actif ou temps de pause.
  const [show, setShow] = useState<"work" | "pause">("work")
  const { title, buckets } = useMemo(() => periodBuckets(period, offset), [period, offset])
  const scoped = taskId ? tasks.filter((t) => t.id === taskId) : tasks
  const entries = scoped.flatMap((t) => t.time_entries)
  const now = useTick(entries.some((e) => !e.ended_at))
  const rows = timesheet(entries, buckets, now)
  const names = new Map(profiles.map((p) => [p.id, p.full_name]))
  const current = buckets.findIndex((b) => now >= b.start.getTime() && now < b.end.getTime())
  const perBucket = (r: (typeof rows)[number]) => (show === "work" ? r.perBucket : r.pausePerBucket)
  const bucketTotals = buckets.map((_, i) => rows.reduce((sum, r) => sum + perBucket(r)[i]!, 0))
  const pauseCount = rows.reduce((s, r) => s + r.pauseCount, 0)
  const longPauses = rows.reduce((s, r) => s + r.longPauses, 0)
  const countCell = (count: number, long: number) => (
    <span className="inline-flex items-center justify-end gap-1">
      {count === 0 ? <span className="text-muted-foreground/60">—</span> : count}
      {long > 0 && (
        <span className="inline-flex items-center gap-0.5 text-xs font-medium text-destructive" title="Pauses anormalement longues">
          <TriangleAlert className="size-3" aria-hidden />
          {long} longue{long > 1 ? "s" : ""}
        </span>
      )}
    </span>
  )
  const cell = (ms: number) => (ms === 0 ? <span className="text-muted-foreground/60">—</span> : formatDuration(ms))

  return (
    <div className={cn("space-y-3", className)}>
      <div className="flex flex-wrap items-center gap-2">
        <Tabs
          value={period}
          onValueChange={(v) => {
            setPeriod(v as Period)
            setOffset(0)
          }}
        >
          <TabsList aria-label="Période">
            {PERIODS.map((p) => (
              <TabsTrigger key={p.value} value={p.value}>
                {p.label}
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>
        <div className="flex items-center gap-1">
          <Button variant="outline" size="icon-sm" aria-label="Période précédente" onClick={() => setOffset((o) => o - 1)}>
            <ChevronLeft />
          </Button>
          <span className="min-w-44 text-center text-sm font-medium capitalize tabular-nums" aria-live="polite">
            {title}
          </span>
          <Button variant="outline" size="icon-sm" aria-label="Période suivante" onClick={() => setOffset((o) => o + 1)}>
            <ChevronRight />
          </Button>
        </div>
        {buckets.length > 1 && (
          <Tabs value={show} onValueChange={(v) => setShow(v as "work" | "pause")}>
            <TabsList aria-label="Afficher par période">
              <TabsTrigger value="work">Travail</TabsTrigger>
              <TabsTrigger value="pause">Pauses</TabsTrigger>
            </TabsList>
          </Tabs>
        )}
        {offset !== 0 && (
          <Button variant="ghost" size="sm" onClick={() => setOffset(0)}>
            {CURRENT[period]}
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
          <Clock className="size-4" aria-hidden /> Aucun temps enregistré {PERIOD_NOUN[period]}.
        </p>
      ) : (
        <div className="overflow-x-auto rounded-xl border bg-card">
          <table className={cn("w-full text-sm whitespace-nowrap", buckets.length > 3 && "min-w-[720px]")}>
            <caption className="sr-only">
              {show === "work" ? "Temps de travail" : "Temps de pause"} par personne — {title}
            </caption>
            <thead>
              <tr className="border-b text-left text-xs text-muted-foreground">
                <th scope="col" className="px-3 py-2 font-medium">Personne</th>
                {buckets.length > 1 &&
                  buckets.map((b, i) => (
                    <th
                      key={b.start.toISOString()}
                      scope="col"
                      className={cn("px-2 py-2 text-right font-medium capitalize", i === current && "text-primary")}
                    >
                      {b.label}
                    </th>
                  ))}
                <th scope="col" className="px-3 py-2 text-right font-medium">Travail</th>
                <th scope="col" className="px-3 py-2 text-right font-medium">Pauses</th>
                <th scope="col" className="px-3 py-2 text-right font-medium">Nb de pauses</th>
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
                    {buckets.length > 1 &&
                      perBucket(row).map((ms, i) => (
                        <td key={i} className={cn("px-2 py-2 text-right tabular-nums", i === current && "bg-accent/40")}>
                          {cell(ms)}
                        </td>
                      ))}
                    <td className="px-3 py-2 text-right font-semibold tabular-nums">{formatDuration(row.work)}</td>
                    <td className="px-3 py-2 text-right tabular-nums text-[oklch(0.5_0.14_55)]">{cell(row.pause)}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{countCell(row.pauseCount, row.longPauses)}</td>
                  </tr>
                )
              })}
            </tbody>
            {rows.length > 1 && (
              <tfoot>
                <tr className="border-t bg-muted/40 text-xs font-medium">
                  <th scope="row" className="px-3 py-2 text-left">Total</th>
                  {buckets.length > 1 &&
                    bucketTotals.map((ms, i) => (
                      <td key={i} className="px-2 py-2 text-right tabular-nums">
                        {cell(ms)}
                      </td>
                    ))}
                  <td className="px-3 py-2 text-right tabular-nums">{formatDuration(rows.reduce((s, r) => s + r.work, 0))}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{cell(rows.reduce((s, r) => s + r.pause, 0))}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{countCell(pauseCount, longPauses)}</td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      )}
    </div>
  )
}
