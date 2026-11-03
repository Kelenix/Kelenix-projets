"use client"

import { useState } from "react"
import type { Profile, Task } from "@/lib/domain"
import { cn } from "@/lib/utils"
import { AssigneeMenu, ChecklistAdd, DueDateControl, MoreMenu, PriorityMenu, StatusMenu } from "./card-actions"
import { ChecklistProgress, InlineChecklist } from "./inline-checklist"
import { BlockedBadge, statusAccent } from "./task-meta"
import { TaskTime } from "./task-time"

/**
 * Carte de tâche : la plupart des actions se font directement dessus (statut, priorité,
 * échéance, affectés, checklist, blocage, chronomètre, suppression) sans ouvrir le détail.
 */
export function TaskCard({
  task,
  profiles,
  projectName,
  onOpen,
  className,
}: {
  task: Task
  profiles: Map<string, Profile>
  projectName?: string
  onOpen: () => void
  className?: string
}) {
  const [checklistOpen, setChecklistOpen] = useState(false)
  const [adding, setAdding] = useState(false)
  const showChecklist = checklistOpen || adding
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
        <div className="flex shrink-0 items-center gap-0.5">
          <StatusMenu task={task} />
          <MoreMenu task={task} onOpen={onOpen} onAddChecklist={() => setAdding(true)} />
        </div>
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
      {task.is_blocked && task.blocked_reason && (
        <p className="mt-1 line-clamp-2 text-xs text-destructive">{task.blocked_reason}</p>
      )}
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <PriorityMenu task={task} />
        {task.is_blocked && <BlockedBadge />}
        <DueDateControl task={task} />
        <ChecklistProgress
          task={task}
          expanded={showChecklist}
          onToggle={() => (showChecklist ? (setChecklistOpen(false), setAdding(false)) : setChecklistOpen(true))}
        />
        <span className="ml-auto">
          <AssigneeMenu task={task} profiles={profiles} />
        </span>
      </div>
      {showChecklist && (
        <div className="mt-2 border-t pt-2">
          <InlineChecklist task={task} />
          <ChecklistAdd task={task} autoFocus={adding} />
        </div>
      )}
      <TaskTime task={task} profiles={profiles} className="mt-1.5" />
    </div>
  )
}
