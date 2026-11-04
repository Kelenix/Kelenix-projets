"use client"

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"
import type { Database } from "@/lib/database.types"
import type { FinanceData } from "@/lib/finance"
import { errorMessage } from "@/lib/queries"
import { getSupabase } from "@/lib/supabase/client"

const FINANCE_KEY = ["finance"] as const

export type FinanceSettings = Database["public"]["Tables"]["fin_settings"]["Row"]
export const DEFAULT_SETTINGS: Omit<FinanceSettings, "user_id" | "updated_at"> = {
  currency: "EUR",
  emergency_goal_cents: null,
  alert_threshold: 80,
  disabled_alerts: [],
  carry_defaults: { growth: "keep", stability: "keep", essentials: "next_month", reward: "next_month" },
}

type FinTable = Exclude<keyof Database["public"]["Tables"] & `fin_${string}`, "fin_settings">

async function all<T>(query: PromiseLike<{ data: T[] | null; error: { message: string } | null }>) {
  const { data, error } = await query
  if (error) throw error
  return data ?? []
}

/**
 * Toutes les données financières de l'utilisateur connecté (la RLS ne renvoie que les siennes),
 * chargées une fois et partagées par toutes les vues pour rester cohérentes.
 */
export function useFinance() {
  return useQuery({
    queryKey: FINANCE_KEY,
    queryFn: async () => {
      const db = getSupabase()
      const [incomes, expenses, recurring, savings, assets, investments, valuations, transfers, rules, goals, forecasts, settings] =
        await Promise.all([
          all(db.from("fin_incomes").select("id, amount_cents, received_on, source, status, note").order("received_on", { ascending: false })),
          all(
            db
              .from("fin_expenses")
              .select("id, amount_cents, spent_on, description, category, subcategory, payment_method, note, recurring_id")
              .order("spent_on", { ascending: false })
          ),
          all(db.from("fin_recurring_expenses").select("*").order("description")),
          all(db.from("fin_savings_movements").select("id, kind, amount_cents, occurred_on, note").order("occurred_on", { ascending: false })),
          all(db.from("fin_assets").select("id, name, asset_type").order("name")),
          all(
            db
              .from("fin_investment_movements")
              .select("id, asset_id, kind, amount_cents, fees_cents, occurred_on, note")
              .order("occurred_on", { ascending: false })
          ),
          all(db.from("fin_asset_valuations").select("id, asset_id, value_cents, valued_on").order("valued_on", { ascending: false })),
          all(db.from("fin_transfers").select("id, month, from_category, action, amount_cents, note, created_at").order("created_at", { ascending: false })),
          all(db.from("fin_allocation_rules").select("month, scope, growth, stability, essentials, reward, created_at").order("month", { ascending: false })),
          all(db.from("fin_goals").select("id, name, target_cents, current_cents, linked, due_date").order("created_at")),
          all(db.from("fin_forecasts").select("month, amount_cents").order("month")),
          all(db.from("fin_settings").select("*")),
        ])
      const data: FinanceData = { incomes, expenses, recurring, savings, assets, investments, valuations, transfers, rules, goals, forecasts }
      return { data, settings: { ...DEFAULT_SETTINGS, ...settings[0] } }
    },
  })
}

function useFinanceMutation<TVars>(fn: (vars: TVars) => Promise<unknown>, success?: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: fn,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: FINANCE_KEY })
      if (success) toast.success(success)
    },
    onError: (error) => toast.error(errorMessage(error)),
  })
}

const check = ({ error }: { error: unknown }) => {
  if (error) throw error
}

/** Ajout ou modification (avec `id`) d'une ligne d'une table financière. */
export function useSaveFinance<T extends FinTable>(table: T, success = "Enregistré.") {
  return useFinanceMutation(async ({ id, values }: { id?: string; values: Record<string, unknown> }) => {
    const query = getSupabase().from(table)
    // Le générique de table ne se résout pas côté client Supabase : les colonnes sont validées par les schémas Zod.
    check(await (id ? query.update(values as never).eq("id" as never, id as never) : query.insert(values as never)))
  }, success)
}

export function useDeleteFinance<T extends FinTable>(table: T, success = "Supprimé.") {
  return useFinanceMutation(async (id: string) => check(await getSupabase().from(table).delete().eq("id" as never, id as never)), success)
}

/** Règle de répartition : par défaut à partir d'un mois (`from`) ou propre à un mois (`only`). */
export function useSaveRule() {
  return useFinanceMutation(
    async (values: { month: string; scope: "from" | "only"; growth: number; stability: number; essentials: number; reward: number }) =>
      check(await getSupabase().from("fin_allocation_rules").upsert(values, { onConflict: "user_id,month,scope" })),
    "Répartition enregistrée."
  )
}

export function useDeleteMonthRule() {
  return useFinanceMutation(
    async (month: string) => check(await getSupabase().from("fin_allocation_rules").delete().eq("month", month).eq("scope", "only")),
    "Le mois reprend la répartition par défaut."
  )
}

export function useSaveForecast() {
  return useFinanceMutation(async ({ month, amount }: { month: string; amount: number | null }) => {
    const table = getSupabase().from("fin_forecasts")
    check(await (amount === null ? table.delete().eq("month", month) : table.upsert({ month, amount_cents: amount }, { onConflict: "user_id,month" })))
  }, "Prévision enregistrée.")
}

export function useSaveSettings() {
  return useFinanceMutation(
    async (values: Partial<Omit<FinanceSettings, "user_id">>) =>
      check(await getSupabase().from("fin_settings").upsert({ ...values, updated_at: new Date().toISOString() }, { onConflict: "user_id" })),
    "Paramètres enregistrés."
  )
}
