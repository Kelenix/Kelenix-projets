"use client"

import { Minus, Plus, Trash2 } from "lucide-react"
import { useState } from "react"
import { toast } from "sonner"
import { useConfirm } from "@/components/confirm"
import { Field } from "@/components/field"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { formatDate, todayISO } from "@/lib/domain"
import { addMonths, coverageMonths, emergencyBalance, monthRange, monthSummary, parseAmount } from "@/lib/finance"
import { useDeleteFinance, useSaveFinance, useSaveSettings } from "@/lib/finance-queries"
import { savingsSchema } from "@/lib/finance-schemas"
import { cn } from "@/lib/utils"
import { SavingsArea } from "./charts"
import { Empty, FormDialog, Meter, moneyInput, Panel, StatCard, useFinanceContext } from "./ui"

export function StabilityTab() {
  const { data, month, money, settings } = useFinanceContext()
  const save = useSaveFinance("fin_savings_movements", "Mouvement enregistré.")
  const remove = useDeleteFinance("fin_savings_movements", "Mouvement supprimé.")
  const saveSettings = useSaveSettings()
  const confirm = useConfirm()
  const [kind, setKind] = useState<"deposit" | "withdrawal" | null>(null)
  const [goalInput, setGoalInput] = useState(moneyInput(settings.emergency_goal_cents))

  const balance = emergencyBalance(data.savings)
  const goal = settings.emergency_goal_cents
  const coverage = coverageMonths(data, month)
  const summary = monthSummary(month, data)
  const rows = monthRange(addMonths(month, -11), month).map((m) => ({ month: m, balance: emergencyBalance(data.savings, m) }))
  const progress = goal ? Math.min(100, Math.round((balance / goal) * 100)) : null

  function saveGoal(e: React.FormEvent) {
    e.preventDefault()
    const value = goalInput.trim()
    const cents = value === "" ? null : parseAmount(value)
    if (value !== "" && cents === null) return void toast.error("Montant invalide (ex. 6 000).")
    saveSettings.mutate({ emergency_goal_cents: cents })
  }

  return (
    <>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Solde du fonds d'urgence" value={money(balance)} accent="stability" />
        <StatCard label="Progression vers l'objectif" value={progress === null ? "—" : `${progress} %`}>
          {goal ? (
            <Meter value={balance} max={goal} threshold={101} label="Progression du fonds d'urgence" color="var(--fin-stability)" />
          ) : (
            <span className="text-xs text-muted-foreground">Définissez un objectif ci-dessous</span>
          )}
        </StatCard>
        <StatCard label="Mois de dépenses essentielles couverts" value={coverage === null ? "—" : String(coverage).replace(".", ",")}>
          <span className="text-xs text-muted-foreground">
            {coverage === null ? "Il faut des dépenses essentielles enregistrées" : "Sur la moyenne des 3 derniers mois"}
          </span>
        </StatCard>
        <StatCard label="Budget Stabilité du mois" value={money(summary.budget.stability)} accent="stability">
          <span className="text-xs text-muted-foreground">
            Versé ce mois : {money(summary.savingsDeposits)} · reste {money(summary.remaining.stability)}
          </span>
        </StatCard>
      </div>

      <div className="grid gap-4 xl:grid-cols-3">
        <Panel title="Objectif d'épargne" className="xl:col-span-1">
          <form onSubmit={saveGoal} className="flex items-end gap-2">
            <Field label="Montant visé (€)">
              <Input value={goalInput} onChange={(e) => setGoalInput(e.target.value)} inputMode="decimal" placeholder="ex. 6 000" />
            </Field>
            <Button type="submit" variant="secondary" disabled={saveSettings.isPending}>
              Enregistrer
            </Button>
          </form>
          {goal !== null && balance >= goal && <p className="mt-3 text-sm font-medium text-[oklch(0.45_0.12_155)] dark:text-success">Objectif atteint.</p>}
          {goal !== null && balance < goal && <p className="mt-3 text-sm text-muted-foreground">Il reste {money(goal - balance)} à épargner.</p>}
          <div className="mt-5 flex flex-wrap gap-2 border-t pt-4">
            <Button onClick={() => setKind("deposit")}>
              <Plus aria-hidden /> Versement
            </Button>
            <Button variant="outline" onClick={() => setKind("withdrawal")}>
              <Minus aria-hidden /> Retrait
            </Button>
          </div>
        </Panel>
        <Panel title="Évolution du fonds d'urgence" className="xl:col-span-2">
          <SavingsArea rows={rows} goal={goal} />
        </Panel>
      </div>

      <Panel title="Historique des mouvements">
        {data.savings.length === 0 ? (
          <Empty title="Aucun mouvement" action={<Button onClick={() => setKind("deposit")}>Enregistrer un versement</Button>}>
            Vos versements et retraits sur le fonds d&apos;urgence apparaîtront ici.
          </Empty>
        ) : (
          <ul className="divide-y text-sm" aria-label="Mouvements du fonds d'urgence">
            {data.savings.map((s) => (
              <li key={s.id} className="flex flex-wrap items-center gap-3 py-2">
                <span className="w-28 text-muted-foreground">{formatDate(s.occurred_on)}</span>
                <span className="min-w-0 flex-1 truncate">
                  {s.kind === "deposit" ? "Versement" : "Retrait"}
                  {s.note && <span className="text-muted-foreground"> · {s.note}</span>}
                </span>
                <span className={cn("font-medium tabular-nums", s.kind === "withdrawal" && "text-destructive")}>
                  {s.kind === "withdrawal" ? "−" : "+"}
                  {money(s.amount_cents)}
                </span>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  aria-label="Supprimer ce mouvement"
                  onClick={async () => {
                    if (await confirm({ title: "Supprimer ce mouvement ?", description: "Le solde sera recalculé.", confirmLabel: "Supprimer", destructive: true })) remove.mutate(s.id)
                  }}
                >
                  <Trash2 />
                </Button>
              </li>
            ))}
          </ul>
        )}
      </Panel>

      <FormDialog
        open={kind !== null}
        onClose={() => setKind(null)}
        title={kind === "withdrawal" ? "Retrait du fonds d'urgence" : "Versement sur le fonds d'urgence"}
        schema={savingsSchema}
        pending={save.isPending}
        onSubmit={(values) => {
          if (values.kind === "withdrawal" && values.amount_cents > balance) return void toast.error(`Le solde n'est que de ${money(balance)}.`)
          save.mutate({ values }, { onSuccess: () => setKind(null) })
        }}
      >
        {(errors) => (
          <>
            <input type="hidden" name="kind" value={kind ?? "deposit"} />
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Montant (€)" error={errors.amount_cents}>
                <Input name="amount_cents" inputMode="decimal" autoFocus />
              </Field>
              <Field label="Date" error={errors.occurred_on}>
                <Input type="date" name="occurred_on" defaultValue={todayISO()} />
              </Field>
            </div>
            <Field label="Note (facultatif)" error={errors.note}>
              <Textarea name="note" rows={2} />
            </Field>
          </>
        )}
      </FormDialog>
    </>
  )
}
