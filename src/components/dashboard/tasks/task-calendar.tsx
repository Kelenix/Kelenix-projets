"use client"

import { ChevronLeft, ChevronRight } from "lucide-react"
import { useMemo, useState } from "react"
import { Button } from "@/components/ui/button"
import {
  ABSENCE_LABELS,
  absencesOn,
  initials,
  isOverdue,
  monthGrid,
  todayISO,
  type AbsenceKind,
  type Profile,
  type Task,
} from "@/lib/domain"
import { useAbsences, useHolidays } from "@/lib/queries"
import { entryMs, formatDuration } from "@/lib/time"
import { cn } from "@/lib/utils"
import { STATUS_FILL } from "../charts"
import { useTick } from "../timesheet"

const WEEKDAYS = ["Lun.", "Mar.", "Mer.", "Jeu.", "Ven.", "Sam.", "Dim."]

/**
 * Calendrier du mois : tâches à échéance (couleur de statut), heures travaillées chaque jour,
 * jours fériés et absences de l'équipe. Grille sur grand écran, liste de jours sur mobile.
 */
export function TaskCalendar({ tasks, profiles, onOpen }: { tasks: Task[]; profiles: Map<string, Profile>; onOpen: (id: string) => void }) {
  const today = todayISO()
  const [cursor, setCursor] = useState(() => ({ year: new Date().getFullYear(), month: new Date().getMonth() }))
  const { data: holidays = [] } = useHolidays()
  const { data: absences = [] } = useAbsences()
  const now = useTick(tasks.some((t) => t.time_entries.some((e) => !e.ended_at)))

  const weeks = useMemo(() => monthGrid(cursor.year, cursor.month), [cursor])
  const days = useMemo(() => {
    const byDue = Map.groupBy(tasks.filter((t) => t.due_date), (t) => t.due_date!)
    const entries = tasks.flatMap((t) => t.time_entries).filter((e) => e.kind !== "pause")
    return new Map(
      weeks.flat().map(({ day }) => {
        const [y, m, d] = day.split("-").map(Number)
        const from = new Date(y!, m! - 1, d!).getTime()
        const worked = entries.reduce((s, e) => s + entryMs(e, now, from, from + 86_400_000), 0)
        return [day, { tasks: byDue.get(day) ?? [], worked, holiday: holidays.find((h) => h.day === day), absent: absencesOn(absences, day) }]
      })
    )
  }, [weeks, tasks, holidays, absences, now])

  const title = new Date(cursor.year, cursor.month, 1).toLocaleDateString("fr-FR", { month: "long", year: "numeric" })
  const move = (n: number) => setCursor(({ year, month }) => ({ year: month + n < 0 ? year - 1 : month + n > 11 ? year + 1 : year, month: (month + n + 12) % 12 }))
  const name = (id: string) => profiles.get(id)?.full_name ?? "Ancien membre"

  const dayContent = (day: string, compact: boolean) => {
    const info = days.get(day)!
    return (
      <>
        {info.holiday && <p className="truncate text-[11px] font-medium text-[oklch(0.5_0.14_55)] dark:text-warning">{info.holiday.name}</p>}
        {info.absent.length > 0 && (
          <p className="flex flex-wrap gap-1 text-[11px] text-muted-foreground">
            {info.absent.map((a) => (
              <span key={a.id} title={`${name(a.user_id)} : ${ABSENCE_LABELS[a.kind as AbsenceKind]}`} className="rounded bg-muted px-1">
                {compact ? initials(name(a.user_id)) : `${name(a.user_id)} — ${ABSENCE_LABELS[a.kind as AbsenceKind]}`}
              </span>
            ))}
          </p>
        )}
        <ul className="space-y-0.5">
          {info.tasks.map((t) => (
            <li key={t.id}>
              <button
                type="button"
                onClick={() => onOpen(t.id)}
                className={cn(
                  "flex w-full items-center gap-1 rounded px-1 py-0.5 text-left text-[11px] hover:bg-muted",
                  t.status === "done" && "text-muted-foreground line-through",
                  isOverdue(t) && "font-medium text-destructive"
                )}
              >
                <span aria-hidden className={cn("size-1.5 shrink-0 rounded-full", STATUS_FILL[t.status])} />
                <span className="truncate">{t.title}</span>
              </button>
            </li>
          ))}
        </ul>
        {info.worked > 0 && <p className="text-[11px] text-muted-foreground tabular-nums">{formatDuration(info.worked)} travaillées</p>}
      </>
    )
  }

  return (
    <section aria-label="Calendrier des tâches" className="space-y-3">
      <div className="flex items-center gap-2">
        <Button variant="outline" size="icon-sm" aria-label="Mois précédent" onClick={() => move(-1)}>
          <ChevronLeft />
        </Button>
        <h3 className="min-w-40 text-center text-sm font-semibold capitalize" aria-live="polite">
          {title}
        </h3>
        <Button variant="outline" size="icon-sm" aria-label="Mois suivant" onClick={() => move(1)}>
          <ChevronRight />
        </Button>
        <Button variant="ghost" size="sm" onClick={() => setCursor({ year: new Date().getFullYear(), month: new Date().getMonth() })}>
          Aujourd&apos;hui
        </Button>
      </div>

      {/* Grand écran : grille du mois */}
      <div className="hidden overflow-hidden rounded-xl border bg-card md:block">
        <div className="grid grid-cols-7 border-b bg-muted/40 text-xs font-medium text-muted-foreground">
          {WEEKDAYS.map((d) => (
            <div key={d} className="px-2 py-1.5">
              {d}
            </div>
          ))}
        </div>
        {weeks.map((week) => (
          <div key={week[0]!.day} className="grid grid-cols-7 border-b last:border-b-0">
            {week.map(({ day, inMonth }) => (
              <div
                key={day}
                className={cn(
                  "min-h-28 space-y-1 border-r p-1.5 last:border-r-0",
                  !inMonth && "bg-muted/30 text-muted-foreground",
                  days.get(day)!.holiday && "bg-warning/5"
                )}
              >
                <p className={cn("text-xs tabular-nums", day === today && "inline-grid size-5 place-items-center rounded-full bg-primary font-semibold text-primary-foreground")}>
                  {Number(day.slice(8))}
                </p>
                {dayContent(day, true)}
              </div>
            ))}
          </div>
        ))}
      </div>

      {/* Mobile : liste des jours qui ont quelque chose */}
      {!weeks.flat().some(({ day, inMonth }) => {
        const info = days.get(day)!
        return inMonth && (info.tasks.length || info.worked || info.holiday || info.absent.length)
      }) && <p className="rounded-lg border border-dashed px-4 py-6 text-center text-sm text-muted-foreground md:hidden">Rien ce mois-ci.</p>}
      <ol className="space-y-2 md:hidden" aria-label="Jours du mois">
        {weeks
          .flat()
          .filter(({ day, inMonth }) => {
            const info = days.get(day)!
            return inMonth && (info.tasks.length || info.worked || info.holiday || info.absent.length)
          })
          .map(({ day }) => (
            <li key={day} className={cn("space-y-1 rounded-lg border bg-card p-3", day === today && "border-primary")}>
              <p className="text-xs font-semibold capitalize">
                {new Date(`${day}T12:00:00`).toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long" })}
              </p>
              {dayContent(day, false)}
            </li>
          ))}
      </ol>
    </section>
  )
}
