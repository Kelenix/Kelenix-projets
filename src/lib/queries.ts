"use client"

import { useMutation, useQuery, useQueryClient, type QueryKey } from "@tanstack/react-query"
import { toast } from "sonner"
import type { TablesInsert, TablesUpdate } from "@/lib/database.types"
import type { Client, PauseReason, Profile, Project, Task } from "@/lib/domain"
import { getSupabase } from "@/lib/supabase/client"

type PgError = { code?: string; message: string }

/** Message d'erreur compréhensible à partir d'une erreur Supabase/Postgres. */
export function errorMessage(error: unknown) {
  const { code, message } = (error ?? {}) as PgError
  if (code === "42501") return "Vous n'avez pas les droits pour cette action."
  if (code === "P0001") return message
  if (code === "23514" || code === "22P02") return "Certaines informations sont invalides."
  if (message?.includes("Failed to fetch")) return "Connexion au serveur impossible. Réessayez."
  return message || "Une erreur inattendue est survenue."
}

function unwrap<T>({ data, error }: { data: T; error: PgError | null }) {
  if (error) throw error
  return data as NonNullable<T>
}

const PAGE_SIZE = 1000 // limite de lignes par requête côté API (max_rows)

/** Charge toutes les lignes, page par page, pour ne jamais tronquer une liste au-delà de la limite. */
async function fetchAll<T>(page: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: PgError | null }>) {
  const rows: T[] = []
  for (let from = 0; ; from += PAGE_SIZE) {
    const batch = unwrap(await page(from, from + PAGE_SIZE - 1))
    rows.push(...batch)
    if (batch.length < PAGE_SIZE) return rows
  }
}

export const keys = {
  profiles: ["profiles"] as const,
  clients: ["clients"] as const,
  projects: ["projects"] as const,
  tasks: ["tasks"] as const,
  taskDetails: (id: string) => ["task-details", id] as const,
}

export function useProfiles() {
  return useQuery({
    queryKey: keys.profiles,
    queryFn: async (): Promise<Profile[]> =>
      unwrap(await getSupabase().from("profiles").select("*").order("full_name")),
  })
}

export function useClients() {
  return useQuery({
    queryKey: keys.clients,
    queryFn: async (): Promise<Client[]> =>
      fetchAll((from, to) => getSupabase().from("clients").select("*").order("name").order("id").range(from, to)),
  })
}

export function useProjects() {
  return useQuery({
    queryKey: keys.projects,
    queryFn: async (): Promise<Project[]> => {
      const rows = await fetchAll((from, to) =>
        getSupabase()
          .from("projects")
          .select("*, project_members(user_id)")
          .order("created_at", { ascending: false })
          .order("id")
          .range(from, to)
      )
      return rows.map(({ project_members, ...project }) => ({
        ...project,
        member_ids: project_members.map((m) => m.user_id),
      }))
    },
  })
}

export function useTasks() {
  return useQuery({
    queryKey: keys.tasks,
    queryFn: async (): Promise<Task[]> => {
      const rows = await fetchAll((from, to) =>
        getSupabase()
          .from("tasks")
          .select("*, task_checklist_items(id, label, done), time_entries(id, user_id, started_at, ended_at, kind, description, source, edited_at, pause_reason)")
          .order("created_at")
          .order("id")
          .order("created_at", { referencedTable: "task_checklist_items" })
          .range(from, to)
      )
      return rows.map(({ task_checklist_items, ...task }) => ({ ...task, checklist: task_checklist_items }))
    },
  })
}

export function useTaskDetails(taskId: string | null) {
  return useQuery({
    queryKey: keys.taskDetails(taskId ?? ""),
    enabled: !!taskId,
    queryFn: async () => {
      const supabase = getSupabase()
      const [comments, links] = await Promise.all([
        supabase.from("task_comments").select("*").eq("task_id", taskId!).order("created_at"),
        supabase.from("task_links").select("*").eq("task_id", taskId!).order("created_at"),
      ])
      return { comments: unwrap(comments), links: unwrap(links) }
    },
  })
}

/** Mutation qui invalide les requêtes concernées et signale les erreurs. */
function useAction<TVars, TResult = unknown>(
  fn: (vars: TVars) => Promise<TResult>,
  invalidate: (vars: TVars) => QueryKey[],
  success?: string
) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: fn,
    onSuccess: (_data, vars) => {
      invalidate(vars).forEach((queryKey) => queryClient.invalidateQueries({ queryKey }))
      if (success) toast.success(success)
    },
    onError: (error) => toast.error(errorMessage(error)),
  })
}

// ─── Clients ────────────────────────────────────────────────────────────────
export function useSaveClient() {
  return useAction(
    async ({ id, values }: { id?: string; values: TablesInsert<"clients"> }) => {
      const table = getSupabase().from("clients")
      return unwrap(await (id ? table.update(values).eq("id", id) : table.insert(values)).select().single())
    },
    () => [keys.clients],
    "Client enregistré."
  )
}

export function useDeleteClient() {
  return useAction(
    async (id: string) => unwrap(await getSupabase().from("clients").delete().eq("id", id)),
    () => [keys.clients, keys.projects],
    "Client supprimé."
  )
}

// ─── Projets ────────────────────────────────────────────────────────────────
export function useSaveProject() {
  return useAction(
    async ({ id, values, memberIds }: { id?: string; values: TablesInsert<"projects">; memberIds: string[] }) => {
      const supabase = getSupabase()
      const table = supabase.from("projects")
      const project = unwrap(await (id ? table.update(values).eq("id", id) : table.insert(values)).select().single())

      const current = unwrap(await supabase.from("project_members").select("user_id").eq("project_id", project.id))
      const currentIds = current.map((m) => m.user_id)
      const toAdd = memberIds.filter((uid) => !currentIds.includes(uid))
      const toRemove = currentIds.filter((uid) => !memberIds.includes(uid))
      if (toAdd.length)
        unwrap(await supabase.from("project_members").insert(toAdd.map((user_id) => ({ project_id: project.id, user_id }))))
      if (toRemove.length)
        unwrap(await supabase.from("project_members").delete().eq("project_id", project.id).in("user_id", toRemove))
      return project
    },
    () => [keys.projects, keys.tasks],
    "Projet enregistré."
  )
}

export function useUpdateProject() {
  return useAction(
    async ({ id, values }: { id: string; values: TablesUpdate<"projects"> }) =>
      unwrap(await getSupabase().from("projects").update(values).eq("id", id)),
    () => [keys.projects]
  )
}

/** Accès d'un membre à un projet, mis à jour de façon optimiste (cases à cocher). */
export function useSetProjectAccess() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ projectId, userId, granted }: { projectId: string; userId: string; granted: boolean }) => {
      const table = getSupabase().from("project_members")
      return unwrap(
        await (granted
          ? table.insert({ project_id: projectId, user_id: userId })
          : table.delete().eq("project_id", projectId).eq("user_id", userId))
      )
    },
    onMutate: async ({ projectId, userId, granted }) => {
      await queryClient.cancelQueries({ queryKey: keys.projects })
      const previous = queryClient.getQueryData<Project[]>(keys.projects)
      queryClient.setQueryData<Project[]>(keys.projects, (projects) =>
        projects?.map((p) =>
          p.id !== projectId
            ? p
            : { ...p, member_ids: granted ? [...p.member_ids, userId] : p.member_ids.filter((id) => id !== userId) }
        )
      )
      return { previous }
    },
    onError: (error, _vars, context) => {
      queryClient.setQueryData(keys.projects, context?.previous)
      toast.error(errorMessage(error))
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: keys.projects })
      queryClient.invalidateQueries({ queryKey: keys.tasks })
    },
  })
}

// ─── Tâches ─────────────────────────────────────────────────────────────────
export function useCreateTask() {
  return useAction(
    async (values: TablesInsert<"tasks">) =>
      unwrap(await getSupabase().from("tasks").insert(values).select().single()),
    () => [keys.tasks],
    "Tâche créée."
  )
}

/** Mise à jour optimiste : le Kanban et les compteurs réagissent immédiatement. */
export function useUpdateTask() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, values }: { id: string; values: TablesUpdate<"tasks"> }) =>
      unwrap(await getSupabase().from("tasks").update(values).eq("id", id).select().single()),
    onMutate: async ({ id, values }) => {
      await queryClient.cancelQueries({ queryKey: keys.tasks })
      const previous = queryClient.getQueryData<Task[]>(keys.tasks)
      queryClient.setQueryData<Task[]>(keys.tasks, (tasks) =>
        tasks?.map((t) => (t.id === id ? { ...t, ...values } : t))
      )
      return { previous }
    },
    onError: (error, _vars, context) => {
      queryClient.setQueryData(keys.tasks, context?.previous)
      toast.error(errorMessage(error))
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: keys.tasks }),
  })
}

export function useDeleteTask() {
  return useAction(
    async (id: string) => unwrap(await getSupabase().from("tasks").delete().eq("id", id)),
    () => [keys.tasks],
    "Tâche supprimée."
  )
}

type DetailTable = "task_checklist_items" | "task_comments" | "task_links"

export function useAddTaskItem<T extends DetailTable>(table: T, taskId: string) {
  return useAction(
    async (values: Omit<TablesInsert<T>, "task_id">) =>
      // Le générique T ne se résout pas côté client Supabase : les colonnes restent typées par l'appelant.
      unwrap(await getSupabase().from(table).insert({ ...values, task_id: taskId } as never)),
    () => [keys.taskDetails(taskId), keys.tasks]
  )
}

export type TimerAction =
  | { type: "start" | "resume" | "stop"; taskId: string }
  | { type: "pause"; taskId: string; reason: PauseReason }

/**
 * Chronomètre de l'utilisateur : démarrer, mettre en pause (temps de pause compté à part),
 * reprendre, terminer. Optimiste : une seule session ouverte par personne, comme en base.
 */
export function useTimer(userId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (action: TimerAction) => {
      const supabase = getSupabase()
      if (action.type === "start") return unwrap(await supabase.rpc("start_timer", { p_task_id: action.taskId }))
      if (action.type === "pause") return unwrap(await supabase.rpc("pause_timer", { p_reason: action.reason }))
      return unwrap(await supabase.rpc(action.type === "resume" ? "resume_timer" : "stop_timer"))
    },
    onMutate: async (action) => {
      await queryClient.cancelQueries({ queryKey: keys.tasks })
      const previous = queryClient.getQueryData<Task[]>(keys.tasks)
      const now = new Date().toISOString()
      const next = action.type === "start" || action.type === "resume" ? "work" : action.type === "pause" ? "pause" : null
      queryClient.setQueryData<Task[]>(keys.tasks, (tasks) =>
        tasks?.map((t) => {
          const entries = t.time_entries.map((e) => (e.user_id === userId && !e.ended_at ? { ...e, ended_at: now } : e))
          if (next && t.id === action.taskId)
            entries.push({
              user_id: userId,
              started_at: now,
              ended_at: null,
              kind: next,
              pause_reason: action.type === "pause" ? action.reason : null,
            })
          return { ...t, time_entries: entries }
        })
      )
      return { previous }
    },
    onError: (error, _vars, context) => {
      queryClient.setQueryData(keys.tasks, context?.previous)
      toast.error(errorMessage(error))
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: keys.tasks }),
  })
}

/** Coche / décoche un élément, de façon optimiste (cartes et panneau de détail). */
export function useToggleChecklistItem(taskId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, done }: { id: string; done: boolean }) =>
      unwrap(await getSupabase().from("task_checklist_items").update({ done }).eq("id", id)),
    onMutate: async ({ id, done }) => {
      await queryClient.cancelQueries({ queryKey: keys.tasks })
      const previous = queryClient.getQueryData<Task[]>(keys.tasks)
      queryClient.setQueryData<Task[]>(keys.tasks, (tasks) =>
        tasks?.map((t) =>
          t.id !== taskId ? t : { ...t, checklist: t.checklist.map((i) => (i.id === id ? { ...i, done } : i)) }
        )
      )
      return { previous }
    },
    onError: (error, _vars, context) => {
      queryClient.setQueryData(keys.tasks, context?.previous)
      toast.error(errorMessage(error))
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: keys.tasks })
      queryClient.invalidateQueries({ queryKey: keys.taskDetails(taskId) })
    },
  })
}

export function useDeleteTaskItem(table: DetailTable, taskId: string) {
  return useAction(
    async (id: string) => unwrap(await getSupabase().from(table).delete().eq("id", id)),
    () => [keys.taskDetails(taskId), keys.tasks]
  )
}

// ─── Profils ────────────────────────────────────────────────────────────────
export function useUpdateProfile() {
  return useAction(
    async ({ id, values }: { id: string; values: TablesUpdate<"profiles"> }) =>
      unwrap(await getSupabase().from("profiles").update(values).eq("id", id)),
    () => [keys.profiles],
    "Profil mis à jour."
  )
}

// ─── Sessions de temps : historique des modifications, ajout, correction, description ────
export const timeKeys = {
  changes: (scope: { projectId?: string; taskId?: string }) => ["time-changes", scope] as const,
}

/** Journal des modifications de sessions d'une tâche ou d'un projet. */
export function useTimeChanges(scope: { projectId?: string; taskId?: string }) {
  return useQuery({
    queryKey: timeKeys.changes(scope),
    queryFn: async () => {
      const base = getSupabase().from("time_entry_changes")
      const query = scope.taskId
        ? base.select("*").eq("task_id", scope.taskId)
        : base.select("*, tasks!inner(project_id)").eq("tasks.project_id", scope.projectId!)
      return unwrap(await query.order("changed_at", { ascending: false }))
    },
  })
}

function useTimeWrite<TVars>(fn: (vars: TVars) => Promise<unknown>, success: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: fn,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: keys.tasks })
      queryClient.invalidateQueries({ queryKey: ["time-changes"] })
      toast.success(success)
    },
    onError: (error) => toast.error(errorMessage(error)),
  })
}

/** Heures oubliées, enregistrées au nom de l'utilisateur connecté. */
export function useLogTime() {
  return useTimeWrite(
    async (v: { taskId: string; startedAt: string; endedAt: string; description: string | null }) =>
      unwrap(
        await getSupabase().rpc("log_time", {
          p_task_id: v.taskId,
          p_started_at: v.startedAt,
          p_ended_at: v.endedAt,
          p_description: v.description ?? "",
        })
      ),
    "Temps ajouté."
  )
}

/** Correction d'une session : la justification et l'ancienne plage sont conservées. */
export function useEditTimeEntry() {
  return useTimeWrite(
    async (v: { id: string; startedAt: string; endedAt: string; reason: string }) =>
      unwrap(
        await getSupabase().rpc("edit_time_entry", {
          p_id: v.id,
          p_started_at: v.startedAt,
          p_ended_at: v.endedAt,
          p_reason: v.reason,
        })
      ),
    "Session modifiée."
  )
}

/** Description du travail réalisé pendant une session. */
export function useSetTimeDescription() {
  return useTimeWrite(
    async (v: { id: string; description: string }) =>
      unwrap(await getSupabase().rpc("set_time_entry_description", { p_id: v.id, p_description: v.description })),
    "Description enregistrée."
  )
}

/** Motif d'une pause (corrigeable après coup). */
export function useSetPauseReason() {
  return useTimeWrite(
    async (v: { id: string; reason: PauseReason }) =>
      unwrap(await getSupabase().rpc("set_pause_reason", { p_id: v.id, p_reason: v.reason })),
    "Motif de pause enregistré."
  )
}
