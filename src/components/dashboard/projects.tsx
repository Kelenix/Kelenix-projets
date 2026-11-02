"use client"

import { FolderKanban, Plus, SearchIcon } from "lucide-react"
import { useMemo, useState } from "react"
import { EmptyState, ErrorState } from "@/components/empty-state"
import { NativeSelect } from "@/components/native-select"
import { ShowMore } from "@/components/show-more"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Skeleton } from "@/components/ui/skeleton"
import { normalize, PROJECT_STATUS_LABELS, type ProjectStatus } from "@/lib/domain"
import { useClients, useProfiles, useProjects, useTasks } from "@/lib/queries"
import { ProjectProgress } from "./project-progress"
import { ProjectWorkspace } from "./project-workspace"
import { useDashboard } from "./state"
import { Assignee, DueDate, ProjectStatusBadge } from "./tasks/task-meta"

export function ProjectsSection() {
  const { projectId } = useDashboard()
  return projectId ? <ProjectWorkspace projectId={projectId} /> : <ProjectList />
}

type StatusFilter = ProjectStatus | "all" | "archived"

function ProjectList() {
  const { navigate, isOwner, openDialog } = useDashboard()
  const projectsQuery = useProjects()
  const { data: clients = [] } = useClients()
  const { data: tasks = [] } = useTasks()
  const { data: profiles = [] } = useProfiles()
  const [query, setQuery] = useState("")
  const [status, setStatus] = useState<StatusFilter>("all")
  const [clientId, setClientId] = useState("")

  const clientNames = useMemo(() => new Map(clients.map((c) => [c.id, c.name])), [clients])
  const tasksByProject = useMemo(() => Map.groupBy(tasks, (t) => t.project_id), [tasks])
  const projects = useMemo(() => {
    const q = normalize(query.trim())
    return (projectsQuery.data ?? []).filter(
      (p) =>
        (status === "archived" ? !!p.archived_at : !p.archived_at && (status === "all" || p.status === status)) &&
        (!clientId || p.client_id === clientId) &&
        (!q || normalize(p.name).includes(q))
    )
  }, [projectsQuery.data, query, status, clientId])

  if (projectsQuery.isError) return <ErrorState onRetry={() => projectsQuery.refetch()} />

  const hasAny = (projectsQuery.data?.length ?? 0) > 0

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row">
        <div className="relative flex-1">
          <SearchIcon aria-hidden className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            type="search"
            aria-label="Rechercher un projet"
            placeholder="Rechercher un projet"
            className="pl-9"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>
        <NativeSelect aria-label="Filtrer par statut" value={status} onChange={(e) => setStatus(e.target.value as StatusFilter)} className="sm:w-52">
          <option value="all">Tous les statuts</option>
          {Object.entries(PROJECT_STATUS_LABELS).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
          <option value="archived">Archivés</option>
        </NativeSelect>
        <NativeSelect aria-label="Filtrer par client" value={clientId} onChange={(e) => setClientId(e.target.value)} className="sm:w-60">
          <option value="">Tous les clients</option>
          {clients.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </NativeSelect>
      </div>

      {projectsQuery.isPending ? (
        <div className="grid gap-3 md:grid-cols-2">
          <Skeleton className="h-32 rounded-xl" />
          <Skeleton className="h-32 rounded-xl" />
        </div>
      ) : !hasAny ? (
        <EmptyState
          icon={FolderKanban}
          title="Aucun projet"
          description={isOwner ? "Créez votre premier projet pour organiser vos tâches." : "Vous n'avez encore accès à aucun projet."}
          action={
            isOwner && (
              <Button onClick={() => openDialog({ type: "project" })}>
                <Plus aria-hidden /> Nouveau projet
              </Button>
            )
          }
        />
      ) : projects.length === 0 ? (
        <p className="rounded-xl border border-dashed bg-card/60 px-6 py-10 text-center text-sm text-muted-foreground">
          Aucun projet ne correspond à ces critères.
        </p>
      ) : (
        <div className="space-y-3">
          <p className="text-sm text-muted-foreground">
            {projects.length} projet{projects.length > 1 ? "s" : ""}
          </p>
          <ShowMore key={`${status}-${clientId}-${query}`} items={projects} pageSize={24}>
            {(visible) => (
              <ul className="grid gap-3 md:grid-cols-2">
                {visible.map((project) => (
                  <li key={project.id}>
                    <button
                      type="button"
                      onClick={() => navigate({ projectId: project.id })}
                      className="flex h-full w-full flex-col gap-3 rounded-xl border bg-card p-4 text-left shadow-xs transition hover:border-primary/40 hover:shadow-md focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
                    >
                      <div className="flex w-full items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="truncate font-medium">{project.name}</p>
                          <p className="truncate text-xs text-muted-foreground">
                            {(project.client_id && clientNames.get(project.client_id)) || "Sans client"}
                          </p>
                        </div>
                        <ProjectStatusBadge status={project.status} />
                      </div>
                      <div className="mt-auto w-full space-y-2">
                        <ProjectProgress tasks={tasksByProject.get(project.id) ?? []} />
                        <div className="flex items-center justify-between gap-3">
                          {project.due_date ? (
                            <DueDate task={{ due_date: project.due_date, status: project.status === "done" ? "done" : "todo" }} />
                          ) : (
                            <span />
                          )}
                          <ul aria-label="Membres du projet" className="flex -space-x-1.5">
                            {profiles
                              .filter((p) => project.member_ids.includes(p.id))
                              .map((p) => (
                                <li key={p.id} className="rounded-full ring-2 ring-card">
                                  <Assignee profile={p} />
                                </li>
                              ))}
                          </ul>
                        </div>
                      </div>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </ShowMore>
        </div>
      )}
    </div>
  )
}
