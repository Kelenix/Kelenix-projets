"use client"

import { ChevronDown } from "lucide-react"
import { useState, type ReactNode } from "react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

/** Affiche une longue liste par paquets (rendu léger, page courte). */
export function useShowMore<T>(items: T[], pageSize: number) {
  const [count, setCount] = useState(pageSize)
  const remaining = Math.max(0, items.length - count)
  return {
    visible: items.slice(0, count),
    remaining,
    showMore: () => setCount((c) => c + pageSize),
  }
}

export function ShowMoreButton({
  remaining,
  onClick,
  className,
}: {
  remaining: number
  onClick: () => void
  className?: string
}) {
  if (remaining === 0) return null
  return (
    <Button variant="outline" onClick={onClick} className={cn("w-full", className)}>
      <ChevronDown aria-hidden /> Afficher plus ({remaining} restant{remaining > 1 ? "s" : ""})
    </Button>
  )
}

/**
 * Rend `children(visibles)` puis le bouton « Afficher plus ». Changer la `key` du composant
 * (ex. quand un filtre change) repart du premier paquet.
 */
export function ShowMore<T>({
  items,
  pageSize,
  children,
  buttonClassName,
}: {
  items: T[]
  pageSize: number
  children: (visible: T[]) => ReactNode
  buttonClassName?: string
}) {
  const { visible, remaining, showMore } = useShowMore(items, pageSize)
  return (
    <>
      {children(visible)}
      <ShowMoreButton remaining={remaining} onClick={showMore} className={buttonClassName} />
    </>
  )
}
