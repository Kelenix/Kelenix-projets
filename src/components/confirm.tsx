"use client"

import { createContext, useCallback, useContext, useRef, useState, type ReactNode } from "react"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { buttonVariants } from "@/components/ui/button"

type ConfirmOptions = {
  title: string
  description: ReactNode
  confirmLabel: string
  destructive?: boolean
}

const ConfirmContext = createContext<((options: ConfirmOptions) => Promise<boolean>) | null>(null)

/** Fenêtre de confirmation unique, appelée comme une promesse : `if (await confirm(...))`. */
export function ConfirmProvider({ children }: { children: ReactNode }) {
  const [options, setOptions] = useState<ConfirmOptions | null>(null)
  const resolver = useRef<(value: boolean) => void>(undefined)

  const confirm = useCallback((next: ConfirmOptions) => {
    setOptions(next)
    return new Promise<boolean>((resolve) => (resolver.current = resolve))
  }, [])

  const close = (value: boolean) => {
    resolver.current?.(value)
    setOptions(null)
  }

  return (
    <ConfirmContext value={confirm}>
      {children}
      <AlertDialog open={!!options} onOpenChange={(open) => !open && close(false)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{options?.title}</AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div>{options?.description}</div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuler</AlertDialogCancel>
            <AlertDialogAction
              className={options?.destructive ? buttonVariants({ variant: "destructive" }) : undefined}
              onClick={() => close(true)}
            >
              {options?.confirmLabel}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </ConfirmContext>
  )
}

export function useConfirm() {
  const confirm = useContext(ConfirmContext)
  if (!confirm) throw new Error("useConfirm doit être utilisé dans ConfirmProvider")
  return confirm
}
