"use client"

import { Columns3, List, SquareCheck } from "lucide-react"
import { useMemo, useState, type ReactNode } from "react"
import { EmptyState } from "@/components/empty-state"
import { NativeSelect } from "@/components/native-select"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { compareByDueDate, isOverdue, type Task } from "@/lib/domain"
import { useProfiles } from "@/lib/queries"
import { useDashboard } from "../state"
import { TaskBoard } from "./task-board"
import { TaskList } from "./task-list"

type Filter = "all" | "late" | "blocked"

/** Bascule Kanban / Liste avec filtre retard / bloquées. */
export function TaskViews({
  tasks,
  projectNames,
  emptyAction,
  emptyDescription,
}: {
  tasks: Task[]
  projectNames?: Map<string, string>
  emptyAction?: ReactNode
  emptyDescription?: string
}) {
  const { navigate } = useDashboard()
  const { data: profiles = [] } = useProfiles()
  const [view, setView] = useState<"board" | "list">("board")
  const [filter, setFilter] = useState<Filter>("all")

  const profileMap = useMemo(() => new Map(profiles.map((p) => [p.id, p])), [profiles])
  const visible = useMemo(
    () =>
      tasks
        .filter((t) => filter === "all" || (filter === "late" ? isOverdue(t) : t.is_blocked))
        .sort(compareByDueDate),
    [tasks, filter]
  )
  const open = (taskId: string) => navigate({ taskId })

  if (tasks.length === 0)
    return (
      <EmptyState
        icon={SquareCheck}
        title="Aucune tâche"
        description={emptyDescription ?? "Ajoutez une première tâche pour suivre l'avancement."}
        action={emptyAction}
      />
    )

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Tabs value={view} onValueChange={(v) => setView(v as "board" | "list")}>
          <TabsList aria-label="Affichage des tâches">
            <TabsTrigger value="board">
              <Columns3 aria-hidden /> Kanban
            </TabsTrigger>
            <TabsTrigger value="list">
              <List aria-hidden /> Liste
            </TabsTrigger>
          </TabsList>
        </Tabs>
        <NativeSelect
          aria-label="Filtrer les tâches"
          value={filter}
          onChange={(e) => setFilter(e.target.value as Filter)}
          className="w-56"
        >
          <option value="all">Toutes les tâches</option>
          <option value="late">En retard</option>
          <option value="blocked">Bloquées</option>
        </NativeSelect>
      </div>
      {visible.length === 0 ? (
        <p className="rounded-xl border border-dashed bg-card/60 px-6 py-10 text-center text-sm text-muted-foreground">
          Aucune tâche ne correspond à ce filtre.
        </p>
      ) : view === "board" ? (
        <TaskBoard tasks={visible} profiles={profileMap} projectNames={projectNames} onOpen={open} />
      ) : (
        <TaskList tasks={visible} profiles={profileMap} projectNames={projectNames} onOpen={open} />
      )}
    </div>
  )
}
