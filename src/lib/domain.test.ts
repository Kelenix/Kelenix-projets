import { describe, expect, it } from "vitest"
import { budgetStatus, compareByDueDate, isMilestoneLate, taskCounts, initials, isOverdue, normalize, projectProgress, todayISO, type Task } from "./domain"

const task = (over: Partial<Task>): Task => ({
  id: "1",
  project_id: "p",
  title: "t",
  description: null,
  status: "todo",
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
  time_entries: [],
  ...over,
})

describe("isOverdue", () => {
  const today = "2026-11-02"
  it("échéance dépassée et non terminée → en retard", () => {
    expect(isOverdue({ due_date: "2026-11-01", status: "in_progress" }, today)).toBe(true)
  })
  it("terminée → jamais en retard", () => {
    expect(isOverdue({ due_date: "2026-01-01", status: "done" }, today)).toBe(false)
  })
  it("échéance aujourd'hui ou absente → pas en retard", () => {
    expect(isOverdue({ due_date: today, status: "todo" }, today)).toBe(false)
    expect(isOverdue({ due_date: null, status: "todo" }, today)).toBe(false)
  })
})

describe("projectProgress", () => {
  it("projet sans tâches", () => {
    expect(projectProgress([])).toEqual({ total: 0, done: 0, percent: 0, label: "Aucune tâche" })
  })
  it("pourcentage = tâches terminées / total", () => {
    const tasks = [...Array(8).fill({ status: "done" }), ...Array(4).fill({ status: "todo" })]
    expect(projectProgress(tasks)).toMatchObject({ percent: 67, label: "8 tâches terminées sur 12" })
  })
  it("accord au singulier", () => {
    expect(projectProgress([{ status: "done" }, { status: "todo" }]).label).toBe("1 tâche terminée sur 2")
  })
})

describe("compareByDueDate", () => {
  it("échéance la plus proche d'abord, sans échéance en dernier, puis priorité", () => {
    const sorted = [
      task({ id: "none", due_date: null }),
      task({ id: "late", due_date: "2026-12-01" }),
      task({ id: "soon-low", due_date: "2026-11-05", priority: "low" }),
      task({ id: "soon-high", due_date: "2026-11-05", priority: "high" }),
    ].sort(compareByDueDate)
    expect(sorted.map((t) => t.id)).toEqual(["soon-high", "soon-low", "late", "none"])
  })
})

describe("utilitaires", () => {
  it("todayISO utilise le fuseau local", () => {
    expect(todayISO(new Date(2026, 10, 2, 23, 30))).toBe("2026-11-02")
  })
  it("initials ignore les mentions entre parenthèses", () => {
    expect(initials("Sam Leroy (démo)")).toBe("SL")
  })
  it("normalize retire accents et casse", () => {
    expect(normalize("Écran Équipe")).toBe("ecran equipe")
  })
})

describe("budgetStatus", () => {
  it("alerte à 80 % et signale le dépassement", () => {
    expect(budgetStatus(0, null)).toBeNull()
    expect(budgetStatus(7 * 3_600_000, 10 * 60)).toMatchObject({ percent: 70, level: "ok", overMs: 0 })
    expect(budgetStatus(8 * 3_600_000, 10 * 60)).toMatchObject({ percent: 80, level: "warning" })
    expect(budgetStatus(12 * 3_600_000, 10 * 60)).toMatchObject({ percent: 120, level: "over", overMs: 2 * 3_600_000 })
  })
})

describe("taskCounts et jalons", () => {
  it("compte terminées, en cours et en retard", () => {
    const counts = taskCounts(
      [
        { status: "done", due_date: "2026-01-01" },
        { status: "in_progress", due_date: "2026-10-01" },
        { status: "rescheduled", due_date: null },
        { status: "todo", due_date: "2026-10-01" },
      ],
      "2026-11-02"
    )
    expect(counts).toEqual({ done: 1, inProgress: 1, late: 2 })
  })
  it("un jalon est en retard s'il n'est pas atteint à son échéance", () => {
    expect(isMilestoneLate({ due_date: "2026-11-01", done_at: null }, "2026-11-02")).toBe(true)
    expect(isMilestoneLate({ due_date: "2026-11-01", done_at: "2026-11-01T10:00:00Z" }, "2026-11-02")).toBe(false)
    expect(isMilestoneLate({ due_date: "2026-11-02", done_at: null }, "2026-11-02")).toBe(false)
  })
})
