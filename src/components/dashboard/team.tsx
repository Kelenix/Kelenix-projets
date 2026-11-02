"use client"

import { useQueryClient } from "@tanstack/react-query"
import { Loader2, Trash2, UserPlus } from "lucide-react"
import { useState, useTransition } from "react"
import { toast } from "sonner"
import { createMember, deleteMember } from "@/app/actions"
import { useConfirm } from "@/components/confirm"
import { Field } from "@/components/field"
import { NativeSelect } from "@/components/native-select"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { ROLE_LABELS, type Profile, type Role } from "@/lib/domain"
import { errorMessage, keys, useProfiles, useProjects, useSetProjectAccess, useUpdateProfile } from "@/lib/queries"
import { fieldErrors, memberSchema, passwordSchema } from "@/lib/schemas"
import { getSupabase } from "@/lib/supabase/client"
import { useDashboard } from "./state"
import { Assignee } from "./tasks/task-meta"

export function TeamDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { isOwner } = useDashboard()
  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{isOwner ? "Équipe et paramètres" : "Équipe"}</DialogTitle>
          <DialogDescription>
            {isOwner
              ? "Gérez les membres, leurs rôles et les projets auxquels ils ont accès."
              : "Les personnes qui travaillent dans cet espace."}
          </DialogDescription>
        </DialogHeader>
        {isOwner ? (
          <Tabs defaultValue="members">
            <TabsList>
              <TabsTrigger value="members">Membres</TabsTrigger>
              <TabsTrigger value="access">Accès aux projets</TabsTrigger>
            </TabsList>
            <TabsContent value="members" className="space-y-6 pt-4">
              <MemberList />
              <AddMemberForm />
            </TabsContent>
            <TabsContent value="access" className="pt-4">
              <AccessMatrix />
            </TabsContent>
          </Tabs>
        ) : (
          <MemberList />
        )}
      </DialogContent>
    </Dialog>
  )
}

function MemberList() {
  const { viewer, isOwner } = useDashboard()
  const { data: profiles = [] } = useProfiles()
  const updateProfile = useUpdateProfile()
  const queryClient = useQueryClient()
  const confirm = useConfirm()
  const [pending, startTransition] = useTransition()

  async function remove(member: Profile) {
    const ok = await confirm({
      title: `Retirer ${member.full_name} ?`,
      description: "Son compte sera supprimé et ses tâches repasseront « À assigner ». Cette action est définitive.",
      confirmLabel: "Retirer le membre",
      destructive: true,
    })
    if (!ok) return
    startTransition(async () => {
      const result = await deleteMember(member.id)
      if (!result.ok) return void toast.error(result.error)
      toast.success("Membre retiré.")
      ;[keys.profiles, keys.projects, keys.tasks].forEach((queryKey) => queryClient.invalidateQueries({ queryKey }))
    })
  }

  return (
    <ul className="divide-y rounded-lg border">
      {profiles.map((member) => {
        const self = member.id === viewer.id
        return (
          <li key={member.id} className="flex flex-wrap items-center gap-3 px-3 py-2.5">
            <Assignee profile={member} size="md" />
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium">
                {member.full_name} {self && <span className="text-muted-foreground">(vous)</span>}
              </p>
              <p className="truncate text-xs text-muted-foreground">{member.email}</p>
            </div>
            {isOwner && !self ? (
              <>
                <NativeSelect
                  aria-label={`Rôle de ${member.full_name}`}
                  value={member.role}
                  onChange={(e) => updateProfile.mutate({ id: member.id, values: { role: e.target.value as Role } })}
                  className="w-40"
                >
                  {Object.entries(ROLE_LABELS).map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </NativeSelect>
                <Button variant="ghost" size="icon" aria-label={`Retirer ${member.full_name}`} disabled={pending} onClick={() => remove(member)}>
                  <Trash2 />
                </Button>
              </>
            ) : (
              <span className="text-xs font-medium text-muted-foreground">{ROLE_LABELS[member.role]}</span>
            )}
          </li>
        )
      })}
    </ul>
  )
}

function AddMemberForm() {
  const queryClient = useQueryClient()
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [pending, startTransition] = useTransition()

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const form = e.currentTarget
    const parsed = memberSchema.safeParse(Object.fromEntries(new FormData(form)))
    if (!parsed.success) return setErrors(fieldErrors(parsed.error))
    setErrors({})
    startTransition(async () => {
      const result = await createMember(parsed.data)
      if (!result.ok) {
        setErrors(result.fields ?? {})
        return void toast.error(result.error)
      }
      toast.success("Membre ajouté. Communiquez-lui son mot de passe provisoire.")
      form.reset()
      queryClient.invalidateQueries({ queryKey: keys.profiles })
    })
  }

  return (
    <form onSubmit={onSubmit} noValidate className="space-y-4 rounded-lg border bg-muted/40 p-4">
      <h3 className="flex items-center gap-2 text-sm font-semibold">
        <UserPlus className="size-4" aria-hidden /> Ajouter un membre
      </h3>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Nom complet" error={errors.full_name}>
          <Input name="full_name" maxLength={120} />
        </Field>
        <Field label="E-mail" error={errors.email}>
          <Input name="email" type="email" autoComplete="off" />
        </Field>
        <Field label="Mot de passe provisoire" error={errors.password} hint="8 caractères minimum, à changer depuis « Mon profil ».">
          <Input name="password" type="text" autoComplete="new-password" />
        </Field>
        <Field label="Rôle">
          <NativeSelect name="role" defaultValue="collaborator">
            {Object.entries(ROLE_LABELS).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </NativeSelect>
        </Field>
      </div>
      <Button type="submit" disabled={pending}>
        {pending && <Loader2 className="animate-spin" />} Ajouter le membre
      </Button>
    </form>
  )
}

function AccessMatrix() {
  const { data: profiles = [] } = useProfiles()
  const { data: projects = [] } = useProjects()
  const setAccess = useSetProjectAccess()
  const collaborators = profiles.filter((p) => p.role === "collaborator")
  const live = projects.filter((p) => !p.archived_at)

  if (collaborators.length === 0)
    return <p className="text-sm text-muted-foreground">Ajoutez un collaborateur pour gérer ses accès. Les propriétaires accèdent à tous les projets.</p>
  if (live.length === 0) return <p className="text-sm text-muted-foreground">Aucun projet actif.</p>

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">Un collaborateur ne voit que les projets cochés. Les propriétaires accèdent à tout.</p>
      {collaborators.map((member) => (
        <fieldset key={member.id} className="rounded-lg border p-3">
          <legend className="px-1 text-sm font-medium">{member.full_name}</legend>
          <ul className="grid gap-1 sm:grid-cols-2">
            {live.map((project) => {
              const id = `access-${member.id}-${project.id}`
              return (
                <li key={project.id} className="flex items-center gap-2 px-1 py-1">
                  <Checkbox
                    id={id}
                    checked={project.member_ids.includes(member.id)}
                    onCheckedChange={(checked) =>
                      setAccess.mutate({ projectId: project.id, userId: member.id, granted: checked === true })
                    }
                  />
                  <label htmlFor={id} className="truncate text-sm">
                    {project.name}
                  </label>
                </li>
              )
            })}
          </ul>
        </fieldset>
      ))}
    </div>
  )
}

export function ProfileDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { viewer } = useDashboard()
  const { data: profiles = [] } = useProfiles()
  const current = profiles.find((p) => p.id === viewer.id) ?? viewer
  const updateProfile = useUpdateProfile()
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [savingPassword, setSavingPassword] = useState(false)

  function saveName(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const name = String(new FormData(e.currentTarget).get("full_name") ?? "").trim()
    if (!name) return setErrors({ full_name: "Le nom est obligatoire." })
    setErrors({})
    updateProfile.mutate({ id: viewer.id, values: { full_name: name.slice(0, 120) } })
  }

  async function savePassword(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const form = e.currentTarget
    const parsed = passwordSchema.safeParse(new FormData(form).get("password"))
    if (!parsed.success) return setErrors({ password: parsed.error.issues[0]!.message })
    setErrors({})
    setSavingPassword(true)
    const { error } = await getSupabase().auth.updateUser({ password: parsed.data })
    setSavingPassword(false)
    if (error) return void toast.error(error.code === "same_password" ? "Choisissez un mot de passe différent de l'actuel." : errorMessage(error))
    form.reset()
    toast.success("Mot de passe modifié.")
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Mon profil</DialogTitle>
          <DialogDescription>
            {current.email} · {ROLE_LABELS[current.role]}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={saveName} noValidate className="space-y-3">
          <Field label="Nom complet" error={errors.full_name}>
            <Input name="full_name" defaultValue={current.full_name} maxLength={120} />
          </Field>
          <Button type="submit" variant="secondary" disabled={updateProfile.isPending}>
            Enregistrer le nom
          </Button>
        </form>
        <form onSubmit={savePassword} noValidate className="space-y-3 border-t pt-4">
          <Field label="Nouveau mot de passe" error={errors.password}>
            <Input name="password" type="password" autoComplete="new-password" />
          </Field>
          <Button type="submit" variant="secondary" disabled={savingPassword}>
            {savingPassword && <Loader2 className="animate-spin" />} Changer le mot de passe
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  )
}
