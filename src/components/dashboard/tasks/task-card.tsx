"use client"

import { Ban, Check, ExternalLink, Link2, MessageSquare, Plus, UserPlus } from "lucide-react"
import { useState } from "react"
import { Button } from "@/components/ui/button"
import type { TablesUpdate } from "@/lib/database.types"
import { formatDate, type Profile, type Task } from "@/lib/domain"
import { useUpdateTask } from "@/lib/queries"
import { formatDuration, totals } from "@/lib/time"
import { cn } from "@/lib/utils"
import { AssigneeMenu, BlockDialog, ChecklistAdd, DueDateControl, isolate, MoreMenu, PriorityMenu, StatusMenu } from "./card-actions"
import { ChecklistProgress, InlineChecklist } from "./inline-checklist"
import { TagChips } from "../tags"
import { BlockedBadge, statusAccent } from "./task-meta"
import { TaskTime } from "./task-time"


/**
 * Carte de tâche : statut, priorité, échéance et checklist modifiables d'un clic ; collaborateurs
 * avec temps réel / estimé, commentaires, liens, chronomètre et commandes affichés en clair.
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
  const updateTask = useUpdateTask()
  const [checklistOpen, setChecklistOpen] = useState(false)
  const [adding, setAdding] = useState(false)
  const showChecklist = checklistOpen || adding
  function toggleChecklist() {
    setChecklistOpen(!showChecklist)
    setAdding(false)
  }
  const [blocking, setBlocking] = useState(false)
  const save = (values: TablesUpdate<"tasks">) => updateTask.mutate({ id: task.id, values })

  const people = task.assignees
    .map((a) => ({
      ...a,
      name: profiles.get(a.user_id)?.full_name ?? "Ancien membre",
      actual: totals(task.time_entries.filter((e) => e.user_id === a.user_id)).work,
    }))
    .sort((a, b) => Number(b.user_id === task.assignee_id) - Number(a.user_id === task.assignee_id))

  return (
    <div
      className={cn(
        "group relative space-y-2.5 rounded-lg border border-l-4 bg-card p-3 shadow-xs transition-[box-shadow,border-color] duration-300 hover:shadow-md",
        statusAccent(task.status),
        task.is_blocked && "border-y-destructive/40 border-r-destructive/40",
        className
      )}
    >
      <div className="flex items-center justify-between gap-2">
        <p className="min-w-0 truncate text-xs text-muted-foreground">{projectName}</p>
        <div className="flex shrink-0 items-center gap-0.5">
          <StatusMenu task={task} />
          <MoreMenu task={task} onOpen={onOpen} onAddChecklist={() => setAdding(true)} />
        </div>
      </div>

      <div>
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
        {task.description && <p className="mt-1 line-clamp-3 text-xs whitespace-pre-line text-muted-foreground">{task.description}</p>}
        <TagChips ids={task.tag_ids} className="mt-1.5" />
      </div>

      {task.is_blocked && (
        <div className="relative z-10 flex items-start gap-2 rounded-md border border-destructive/30 bg-destructive/5 p-2 text-xs">
          <BlockedBadge />
          <p className="min-w-0 flex-1 text-destructive">{task.blocked_reason}</p>
        </div>
      )}

      <div className="flex flex-wrap items-center gap-2">
        <PriorityMenu task={task} />
        <DueDateControl task={task} />
        <ChecklistProgress task={task} expanded={showChecklist} onToggle={toggleChecklist} />
      </div>
      {task.checklist.length > 0 && <ChecklistBar task={task} />}
      {showChecklist && (
        <div className="relative z-10 border-t pt-2">
          <InlineChecklist task={task} />
          <ChecklistAdd task={task} autoFocus={adding} />
        </div>
      )}

      {/* Collaborateurs : temps réel / estimé */}
      <div className="relative z-10 space-y-1">
        <p className="text-[11px] text-muted-foreground">Collaborateurs ({people.length})</p>
        {people.length === 0 ? (
          <p className="text-xs text-muted-foreground italic">À assigner</p>
        ) : (
          <ul className="space-y-0.5">
            {people.map((p) => {
              const estimate = p.estimated_minutes === null ? null : p.estimated_minutes * 60_000
              const over = estimate !== null && p.actual > estimate
              return (
                <li key={p.user_id} className="flex items-center justify-between gap-2 text-xs">
                  <span className="min-w-0 truncate">
                    {p.name}
                    {p.user_id === task.assignee_id && <span className="text-muted-foreground"> · responsable</span>}
                  </span>
                  <span className={cn("shrink-0 tabular-nums", over ? "font-medium text-destructive" : "text-muted-foreground")}>
                    {p.actual > 0 ? formatDuration(p.actual) : "0 min"}
                    {estimate !== null && ` / ${formatDuration(estimate)} estimé`}
                  </span>
                </li>
              )
            })}
          </ul>
        )}
      </div>

      <TaskTime task={task} profiles={profiles} />

      {/* Repères et commandes */}
      <div className="relative z-10 flex flex-wrap items-center gap-x-3 gap-y-1 border-t pt-2 text-xs text-muted-foreground">
        <span className="inline-flex items-center gap-1" title="Commentaires">
          <MessageSquare className="size-3.5" aria-hidden /> {task.comment_count}
          <span className="sr-only">commentaire(s)</span>
        </span>
        <span className="inline-flex items-center gap-1" title="Liens">
          <Link2 className="size-3.5" aria-hidden /> {task.link_count}
          <span className="sr-only">lien(s)</span>
        </span>
        <span>Créée le {formatDate(task.created_at)}</span>
      </div>
      <div {...isolate} className="relative z-10 flex flex-wrap gap-1">
        <AssigneeMenu
          task={task}
          profiles={profiles}
          className="inline-flex h-7 items-center gap-1 rounded-md border bg-card px-2 text-xs font-medium hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring/40 focus-visible:outline-none"
        >
          <UserPlus className="size-3.5" aria-hidden /> Affecter
        </AssigneeMenu>
        <Button variant="outline" size="sm" className="h-7 px-2 text-xs" onClick={() => setAdding(true)}>
          <Plus aria-hidden /> Élément
        </Button>
        {task.is_blocked ? (
          <Button variant="outline" size="sm" className="h-7 px-2 text-xs" onClick={() => save({ is_blocked: false, blocked_reason: null })}>
            <Check aria-hidden /> Débloquer
          </Button>
        ) : (
          <Button variant="outline" size="sm" className="h-7 px-2 text-xs" onClick={() => setBlocking(true)}>
            <Ban aria-hidden /> Bloquer
          </Button>
        )}
        <Button variant="outline" size="sm" className="h-7 px-2 text-xs" onClick={onOpen}>
          <ExternalLink aria-hidden /> Détails
        </Button>
      </div>
      <BlockDialog task={task} open={blocking} onClose={() => setBlocking(false)} />
    </div>
  )
}

/** Barre d'avancement de la checklist (verte une fois complète). */
function ChecklistBar({ task }: { task: Task }) {
  const done = task.checklist.filter((i) => i.done).length
  const percent = Math.round((done / task.checklist.length) * 100)
  return (
    <div
      role="progressbar"
      aria-label={`Avancement de la checklist de « ${task.title} »`}
      aria-valuenow={percent}
      aria-valuemin={0}
      aria-valuemax={100}
      className="h-1.5 overflow-hidden rounded-full bg-muted"
    >
      <div className={cn("h-full transition-[width]", percent === 100 ? "bg-success" : "bg-primary")} style={{ width: `${percent}%` }} />
    </div>
  )
}
