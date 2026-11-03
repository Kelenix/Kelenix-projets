import { describe, expect, it } from "vitest"
import { compareByDueDate, initials, isOverdue, normalize, projectProgress, todayISO, type Task } from "./domain"

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
