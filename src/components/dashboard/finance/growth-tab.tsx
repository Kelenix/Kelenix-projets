"use client"

import { LineChart as ValueIcon, Plus, Trash2 } from "lucide-react"
import { useState } from "react"
import { useConfirm } from "@/components/confirm"
import { Field } from "@/components/field"
import { NativeSelect } from "@/components/native-select"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { formatDate, todayISO } from "@/lib/domain"
import { addMonths, ASSET_TYPES, monthRange, portfolio } from "@/lib/finance"
import { useDeleteFinance, useSaveFinance } from "@/lib/finance-queries"
import { assetSchema, investmentSchema, valuationSchema } from "@/lib/finance-schemas"
import { cn } from "@/lib/utils"
import { WealthChart } from "./charts"
import { Empty, FormDialog, Panel, StatCard, useFinanceContext } from "./ui"

type Dialog = { type: "asset" } | { type: "movement"; assetId?: string } | { type: "valuation"; assetId?: string } | null

export function GrowthTab() {
  const { data, month, money } = useFinanceContext()
  const saveAsset = useSaveFinance("fin_assets", "Actif ajouté.")
  const saveMovement = useSaveFinance("fin_investment_movements", "Mouvement enregistré.")
  const saveValuation = useSaveFinance("fin_asset_valuations", "Valeur enregistrée.")
  const removeAsset = useDeleteFinance("fin_assets", "Actif supprimé.")
  const removeMovement = useDeleteFinance("fin_investment_movements", "Mouvement supprimé.")
  const confirm = useConfirm()
  const [dialog, setDialog] = useState<Dialog>(null)

  const total = portfolio(data)
  const rows = monthRange(addMonths(month, -11), month).map((m) => {
    const inMonth = data.investments.filter((i) => i.occurred_on.slice(0, 7) === m.slice(0, 7))
    const p = portfolio(data, m)
    return {
      month: m,
      contributions: inMonth.filter((i) => i.kind === "contribution").reduce((s, i) => s + i.amount_cents, 0),
      withdrawals: inMonth.filter((i) => i.kind === "withdrawal").reduce((s, i) => s + i.amount_cents, 0),
      net: p.net,
      value: p.value,
    }
  })
  const year = rows.reduce((s, r) => s + r.contributions - r.withdrawals, 0)
  const names = new Map(data.assets.map((a) => [a.id, a.name]))

  return (
    <>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Sommes investies (versements − retraits)" value={money(total.net)} accent="growth">
          <span className="text-xs text-muted-foreground">Sur 12 mois : {money(year, true)}</span>
        </StatCard>
        <StatCard label="Valeur actuelle renseignée" value={total.value === null ? "Non renseignée" : money(total.value)}>
          <span className="text-xs text-muted-foreground">
            {total.unvalued > 0 ? `${total.unvalued} actif${total.unvalued > 1 ? "s" : ""} sans valeur saisie` : "Tous les actifs sont valorisés"}
          </span>
        </StatCard>
        <StatCard
          label="Gain ou perte estimé"
          value={
            total.gain === null ? (
              "—"
            ) : (
              <span className={cn(total.gain < 0 ? "text-destructive" : "text-[oklch(0.45_0.12_155)] dark:text-success")}>{money(total.gain, true)}</span>
            )
          }
        >
          <span className="text-xs text-muted-foreground">Valeur − sommes investies − frais, sur les actifs valorisés</span>
        </StatCard>
        <StatCard label="Frais payés" value={money(total.fees)}>
          <span className="text-xs text-muted-foreground">
            Versé {money(total.contributed)} · retiré {money(total.withdrawn)}
          </span>
        </StatCard>
      </div>

      <Panel title="Croissance du patrimoine sur 12 mois" description="Barres : mouvements du mois. Courbes : sommes investies cumulées et valeur des actifs quand elle est renseignée.">
        <WealthChart rows={rows} />
      </Panel>

      <Panel
        title="Actifs et projets"
        actions={
          <>
            <Button variant="outline" onClick={() => setDialog({ type: "asset" })}>
              <Plus aria-hidden /> Nouvel actif
            </Button>
            <Button disabled={data.assets.length === 0} onClick={() => setDialog({ type: "movement" })}>
              <Plus aria-hidden /> Versement ou retrait
            </Button>
          </>
        }
      >
        {total.assets.length === 0 ? (
          <Empty title="Aucun actif suivi" action={<Button onClick={() => setDialog({ type: "asset" })}>Ajouter un actif</Button>}>
            Ajoutez un actif (ETF, actions, projet…) puis enregistrez vos versements et, si vous la connaissez, sa valeur.
          </Empty>
        ) : (
          <div className="-mx-4 overflow-x-auto px-4">
            <table className="w-full min-w-[640px] text-sm">
              <caption className="sr-only">Actifs suivis</caption>
              <thead>
                <tr className="border-b text-left text-xs text-muted-foreground">
                  <th scope="col" className="py-2 pr-3 font-medium">Actif</th>
                  <th scope="col" className="py-2 pr-3 text-right font-medium">Investi</th>
                  <th scope="col" className="py-2 pr-3 text-right font-medium">Valeur</th>
                  <th scope="col" className="py-2 pr-3 text-right font-medium">Gain / perte</th>
                  <th scope="col" className="py-2 text-right font-medium">
                    <span className="sr-only">Actions</span>
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {total.assets.map((a) => (
                  <tr key={a.asset.id}>
                    <th scope="row" className="py-2.5 pr-3 text-left font-medium">
                      {a.asset.name}
                      <span className="block text-xs font-normal text-muted-foreground">{ASSET_TYPES[a.asset.asset_type]}</span>
                    </th>
                    <td className="py-2.5 pr-3 text-right tabular-nums">{money(a.net)}</td>
                    <td className="py-2.5 pr-3 text-right tabular-nums">
                      {a.value === null ? <span className="text-muted-foreground">Non renseignée</span> : money(a.value)}
                      {a.valuedOn && <span className="block text-xs text-muted-foreground">au {formatDate(a.valuedOn)}</span>}
                    </td>
                    <td className={cn("py-2.5 pr-3 text-right tabular-nums", a.gain !== null && a.gain < 0 && "text-destructive")}>
                      {a.gain === null ? "—" : money(a.gain, true)}
                    </td>
                    <td className="py-2.5 text-right whitespace-nowrap">
                      <Button variant="ghost" size="sm" onClick={() => setDialog({ type: "movement", assetId: a.asset.id })}>
                        Mouvement
                      </Button>
                      <Button variant="ghost" size="sm" onClick={() => setDialog({ type: "valuation", assetId: a.asset.id })}>
                        <ValueIcon aria-hidden /> Valeur
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        aria-label={`Supprimer l'actif « ${a.asset.name} »`}
                        onClick={async () => {
                          const ok = await confirm({
                            title: `Supprimer « ${a.asset.name} » ?`,
                            description: "Ses versements, retraits et valeurs seront supprimés définitivement.",
                            confirmLabel: "Supprimer",
                            destructive: true,
                          })
                          if (ok) removeAsset.mutate(a.asset.id)
                        }}
                      >
                        <Trash2 />
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Panel>

      {data.investments.length > 0 && (
        <Panel title="Historique des mouvements">
          <ul className="divide-y text-sm" aria-label="Mouvements d'investissement">
            {data.investments.map((i) => (
              <li key={i.id} className="flex flex-wrap items-center gap-3 py-2">
                <span className="w-28 text-muted-foreground">{formatDate(i.occurred_on)}</span>
                <span className="min-w-0 flex-1 truncate">
                  {i.kind === "contribution" ? "Versement" : "Retrait / vente"} · {names.get(i.asset_id)}
                  {i.fees_cents > 0 && <span className="text-muted-foreground"> · frais {money(i.fees_cents)}</span>}
                </span>
                <span className={cn("font-medium tabular-nums", i.kind === "withdrawal" && "text-destructive")}>
                  {i.kind === "withdrawal" ? "−" : "+"}
                  {money(i.amount_cents)}
                </span>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  aria-label="Supprimer ce mouvement"
                  onClick={async () => {
                    if (await confirm({ title: "Supprimer ce mouvement ?", description: "Les sommes investies et les gains estimés seront recalculés.", confirmLabel: "Supprimer", destructive: true })) removeMovement.mutate(i.id)
                  }}
                >
                  <Trash2 />
                </Button>
              </li>
            ))}
          </ul>
        </Panel>
      )}

      <FormDialog open={dialog?.type === "asset"} onClose={() => setDialog(null)} title="Nouvel actif" schema={assetSchema} pending={saveAsset.isPending} onSubmit={(values) => saveAsset.mutate({ values }, { onSuccess: () => setDialog(null) })}>
        {(errors) => (
          <>
            <Field label="Nom de l'actif ou du projet" error={errors.name}>
              <Input name="name" placeholder="ex. ETF MSCI World" maxLength={120} autoFocus />
            </Field>
            <Field label="Type">
              <NativeSelect name="asset_type" defaultValue="etf">
                {Object.entries(ASSET_TYPES).map(([v, l]) => (
                  <option key={v} value={v}>
                    {l}
                  </option>
                ))}
              </NativeSelect>
            </Field>
          </>
        )}
      </FormDialog>

      <FormDialog
        open={dialog?.type === "movement"}
        onClose={() => setDialog(null)}
        title="Versement ou retrait"
        description="Un versement n'est pas un gain : seule la valeur renseignée permet d'estimer un gain ou une perte."
        schema={investmentSchema}
        pending={saveMovement.isPending}
        onSubmit={(values) => saveMovement.mutate({ values }, { onSuccess: () => setDialog(null) })}
      >
        {(errors) => (
          <>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Actif" error={errors.asset_id}>
                <NativeSelect name="asset_id" defaultValue={dialog?.type === "movement" ? dialog.assetId : undefined}>
                  {data.assets.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.name}
                    </option>
                  ))}
                </NativeSelect>
              </Field>
              <Field label="Type de mouvement">
                <NativeSelect name="kind" defaultValue="contribution">
                  <option value="contribution">Versement (investi)</option>
                  <option value="withdrawal">Retrait ou vente</option>
                </NativeSelect>
              </Field>
              <Field label="Montant (€)" error={errors.amount_cents}>
                <Input name="amount_cents" inputMode="decimal" autoFocus />
              </Field>
              <Field label="Frais (facultatif)" error={errors.fees_cents}>
                <Input name="fees_cents" inputMode="decimal" placeholder="0" />
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

      <FormDialog
        open={dialog?.type === "valuation"}
        onClose={() => setDialog(null)}
        title="Valeur actuelle"
        description="La valeur de marché de l'actif à une date donnée."
        schema={valuationSchema}
        pending={saveValuation.isPending}
        onSubmit={(values) => saveValuation.mutate({ values }, { onSuccess: () => setDialog(null) })}
      >
        {(errors) => (
          <>
            <input type="hidden" name="asset_id" value={dialog?.type === "valuation" ? (dialog.assetId ?? "") : ""} />
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Valeur (€)" error={errors.value_cents ?? errors.asset_id}>
                <Input name="value_cents" inputMode="decimal" autoFocus />
              </Field>
              <Field label="Date" error={errors.valued_on}>
                <Input type="date" name="valued_on" defaultValue={todayISO()} />
              </Field>
            </div>
          </>
        )}
      </FormDialog>
    </>
  )
}
