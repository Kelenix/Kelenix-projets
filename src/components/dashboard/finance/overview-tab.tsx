"use client"

import { CircleAlert, CircleCheck, Info, TriangleAlert } from "lucide-react"
import { useMemo, useState } from "react"
import { NativeSelect } from "@/components/native-select"
import { Button } from "@/components/ui/button"
import {
  addMonths,
  aggregate,
  alerts,
  CATEGORIES,
  CATEGORY_LABELS,
  emergencyBalance,
  forecast,
  monthLabel,
  monthRange,
  monthSummary,
  portfolio,
  type Alert,
  type Category,
} from "@/lib/finance"
import { todayISO } from "@/lib/domain"
import { cn } from "@/lib/utils"
import { AllocationDonut, BudgetBars, ExpensesStacked, ForecastChart, IncomeLine } from "./charts"
import { yearsWithData } from "./history-tab"
import { Delta, Empty, Panel, StatCard, useFinanceContext } from "./ui"

type Period = "current" | "previous" | "last3" | "last6" | "last12" | "year"
const PERIODS: Record<Period, string> = {
  current: "Mois actuel",
  previous: "Mois précédent",
  last3: "3 derniers mois",
  last6: "6 derniers mois",
  last12: "12 derniers mois",
  year: "Année",
}

/** Mois couverts par la période, relativement au mois affiché. */
function periodMonths(period: Period, month: string, year: number) {
  if (period === "current") return [month]
  if (period === "previous") return [addMonths(month, -1)]
  if (period === "year") return monthRange(`${year}-01-01`, `${year}-12-01`)
  const n = { last3: 3, last6: 6, last12: 12 }[period]
  return monthRange(addMonths(month, -(n - 1)), month)
}

const ALERT_ICON = { info: Info, warning: TriangleAlert, danger: CircleAlert, success: CircleCheck }
const ALERT_TONE = {
  info: "border-border bg-muted/50",
  warning: "border-warning/40 bg-warning/10",
  danger: "border-destructive/40 bg-destructive/5 text-destructive",
  success: "border-success/40 bg-success/10",
}

export function OverviewTab() {
  const { data, settings, month, money, openTab } = useFinanceContext()
  const [period, setPeriod] = useState<Period>("current")
  const [year, setYear] = useState(() => Number(month.slice(0, 4)))

  const view = useMemo(() => {
    const months = periodMonths(period, month, year)
    const span = months.length
    const previous = monthRange(addMonths(months[0]!, -span), addMonths(months[0]!, -1))
    const current = aggregate(months.map((m) => monthSummary(m, data)))
    const before = aggregate(previous.map((m) => monthSummary(m, data)))
    const end = months[span - 1]!
    const prevEnd = previous[previous.length - 1]!
    const last12 = monthRange(addMonths(month, -11), month).map((m) => monthSummary(m, data))
    const projection = forecast(month, data)
    return {
      months,
      current,
      before,
      savings: emergencyBalance(data.savings, end),
      savingsBefore: emergencyBalance(data.savings, prevEnd),
      invested: portfolio(data, end).net,
      investedBefore: portfolio(data, prevEnd).net,
      incomeRows: last12.map((s) => ({
        month: s.month,
        income: data.incomes.some((i) => i.received_on.slice(0, 7) === s.month.slice(0, 7) && i.status === "received") ? s.income : null,
      })),
      expenseRows: last12.map((s) => {
        const row = { month: s.month } as { month: string } & Record<Category, number>
        for (const c of CATEGORIES)
          row[c] = data.expenses.filter((e) => e.category === c && e.spent_on.slice(0, 7) === s.month.slice(0, 7)).reduce((a, e) => a + e.amount_cents, 0)
        return row
      }),
      forecastRows: [
        ...last12.slice(-6).map((s) => ({ month: s.month, actualIncome: s.hasData ? s.income : null })),
        ...projection.map((p) => ({ month: p.month, forecastIncome: p.income, forecastExpenses: p.expenses, cumulative: p.cumulative })),
      ],
      estimated: projection.some((p) => p.incomeKind === "estimation"),
      alerts: alerts(month, data, settings, todayISO()),
      rule: monthSummary(month, data).rule,
    }
  }, [data, settings, month, period, year])

  const { current, before } = view
  const shareOf = (c: Category) => {
    const total = CATEGORIES.reduce((s, k) => s + current.allocated[k], 0)
    return total ? Math.round((current.allocated[c] / total) * 1000) / 10 : view.rule[c]
  }

  return (
    <>
      <div className="flex flex-wrap items-center gap-2">
        <NativeSelect aria-label="Période" value={period} onChange={(e) => setPeriod(e.target.value as Period)} className="w-56">
          {Object.entries(PERIODS).map(([v, l]) => (
            <option key={v} value={v}>
              {l}
            </option>
          ))}
        </NativeSelect>
        {period === "year" && (
          <NativeSelect aria-label="Année" value={year} onChange={(e) => setYear(Number(e.target.value))} className="w-32">
            {yearsWithData(data, year).map((y) => (
              <option key={y} value={y}>
                {y}
              </option>
            ))}
          </NativeSelect>
        )}
        <p className="text-sm text-muted-foreground capitalize">
          {view.months.length === 1 ? monthLabel(view.months[0]!) : `${monthLabel(view.months[0]!)} – ${monthLabel(view.months.at(-1)!)}`}
        </p>
      </div>

      {view.alerts.length > 0 && (
        <ul aria-label="Alertes" className="grid gap-2 md:grid-cols-2">
          {view.alerts.map((a: Alert, i) => {
            const Icon = ALERT_ICON[a.level]
            return (
              <li key={i} className={cn("flex items-start gap-2 rounded-lg border px-3 py-2 text-sm", ALERT_TONE[a.level])}>
                <Icon className="mt-0.5 size-4 shrink-0" aria-hidden />
                {a.message}
              </li>
            )
          })}
        </ul>
      )}

      {!current.hasData && (
        <Empty
          title="Aucune donnée financière sur cette période"
          action={<Button onClick={() => openTab("incomes")}>Saisir un revenu</Button>}
        >
          Enregistrez un revenu : sa répartition, vos budgets et les graphiques se calculent automatiquement.
        </Empty>
      )}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
        <StatCard label="Revenus" value={money(current.income)}>
          <Delta current={current.income} previous={before.income} />
          {current.expectedIncome > 0 && <span className="text-xs text-muted-foreground">+ {money(current.expectedIncome)} prévus</span>}
        </StatCard>
        <StatCard label="Dépenses" value={money(current.expenses)}>
          <Delta current={current.expenses} previous={before.expenses} positiveIsGood={false} />
        </StatCard>
        <StatCard label="Budget disponible" value={<span className={cn(current.available < 0 && "text-destructive")}>{money(current.available)}</span>}>
          <Delta current={current.available} previous={before.available} format={(d) => money(d, true)} />
        </StatCard>
        <StatCard label="Taux d'utilisation du budget" value={current.utilization === null ? "—" : `${current.utilization} %`}>
          {current.utilization !== null && before.utilization !== null ? (
            <Delta current={current.utilization} previous={before.utilization} positiveIsGood={false} format={(d) => `${d > 0 ? "+" : ""}${d} pts`} />
          ) : (
            <span className="text-xs text-muted-foreground">Dépenses, épargne et investissements / budget</span>
          )}
        </StatCard>
        <StatCard label="Épargne de sécurité cumulée" value={money(view.savings)} accent="stability">
          <Delta current={view.savings} previous={view.savingsBefore} format={(d) => money(d, true)} />
        </StatCard>
        {CATEGORIES.map((c) => (
          <StatCard key={c} label={`Affecté à ${CATEGORY_LABELS[c].toLowerCase()}`} value={money(current.budget[c])} accent={c}>
            <Delta current={current.budget[c]} previous={before.budget[c]} />
            <span className="text-xs text-muted-foreground">Reste {money(current.remaining[c])}</span>
          </StatCard>
        ))}
        <StatCard label="Investissements cumulés" value={money(view.invested)} accent="growth">
          <Delta current={view.invested} previous={view.investedBefore} format={(d) => money(d, true)} />
          <span className="text-xs text-muted-foreground">Sommes investies, hors valeur de marché</span>
        </StatCard>
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <Panel title="Répartition du revenu" description="Montants affectés à chaque catégorie selon votre règle.">
          {current.income > 0 ? (
            <AllocationDonut allocated={current.allocated} rule={Object.fromEntries(CATEGORIES.map((c) => [c, shareOf(c)])) as Record<Category, number>} />
          ) : (
            <Empty title="Rien à répartir">Aucun revenu reçu sur cette période.</Empty>
          )}
        </Panel>
        <Panel title="Budget prévu et réalisé" description="Prévu, consommé (dépenses, versements, investissements) et restant.">
          <BudgetBars budget={current.budget} consumed={current.consumed} />
        </Panel>
        <Panel title="Revenus sur 12 mois" description="Revenus réellement reçus ; un mois sans revenu enregistré reste vide.">
          <IncomeLine rows={view.incomeRows} />
        </Panel>
        <Panel title="Dépenses mensuelles par catégorie">
          <ExpensesStacked rows={view.expenseRows} />
        </Panel>
      </div>
      <Panel
        title="Prévisions sur 12 mois"
        description={
          view.estimated
            ? "Traits pleins : réel. Pointillés : prévisions. Sans revenu prévisionnel saisi, le revenu est estimé par la moyenne de vos 12 derniers mois."
            : "Traits pleins : réel. Pointillés : prévisions (revenus prévisionnels saisis, dépenses récurrentes et moyenne des dépenses ponctuelles)."
        }
        actions={
          <Button variant="outline" size="sm" onClick={() => openTab("incomes")}>
            Saisir des revenus prévisionnels
          </Button>
        }
      >
        <ForecastChart rows={view.forecastRows} />
      </Panel>
    </>
  )
}
