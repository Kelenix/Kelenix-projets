"use client"

import { useState } from "react"
import { ErrorState } from "@/components/empty-state"
import { Skeleton } from "@/components/ui/skeleton"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { currentMonth, formatMoney } from "@/lib/finance"
import { useFinance } from "@/lib/finance-queries"
import { AllocationTab } from "./allocation-tab"
import { ExpensesTab } from "./expenses-tab"
import { GoalsTab } from "./goals-tab"
import { GrowthTab } from "./growth-tab"
import { HistoryTab } from "./history-tab"
import { IncomesTab } from "./incomes-tab"
import { OverviewTab } from "./overview-tab"
import { SettingsTab } from "./settings-tab"
import { StabilityTab } from "./stability-tab"
import { FinanceProvider, MonthNavigator } from "./ui"

const TABS = [
  { value: "overview", label: "Vue d'ensemble", Content: OverviewTab },
  { value: "incomes", label: "Revenus", Content: IncomesTab },
  { value: "expenses", label: "Dépenses", Content: ExpensesTab },
  { value: "allocation", label: "Répartition", Content: AllocationTab },
  { value: "growth", label: "Croissance", Content: GrowthTab },
  { value: "stability", label: "Stabilité", Content: StabilityTab },
  { value: "goals", label: "Objectifs", Content: GoalsTab },
  { value: "history", label: "Historique et rapports", Content: HistoryTab },
  { value: "settings", label: "Paramètres", Content: SettingsTab },
] as const

/**
 * Espace financier personnel (administrateurs) : données privées, chargées une fois et partagées
 * par tous les onglets ; le mois affiché est commun à tous.
 */
export function FinanceSection() {
  const query = useFinance()
  const [tab, setTab] = useState<string>("overview")
  const [month, setMonth] = useState(currentMonth)

  if (query.isError) return <ErrorState onRetry={() => query.refetch()} />
  if (query.isPending)
    return (
      <div className="space-y-4">
        <Skeleton className="h-10 w-full max-w-2xl rounded-lg" />
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
          {Array.from({ length: 5 }, (_, i) => (
            <Skeleton key={i} className="h-28 rounded-xl" />
          ))}
        </div>
        <Skeleton className="h-72 rounded-xl" />
      </div>
    )

  const { data, settings } = query.data
  return (
    <FinanceProvider
      value={{
        data,
        settings,
        month,
        setMonth,
        money: (cents, signed) => formatMoney(cents, settings.currency, { signed }),
        openTab: setTab,
      }}
    >
      <Tabs value={tab} onValueChange={setTab} className="gap-5">
        <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
          <div className="-mx-4 overflow-x-auto px-4 md:mx-0 md:px-0">
            <TabsList aria-label="Rubriques de l'espace financier" className="w-max">
              {TABS.map((t) => (
                <TabsTrigger key={t.value} value={t.value}>
                  {t.label}
                </TabsTrigger>
              ))}
            </TabsList>
          </div>
          <MonthNavigator />
        </div>
        {TABS.map(({ value, Content }) => (
          <TabsContent key={value} value={value} className="space-y-5">
            {tab === value && <Content />}
          </TabsContent>
        ))}
      </Tabs>
    </FinanceProvider>
  )
}
