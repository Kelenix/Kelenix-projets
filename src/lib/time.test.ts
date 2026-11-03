import { describe, expect, it } from "vitest"
import { dailyTimesheet, formatDuration, timeByUser, timeSince, weekDays } from "./time"

const at = (min: number) => new Date(Date.UTC(2026, 10, 2, 9, min)).toISOString()
const now = Date.parse(at(120))

describe("timeByUser", () => {
  it("cumule le travail par personne, pauses à part, session en cours en premier", () => {
    const rows = timeByUser(
      [
        { user_id: "a", started_at: at(0), ended_at: at(30), kind: "work" },
        { user_id: "a", started_at: at(30), ended_at: at(40), kind: "pause" },
        { user_id: "a", started_at: at(40), ended_at: at(70), kind: "work" },
        { user_id: "b", started_at: at(100), ended_at: null, kind: "work" },
        { user_id: "c", started_at: at(110), ended_at: null, kind: "pause" },
      ],
      now
    )
    expect(rows.map((r) => r.userId)).toEqual(["b", "c", "a"])
    expect(rows[0]).toMatchObject({ ms: 20 * 60_000, running: true, paused: false })
    expect(rows[1]).toMatchObject({ ms: 0, paused: true, currentPauseMs: 10 * 60_000 })
    expect(rows[2]).toMatchObject({ ms: 60 * 60_000, pauseMs: 10 * 60_000, running: false })
  })
})

describe("timeSince", () => {
  it("ne compte que le travail postérieur au début de période", () => {
    const entries = [
      { user_id: "a", started_at: at(0), ended_at: at(60) },
      { user_id: "a", started_at: at(60), ended_at: at(90), kind: "pause" },
    ]
    expect(timeSince(entries, new Date(at(30)), now)).toBe(30 * 60_000)
  })
})

describe("dailyTimesheet", () => {
  // Semaine du lundi 2 au dimanche 8 novembre 2026 (heure locale).
  const days = weekDays(0, new Date(2026, 10, 4))
  const local = (d: number, h: number, m = 0) => new Date(2026, 10, d, h, m).toISOString()

  it("répartit le travail par personne et par jour, pauses totalisées à part", () => {
    const rows = dailyTimesheet(
      [
        { user_id: "a", started_at: local(2, 9), ended_at: local(2, 11), kind: "work" }, // lundi 2 h
        { user_id: "a", started_at: local(2, 11), ended_at: local(2, 11, 15), kind: "pause" },
        { user_id: "a", started_at: local(3, 14), ended_at: local(3, 18), kind: "work" }, // mardi 4 h
        { user_id: "b", started_at: local(3, 23), ended_at: local(4, 1), kind: "work" }, // à cheval sur minuit
        { user_id: "a", started_at: local(10, 9), ended_at: local(10, 10), kind: "work" }, // semaine suivante
      ],
      days,
      Date.parse(local(9, 0))
    )
    const hours = (ms: number) => ms / 3_600_000
    expect(rows[0]).toMatchObject({ userId: "a", pause: 15 * 60_000 })
    expect(rows[0]!.perDay.map(hours)).toEqual([2, 4, 0, 0, 0, 0, 0])
    expect(rows[1]!.perDay.map(hours)).toEqual([0, 1, 1, 0, 0, 0, 0])
  })

  it("weekDays : lundi → dimanche, décalable", () => {
    expect(days[0]!.getDay()).toBe(1)
    expect(days[6]!.getDay()).toBe(0)
    expect(weekDays(-1, new Date(2026, 10, 4))[0]!.getDate()).toBe(26)
  })
})

describe("formatDuration", () => {
  it("formate en heures et minutes", () => {
    expect(formatDuration(125 * 60_000)).toBe("2 h 05")
    expect(formatDuration(12 * 60_000)).toBe("12 min")
    expect(formatDuration(20_000)).toBe("< 1 min")
  })
  it("affiche les secondes pour une session en cours", () => {
    expect(formatDuration(64_000, true)).toBe("01:04")
    expect(formatDuration(3_725_000, true)).toBe("1:02:05")
  })
})
