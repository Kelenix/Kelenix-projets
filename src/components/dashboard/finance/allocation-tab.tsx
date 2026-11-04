"use client"

import { RotateCcw, Trash2 } from "lucide-react"
import { useState } from "react"
import { toast } from "sonner"
import { useConfirm } from "@/components/confirm"
import { NativeSelect } from "@/components/native-select"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  addMonths,
  allocate,
  CATEGORIES,
  CATEGORY_HINTS,
  CATEGORY_LABELS,
  DEFAULT_RULE,
  isValidRule,
  monthLabel,
  monthSummary,
  parseAmount,
  ruleTotal,
  TRANSFER_ACTIONS,
  type Category,
  type Rule,
  type TransferAction,
} from "@/lib/finance"
import { useDeleteFinance, useDeleteMonthRule, useSaveFinance, useSaveRule } from "@/lib/finance-queries"
import { cn } from "@/lib/utils"
import { CategoryDot, Empty, moneyInput, Panel, useFinanceContext } from "./ui"

const formatPct = (n: number) => String(n).replace(".", ",")

export function AllocationTab() {
  const { data, month } = useFinanceContext()
  const summary = monthSummary(month, data)
  return (
    <>
      <RuleEditor key={`${month}-${JSON.stringify(summary.rule)}`} />
      <CarryOver />
      <Panel title="Historique des répartitions" description="Chaque mois conserve la règle qui était en vigueur.">
        {data.rules.length === 0 ? (
          <Empty title="Règle par défaut">25 % Croissance, 15 % Stabilité, 50 % Essentiels, 10 % Récompense, appliquée à tous les mois.</Empty>
        ) : (
          <ul className="divide-y text-sm">
            {data.rules.map((r) => (
              <li key={`${r.month}-${r.scope}`} className="flex flex-wrap items-center gap-3 py-2">
                <span className="w-56 font-medium capitalize">
                  {r.scope === "only" ? `${monthLabel(r.month)} uniquement` : `À partir de ${monthLabel(r.month)}`}
                </span>
                {CATEGORIES.map((c) => (
                  <span key={c} className="flex items-center gap-1.5 text-muted-foreground">
                    <CategoryDot category={c} /> {formatPct(Number(r[c]))} %
                  </span>
                ))}
              </li>
            ))}
          </ul>
        )}
      </Panel>
    </>
  )
}

/** Pourcentages modifiables, total vérifié en direct, montants recalculés immédiatement. */
function RuleEditor() {
  const { data, month, money } = useFinanceContext()
  const summary = monthSummary(month, data)
  const saveRule = useSaveRule()
  const deleteMonthRule = useDeleteMonthRule()
  const [values, setValues] = useState<Record<Category, string>>(
    () => Object.fromEntries(CATEGORIES.map((c) => [c, formatPct(summary.rule[c])])) as Record<Category, string>
  )
  const rule = Object.fromEntries(CATEGORIES.map((c) => [c, Number(values[c].replace(",", ".")) || 0])) as Rule
  const total = ruleTotal(rule)
  const valid = isValidRule(rule) && CATEGORIES.every((c) => /^\d+([.,]\d{1,2})?$/.test(values[c].trim()))
  const preview = allocate(summary.income, rule)
  const apply = (scope: "from" | "only", r: Rule = rule) => saveRule.mutate({ month, scope, ...r })

  return (
    <Panel
      title="Règle de répartition"
      description={
        summary.ruleSource === "only"
          ? `${monthLabel(month)} utilise une répartition qui lui est propre.`
          : summary.ruleSource === "from"
            ? "Règle personnalisée en vigueur pour ce mois."
            : "Règle par défaut : 25 / 15 / 50 / 10."
      }
    >
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {CATEGORIES.map((c) => (
          <label key={c} className="space-y-1.5 rounded-lg border p-3">
            <span className="flex items-center gap-2 text-sm font-medium">
              <CategoryDot category={c} /> {CATEGORY_LABELS[c]}
            </span>
            <span className="block text-xs text-muted-foreground">{CATEGORY_HINTS[c]}</span>
            <span className="flex items-center gap-2">
              <Input
                aria-label={`Pourcentage ${CATEGORY_LABELS[c]}`}
                inputMode="decimal"
                value={values[c]}
                onChange={(e) => setValues({ ...values, [c]: e.target.value })}
                className="h-9 w-24 text-right tabular-nums"
              />
              <span className="text-sm text-muted-foreground">%</span>
              <span className="ml-auto text-sm font-semibold tabular-nums">{money(preview[c])}</span>
            </span>
          </label>
        ))}
      </div>
      <p role="status" className={cn("mt-3 text-sm font-medium", total === 100 ? "text-muted-foreground" : "text-destructive")}>
        Total : {formatPct(total)} %{total !== 100 && " — la somme doit être égale à 100 %."}
        {summary.income > 0 && total === 100 && ` · ${money(summary.income)} reçus en ${monthLabel(month)}`}
      </p>
      <div className="mt-4 flex flex-wrap gap-2">
        <Button disabled={!valid || saveRule.isPending} onClick={() => apply("from")}>
          Appliquer à partir de {monthLabel(month)}
        </Button>
        <Button variant="outline" disabled={!valid || saveRule.isPending} onClick={() => apply("only")}>
          Appliquer à ce mois uniquement
        </Button>
        <Button
          variant="ghost"
          onClick={() => {
            setValues(Object.fromEntries(CATEGORIES.map((c) => [c, formatPct(DEFAULT_RULE[c])])) as Record<Category, string>)
            apply("from", DEFAULT_RULE)
          }}
        >
          <RotateCcw aria-hidden /> Restaurer la répartition par défaut
        </Button>
        {summary.ruleSource === "only" && (
          <Button variant="ghost" onClick={() => deleteMonthRule.mutate(month)}>
            Retirer la répartition propre au mois
          </Button>
        )}
      </div>
      <p className="mt-2 text-xs text-muted-foreground">
        « À partir de » : les mois précédents gardent leur ancienne répartition. Les budgets déjà consommés ne sont jamais modifiés.
      </p>
    </Panel>
  )
}

/**
 * Argent non utilisé : reporter sur le mois suivant, transférer vers Croissance ou Stabilité, ou
 * le laisser disponible. Un transfert interne déplace un budget, jamais un revenu.
 */
function CarryOver() {
  const { data, month, money, settings } = useFinanceContext()
  const summary = monthSummary(month, data)
  const save = useSaveFinance("fin_transfers", "Opération enregistrée.")
  const remove = useDeleteFinance("fin_transfers", "Opération annulée.")
  const confirm = useConfirm()
  const defaults = (settings.carry_defaults ?? {}) as Record<string, TransferAction>
  const transfers = data.transfers.filter((t) => t.month === month)
  const incoming = data.transfers.filter((t) => t.month === addMonths(month, -1) && t.action === "next_month")

  return (
    <Panel title="Reliquats et reports" description={`Budget non utilisé en ${monthLabel(month)}, par catégorie.`}>
      <div className="grid gap-3 lg:grid-cols-2">
        {CATEGORIES.map((c) => (
          <CarryRow key={`${c}-${summary.remaining[c]}`} category={c} remaining={summary.remaining[c]} defaultAction={defaults[c] ?? "next_month"} onApply={(action, amount, note) => save.mutate({ values: { month, from_category: c, action, amount_cents: amount, note } })} />
        ))}
      </div>
      {(transfers.length > 0 || incoming.length > 0) && (
        <ul className="mt-4 divide-y border-t text-sm" aria-label="Opérations du mois">
          {incoming.map((t) => (
            <li key={t.id} className="flex items-center gap-2 py-2 text-muted-foreground">
              <CategoryDot category={t.from_category} />
              Reçu de {monthLabel(t.month)} ({CATEGORY_LABELS[t.from_category]}) : <span className="font-medium text-foreground">{money(t.amount_cents)}</span>
            </li>
          ))}
          {transfers.map((t) => (
            <li key={t.id} className="flex flex-wrap items-center gap-2 py-2">
              <CategoryDot category={t.from_category} />
              <span>
                {CATEGORY_LABELS[t.from_category]} → {TRANSFER_ACTIONS[t.action as TransferAction]}
              </span>
              <span className="ml-auto font-medium tabular-nums">{money(t.amount_cents)}</span>
              <Button
                variant="ghost"
                size="icon-sm"
                aria-label="Annuler cette opération"
                onClick={async () => {
                  if (await confirm({ title: "Annuler cette opération ?", description: "Les budgets concernés seront recalculés.", confirmLabel: "Annuler l'opération", destructive: true }))
                    remove.mutate(t.id)
                }}
              >
                <Trash2 />
              </Button>
            </li>
          ))}
        </ul>
      )}
    </Panel>
  )
}

function CarryRow({ category, remaining, defaultAction, onApply }: {
  category: Category
  remaining: number
  defaultAction: TransferAction
  onApply: (action: TransferAction, amount: number, note: string | null) => void
}) {
  const { money } = useFinanceContext()
  const actions = (Object.keys(TRANSFER_ACTIONS) as TransferAction[]).filter((a) => a !== category)
  const [action, setAction] = useState<TransferAction>(actions.includes(defaultAction) ? defaultAction : "next_month")
  const [amount, setAmount] = useState(moneyInput(Math.max(0, remaining)))

  return (
    <form
      className="space-y-2 rounded-lg border p-3"
      onSubmit={(e) => {
        e.preventDefault()
        const cents = parseAmount(amount)
        if (cents === null) return void toast.error("Montant invalide.")
        if (cents > remaining) return void toast.error(`Au maximum ${money(remaining)} disponibles.`)
        onApply(action, cents, null)
      }}
    >
      <p className="flex items-center gap-2 text-sm font-medium">
        <CategoryDot category={category} /> {CATEGORY_LABELS[category]}
        <span className={cn("ml-auto tabular-nums", remaining < 0 && "text-destructive")}>{money(remaining)} restants</span>
      </p>
      {remaining > 0 ? (
        <div className="flex flex-wrap gap-2">
          <NativeSelect aria-label={`Action pour le reliquat ${CATEGORY_LABELS[category]}`} value={action} onChange={(e) => setAction(e.target.value as TransferAction)} className="min-w-56 flex-1">
            {actions.map((a) => (
              <option key={a} value={a}>
                {TRANSFER_ACTIONS[a]}
              </option>
            ))}
          </NativeSelect>
          <Input aria-label={`Montant à traiter ${CATEGORY_LABELS[category]}`} inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} className="w-28" />
          <Button type="submit" variant="secondary">
            Valider
          </Button>
        </div>
      ) : (
        <p className="text-xs text-muted-foreground">{remaining < 0 ? "Budget dépassé : rien à reporter." : "Aucun reliquat."}</p>
      )}
    </form>
  )
}
