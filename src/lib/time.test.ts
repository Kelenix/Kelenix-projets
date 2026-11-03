import { describe, expect, it } from "vitest"
import { isLongPause } from "./domain"
import { currentActivity, estimateVsActual, formatDuration, periodBuckets, timeByUser, timeSince, timesheet, totals } from "./time"

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

describe("timesheet et périodes", () => {
  const ref = new Date(2026, 10, 4) // mercredi 4 novembre 2026
  const local = (d: number, h: number, m = 0, month = 10) => new Date(2026, month, d, h, m).toISOString()
  const entries = [
    { user_id: "a", started_at: local(2, 9), ended_at: local(2, 11), kind: "work" }, // lundi 2 h
    { user_id: "a", started_at: local(2, 11), ended_at: local(2, 11, 15), kind: "pause" },
    { user_id: "a", started_at: local(3, 14), ended_at: local(3, 18), kind: "work" }, // mardi 4 h
    { user_id: "b", started_at: local(3, 23), ended_at: local(4, 1), kind: "work" }, // à cheval sur minuit
    { user_id: "a", started_at: local(10, 9), ended_at: local(10, 10), kind: "work" }, // semaine suivante
    { user_id: "a", started_at: local(15, 9, 0, 0), ended_at: local(15, 12, 0, 0), kind: "work" }, // janvier 3 h
  ]
  const hours = (ms: number) => ms / 3_600_000
  const at = Date.parse(local(20, 0))

  it("semaine : travail par personne et par jour, pauses à part", () => {
    const { buckets } = periodBuckets("week", 0, ref)
    expect(buckets[0]!.start.getDay()).toBe(1)
    const rows = timesheet(entries, buckets, at)
    expect(rows[0]).toMatchObject({ userId: "a", pause: 15 * 60_000, pauseCount: 1, longPauses: 0 })
    expect(rows[0]!.perBucket.map(hours)).toEqual([2, 4, 0, 0, 0, 0, 0])
    expect(rows[0]!.pausePerBucket.map((ms) => ms / 60_000)).toEqual([15, 0, 0, 0, 0, 0, 0])
    expect(rows[1]!.perBucket.map(hours)).toEqual([0, 1, 1, 0, 0, 0, 0])
  })

  it("jour, mois (par semaines) et année (par mois)", () => {
    expect(timesheet(entries, periodBuckets("day", -1, ref).buckets, at)[0]!.work).toBe(4 * 3_600_000)
    const month = periodBuckets("month", 0, ref)
    expect(month.buckets.map((b) => b.label)).toEqual(["1–1", "2–8", "9–15", "16–22", "23–29", "30–30"])
    expect(timesheet(entries, month.buckets, at).find((r) => r.userId === "a")!.perBucket.map(hours)).toEqual([0, 6, 1, 0, 0, 0])
    const year = timesheet(entries, periodBuckets("year", 0, ref).buckets, at).find((r) => r.userId === "a")!
    expect(year.perBucket.map(hours)).toEqual([3, 0, 0, 0, 0, 0, 0, 0, 0, 0, 7, 0])
    expect(periodBuckets("week", -1, ref).buckets[0]!.start.getDate()).toBe(26)
  })

  it("totals : travail et pauses d'une tâche ou d'un projet", () => {
    expect(totals(entries, at)).toEqual({ work: 12 * 3_600_000, pause: 15 * 60_000 })
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

describe("pauses anormalement longues", () => {
  const pause = (minutes: number, reason: string | null) => ({
    user_id: "a",
    kind: "pause",
    pause_reason: reason,
    started_at: new Date(2026, 10, 2, 12).toISOString(),
    ended_at: new Date(2026, 10, 2, 12, minutes).toISOString(),
  })
  it("seuil selon le motif (repos 20 min, repas 90 min, autre 30 min)", () => {
    expect(isLongPause(pause(25, "rest"))).toBe(true)
    expect(isLongPause(pause(25, "meal"))).toBe(false)
    expect(isLongPause(pause(45, null))).toBe(true)
    expect(isLongPause({ ...pause(45, "rest"), kind: "work" })).toBe(false)
  })
  it("une pause en cours devient longue en dépassant le seuil", () => {
    const open = { ...pause(0, "personal"), ended_at: null }
    expect(isLongPause(open, Date.parse(open.started_at) + 31 * 60_000)).toBe(true)
  })
})

describe("estimateVsActual", () => {
  it("compare l'estimé au travail réel de chaque collaborateur affecté, pauses et autres personnes exclues", () => {
    const rows = estimateVsActual(
      [
        {
          assignees: [
            { user_id: "a", estimated_minutes: 60 },
            { user_id: "b", estimated_minutes: null },
          ],
          time_entries: [
            { user_id: "a", started_at: at(0), ended_at: at(50), kind: "work" },
            { user_id: "a", started_at: at(50), ended_at: at(80), kind: "pause" },
            { user_id: "b", started_at: at(0), ended_at: at(30), kind: "work" },
          ],
        },
        { assignees: [{ user_id: "a", estimated_minutes: 30 }], time_entries: [] },
      ],
      now
    )
    expect(rows).toEqual([{ userId: "a", tasks: 2, estimatedMs: 90 * 60_000, actualMs: 50 * 60_000 }])
  })
})

describe("currentActivity", () => {
  it("donne la tâche de la session ouverte de chaque personne", () => {
    const activity = currentActivity([
      { id: "t1", time_entries: [{ user_id: "a", started_at: at(0), ended_at: at(10) }] },
      { id: "t2", time_entries: [{ user_id: "a", started_at: at(10), ended_at: null, kind: "pause" }] },
    ])
    expect(activity.get("a")).toMatchObject({ taskId: "t2", entry: { kind: "pause" } })
    expect(activity.has("b")).toBe(false)
  })
})
