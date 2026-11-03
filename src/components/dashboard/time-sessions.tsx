"use client"

import { Coffee, History, Loader2, Pencil, Plus, TriangleAlert } from "lucide-react"
import { useMemo, useState } from "react"
import { Field } from "@/components/field"
import { NativeSelect } from "@/components/native-select"
import { ShowMore } from "@/components/show-more"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Textarea } from "@/components/ui/textarea"
import {
  initials,
  isLongPause,
  PAUSE_REASONS,
  pauseReasonOf,
  todayISO,
  type PauseReason,
  type Profile,
  type Task,
  type TimeEntry,
} from "@/lib/domain"
import { useEditTimeEntry, useLogTime, useSetPauseReason, useSetTimeDescription, useTimeChanges } from "@/lib/queries"
import { editSessionSchema, fieldErrors, manualTimeSchema } from "@/lib/schemas"
import { formatDuration, totals } from "@/lib/time"
import { cn } from "@/lib/utils"
import { useDashboard } from "./state"
import { Timesheet, useTick } from "./timesheet"

type Session = TimeEntry & { task: Task }

const hm = (iso: string) => new Date(iso).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })
const dateLabel = (iso: string) =>
  new Date(iso).toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long", year: "numeric" })
/** ISO → valeur d'un champ datetime-local (heure locale). */
const toLocalInput = (iso: string) => {
  const d = new Date(iso)
  return new Date(d.getTime() - d.getTimezoneOffset() * 60_000).toISOString().slice(0, 16)
}

function useCanEdit() {
  const { viewer, isOwner } = useDashboard()
  return (e: TimeEntry) => e.user_id === viewer.id || isOwner
}

/** Temps passé d'un projet : feuille de temps, totaux par tâche, historique, ajout d'heures oubliées. */
export function ProjectTime({ projectId, tasks, profiles }: { projectId: string; tasks: Task[]; profiles: Profile[] }) {
  const { navigate } = useDashboard()
  const [adding, setAdding] = useState(false)
  const now = useTick(tasks.some((t) => t.time_entries.some((e) => !e.ended_at)))
  const total = totals(tasks.flatMap((t) => t.time_entries), now)

  return (
    <section aria-labelledby="project-time" className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 id="project-time" className="text-base font-semibold">
          Temps passé{" "}
          <span className="font-normal text-muted-foreground">
            · {formatDuration(total.work)} au total{total.pause > 0 && ` · ${formatDuration(total.pause)} de pause`}
          </span>
        </h2>
        {tasks.length > 0 && (
          <Button variant="secondary" size="sm" onClick={() => setAdding(true)}>
            <Plus aria-hidden /> Ajouter du temps oublié
          </Button>
        )}
      </div>
      <Tabs defaultValue="sheet">
        <TabsList aria-label="Vue du temps passé">
          <TabsTrigger value="sheet">Feuille de temps</TabsTrigger>
          <TabsTrigger value="tasks">Par tâche</TabsTrigger>
          <TabsTrigger value="history">Historique des sessions</TabsTrigger>
        </TabsList>
        <TabsContent value="sheet" className="pt-3">
          <Timesheet tasks={tasks} profiles={profiles} taskFilter />
        </TabsContent>
        <TabsContent value="tasks" className="pt-3">
          <TimeByTask tasks={tasks} onOpen={(taskId) => navigate({ taskId })} now={now} />
        </TabsContent>
        <TabsContent value="history" className="pt-3">
          <SessionHistory tasks={tasks} profiles={profiles} scope={{ projectId }} showTask />
        </TabsContent>
      </Tabs>
      {adding && <AddTimeDialog tasks={tasks} onClose={() => setAdding(false)} />}
    </section>
  )
}

/** Temps passé d'une tâche (panneau de détail) : total, feuille de temps, historique, ajout. */
export function TaskTimeDetails({ task, profiles }: { task: Task; profiles: Profile[] }) {
  const [adding, setAdding] = useState(false)
  const now = useTick(task.time_entries.some((e) => !e.ended_at))
  const total = totals(task.time_entries, now)
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
        <p>
          <span className="font-semibold tabular-nums">{formatDuration(total.work)}</span> de travail au total
          {total.pause > 0 && <span className="text-muted-foreground"> · {formatDuration(total.pause)} de pause</span>}
        </p>
        <Button variant="secondary" size="sm" onClick={() => setAdding(true)}>
          <Plus aria-hidden /> Ajouter du temps oublié
        </Button>
      </div>
      <Timesheet tasks={[task]} profiles={profiles} />
      <SessionHistory tasks={[task]} profiles={profiles} scope={{ taskId: task.id }} />
      {adding && <AddTimeDialog tasks={[task]} onClose={() => setAdding(false)} />}
    </div>
  )
}

function TimeByTask({ tasks, onOpen, now }: { tasks: Task[]; onOpen: (taskId: string) => void; now: number }) {
  const rows = tasks
    .map((t) => ({ task: t, ...totals(t.time_entries, now), people: new Set(t.time_entries.map((e) => e.user_id)).size }))
    .filter((r) => r.work > 0 || r.pause > 0)
    .sort((a, b) => b.work - a.work)
  if (rows.length === 0)
    return <p className="rounded-xl border border-dashed bg-card/60 px-6 py-8 text-center text-sm text-muted-foreground">Aucun temps enregistré sur ce projet.</p>
  return (
    <div className="overflow-x-auto rounded-xl border bg-card">
      <table className="w-full min-w-[520px] text-sm">
        <caption className="sr-only">Temps total par tâche</caption>
        <thead>
          <tr className="border-b text-left text-xs text-muted-foreground">
            <th scope="col" className="px-3 py-2 font-medium">Tâche</th>
            <th scope="col" className="px-3 py-2 text-right font-medium">Intervenants</th>
            <th scope="col" className="px-3 py-2 text-right font-medium">Travail</th>
            <th scope="col" className="px-3 py-2 text-right font-medium">Pauses</th>
          </tr>
        </thead>
        <tbody className="divide-y">
          {rows.map((r) => (
            <tr key={r.task.id}>
              <th scope="row" className="px-3 py-2 text-left font-medium">
                <button type="button" onClick={() => onOpen(r.task.id)} className="text-left hover:text-primary hover:underline">
                  {r.task.title}
                </button>
              </th>
              <td className="px-3 py-2 text-right tabular-nums">{r.people}</td>
              <td className="px-3 py-2 text-right font-semibold tabular-nums">{formatDuration(r.work)}</td>
              <td className="px-3 py-2 text-right tabular-nums text-[oklch(0.5_0.14_55)]">{r.pause > 0 ? formatDuration(r.pause) : "—"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

/** Historique des sessions (travail et pauses), du plus récent au plus ancien, groupé par jour. */
function SessionHistory({
  tasks,
  profiles,
  scope,
  showTask = false,
}: {
  tasks: Task[]
  profiles: Profile[]
  scope: { projectId?: string; taskId?: string }
  showTask?: boolean
}) {
  const canEdit = useCanEdit()
  const [editing, setEditing] = useState<Session | null>(null)
  const { data: changes = [] } = useTimeChanges(scope)
  const names = useMemo(() => new Map(profiles.map((p) => [p.id, p.full_name])), [profiles])
  const changesByEntry = useMemo(() => Map.groupBy(changes, (c) => c.entry_id), [changes])
  const sessions = useMemo(
    () =>
      tasks
        .flatMap((task) => task.time_entries.map((e) => ({ ...e, task })))
        .sort((a, b) => b.started_at.localeCompare(a.started_at)),
    [tasks]
  )
  const now = useTick(sessions.some((s) => !s.ended_at))
  const [filter, setFilter] = useState<"all" | "work" | "pause" | "long">("all")
  const shown = sessions.filter((s) =>
    filter === "all" ? true : filter === "work" ? s.kind !== "pause" : filter === "pause" ? s.kind === "pause" : isLongPause(s, now)
  )

  if (sessions.length === 0)
    return <p className="rounded-xl border border-dashed bg-card/60 px-6 py-8 text-center text-sm text-muted-foreground">Aucune session enregistrée.</p>

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="flex items-center gap-2 text-sm font-semibold">
          <History className="size-4 text-muted-foreground" aria-hidden /> Historique des sessions
        </h3>
        <Tabs value={filter} onValueChange={(v) => setFilter(v as typeof filter)}>
          <TabsList aria-label="Filtrer l'historique">
            <TabsTrigger value="all">Tout</TabsTrigger>
            <TabsTrigger value="work">Travail</TabsTrigger>
            <TabsTrigger value="pause">Pauses</TabsTrigger>
            <TabsTrigger value="long">Pauses longues</TabsTrigger>
          </TabsList>
        </Tabs>
      </div>
      {shown.length === 0 && (
        <p className="rounded-xl border border-dashed bg-card/60 px-6 py-6 text-center text-sm text-muted-foreground">Aucune session pour ce filtre.</p>
      )}
      <ShowMore key={filter} items={shown} pageSize={30}>
        {(visible) => (
          <ol className="divide-y rounded-xl border bg-card">
            {visible.map((s, i) => {
              const name = names.get(s.user_id) ?? "Ancien membre"
              const newDay = i === 0 || todayISO(new Date(visible[i - 1]!.started_at)) !== todayISO(new Date(s.started_at))
              const duration = (s.ended_at ? Date.parse(s.ended_at) : now) - Date.parse(s.started_at)
              const log = s.id ? (changesByEntry.get(s.id) ?? []) : []
              return (
                <li key={s.id ?? `${s.user_id}-${s.started_at}`} className="px-3 py-2.5">
                  {newDay && <p className="mb-2 text-xs font-medium capitalize text-muted-foreground">{dateLabel(s.started_at)}</p>}
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
                    <span className="grid size-6 shrink-0 place-items-center rounded-full bg-accent text-[10px] font-semibold text-accent-foreground" title={name}>
                      {initials(name)}
                    </span>
                    <span className="font-medium">{name}</span>
                    <span className="tabular-nums text-muted-foreground">
                      {hm(s.started_at)} → {s.ended_at ? hm(s.ended_at) : "en cours"}
                    </span>
                    <span className="font-semibold tabular-nums">{formatDuration(duration)}</span>
                    {s.kind === "pause" && <PauseBadges session={s} editable={canEdit(s)} now={now} />}
                    {s.source === "manual" && <Badge variant="outline">Ajout manuel</Badge>}
                    {s.edited_at && <Badge variant="outline">Modifiée</Badge>}
                    {showTask && <span className="truncate text-xs text-muted-foreground">· {s.task.title}</span>}
                    {canEdit(s) && s.ended_at && s.kind !== "pause" && s.id && (
                      <Button variant="ghost" size="icon-xs" className="ml-auto" aria-label="Modifier la session" onClick={() => setEditing(s)}>
                        <Pencil />
                      </Button>
                    )}
                  </div>
                  {s.kind !== "pause" && s.id && <SessionDescription entry={s as Session & { id: string }} editable={canEdit(s)} />}
                  {log.length > 0 && (
                    <ul className="mt-1.5 space-y-1 border-l-2 pl-3 text-xs text-muted-foreground">
                      {log.map((c) => (
                        <li key={c.id}>
                          Modifiée le {new Date(c.changed_at).toLocaleString("fr-FR", { dateStyle: "short", timeStyle: "short" })} par{" "}
                          {(c.changed_by && names.get(c.changed_by)) ?? "un ancien membre"} : {hm(c.old_started_at)}–{hm(c.old_ended_at)} →{" "}
                          {hm(c.new_started_at)}–{hm(c.new_ended_at)} — « {c.reason} »
                        </li>
                      ))}
                    </ul>
                  )}
                </li>
              )
            })}
          </ol>
        )}
      </ShowMore>
      {editing && <EditSessionDialog session={editing} onClose={() => setEditing(null)} />}
    </div>
  )
}

function SessionDescription({ entry, editable }: { entry: Session & { id: string }; editable: boolean }) {
  const save = useSetTimeDescription()
  const [editing, setEditing] = useState(false)
  const [value, setValue] = useState(entry.description ?? "")

  if (editing)
    return (
      <form
        className="mt-2 space-y-2"
        onSubmit={(e) => {
          e.preventDefault()
          save.mutate({ id: entry.id, description: value.slice(0, 1000) }, { onSuccess: () => setEditing(false) })
        }}
      >
        <Textarea
          aria-label="Description du travail réalisé"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          rows={2}
          maxLength={1000}
          autoFocus
          placeholder="Qu'avez-vous fait pendant cette session ?"
        />
        <div className="flex gap-2">
          <Button type="submit" size="sm" disabled={save.isPending}>
            Enregistrer
          </Button>
          <Button type="button" size="sm" variant="ghost" onClick={() => setEditing(false)}>
            Annuler
          </Button>
        </div>
      </form>
    )

  if (entry.description)
    return (
      <p className="mt-1 text-sm whitespace-pre-wrap">
        {entry.description}
        {editable && (
          <Button variant="ghost" size="icon-xs" className="ml-1 align-middle" aria-label="Modifier la description" onClick={() => setEditing(true)}>
            <Pencil />
          </Button>
        )}
      </p>
    )

  return editable ? (
    <button type="button" onClick={() => setEditing(true)} className="mt-1 text-xs text-primary hover:underline">
      + Décrire le travail réalisé
    </button>
  ) : null
}

/** Heures oubliées : plage horaire d'une journée passée, au nom de l'utilisateur connecté. */
function AddTimeDialog({ tasks, onClose }: { tasks: Task[]; onClose: () => void }) {
  const logTime = useLogTime()
  const [errors, setErrors] = useState<Record<string, string>>({})

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const parsed = manualTimeSchema.safeParse(Object.fromEntries(new FormData(e.currentTarget)))
    if (!parsed.success) return setErrors(fieldErrors(parsed.error))
    const { task_id, date, start, end, description } = parsed.data
    const startedAt = new Date(`${date}T${start}`)
    const endedAt = new Date(`${date}T${end}`)
    if (endedAt.getTime() > Date.now()) return setErrors({ end: "Impossible d'enregistrer du temps dans le futur." })
    setErrors({})
    logTime.mutate(
      { taskId: task_id, startedAt: startedAt.toISOString(), endedAt: endedAt.toISOString(), description },
      { onSuccess: onClose }
    )
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Ajouter du temps oublié</DialogTitle>
          <DialogDescription>La session est enregistrée à votre nom et marquée « ajout manuel ».</DialogDescription>
        </DialogHeader>
        <form onSubmit={onSubmit} noValidate className="space-y-4">
          {tasks.length > 1 ? (
            <Field label="Tâche" error={errors.task_id}>
              <NativeSelect name="task_id" defaultValue="">
                <option value="" disabled>
                  Choisir une tâche
                </option>
                {tasks.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.title}
                  </option>
                ))}
              </NativeSelect>
            </Field>
          ) : (
            <input type="hidden" name="task_id" value={tasks[0]!.id} />
          )}
          <div className="grid grid-cols-3 gap-3">
            <Field label="Date" error={errors.date}>
              <Input type="date" name="date" defaultValue={todayISO()} max={todayISO()} />
            </Field>
            <Field label="Début" error={errors.start}>
              <Input type="time" name="start" defaultValue="09:00" />
            </Field>
            <Field label="Fin" error={errors.end}>
              <Input type="time" name="end" defaultValue="10:00" />
            </Field>
          </div>
          <Field label="Travail réalisé (facultatif)" error={errors.description}>
            <Textarea name="description" rows={3} maxLength={1000} placeholder="Ex. : intégration du formulaire de contact" />
          </Field>
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={onClose}>
              Annuler
            </Button>
            <Button type="submit" disabled={logTime.isPending}>
              {logTime.isPending && <Loader2 className="animate-spin" />} Ajouter
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

/** Correction d'une session terminée : nouvelle plage et justification (conservée dans l'historique). */
function EditSessionDialog({ session, onClose }: { session: Session; onClose: () => void }) {
  const edit = useEditTimeEntry()
  const [errors, setErrors] = useState<Record<string, string>>({})

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const parsed = editSessionSchema.safeParse(Object.fromEntries(new FormData(e.currentTarget)))
    if (!parsed.success) return setErrors(fieldErrors(parsed.error))
    const startedAt = new Date(parsed.data.started_at)
    const endedAt = new Date(parsed.data.ended_at)
    if (endedAt.getTime() > Date.now()) return setErrors({ ended_at: "Impossible d'enregistrer du temps dans le futur." })
    setErrors({})
    edit.mutate(
      { id: session.id!, startedAt: startedAt.toISOString(), endedAt: endedAt.toISOString(), reason: parsed.data.reason },
      { onSuccess: onClose }
    )
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Modifier la session</DialogTitle>
          <DialogDescription>
            {session.task.title} — l&apos;ancienne plage et votre justification restent visibles dans l&apos;historique.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={onSubmit} noValidate className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Début" error={errors.started_at}>
              <Input type="datetime-local" name="started_at" defaultValue={toLocalInput(session.started_at)} />
            </Field>
            <Field label="Fin" error={errors.ended_at}>
              <Input type="datetime-local" name="ended_at" defaultValue={toLocalInput(session.ended_at!)} />
            </Field>
          </div>
          <Field label="Justification" error={errors.reason}>
            <Textarea name="reason" rows={2} maxLength={1000} placeholder="Ex. : oubli d'arrêter le chronomètre" />
          </Field>
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={onClose}>
              Annuler
            </Button>
            <Button type="submit" disabled={edit.isPending}>
              {edit.isPending && <Loader2 className={cn("animate-spin")} />} Enregistrer
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

/** Motif d'une pause (modifiable par son auteur ou le propriétaire) et alerte de durée anormale. */
function PauseBadges({ session, editable, now }: { session: Session; editable: boolean; now: number }) {
  const setReason = useSetPauseReason()
  const reason = pauseReasonOf(session)
  const long = isLongPause(session, now)
  return (
    <>
      <Badge className="bg-warning/15 text-[oklch(0.5_0.14_55)]">
        <Coffee aria-hidden /> Pause
      </Badge>
      {editable && session.id ? (
        <NativeSelect
          aria-label="Motif de la pause"
          value={reason}
          onChange={(e) => setReason.mutate({ id: session.id!, reason: e.target.value as PauseReason })}
          className="w-36 [&_select]:h-7 [&_select]:text-xs"
        >
          {(Object.entries(PAUSE_REASONS) as [PauseReason, (typeof PAUSE_REASONS)[PauseReason]][]).map(([value, r]) => (
            <option key={value} value={value}>
              {r.label}
            </option>
          ))}
        </NativeSelect>
      ) : (
        <Badge variant="outline">{PAUSE_REASONS[reason].label}</Badge>
      )}
      {long && (
        <Badge variant="destructive" title={`Au-delà de ${PAUSE_REASONS[reason].maxMinutes} min pour une pause « ${PAUSE_REASONS[reason].label.toLowerCase()} »`}>
          <TriangleAlert aria-hidden /> Pause longue
        </Badge>
      )}
    </>
  )
}
