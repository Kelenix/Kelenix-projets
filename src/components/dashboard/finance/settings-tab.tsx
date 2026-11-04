"use client"

import { useState } from "react"
import { Field } from "@/components/field"
import { NativeSelect } from "@/components/native-select"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
import { ALERT_LABELS, CATEGORIES, CATEGORY_LABELS, TRANSFER_ACTIONS, type AlertKey, type TransferAction } from "@/lib/finance"
import { useSaveSettings } from "@/lib/finance-queries"
import { CategoryDot, Panel, useFinanceContext } from "./ui"

const CURRENCIES = { EUR: "Euro (€)", XAF: "Franc CFA (FCFA)", USD: "Dollar américain ($)", CHF: "Franc suisse (CHF)", GBP: "Livre sterling (£)", CAD: "Dollar canadien ($ CA)" }

export function SettingsTab() {
  const { settings } = useFinanceContext()
  const save = useSaveSettings()
  const [currency, setCurrency] = useState(settings.currency)
  const [threshold, setThreshold] = useState(String(settings.alert_threshold))
  const [disabled, setDisabled] = useState<string[]>(settings.disabled_alerts)
  const [carry, setCarry] = useState<Record<string, TransferAction>>({
    growth: "keep",
    stability: "keep",
    essentials: "next_month",
    reward: "next_month",
    ...(settings.carry_defaults as Record<string, TransferAction>),
  })
  const thresholdValue = Number(threshold)
  const validThreshold = Number.isInteger(thresholdValue) && thresholdValue >= 50 && thresholdValue <= 100

  return (
    <form
      className="space-y-5"
      onSubmit={(e) => {
        e.preventDefault()
        if (!validThreshold) return
        save.mutate({ currency, alert_threshold: thresholdValue, disabled_alerts: disabled, carry_defaults: carry })
      }}
    >
      <div className="grid gap-4 xl:grid-cols-2">
        <Panel title="Affichage" description="Les montants sont enregistrés au centime ; la devise ne sert qu'à l'affichage.">
          <Field label="Devise">
            <NativeSelect value={currency} onChange={(e) => setCurrency(e.target.value)}>
              {Object.entries(CURRENCIES).map(([v, l]) => (
                <option key={v} value={v}>
                  {l}
                </option>
              ))}
            </NativeSelect>
          </Field>
        </Panel>

        <Panel title="Alertes" description="Affichées discrètement dans la vue d'ensemble.">
          <Field label="Seuil « budget presque épuisé » (%)" error={validThreshold ? undefined : "Entre 50 et 100."}>
            <Input value={threshold} onChange={(e) => setThreshold(e.target.value)} inputMode="numeric" className="w-28" />
          </Field>
          <fieldset className="mt-4 space-y-2">
            <legend className="mb-1 text-sm font-medium">Alertes actives</legend>
            {(Object.keys(ALERT_LABELS) as AlertKey[]).map((key) => (
              <label key={key} className="flex items-center gap-2 text-sm">
                <Checkbox
                  checked={!disabled.includes(key)}
                  onCheckedChange={(on) => setDisabled(on === true ? disabled.filter((k) => k !== key) : [...disabled, key])}
                />
                {ALERT_LABELS[key]}
              </label>
            ))}
          </fieldset>
        </Panel>
      </div>

      <Panel title="Reliquats de fin de mois" description="Action proposée par défaut pour l'argent non utilisé de chaque catégorie (onglet Répartition).">
        <div className="grid gap-3 sm:grid-cols-2">
          {CATEGORIES.map((c) => (
            <Field key={c} label={CATEGORY_LABELS[c]}>
              <div className="flex items-center gap-2">
                <CategoryDot category={c} />
                <NativeSelect
                  aria-label={`Reliquat ${CATEGORY_LABELS[c]}`}
                  value={carry[c]}
                  onChange={(e) => setCarry({ ...carry, [c]: e.target.value as TransferAction })}
                  className="flex-1"
                >
                  {(Object.keys(TRANSFER_ACTIONS) as TransferAction[])
                    .filter((a) => a !== c)
                    .map((a) => (
                      <option key={a} value={a}>
                        {TRANSFER_ACTIONS[a]}
                      </option>
                    ))}
                </NativeSelect>
              </div>
            </Field>
          ))}
        </div>
      </Panel>

      <Button type="submit" disabled={save.isPending || !validThreshold}>
        Enregistrer les paramètres
      </Button>
    </form>
  )
}
