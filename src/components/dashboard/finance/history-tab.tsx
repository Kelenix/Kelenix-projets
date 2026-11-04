"use client"

import { ChevronDown, FileText, Loader2, Sheet } from "lucide-react"
import { Fragment, useState } from "react"
import { toast } from "sonner"
import { NativeSelect } from "@/components/native-select"
import { Button } from "@/components/ui/button"
import { exportReport, type ExportFormat } from "@/lib/export"
import {
  CATEGORIES,
  CATEGORY_LABELS,
  currentMonth,
  monthLabel,
  monthRange,
  monthSummary,
  type FinanceData,
  type MonthSummary,
} from "@/lib/finance"
import type { Column, Report, Row } from "@/lib/reports"
import { cn } from "@/lib/utils"
import { CategoryDot, Panel, StatCard, useFinanceContext } from "./ui"

const STATUS = { current: "En cours", closed: "Clôturé", upcoming: "À venir" } as const
const statusOf = (month: string, now = currentMonth()) => (month === now ? "current" : month < now ? "closed" : "upcoming")
const paid = (s: MonthSummary) => s.savingsDeposits + s.investmentContributions

/** Années proposées : les années récentes, plus toutes celles qui contiennent des opérations. */
export function yearsWithData(data: FinanceData, selected: number) {
  const now = new Date().getFullYear()
  const dates = [
    ...data.incomes.map((i) => i.received_on),
    ...data.expenses.map((e) => e.spent_on),
    ...data.savings.map((s) => s.occurred_on),
    ...data.investments.map((i) => i.occurred_on),
  ]
  const years = new Set([selected, ...Array.from({ length: 6 }, (_, i) => now - 4 + i), ...dates.map((d) => Number(d.slice(0, 4)))])
  return [...years].sort((a, b) => a - b)
}

/** Bilan annuel exportable : une ligne par mois, totaux et moyennes sur les mois renseignés. */
function yearReport(year: number, rows: MonthSummary[]): Report {
  const columns: Column[] = [
    { key: "month", label: "Mois", kind: "text" },
    { key: "income", label: "Revenu", kind: "money" },
    ...CATEGORIES.map((c) => ({ key: c, label: `Budget ${CATEGORY_LABELS[c].toLowerCase()}`, kind: "money" as const })),
    { key: "expenses", label: "Dépenses", kind: "money" },
    { key: "paid", label: "Versements effectués", kind: "money" },
    { key: "available", label: "Solde disponible", kind: "money" },
    { key: "status", label: "Statut", kind: "text" },
  ]
  const toRow = (s: MonthSummary): Row =>
    s.hasData
      ? {
          month: monthLabel(s.month),
          income: s.income,
          ...Object.fromEntries(CATEGORIES.map((c) => [c, s.budget[c]])),
          expenses: s.expenses,
          paid: paid(s),
          available: s.available,
          status: STATUS[statusOf(s.month)],
        }
      : { month: monthLabel(s.month), status: `${STATUS[statusOf(s.month)]} · aucune donnée` }
  const filled = rows.filter((s) => s.hasData)
  const sum = (f: (s: MonthSummary) => number) => filled.reduce((a, s) => a + f(s), 0)
  return {
    title: `Historique financier ${year}`,
    columns,
    rows: rows.map(toRow),
    total: {
      month: `Total (${filled.length} mois renseignés)`,
      income: sum((s) => s.income),
      ...Object.fromEntries(CATEGORIES.map((c) => [c, sum((s) => s.budget[c])])),
      expenses: sum((s) => s.expenses),
      paid: sum(paid),
      available: sum((s) => s.available),
    },
    note: "Les mois sans aucune opération sont signalés « aucune donnée » et ne sont pas comptés à zéro dans les moyennes.",
  }
}

export function HistoryTab() {
  const { data, month, money, setMonth, openTab, settings } = useFinanceContext()
  const [year, setYear] = useState(() => Number(month.slice(0, 4)))
  const [open, setOpen] = useState<string | null>(null)
  const [exporting, setExporting] = useState<ExportFormat | null>(null)

  const rows = monthRange(`${year}-01-01`, `${year}-12-01`).map((m) => monthSummary(m, data))
  const filled = rows.filter((s) => s.hasData)
  const total = (f: (s: MonthSummary) => number) => filled.reduce((a, s) => a + f(s), 0)
  const average = (f: (s: MonthSummary) => number) => (filled.length ? Math.round(total(f) / filled.length) : 0)
  const years = yearsWithData(data, year)

  async function onExport(format: ExportFormat) {
    setExporting(format)
    try {
      await exportReport(yearReport(year, rows), format, `Année ${year} · ${settings.currency}`, `kelenix-finances-${year}`)
    } catch {
      toast.error("L'export n'a pas pu être généré. Réessayez.")
    } finally {
      setExporting(null)
    }
  }

  return (
    <>
      <div className="flex flex-wrap items-center gap-2">
        <NativeSelect aria-label="Année" value={year} onChange={(e) => setYear(Number(e.target.value))} className="w-32">
          {years.map((y) => (
            <option key={y} value={y}>
              {y}
            </option>
          ))}
        </NativeSelect>
        <div className="ml-auto flex gap-2" role="group" aria-label="Exporter l'historique">
          {(
            [
              ["csv", "CSV", Sheet],
              ["pdf", "PDF", FileText],
            ] as const
          ).map(([format, label, Icon]) => (
            <Button key={format} variant="outline" size="sm" disabled={!!exporting} onClick={() => onExport(format)}>
              {exporting === format ? <Loader2 className="animate-spin" /> : <Icon aria-hidden />} {label}
            </Button>
          ))}
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label={`Revenus ${year}`} value={money(total((s) => s.income))}>
          <span className="text-xs text-muted-foreground">Moyenne : {money(average((s) => s.income))} / mois renseigné</span>
        </StatCard>
        <StatCard label={`Dépenses ${year}`} value={money(total((s) => s.expenses))}>
          <span className="text-xs text-muted-foreground">Moyenne : {money(average((s) => s.expenses))} / mois renseigné</span>
        </StatCard>
        <StatCard label="Versements effectués (épargne et investissements)" value={money(total(paid))}>
          <span className="text-xs text-muted-foreground">Moyenne : {money(average(paid))}</span>
        </StatCard>
        <StatCard label="Mois renseignés" value={`${filled.length} / 12`} />
      </div>

      <Panel title={`Historique ${year}`} description="Ouvrez un mois pour voir son détail. Un mois sans opération n'est pas un mois à zéro.">
        <div className="-mx-4 overflow-x-auto px-4 sm:-mx-5 sm:px-5">
          <table className="w-full min-w-[960px] text-sm whitespace-nowrap">
            <caption className="sr-only">Historique financier {year}</caption>
            <thead>
              <tr className="border-b text-left text-xs text-muted-foreground">
                <th scope="col" className="py-2 pr-3 font-medium">Mois</th>
                <th scope="col" className="px-2 py-2 text-right font-medium">Revenu</th>
                {CATEGORIES.map((c) => (
                  <th key={c} scope="col" className="px-2 py-2 text-right font-medium">
                    <span className="inline-flex items-center gap-1.5">
                      <CategoryDot category={c} /> {CATEGORY_LABELS[c]}
                    </span>
                  </th>
                ))}
                <th scope="col" className="px-2 py-2 text-right font-medium">Dépenses</th>
                <th scope="col" className="px-2 py-2 text-right font-medium">Versements</th>
                <th scope="col" className="px-2 py-2 text-right font-medium">Solde disponible</th>
                <th scope="col" className="py-2 pl-2 font-medium">Statut</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {rows.map((s) => {
                const status = statusOf(s.month)
                const expanded = open === s.month
                return (
                  <Fragment key={s.month}>
                    <tr className={cn(s.month === month && "bg-accent/40")}>
                      <th scope="row" className="py-2 pr-3 text-left font-medium">
                        <button
                          type="button"
                          aria-expanded={expanded}
                          onClick={() => setOpen(expanded ? null : s.month)}
                          className="inline-flex items-center gap-1 capitalize hover:text-primary"
                        >
                          <ChevronDown className={cn("size-4 transition-transform", expanded && "rotate-180")} aria-hidden />
                          {monthLabel(s.month)}
                        </button>
                      </th>
                      {s.hasData ? (
                        <>
                          <td className="px-2 py-2 text-right tabular-nums">{money(s.income)}</td>
                          {CATEGORIES.map((c) => (
                            <td key={c} className="px-2 py-2 text-right tabular-nums">
                              {money(s.budget[c])}
                            </td>
                          ))}
                          <td className="px-2 py-2 text-right tabular-nums">{money(s.expenses)}</td>
                          <td className="px-2 py-2 text-right tabular-nums">{money(paid(s))}</td>
                          <td className={cn("px-2 py-2 text-right font-medium tabular-nums", s.available < 0 && "text-destructive")}>{money(s.available)}</td>
                        </>
                      ) : (
                        <td colSpan={8} className="px-2 py-2 text-center text-xs text-muted-foreground italic">
                          Aucune donnée enregistrée
                        </td>
                      )}
                      <td className="py-2 pl-2">
                        <span
                          className={cn(
                            "rounded-full px-2 py-0.5 text-xs font-medium",
                            status === "current" ? "bg-accent text-accent-foreground" : status === "closed" ? "bg-muted text-muted-foreground" : "border text-muted-foreground"
                          )}
                        >
                          {STATUS[status]}
                        </span>
                      </td>
                    </tr>
                    {expanded && (
                      <tr>
                        <td colSpan={10} className="bg-muted/30 px-3 py-3">
                          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                            {CATEGORIES.map((c) => (
                              <div key={c} className="text-xs">
                                <p className="flex items-center gap-1.5 font-medium">
                                  <CategoryDot category={c} /> {CATEGORY_LABELS[c]} ({s.rule[c]} %)
                                </p>
                                <p className="text-muted-foreground tabular-nums">
                                  Budget {money(s.budget[c])} · consommé {money(s.consumed[c])} · reste {money(s.remaining[c])}
                                </p>
                              </div>
                            ))}
                          </div>
                          <Button
                            variant="outline"
                            size="sm"
                            className="mt-3"
                            onClick={() => {
                              setMonth(s.month)
                              openTab("overview")
                            }}
                          >
                            Ouvrir ce mois
                          </Button>
                        </td>
                      </tr>
                    )}
                  </Fragment>
                )
              })}
            </tbody>
            <tfoot>
              <tr className="border-t bg-muted/40 font-medium">
                <th scope="row" className="py-2 pr-3 text-left">Total</th>
                <td className="px-2 py-2 text-right tabular-nums">{money(total((s) => s.income))}</td>
                {CATEGORIES.map((c) => (
                  <td key={c} className="px-2 py-2 text-right tabular-nums">
                    {money(total((s) => s.budget[c]))}
                  </td>
                ))}
                <td className="px-2 py-2 text-right tabular-nums">{money(total((s) => s.expenses))}</td>
                <td className="px-2 py-2 text-right tabular-nums">{money(total(paid))}</td>
                <td className="px-2 py-2 text-right tabular-nums">{money(total((s) => s.available))}</td>
                <td />
              </tr>
              <tr className="bg-muted/20 text-xs text-muted-foreground">
                <th scope="row" className="py-2 pr-3 text-left font-normal">Moyenne / mois renseigné</th>
                <td className="px-2 py-2 text-right tabular-nums">{money(average((s) => s.income))}</td>
                {CATEGORIES.map((c) => (
                  <td key={c} className="px-2 py-2 text-right tabular-nums">
                    {money(average((s) => s.budget[c]))}
                  </td>
                ))}
                <td className="px-2 py-2 text-right tabular-nums">{money(average((s) => s.expenses))}</td>
                <td className="px-2 py-2 text-right tabular-nums">{money(average(paid))}</td>
                <td className="px-2 py-2 text-right tabular-nums">{money(average((s) => s.available))}</td>
                <td />
              </tr>
            </tfoot>
          </table>
        </div>
      </Panel>
    </>
  )
}
