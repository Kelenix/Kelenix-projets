import { z } from "zod"
import { CATEGORIES, parseAmount, type Category } from "@/lib/finance"

/** Montant saisi en euros (« 1 400,50 ») → centimes. */
const amount = (label = "Montant") =>
  z
    .string()
    .transform((v, ctx) => {
      const cents = parseAmount(v)
      if (cents === null) {
        ctx.addIssue({ code: "custom", message: `${label} invalide (ex. 1 400,50).` })
        return z.NEVER
      }
      return cents
    })
const optionalAmount = z
  .string()
  .trim()
  .transform((v, ctx) => {
    if (!v) return 0
    const cents = parseAmount(v)
    if (cents === null) {
      ctx.addIssue({ code: "custom", message: "Montant invalide." })
      return z.NEVER
    }
    return cents
  })
const date = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Choisissez une date.")
const text = (max: number, label: string) => z.string().trim().min(1, `${label} obligatoire.`).max(max, `${max} caractères maximum.`)
const optional = (max: number) =>
  z
    .string()
    .trim()
    .max(max, `${max} caractères maximum.`)
    .transform((v) => v || null)
const category = z.enum(CATEGORIES as [Category, ...Category[]], { message: "Choisissez une catégorie." })
const month = z.string().regex(/^\d{4}-\d{2}$/, "Choisissez un mois.").transform((v) => `${v}-01`)

export const incomeSchema = z.object({
  amount_cents: amount(),
  received_on: date,
  source: text(120, "La source est"),
  status: z.enum(["received", "expected"]),
  note: optional(500),
})

export const expenseSchema = z.object({
  amount_cents: amount(),
  spent_on: date,
  description: text(200, "La description est"),
  category,
  subcategory: optional(80),
  payment_method: optional(40),
  note: optional(500),
})

export const recurringSchema = z
  .object({
    amount_cents: amount(),
    description: text(200, "La description est"),
    category,
    subcategory: optional(80),
    payment_method: optional(40),
    day_of_month: z.coerce.number().int().min(1, "Jour entre 1 et 28.").max(28, "Jour entre 1 et 28."),
    start_month: month,
    end_month: z
      .string()
      .transform((v) => (v ? `${v}-01` : null))
      .refine((v) => v === null || /^\d{4}-\d{2}-01$/.test(v), "Mois invalide."),
  })
  .refine((r) => !r.end_month || r.end_month >= r.start_month, { message: "La fin doit suivre le début.", path: ["end_month"] })

export const savingsSchema = z.object({
  kind: z.enum(["deposit", "withdrawal"]),
  amount_cents: amount(),
  occurred_on: date,
  note: optional(500),
})

export const assetSchema = z.object({
  name: text(120, "Le nom est"),
  asset_type: z.enum(["stocks", "etf", "business", "real_estate", "crypto", "other"]),
})

export const investmentSchema = z.object({
  asset_id: z.string().min(1, "Choisissez un actif."),
  kind: z.enum(["contribution", "withdrawal"]),
  amount_cents: amount(),
  fees_cents: optionalAmount,
  occurred_on: date,
  note: optional(500),
})

export const valuationSchema = z.object({
  asset_id: z.string().min(1, "Choisissez un actif."),
  value_cents: z.string().transform((v, ctx) => {
    if (v.trim() === "0") return 0
    const cents = parseAmount(v)
    if (cents === null) {
      ctx.addIssue({ code: "custom", message: "Valeur invalide." })
      return z.NEVER
    }
    return cents
  }),
  valued_on: date,
})

export const goalSchema = z.object({
  name: text(120, "Le nom est"),
  target_cents: amount("Objectif"),
  current_cents: optionalAmount,
  linked: z.enum(["none", "stability", "growth"]),
  due_date: z.string().transform((v) => v || null),
})

export const transferSchema = z.object({
  from_category: category,
  action: z.enum(["next_month", "growth", "stability", "keep"]),
  amount_cents: amount(),
  note: optional(500),
})

/** Pourcentage saisi (« 25 », « 12,5 »), deux décimales au plus. */
export const percent = z
  .string()
  .trim()
  .transform((v, ctx) => {
    const n = Number(v.replace(",", "."))
    if (!/^\d+([.,]\d{1,2})?$/.test(v) || n > 100) {
      ctx.addIssue({ code: "custom", message: "Entre 0 et 100." })
      return z.NEVER
    }
    return n
  })
