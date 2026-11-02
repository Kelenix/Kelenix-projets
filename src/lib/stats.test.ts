import { describe, expect, it } from "vitest"
import type { Profile, Task } from "./domain"
import { memberStats, startOfWeek, statusCounts, weeklyCompletions } from "./stats"

const task = (over: Partial<Task>): Task => ({
  id: Math.random().toString(36),
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
  time_entries: [],
  ...over,
})

const profile = (id: string, full_name: string): Profile => ({ id, full_name, email: `${id}@x.test`, role: "collaborator", created_at: "" })

describe("startOfWeek", () => {
  it("renvoie le lundi de la semaine", () => {
    expect(startOfWeek(new Date(2026, 10, 2)).getDate()).toBe(2) // lundi 2 nov.
    expect(startOfWeek(new Date(2026, 10, 8, 22)).getDate()).toBe(2) // dimanche 8 nov.
  })
})

describe("weeklyCompletions", () => {
  const now = new Date(2026, 10, 4) // mercredi
  it("répartit les tâches terminées par semaine, la plus ancienne d'abord", () => {
    const weeks = weeklyCompletions(
      [
        task({ completed_at: new Date(2026, 10, 3).toISOString() }),
        task({ completed_at: new Date(2026, 10, 2, 9).toISOString() }),
        task({ completed_at: new Date(2026, 9, 28).toISOString() }),
        task({ completed_at: new Date(2026, 6, 1).toISOString() }), // hors période
        task({ completed_at: null }),
      ],
      4,
      now
    )
    expect(weeks.map((w) => w.count)).toEqual([0, 0, 1, 2])
    expect(weeks[3]!.start.getDate()).toBe(2)
  })
})

describe("memberStats", () => {
  const since = new Date(2026, 9, 1)
  const tasks = [
    task({
      assignee_id: "a",
      status: "done",
      completed_at: new Date(2026, 9, 10).toISOString(),
      time_entries: [
        { user_id: "a", started_at: new Date(2026, 9, 9, 9).toISOString(), ended_at: new Date(2026, 9, 9, 11).toISOString() },
        { user_id: "b", started_at: new Date(2026, 9, 9, 9).toISOString(), ended_at: new Date(2026, 9, 9, 10).toISOString() },
      ],
    }),
    task({ assignee_id: "a", status: "in_progress", due_date: "2026-10-01" }),
    task({ assignee_id: "a", status: "todo", is_blocked: true, blocked_reason: "x" }),
    task({ assignee_id: "b", status: "done", completed_at: new Date(2026, 5, 1).toISOString() }),
    task({ assignee_id: null }),
  ]

  it("compte statuts, retards, blocages et taux d'achèvement par membre", () => {
    const [alice] = memberStats(tasks, [profile("a", "Alice"), profile("b", "Bruno")], since, "2026-11-02")
    expect(alice).toMatchObject({
      name: "Alice",
      status: { todo: 1, in_progress: 1, done: 1 },
      total: 3,
      overdue: 1,
      blocked: 1,
      completedInPeriod: 1,
      completionRate: 33,
      timeInPeriod: 2 * 3_600_000,
    })
  })

  it("trie par tâches ouvertes et ajoute « À assigner » seulement s'il y en a", () => {
    const rows = memberStats(tasks, [profile("b", "Bruno"), profile("a", "Alice")], since)
    expect(rows.map((r) => r.name)).toEqual(["Alice", "À assigner", "Bruno"])
    expect(memberStats([], [profile("a", "Alice")], since).map((r) => r.name)).toEqual(["Alice"])
  })

  it("statusCounts", () => {
    expect(statusCounts(tasks)).toEqual({ todo: 2, in_progress: 1, rescheduled: 0, done: 2 })
  })
})
