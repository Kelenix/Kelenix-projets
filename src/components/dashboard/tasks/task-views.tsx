"use client"

import { CalendarDays, Columns3, List, SquareCheck } from "lucide-react"
import { useMemo, useState, type ReactNode } from "react"
import { EmptyState } from "@/components/empty-state"
import { NativeSelect } from "@/components/native-select"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { compareByDueDate, isOverdue, type Task } from "@/lib/domain"
import { useProfiles, useTags } from "@/lib/queries"
import { useDashboard } from "../state"
import { TaskBoard } from "./task-board"
import { TaskCalendar } from "./task-calendar"
import { TaskList } from "./task-list"

type Filter = "all" | "late" | "blocked"

/** Bascule Kanban / Liste / Calendrier, avec filtres retard / bloquées et par tag. */
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
  const [view, setView] = useState<"board" | "list" | "calendar">("board")
  const [filter, setFilter] = useState<Filter>("all")
  const [tagId, setTagId] = useState("")
  const { data: tags = [] } = useTags()

  const profileMap = useMemo(() => new Map(profiles.map((p) => [p.id, p])), [profiles])
  const visible = useMemo(
    () =>
      tasks
        .filter((t) => filter === "all" || (filter === "late" ? isOverdue(t) : t.is_blocked))
        .filter((t) => !tagId || t.tag_ids.includes(tagId))
        .sort(compareByDueDate),
    [tasks, filter, tagId],
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
        <Tabs value={view} onValueChange={(v) => setView(v as "board" | "list" | "calendar")}>
          <TabsList aria-label="Affichage des tâches">
            <TabsTrigger value="board">
              <Columns3 aria-hidden /> Kanban
            </TabsTrigger>
            <TabsTrigger value="list">
              <List aria-hidden /> Liste
            </TabsTrigger>
            <TabsTrigger value="calendar">
              <CalendarDays aria-hidden /> Calendrier
            </TabsTrigger>
          </TabsList>
        </Tabs>
        <div className="flex flex-wrap gap-2">
          {tags.length > 0 && (
            <NativeSelect aria-label="Filtrer par tag" value={tagId} onChange={(e) => setTagId(e.target.value)} className="w-48">
              <option value="">Tous les tags</option>
              {tags.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </NativeSelect>
          )}
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
      </div>
      {visible.length === 0 ? (
        <p className="rounded-xl border border-dashed bg-card/60 px-6 py-10 text-center text-sm text-muted-foreground">
          Aucune tâche ne correspond à ce filtre.
        </p>
      ) : view === "calendar" ? (
        <TaskCalendar tasks={visible} profiles={profileMap} onOpen={open} />
      ) : view === "board" ? (
        <TaskBoard tasks={visible} profiles={profileMap} projectNames={projectNames} onOpen={open} />
      ) : (
        <TaskList tasks={visible} profiles={profileMap} projectNames={projectNames} onOpen={open} />
      )}
    </div>
  )
}
