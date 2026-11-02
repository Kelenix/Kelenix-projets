import type { LucideIcon } from "lucide-react"
import type { ReactNode } from "react"
import { cn } from "@/lib/utils"

export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
  className,
}: {
  icon: LucideIcon
  title: string
  description?: string
  action?: ReactNode
  className?: string
}) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center gap-3 rounded-xl border border-dashed bg-card/60 px-6 py-12 text-center",
        className
      )}
    >
      <span className="grid size-10 place-items-center rounded-full bg-accent text-accent-foreground">
        <Icon className="size-5" aria-hidden />
      </span>
      <div className="space-y-1">
        <p className="font-medium">{title}</p>
        {description && <p className="max-w-sm text-sm text-muted-foreground">{description}</p>}
      </div>
      {action}
    </div>
  )
}

export function ErrorState({ onRetry }: { onRetry: () => void }) {
  return (
    <div role="alert" className="rounded-xl border border-destructive/30 bg-destructive/5 px-6 py-8 text-center text-sm">
      <p className="font-medium text-destructive">Impossible de charger les données.</p>
      <button type="button" onClick={onRetry} className="mt-2 text-primary underline-offset-4 hover:underline">
        Réessayer
      </button>
    </div>
  )
}
