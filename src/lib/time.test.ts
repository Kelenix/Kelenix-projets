import { describe, expect, it } from "vitest"
import { formatDuration, timeByUser, timeSince } from "./time"

const at = (min: number) => new Date(Date.UTC(2026, 10, 2, 9, min)).toISOString()
const now = Date.parse(at(120))

describe("timeByUser", () => {
  it("cumule les sessions par personne, chronomètre en cours en premier", () => {
    const rows = timeByUser(
      [
        { user_id: "a", started_at: at(0), ended_at: at(30) },
        { user_id: "a", started_at: at(40), ended_at: at(70) },
        { user_id: "b", started_at: at(100), ended_at: null },
      ],
      now
    )
    expect(rows).toEqual([
      { userId: "b", ms: 20 * 60_000, running: true },
      { userId: "a", ms: 60 * 60_000, running: false },
    ])
  })
})

describe("timeSince", () => {
  it("ne compte que la part postérieure à la date de début de période", () => {
    expect(timeSince([{ user_id: "a", started_at: at(0), ended_at: at(60) }], new Date(at(30)), now)).toBe(30 * 60_000)
  })
})

describe("formatDuration", () => {
  it("formate en heures et minutes", () => {
    expect(formatDuration(125 * 60_000)).toBe("2 h 05")
    expect(formatDuration(12 * 60_000)).toBe("12 min")
    expect(formatDuration(20_000)).toBe("< 1 min")
  })
  it("affiche les secondes pour un chronomètre en cours", () => {
    expect(formatDuration(64_000, true)).toBe("01:04")
    expect(formatDuration(3_725_000, true)).toBe("1:02:05")
  })
})
