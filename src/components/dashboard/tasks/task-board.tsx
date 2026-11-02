"use client"

import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
  TouchSensor,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
  type Announcements,
  type DragEndEvent,
  type KeyboardCoordinateGetter,
} from "@dnd-kit/core"
import { useState } from "react"
import { TASK_STATUS_LABELS, TASK_STATUSES, type Profile, type Task, type TaskStatus } from "@/lib/domain"
import { useUpdateTask } from "@/lib/queries"
import { cn } from "@/lib/utils"
import { ShowMore } from "@/components/show-more"
import { STATUS_FILL } from "../charts"
import { TaskCard } from "./task-card"

type BoardProps = {
  tasks: Task[]
  profiles: Map<string, Profile>
  projectNames?: Map<string, string>
  onOpen: (taskId: string) => void
}

// Flèches gauche/droite : passer d'une colonne à l'autre au clavier.
const columnJump: KeyboardCoordinateGetter = (event, { context: { collisionRect, droppableRects } }) => {
  const direction = event.code === "ArrowRight" ? 1 : event.code === "ArrowLeft" ? -1 : 0
  if (!direction || !collisionRect) return undefined
  event.preventDefault()
  const columns = TASK_STATUSES.map((status) => droppableRects.get(status)).filter((r) => r !== undefined)
  const centerX = collisionRect.left + collisionRect.width / 2
  const current = columns.findIndex((r) => centerX >= r.left && centerX <= r.left + r.width)
  const target = columns[Math.min(Math.max(current + direction, 0), columns.length - 1)]
  return target ? { x: target.left + (target.width - collisionRect.width) / 2, y: collisionRect.top } : undefined
}

export function TaskBoard({ tasks, profiles, projectNames, onOpen }: BoardProps) {
  const updateTask = useUpdateTask()
  const [activeId, setActiveId] = useState<string | null>(null)
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 250, tolerance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: columnJump })
  )
  const titleOf = (id: string | number) => tasks.find((t) => t.id === id)?.title ?? "La tâche"
  const columnOf = (id?: string | number) => (id ? TASK_STATUS_LABELS[id as TaskStatus] : "aucune colonne")
  const announcements: Announcements = {
    onDragStart: ({ active }) => `${titleOf(active.id)} saisie. Flèches gauche et droite pour changer de colonne, Espace pour déposer.`,
    onDragOver: ({ active, over }) => `${titleOf(active.id)} au-dessus de ${columnOf(over?.id)}.`,
    onDragEnd: ({ active, over }) => `${titleOf(active.id)} déposée dans ${columnOf(over?.id)}.`,
    onDragCancel: ({ active }) => `Déplacement de ${titleOf(active.id)} annulé.`,
  }

  function onDragEnd({ active, over }: DragEndEvent) {
    setActiveId(null)
    const task = tasks.find((t) => t.id === active.id)
    const status = over?.id as TaskStatus | undefined
    if (task && status && task.status !== status) updateTask.mutate({ id: task.id, values: { status } })
  }

  const activeTask = tasks.find((t) => t.id === activeId)

  return (
    <DndContext
      sensors={sensors}
      accessibility={{
        announcements,
        screenReaderInstructions: {
          draggable: "Appuyez sur Espace pour saisir la tâche, puis utilisez les flèches gauche et droite pour changer de colonne.",
        },
      }}
      onDragStart={({ active }) => setActiveId(String(active.id))}
      onDragCancel={() => setActiveId(null)}
      onDragEnd={onDragEnd}
    >
      <div className="-mx-4 flex snap-x snap-mandatory gap-4 overflow-x-auto px-4 pb-2 md:mx-0 md:grid md:grid-cols-2 md:overflow-visible md:px-0 xl:grid-cols-4">
        {TASK_STATUSES.map((status) => {
          const columnTasks = tasks.filter((t) => t.status === status)
          return (
            <Column key={status} status={status} count={columnTasks.length}>
              <ShowMore items={columnTasks} pageSize={25} buttonClassName="bg-card">
                {(visible) =>
                  visible.map((task) => (
                    <DraggableCard key={task.id} id={task.id} title={task.title}>
                      <TaskCard
                        task={task}
                        assignee={task.assignee_id ? profiles.get(task.assignee_id) : undefined}
                        profiles={profiles}
                        projectName={projectNames?.get(task.project_id)}
                        onOpen={() => onOpen(task.id)}
                      />
                    </DraggableCard>
                  ))
                }
              </ShowMore>
            </Column>
          )
        })}
      </div>
      <DragOverlay dropAnimation={null}>
        {activeTask && (
          <TaskCard
            task={activeTask}
            assignee={activeTask.assignee_id ? profiles.get(activeTask.assignee_id) : undefined}
            profiles={profiles}
            onOpen={() => undefined}
            className="rotate-2 shadow-lg"
          />
        )}
      </DragOverlay>
    </DndContext>
  )
}

// Colonnes neutres : la couleur du statut est portée par le liseré, la pastille et les cartes.
const COLUMN_STYLES: Record<TaskStatus, string> = {
  todo: "border-t-series-todo",
  in_progress: "border-t-series-progress",
  rescheduled: "border-t-series-rescheduled",
  done: "border-t-series-done",
}

function Column({ status, count, children }: { status: TaskStatus; count: number; children: React.ReactNode }) {
  const { setNodeRef, isOver } = useDroppable({ id: status })
  return (
    <section
      ref={setNodeRef}
      aria-label={`${TASK_STATUS_LABELS[status]} (${count})`}
      className={cn(
        "flex w-[82vw] shrink-0 snap-start flex-col rounded-xl border-t-4 bg-muted/60 p-3 transition-colors sm:w-80 md:w-auto",
        COLUMN_STYLES[status],
        isOver && "bg-accent ring-2 ring-primary/30"
      )}
    >
      <h3 className="mb-3 flex items-center gap-2 px-1 text-sm font-semibold">
        <span aria-hidden className={cn("size-2.5 rounded-full", STATUS_FILL[status])} />
        <span className="flex-1">{TASK_STATUS_LABELS[status]}</span>
        <span className="rounded-full bg-card px-2 py-0.5 text-xs font-medium text-muted-foreground">{count}</span>
      </h3>
      <div className="-m-1 flex max-h-[calc(100dvh-14rem)] min-h-24 flex-col gap-2 overflow-y-auto p-1">
        {children}
        {count === 0 && <p className="py-6 text-center text-xs text-muted-foreground">Aucune tâche</p>}
      </div>
    </section>
  )
}

function DraggableCard({ id, title, children }: { id: string; title: string; children: React.ReactNode }) {
  const { setNodeRef, setActivatorNodeRef, listeners, attributes, isDragging } = useDraggable({ id })
  return (
    <div
      ref={(node) => {
        setNodeRef(node)
        setActivatorNodeRef(node)
      }}
      {...listeners}
      {...attributes}
      aria-roledescription="tâche déplaçable"
      aria-label={`Déplacer « ${title} »`}
      className={cn(
        "touch-manipulation rounded-lg focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none",
        isDragging && "opacity-40"
      )}
    >
      {children}
    </div>
  )
}
