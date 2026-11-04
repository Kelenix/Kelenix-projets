"use client"

import { Ban, ExternalLink, Link2, ListChecks, Loader2, MessageSquare, Timer, Trash2, Users, X } from "lucide-react"
import { useEffect, useState } from "react"
import { toast } from "sonner"
import { useConfirm } from "@/components/confirm"
import { Field } from "@/components/field"
import { NativeSelect } from "@/components/native-select"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
import { Separator } from "@/components/ui/separator"
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet"
import { Skeleton } from "@/components/ui/skeleton"
import { Textarea } from "@/components/ui/textarea"
import type { TablesUpdate } from "@/lib/database.types"
import {
  isOverdue,
  TASK_PRIORITIES,
  TASK_PRIORITY_LABELS,
  TASK_STATUS_LABELS,
  TASK_STATUSES,
  type Profile,
  type Task,
  type TaskPriority,
  type TaskStatus,
} from "@/lib/domain"
import {
  useAddTaskItem,
  useDeleteTask,
  useDeleteTaskItem,
  useProfiles,
  useProjects,
  useSetAssigned,
  useSetEstimate,
  useTaskDetails,
  useTasks,
  useToggleChecklistItem,
  useUpdateTask,
} from "@/lib/queries"
import { linkSchema } from "@/lib/schemas"
import { formatDuration, totals } from "@/lib/time"
import { useDashboard } from "../state"
import { TagChips, TagPicker } from "../tags"
import { BlockedBadge, Gap } from "./task-meta"
import { TaskTimeDetails } from "../time-sessions"
import { TaskTime } from "./task-time"

/** Panneau latéral de détail d'une tâche (ouvert via ?t=<id>). */
export function TaskSheet() {
  const { taskId, navigate } = useDashboard()
  const { data: tasks, isPending } = useTasks()
  const task = tasks?.find((t) => t.id === taskId)

  // Lien vers une tâche supprimée ou inaccessible : on referme proprement.
  useEffect(() => {
    if (taskId && !isPending && !task) navigate({ taskId: null })
  }, [taskId, isPending, task, navigate])

  return (
    <Sheet open={!!task} onOpenChange={(open) => !open && navigate({ taskId: null })}>
      <SheetContent className="gap-0 overflow-y-auto data-[side=right]:w-full data-[side=right]:sm:max-w-lg">
        {task && <TaskDetails key={task.id} task={task} />}
      </SheetContent>
    </Sheet>
  )
}

function TaskDetails({ task }: { task: Task }) {
  const { navigate } = useDashboard()
  const confirm = useConfirm()
  const updateTask = useUpdateTask()
  const deleteTask = useDeleteTask()
  const { data: projects = [] } = useProjects()
  const { data: profiles = [] } = useProfiles()
  const project = projects.find((p) => p.id === task.project_id)
  const members = profiles.filter((p) => project?.member_ids.includes(p.id))

  const [title, setTitle] = useState(task.title)
  const [description, setDescription] = useState(task.description ?? "")

  const save = (values: TablesUpdate<"tasks">) => updateTask.mutate({ id: task.id, values })

  function saveTitle() {
    const next = title.trim()
    if (!next) {
      setTitle(task.title)
      return toast.error("Le titre est obligatoire.")
    }
    if (next !== task.title) save({ title: next.slice(0, 200) })
  }

  async function remove() {
    const ok = await confirm({
      title: "Supprimer la tâche ?",
      description: `« ${task.title} » sera définitivement supprimée, avec sa checklist, ses commentaires et ses liens.`,
      confirmLabel: "Supprimer",
      destructive: true,
    })
    if (!ok) return
    await deleteTask.mutateAsync(task.id)
    navigate({ taskId: null })
  }

  return (
    <>
      <SheetHeader className="border-b pr-12">
        <SheetDescription>
          <button
            type="button"
            className="hover:text-primary hover:underline"
            onClick={() => navigate({ section: "projects", projectId: task.project_id, taskId: task.id })}
          >
            {project?.name}
          </button>
        </SheetDescription>
        <SheetTitle className="sr-only">{task.title}</SheetTitle>
        <Textarea
          aria-label="Titre de la tâche"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          onBlur={saveTitle}
          onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), e.currentTarget.blur())}
          rows={1}
          className="min-h-0 resize-none border-transparent bg-transparent px-1 text-lg font-semibold shadow-none focus-visible:border-ring"
        />
        <div className="flex flex-wrap items-center gap-2 px-1">
          <TagPicker target="task" id={task.id} selected={task.tag_ids} label={`Tags de « ${task.title} »`} />
          <TagChips ids={task.tag_ids} />
          {task.is_blocked && <BlockedBadge />}
          {isOverdue(task) && <span className="text-xs font-medium text-destructive">En retard</span>}
        </div>
      </SheetHeader>

      <div className="space-y-6 p-4">
        <div className="grid grid-cols-2 gap-4">
          <Field label="Statut">
            <NativeSelect value={task.status} onChange={(e) => save({ status: e.target.value as TaskStatus })}>
              {TASK_STATUSES.map((s) => (
                <option key={s} value={s}>
                  {TASK_STATUS_LABELS[s]}
                </option>
              ))}
            </NativeSelect>
          </Field>
          <Field label="Priorité">
            <NativeSelect value={task.priority} onChange={(e) => save({ priority: e.target.value as TaskPriority })}>
              {TASK_PRIORITIES.map((p) => (
                <option key={p} value={p}>
                  {TASK_PRIORITY_LABELS[p]}
                </option>
              ))}
            </NativeSelect>
          </Field>
          <Field label="Responsable">
            <NativeSelect value={task.assignee_id ?? ""} onChange={(e) => save({ assignee_id: e.target.value || null })}>
              <option value="">À assigner</option>
              {members.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.full_name}
                </option>
              ))}
            </NativeSelect>
          </Field>
          <Field label="Échéance">
            <Input type="date" value={task.due_date ?? ""} onChange={(e) => save({ due_date: e.target.value || null })} />
          </Field>
        </div>

        <Field label="Description">
          <Textarea
            value={description}
            placeholder="Ajoutez du contexte…"
            onChange={(e) => setDescription(e.target.value)}
            onBlur={() => description !== (task.description ?? "") && save({ description: description.trim() || null })}
            rows={4}
          />
        </Field>

        <Assignees task={task} members={members} />

        <section aria-label="Temps passé">
          <SectionTitle icon={Timer}>Temps passé</SectionTitle>
          <TaskTime task={task} profiles={new Map(profiles.map((p) => [p.id, p]))} />
          <TaskTimeDetails task={task} profiles={profiles} />
        </section>
        <BlockedEditor task={task} onSave={save} />
        <Separator />
        <Checklist task={task} />
        <Links taskId={task.id} />
        <Comments taskId={task.id} profiles={profiles} />
        <Separator />
        <Button variant="destructive" onClick={remove} disabled={deleteTask.isPending}>
          <Trash2 aria-hidden /> Supprimer la tâche
        </Button>
      </div>
    </>
  )
}

/** Heures saisies (« 1,5 » ou « 1.5 ») → minutes ; `null` si vide, `undefined` si invalide. */
function parseHours(value: string) {
  if (!value.trim()) return null
  const hours = Number(value.replace(",", "."))
  return Number.isFinite(hours) && hours >= 0 && hours <= 1600 ? Math.round(hours * 60) : undefined
}

/**
 * Collaborateurs affectés à la tâche (le responsable en fait partie), avec pour chacun son temps
 * estimé, son temps de travail réel sur la tâche et l'écart.
 */
function Assignees({ task, members }: { task: Task; members: Profile[] }) {
  const setAssigned = useSetAssigned()
  const setEstimate = useSetEstimate()
  const names = new Map(members.map((m) => [m.id, m.full_name]))
  const free = members.filter((m) => !task.assignees.some((a) => a.user_id === m.id))
  const rows = task.assignees.map((a) => ({
    ...a,
    actual: totals(task.time_entries.filter((e) => e.user_id === a.user_id)).work,
  }))
  const estimated = rows.reduce((sum, r) => sum + (r.estimated_minutes ?? 0) * 60_000, 0)

  function saveEstimate(userId: string, current: number | null, value: string) {
    const minutes = parseHours(value)
    if (minutes === undefined) return void toast.error("Indiquez un nombre d'heures valide (ex. 1,5).")
    if (minutes !== current) setEstimate.mutate({ taskId: task.id, userId, minutes })
  }

  return (
    <section aria-label="Collaborateurs affectés">
      <SectionTitle icon={Users}>Collaborateurs affectés ({rows.length})</SectionTitle>
      {rows.length > 0 && (
        <div className="overflow-x-auto rounded-lg border">
          <table className="w-full text-sm">
            <caption className="sr-only">Temps estimé et temps réel par collaborateur</caption>
            <thead>
              <tr className="border-b text-left text-xs text-muted-foreground">
                <th scope="col" className="px-3 py-2 font-medium">Collaborateur</th>
                <th scope="col" className="px-2 py-2 font-medium">Estimé (h)</th>
                <th scope="col" className="px-2 py-2 text-right font-medium">Réel</th>
                <th scope="col" className="px-2 py-2 text-right font-medium">Écart</th>
                <th scope="col" className="w-8">
                  <span className="sr-only">Retirer</span>
                </th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {rows.map((r) => {
                const name = names.get(r.user_id) ?? "Ancien membre"
                return (
                  <tr key={r.user_id}>
                    <th scope="row" className="px-3 py-1.5 text-left font-medium">
                      {name}
                      {r.user_id === task.assignee_id && <span className="font-normal text-muted-foreground"> · responsable</span>}
                    </th>
                    <td className="px-2 py-1.5">
                      <Input
                        key={r.estimated_minutes ?? "none"}
                        aria-label={`Temps estimé de ${name} (heures)`}
                        inputMode="decimal"
                        placeholder="—"
                        defaultValue={r.estimated_minutes === null ? "" : String(r.estimated_minutes / 60).replace(".", ",")}
                        onBlur={(e) => saveEstimate(r.user_id, r.estimated_minutes, e.target.value)}
                        onKeyDown={(e) => e.key === "Enter" && e.currentTarget.blur()}
                        className="h-8 w-20"
                      />
                    </td>
                    <td className="px-2 py-1.5 text-right tabular-nums">{r.actual > 0 ? formatDuration(r.actual) : "—"}</td>
                    <td className="px-2 py-1.5 text-right tabular-nums">
                      <Gap estimated={r.estimated_minutes === null ? null : r.estimated_minutes * 60_000} actual={r.actual} />
                    </td>
                    <td className="pr-1">
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        aria-label={`Désaffecter ${name}`}
                        onClick={() => setAssigned.mutate({ taskId: task.id, userId: r.user_id, assigned: false })}
                      >
                        <X />
                      </Button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
            {rows.length > 1 && (
              <tfoot>
                <tr className="border-t bg-muted/40 text-xs font-medium">
                  <th scope="row" className="px-3 py-2 text-left">Équipe</th>
                  <td className="px-2 py-2 tabular-nums">{estimated > 0 ? formatDuration(estimated) : "—"}</td>
                  <td className="px-2 py-2 text-right tabular-nums">{formatDuration(rows.reduce((sum, r) => sum + r.actual, 0))}</td>
                  <td colSpan={2} />
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      )}
      {free.length > 0 && (
        <NativeSelect
          aria-label="Affecter un collaborateur"
          value=""
          onChange={(e) => e.target.value && setAssigned.mutate({ taskId: task.id, userId: e.target.value, assigned: true })}
          className="mt-2 w-full sm:w-64"
        >
          <option value="">+ Affecter un collaborateur…</option>
          {free.map((m) => (
            <option key={m.id} value={m.id}>
              {m.full_name}
            </option>
          ))}
        </NativeSelect>
      )}
    </section>
  )
}

function BlockedEditor({ task, onSave }: { task: Task; onSave: (values: TablesUpdate<"tasks">) => void }) {
  const [editing, setEditing] = useState(false)
  const [reason, setReason] = useState("")

  if (task.is_blocked)
    return (
      <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-3">
        <p className="flex items-center gap-2 text-sm font-medium text-destructive">
          <Ban className="size-4" aria-hidden /> Tâche bloquée
        </p>
        <p className="mt-1 text-sm whitespace-pre-wrap">{task.blocked_reason}</p>
        <Button size="sm" variant="outline" className="mt-3" onClick={() => onSave({ is_blocked: false, blocked_reason: null })}>
          Débloquer
        </Button>
      </div>
    )

  if (!editing)
    return (
      <Button variant="outline" size="sm" onClick={() => setEditing(true)}>
        <Ban aria-hidden /> Marquer comme bloquée
      </Button>
    )

  return (
    <form
      className="space-y-2 rounded-lg border p-3"
      onSubmit={(e) => {
        e.preventDefault()
        if (!reason.trim()) return toast.error("Expliquez ce qui bloque la tâche.")
        onSave({ is_blocked: true, blocked_reason: reason.trim().slice(0, 1000) })
        setEditing(false)
      }}
    >
      <Field label="Qu'est-ce qui bloque ?">
        <Textarea value={reason} onChange={(e) => setReason(e.target.value)} rows={2} autoFocus />
      </Field>
      <div className="flex gap-2">
        <Button type="submit" size="sm">
          Marquer bloquée
        </Button>
        <Button type="button" size="sm" variant="ghost" onClick={() => setEditing(false)}>
          Annuler
        </Button>
      </div>
    </form>
  )
}

function SectionTitle({ icon: Icon, children }: { icon: typeof ListChecks; children: React.ReactNode }) {
  return (
    <h3 className="mb-2 flex items-center gap-2 text-sm font-semibold">
      <Icon className="size-4 text-muted-foreground" aria-hidden /> {children}
    </h3>
  )
}

function DetailsSkeleton() {
  return <Skeleton className="h-9 w-full" />
}

function Checklist({ task }: { task: Task }) {
  const taskId = task.id
  const add = useAddTaskItem("task_checklist_items", taskId)
  const toggle = useToggleChecklistItem(taskId)
  const remove = useDeleteTaskItem("task_checklist_items", taskId)
  const [label, setLabel] = useState("")
  const items = task.checklist
  const done = items.filter((i) => i.done).length

  return (
    <section aria-label="Checklist">
      <SectionTitle icon={ListChecks}>
        Checklist {items.length > 0 && <span className="font-normal text-muted-foreground">{done}/{items.length}</span>}
      </SectionTitle>
      <ul className="space-y-1">
        {items.map((item) => (
          <li key={item.id} className="group flex items-center gap-2 rounded-md px-1 py-1 hover:bg-muted">
            <Checkbox
              id={`check-${item.id}`}
              checked={item.done}
              onCheckedChange={(checked) => toggle.mutate({ id: item.id, done: checked === true })}
            />
            <label htmlFor={`check-${item.id}`} className={`flex-1 text-sm ${item.done ? "text-muted-foreground line-through" : ""}`}>
              {item.label}
            </label>
            <Button variant="ghost" size="icon-xs" aria-label={`Supprimer « ${item.label} »`} onClick={() => remove.mutate(item.id)}>
              <X />
            </Button>
          </li>
        ))}
      </ul>
      <form
        className="mt-2 flex gap-2"
        onSubmit={(e) => {
          e.preventDefault()
          if (!label.trim()) return
          add.mutate({ label: label.trim().slice(0, 200) }, { onSuccess: () => setLabel("") })
        }}
      >
        <Input aria-label="Nouvel élément de checklist" placeholder="Ajouter un élément" value={label} onChange={(e) => setLabel(e.target.value)} />
        <Button type="submit" variant="secondary" disabled={add.isPending}>
          Ajouter
        </Button>
      </form>
    </section>
  )
}

function Links({ taskId }: { taskId: string }) {
  const { data, isPending } = useTaskDetails(taskId)
  const add = useAddTaskItem("task_links", taskId)
  const remove = useDeleteTaskItem("task_links", taskId)
  const [url, setUrl] = useState("")
  const [error, setError] = useState<string>()

  return (
    <section aria-label="Liens utiles">
      <SectionTitle icon={Link2}>Liens utiles</SectionTitle>
      {isPending ? (
        <DetailsSkeleton />
      ) : (
        <ul className="space-y-1">
          {data?.links.map((link) => (
            <li key={link.id} className="flex items-center gap-2 rounded-md px-1 py-1 hover:bg-muted">
              <a href={link.url} target="_blank" rel="noopener noreferrer" className="flex min-w-0 flex-1 items-center gap-2 text-sm text-primary hover:underline">
                <ExternalLink className="size-3.5 shrink-0" aria-hidden />
                <span className="truncate">{link.label || link.url}</span>
              </a>
              <Button variant="ghost" size="icon-xs" aria-label="Supprimer le lien" onClick={() => remove.mutate(link.id)}>
                <X />
              </Button>
            </li>
          ))}
        </ul>
      )}
      <form
        className="mt-2 flex items-start gap-2"
        noValidate
        onSubmit={(e) => {
          e.preventDefault()
          const parsed = linkSchema.safeParse({ url, label: "" })
          if (!parsed.success) return setError(parsed.error.issues[0]?.message)
          setError(undefined)
          add.mutate(parsed.data, { onSuccess: () => setUrl("") })
        }}
      >
        <div className="flex-1">
          <Input
            type="url"
            aria-label="Adresse du lien"
            aria-invalid={!!error}
            placeholder="https://…"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
          />
          {error && <p className="mt-1 text-xs text-destructive">{error}</p>}
        </div>
        <Button type="submit" variant="secondary" disabled={add.isPending}>
          Ajouter
        </Button>
      </form>
    </section>
  )
}

function Comments({ taskId, profiles }: { taskId: string; profiles: Profile[] }) {
  const { viewer, canManage } = useDashboard()
  const { data: tasks } = useTasks()
  const projectId = tasks?.find((t) => t.id === taskId)?.project_id
  const isManager = !!projectId && canManage(projectId)
  const { data, isPending } = useTaskDetails(taskId)
  const add = useAddTaskItem("task_comments", taskId)
  const remove = useDeleteTaskItem("task_comments", taskId)
  const [body, setBody] = useState("")
  const names = new Map(profiles.map((p) => [p.id, p.full_name]))

  return (
    <section aria-label="Commentaires">
      <SectionTitle icon={MessageSquare}>Commentaires</SectionTitle>
      {isPending ? (
        <DetailsSkeleton />
      ) : data?.comments.length === 0 ? (
        <p className="text-sm text-muted-foreground">Aucun commentaire.</p>
      ) : (
        <ul className="space-y-3">
          {data?.comments.map((comment) => (
            <li key={comment.id} className="rounded-lg bg-muted/60 p-3">
              <div className="mb-1 flex items-center gap-2 text-xs text-muted-foreground">
                <span className="font-medium text-foreground">
                  {(comment.author_id && names.get(comment.author_id)) ?? "Ancien membre"}
                </span>
                <time dateTime={comment.created_at}>
                  {new Date(comment.created_at).toLocaleString("fr-FR", { dateStyle: "medium", timeStyle: "short" })}
                </time>
                {(comment.author_id === viewer.id || isManager) && (
                  <Button
                    variant="ghost"
                    size="icon-xs"
                    className="ml-auto"
                    aria-label="Supprimer le commentaire"
                    onClick={() => remove.mutate(comment.id)}
                  >
                    <X />
                  </Button>
                )}
              </div>
              <p className="text-sm whitespace-pre-wrap">{comment.body}</p>
            </li>
          ))}
        </ul>
      )}
      <form
        className="mt-3 space-y-2"
        onSubmit={(e) => {
          e.preventDefault()
          if (!body.trim()) return
          add.mutate({ body: body.trim().slice(0, 5000), author_id: viewer.id }, { onSuccess: () => setBody("") })
        }}
      >
        <Textarea aria-label="Nouveau commentaire" placeholder="Écrire un commentaire…" value={body} onChange={(e) => setBody(e.target.value)} rows={2} />
        <Button type="submit" size="sm" disabled={add.isPending || !body.trim()}>
          {add.isPending && <Loader2 className="animate-spin" />} Commenter
        </Button>
      </form>
    </section>
  )
}
