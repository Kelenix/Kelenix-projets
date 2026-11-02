"use client"

import { useState } from "react"
import { NativeSelect } from "@/components/native-select"
import { ShowMore } from "@/components/show-more"
import { TASK_STATUS_LABELS, TASK_STATUSES, type Profile, type Task, type TaskStatus } from "@/lib/domain"
import { useUpdateTask } from "@/lib/queries"
import { cn } from "@/lib/utils"
import { ChecklistProgress, InlineChecklist } from "./inline-checklist"
import { Assignee, BlockedBadge, DueDate, PriorityBadge } from "./task-meta"
import { TaskTime } from "./task-time"

export function TaskList({
  tasks,
  profiles,
  projectNames,
  onOpen,
}: {
  tasks: Task[]
  profiles: Map<string, Profile>
  projectNames?: Map<string, string>
  onOpen: (taskId: string) => void
}) {
  const updateTask = useUpdateTask()
  const [openChecklist, setOpenChecklist] = useState<string | null>(null)
  return (
    <div className="space-y-3">
      <ShowMore items={tasks} pageSize={50}>
        {(visible) => (
          <ul className="divide-y overflow-hidden rounded-xl border bg-card">
            {visible.map((task) => (
              <li key={task.id} className="flex flex-col gap-2 px-4 py-3 sm:flex-row sm:items-start sm:gap-4">
                <div className="min-w-0 flex-1">
                  <button
                    type="button"
                    onClick={() => onOpen(task.id)}
                    className={cn(
                      "block max-w-full truncate text-left text-sm font-medium hover:text-primary focus-visible:underline focus-visible:outline-none",
                      task.status === "done" && "text-muted-foreground line-through"
                    )}
                  >
                    {task.title}
                  </button>
                  {projectNames && <p className="truncate text-xs text-muted-foreground">{projectNames.get(task.project_id)}</p>}
                  {openChecklist === task.id && <InlineChecklist task={task} className="mt-2 max-w-md" />}
                  <TaskTime task={task} profiles={profiles} className="mt-2 max-w-md" />
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  {task.is_blocked && <BlockedBadge />}
                  <PriorityBadge priority={task.priority} />
                  <DueDate task={task} />
                  <ChecklistProgress
                    task={task}
                    expanded={openChecklist === task.id}
                    onToggle={() => setOpenChecklist((id) => (id === task.id ? null : task.id))}
                  />
                  <Assignee profile={task.assignee_id ? profiles.get(task.assignee_id) : undefined} />
                  <NativeSelect
                    aria-label={`Statut de « ${task.title} »`}
                    value={task.status}
                    onChange={(e) => updateTask.mutate({ id: task.id, values: { status: e.target.value as TaskStatus } })}
                    className="w-32"
                  >
                    {TASK_STATUSES.map((s) => (
                      <option key={s} value={s}>
                        {TASK_STATUS_LABELS[s]}
                      </option>
                    ))}
                  </NativeSelect>
                </div>
              </li>
            ))}
          </ul>
        )}
      </ShowMore>
    </div>
  )
}
