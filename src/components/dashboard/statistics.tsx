"use client"

import { Ban, ChartColumn, CircleAlert, Lock } from "lucide-react"
import { useMemo, useState, type ReactNode } from "react"
import { EmptyState, ErrorState } from "@/components/empty-state"
import { NativeSelect } from "@/components/native-select"
import { Skeleton } from "@/components/ui/skeleton"
import { isAssigned, isOverdue } from "@/lib/domain"
import { useProfiles, useProjects, useTasks } from "@/lib/queries"
import { memberStats, statusCounts, weeklyCompletions } from "@/lib/stats"
import { formatDuration, timeSince } from "@/lib/time"
import { cn } from "@/lib/utils"
import { StatusBar, StatusLegend, WeeklyBars } from "./charts"
import { EstimateTable, TeamNow } from "./team-reports"
import { useDashboard } from "./state"
import { Timesheet } from "./timesheet"

const PERIODS = [4, 8, 12] as const

/**
 * Graphiques calculés en direct depuis les tâches visibles : toute modification les met à jour.
 * Rapports d'équipe pour les administrateurs, les personnes autorisées et le chef du projet
 * sélectionné ; sinon, uniquement ses propres chiffres.
 */
export function StatisticsSection() {
  const { viewer, canViewReports, canManage } = useDashboard()
  const tasksQuery = useTasks()
  const projectsQuery = useProjects()
  const { data: profiles = [] } = useProfiles()
  const [projectId, setProjectId] = useState("")
  const [weeks, setWeeks] = useState<(typeof PERIODS)[number]>(8)

  const projects = useMemo(() => (projectsQuery.data ?? []).filter((p) => !p.archived_at), [projectsQuery.data])
  const teamView = canViewReports || (!!projectId && canManage(projectId))
  const managesSome = projects.some((p) => p.manager_ids.includes(viewer.id))

  const stats = useMemo(() => {
    const scope = projects.filter((p) => !projectId || p.id === projectId)
    const live = new Set(scope.map((p) => p.id))
    const visible = (tasksQuery.data ?? []).filter((t) => live.has(t.project_id))
    // Sans accès aux rapports : ses tâches et son propre temps uniquement.
    const tasks = teamView
      ? visible
      : visible
          .filter((t) => isAssigned(t, viewer.id) || t.time_entries.some((e) => e.user_id === viewer.id))
          .map((t) => ({ ...t, time_entries: t.time_entries.filter((e) => e.user_id === viewer.id) }))
    const memberIds = new Set(scope.flatMap((p) => p.member_ids))
    const people = profiles.filter((p) => (teamView ? memberIds.has(p.id) : p.id === viewer.id))
    const byWeek = weeklyCompletions(tasks, weeks)
    const since = byWeek[0]!.start
    const counts = statusCounts(tasks)
    return {
      tasks,
      people,
      byWeek,
      counts,
      completed: byWeek.reduce((sum, w) => sum + w.count, 0),
      open: counts.todo + counts.in_progress,
      overdue: tasks.filter((t) => isOverdue(t)).length,
      rate: tasks.length === 0 ? 0 : Math.round((counts.done / tasks.length) * 100),
      members: memberStats(tasks, people, since),
      time: timeSince(
        tasks.flatMap((t) => t.time_entries),
        since
      ),
    }
  }, [tasksQuery.data, projects, projectId, weeks, profiles, teamView, viewer.id])

  if (tasksQuery.isError || projectsQuery.isError)
    return <ErrorState onRetry={() => (tasksQuery.refetch(), projectsQuery.refetch())} />
  if (tasksQuery.isPending || projectsQuery.isPending) return <Skeleton className="h-96 rounded-xl" />

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row">
        <NativeSelect aria-label="Projet" value={projectId} onChange={(e) => setProjectId(e.target.value)} className="sm:w-80">
          <option value="">Tous les projets actifs</option>
          {projects.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </NativeSelect>
        <NativeSelect
          aria-label="Période"
          value={weeks}
          onChange={(e) => setWeeks(Number(e.target.value) as (typeof PERIODS)[number])}
          className="sm:w-56"
        >
          {PERIODS.map((n) => (
            <option key={n} value={n}>
              {n} dernières semaines
            </option>
          ))}
        </NativeSelect>
      </div>

      {!teamView && (
        <p className="flex items-start gap-2 rounded-lg border bg-muted/40 px-3 py-2 text-sm text-muted-foreground">
          <Lock className="mt-0.5 size-4 shrink-0" aria-hidden />
          <span>
            Vous voyez vos propres chiffres. L&apos;accès aux rapports d&apos;équipe est accordé par un administrateur
            {managesSome && " ; choisissez un projet dont vous êtes chef pour voir son équipe"}.
          </span>
        </p>
      )}

      {stats.tasks.length === 0 ? (
        <EmptyState icon={ChartColumn} title="Pas encore de données" description="Les statistiques apparaissent dès que des tâches existent." />
      ) : (
        <>
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-5">
            <Tile label={`Terminées (${weeks} sem.)`} value={stats.completed} />
            <Tile label="Taux d'achèvement" value={`${stats.rate} %`} />
            <Tile label="Tâches ouvertes" value={stats.open} />
            <Tile label="En retard" value={stats.overdue} alert={stats.overdue > 0} />
            <Tile label={`Temps passé (${weeks} sem.)`} value={stats.time === 0 ? "0 min" : formatDuration(stats.time)} />
          </div>

          <div className="grid gap-4 lg:grid-cols-5">
            <Card title="Tâches terminées par semaine" className="lg:col-span-3">
              <WeeklyBars weeks={stats.byWeek} />
            </Card>
            <Card title="Répartition par statut" className="lg:col-span-2">
              <div className="space-y-5 pt-2">
                <StatusBar counts={stats.counts} label="Répartition des tâches par statut" className="h-4" />
                <StatusLegend counts={stats.counts} />
              </div>
            </Card>
          </div>

          <Card title={teamView ? "L'équipe en ce moment" : "Votre activité en ce moment"}>
            <TeamNow tasks={stats.tasks} people={stats.people} />
          </Card>

          <Card title={teamView ? "Feuille de temps de l'équipe" : "Votre feuille de temps"}>
            <Timesheet tasks={stats.tasks} profiles={profiles} />
          </Card>

          <Card title="Temps estimé et temps réel par collaborateur">
            <EstimateTable tasks={stats.tasks} people={stats.people} />
          </Card>

          <Card title="Statistiques par membre">
            <div className="-mx-4 overflow-x-auto px-4">
              <table className="w-full min-w-[720px] text-sm">
                <caption className="sr-only">Charge et avancement de chaque membre</caption>
                <thead>
                  <tr className="border-b text-left text-xs text-muted-foreground">
                    <th scope="col" className="py-2 pr-4 font-medium">Membre</th>
                    <th scope="col" className="w-1/4 py-2 pr-4 font-medium">Répartition</th>
                    <th scope="col" className="py-2 pr-4 text-right font-medium">Ouvertes</th>
                    <th scope="col" className="py-2 pr-4 text-right font-medium">Terminées ({weeks} sem.)</th>
                    <th scope="col" className="py-2 pr-4 text-right font-medium">Temps passé</th>
                    <th scope="col" className="py-2 pr-4 text-right font-medium">En retard</th>
                    <th scope="col" className="py-2 pr-4 text-right font-medium">Bloquées</th>
                    <th scope="col" className="py-2 text-right font-medium">Achèvement</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {stats.members.map((m) => (
                    <tr key={m.id ?? "unassigned"}>
                      <th scope="row" className="py-3 pr-4 text-left font-medium">
                        <span className={cn(!m.id && "text-muted-foreground italic")}>{m.name}</span>
                        {m.id === viewer.id && <span className="font-normal text-muted-foreground"> (vous)</span>}
                      </th>
                      <td className="py-3 pr-4">
                        <StatusBar counts={m.status} label={`Répartition des tâches de ${m.name}`} />
                      </td>
                      <td className="py-3 pr-4 text-right tabular-nums">{m.total - m.status.done}</td>
                      <td className="py-3 pr-4 text-right tabular-nums">{m.completedInPeriod}</td>
                      <td className="py-3 pr-4 text-right tabular-nums">
                        {m.id === null ? "—" : m.timeInPeriod === 0 ? "0 min" : formatDuration(m.timeInPeriod)}
                      </td>
                      <td className="py-3 pr-4 text-right tabular-nums">
                        <Flag value={m.overdue} icon={<CircleAlert className="size-3.5" aria-hidden />} />
                      </td>
                      <td className="py-3 pr-4 text-right tabular-nums">
                        <Flag value={m.blocked} icon={<Ban className="size-3.5" aria-hidden />} />
                      </td>
                      <td className="py-3 text-right tabular-nums">{m.total === 0 ? "—" : `${m.completionRate} %`}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="mt-4 border-t pt-3">
              <StatusLegend counts={stats.counts} />
            </div>
          </Card>
        </>
      )}
    </div>
  )
}

function Card({ title, className, children }: { title: string; className?: string; children: ReactNode }) {
  return (
    <section aria-label={title} className={cn("rounded-xl border bg-card p-4 shadow-xs sm:p-5", className)}>
      <h2 className="mb-4 text-sm font-semibold">{title}</h2>
      {children}
    </section>
  )
}

function Tile({ label, value, alert }: { label: string; value: ReactNode; alert?: boolean }) {
  return (
    <div className="rounded-xl border bg-card p-4 shadow-xs">
      <p className="text-sm text-muted-foreground">{label}</p>
      <p className={cn("mt-1 text-2xl font-semibold tabular-nums", alert && "text-destructive")}>{value}</p>
    </div>
  )
}

/** Valeur d'alerte : icône + couleur seulement si non nulle (jamais la couleur seule). */
function Flag({ value, icon }: { value: number; icon: ReactNode }) {
  if (value === 0) return <span className="text-muted-foreground">0</span>
  return (
    <span className="inline-flex items-center justify-end gap-1 font-medium text-destructive">
      {icon}
      {value}
    </span>
  )
}
