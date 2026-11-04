"use client"

import { Pause, Pencil, Play, Plus, Repeat, Square, Trash2 } from "lucide-react"
import { useState } from "react"
import { useConfirm } from "@/components/confirm"
import { Field } from "@/components/field"
import { NativeSelect } from "@/components/native-select"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { formatDate } from "@/lib/domain"
import {
  addMonths,
  CATEGORIES,
  CATEGORY_HINTS,
  CATEGORY_LABELS,
  monthLabel,
  monthSummary,
  parseAmount,
  pendingRecurring,
  type Category,
  type Expense,
  type Recurring,
} from "@/lib/finance"
import { useDeleteFinance, useSaveFinance } from "@/lib/finance-queries"
import { expenseSchema, recurringSchema } from "@/lib/finance-schemas"
import { cn } from "@/lib/utils"
import { CATEGORY_COLOR, CategoryDot, Empty, FormDialog, Meter, moneyInput, Panel, useFinanceContext } from "./ui"

function CategorySelect({ value }: { value?: Category }) {
  return (
    <NativeSelect name="category" defaultValue={value ?? "essentials"}>
      {CATEGORIES.map((c) => (
        <option key={c} value={c}>
          {CATEGORY_LABELS[c]} — {CATEGORY_HINTS[c].split(",")[0]}
        </option>
      ))}
    </NativeSelect>
  )
}

export function ExpensesTab() {
  const { data, month, money, settings } = useFinanceContext()
  const save = useSaveFinance("fin_expenses", "Dépense enregistrée.")
  const remove = useDeleteFinance("fin_expenses", "Dépense supprimée.")
  const confirm = useConfirm()
  const [editing, setEditing] = useState<Expense | "new" | null>(null)
  const [filters, setFilters] = useState({ category: "", min: "", max: "", from: "", to: "" })

  const summary = monthSummary(month, data)
  const pending = pendingRecurring(month, data)
  const min = parseAmount(filters.min)
  const max = parseAmount(filters.max)
  const expenses = data.expenses.filter(
    (e) =>
      e.spent_on.slice(0, 7) === month.slice(0, 7) &&
      (!filters.category || e.category === filters.category) &&
      (min === null || e.amount_cents >= min) &&
      (max === null || e.amount_cents <= max) &&
      (!filters.from || e.spent_on >= filters.from) &&
      (!filters.to || e.spent_on <= filters.to)
  )
  const shownTotal = expenses.reduce((s, e) => s + e.amount_cents, 0)

  async function onDelete(e: Expense) {
    const ok = await confirm({
      title: "Supprimer cette dépense ?",
      description: `${e.description} — ${money(e.amount_cents)} du ${formatDate(e.spent_on)}.`,
      confirmLabel: "Supprimer",
      destructive: true,
    })
    if (ok) remove.mutate(e.id)
  }

  return (
    <>
      <Panel title={`Budget restant — ${monthLabel(month)}`} description="Consommé : dépenses, plus versements d'épargne (Stabilité) et investissements (Croissance).">
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {CATEGORIES.map((c) => {
            const over = summary.consumed[c] > summary.budget[c]
            return (
              <div key={c} className="space-y-1.5">
                <p className="flex items-center gap-2 text-sm font-medium">
                  <CategoryDot category={c} /> {CATEGORY_LABELS[c]}
                </p>
                <Meter value={summary.consumed[c]} max={summary.budget[c]} threshold={settings.alert_threshold} label={`Budget ${CATEGORY_LABELS[c]} utilisé`} color={CATEGORY_COLOR[c]} />
                <p className="text-xs text-muted-foreground tabular-nums">
                  {money(summary.consumed[c])} / {money(summary.budget[c])}
                  <span className={cn("ml-1 font-medium", over ? "text-destructive" : "text-foreground")}>
                    · {over ? `dépassé de ${money(summary.consumed[c] - summary.budget[c])}` : `reste ${money(summary.remaining[c])}`}
                  </span>
                </p>
              </div>
            )
          })}
        </div>
      </Panel>

      {pending.length > 0 && (
        <Panel title="Dépenses récurrentes prévues ce mois-ci" description="Confirmez-les quand elles sont débitées.">
          <ul className="divide-y">
            {pending.map(({ recurring: r, dueOn }) => (
              <li key={r.id} className="flex flex-wrap items-center gap-3 py-2">
                <CategoryDot category={r.category} />
                <span className="min-w-0 flex-1 truncate">{r.description}</span>
                <span className="text-xs text-muted-foreground">prévue le {formatDate(dueOn)}</span>
                <span className="w-28 text-right font-medium tabular-nums">{money(r.amount_cents)}</span>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() =>
                    save.mutate({
                      values: {
                        amount_cents: r.amount_cents,
                        spent_on: dueOn,
                        description: r.description,
                        category: r.category,
                        subcategory: r.subcategory,
                        payment_method: r.payment_method,
                        recurring_id: r.id,
                      },
                    })
                  }
                >
                  Enregistrer
                </Button>
              </li>
            ))}
          </ul>
        </Panel>
      )}

      <Panel
        title="Dépenses"
        description={`${expenses.length} dépense${expenses.length > 1 ? "s" : ""} · ${money(shownTotal)}`}
        actions={
          <Button onClick={() => setEditing("new")}>
            <Plus aria-hidden /> Ajouter une dépense
          </Button>
        }
      >
        <div role="group" aria-label="Filtrer les dépenses" className="mb-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-5">
          <NativeSelect aria-label="Catégorie" value={filters.category} onChange={(e) => setFilters({ ...filters, category: e.target.value })}>
            <option value="">Toutes les catégories</option>
            {CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {CATEGORY_LABELS[c]}
              </option>
            ))}
          </NativeSelect>
          <Input aria-label="Montant minimum" placeholder="Montant min." inputMode="decimal" value={filters.min} onChange={(e) => setFilters({ ...filters, min: e.target.value })} />
          <Input aria-label="Montant maximum" placeholder="Montant max." inputMode="decimal" value={filters.max} onChange={(e) => setFilters({ ...filters, max: e.target.value })} />
          <Input aria-label="Du" type="date" value={filters.from} min={month} max={addMonths(month, 1)} onChange={(e) => setFilters({ ...filters, from: e.target.value })} />
          <Input aria-label="Au" type="date" value={filters.to} min={month} onChange={(e) => setFilters({ ...filters, to: e.target.value })} />
        </div>
        {expenses.length === 0 ? (
          <Empty title="Aucune dépense" action={<Button onClick={() => setEditing("new")}>Ajouter une dépense</Button>}>
            {Object.values(filters).some(Boolean) ? "Aucune dépense ne correspond à ces filtres." : `Aucune dépense enregistrée en ${monthLabel(month)}.`}
          </Empty>
        ) : (
          <ul className="divide-y" aria-label="Liste des dépenses">
            {expenses.map((e) => (
              <li key={e.id} className="flex flex-wrap items-center gap-3 py-2.5">
                <CategoryDot category={e.category} />
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium">
                    {e.description}
                    {e.recurring_id && <Repeat className="ml-1.5 inline size-3.5 text-muted-foreground" aria-label="récurrente" />}
                  </p>
                  <p className="truncate text-xs text-muted-foreground">
                    {formatDate(e.spent_on)} · {CATEGORY_LABELS[e.category]}
                    {e.subcategory && ` · ${e.subcategory}`}
                    {e.payment_method && ` · ${e.payment_method}`}
                  </p>
                </div>
                <span className="w-28 text-right font-semibold tabular-nums">{money(e.amount_cents)}</span>
                <div className="flex gap-1">
                  <Button variant="ghost" size="icon-sm" aria-label={`Modifier « ${e.description} »`} onClick={() => setEditing(e)}>
                    <Pencil />
                  </Button>
                  <Button variant="ghost" size="icon-sm" aria-label={`Supprimer « ${e.description} »`} onClick={() => onDelete(e)}>
                    <Trash2 />
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </Panel>

      <RecurringPanel />

      <FormDialog
        open={editing !== null}
        onClose={() => setEditing(null)}
        title={editing === "new" ? "Ajouter une dépense" : "Modifier la dépense"}
        schema={expenseSchema}
        pending={save.isPending}
        onSubmit={(values) => save.mutate({ id: editing && editing !== "new" ? editing.id : undefined, values }, { onSuccess: () => setEditing(null) })}
      >
        {(errors) => {
          const e = editing === "new" ? null : editing
          return (
            <>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Montant (€)" error={errors.amount_cents}>
                  <Input name="amount_cents" inputMode="decimal" defaultValue={moneyInput(e?.amount_cents)} autoFocus />
                </Field>
                <Field label="Date" error={errors.spent_on}>
                  <Input type="date" name="spent_on" defaultValue={e?.spent_on ?? new Date().toISOString().slice(0, 10)} />
                </Field>
              </div>
              <Field label="Description" error={errors.description}>
                <Input name="description" placeholder="ex. Courses de la semaine" defaultValue={e?.description ?? ""} maxLength={200} />
              </Field>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Catégorie" error={errors.category}>
                  <CategorySelect value={e?.category} />
                </Field>
                <Field label="Sous-catégorie (facultatif)" error={errors.subcategory}>
                  <Input name="subcategory" placeholder="ex. Alimentation" defaultValue={e?.subcategory ?? ""} maxLength={80} />
                </Field>
                <Field label="Moyen de paiement (facultatif)" error={errors.payment_method}>
                  <Input name="payment_method" placeholder="ex. Carte" defaultValue={e?.payment_method ?? ""} maxLength={40} />
                </Field>
              </div>
              <Field label="Note (facultatif)" error={errors.note}>
                <Textarea name="note" rows={2} defaultValue={e?.note ?? ""} />
              </Field>
            </>
          )
        }}
      </FormDialog>
    </>
  )
}

/** Dépenses récurrentes : modifier, suspendre, reprendre, arrêter ou supprimer. */
function RecurringPanel() {
  const { data, month, money } = useFinanceContext()
  const save = useSaveFinance("fin_recurring_expenses", "Dépense récurrente enregistrée.")
  const remove = useDeleteFinance("fin_recurring_expenses", "Dépense récurrente supprimée.")
  const confirm = useConfirm()
  const [editing, setEditing] = useState<Recurring | "new" | null>(null)

  return (
    <Panel
      title="Dépenses récurrentes"
      description="Loyer, abonnements… Elles apparaissent chaque mois comme dépenses prévues jusqu'à leur arrêt."
      actions={
        <Button variant="outline" onClick={() => setEditing("new")}>
          <Plus aria-hidden /> Nouvelle dépense récurrente
        </Button>
      }
    >
      {data.recurring.length === 0 ? (
        <Empty title="Aucune dépense récurrente" />
      ) : (
        <ul className="divide-y" aria-label="Dépenses récurrentes">
          {data.recurring.map((r) => {
            const ended = !!r.end_month && r.end_month < month
            return (
              <li key={r.id} className="flex flex-wrap items-center gap-3 py-2.5">
                <CategoryDot category={r.category} />
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium">{r.description}</p>
                  <p className="text-xs text-muted-foreground">
                    Le {r.day_of_month} de chaque mois · depuis {monthLabel(r.start_month)}
                    {r.end_month && ` · jusqu'en ${monthLabel(r.end_month)}`}
                    {r.paused && " · suspendue"}
                    {ended && " · arrêtée"}
                  </p>
                </div>
                <span className="w-28 text-right font-semibold tabular-nums">{money(r.amount_cents)}</span>
                <div className="flex gap-1">
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    aria-label={r.paused ? `Reprendre « ${r.description} »` : `Suspendre « ${r.description} »`}
                    onClick={() => save.mutate({ id: r.id, values: { paused: !r.paused } })}
                  >
                    {r.paused ? <Play /> : <Pause />}
                  </Button>
                  {!r.end_month && (
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      aria-label={`Arrêter « ${r.description} » après ce mois`}
                      onClick={async () => {
                        const ok = await confirm({
                          title: "Arrêter cette dépense récurrente ?",
                          description: `« ${r.description} » ne sera plus prévue après ${monthLabel(month)}. Les dépenses déjà enregistrées sont conservées.`,
                          confirmLabel: "Arrêter",
                        })
                        if (ok) save.mutate({ id: r.id, values: { end_month: month < r.start_month ? r.start_month : month } })
                      }}
                    >
                      <Square />
                    </Button>
                  )}
                  <Button variant="ghost" size="icon-sm" aria-label={`Modifier « ${r.description} »`} onClick={() => setEditing(r)}>
                    <Pencil />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    aria-label={`Supprimer « ${r.description} »`}
                    onClick={async () => {
                      const ok = await confirm({
                        title: "Supprimer cette dépense récurrente ?",
                        description: "Les dépenses déjà enregistrées sont conservées, mais ne seront plus rattachées à cette récurrence.",
                        confirmLabel: "Supprimer",
                        destructive: true,
                      })
                      if (ok) remove.mutate(r.id)
                    }}
                  >
                    <Trash2 />
                  </Button>
                </div>
              </li>
            )
          })}
        </ul>
      )}

      <FormDialog
        open={editing !== null}
        onClose={() => setEditing(null)}
        title={editing === "new" ? "Nouvelle dépense récurrente" : "Modifier la dépense récurrente"}
        schema={recurringSchema}
        pending={save.isPending}
        onSubmit={(values) => save.mutate({ id: editing && editing !== "new" ? editing.id : undefined, values }, { onSuccess: () => setEditing(null) })}
      >
        {(errors) => {
          const r = editing === "new" ? null : editing
          return (
            <>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Montant (€)" error={errors.amount_cents}>
                  <Input name="amount_cents" inputMode="decimal" defaultValue={moneyInput(r?.amount_cents)} autoFocus />
                </Field>
                <Field label="Jour du mois (1 à 28)" error={errors.day_of_month}>
                  <Input name="day_of_month" type="number" min={1} max={28} defaultValue={r?.day_of_month ?? 1} />
                </Field>
              </div>
              <Field label="Description" error={errors.description}>
                <Input name="description" placeholder="ex. Loyer" defaultValue={r?.description ?? ""} maxLength={200} />
              </Field>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Catégorie" error={errors.category}>
                  <CategorySelect value={r?.category} />
                </Field>
                <Field label="Sous-catégorie (facultatif)" error={errors.subcategory}>
                  <Input name="subcategory" defaultValue={r?.subcategory ?? ""} maxLength={80} />
                </Field>
                <Field label="Premier mois" error={errors.start_month}>
                  <Input type="month" name="start_month" defaultValue={(r?.start_month ?? month).slice(0, 7)} />
                </Field>
                <Field label="Dernier mois (facultatif)" error={errors.end_month}>
                  <Input type="month" name="end_month" defaultValue={r?.end_month?.slice(0, 7) ?? ""} />
                </Field>
                <Field label="Moyen de paiement (facultatif)" error={errors.payment_method}>
                  <Input name="payment_method" defaultValue={r?.payment_method ?? ""} maxLength={40} />
                </Field>
              </div>
            </>
          )
        }}
      </FormDialog>
    </Panel>
  )
}
