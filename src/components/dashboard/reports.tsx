"use client"

import { FileSpreadsheet, FileText, Loader2, Lock, Sheet } from "lucide-react"
import { useMemo, useState } from "react"
import { toast } from "sonner"
import { ErrorState } from "@/components/empty-state"
import { Field } from "@/components/field"
import { NativeSelect } from "@/components/native-select"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Skeleton } from "@/components/ui/skeleton"
import { formatDate, TASK_STATUS_LABELS, TASK_STATUSES, todayISO, type TaskStatus } from "@/lib/domain"
import { display, exportReport, type ExportFormat } from "@/lib/export"
import { useProfiles, useProjects, useTasks } from "@/lib/queries"
import { buildReport, GRANULARITIES, REPORTS, type Granularity, type ReportKind } from "@/lib/reports"
import { cn } from "@/lib/utils"
import { useDashboard } from "./state"

type Preset = "today" | "week" | "month" | "last-month" | "year" | "custom"
const PRESETS: Record<Preset, string> = {
  today: "Aujourd'hui",
  week: "Cette semaine",
  month: "Ce mois",
  "last-month": "Mois dernier",
  year: "Cette année",
  custom: "Personnalisée",
}

const iso = (d: Date) => todayISO(d)

/** Bornes incluses (AAAA-MM-JJ) d'une période prédéfinie. */
function presetRange(preset: Exclude<Preset, "custom">, now = new Date()): [string, string] {
  const y = now.getFullYear()
  const m = now.getMonth()
  if (preset === "today") return [iso(now), iso(now)]
  if (preset === "week") {
    const monday = new Date(y, m, now.getDate() - ((now.getDay() + 6) % 7))
    return [iso(monday), iso(new Date(monday.getFullYear(), monday.getMonth(), monday.getDate() + 6))]
  }
  if (preset === "month") return [iso(new Date(y, m, 1)), iso(new Date(y, m + 1, 0))]
  if (preset === "last-month") return [iso(new Date(y, m - 1, 1)), iso(new Date(y, m, 0))]
  return [iso(new Date(y, 0, 1)), iso(new Date(y, 11, 31))]
}

const parseDay = (value: string) => {
  const [y, m, d] = value.split("-").map(Number)
  return new Date(y!, m! - 1, d!)
}

/**
 * Rapports d'heures, de projets, de tâches, de collaborateurs, de pauses et d'estimations, filtrés
 * par période, collaborateur, projet, tâche et statut, exportables en Excel, CSV et PDF.
 * Sans accès aux rapports d'équipe (ni chef du projet choisi), seuls ses propres chiffres apparaissent.
 */
export function ReportsSection() {
  const { viewer, canViewReports, canManage } = useDashboard()
  const tasksQuery = useTasks()
  const projectsQuery = useProjects()
  const { data: profiles = [] } = useProfiles()

  const [kind, setKind] = useState<ReportKind>("hours")
  const [granularity, setGranularity] = useState<Granularity>("day")
  const [preset, setPreset] = useState<Preset>("week")
  const [range, setRange] = useState(() => presetRange("week"))
  const [userId, setUserId] = useState("")
  const [projectId, setProjectId] = useState("")
  const [taskId, setTaskId] = useState("")
  const [status, setStatus] = useState<TaskStatus | "">("")
  const [exporting, setExporting] = useState<ExportFormat | null>(null)

  const projects = useMemo(() => projectsQuery.data ?? [], [projectsQuery.data])
  const teamView = canViewReports || (!!projectId && canManage(projectId))
  const people = useMemo(() => {
    const scope = projectId ? projects.filter((p) => p.id === projectId) : projects
    const members = new Set(scope.flatMap((p) => p.member_ids))
    return profiles.filter((p) => (teamView ? members.has(p.id) : p.id === viewer.id))
  }, [profiles, projects, projectId, teamView, viewer.id])
  const projectTasks = (tasksQuery.data ?? []).filter((t) => t.project_id === projectId)
  const effectiveUser = teamView ? userId : viewer.id
  const validRange = range[0] !== "" && range[1] !== "" && range[0] <= range[1]

  const report = useMemo(() => {
    if (!validRange) return null
    const to = parseDay(range[1])
    to.setDate(to.getDate() + 1)
    return buildReport(kind, {
      tasks: tasksQuery.data ?? [],
      projects,
      names: new Map(profiles.map((p) => [p.id, p.full_name])),
      granularity,
      filters: {
        from: parseDay(range[0]),
        to,
        userId: effectiveUser || undefined,
        projectId: projectId || undefined,
        taskId: taskId || undefined,
        status: status || undefined,
      },
    })
  }, [kind, granularity, range, validRange, effectiveUser, projectId, taskId, status, tasksQuery.data, projects, profiles])

  if (tasksQuery.isError || projectsQuery.isError)
    return <ErrorState onRetry={() => (tasksQuery.refetch(), projectsQuery.refetch())} />
  if (tasksQuery.isPending || projectsQuery.isPending) return <Skeleton className="h-96 rounded-xl" />

  const subtitle = [
    `Du ${formatDate(range[0])} au ${formatDate(range[1])}`,
    effectiveUser && `Collaborateur : ${profiles.find((p) => p.id === effectiveUser)?.full_name ?? ""}`,
    projectId && `Projet : ${projects.find((p) => p.id === projectId)?.name ?? ""}`,
    taskId && `Tâche : ${projectTasks.find((t) => t.id === taskId)?.title ?? ""}`,
    status && `Statut : ${TASK_STATUS_LABELS[status]}`,
  ]
    .filter(Boolean)
    .join(" · ")

  async function onExport(format: ExportFormat) {
    if (!report) return
    setExporting(format)
    try {
      await exportReport(report, format, subtitle, `kelenix-rapport-${kind}-${range[0]}-au-${range[1]}`)
    } catch {
      toast.error("L'export n'a pas pu être généré. Réessayez.")
    } finally {
      setExporting(null)
    }
  }

  return (
    <div className="space-y-5">
      <section aria-label="Filtres du rapport" className="space-y-4 rounded-xl border bg-card p-4 shadow-xs">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Field label="Rapport">
            <NativeSelect value={kind} onChange={(e) => setKind(e.target.value as ReportKind)}>
              {Object.entries(REPORTS).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </NativeSelect>
          </Field>
          {kind === "hours" && (
            <Field label="Découpage">
              <NativeSelect value={granularity} onChange={(e) => setGranularity(e.target.value as Granularity)}>
                {Object.entries(GRANULARITIES).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </NativeSelect>
            </Field>
          )}
          <Field label="Période">
            <NativeSelect
              value={preset}
              onChange={(e) => {
                const next = e.target.value as Preset
                setPreset(next)
                if (next !== "custom") setRange(presetRange(next))
              }}
            >
              {Object.entries(PRESETS).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </NativeSelect>
          </Field>
          <div className="grid grid-cols-2 gap-2">
            <Field label="Du">
              <Input type="date" value={range[0]} onChange={(e) => (setPreset("custom"), setRange([e.target.value, range[1]]))} />
            </Field>
            <Field label="Au" error={validRange ? undefined : "Période invalide."}>
              <Input type="date" value={range[1]} onChange={(e) => (setPreset("custom"), setRange([range[0], e.target.value]))} />
            </Field>
          </div>
        </div>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Field label="Collaborateur">
            <NativeSelect value={effectiveUser} disabled={!teamView} onChange={(e) => setUserId(e.target.value)}>
              {teamView && <option value="">Tous les collaborateurs</option>}
              {people.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.full_name}
                </option>
              ))}
            </NativeSelect>
          </Field>
          <Field label="Projet">
            <NativeSelect
              value={projectId}
              onChange={(e) => {
                setProjectId(e.target.value)
                setTaskId("")
                setUserId("")
              }}
            >
              <option value="">Tous les projets</option>
              {projects.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                  {p.archived_at ? " (archivé)" : ""}
                </option>
              ))}
            </NativeSelect>
          </Field>
          <Field label="Tâche">
            <NativeSelect value={taskId} disabled={!projectId} onChange={(e) => setTaskId(e.target.value)}>
              <option value="">{projectId ? "Toutes les tâches" : "Choisissez d'abord un projet"}</option>
              {projectTasks.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.title}
                </option>
              ))}
            </NativeSelect>
          </Field>
          <Field label="Statut de la tâche">
            <NativeSelect value={status} onChange={(e) => setStatus(e.target.value as TaskStatus | "")}>
              <option value="">Tous les statuts</option>
              {TASK_STATUSES.map((s) => (
                <option key={s} value={s}>
                  {TASK_STATUS_LABELS[s]}
                </option>
              ))}
            </NativeSelect>
          </Field>
        </div>
        {!teamView && (
          <p className="flex items-start gap-2 text-sm text-muted-foreground">
            <Lock className="mt-0.5 size-4 shrink-0" aria-hidden />
            Vous voyez vos propres chiffres. L&apos;accès aux rapports d&apos;équipe est accordé par un administrateur
            (ou en choisissant un projet dont vous êtes chef).
          </p>
        )}
      </section>

      {report && (
        <section aria-labelledby="report-title" className="rounded-xl border bg-card p-4 shadow-xs sm:p-5">
          <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0">
              <h2 id="report-title" className="text-base font-semibold">{report.title}</h2>
              <p className="text-sm text-muted-foreground">{subtitle}</p>
              {report.note && <p className="mt-1 text-xs text-muted-foreground">{report.note}</p>}
            </div>
            <div className="flex flex-wrap gap-2" role="group" aria-label="Exporter le rapport">
              {(
                [
                  ["xlsx", "Excel", FileSpreadsheet],
                  ["csv", "CSV", Sheet],
                  ["pdf", "PDF", FileText],
                ] as const
              ).map(([format, label, Icon]) => (
                <Button
                  key={format}
                  variant="outline"
                  size="sm"
                  disabled={!!exporting || report.rows.length === 0}
                  onClick={() => onExport(format)}
                >
                  {exporting === format ? <Loader2 className="animate-spin" /> : <Icon aria-hidden />} {label}
                </Button>
              ))}
            </div>
          </div>

          {report.rows.length === 0 ? (
            <p className="rounded-lg border border-dashed px-4 py-8 text-center text-sm text-muted-foreground">
              Aucune donnée pour ces filtres.
            </p>
          ) : (
            <div className="-mx-4 overflow-x-auto px-4 sm:-mx-5 sm:px-5">
              <table className="w-full text-sm whitespace-nowrap">
                <caption className="sr-only">{report.title}</caption>
                <thead>
                  <tr className="border-b text-left text-xs text-muted-foreground">
                    {report.columns.map((c) => (
                      <th key={c.key} scope="col" className={cn("px-2 py-2 font-medium", c.kind !== "text" && "text-right")}>
                        {c.label}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {report.rows.map((row, i) => (
                    <tr key={i}>
                      {report.columns.map((c, j) => {
                        const Cell = j === 0 ? "th" : "td"
                        const over = c.signed && Number(row[c.key]) >= 60_000
                        return (
                          <Cell
                            key={c.key}
                            scope={j === 0 ? "row" : undefined}
                            className={cn(
                              "px-2 py-2",
                              j === 0 ? "max-w-80 truncate text-left font-medium" : c.kind !== "text" && "text-right tabular-nums",
                              over && "font-medium text-destructive"
                            )}
                          >
                            {display(c, row[c.key])}
                          </Cell>
                        )
                      })}
                    </tr>
                  ))}
                </tbody>
                {report.total && (
                  <tfoot>
                    <tr className="border-t bg-muted/40 font-medium">
                      {report.columns.map((c, j) => (
                        <td key={c.key} className={cn("px-2 py-2", c.kind !== "text" && j > 0 && "text-right tabular-nums")}>
                          {c.key in report.total! ? display(c, report.total![c.key]) : ""}
                        </td>
                      ))}
                    </tr>
                  </tfoot>
                )}
              </table>
            </div>
          )}
        </section>
      )}
    </div>
  )
}
