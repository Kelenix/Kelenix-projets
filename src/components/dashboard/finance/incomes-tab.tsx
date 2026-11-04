"use client"

import { Check, Pencil, Plus, Trash2 } from "lucide-react"
import { useState } from "react"
import { toast } from "sonner"
import { useConfirm } from "@/components/confirm"
import { Field } from "@/components/field"
import { NativeSelect } from "@/components/native-select"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { formatDate, todayISO } from "@/lib/domain"
import { addMonths, allocate, CATEGORIES, CATEGORY_LABELS, forecast, monthLabel, monthSummary, parseAmount, type Income } from "@/lib/finance"
import { useDeleteFinance, useSaveFinance, useSaveForecast } from "@/lib/finance-queries"
import { incomeSchema } from "@/lib/finance-schemas"
import { CategoryDot, Delta, Empty, FormDialog, moneyInput, Panel, StatCard, useFinanceContext } from "./ui"

export function IncomesTab() {
  const { data, month, money } = useFinanceContext()
  const save = useSaveFinance("fin_incomes", "Revenu enregistré.")
  const remove = useDeleteFinance("fin_incomes", "Revenu supprimé.")
  const confirm = useConfirm()
  const [editing, setEditing] = useState<Income | "new" | null>(null)

  const summary = monthSummary(month, data)
  const previous = monthSummary(addMonths(month, -1), data)
  const incomes = data.incomes.filter((i) => i.received_on.slice(0, 7) === month.slice(0, 7))
  const defaultDate = todayISO().slice(0, 7) === month.slice(0, 7) ? todayISO() : month

  async function onDelete(income: Income) {
    const ok = await confirm({
      title: "Supprimer ce revenu ?",
      description: `${income.source} — ${money(income.amount_cents)} du ${formatDate(income.received_on)}. La répartition du mois sera recalculée.`,
      confirmLabel: "Supprimer",
      destructive: true,
    })
    if (ok) remove.mutate(income.id)
  }

  return (
    <>
      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard label={`Revenus reçus — ${monthLabel(month)}`} value={money(summary.income)}>
          <Delta current={summary.income} previous={previous.income} format={(d) => `${money(d, true)} vs ${monthLabel(previous.month)}`} />
        </StatCard>
        <StatCard label="Revenus prévus, non encore reçus" value={money(summary.expectedIncome)} />
        <StatCard label="Nombre de revenus du mois" value={incomes.length} />
      </div>

      <Panel
        title={`Revenus de ${monthLabel(month)}`}
        description="Plusieurs revenus par mois possibles ; seuls les revenus reçus sont répartis."
        actions={
          <Button onClick={() => setEditing("new")}>
            <Plus aria-hidden /> Ajouter un revenu
          </Button>
        }
      >
        {incomes.length === 0 ? (
          <Empty title="Aucun revenu pour ce mois" action={<Button onClick={() => setEditing("new")}>Saisir le revenu reçu</Button>}>
            Saisissez le montant réellement reçu : il sera réparti automatiquement selon votre règle.
          </Empty>
        ) : (
          <ul className="divide-y" aria-label="Revenus du mois">
            {incomes.map((i) => (
              <li key={i.id} className="flex flex-wrap items-center gap-3 py-2.5">
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium">{i.source}</p>
                  <p className="text-xs text-muted-foreground">
                    {formatDate(i.received_on)}
                    {i.note && ` · ${i.note}`}
                  </p>
                </div>
                <span
                  className={
                    i.status === "received"
                      ? "rounded-full bg-success/15 px-2 py-0.5 text-xs font-medium text-[oklch(0.42_0.11_155)] dark:text-success"
                      : "rounded-full bg-warning/15 px-2 py-0.5 text-xs font-medium text-[oklch(0.5_0.14_55)] dark:text-warning"
                  }
                >
                  {i.status === "received" ? "Reçu" : "Prévu"}
                </span>
                <span className="w-32 text-right font-semibold tabular-nums">{money(i.amount_cents)}</span>
                <div className="flex gap-1">
                  {i.status === "expected" && (
                    <Button variant="ghost" size="icon-sm" aria-label={`Marquer « ${i.source} » comme reçu`} onClick={() => save.mutate({ id: i.id, values: { status: "received" } })}>
                      <Check />
                    </Button>
                  )}
                  <Button variant="ghost" size="icon-sm" aria-label={`Modifier « ${i.source} »`} onClick={() => setEditing(i)}>
                    <Pencil />
                  </Button>
                  <Button variant="ghost" size="icon-sm" aria-label={`Supprimer « ${i.source} »`} onClick={() => onDelete(i)}>
                    <Trash2 />
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        )}
        {summary.income > 0 && (
          <div className="mt-4 grid gap-2 border-t pt-4 sm:grid-cols-4">
            {CATEGORIES.map((c) => (
              <div key={c} className="flex items-center gap-2 text-sm">
                <CategoryDot category={c} />
                <span className="text-muted-foreground">
                  {CATEGORY_LABELS[c]} ({summary.rule[c]} %)
                </span>
                <span className="ml-auto font-medium tabular-nums">{money(summary.allocated[c])}</span>
              </div>
            ))}
          </div>
        )}
      </Panel>

      <ForecastPanel />

      <FormDialog
        open={editing !== null}
        onClose={() => setEditing(null)}
        title={editing === "new" ? "Ajouter un revenu" : "Modifier le revenu"}
        schema={incomeSchema}
        pending={save.isPending}
        onSubmit={(values) =>
          save.mutate({ id: editing === "new" || !editing ? undefined : editing.id, values }, { onSuccess: () => setEditing(null) })
        }
      >
        {(errors) => {
          const current = editing === "new" ? null : editing
          return (
            <>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Montant (€)" error={errors.amount_cents}>
                  <Input name="amount_cents" inputMode="decimal" placeholder="ex. 1 450,00" defaultValue={moneyInput(current?.amount_cents)} autoFocus />
                </Field>
                <Field label="Date de réception" error={errors.received_on}>
                  <Input type="date" name="received_on" defaultValue={current?.received_on ?? defaultDate} />
                </Field>
                <Field label="Source" error={errors.source}>
                  <Input name="source" placeholder="ex. Salaire, mission, vente" defaultValue={current?.source ?? ""} maxLength={120} />
                </Field>
                <Field label="Statut">
                  <NativeSelect name="status" defaultValue={current?.status ?? "received"}>
                    <option value="received">Reçu</option>
                    <option value="expected">Prévu (pas encore reçu)</option>
                  </NativeSelect>
                </Field>
              </div>
              <Field label="Note (facultatif)" error={errors.note}>
                <Textarea name="note" rows={2} defaultValue={current?.note ?? ""} />
              </Field>
            </>
          )
        }}
      </FormDialog>
    </>
  )
}

/** Revenus prévisionnels des 12 prochains mois ; sans saisie, la moyenne historique sert d'estimation. */
function ForecastPanel() {
  const { data, month, money } = useFinanceContext()
  const saveForecast = useSaveForecast()
  const rows = forecast(month, data)

  return (
    <Panel
      title="Revenus prévisionnels"
      description="Saisissez un montant attendu pour un mois futur. Laissé vide, le mois utilise la moyenne de vos revenus (estimation)."
    >
      <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
        {rows.map((r) => {
          const entered = data.forecasts.find((f) => f.month === r.month)
          const split = r.income === null ? null : allocate(r.income, monthSummary(r.month, data).rule)
          return (
            <form
              key={`${r.month}-${entered?.amount_cents ?? "none"}`}
              className="flex items-center gap-2 rounded-lg border px-3 py-2"
              onSubmit={(e) => {
                e.preventDefault()
                const value = String(new FormData(e.currentTarget).get("amount") ?? "").trim()
                const amount = value === "" ? null : parseAmount(value)
                if (value !== "" && amount === null) return void toast.error("Montant invalide (ex. 1 500,00).")
                if (amount !== (entered?.amount_cents ?? null)) saveForecast.mutate({ month: r.month, amount })
              }}
            >
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium capitalize">{monthLabel(r.month)}</p>
                <p className="truncate text-xs text-muted-foreground">
                  {r.incomeKind === "saisi"
                    ? "Montant saisi"
                    : r.incomeKind === "estimation"
                      ? `Estimation : ${money(r.income!)}`
                      : "Pas d'historique pour estimer"}
                  {split && ` · croissance ${money(split.growth)}`}
                </p>
              </div>
              <Input
                name="amount"
                aria-label={`Revenu prévisionnel de ${monthLabel(r.month)}`}
                inputMode="decimal"
                placeholder="—"
                defaultValue={moneyInput(entered?.amount_cents)}
                className="h-8 w-28"
                onBlur={(e) => e.currentTarget.form?.requestSubmit()}
              />
            </form>
          )
        })}
      </div>
    </Panel>
  )
}
