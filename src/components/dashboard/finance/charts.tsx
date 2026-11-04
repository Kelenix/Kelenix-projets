"use client"

import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ComposedChart,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  type TooltipContentProps,
} from "recharts"
import type { NameType, ValueType } from "recharts/types/component/DefaultTooltipContent"
import { CATEGORIES, CATEGORY_LABELS, monthLabel, type Category } from "@/lib/finance"
import { CATEGORY_COLOR, useMoney } from "./ui"

const AXIS = { stroke: "var(--muted-foreground)", fontSize: 11, tickLine: false, axisLine: false } as const
const GRID = <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" vertical={false} />

/** Info-bulle aux couleurs du thème (survol à la souris, toucher sur mobile). */
function ChartTooltip({ active, payload, label }: TooltipContentProps<ValueType, NameType>) {
  const money = useMoney()
  if (!active || !payload?.length) return null
  return (
    <div className="rounded-lg border bg-popover px-3 py-2 text-xs text-popover-foreground shadow-md">
      {label !== undefined && <p className="mb-1 font-medium capitalize">{typeof label === "string" && /^\d{4}-\d{2}-01$/.test(label) ? monthLabel(label) : label}</p>}
      <ul className="space-y-0.5">
        {payload
          .filter((p) => p.value !== null && p.value !== undefined)
          .map((p) => (
            <li key={String(p.dataKey ?? p.name)} className="flex items-center gap-2">
              <span aria-hidden className="size-2 rounded-full" style={{ backgroundColor: p.color ?? p.payload?.fill }} />
              <span className="text-muted-foreground">{p.name}</span>
              <span className="ml-auto pl-3 font-medium tabular-nums">{money(Number(p.value))}</span>
            </li>
          ))}
      </ul>
    </div>
  )
}

const tickMonth = (m: string) => monthLabel(m, "short")
const compact = (cents: number) =>
  new Intl.NumberFormat("fr-FR", { notation: "compact", maximumFractionDigits: 1 }).format(cents / 100)

function Frame({ height = 260, label, children }: { height?: number; label: string; children: React.ReactElement }) {
  return (
    <figure aria-label={label} className="w-full" style={{ height }}>
      <ResponsiveContainer width="100%" height="100%">
        {children}
      </ResponsiveContainer>
    </figure>
  )
}

/** 1 — Répartition du revenu entre les quatre catégories (anneau). */
export function AllocationDonut({ allocated, rule }: { allocated: Record<Category, number>; rule: Record<Category, number> }) {
  const money = useMoney()
  const data = CATEGORIES.map((c) => ({ name: CATEGORY_LABELS[c], value: allocated[c], fill: CATEGORY_COLOR[c], pct: rule[c], category: c }))
  const total = data.reduce((s, d) => s + d.value, 0)
  return (
    <div className="grid items-center gap-4 sm:grid-cols-2">
      <div className="relative">
        <Frame height={220} label="Répartition mensuelle du revenu">
          <PieChart>
            <Pie data={data} dataKey="value" nameKey="name" innerRadius="62%" outerRadius="92%" paddingAngle={2} stroke="none" isAnimationActive={false}>
              {data.map((d) => (
                <Cell key={d.category} fill={d.fill} />
              ))}
            </Pie>
            <Tooltip content={ChartTooltip} />
          </PieChart>
        </Frame>
        <div className="pointer-events-none absolute inset-0 grid place-items-center text-center">
          <div>
            <p className="text-xs text-muted-foreground">Réparti</p>
            <p className="text-lg font-semibold tabular-nums">{money(total)}</p>
          </div>
        </div>
      </div>
      <ul className="space-y-2 text-sm">
        {data.map((d) => (
          <li key={d.category} className="flex items-center gap-2">
            <span aria-hidden className="size-2.5 rounded-full" style={{ backgroundColor: d.fill }} />
            <span>{d.name}</span>
            <span className="text-muted-foreground">{d.pct} %</span>
            <span className="ml-auto font-medium tabular-nums">{money(d.value)}</span>
          </li>
        ))}
      </ul>
    </div>
  )
}

/** 2 — Revenus réellement reçus sur 12 mois (les mois sans revenu restent vides, pas à zéro). */
export function IncomeLine({ rows }: { rows: { month: string; income: number | null }[] }) {
  return (
    <Frame label="Évolution des revenus sur 12 mois">
      <LineChart data={rows} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
        {GRID}
        <XAxis dataKey="month" tickFormatter={tickMonth} {...AXIS} />
        <YAxis tickFormatter={compact} width={44} {...AXIS} />
        <Tooltip content={ChartTooltip} />
        <Line dataKey="income" name="Revenus" stroke="var(--fin-growth)" strokeWidth={2.5} dot={{ r: 3 }} connectNulls={false} isAnimationActive={false} />
      </LineChart>
    </Frame>
  )
}

/** 3 — Budget prévu, consommé et restant par catégorie. */
export function BudgetBars({ budget, consumed }: { budget: Record<Category, number>; consumed: Record<Category, number> }) {
  const data = CATEGORIES.map((c) => ({
    name: CATEGORY_LABELS[c],
    budget: budget[c],
    consumed: consumed[c],
    remaining: Math.max(0, budget[c] - consumed[c]),
  }))
  return (
    <Frame label="Budget prévu et réalisé par catégorie">
      <BarChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }} barGap={2}>
        {GRID}
        <XAxis dataKey="name" {...AXIS} />
        <YAxis tickFormatter={compact} width={44} {...AXIS} />
        <Tooltip content={ChartTooltip} cursor={{ fill: "var(--muted)" }} />
        <Legend wrapperStyle={{ fontSize: 12 }} />
        <Bar dataKey="budget" name="Prévu" fill="var(--fin-essentials)" radius={[4, 4, 0, 0]} isAnimationActive={false} />
        <Bar dataKey="consumed" name="Consommé ou affecté" fill="var(--fin-growth)" radius={[4, 4, 0, 0]} isAnimationActive={false} />
        <Bar dataKey="remaining" name="Restant" fill="var(--fin-stability)" radius={[4, 4, 0, 0]} isAnimationActive={false} />
      </BarChart>
    </Frame>
  )
}

/** 4 — Solde du fonds d'urgence sur 12 mois, avec l'objectif. */
export function SavingsArea({ rows, goal }: { rows: { month: string; balance: number }[]; goal: number | null }) {
  return (
    <Frame label="Évolution du fonds d'urgence">
      <AreaChart data={rows.map((r) => ({ ...r, goal }))} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
        {GRID}
        <XAxis dataKey="month" tickFormatter={tickMonth} {...AXIS} />
        <YAxis tickFormatter={compact} width={44} {...AXIS} />
        <Tooltip content={ChartTooltip} />
        <Area dataKey="balance" name="Solde" stroke="var(--fin-stability)" fill="var(--fin-stability)" fillOpacity={0.15} strokeWidth={2.5} isAnimationActive={false} />
        {goal !== null && <Line dataKey="goal" name="Objectif" stroke="var(--muted-foreground)" strokeDasharray="5 4" dot={false} isAnimationActive={false} />}
      </AreaChart>
    </Frame>
  )
}

/** 5 — Patrimoine : versements et retraits du mois, sommes investies cumulées, valeur renseignée des actifs. */
export function WealthChart({ rows }: { rows: { month: string; contributions: number; withdrawals: number; net: number; value: number | null }[] }) {
  return (
    <Frame height={280} label="Croissance du patrimoine">
      <ComposedChart data={rows.map((r) => ({ ...r, withdrawals: -r.withdrawals }))} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
        {GRID}
        <XAxis dataKey="month" tickFormatter={tickMonth} {...AXIS} />
        <YAxis tickFormatter={compact} width={44} {...AXIS} />
        <Tooltip content={ChartTooltip} />
        <Legend wrapperStyle={{ fontSize: 12 }} />
        <Bar dataKey="contributions" name="Versements du mois" fill="var(--fin-growth)" radius={[4, 4, 0, 0]} isAnimationActive={false} />
        <Bar dataKey="withdrawals" name="Retraits du mois" fill="var(--destructive)" radius={[0, 0, 4, 4]} isAnimationActive={false} />
        <Line dataKey="net" name="Sommes investies (cumul)" stroke="var(--fin-essentials)" strokeWidth={2} dot={false} isAnimationActive={false} />
        <Line dataKey="value" name="Valeur des actifs (renseignée)" stroke="var(--fin-stability)" strokeWidth={2.5} connectNulls dot={{ r: 3 }} isAnimationActive={false} />
      </ComposedChart>
    </Frame>
  )
}

/** 6 — Dépenses mensuelles empilées par catégorie. */
export function ExpensesStacked({ rows }: { rows: ({ month: string } & Record<Category, number>)[] }) {
  return (
    <Frame label="Dépenses mensuelles par catégorie">
      <BarChart data={rows} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
        {GRID}
        <XAxis dataKey="month" tickFormatter={tickMonth} {...AXIS} />
        <YAxis tickFormatter={compact} width={44} {...AXIS} />
        <Tooltip content={ChartTooltip} cursor={{ fill: "var(--muted)" }} />
        <Legend wrapperStyle={{ fontSize: 12 }} />
        {CATEGORIES.map((c, i) => (
          <Bar
            key={c}
            dataKey={c}
            name={CATEGORY_LABELS[c]}
            stackId="expenses"
            fill={CATEGORY_COLOR[c]}
            radius={i === CATEGORIES.length - 1 ? [4, 4, 0, 0] : 0}
            isAnimationActive={false}
          />
        ))}
      </BarChart>
    </Frame>
  )
}

/**
 * 7 — Prévisions : revenus réels (trait plein) puis prévus (pointillés), dépenses prévues et
 * solde cumulé projeté. Les estimations par moyenne historique sont signalées dans l'info-bulle.
 */
export function ForecastChart({
  rows,
}: {
  rows: { month: string; actualIncome?: number | null; forecastIncome?: number | null; forecastExpenses?: number | null; cumulative?: number | null }[]
}) {
  return (
    <Frame height={280} label="Prévisions sur 12 mois">
      <ComposedChart data={rows} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
        {GRID}
        <XAxis dataKey="month" tickFormatter={tickMonth} {...AXIS} />
        <YAxis tickFormatter={compact} width={44} {...AXIS} />
        <Tooltip content={ChartTooltip} />
        <Legend wrapperStyle={{ fontSize: 12 }} />
        <Line dataKey="actualIncome" name="Revenus réels" stroke="var(--fin-growth)" strokeWidth={2.5} dot={{ r: 3 }} isAnimationActive={false} />
        <Line
          dataKey="forecastIncome"
          name="Revenus prévus"
          stroke="var(--fin-growth)"
          strokeWidth={2}
          strokeDasharray="6 4"
          dot={{ r: 3, fillOpacity: 0 }}
          isAnimationActive={false}
        />
        <Line dataKey="forecastExpenses" name="Dépenses prévues" stroke="var(--fin-reward)" strokeWidth={2} strokeDasharray="6 4" dot={false} isAnimationActive={false} />
        <Area dataKey="cumulative" name="Solde cumulé projeté" stroke="var(--fin-stability)" fill="var(--fin-stability)" fillOpacity={0.1} strokeDasharray="6 4" isAnimationActive={false} />
      </ComposedChart>
    </Frame>
  )
}
