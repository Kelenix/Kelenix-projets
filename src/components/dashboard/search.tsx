"use client"

import { FolderKanban, SearchIcon, SquareCheck } from "lucide-react"
import { useEffect, useId, useMemo, useRef, useState } from "react"
import { Input } from "@/components/ui/input"
import { normalize } from "@/lib/domain"
import { useProjects, useTasks } from "@/lib/queries"
import { cn } from "@/lib/utils"
import { useDashboard } from "./state"

type Result = { kind: "project" | "task"; id: string; label: string; hint?: string; projectId: string }

/** Recherche sur les projets et les tâches visibles, avec navigation au clavier. */
export function Search() {
  const { navigate } = useDashboard()
  const { data: projects = [] } = useProjects()
  const { data: tasks = [] } = useTasks()
  const [query, setQuery] = useState("")
  const [open, setOpen] = useState(false)
  const [active, setActive] = useState(0)
  const listId = useId()
  const rootRef = useRef<HTMLDivElement>(null)

  const results = useMemo<Result[]>(() => {
    const q = normalize(query.trim())
    if (!q) return []
    const names = new Map(projects.map((p) => [p.id, p.name]))
    return [
      ...projects
        .filter((p) => normalize(p.name).includes(q))
        .map((p) => ({ kind: "project" as const, id: p.id, label: p.name, projectId: p.id, hint: p.archived_at ? "Archivé" : undefined })),
      ...tasks
        .filter((t) => normalize(t.title).includes(q))
        .map((t) => ({ kind: "task" as const, id: t.id, label: t.title, projectId: t.project_id, hint: names.get(t.project_id) })),
    ].slice(0, 8)
  }, [query, projects, tasks])

  useEffect(() => {
    const onPointerDown = (e: PointerEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener("pointerdown", onPointerDown)
    return () => document.removeEventListener("pointerdown", onPointerDown)
  }, [])

  function select(result: Result) {
    navigate({
      section: "projects",
      projectId: result.projectId,
      taskId: result.kind === "task" ? result.id : null,
    })
    setQuery("")
    setOpen(false)
  }

  function onKeyDown(e: React.KeyboardEvent) {
    if (e.key === "ArrowDown") setActive((i) => Math.min(i + 1, results.length - 1))
    else if (e.key === "ArrowUp") setActive((i) => Math.max(i - 1, 0))
    else if (e.key === "Enter" && results[active]) select(results[active])
    else if (e.key === "Escape") setOpen(false)
    else return
    e.preventDefault()
  }

  const expanded = open && query.trim().length > 0

  return (
    <div ref={rootRef} className="relative w-full sm:w-64">
      <SearchIcon aria-hidden className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
      <Input
        type="search"
        role="combobox"
        aria-label="Rechercher un projet ou une tâche"
        aria-expanded={expanded}
        aria-controls={listId}
        aria-activedescendant={expanded && results[active] ? `${listId}-${active}` : undefined}
        placeholder="Rechercher…"
        className="pl-9"
        value={query}
        onChange={(e) => {
          setQuery(e.target.value)
          setActive(0)
          setOpen(true)
        }}
        onFocus={() => setOpen(true)}
        onKeyDown={onKeyDown}
      />
      {expanded && (
        <ul
          id={listId}
          role="listbox"
          className="absolute right-0 z-40 mt-2 w-full sm:w-80 overflow-hidden rounded-xl border bg-popover p-1 shadow-lg animate-in fade-in-0 zoom-in-95"
        >
          {results.length === 0 && <li className="px-3 py-6 text-center text-sm text-muted-foreground">Aucun résultat</li>}
          {results.map((result, index) => {
            const Icon = result.kind === "project" ? FolderKanban : SquareCheck
            return (
              <li
                key={`${result.kind}-${result.id}`}
                id={`${listId}-${index}`}
                role="option"
                aria-selected={index === active}
                onPointerEnter={() => setActive(index)}
                onClick={() => select(result)}
                className={cn(
                  "flex cursor-pointer items-center gap-3 rounded-lg px-3 py-2 text-sm",
                  index === active && "bg-accent text-accent-foreground"
                )}
              >
                <Icon className="size-4 shrink-0 text-muted-foreground" aria-hidden />
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-medium">{result.label}</span>
                  {result.hint && <span className="block truncate text-xs text-muted-foreground">{result.hint}</span>}
                </span>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
