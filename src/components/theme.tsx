"use client"

import { useEffect, useSyncExternalStore } from "react"

export type Theme = "light" | "dark" | "system"
export const THEME_LABELS: Record<Theme, string> = { light: "Clair", dark: "Sombre", system: "Système" }
const KEY = "kelenix-theme"
const listeners = new Set<() => void>()

function read(): Theme {
  try {
    const value = localStorage.getItem(KEY)
    return value === "dark" || value === "system" ? value : "light"
  } catch {
    return "light"
  }
}

function apply(theme: Theme) {
  const dark = theme === "dark" || (theme === "system" && matchMedia("(prefers-color-scheme: dark)").matches)
  document.documentElement.classList.toggle("dark", dark)
}

function subscribe(listener: () => void) {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

/** Thème de l'interface (clair par défaut), mémorisé sur l'appareil ; « Système » suit le réglage du poste. */
export function useTheme() {
  const theme = useSyncExternalStore(subscribe, read, () => "light" as const)

  useEffect(() => {
    apply(theme)
    if (theme !== "system") return
    const media = matchMedia("(prefers-color-scheme: dark)")
    const onChange = () => apply("system")
    media.addEventListener("change", onChange)
    return () => media.removeEventListener("change", onChange)
  }, [theme])

  function choose(next: Theme) {
    try {
      localStorage.setItem(KEY, next)
    } catch {
      // Stockage indisponible (navigation privée) : le thème s'applique sans être mémorisé.
      apply(next)
    }
    listeners.forEach((l) => l())
  }

  return { theme, choose }
}
