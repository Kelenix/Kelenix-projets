"use client"

import { TriangleAlert } from "lucide-react"
import { useState } from "react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { forgottenSession } from "@/lib/domain"
import { useStopTimerAt, useTasks, useTimer } from "@/lib/queries"
import { useDashboard } from "./state"
import { useTick } from "./timesheet"

const toLocalInput = (ms: number) => {
  const d = new Date(ms)
  return new Date(d.getTime() - d.getTimezoneOffset() * 60_000).toISOString().slice(0, 16)
}

/**
 * Contrôle des sessions oubliées : le chronomètre tourne côté serveur même onglet fermé ; s'il est
 * ouvert depuis plus de 10 h ou depuis la veille, on propose de le terminer à l'heure réelle d'arrêt.
 */
export function ForgottenSessionBanner() {
  const { viewer } = useDashboard()
  const { data: tasks = [] } = useTasks()
  const now = useTick(true)
  const timer = useTimer(viewer.id)
  const stopAt = useStopTimerAt()
  const entries = tasks.flatMap((t) => t.time_entries.map((e) => ({ ...e, task_id: t.id })))
  const forgotten = forgottenSession(entries, viewer.id, now)
  const [end, setEnd] = useState("")

  if (!forgotten) return null
  const task = tasks.find((t) => t.id === forgotten.entry.task_id)
  const started = Date.parse(forgotten.entry.started_at)
  // Heure de fin proposée : 18 h le jour du démarrage, sans dépasser maintenant.
  const suggested = Math.min(new Date(new Date(started).setHours(18, 0, 0, 0)).getTime(), now)
  const value = end || toLocalInput(suggested > started ? suggested : now)

  return (
    <section role="alert" aria-label="Session oubliée" className="mb-5 rounded-xl border border-warning/50 bg-warning/10 p-4">
      <p className="flex items-start gap-2 text-sm">
        <TriangleAlert className="mt-0.5 size-4 shrink-0 text-[oklch(0.5_0.14_55)] dark:text-warning" aria-hidden />
        <span>
          Votre {forgotten.entry.kind === "pause" ? "pause" : "chronomètre"} sur <strong>{task?.title ?? "une tâche"}</strong> est ouvert depuis{" "}
          {Math.floor(forgotten.hours)} h ({new Date(started).toLocaleString("fr-FR", { dateStyle: "short", timeStyle: "short" })}). Avez-vous oublié de
          l&apos;arrêter ?
        </span>
      </p>
      <form
        className="mt-3 flex flex-wrap items-end gap-2"
        onSubmit={(e) => {
          e.preventDefault()
          const at = new Date(value).getTime()
          if (!(at > started && at <= Date.now())) return void toast.error("L'heure de fin doit être entre le début de la session et maintenant.")
          stopAt.mutate(new Date(at).toISOString())
        }}
      >
        <label className="space-y-1 text-xs font-medium">
          Heure réelle de fin
          <Input type="datetime-local" value={value} onChange={(e) => setEnd(e.target.value)} className="h-9 w-56" />
        </label>
        <Button type="submit" disabled={stopAt.isPending}>
          Terminer à cette heure
        </Button>
        <Button type="button" variant="outline" disabled={timer.isPending} onClick={() => timer.mutate({ type: "stop", taskId: forgotten.entry.task_id ?? "" })}>
          Terminer maintenant
        </Button>
      </form>
    </section>
  )
}
