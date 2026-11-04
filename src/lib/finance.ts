// Logique financière (sans interface) : montants en centimes entiers, mois au format « AAAA-MM-01 ».
import type { Enums, Tables } from "@/lib/database.types"

export type Category = Enums<"fin_category">
export type Rule = Record<Category, number>
export type RuleRow = Pick<Tables<"fin_allocation_rules">, "month" | "scope" | Category>
export type Income = Pick<Tables<"fin_incomes">, "id" | "amount_cents" | "received_on" | "source" | "status" | "note">
export type Expense = Pick<
  Tables<"fin_expenses">,
  "id" | "amount_cents" | "spent_on" | "description" | "category" | "subcategory" | "payment_method" | "note" | "recurring_id"
>
export type Recurring = Pick<
  Tables<"fin_recurring_expenses">,
  "id" | "amount_cents" | "description" | "category" | "subcategory" | "payment_method" | "day_of_month" | "start_month" | "end_month" | "paused"
>
export type SavingsMovement = Pick<Tables<"fin_savings_movements">, "id" | "kind" | "amount_cents" | "occurred_on" | "note">
export type Asset = Pick<Tables<"fin_assets">, "id" | "name" | "asset_type">
export type InvestmentMovement = Pick<
  Tables<"fin_investment_movements">,
  "id" | "asset_id" | "kind" | "amount_cents" | "fees_cents" | "occurred_on" | "note"
>
export type Valuation = Pick<Tables<"fin_asset_valuations">, "id" | "asset_id" | "value_cents" | "valued_on">
export type Transfer = Pick<Tables<"fin_transfers">, "id" | "month" | "from_category" | "action" | "amount_cents" | "note" | "created_at">
export type Goal = Pick<Tables<"fin_goals">, "id" | "name" | "target_cents" | "current_cents" | "linked" | "due_date">
export type Forecast = Pick<Tables<"fin_forecasts">, "month" | "amount_cents">
export type TransferAction = "next_month" | "growth" | "stability" | "keep"

/** Toutes les données financières de l'utilisateur, chargées une fois et partagées par les vues. */
export type FinanceData = {
  incomes: Income[]
  expenses: Expense[]
  recurring: Recurring[]
  savings: SavingsMovement[]
  assets: Asset[]
  investments: InvestmentMovement[]
  valuations: Valuation[]
  transfers: Transfer[]
  rules: RuleRow[]
  goals: Goal[]
  forecasts: Forecast[]
}

export const CATEGORIES: Category[] = ["growth", "stability", "essentials", "reward"]
export const CATEGORY_LABELS: Record<Category, string> = {
  growth: "Croissance",
  stability: "Stabilité",
  essentials: "Essentiels",
  reward: "Récompense",
}
export const CATEGORY_HINTS: Record<Category, string> = {
  growth: "Investissements, actions, ETF, projets, actifs productifs",
  stability: "Fonds d'urgence, épargne de précaution, imprévus",
  essentials: "Loyer, courses, transport, énergie, Internet, téléphone, santé",
  reward: "Restaurants, voyages, loisirs, shopping",
}
export const DEFAULT_RULE: Rule = { growth: 25, stability: 15, essentials: 50, reward: 10 }
export const ASSET_TYPES: Record<string, string> = {
  stocks: "Actions",
  etf: "ETF",
  business: "Projet entrepreneurial",
  real_estate: "Immobilier",
  crypto: "Crypto-actifs",
  other: "Autre",
}
export const TRANSFER_ACTIONS: Record<TransferAction, string> = {
  next_month: "Reporter sur le mois suivant",
  growth: "Transférer vers Croissance",
  stability: "Transférer vers Stabilité",
  keep: "Laisser disponible, sans nouvelle affectation",
}

// ─── Mois ───────────────────────────────────────────────────────────────────
export const monthOf = (date: string) => `${date.slice(0, 7)}-01`
export function addMonths(month: string, n: number) {
  const [y, m] = month.split("-").map(Number)
  const d = new Date(Date.UTC(y!, m! - 1 + n, 1))
  return d.toISOString().slice(0, 10)
}
export const currentMonth = (now = new Date()) =>
  `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-01`
export function monthLabel(month: string, style: "long" | "short" = "long") {
  const [y, m] = month.split("-").map(Number)
  return new Date(y!, m! - 1, 1).toLocaleDateString("fr-FR", style === "long" ? { month: "long", year: "numeric" } : { month: "short" })
}
/** Mois [from, to] inclus, du plus ancien au plus récent. */
export function monthRange(from: string, to: string) {
  const months: string[] = []
  for (let m = from; m <= to; m = addMonths(m, 1)) months.push(m)
  return months
}
const inMonth = (date: string, month: string) => date.slice(0, 7) === month.slice(0, 7)
const lastDay = (month: string) => addMonths(month, 1) // borne exclue

// ─── Montants ───────────────────────────────────────────────────────────────
/** « 1 400,50 », « 1400.5 » → 140050 centimes ; `null` si invalide ou hors limites. */
export function parseAmount(input: string) {
  const text = input.replace(/[\s  €]/g, "").replace(",", ".")
  if (!/^\d+(\.\d{1,2})?$/.test(text)) return null
  const [units, decimals = ""] = text.split(".")
  const cents = Number(units) * 100 + Number(decimals.padEnd(2, "0"))
  return cents >= 1 && cents <= 100_000_000_000 ? cents : null
}

export function formatMoney(cents: number, currency = "EUR", options: { signed?: boolean } = {}) {
  const text = new Intl.NumberFormat("fr-FR", { style: "currency", currency }).format(cents / 100)
  return options.signed && cents > 0 ? `+${text}` : text
}

// ─── Répartition ────────────────────────────────────────────────────────────
export const ruleTotal = (rule: Rule) => Math.round(CATEGORIES.reduce((s, c) => s + rule[c] * 100, 0)) / 100
export const isValidRule = (rule: Rule) => CATEGORIES.every((c) => rule[c] >= 0 && rule[c] <= 100) && ruleTotal(rule) === 100

/**
 * Répartit un montant selon la règle, au centime, sans perte : les centimes restants après
 * arrondi vont aux plus grands restes, pour que la somme égale exactement le montant.
 */
export function allocate(totalCents: number, rule: Rule): Record<Category, number> {
  // Calcul entier en points de base (25,5 % → 2550) : aucun arrondi flottant.
  const products = CATEGORIES.map((c) => totalCents * Math.round(rule[c] * 100))
  const result = products.map((p) => Math.floor(p / 10_000))
  let left = totalCents - result.reduce((a, b) => a + b, 0)
  const order = products.map((p, i) => ({ i, rest: p % 10_000 })).sort((a, b) => b.rest - a.rest || a.i - b.i)
  for (const { i } of order) {
    if (left <= 0) break
    result[i]!++
    left--
  }
  return Object.fromEntries(CATEGORIES.map((c, i) => [c, result[i]!])) as Record<Category, number>
}

const toRule = (r: Pick<RuleRow, Category>): Rule =>
  Object.fromEntries(CATEGORIES.map((c) => [c, Number(r[c])])) as Rule

/** Règle d'un mois : sa répartition propre, sinon la dernière règle par défaut en vigueur, sinon 25/15/50/10. */
export function ruleFor(month: string, rules: RuleRow[]): { rule: Rule; source: "only" | "from" | "default"; since?: string } {
  const only = rules.find((r) => r.scope === "only" && r.month === month)
  if (only) return { rule: toRule(only), source: "only" }
  const from = rules
    .filter((r) => r.scope === "from" && r.month <= month)
    .sort((a, b) => b.month.localeCompare(a.month))[0]
  return from ? { rule: toRule(from), source: "from", since: from.month } : { rule: DEFAULT_RULE, source: "default" }
}

// ─── Synthèse d'un mois ─────────────────────────────────────────────────────
const zero = (): Record<Category, number> => ({ growth: 0, stability: 0, essentials: 0, reward: 0 })
const sum = <T>(items: T[], f: (x: T) => number) => items.reduce((s, x) => s + f(x), 0)

export type MonthSummary = {
  month: string
  /** Au moins une opération enregistrée (un mois à 0 € saisi n'est pas un mois vide). */
  hasData: boolean
  income: number
  expectedIncome: number
  rule: Rule
  ruleSource: "only" | "from" | "default"
  /** Montant affecté par la règle (sur les revenus reçus). */
  allocated: Record<Category, number>
  /** Reports et transferts internes (+ reçu, − cédé). */
  adjustments: Record<Category, number>
  /** Budget = affecté + ajustements. */
  budget: Record<Category, number>
  /** Consommé : dépenses ; plus versements d'épargne (Stabilité) et investissements avec frais (Croissance). */
  consumed: Record<Category, number>
  remaining: Record<Category, number>
  expenses: number
  savingsDeposits: number
  investmentContributions: number
  available: number
  /** Part du budget consommée (%), `null` sans budget. */
  utilization: number | null
}

export function monthSummary(month: string, data: FinanceData): MonthSummary {
  const incomes = data.incomes.filter((i) => inMonth(i.received_on, month))
  const income = sum(incomes.filter((i) => i.status === "received"), (i) => i.amount_cents)
  const expectedIncome = sum(incomes.filter((i) => i.status === "expected"), (i) => i.amount_cents)
  const { rule, source } = ruleFor(month, data.rules)
  const allocated = allocate(income, rule)

  const adjustments = zero()
  for (const t of data.transfers) {
    if (t.month === addMonths(month, -1) && t.action === "next_month") adjustments[t.from_category] += t.amount_cents
    if (t.month !== month || t.action === "keep") continue
    adjustments[t.from_category] -= t.amount_cents
    if (t.action === "growth" || t.action === "stability") adjustments[t.action] += t.amount_cents
  }

  const expenses = data.expenses.filter((e) => inMonth(e.spent_on, month))
  const deposits = sum(data.savings.filter((s) => s.kind === "deposit" && inMonth(s.occurred_on, month)), (s) => s.amount_cents)
  const contributions = sum(
    data.investments.filter((i) => i.kind === "contribution" && inMonth(i.occurred_on, month)),
    (i) => i.amount_cents + i.fees_cents
  )
  const consumed = zero()
  for (const e of expenses) consumed[e.category] += e.amount_cents
  consumed.stability += deposits
  consumed.growth += contributions

  const budget = zero()
  const remaining = zero()
  for (const c of CATEGORIES) {
    budget[c] = allocated[c] + adjustments[c]
    remaining[c] = budget[c] - consumed[c]
  }
  const totalBudget = sum(CATEGORIES, (c) => budget[c])
  const totalConsumed = sum(CATEGORIES, (c) => consumed[c])
  const hasData =
    incomes.length > 0 ||
    expenses.length > 0 ||
    data.savings.some((s) => inMonth(s.occurred_on, month)) ||
    data.investments.some((i) => inMonth(i.occurred_on, month))

  return {
    month,
    hasData,
    income,
    expectedIncome,
    rule,
    ruleSource: source,
    allocated,
    adjustments,
    budget,
    consumed,
    remaining,
    expenses: sum(expenses, (e) => e.amount_cents),
    savingsDeposits: deposits,
    investmentContributions: contributions,
    available: totalBudget - totalConsumed,
    utilization: totalBudget > 0 ? Math.round((totalConsumed / totalBudget) * 100) : null,
  }
}

/** Cumul de plusieurs mois (filtres « 3, 6, 12 derniers mois », année). */
export function aggregate(summaries: MonthSummary[]) {
  const add = (key: "allocated" | "budget" | "consumed" | "remaining") => {
    const total = zero()
    for (const s of summaries) for (const c of CATEGORIES) total[c] += s[key][c]
    return total
  }
  const budget = add("budget")
  const consumed = add("consumed")
  const totalBudget = sum(CATEGORIES, (c) => budget[c])
  return {
    hasData: summaries.some((s) => s.hasData),
    income: sum(summaries, (s) => s.income),
    expectedIncome: sum(summaries, (s) => s.expectedIncome),
    expenses: sum(summaries, (s) => s.expenses),
    savingsDeposits: sum(summaries, (s) => s.savingsDeposits),
    investmentContributions: sum(summaries, (s) => s.investmentContributions),
    allocated: add("allocated"),
    budget,
    consumed,
    remaining: add("remaining"),
    available: sum(summaries, (s) => s.available),
    utilization: totalBudget > 0 ? Math.round((sum(CATEGORIES, (c) => consumed[c]) / totalBudget) * 100) : null,
  }
}
export type PeriodSummary = ReturnType<typeof aggregate>

/** Évolution relative (%) entre deux valeurs ; `null` si la référence est nulle. */
export const change = (current: number, previous: number) =>
  previous === 0 ? null : Math.round(((current - previous) / Math.abs(previous)) * 100)

// ─── Stabilité ──────────────────────────────────────────────────────────────
/** Solde du fonds d'urgence à la fin du mois donné (ou à ce jour). */
export function emergencyBalance(savings: SavingsMovement[], untilMonth?: string) {
  const end = untilMonth ? lastDay(untilMonth) : "9999-12-31"
  return sum(
    savings.filter((s) => s.occurred_on < end),
    (s) => (s.kind === "deposit" ? s.amount_cents : -s.amount_cents)
  )
}

/** Mois de dépenses essentielles couverts : solde / moyenne des dépenses essentielles des 3 derniers mois renseignés. */
export function coverageMonths(data: FinanceData, month: string) {
  const months = [0, 1, 2].map((i) => addMonths(month, -i))
  const totals = months
    .map((m) => sum(data.expenses.filter((e) => e.category === "essentials" && inMonth(e.spent_on, m)), (e) => e.amount_cents))
    .filter((v) => v > 0)
  if (totals.length === 0) return null
  const average = sum(totals, (v) => v) / totals.length
  return Math.round((emergencyBalance(data.savings, month) / average) * 10) / 10
}

// ─── Croissance ─────────────────────────────────────────────────────────────
/**
 * Sommes investies (versements − retraits), frais, et valeur des actifs à la fin du mois.
 * La valeur n'est connue que pour les actifs dont une valorisation est saisie : le gain ou la perte
 * n'est calculé que sur ceux-là, jamais en confondant versement et gain.
 */
export function portfolio(data: FinanceData, untilMonth?: string) {
  const end = untilMonth ? lastDay(untilMonth) : "9999-12-31"
  const assets = data.assets.map((asset) => {
    const moves = data.investments.filter((i) => i.asset_id === asset.id && i.occurred_on < end)
    const contributed = sum(moves.filter((m) => m.kind === "contribution"), (m) => m.amount_cents)
    const withdrawn = sum(moves.filter((m) => m.kind === "withdrawal"), (m) => m.amount_cents)
    const fees = sum(moves, (m) => m.fees_cents)
    const latest = data.valuations
      .filter((v) => v.asset_id === asset.id && v.valued_on < end)
      .sort((a, b) => b.valued_on.localeCompare(a.valued_on))[0]
    const net = contributed - withdrawn
    const value = latest?.value_cents ?? null
    return { asset, contributed, withdrawn, fees, net, value, valuedOn: latest?.valued_on ?? null, gain: value === null ? null : value - net - fees }
  })
  const valued = assets.filter((a) => a.value !== null)
  return {
    assets,
    contributed: sum(assets, (a) => a.contributed),
    withdrawn: sum(assets, (a) => a.withdrawn),
    fees: sum(assets, (a) => a.fees),
    net: sum(assets, (a) => a.net),
    value: valued.length ? sum(valued, (a) => a.value!) : null,
    gain: valued.length ? sum(valued, (a) => a.gain!) : null,
    unvalued: assets.length - valued.length,
  }
}

// ─── Dépenses récurrentes ───────────────────────────────────────────────────
/** Échéances récurrentes du mois non encore enregistrées comme dépenses. */
export function pendingRecurring(month: string, data: FinanceData) {
  return data.recurring
    .filter((r) => !r.paused && r.start_month <= month && (!r.end_month || r.end_month >= month))
    .filter((r) => !data.expenses.some((e) => e.recurring_id === r.id && inMonth(e.spent_on, month)))
    .map((r) => ({ recurring: r, dueOn: `${month.slice(0, 8)}${String(r.day_of_month).padStart(2, "0")}` }))
}

// ─── Objectifs ──────────────────────────────────────────────────────────────
export function goalProgress(goal: Goal, data: FinanceData) {
  const current =
    goal.linked === "stability"
      ? emergencyBalance(data.savings)
      : goal.linked === "growth"
        ? Math.max(0, portfolio(data).net)
        : goal.current_cents
  return { current, percent: Math.min(100, Math.round((current / goal.target_cents) * 100)), reached: current >= goal.target_cents }
}

// ─── Prévisions ─────────────────────────────────────────────────────────────
/**
 * Projection des 12 mois suivant `month` : revenu saisi pour le mois s'il existe, sinon moyenne
 * des revenus reçus des 12 derniers mois renseignés (estimation signalée) ; dépenses = échéances
 * récurrentes actives + moyenne des dépenses ponctuelles des 6 derniers mois.
 */
export function forecast(month: string, data: FinanceData, horizon = 12) {
  const past = monthRange(addMonths(month, -11), month).map((m) => monthSummary(m, data))
  const withIncome = past.filter((s) => s.income > 0)
  const averageIncome = withIncome.length ? Math.round(sum(withIncome, (s) => s.income) / withIncome.length) : null
  const recent = monthRange(addMonths(month, -5), month)
  const oneOff = recent.map((m) =>
    sum(data.expenses.filter((e) => !e.recurring_id && inMonth(e.spent_on, m)), (e) => e.amount_cents)
  )
  const filled = oneOff.filter((v) => v > 0)
  const averageOneOff = filled.length ? Math.round(sum(filled, (v) => v) / filled.length) : 0
  let cumulative = 0
  return monthRange(addMonths(month, 1), addMonths(month, horizon)).map((m) => {
    const entered = data.forecasts.find((f) => f.month === m)
    const income = entered ? entered.amount_cents : averageIncome
    const recurring = sum(
      data.recurring.filter((r) => !r.paused && r.start_month <= m && (!r.end_month || r.end_month >= m)),
      (r) => r.amount_cents
    )
    const expenses = recurring + averageOneOff
    const net = income === null ? null : income - expenses
    if (net !== null) cumulative += net
    return {
      month: m,
      income,
      incomeKind: entered ? ("saisi" as const) : income === null ? ("inconnu" as const) : ("estimation" as const),
      expenses,
      net,
      cumulative: net === null ? null : cumulative,
      allocated: income === null ? null : allocate(income, ruleFor(m, data.rules).rule),
    }
  })
}

// ─── Alertes ────────────────────────────────────────────────────────────────
export type AlertKey = "near_limit" | "overspent" | "recurring" | "expected_income" | "goal_reached" | "empty_month"
export const ALERT_LABELS: Record<AlertKey, string> = {
  near_limit: "Budget presque épuisé",
  overspent: "Dépassement de budget",
  recurring: "Dépense récurrente prévue",
  expected_income: "Revenu prévu non reçu",
  goal_reached: "Objectif atteint",
  empty_month: "Mois sans données",
}
export type Alert = { key: AlertKey; level: "info" | "warning" | "danger" | "success"; message: string }

export function alerts(
  month: string,
  data: FinanceData,
  settings: { alert_threshold: number; disabled_alerts: string[]; currency: string },
  today: string
): Alert[] {
  const s = monthSummary(month, data)
  const money = (c: number) => formatMoney(c, settings.currency)
  const list: Alert[] = []
  for (const c of CATEGORIES) {
    if (s.consumed[c] > s.budget[c])
      list.push({ key: "overspent", level: "danger", message: `${CATEGORY_LABELS[c]} : budget dépassé de ${money(s.consumed[c] - s.budget[c])}.` })
    else if (s.budget[c] > 0 && (s.consumed[c] / s.budget[c]) * 100 >= settings.alert_threshold)
      list.push({
        key: "near_limit",
        level: "warning",
        message: `${CATEGORY_LABELS[c]} : ${Math.round((s.consumed[c] / s.budget[c]) * 100)} % du budget utilisé.`,
      })
  }
  for (const p of pendingRecurring(month, data))
    list.push({ key: "recurring", level: "info", message: `${p.recurring.description} (${money(p.recurring.amount_cents)}) prévue le ${p.dueOn.split("-").reverse().join("/")}.` })
  for (const i of data.incomes.filter((i) => i.status === "expected" && inMonth(i.received_on, month) && i.received_on <= today))
    list.push({ key: "expected_income", level: "warning", message: `Revenu prévu non confirmé : ${i.source} (${money(i.amount_cents)}).` })
  for (const g of data.goals)
    if (goalProgress(g, data).reached) list.push({ key: "goal_reached", level: "success", message: `Objectif atteint : ${g.name}.` })
  if (!data.incomes.some((i) => inMonth(i.received_on, month)))
    list.push({ key: "empty_month", level: "info", message: `Aucun revenu enregistré pour ${monthLabel(month)}.` })
  return list.filter((a) => !settings.disabled_alerts.includes(a.key))
}
