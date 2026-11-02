"use client"

import { ChevronDown, ListChecks } from "lucide-react"
import { Checkbox } from "@/components/ui/checkbox"
import type { Task } from "@/lib/domain"
import { useToggleChecklistItem } from "@/lib/queries"
import { cn } from "@/lib/utils"

// Empêche le glisser-déposer de la carte de démarrer depuis la checklist.
const isolate = {
  onPointerDown: (e: React.PointerEvent) => e.stopPropagation(),
  onKeyDown: (e: React.KeyboardEvent) => e.stopPropagation(),
}

function counts(task: Task) {
  const done = task.checklist.filter((i) => i.done).length
  return { done, total: task.checklist.length, complete: done === task.checklist.length }
}

/** Compteur « 1/5 » ; cliquable pour déplier la checklist quand `onToggle` est fourni. */
export function ChecklistProgress({
  task,
  expanded,
  onToggle,
}: {
  task: Task
  expanded?: boolean
  onToggle?: () => void
}) {
  if (task.checklist.length === 0) return null
  const { done, total, complete } = counts(task)
  const content = (
    <>
      <ListChecks className="size-3.5" aria-hidden />
      <span className="sr-only">Checklist :</span>
      {done}/{total}
      {onToggle && <ChevronDown className={cn("size-3 transition-transform", expanded && "rotate-180")} aria-hidden />}
    </>
  )
  const style = cn(
    "inline-flex items-center gap-1 text-xs tabular-nums",
    complete ? "font-medium text-[oklch(0.42_0.11_155)]" : "text-muted-foreground"
  )

  if (!onToggle) return <span className={style}>{content}</span>
  return (
    <button
      type="button"
      {...isolate}
      onClick={onToggle}
      aria-expanded={expanded}
      aria-label={`Checklist ${done} sur ${total}, ${expanded ? "masquer" : "afficher"}`}
      className={cn(style, "relative z-10 -mx-1 rounded-md px-1 py-0.5 hover:bg-muted focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none")}
    >
      {content}
    </button>
  )
}

/** Éléments de checklist cochables sans ouvrir la tâche. */
export function InlineChecklist({ task, className }: { task: Task; className?: string }) {
  const toggle = useToggleChecklistItem(task.id)
  return (
    <ul {...isolate} aria-label={`Checklist de « ${task.title} »`} className={cn("relative z-10 space-y-0.5", className)}>
      {task.checklist.map((item) => {
        const id = `inline-${item.id}`
        return (
          <li key={item.id} className="flex items-start gap-2 rounded-md px-1 py-1 hover:bg-muted">
            <Checkbox
              id={id}
              checked={item.done}
              onCheckedChange={(checked) => toggle.mutate({ id: item.id, done: checked === true })}
              className="mt-0.5"
            />
            <label
              htmlFor={id}
              className={cn("flex-1 cursor-pointer text-xs leading-5", item.done && "text-muted-foreground line-through")}
            >
              {item.label}
            </label>
          </li>
        )
      })}
    </ul>
  )
}
