"use client"

import { Loader2, Trash2 } from "lucide-react"
import { useState, type ReactNode } from "react"
import { useConfirm } from "@/components/confirm"
import { Field } from "@/components/field"
import { NativeSelect } from "@/components/native-select"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import {
  PROJECT_STATUS_LABELS,
  TASK_PRIORITIES,
  TASK_PRIORITY_LABELS,
  type Client,
  type Project,
} from "@/lib/domain"
import {
  useClients,
  useCreateTask,
  useDeleteClient,
  useProfiles,
  useProjects,
  useSaveClient,
  useSaveProject,
  useTasks,
} from "@/lib/queries"
import { clientSchema, fieldErrors, projectSchema, taskSchema } from "@/lib/schemas"
import { useConfirmClosure } from "./project-workspace"
import { useDashboard } from "./state"
import { ProfileDialog, TeamDialog } from "./team"

export function Dialogs() {
  const { dialog, openDialog } = useDashboard()
  const close = () => openDialog(null)
  return (
    <>
      <FormDialog open={dialog?.type === "project"} onClose={close} title={dialog?.type === "project" && dialog.project ? "Modifier le projet" : "Nouveau projet"}>
        {dialog?.type === "project" && <ProjectForm project={dialog.project} onDone={close} />}
      </FormDialog>
      <FormDialog open={dialog?.type === "client"} onClose={close} title={dialog?.type === "client" && dialog.client ? "Modifier le client" : "Nouveau client"}>
        {dialog?.type === "client" && <ClientForm client={dialog.client} onDone={close} />}
      </FormDialog>
      <FormDialog open={dialog?.type === "task"} onClose={close} title="Nouvelle tâche">
        {dialog?.type === "task" && <TaskForm projectId={dialog.projectId} onDone={close} />}
      </FormDialog>
      <TeamDialog open={dialog?.type === "team"} onClose={close} />
      <ProfileDialog open={dialog?.type === "profile"} onClose={close} />
    </>
  )
}

function FormDialog({ open, onClose, title, children }: { open: boolean; onClose: () => void; title: string; children: ReactNode }) {
  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription className="sr-only">Formulaire : {title}</DialogDescription>
        </DialogHeader>
        {children}
      </DialogContent>
    </Dialog>
  )
}

function SubmitBar({ pending, label, extra, onCancel }: { pending: boolean; label: string; extra?: ReactNode; onCancel: () => void }) {
  return (
    <DialogFooter className="items-center gap-2 pt-2 sm:justify-between">
      <div>{extra}</div>
      <div className="flex gap-2">
        <Button type="button" variant="ghost" onClick={onCancel}>
          Annuler
        </Button>
        <Button type="submit" disabled={pending}>
          {pending && <Loader2 className="animate-spin" />}
          {label}
        </Button>
      </div>
    </DialogFooter>
  )
}

function ProjectForm({ project, onDone }: { project?: Project; onDone: () => void }) {
  const { viewer } = useDashboard()
  const { data: clients = [] } = useClients()
  const { data: profiles = [] } = useProfiles()
  const { data: tasks = [] } = useTasks()
  const saveProject = useSaveProject()
  const confirmClosure = useConfirmClosure()
  const [memberIds, setMemberIds] = useState<string[]>(project?.member_ids ?? [viewer.id])
  const [errors, setErrors] = useState<Record<string, string>>({})

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const parsed = projectSchema.safeParse({ ...Object.fromEntries(new FormData(e.currentTarget)), member_ids: memberIds })
    if (!parsed.success) return setErrors(fieldErrors(parsed.error))
    setErrors({})
    const { member_ids, ...values } = parsed.data
    if (project && values.status === "done" && project.status !== "done" && !(await confirmClosure(project, tasks))) return
    saveProject.mutate({ id: project?.id, values, memberIds: member_ids }, { onSuccess: onDone })
  }

  return (
    <form onSubmit={onSubmit} noValidate className="space-y-4">
      <Field label="Nom du projet" error={errors.name}>
        <Input name="name" defaultValue={project?.name} autoFocus required maxLength={120} />
      </Field>
      <Field label="Description (facultatif)" error={errors.description}>
        <Textarea name="description" defaultValue={project?.description ?? ""} rows={3} />
      </Field>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Client (facultatif)">
          <NativeSelect name="client_id" defaultValue={project?.client_id ?? ""}>
            <option value="">Aucun client</option>
            {clients.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </NativeSelect>
        </Field>
        <Field label="Échéance (facultatif)" error={errors.due_date}>
          <Input type="date" name="due_date" defaultValue={project?.due_date ?? ""} />
        </Field>
        <Field label="Statut">
          <NativeSelect name="status" defaultValue={project?.status ?? "planned"}>
            {Object.entries(PROJECT_STATUS_LABELS).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </NativeSelect>
        </Field>
      </div>
      <fieldset className="space-y-2">
        <legend className="text-sm font-medium">Membres autorisés</legend>
        <p className="text-xs text-muted-foreground">Seuls les membres voient le projet et peuvent recevoir ses tâches.</p>
        <ul className="max-h-40 space-y-1 overflow-y-auto rounded-lg border p-2">
          {profiles.map((p) => (
            <li key={p.id} className="flex items-center gap-2 px-1 py-1">
              <Checkbox
                id={`member-${p.id}`}
                checked={memberIds.includes(p.id)}
                onCheckedChange={(checked) =>
                  setMemberIds((ids) => (checked === true ? [...ids, p.id] : ids.filter((id) => id !== p.id)))
                }
              />
              <label htmlFor={`member-${p.id}`} className="text-sm">
                {p.full_name}
                {p.id === viewer.id && <span className="text-muted-foreground"> (vous)</span>}
              </label>
            </li>
          ))}
        </ul>
      </fieldset>
      <SubmitBar pending={saveProject.isPending} label={project ? "Enregistrer" : "Créer le projet"} onCancel={onDone} />
    </form>
  )
}

function ClientForm({ client, onDone }: { client?: Client; onDone: () => void }) {
  const saveClient = useSaveClient()
  const deleteClient = useDeleteClient()
  const confirm = useConfirm()
  const [errors, setErrors] = useState<Record<string, string>>({})

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const parsed = clientSchema.safeParse(Object.fromEntries(new FormData(e.currentTarget)))
    if (!parsed.success) return setErrors(fieldErrors(parsed.error))
    setErrors({})
    saveClient.mutate({ id: client?.id, values: parsed.data }, { onSuccess: onDone })
  }

  async function remove() {
    const ok = await confirm({
      title: "Supprimer le client ?",
      description: `« ${client!.name} » sera supprimé. Ses projets sont conservés, sans client associé.`,
      confirmLabel: "Supprimer",
      destructive: true,
    })
    if (ok) deleteClient.mutate(client!.id, { onSuccess: onDone })
  }

  return (
    <form onSubmit={onSubmit} noValidate className="space-y-4">
      <Field label="Nom" error={errors.name}>
        <Input name="name" defaultValue={client?.name} autoFocus required maxLength={120} />
      </Field>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Entreprise (facultatif)" error={errors.company}>
          <Input name="company" defaultValue={client?.company ?? ""} maxLength={120} />
        </Field>
        <Field label="E-mail (facultatif)" error={errors.email}>
          <Input name="email" type="email" defaultValue={client?.email ?? ""} />
        </Field>
      </div>
      <Field label="Notes" error={errors.notes}>
        <Textarea name="notes" defaultValue={client?.notes ?? ""} rows={4} />
      </Field>
      <SubmitBar
        pending={saveClient.isPending}
        label={client ? "Enregistrer" : "Créer le client"}
        onCancel={onDone}
        extra={
          client && (
            <Button type="button" variant="destructive" onClick={remove}>
              <Trash2 aria-hidden /> Supprimer
            </Button>
          )
        }
      />
    </form>
  )
}

function TaskForm({ projectId, onDone }: { projectId?: string; onDone: () => void }) {
  const { viewer, navigate } = useDashboard()
  const { data: projects = [] } = useProjects()
  const { data: profiles = [] } = useProfiles()
  const createTask = useCreateTask()
  const [errors, setErrors] = useState<Record<string, string>>({})

  const available = projects.filter((p) => !p.archived_at)
  const [selectedProjectId, setSelectedProjectId] = useState(projectId ?? available[0]?.id ?? "")
  const project = projects.find((p) => p.id === selectedProjectId)
  const members = profiles.filter((p) => project?.member_ids.includes(p.id))
  // En solo comme en équipe, la tâche revient par défaut à l'utilisateur connecté s'il est membre.
  const defaultAssignee = members.some((m) => m.id === viewer.id) ? viewer.id : members.length === 1 ? members[0]!.id : ""

  if (available.length === 0)
    return (
      <div className="space-y-4">
        <p className="text-sm text-muted-foreground">Une tâche appartient toujours à un projet. Créez d&apos;abord un projet.</p>
        <DialogFooter>
          <Button onClick={() => (onDone(), navigate({ section: "projects" }))}>Aller aux projets</Button>
        </DialogFooter>
      </div>
    )

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const form = Object.fromEntries(new FormData(e.currentTarget))
    const parsed = taskSchema.safeParse({ ...form, status: "todo", is_blocked: false, blocked_reason: "" })
    if (!parsed.success) return setErrors(fieldErrors(parsed.error))
    if (!selectedProjectId) return setErrors({ project_id: "Choisissez un projet." })
    setErrors({})
    createTask.mutate({ ...parsed.data, project_id: selectedProjectId }, { onSuccess: onDone })
  }

  return (
    <form onSubmit={onSubmit} noValidate className="space-y-4">
      <Field label="Projet" error={errors.project_id}>
        <NativeSelect value={selectedProjectId} onChange={(e) => setSelectedProjectId(e.target.value)}>
          {available.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </NativeSelect>
      </Field>
      <Field label="Titre" error={errors.title}>
        <Input name="title" autoFocus required maxLength={200} />
      </Field>
      <Field label="Description (facultatif)" error={errors.description}>
        <Textarea name="description" rows={3} />
      </Field>
      <div className="grid gap-4 sm:grid-cols-3">
        <Field label="Responsable">
          <NativeSelect key={selectedProjectId} name="assignee_id" defaultValue={defaultAssignee}>
            <option value="">À assigner</option>
            {members.map((m) => (
              <option key={m.id} value={m.id}>
                {m.full_name}
              </option>
            ))}
          </NativeSelect>
        </Field>
        <Field label="Priorité">
          <NativeSelect name="priority" defaultValue="normal">
            {TASK_PRIORITIES.map((p) => (
              <option key={p} value={p}>
                {TASK_PRIORITY_LABELS[p]}
              </option>
            ))}
          </NativeSelect>
        </Field>
        <Field label="Échéance" error={errors.due_date}>
          <Input type="date" name="due_date" />
        </Field>
      </div>
      <SubmitBar pending={createTask.isPending} label="Créer la tâche" onCancel={onDone} />
    </form>
  )
}
