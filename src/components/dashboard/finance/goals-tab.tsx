"use client"

import { Pencil, Plus, Trash2 } from "lucide-react"
import { useState } from "react"
import { useConfirm } from "@/components/confirm"
import { Field } from "@/components/field"
import { NativeSelect } from "@/components/native-select"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { formatDate, todayISO } from "@/lib/domain"
import { goalProgress, type Goal } from "@/lib/finance"
import { useDeleteFinance, useSaveFinance } from "@/lib/finance-queries"
import { goalSchema } from "@/lib/finance-schemas"
import { cn } from "@/lib/utils"
import { Empty, FormDialog, Meter, moneyInput, Panel, useFinanceContext } from "./ui"

const LINKS: Record<string, string> = {
  none: "Montant saisi à la main",
  stability: "Suivre le solde du fonds d'urgence",
  growth: "Suivre les sommes investies",
}

export function GoalsTab() {
  const { data, money } = useFinanceContext()
  const save = useSaveFinance("fin_goals", "Objectif enregistré.")
  const remove = useDeleteFinance("fin_goals", "Objectif supprimé.")
  const confirm = useConfirm()
  const [editing, setEditing] = useState<Goal | "new" | null>(null)
  const [linked, setLinked] = useState("none")
  const open = (goal: Goal | "new") => {
    setLinked(goal === "new" ? "none" : goal.linked)
    setEditing(goal)
  }

  return (
    <Panel
      title="Objectifs financiers"
      description="Montant visé, échéance et progression ; un objectif peut suivre automatiquement le fonds d'urgence ou vos investissements."
      actions={
        <Button onClick={() => open("new")}>
          <Plus aria-hidden /> Nouvel objectif
        </Button>
      }
    >
      {data.goals.length === 0 ? (
        <Empty title="Aucun objectif" action={<Button onClick={() => open("new")}>Définir un objectif</Button>}>
          Par exemple : constituer 6 mois de réserve, financer un projet, un apport immobilier.
        </Empty>
      ) : (
        <ul className="grid gap-3 md:grid-cols-2" aria-label="Objectifs">
          {data.goals.map((g) => {
            const p = goalProgress(g, data)
            const late = !p.reached && !!g.due_date && g.due_date < todayISO()
            return (
              <li key={g.id} className="space-y-2 rounded-lg border p-4">
                <div className="flex items-start gap-2">
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium">{g.name}</p>
                    <p className={cn("text-xs", late ? "font-medium text-destructive" : "text-muted-foreground")}>
                      {g.due_date ? `Échéance : ${formatDate(g.due_date)}${late ? " (dépassée)" : ""}` : "Sans échéance"} · {LINKS[g.linked]}
                    </p>
                  </div>
                  <Button variant="ghost" size="icon-sm" aria-label={`Modifier « ${g.name} »`} onClick={() => open(g)}>
                    <Pencil />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    aria-label={`Supprimer « ${g.name} »`}
                    onClick={async () => {
                      if (await confirm({ title: `Supprimer « ${g.name} » ?`, description: "L'objectif et sa progression saisie seront supprimés définitivement.", confirmLabel: "Supprimer", destructive: true })) remove.mutate(g.id)
                    }}
                  >
                    <Trash2 />
                  </Button>
                </div>
                <Meter value={p.current} max={g.target_cents} threshold={101} label={`Progression de « ${g.name} »`} color="var(--fin-stability)" />
                <p className="flex justify-between text-sm tabular-nums">
                  <span>
                    {money(p.current)} / {money(g.target_cents)}
                  </span>
                  <span className={cn("font-medium", p.reached && "text-[oklch(0.45_0.12_155)] dark:text-success")}>
                    {p.reached ? "Atteint" : `${p.percent} %`}
                  </span>
                </p>
              </li>
            )
          })}
        </ul>
      )}

      <FormDialog
        open={editing !== null}
        onClose={() => setEditing(null)}
        title={editing === "new" ? "Nouvel objectif" : "Modifier l'objectif"}
        schema={goalSchema}
        pending={save.isPending}
        onSubmit={(values) => save.mutate({ id: editing && editing !== "new" ? editing.id : undefined, values }, { onSuccess: () => setEditing(null) })}
      >
        {(errors) => {
          const g = editing === "new" ? null : editing
          return (
            <>
              <Field label="Nom" error={errors.name}>
                <Input name="name" defaultValue={g?.name ?? ""} placeholder="ex. Apport immobilier" maxLength={120} autoFocus />
              </Field>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Montant visé (€)" error={errors.target_cents}>
                  <Input name="target_cents" inputMode="decimal" defaultValue={moneyInput(g?.target_cents)} />
                </Field>
                <Field label="Échéance (facultatif)">
                  <Input type="date" name="due_date" defaultValue={g?.due_date ?? ""} />
                </Field>
                <Field label="Progression">
                  <NativeSelect name="linked" value={linked} onChange={(e) => setLinked(e.target.value)}>
                    {Object.entries(LINKS).map(([v, l]) => (
                      <option key={v} value={v}>
                        {l}
                      </option>
                    ))}
                  </NativeSelect>
                </Field>
                {linked === "none" ? (
                  <Field label="Montant déjà réuni (€)" error={errors.current_cents}>
                    <Input name="current_cents" inputMode="decimal" defaultValue={moneyInput(g?.current_cents)} placeholder="0" />
                  </Field>
                ) : (
                  <input type="hidden" name="current_cents" value="" />
                )}
              </div>
            </>
          )
        }}
      </FormDialog>
    </Panel>
  )
}
