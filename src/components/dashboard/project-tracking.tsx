"use client"

import { CircleAlert, Flag, Loader2, Plus, Trash2, TriangleAlert } from "lucide-react"
import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
import {
  budgetStatus,
  formatDate,
  isMilestoneLate,
  taskCounts,
  type Project,
  type Task,
} from "@/lib/domain"
import { useAddMilestone, useDeleteMilestone, useMilestones, useUpdateMilestone } from "@/lib/queries"
import { fieldErrors, milestoneSchema } from "@/lib/schemas"
import { formatDuration, totals } from "@/lib/time"
import { cn } from "@/lib/utils"

const projectWork = (tasks: Task[]) => totals(tasks.flatMap((t) => t.time_entries)).work

/** Pastille d'alerte budget (cartes de projet) : rien tant que le budget est sous 80 %. */
export function BudgetBadge({ project, tasks }: { project: Pick<Project, "budget_minutes">; tasks: Task[] }) {
  const budget = budgetStatus(projectWork(tasks), project.budget_minutes)
  if (!budget || budget.level === "ok") return null
  const over = budget.level === "over"
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium",
        over ? "bg-destructive/10 text-destructive" : "bg-warning/15 text-[oklch(0.5_0.14_55)]"
      )}
    >
      <TriangleAlert className="size-3" aria-hidden />
      {over ? `Budget dépassé (${budget.percent} %)` : `${budget.percent} % du budget`}
    </span>
  )
}

/**
 * Heures investies face au budget du projet, avec une alerte visible dès 80 % et en cas de
 * dépassement. Sans budget, seul le total est affiché.
 */
export function BudgetMeter({ project, tasks }: { project: Pick<Project, "budget_minutes">; tasks: Task[] }) {
  const work = projectWork(tasks)
  const budget = budgetStatus(work, project.budget_minutes)
  return (
    <div className="space-y-1.5">
      <p className="text-sm">
        <span className="font-semibold tabular-nums">{work > 0 ? formatDuration(work) : "0 min"}</span>
        <span className="text-muted-foreground">
          {budget ? ` sur ${formatDuration(budget.budgetMs)} budgétées (${budget.percent} %)` : " investies · aucun budget défini"}
        </span>
      </p>
      {budget && (
        <>
          <div
            role="progressbar"
            aria-label="Consommation du budget d'heures"
            aria-valuenow={budget.percent}
            aria-valuemin={0}
            aria-valuemax={100}
            className="h-1.5 overflow-hidden rounded-full bg-muted"
          >
            <div
              className={cn(
                "h-full",
                budget.level === "over" ? "bg-destructive" : budget.level === "warning" ? "bg-warning" : "bg-primary"
              )}
              style={{ width: `${Math.min(budget.percent, 100)}%` }}
            />
          </div>
          {budget.level !== "ok" && (
            <p
              role="alert"
              className={cn(
                "flex items-start gap-1.5 rounded-md px-2 py-1.5 text-xs font-medium",
                budget.level === "over" ? "bg-destructive/10 text-destructive" : "bg-warning/15 text-[oklch(0.5_0.14_55)]"
              )}
            >
              <TriangleAlert className="mt-0.5 size-3.5 shrink-0" aria-hidden />
              {budget.level === "over"
                ? `Budget d'heures dépassé de ${formatDuration(budget.overMs)}.`
                : `Attention : ${budget.percent} % du budget d'heures consommé.`}
            </p>
          )}
        </>
      )}
    </div>
  )
}

/** Tâches terminées, en cours et en retard d'un projet. */
export function TaskCountsRow({ tasks }: { tasks: Task[] }) {
  const counts = taskCounts(tasks)
  return (
    <dl className="grid grid-cols-3 gap-2 text-center">
      <Count label="Terminées" value={counts.done} />
      <Count label="En cours" value={counts.inProgress} />
      <Count label="En retard" value={counts.late} alert={counts.late > 0} />
    </dl>
  )
}

function Count({ label, value, alert }: { label: string; value: number; alert?: boolean }) {
  return (
    <div className={cn("rounded-lg border bg-background px-2 py-1.5", alert && "border-destructive/40 bg-destructive/5")}>
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className={cn("text-lg font-semibold tabular-nums", alert && "text-destructive")}>
        {alert && <CircleAlert className="mr-1 inline size-4 align-[-2px]" aria-hidden />}
        {value}
      </dd>
    </div>
  )
}

/** Jalons du projet : visibles par tous ses membres, gérés par les chefs de projet et les administrateurs. */
export function Milestones({ projectId, canManage }: { projectId: string; canManage: boolean }) {
  const { data: milestones = [], isPending } = useMilestones(projectId)
  const add = useAddMilestone(projectId)
  const update = useUpdateMilestone(projectId)
  const remove = useDeleteMilestone(projectId)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const reached = milestones.filter((m) => m.done_at).length

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const form = e.currentTarget
    const parsed = milestoneSchema.safeParse(Object.fromEntries(new FormData(form)))
    if (!parsed.success) return setErrors(fieldErrors(parsed.error))
    setErrors({})
    add.mutate(parsed.data, { onSuccess: () => form.reset() })
  }

  return (
    <section aria-labelledby="milestones" className="space-y-3">
      <h3 id="milestones" className="flex items-center gap-2 text-sm font-semibold">
        <Flag className="size-4 text-muted-foreground" aria-hidden /> Jalons
        {milestones.length > 0 && (
          <span className="font-normal text-muted-foreground">
            ({reached}/{milestones.length} atteints)
          </span>
        )}
      </h3>
      {isPending ? (
        <Loader2 className="size-4 animate-spin text-muted-foreground" aria-label="Chargement des jalons" />
      ) : milestones.length === 0 ? (
        <p className="text-sm text-muted-foreground">Aucun jalon pour l&apos;instant.</p>
      ) : (
        <ol className="relative space-y-1 border-l pl-4" aria-label="Jalons du projet">
          {milestones.map((m) => {
            const late = isMilestoneLate(m)
            const id = `milestone-${m.id}`
            return (
              <li key={m.id} className="relative flex items-center gap-2 py-1">
                <span
                  aria-hidden
                  className={cn(
                    "absolute -left-[21px] size-2.5 rounded-full border-2 border-card",
                    m.done_at ? "bg-success" : late ? "bg-destructive" : "bg-muted-foreground/40"
                  )}
                />
                <Checkbox
                  id={id}
                  checked={!!m.done_at}
                  disabled={!canManage}
                  onCheckedChange={(checked) =>
                    update.mutate({ id: m.id, values: { done_at: checked === true ? new Date().toISOString() : null } })
                  }
                  aria-label={`${m.title} : ${m.done_at ? "atteint" : "à atteindre"}`}
                />
                <label htmlFor={id} className={cn("min-w-0 flex-1 truncate text-sm", m.done_at && "text-muted-foreground line-through")}>
                  {m.title}
                </label>
                <span className={cn("shrink-0 text-xs tabular-nums", late ? "font-medium text-destructive" : "text-muted-foreground")}>
                  {late && "En retard · "}
                  {formatDate(m.due_date)}
                </span>
                {canManage && (
                  <Button variant="ghost" size="icon-sm" aria-label={`Supprimer le jalon « ${m.title} »`} onClick={() => remove.mutate(m.id)}>
                    <Trash2 />
                  </Button>
                )}
              </li>
            )
          })}
        </ol>
      )}
      {canManage && (
        <form onSubmit={onSubmit} noValidate className="flex flex-wrap items-start gap-2">
          <div className="min-w-48 flex-1">
            <Input name="title" placeholder="Nouveau jalon (ex. Recette client)" aria-label="Titre du jalon" maxLength={200} aria-invalid={!!errors.title} />
            {errors.title && <p className="mt-1 text-xs text-destructive">{errors.title}</p>}
          </div>
          <div>
            <Input type="date" name="due_date" aria-label="Échéance du jalon" aria-invalid={!!errors.due_date} className="w-40" />
            {errors.due_date && <p className="mt-1 text-xs text-destructive">{errors.due_date}</p>}
          </div>
          <Button type="submit" variant="secondary" disabled={add.isPending}>
            <Plus aria-hidden /> Ajouter le jalon
          </Button>
        </form>
      )}
    </section>
  )
}
