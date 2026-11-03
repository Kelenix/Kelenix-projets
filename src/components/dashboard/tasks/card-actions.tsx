"use client"

import { Ban, CalendarPlus, Check, ExternalLink, ListPlus, MoreHorizontal, Trash2 } from "lucide-react"
import { useRef, useState } from "react"
import { toast } from "sonner"
import { useConfirm } from "@/components/confirm"
import { Field } from "@/components/field"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import {
  TASK_PRIORITIES,
  TASK_PRIORITY_LABELS,
  TASK_STATUS_LABELS,
  TASK_STATUSES,
  type Profile,
  type Task,
  type TaskPriority,
  type TaskStatus,
} from "@/lib/domain"
import { useAddTaskItem, useDeleteTask, useProjects, useSetAssigned, useUpdateTask } from "@/lib/queries"
import { AssigneeStack, DueDate, PriorityBadge, TaskStatusBadge } from "./task-meta"

/**
 * Empêche le glisser-déposer de la carte de démarrer depuis ces contrôles, y compris depuis les
 * menus et fenêtres affichés hors de la carte (leurs événements remontent quand même à la carte).
 */
export const isolate = {
  onPointerDown: (e: React.PointerEvent) => e.stopPropagation(),
  onKeyDown: (e: React.KeyboardEvent) => e.stopPropagation(),
}

const trigger =
  "relative z-10 cursor-pointer rounded-full transition-shadow hover:ring-2 hover:ring-ring/30 focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"

/** Pastille de statut cliquable : change le statut sans ouvrir la tâche. */
export function StatusMenu({ task }: { task: Task }) {
  const updateTask = useUpdateTask()
  return (
    <DropdownMenu>
      <DropdownMenuTrigger {...isolate} aria-label={`Statut de « ${task.title} » : ${TASK_STATUS_LABELS[task.status]}`} className={`${trigger} shrink-0`}>
        <TaskStatusBadge status={task.status} />
      </DropdownMenuTrigger>
      <DropdownMenuContent {...isolate} align="end">
        <DropdownMenuLabel>Statut</DropdownMenuLabel>
        <DropdownMenuRadioGroup
          value={task.status}
          onValueChange={(status) => updateTask.mutate({ id: task.id, values: { status: status as TaskStatus } })}
        >
          {TASK_STATUSES.map((s) => (
            <DropdownMenuRadioItem key={s} value={s}>
              {TASK_STATUS_LABELS[s]}
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

/** Priorité cliquable. */
export function PriorityMenu({ task }: { task: Task }) {
  const updateTask = useUpdateTask()
  return (
    <DropdownMenu>
      <DropdownMenuTrigger {...isolate} aria-label={`Priorité de « ${task.title} » : ${TASK_PRIORITY_LABELS[task.priority]}`} className={trigger}>
        <PriorityBadge priority={task.priority} />
      </DropdownMenuTrigger>
      <DropdownMenuContent {...isolate}>
        <DropdownMenuLabel>Priorité</DropdownMenuLabel>
        <DropdownMenuRadioGroup
          value={task.priority}
          onValueChange={(priority) => updateTask.mutate({ id: task.id, values: { priority: priority as TaskPriority } })}
        >
          {TASK_PRIORITIES.map((p) => (
            <DropdownMenuRadioItem key={p} value={p}>
              {TASK_PRIORITY_LABELS[p]}
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

/** Échéance cliquable : ouvre le calendrier du navigateur ; vide = « Échéance ». */
export function DueDateControl({ task }: { task: Task }) {
  const updateTask = useUpdateTask()
  const input = useRef<HTMLInputElement>(null)
  function openPicker() {
    const el = input.current
    if (!el) return
    try {
      el.showPicker()
    } catch {
      el.focus()
    }
  }
  return (
    <span className="relative z-10 inline-flex">
      <button
        type="button"
        {...isolate}
        onClick={openPicker}
        aria-label={`Échéance de « ${task.title} » : ${task.due_date ?? "aucune"}, modifier`}
        className="-mx-1 inline-flex items-center rounded-md px-1 py-0.5 hover:bg-muted focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
      >
        {task.due_date ? (
          <DueDate task={task} />
        ) : (
          <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
            <CalendarPlus className="size-3.5" aria-hidden /> Échéance
          </span>
        )}
      </button>
      <input
        ref={input}
        type="date"
        tabIndex={-1}
        aria-hidden
        value={task.due_date ?? ""}
        onChange={(e) => updateTask.mutate({ id: task.id, values: { due_date: e.target.value || null } })}
        className="pointer-events-none absolute inset-0 opacity-0"
      />
    </span>
  )
}

/**
 * Avatars des affectés, cliquables : affecter ou désaffecter un membre du projet. Sans
 * responsable, la première personne affectée le devient.
 */
export function AssigneeMenu({
  task,
  profiles,
  children,
  className,
}: {
  task: Task
  profiles: Map<string, Profile>
  /** Contenu du déclencheur (par défaut : les avatars). */
  children?: React.ReactNode
  className?: string
}) {
  const { data: projects = [] } = useProjects()
  const updateTask = useUpdateTask()
  const setAssigned = useSetAssigned()
  const members = (projects.find((p) => p.id === task.project_id)?.member_ids ?? [])
    .map((id) => profiles.get(id))
    .filter((p) => p !== undefined)
    .sort((a, b) => a.full_name.localeCompare(b.full_name, "fr"))
  const assigned = new Set([task.assignee_id, ...task.assignees.map((a) => a.user_id)])

  function toggle(userId: string, on: boolean) {
    if (on && !task.assignee_id) updateTask.mutate({ id: task.id, values: { assignee_id: userId } })
    else setAssigned.mutate({ taskId: task.id, userId, assigned: on })
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger {...isolate} aria-label={`Collaborateurs affectés à « ${task.title} »`} className={className ?? trigger}>
        {children ?? <AssigneeStack task={task} profiles={profiles} />}
      </DropdownMenuTrigger>
      <DropdownMenuContent {...isolate} align="end" className="max-h-72">
        <DropdownMenuLabel>Collaborateurs affectés</DropdownMenuLabel>
        {members.map((m) => (
          <DropdownMenuCheckboxItem
            key={m.id}
            checked={assigned.has(m.id)}
            onSelect={(e) => e.preventDefault()}
            onCheckedChange={(on) => toggle(m.id, on === true)}
          >
            {m.full_name}
            {m.id === task.assignee_id && <span className="text-xs text-muted-foreground">· responsable</span>}
          </DropdownMenuCheckboxItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

/** Autres actions : ouvrir, ajouter à la checklist, bloquer / débloquer, supprimer. */
export function MoreMenu({ task, onOpen, onAddChecklist }: { task: Task; onOpen: () => void; onAddChecklist: () => void }) {
  const updateTask = useUpdateTask()
  const deleteTask = useDeleteTask()
  const confirm = useConfirm()
  const [blocking, setBlocking] = useState(false)

  async function remove() {
    const ok = await confirm({
      title: "Supprimer la tâche ?",
      description: `« ${task.title} » sera définitivement supprimée, avec sa checklist, ses commentaires et ses liens.`,
      confirmLabel: "Supprimer",
      destructive: true,
    })
    if (ok) deleteTask.mutate(task.id)
  }

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild {...isolate}>
          <Button variant="ghost" size="icon-sm" aria-label={`Autres actions sur « ${task.title} »`} className="relative z-10 shrink-0">
            <MoreHorizontal />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent {...isolate} align="end">
          <DropdownMenuItem onSelect={onOpen}>
            <ExternalLink aria-hidden /> Ouvrir le détail
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={onAddChecklist}>
            <ListPlus aria-hidden /> Ajouter à la checklist
          </DropdownMenuItem>
          {task.is_blocked ? (
            <DropdownMenuItem onSelect={() => updateTask.mutate({ id: task.id, values: { is_blocked: false, blocked_reason: null } })}>
              <Check aria-hidden /> Débloquer
            </DropdownMenuItem>
          ) : (
            <DropdownMenuItem onSelect={() => setBlocking(true)}>
              <Ban aria-hidden /> Marquer comme bloquée
            </DropdownMenuItem>
          )}
          <DropdownMenuSeparator />
          <DropdownMenuItem variant="destructive" onSelect={remove}>
            <Trash2 aria-hidden /> Supprimer
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      <BlockDialog task={task} open={blocking} onClose={() => setBlocking(false)} />
    </>
  )
}

export function BlockDialog({ task, open, onClose }: { task: Task; open: boolean; onClose: () => void }) {
  const updateTask = useUpdateTask()
  const [reason, setReason] = useState("")
  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent {...isolate} className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Marquer comme bloquée</DialogTitle>
          <DialogDescription>« {task.title} »</DialogDescription>
        </DialogHeader>
        <form
          className="space-y-4"
          onSubmit={(e) => {
            e.preventDefault()
            if (!reason.trim()) return void toast.error("Expliquez ce qui bloque la tâche.")
            updateTask.mutate({ id: task.id, values: { is_blocked: true, blocked_reason: reason.trim().slice(0, 1000) } })
            setReason("")
            onClose()
          }}
        >
          <Field label="Qu'est-ce qui bloque ?">
            <Textarea value={reason} onChange={(e) => setReason(e.target.value)} rows={3} autoFocus />
          </Field>
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={onClose}>
              Annuler
            </Button>
            <Button type="submit">Marquer bloquée</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

/** Ajout rapide d'un élément de checklist depuis la carte. */
export function ChecklistAdd({ task, autoFocus }: { task: Task; autoFocus?: boolean }) {
  const add = useAddTaskItem("task_checklist_items", task.id)
  const [label, setLabel] = useState("")
  return (
    <form
      {...isolate}
      className="relative z-10 mt-1 flex gap-1"
      onSubmit={(e) => {
        e.preventDefault()
        const text = label.trim()
        if (!text) return
        add.mutate({ label: text.slice(0, 200) }, { onSuccess: () => setLabel("") })
      }}
    >
      <Input
        value={label}
        onChange={(e) => setLabel(e.target.value)}
        placeholder="Nouvel élément…"
        aria-label={`Nouvel élément de checklist pour « ${task.title} »`}
        autoFocus={autoFocus}
        maxLength={200}
        className="h-7 text-xs"
      />
      <Button type="submit" size="sm" variant="secondary" className="h-7" disabled={add.isPending}>
        Ajouter
      </Button>
    </form>
  )
}
