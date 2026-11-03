"use client"

import { Archive, ArchiveRestore, ArrowLeft, CheckCircle2, FolderX, Pencil, Plus } from "lucide-react"
import { useMemo } from "react"
import { useConfirm } from "@/components/confirm"
import { EmptyState } from "@/components/empty-state"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { formatDate, type Project, type Task } from "@/lib/domain"
import { useClients, useProfiles, useProjects, useTasks, useUpdateProject } from "@/lib/queries"
import { ProjectProgress } from "./project-progress"
import { useDashboard } from "./state"
import { Assignee, ProjectStatusBadge } from "./tasks/task-meta"
import { TaskViews } from "./tasks/task-views"
import { ProjectTime } from "./time-sessions"

/** Demande confirmation avant la clôture si des tâches restent ouvertes. */
export function useConfirmClosure() {
  const confirm = useConfirm()
  return (project: Project, tasks: Task[]) => {
    const open = tasks.filter((t) => t.project_id === project.id && t.status !== "done").length
    return confirm({
      title: `Clôturer « ${project.name} » ?`,
      description:
        open > 0 ? (
          <p>
            <strong className="text-destructive">
              {open} {open > 1 ? "tâches sont encore ouvertes" : "tâche est encore ouverte"}.
            </strong>{" "}
            Le projet passera au statut « Terminé » ; les tâches restent consultables et modifiables.
          </p>
        ) : (
          "Toutes les tâches sont terminées. Le projet passera au statut « Terminé »."
        ),
      confirmLabel: "Clôturer le projet",
    })
  }
}

export function ProjectWorkspace({ projectId }: { projectId: string }) {
  const { navigate, isOwner, openDialog } = useDashboard()
  const { data: projects, isPending } = useProjects()
  const { data: allTasks = [] } = useTasks()
  const { data: profiles = [] } = useProfiles()
  const { data: clients = [] } = useClients()
  const updateProject = useUpdateProject()
  const confirmClosure = useConfirmClosure()

  const project = projects?.find((p) => p.id === projectId)
  const tasks = useMemo(() => allTasks.filter((t) => t.project_id === projectId), [allTasks, projectId])
  const back = () => navigate({ projectId: null, taskId: null })

  if (isPending) return <Skeleton className="h-64 rounded-xl" />
  if (!project)
    return (
      <EmptyState
        icon={FolderX}
        title="Projet introuvable"
        description="Ce projet n'existe plus ou vous n'y avez pas accès."
        action={<Button onClick={back}>Retour aux projets</Button>}
      />
    )

  const client = clients.find((c) => c.id === project.client_id)
  const members = profiles.filter((p) => project.member_ids.includes(p.id))
  const newTask = () => openDialog({ type: "task", projectId: project.id })

  async function close() {
    if (await confirmClosure(project!, tasks)) updateProject.mutate({ id: project!.id, values: { status: "done" } })
  }

  return (
    <div className="space-y-6">
      <Button variant="ghost" size="sm" onClick={back} className="-ml-2 text-muted-foreground">
        <ArrowLeft aria-hidden /> Tous les projets
      </Button>

      <section className="rounded-xl border bg-card p-5 shadow-xs" aria-label="Résumé du projet">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="min-w-0 space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-xl font-semibold tracking-tight">{project.name}</h2>
              <ProjectStatusBadge status={project.status} />
              {project.archived_at && <span className="text-xs font-medium text-muted-foreground">Archivé</span>}
            </div>
            <dl className="flex flex-wrap gap-x-6 gap-y-1 text-sm">
              <div className="flex gap-1.5">
                <dt className="text-muted-foreground">Client :</dt>
                <dd>{client?.name ?? "Aucun"}</dd>
              </div>
              <div className="flex gap-1.5">
                <dt className="text-muted-foreground">Échéance :</dt>
                <dd>{formatDate(project.due_date) ?? "Aucune"}</dd>
              </div>
            </dl>
            {project.description && <p className="max-w-prose text-sm whitespace-pre-wrap text-muted-foreground">{project.description}</p>}
          </div>
          {isOwner && (
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" onClick={() => openDialog({ type: "project", project })}>
                <Pencil aria-hidden /> Modifier
              </Button>
              {project.status !== "done" && (
                <Button variant="outline" onClick={close}>
                  <CheckCircle2 aria-hidden /> Clôturer
                </Button>
              )}
              <Button
                variant="outline"
                onClick={() =>
                  updateProject.mutate({
                    id: project.id,
                    values: { archived_at: project.archived_at ? null : new Date().toISOString() },
                  })
                }
              >
                {project.archived_at ? <ArchiveRestore aria-hidden /> : <Archive aria-hidden />}
                {project.archived_at ? "Désarchiver" : "Archiver"}
              </Button>
            </div>
          )}
        </div>

        <div className="mt-5 grid gap-5 border-t pt-5 sm:grid-cols-2">
          <div>
            <h3 className="mb-2 text-sm font-semibold">Avancement</h3>
            <ProjectProgress tasks={tasks} />
          </div>
          <div>
            <h3 className="mb-2 text-sm font-semibold">Membres ({members.length})</h3>
            <ul className="flex flex-wrap gap-2">
              {members.map((m) => (
                <li key={m.id} className="flex items-center gap-2 rounded-full border bg-background py-0.5 pr-3 pl-0.5 text-sm">
                  <Assignee profile={m} />
                  {m.full_name}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      <section aria-labelledby="project-tasks" className="space-y-3">
        <div className="flex items-center justify-between gap-3">
          <h2 id="project-tasks" className="text-base font-semibold">Tâches</h2>
          {tasks.length > 0 && (
            <Button variant="secondary" size="sm" onClick={newTask}>
              <Plus aria-hidden /> Ajouter une tâche
            </Button>
          )}
        </div>
        <TaskViews
          tasks={tasks}
          emptyAction={
            <Button onClick={newTask}>
              <Plus aria-hidden /> Ajouter une tâche
            </Button>
          }
        />
      </section>

      <ProjectTime projectId={project.id} tasks={tasks} profiles={profiles} />
    </div>
  )
}
