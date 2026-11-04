import { describe, expect, it } from "vitest"
import type { Project, Task } from "./domain"
import { display, toCsv } from "./export"
import { buckets, buildReport, toHours } from "./reports"

const h = 3_600_000
const at = (d: number, hour: number, min = 0) => new Date(2026, 10, d, hour, min).toISOString()

const task = (over: Partial<Task>): Task => ({
  id: "t1",
  project_id: "p1",
  title: "Maquettes",
  description: null,
  status: "in_progress",
  priority: "normal",
  assignee_id: null,
  due_date: null,
  is_blocked: false,
  blocked_reason: null,
  created_by: null,
  created_at: "",
  updated_at: "",
  completed_at: null,
  checklist: [],
  assignees: [],
  comment_count: 0,
  link_count: 0,
  tag_ids: [],
  time_entries: [],
  ...over,
})

const project = { id: "p1", name: "Site", status: "in_progress", budget_minutes: 10 * 60 } as Project
const names = new Map([
  ["a", "Alice"],
  ["b", "Bruno"],
])
const tasks = [
  task({
    assignees: [
      { user_id: "a", estimated_minutes: 120 },
      { user_id: "b", estimated_minutes: null },
    ],
    time_entries: [
      { user_id: "a", started_at: at(2, 9), ended_at: at(2, 11), kind: "work" },
      { user_id: "a", started_at: at(2, 11), ended_at: at(2, 11, 30), kind: "pause", pause_reason: "meal" },
      { user_id: "a", started_at: at(3, 9), ended_at: at(3, 10), kind: "work" },
      { user_id: "b", started_at: at(3, 14), ended_at: at(3, 15), kind: "work" },
      // Hors période : ignoré
      { user_id: "a", started_at: at(20, 9), ended_at: at(20, 18), kind: "work" },
    ],
  }),
  task({ id: "t2", status: "done", title: "Recette", time_entries: [] }),
]
// Semaine du lundi 2 au dimanche 8 novembre 2026.
const filters = { from: new Date(2026, 10, 2), to: new Date(2026, 10, 9) }
const input = { tasks, projects: [project], names, filters, now: Date.parse(at(25, 12)) }

describe("buckets", () => {
  it("découpe la période en jours, semaines (du lundi) et mois", () => {
    expect(buckets(filters.from, filters.to, "day")).toHaveLength(7)
    expect(buckets(new Date(2026, 10, 4), new Date(2026, 10, 20), "week").map((b) => b.start.getDate())).toEqual([2, 9, 16])
    expect(buckets(new Date(2026, 0, 1), new Date(2027, 0, 1), "month")).toHaveLength(12)
  })
})

describe("rapports", () => {
  it("heures travaillées par jour et par collaborateur, pauses exclues", () => {
    const r = buildReport("hours", { ...input, granularity: "day" })
    expect(r.columns.map((c) => c.label)).toEqual(["Période", "Alice", "Bruno", "Total"])
    expect(r.rows[0]).toMatchObject({ a: 2 * h, b: 0, total: 2 * h })
    expect(r.rows[1]).toMatchObject({ a: h, b: h, total: 2 * h })
    expect(r.total).toMatchObject({ a: 3 * h, b: h, total: 4 * h })
  })

  it("filtre par collaborateur", () => {
    const r = buildReport("people", { ...input, filters: { ...filters, userId: "b" } })
    expect(r.rows).toEqual([expect.objectContaining({ name: "Bruno", work: h, days: 1 })])
  })

  it("temps par projet et consommation totale du budget", () => {
    const r = buildReport("projects", input)
    // 4 h dans la période ; 13 h au total sur un budget de 10 h.
    expect(r.rows).toEqual([expect.objectContaining({ name: "Site", people: 2, work: 4 * h, pause: h / 2, consumed: 130 })])
  })

  it("temps par tâche, filtré par statut", () => {
    expect(buildReport("tasks", input).rows).toHaveLength(1)
    expect(buildReport("tasks", { ...input, filters: { ...filters, status: "done" } }).rows).toHaveLength(0)
  })

  it("pauses par collaborateur, détaillées par motif", () => {
    const r = buildReport("pauses", input)
    expect(r.rows).toEqual([expect.objectContaining({ name: "Alice", count: 1, total: h / 2, meal: h / 2, rest: 0 })])
  })

  it("estimé et réel par collaborateur affecté (temps réel cumulé)", () => {
    const r = buildReport("estimates", input)
    expect(r.rows).toEqual([expect.objectContaining({ person: "Alice", estimate: 2 * h, actual: 12 * h, gap: 10 * h, consumed: 600 })])
  })

  it("écarts signés lisibles dans le PDF (signes ASCII)", () => {
    const gap = { key: "gap", label: "Écart", kind: "duration" as const, signed: true }
    expect(display(gap, 90 * 60_000)).toBe("+1 h 30")
    expect(display(gap, -10 * 60_000)).toBe("-10 min")
    expect(display(gap, 0)).toBe("0")
  })

  it("heures décimales pour les exports", () => {
    expect(toHours(90 * 60_000)).toBe(1.5)
  })

  it("CSV pour Excel en français : « ; », virgule décimale, durées en heures", () => {
    const csv = toCsv(buildReport("people", input)).split(/\r\n/)
    expect(csv[0]).toBe("Collaborateur;Jours travaillés;Sessions;Tâches;Travail (h);dont facturable (h);Pauses (h);Moyenne par jour travaillé (h)")
    expect(csv[1]).toBe("Alice;2;2;1;3;3;0,5;1,5")
    expect(csv.at(-1)).toBe("Total;;3;;4;4;0,5;")
  })

  it("filtres facturation et validation : seul le travail correspondant est compté", () => {
    const mixed = [
      task({
        time_entries: [
          { user_id: "a", started_at: at(2, 9), ended_at: at(2, 11), kind: "work", billable: true, approved_at: "2026-11-03T08:00:00Z" },
          { user_id: "a", started_at: at(3, 9), ended_at: at(3, 10), kind: "work", billable: false, approved_at: null },
        ],
      }),
    ]
    const base = { ...input, tasks: mixed }
    expect(buildReport("people", base).rows[0]).toMatchObject({ work: 3 * h, billable: 2 * h })
    expect(buildReport("people", { ...base, filters: { ...filters, billing: "not_billable" } }).rows[0]).toMatchObject({ work: h })
    expect(buildReport("people", { ...base, filters: { ...filters, approval: "approved" } }).rows[0]).toMatchObject({ work: 2 * h })
  })

  it("journal d'audit : actions de la période, avec l'auteur des heures et celui de l'action", () => {
    const audit = [
      { entry_id: "e", task_id: "t1", entry_user_id: "a", actor_id: "b", action: "approve", old_value: null, new_value: { started_at: at(2, 9), ended_at: at(2, 11) }, created_at: at(4, 10) },
      { entry_id: "e", task_id: "t1", entry_user_id: "a", actor_id: "a", action: "edit", old_value: null, new_value: null, created_at: at(20, 10) },
    ]
    const r = buildReport("audit", { ...input, audit })
    expect(r.rows).toEqual([expect.objectContaining({ action: "Validation", person: "Alice", actor: "Bruno", task: "Maquettes" })])
  })
})
