"use client"

import { CircleAlert, FolderKanban, ListTodo, SquareCheck } from "lucide-react"
import { useMemo } from "react"
import { EmptyState, ErrorState } from "@/components/empty-state"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { compareByDueDate, isAssigned, isOverdue, type Task } from "@/lib/domain"
import { useProjects, useTasks } from "@/lib/queries"
import { cn } from "@/lib/utils"
import { ProjectProgress } from "./project-progress"
import { useDashboard } from "./state"
import { ChecklistProgress } from "./tasks/inline-checklist"
import { BlockedBadge, DueDate, PriorityBadge } from "./tasks/task-meta"

// La vue d'ensemble reste courte : les projets aux échéances les plus proches, le reste dans « Projets ».
const ACTIVE_PREVIEW = 6

export function OverviewSection() {
  const { viewer, navigate } = useDashboard()
  const projectsQuery = useProjects()
  const tasksQuery = useTasks()

  const data = useMemo(() => {
    const projects = projectsQuery.data ?? []
    const live = new Set(projects.filter((p) => !p.archived_at).map((p) => p.id))
    const tasks = (tasksQuery.data ?? []).filter((t) => live.has(t.project_id))
    // Échéance la plus proche d'abord (sans échéance en dernier).
    const activeProjects = projects
      .filter((p) => !p.archived_at && p.status === "in_progress")
      .sort((a, b) => (a.due_date ?? "9999").localeCompare(b.due_date ?? "9999"))
    return {
      activeProjects,
      tasksByProject: Map.groupBy(tasks, (t) => t.project_id),
      inProgress: tasks.filter((t) => t.status === "in_progress").length,
      late: tasks.filter((t) => isOverdue(t)).length,
      myNext: tasks.filter((t) => isAssigned(t, viewer.id) && t.status !== "done").sort(compareByDueDate).slice(0, 8),
      names: new Map(projects.map((p) => [p.id, p.name])),
    }
  }, [projectsQuery.data, tasksQuery.data, viewer.id])

  if (projectsQuery.isError || tasksQuery.isError)
    return <ErrorState onRetry={() => (projectsQuery.refetch(), tasksQuery.refetch())} />

  const loading = projectsQuery.isPending || tasksQuery.isPending

  return (
    <div className="space-y-8">
      <div className="grid gap-4 sm:grid-cols-3">
        <Stat label="Projets actifs" value={data.activeProjects.length} icon={FolderKanban} loading={loading} />
        <Stat label="Tâches en cours" value={data.inProgress} icon={ListTodo} loading={loading} />
        <Stat label="Tâches en retard" value={data.late} icon={CircleAlert} loading={loading} alert={data.late > 0} />
      </div>

      <div className="grid gap-8 lg:grid-cols-5">
        <section className="lg:col-span-3" aria-labelledby="active-projects">
          <h2 id="active-projects" className="mb-3 text-base font-semibold">Projets actifs</h2>
          {loading ? (
            <Skeleton className="h-40 rounded-xl" />
          ) : data.activeProjects.length === 0 ? (
            <EmptyState icon={FolderKanban} title="Aucun projet en cours" description="Les projets au statut « En cours » apparaissent ici." />
          ) : (
            <ul className="space-y-3">
              {data.activeProjects.slice(0, ACTIVE_PREVIEW).map((project) => (
                <li key={project.id}>
                  <button
                    type="button"
                    onClick={() => navigate({ section: "projects", projectId: project.id })}
                    className="block w-full rounded-xl border bg-card p-4 text-left shadow-xs transition hover:border-primary/40 hover:shadow-md focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
                  >
                    <div className="mb-3 flex items-center justify-between gap-3">
                      <span className="truncate font-medium">{project.name}</span>
                      {project.due_date && <DueDate task={{ due_date: project.due_date, status: "todo" }} />}
                    </div>
                    <ProjectProgress tasks={data.tasksByProject.get(project.id) ?? []} />
                  </button>
                </li>
              ))}
              {data.activeProjects.length > ACTIVE_PREVIEW && (
                <li>
                  <Button variant="outline" className="w-full" onClick={() => navigate({ section: "projects" })}>
                    Voir les {data.activeProjects.length} projets actifs
                  </Button>
                </li>
              )}
            </ul>
          )}
        </section>

        <section className="lg:col-span-2" aria-labelledby="my-next-tasks">
          <h2 id="my-next-tasks" className="mb-3 text-base font-semibold">Mes prochaines tâches</h2>
          {loading ? (
            <Skeleton className="h-40 rounded-xl" />
          ) : data.myNext.length === 0 ? (
            <EmptyState icon={SquareCheck} title="Rien à faire pour l'instant" description="Les tâches qui vous sont attribuées apparaîtront ici." />
          ) : (
            <ul className="divide-y overflow-hidden rounded-xl border bg-card">
              {data.myNext.map((task) => (
                <NextTask key={task.id} task={task} projectName={data.names.get(task.project_id)} />
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  )
}

function NextTask({ task, projectName }: { task: Task; projectName?: string }) {
  const { navigate } = useDashboard()
  return (
    <li>
      <button
        type="button"
        onClick={() => navigate({ taskId: task.id })}
        className="flex w-full flex-col gap-1.5 px-4 py-3 text-left hover:bg-muted/60 focus-visible:bg-muted focus-visible:outline-none"
      >
        <span className="truncate text-sm font-medium">{task.title}</span>
        <span className="flex flex-wrap items-center gap-2">
          <span className="truncate text-xs text-muted-foreground">{projectName}</span>
          <PriorityBadge priority={task.priority} />
          {task.is_blocked && <BlockedBadge />}
          <DueDate task={task} />
          <ChecklistProgress task={task} />
        </span>
      </button>
    </li>
  )
}

function Stat({
  label,
  value,
  icon: Icon,
  loading,
  alert,
}: {
  label: string
  value: number
  icon: typeof FolderKanban
  loading: boolean
  alert?: boolean
}) {
  return (
    <div className="flex items-center gap-4 rounded-xl border bg-card p-4 shadow-xs">
      <span
        className={cn(
          "grid size-10 place-items-center rounded-lg",
          alert ? "bg-destructive/10 text-destructive" : "bg-accent text-accent-foreground"
        )}
      >
        <Icon className="size-5" aria-hidden />
      </span>
      <div>
        <p className="text-sm text-muted-foreground">{label}</p>
        {loading ? <Skeleton className="mt-1 h-7 w-10" /> : <p className="text-2xl font-semibold tabular-nums">{value}</p>}
      </div>
    </div>
  )
}
