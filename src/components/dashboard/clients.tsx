"use client"

import { Building2, Mail, Plus, Users } from "lucide-react"
import { useMemo } from "react"
import { EmptyState, ErrorState } from "@/components/empty-state"
import { ShowMore } from "@/components/show-more"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { useClients, useProjects } from "@/lib/queries"
import { useDashboard } from "./state"
import { ProjectStatusBadge } from "./tasks/task-meta"

export function ClientsSection() {
  const { isOwner, openDialog, navigate } = useDashboard()
  const clientsQuery = useClients()
  const { data: projects = [] } = useProjects()
  const projectsByClient = useMemo(() => Map.groupBy(projects, (p) => p.client_id ?? ""), [projects])

  if (clientsQuery.isError) return <ErrorState onRetry={() => clientsQuery.refetch()} />
  if (clientsQuery.isPending) return <Skeleton className="h-48 rounded-xl" />

  const clients = clientsQuery.data
  if (clients.length === 0)
    return (
      <EmptyState
        icon={Users}
        title="Aucun client"
        description={isOwner ? "Ajoutez vos clients pour les associer à vos projets." : "Aucun client n'est associé à vos projets."}
        action={
          isOwner && (
            <Button onClick={() => openDialog({ type: "client" })}>
              <Plus aria-hidden /> Nouveau client
            </Button>
          )
        }
      />
    )

  return (
    <div className="space-y-3">
      <ShowMore items={clients} pageSize={24}>
        {(visible) => (
          <ul className="grid gap-3 md:grid-cols-2">
            {visible.map((client) => {
              const related = projectsByClient.get(client.id) ?? []
              return (
                <li key={client.id} className="flex flex-col gap-3 rounded-xl border bg-card p-4 shadow-xs">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 space-y-1">
                      <p className="truncate font-medium">{client.name}</p>
                      {client.company && (
                        <p className="flex items-center gap-1.5 truncate text-sm text-muted-foreground">
                          <Building2 className="size-3.5" aria-hidden /> {client.company}
                        </p>
                      )}
                      {client.email && (
                        <a href={`mailto:${client.email}`} className="flex items-center gap-1.5 truncate text-sm text-primary hover:underline">
                          <Mail className="size-3.5" aria-hidden /> {client.email}
                        </a>
                      )}
                    </div>
                    {isOwner && (
                      <Button variant="outline" size="sm" onClick={() => openDialog({ type: "client", client })}>
                        Modifier
                      </Button>
                    )}
                  </div>
                  {client.notes && <p className="line-clamp-3 text-sm whitespace-pre-wrap text-muted-foreground">{client.notes}</p>}
                  <div className="border-t pt-3">
                    <p className="mb-2 text-xs font-medium text-muted-foreground uppercase">Projets associés ({related.length})</p>
                    {related.length === 0 ? (
                      <p className="text-sm text-muted-foreground">Aucun projet.</p>
                    ) : (
                      <ul className="space-y-1">
                        {related.map((p) => (
                          <li key={p.id}>
                            <button
                              type="button"
                              onClick={() => navigate({ section: "projects", projectId: p.id })}
                              className="flex w-full items-center justify-between gap-2 rounded-md px-2 py-1 text-left text-sm hover:bg-muted"
                            >
                              <span className="truncate">{p.name}</span>
                              <ProjectStatusBadge status={p.status} />
                            </button>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                </li>
              )
            })}
          </ul>
        )}
      </ShowMore>
    </div>
  )
}
