"use client"

import { Plus, Tag as TagIcon } from "lucide-react"
import { useState } from "react"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Input } from "@/components/ui/input"
import { TAG_COLORS, type TagColor } from "@/lib/domain"
import { useCreateTag, useSetTag, useTags } from "@/lib/queries"
import { cn } from "@/lib/utils"
import { isolate } from "./tasks/card-actions"

const COLORS = Object.keys(TAG_COLORS) as TagColor[]

/** Puces des tags d'une tâche ou d'un projet. */
export function TagChips({ ids, className }: { ids: string[]; className?: string }) {
  const { data: tags = [] } = useTags()
  const shown = tags.filter((t) => ids.includes(t.id))
  if (shown.length === 0) return null
  return (
    <ul aria-label="Tags" className={cn("flex flex-wrap gap-1", className)}>
      {shown.map((t) => (
        <li key={t.id} className={cn("rounded-full px-2 py-0.5 text-[11px] font-medium", TAG_COLORS[t.color as TagColor])}>
          {t.name}
        </li>
      ))}
    </ul>
  )
}

/** Choisir les tags d'une tâche ou d'un projet, et créer un tag à la volée. */
export function TagPicker({ target, id, selected, label }: { target: "task" | "project"; id: string; selected: string[]; label: string }) {
  const { data: tags = [] } = useTags()
  const setTag = useSetTag()
  const createTag = useCreateTag()
  const [name, setName] = useState("")

  async function create(e: React.FormEvent) {
    e.preventDefault()
    const text = name.trim().slice(0, 40)
    if (!text) return
    const existing = tags.find((t) => t.name.toLowerCase() === text.toLowerCase())
    const tag = existing ?? (await createTag.mutateAsync({ name: text, color: COLORS[tags.length % COLORS.length]! }))
    if (!selected.includes(tag.id)) setTag.mutate({ target, id, tagId: tag.id, on: true })
    setName("")
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild {...isolate}>
        <Button variant="outline" size="sm" className="relative z-10 h-7 px-2 text-xs" aria-label={label}>
          <TagIcon aria-hidden /> Tags
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent {...isolate} align="start" className="w-64">
        <DropdownMenuLabel>Tags</DropdownMenuLabel>
        {tags.length === 0 && <p className="px-2 py-1 text-xs text-muted-foreground">Aucun tag pour l&apos;instant.</p>}
        <div className="max-h-56 overflow-y-auto">
          {tags.map((t) => (
            <DropdownMenuCheckboxItem
              key={t.id}
              checked={selected.includes(t.id)}
              onSelect={(e) => e.preventDefault()}
              onCheckedChange={(on) => setTag.mutate({ target, id, tagId: t.id, on: on === true })}
            >
              <span className={cn("rounded-full px-2 py-0.5 text-xs font-medium", TAG_COLORS[t.color as TagColor])}>{t.name}</span>
            </DropdownMenuCheckboxItem>
          ))}
        </div>
        <DropdownMenuSeparator />
        <form onSubmit={create} className="flex gap-1 p-1" onKeyDown={(e) => e.stopPropagation()}>
          <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Nouveau tag" aria-label="Nom du nouveau tag" maxLength={40} className="h-8" />
          <Button type="submit" size="icon-sm" aria-label="Créer le tag" disabled={!name.trim() || createTag.isPending}>
            <Plus />
          </Button>
        </form>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
