"use client"

import { useState } from "react"
import { NativeSelect } from "@/components/native-select"
import { ShowMore } from "@/components/show-more"
import { TASK_STATUS_LABELS, TASK_STATUSES, type Profile, type Task, type TaskStatus } from "@/lib/domain"
import { useUpdateTask } from "@/lib/queries"
import { cn } from "@/lib/utils"
import { ChecklistProgress, InlineChecklist } from "./inline-checklist"
import { AssigneeMenu, ChecklistAdd, DueDateControl, MoreMenu, PriorityMenu } from "./card-actions"
import { TagChips } from "../tags"
import { BlockedBadge, statusAccent, TaskStatusBadge } from "./task-meta"
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
              <li
                key={task.id}
                className={cn("flex flex-col gap-2 border-l-4 px-4 py-3 sm:flex-row sm:items-start sm:gap-4", statusAccent(task.status))}
              >
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
                  <TagChips ids={task.tag_ids} className="mt-1" />
                  {openChecklist === task.id && (
                    <div className="mt-2 max-w-md">
                      <InlineChecklist task={task} />
                      <ChecklistAdd task={task} />
                    </div>
                  )}
                  <TaskTime task={task} profiles={profiles} className="mt-2 max-w-md" />
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <TaskStatusBadge status={task.status} />
                  {task.is_blocked && <BlockedBadge />}
                  <PriorityMenu task={task} />
                  <DueDateControl task={task} />
                  <ChecklistProgress
                    task={task}
                    expanded={openChecklist === task.id}
                    onToggle={() => setOpenChecklist((id) => (id === task.id ? null : task.id))}
                  />
                  <AssigneeMenu task={task} profiles={profiles} />
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
                  <MoreMenu task={task} onOpen={() => onOpen(task.id)} onAddChecklist={() => setOpenChecklist(task.id)} />
                </div>
              </li>
            ))}
          </ul>
        )}
      </ShowMore>
    </div>
  )
}
