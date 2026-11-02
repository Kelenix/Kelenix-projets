"use client"

import { useState } from "react"
import type { Profile, Task } from "@/lib/domain"
import { cn } from "@/lib/utils"
import { ChecklistProgress, InlineChecklist } from "./inline-checklist"
import { Assignee, BlockedBadge, DueDate, PriorityBadge, statusAccent, TaskStatusBadge } from "./task-meta"
import { TaskTime } from "./task-time"

export function TaskCard({
  task,
  assignee,
  profiles,
  projectName,
  onOpen,
  className,
}: {
  task: Task
  assignee?: Profile
  profiles: Map<string, Profile>
  projectName?: string
  onOpen: () => void
  className?: string
}) {
  const [checklistOpen, setChecklistOpen] = useState(false)
  return (
    <div
      className={cn(
        "group relative rounded-lg border border-l-4 bg-card p-3 shadow-xs transition-[box-shadow,border-color] duration-300 hover:shadow-md",
        statusAccent(task.status),
        task.is_blocked && "border-y-destructive/40 border-r-destructive/40",
        className
      )}
    >
      <div className="mb-1 flex items-center justify-between gap-2">
        <p className="min-w-0 truncate text-xs text-muted-foreground">{projectName}</p>
        <TaskStatusBadge status={task.status} />
      </div>
      <button
        type="button"
        onClick={onOpen}
        className={cn(
          "block w-full text-left text-sm font-medium after:absolute after:inset-0 focus-visible:outline-none",
          task.status === "done" && "text-muted-foreground line-through"
        )}
      >
        {task.title}
      </button>
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <PriorityBadge priority={task.priority} />
        {task.is_blocked && <BlockedBadge />}
        <DueDate task={task} />
        <ChecklistProgress task={task} expanded={checklistOpen} onToggle={() => setChecklistOpen((o) => !o)} />
        <span className="relative ml-auto">
          <Assignee profile={assignee} />
        </span>
      </div>
      {checklistOpen && <InlineChecklist task={task} className="mt-2 border-t pt-2" />}
      <TaskTime task={task} profiles={profiles} className="mt-1.5" />
    </div>
  )
}
