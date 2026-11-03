"use client"

import { useMemo } from "react"
import { ErrorState } from "@/components/empty-state"
import { Skeleton } from "@/components/ui/skeleton"
import { isAssigned } from "@/lib/domain"
import { useProjects, useTasks } from "@/lib/queries"
import { useDashboard } from "./state"
import { TaskViews } from "./tasks/task-views"

export function MyTasksSection() {
  const { viewer } = useDashboard()
  const tasksQuery = useTasks()
  const { data: projects = [] } = useProjects()

  const projectNames = useMemo(() => new Map(projects.map((p) => [p.id, p.name])), [projects])
  const mine = useMemo(() => {
    const archived = new Set(projects.filter((p) => p.archived_at).map((p) => p.id))
    return (tasksQuery.data ?? []).filter((t) => isAssigned(t, viewer.id) && !archived.has(t.project_id))
  }, [tasksQuery.data, projects, viewer.id])

  if (tasksQuery.isError) return <ErrorState onRetry={() => tasksQuery.refetch()} />
  if (tasksQuery.isPending) return <Skeleton className="h-64 rounded-xl" />

  return (
    <TaskViews
      tasks={mine}
      projectNames={projectNames}
      emptyDescription="Aucune tâche ne vous est attribuée pour le moment."
    />
  )
}
