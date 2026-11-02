"use client"

import { Children, cloneElement, isValidElement, useId, type ReactElement, type ReactNode } from "react"
import { Label } from "@/components/ui/label"
import { cn } from "@/lib/utils"

type ControlProps = { id?: string; "aria-invalid"?: boolean; "aria-describedby"?: string }

/** Libellé + contrôle + message d'erreur, reliés pour l'accessibilité. */
export function Field({
  label,
  error,
  hint,
  className,
  children,
}: {
  label: string
  error?: string
  hint?: string
  className?: string
  children: ReactNode
}) {
  const id = useId()
  const messageId = `${id}-message`
  const control = Children.only(children)
  // Le contrôle peut être enveloppé (ex. bouton afficher/masquer) : on cible le premier élément.
  const wire = (el: ReactNode): ReactNode => {
    if (!isValidElement<ControlProps & { children?: ReactNode }>(el)) return el
    if (typeof el.type === "string" && el.type === "div") {
      const [first, ...rest] = Children.toArray(el.props.children)
      return cloneElement(el, {}, wire(first), ...rest)
    }
    return cloneElement(el as ReactElement<ControlProps>, {
      id,
      "aria-invalid": error ? true : undefined,
      "aria-describedby": error || hint ? messageId : undefined,
    })
  }

  return (
    <div className={cn("space-y-1.5", className)}>
      <Label htmlFor={id}>{label}</Label>
      {wire(control)}
      {(error || hint) && (
        <p id={messageId} className={cn("text-xs", error ? "text-destructive" : "text-muted-foreground")}>
          {error ?? hint}
        </p>
      )}
    </div>
  )
}
