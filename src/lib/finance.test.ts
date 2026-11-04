import { describe, expect, it } from "vitest"
import {
  addMonths,
  aggregate,
  alerts,
  allocate,
  change,
  coverageMonths,
  DEFAULT_RULE,
  emergencyBalance,
  forecast,
  goalProgress,
  isValidRule,
  monthSummary,
  parseAmount,
  pendingRecurring,
  portfolio,
  ruleFor,
  type FinanceData,
} from "./finance"

const empty = (): FinanceData => ({
  incomes: [],
  expenses: [],
  recurring: [],
  savings: [],
  assets: [],
  investments: [],
  valuations: [],
  transfers: [],
  rules: [],
  goals: [],
  forecasts: [],
})
const income = (amount: number, date: string, status = "received") => ({
  id: date + amount,
  amount_cents: amount,
  received_on: date,
  source: "Salaire",
  status,
  note: null,
})
const expense = (amount: number, date: string, category: "growth" | "stability" | "essentials" | "reward", recurring_id: string | null = null) => ({
  id: date + amount + category,
  amount_cents: amount,
  spent_on: date,
  description: "Achat",
  category,
  subcategory: null,
  payment_method: null,
  note: null,
  recurring_id,
})

describe("montants", () => {
  it("lit les montants saisis en euros et les convertit en centimes", () => {
    expect(parseAmount("1 400,50")).toBe(140050)
    expect(parseAmount("1400.5")).toBe(140050)
    expect(parseAmount("12 €")).toBe(1200)
    expect(parseAmount("0")).toBeNull()
    expect(parseAmount("1,234")).toBeNull()
    expect(parseAmount("-5")).toBeNull()
  })
  it("évolution relative, sans division par zéro", () => {
    expect(change(150, 100)).toBe(50)
    expect(change(50, 0)).toBeNull()
  })
})

describe("répartition", () => {
  it("règle par défaut 25 / 15 / 50 / 10, somme exacte au centime", () => {
    expect(allocate(140000, DEFAULT_RULE)).toEqual({ growth: 35000, stability: 21000, essentials: 70000, reward: 14000 })
    const odd = allocate(100001, { growth: 33.33, stability: 33.33, essentials: 33.34, reward: 0 })
    expect(Object.values(odd).reduce((a, b) => a + b, 0)).toBe(100001)
  })
  it("refuse une règle qui ne totalise pas 100 %", () => {
    expect(isValidRule(DEFAULT_RULE)).toBe(true)
    expect(isValidRule({ growth: 30, stability: 15, essentials: 50, reward: 10 })).toBe(false)
    expect(isValidRule({ growth: 12.5, stability: 12.5, essentials: 50, reward: 25 })).toBe(true)
  })
  it("règle d'un mois : propre au mois, sinon dernière règle en vigueur, anciennes conservées", () => {
    const rules = [
      { month: "2026-03-01", scope: "from", growth: 30, stability: 10, essentials: 50, reward: 10 },
      { month: "2026-05-01", scope: "only", growth: 20, stability: 20, essentials: 50, reward: 10 },
    ]
    expect(ruleFor("2026-02-01", rules)).toMatchObject({ rule: DEFAULT_RULE, source: "default" })
    expect(ruleFor("2026-04-01", rules)).toMatchObject({ rule: { growth: 30 }, source: "from", since: "2026-03-01" })
    expect(ruleFor("2026-05-01", rules)).toMatchObject({ rule: { growth: 20 }, source: "only" })
    expect(ruleFor("2026-06-01", rules)).toMatchObject({ rule: { growth: 30 }, source: "from" })
  })
})

describe("synthèse mensuelle", () => {
  it("plusieurs revenus dans le mois, revenus prévus à part, budgets et consommation par catégorie", () => {
    const data = empty()
    data.incomes = [income(100000, "2026-04-02"), income(40000, "2026-04-20"), income(50000, "2026-04-28", "expected")]
    data.expenses = [expense(30000, "2026-04-05", "essentials"), expense(16000, "2026-04-06", "reward")]
    data.savings = [{ id: "s", kind: "deposit", amount_cents: 10000, occurred_on: "2026-04-10", note: null }]
    data.assets = [{ id: "a", name: "ETF Monde", asset_type: "etf" }]
    data.investments = [{ id: "i", asset_id: "a", kind: "contribution", amount_cents: 20000, fees_cents: 100, occurred_on: "2026-04-11", note: null }]
    const s = monthSummary("2026-04-01", data)
    expect(s.income).toBe(140000)
    expect(s.expectedIncome).toBe(50000)
    expect(s.budget).toEqual({ growth: 35000, stability: 21000, essentials: 70000, reward: 14000 })
    expect(s.consumed).toEqual({ growth: 20100, stability: 10000, essentials: 30000, reward: 16000 })
    expect(s.remaining.reward).toBe(-2000)
    expect(s.expenses).toBe(46000)
    expect(s.available).toBe(140000 - 76100)
    expect(s.utilization).toBe(54)
  })

  it("un mois sans opération n'est pas confondu avec un mois à zéro", () => {
    expect(monthSummary("2026-01-01", empty()).hasData).toBe(false)
  })

  it("reports et transferts internes : aucun double comptage, jamais un revenu", () => {
    const data = empty()
    data.incomes = [income(100000, "2026-04-02"), income(100000, "2026-05-02")]
    data.transfers = [
      { id: "1", month: "2026-04-01", from_category: "reward", action: "next_month", amount_cents: 4000, note: null, created_at: "" },
      { id: "2", month: "2026-04-01", from_category: "essentials", action: "stability", amount_cents: 5000, note: null, created_at: "" },
      { id: "3", month: "2026-04-01", from_category: "reward", action: "keep", amount_cents: 1000, note: null, created_at: "" },
    ]
    const april = monthSummary("2026-04-01", data)
    const may = monthSummary("2026-05-01", data)
    expect(april.budget).toEqual({ growth: 25000, stability: 20000, essentials: 45000, reward: 6000 })
    expect(may.budget.reward).toBe(14000)
    expect(may.income).toBe(100000)
    // Le total des budgets des deux mois reste égal au total des revenus.
    const total = aggregate([april, may])
    expect(Object.values(total.budget).reduce((a, b) => a + b, 0)).toBe(200000)
  })
})

describe("stabilité, croissance, récurrences, objectifs", () => {
  it("solde du fonds d'urgence et mois de dépenses essentielles couverts", () => {
    const data = empty()
    data.savings = [
      { id: "1", kind: "deposit", amount_cents: 300000, occurred_on: "2026-03-01", note: null },
      { id: "2", kind: "withdrawal", amount_cents: 60000, occurred_on: "2026-04-15", note: null },
    ]
    data.expenses = [expense(80000, "2026-04-03", "essentials"), expense(80000, "2026-03-03", "essentials")]
    expect(emergencyBalance(data.savings, "2026-03-01")).toBe(300000)
    expect(emergencyBalance(data.savings)).toBe(240000)
    expect(coverageMonths(data, "2026-04-01")).toBe(3)
  })

  it("sommes investies distinctes de la valeur ; gain seulement si la valeur est connue", () => {
    const data = empty()
    data.assets = [
      { id: "a", name: "ETF", asset_type: "etf" },
      { id: "b", name: "Projet", asset_type: "business" },
    ]
    data.investments = [
      { id: "1", asset_id: "a", kind: "contribution", amount_cents: 100000, fees_cents: 500, occurred_on: "2026-01-10", note: null },
      { id: "2", asset_id: "a", kind: "withdrawal", amount_cents: 20000, fees_cents: 0, occurred_on: "2026-03-10", note: null },
      { id: "3", asset_id: "b", kind: "contribution", amount_cents: 50000, fees_cents: 0, occurred_on: "2026-02-10", note: null },
    ]
    data.valuations = [{ id: "v", asset_id: "a", value_cents: 90000, valued_on: "2026-04-01" }]
    const p = portfolio(data)
    expect(p.net).toBe(130000)
    expect(p.value).toBe(90000)
    expect(p.gain).toBe(90000 - 80000 - 500)
    expect(p.unvalued).toBe(1)
    expect(portfolio(data, "2026-02-01").value).toBeNull()
  })

  it("échéances récurrentes non encore enregistrées, suspendues ou arrêtées exclues", () => {
    const data = empty()
    const base = { amount_cents: 70000, category: "essentials" as const, subcategory: null, payment_method: null, day_of_month: 5 }
    data.recurring = [
      { ...base, id: "loyer", description: "Loyer", start_month: "2026-01-01", end_month: null, paused: false },
      { ...base, id: "salle", description: "Salle", start_month: "2026-01-01", end_month: "2026-02-01", paused: false },
      { ...base, id: "box", description: "Box", start_month: "2026-01-01", end_month: null, paused: true },
    ]
    data.expenses = [expense(70000, "2026-03-05", "essentials", "loyer")]
    expect(pendingRecurring("2026-03-01", data)).toEqual([])
    expect(pendingRecurring("2026-04-01", data).map((p) => [p.recurring.id, p.dueOn])).toEqual([["loyer", "2026-04-05"]])
  })

  it("progression d'un objectif lié au fonds d'urgence", () => {
    const data = empty()
    data.savings = [{ id: "1", kind: "deposit", amount_cents: 50000, occurred_on: "2026-03-01", note: null }]
    const goal = { id: "g", name: "Réserve", target_cents: 100000, current_cents: 0, linked: "stability", due_date: null }
    expect(goalProgress(goal, data)).toEqual({ current: 50000, percent: 50, reached: false })
  })
})

describe("prévisions et alertes", () => {
  it("revenu saisi pour un mois, sinon moyenne historique signalée comme estimation", () => {
    const data = empty()
    data.incomes = [income(140000, "2026-01-05"), income(160000, "2026-02-05")]
    data.forecasts = [{ month: "2026-04-01", amount_cents: 200000 }]
    const rows = forecast("2026-02-01", data, 3)
    expect(rows.map((r) => [r.month, r.income, r.incomeKind])).toEqual([
      ["2026-03-01", 150000, "estimation"],
      ["2026-04-01", 200000, "saisi"],
      ["2026-05-01", 150000, "estimation"],
    ])
    expect(forecast("2026-02-01", empty(), 1)[0]).toMatchObject({ income: null, incomeKind: "inconnu" })
  })

  it("alertes : presque épuisé, dépassement, revenu prévu, mois vide ; désactivables", () => {
    const data = empty()
    data.incomes = [income(100000, "2026-04-02"), income(50000, "2026-04-03", "expected")]
    data.expenses = [expense(46000, "2026-04-05", "essentials"), expense(12000, "2026-04-06", "reward")]
    const settings = { alert_threshold: 80, disabled_alerts: [] as string[], currency: "EUR" }
    const keys = alerts("2026-04-01", data, settings, "2026-04-10").map((a) => a.key)
    expect(keys).toEqual(["near_limit", "overspent", "expected_income"])
    expect(alerts("2026-05-01", data, settings, "2026-05-10").map((a) => a.key)).toEqual(["empty_month"])
    expect(alerts("2026-04-01", data, { ...settings, disabled_alerts: ["overspent"] }, "2026-04-10").map((a) => a.key)).not.toContain("overspent")
  })

  it("navigation entre mois", () => {
    expect(addMonths("2026-01-01", -1)).toBe("2025-12-01")
    expect(addMonths("2026-12-01", 1)).toBe("2027-01-01")
  })
})
