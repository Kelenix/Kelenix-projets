"use client"

import { ChevronLeft, ChevronRight, Loader2 } from "lucide-react"
import { createContext, useContext, useState, type ReactNode } from "react"
import { z } from "zod"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { addMonths, change, currentMonth, formatMoney, monthLabel, type Category, type FinanceData } from "@/lib/finance"
import type { FinanceSettings } from "@/lib/finance-queries"
import { fieldErrors } from "@/lib/schemas"
import { cn } from "@/lib/utils"

// ─── Contexte partagé par les onglets ──────────────────────────────────────
type FinanceContext = {
  data: FinanceData
  settings: Omit<FinanceSettings, "user_id" | "updated_at">
  month: string
  setMonth: (month: string) => void
  money: (cents: number, signed?: boolean) => string
  openTab: (tab: string) => void
}
const Context = createContext<FinanceContext | null>(null)
export const FinanceProvider = Context.Provider
export function useFinanceContext() {
  const ctx = useContext(Context)
  if (!ctx) throw new Error("useFinanceContext doit être utilisé dans l'espace Finances")
  return ctx
}

/** Couleurs des catégories (jetons du thème, clair et sombre). */
export const CATEGORY_COLOR: Record<Category, string> = {
  growth: "var(--fin-growth)",
  stability: "var(--fin-stability)",
  essentials: "var(--fin-essentials)",
  reward: "var(--fin-reward)",
}
export const CATEGORY_BG: Record<Category, string> = {
  growth: "bg-fin-growth",
  stability: "bg-fin-stability",
  essentials: "bg-fin-essentials",
  reward: "bg-fin-reward",
}

export function CategoryDot({ category, className }: { category: Category; className?: string }) {
  return <span aria-hidden className={cn("inline-block size-2.5 shrink-0 rounded-full", CATEGORY_BG[category], className)} />
}

// ─── Cartes et indicateurs ──────────────────────────────────────────────────
/**
 * Évolution face à la période précédente. `positiveIsGood` : une hausse est-elle souhaitable ?
 * (oui pour les revenus, non pour les dépenses).
 */
export function Delta({ current, previous, positiveIsGood = true, format }: {
  current: number
  previous: number
  positiveIsGood?: boolean
  format?: (diff: number) => string
}) {
  const diff = current - previous
  const pct = change(current, previous)
  if (diff === 0) return <span className="text-xs text-muted-foreground">Stable par rapport à la période précédente</span>
  const good = diff > 0 === positiveIsGood
  return (
    <span className={cn("text-xs font-medium", good ? "text-[oklch(0.5_0.13_155)] dark:text-success" : "text-destructive")}>
      {diff > 0 ? "▲" : "▼"} {format ? format(diff) : pct === null ? "nouveau" : `${pct > 0 ? "+" : ""}${pct} %`}
      <span className="font-normal text-muted-foreground"> vs période précédente</span>
    </span>
  )
}

export function StatCard({ label, value, children, accent, className }: {
  label: string
  value: ReactNode
  children?: ReactNode
  accent?: Category
  className?: string
}) {
  return (
    <div className={cn("flex flex-col gap-1 rounded-xl border bg-card p-4 shadow-xs", className)}>
      <p className="flex items-center gap-2 text-sm text-muted-foreground">
        {accent && <CategoryDot category={accent} />}
        {label}
      </p>
      <p className="text-2xl font-semibold tracking-tight tabular-nums">{value}</p>
      {children}
    </div>
  )
}

export function Panel({ title, description, actions, children, className }: {
  title: string
  description?: ReactNode
  actions?: ReactNode
  children: ReactNode
  className?: string
}) {
  return (
    <section aria-label={title} className={cn("rounded-xl border bg-card p-4 shadow-xs sm:p-5", className)}>
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="text-sm font-semibold">{title}</h2>
          {description && <p className="mt-0.5 text-xs text-muted-foreground">{description}</p>}
        </div>
        {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
      </div>
      {children}
    </section>
  )
}

/** État vide sobre, avec l'action qui permet d'en sortir. */
export function Empty({ title, children, action }: { title: string; children?: ReactNode; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center gap-2 rounded-lg border border-dashed px-6 py-8 text-center">
      <p className="text-sm font-medium">{title}</p>
      {children && <p className="max-w-md text-sm text-muted-foreground">{children}</p>}
      {action && <div className="mt-2">{action}</div>}
    </div>
  )
}

/** Barre de progression avec seuil d'alerte (orange) et dépassement (rouge). */
export function Meter({ value, max, threshold = 80, label, color }: {
  value: number
  max: number
  threshold?: number
  label: string
  color?: string
}) {
  const pct = max > 0 ? Math.round((value / max) * 100) : value > 0 ? 101 : 0
  const tone = pct > 100 ? "bg-destructive" : pct >= threshold ? "bg-warning" : ""
  return (
    <div role="progressbar" aria-label={label} aria-valuenow={Math.min(pct, 100)} aria-valuemin={0} aria-valuemax={100} className="h-2 overflow-hidden rounded-full bg-muted">
      <div
        className={cn("h-full rounded-full transition-[width] duration-300", tone || (color ? "" : "bg-primary"))}
        style={{ width: `${Math.min(pct, 100)}%`, ...(!tone && color ? { backgroundColor: color } : {}) }}
      />
    </div>
  )
}

// ─── Navigation entre mois ─────────────────────────────────────────────────
export function MonthNavigator() {
  const { month, setMonth } = useFinanceContext()
  const now = currentMonth()
  return (
    <div className="flex items-center gap-1" role="group" aria-label="Mois affiché">
      <Button variant="outline" size="icon-sm" aria-label="Mois précédent" onClick={() => setMonth(addMonths(month, -1))}>
        <ChevronLeft />
      </Button>
      <input
        type="month"
        aria-label="Choisir le mois"
        value={month.slice(0, 7)}
        onChange={(e) => e.target.value && setMonth(`${e.target.value}-01`)}
        className="h-8 rounded-lg border border-input bg-card px-2 text-sm capitalize"
      />
      <Button variant="outline" size="icon-sm" aria-label="Mois suivant" onClick={() => setMonth(addMonths(month, 1))}>
        <ChevronRight />
      </Button>
      {month !== now && (
        <Button variant="ghost" size="sm" onClick={() => setMonth(now)}>
          Mois actuel
        </Button>
      )}
      <span className="sr-only" aria-live="polite">
        {monthLabel(month)}
      </span>
    </div>
  )
}

// ─── Fenêtre de saisie validée ─────────────────────────────────────────────
/**
 * Fenêtre de formulaire : valide les champs avec le schéma, affiche les erreurs à côté des
 * champs et n'enregistre qu'une saisie valide.
 */
export function FormDialog<S extends z.ZodType>({
  open,
  onClose,
  title,
  description,
  schema,
  onSubmit,
  pending,
  submitLabel = "Enregistrer",
  children,
}: {
  open: boolean
  onClose: () => void
  title: string
  description?: string
  schema: S
  onSubmit: (values: z.output<S>) => void | Promise<void>
  pending?: boolean
  submitLabel?: string
  children: (errors: Record<string, string>) => ReactNode
}) {
  const [errors, setErrors] = useState<Record<string, string>>({})
  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        if (!o) {
          setErrors({})
          onClose()
        }
      }}
    >
      <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription className={cn(!description && "sr-only")}>{description ?? title}</DialogDescription>
        </DialogHeader>
        <form
          noValidate
          className="space-y-4"
          onSubmit={async (e) => {
            e.preventDefault()
            const parsed = schema.safeParse(Object.fromEntries(new FormData(e.currentTarget)))
            if (!parsed.success) return setErrors(fieldErrors(parsed.error as z.ZodError))
            setErrors({})
            await onSubmit(parsed.data)
          }}
        >
          {children(errors)}
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={onClose}>
              Annuler
            </Button>
            <Button type="submit" disabled={pending}>
              {pending && <Loader2 className="animate-spin" />} {submitLabel}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

export const moneyInput = (cents: number | null | undefined) => (cents ? (cents / 100).toFixed(2).replace(".", ",") : "")
export const useMoney = () => {
  const { settings } = useFinanceContext()
  return (cents: number, signed?: boolean) => formatMoney(cents, settings.currency, { signed })
}
