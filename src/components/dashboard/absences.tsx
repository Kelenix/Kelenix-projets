"use client"

import { Plus, Trash2 } from "lucide-react"
import { useState } from "react"
import { toast } from "sonner"
import { useConfirm } from "@/components/confirm"
import { Field } from "@/components/field"
import { NativeSelect } from "@/components/native-select"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { ABSENCE_LABELS, formatDate, frenchHolidays, TAG_COLORS, todayISO, type AbsenceKind, type TagColor } from "@/lib/domain"
import {
  useAbsences,
  useDeleteAbsence,
  useDeleteHoliday,
  useDeleteTag,
  useHolidays,
  useProfiles,
  useSaveAbsence,
  useSaveHolidays,
  useTags,
} from "@/lib/queries"
import { cn } from "@/lib/utils"
import { useDashboard } from "./state"

/** Congés et absences : chacun déclare les siens ; l'équipe les voit (planification), l'administrateur gère tout. */
export function AbsencesPanel() {
  const { viewer, isOwner } = useDashboard()
  const { data: absences = [] } = useAbsences()
  const { data: profiles = [] } = useProfiles()
  const save = useSaveAbsence()
  const remove = useDeleteAbsence()
  const confirm = useConfirm()
  const [form, setForm] = useState({ user_id: viewer.id, kind: "leave", start_date: todayISO(), end_date: todayISO() })
  const names = new Map(profiles.map((p) => [p.id, p.full_name]))
  const upcoming = absences.filter((a) => a.end_date >= todayISO()).sort((a, b) => a.start_date.localeCompare(b.start_date))
  const past = absences.filter((a) => a.end_date < todayISO()).slice(0, 10)

  function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (form.end_date < form.start_date) return void toast.error("La fin doit suivre le début.")
    save.mutate({ values: form })
  }

  const row = (a: (typeof absences)[number]) => (
    <li key={a.id} className="flex flex-wrap items-center gap-2 py-2 text-sm">
      <span className="font-medium">{names.get(a.user_id) ?? "Ancien membre"}</span>
      <span className="rounded-full bg-muted px-2 py-0.5 text-xs">{ABSENCE_LABELS[a.kind as AbsenceKind]}</span>
      <span className="text-muted-foreground">
        {a.start_date === a.end_date ? formatDate(a.start_date) : `du ${formatDate(a.start_date)} au ${formatDate(a.end_date)}`}
      </span>
      {(a.user_id === viewer.id || isOwner) && (
        <Button
          variant="ghost"
          size="icon-sm"
          className="ml-auto"
          aria-label="Supprimer cette absence"
          onClick={async () => {
            if (await confirm({ title: "Supprimer cette absence ?", description: "Elle disparaîtra du calendrier de l'équipe.", confirmLabel: "Supprimer", destructive: true }))
              remove.mutate(a.id)
          }}
        >
          <Trash2 />
        </Button>
      )}
    </li>
  )

  return (
    <div className="space-y-4">
      <form onSubmit={onSubmit} className="grid gap-3 rounded-lg border bg-muted/40 p-3 sm:grid-cols-2">
        {isOwner && (
          <Field label="Personne">
            <NativeSelect value={form.user_id} onChange={(e) => setForm({ ...form, user_id: e.target.value })}>
              {profiles.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.full_name}
                </option>
              ))}
            </NativeSelect>
          </Field>
        )}
        <Field label="Type">
          <NativeSelect value={form.kind} onChange={(e) => setForm({ ...form, kind: e.target.value })}>
            {Object.entries(ABSENCE_LABELS).map(([v, l]) => (
              <option key={v} value={v}>
                {l}
              </option>
            ))}
          </NativeSelect>
        </Field>
        <Field label="Du">
          <Input type="date" value={form.start_date} onChange={(e) => setForm({ ...form, start_date: e.target.value })} />
        </Field>
        <Field label="Au">
          <Input type="date" value={form.end_date} onChange={(e) => setForm({ ...form, end_date: e.target.value })} />
        </Field>
        <div className="sm:col-span-2">
          <Button type="submit" disabled={save.isPending}>
            <Plus aria-hidden /> Déclarer l&apos;absence
          </Button>
        </div>
      </form>
      <section aria-label="Absences à venir">
        <h3 className="text-sm font-semibold">En cours et à venir</h3>
        {upcoming.length === 0 ? <p className="py-2 text-sm text-muted-foreground">Aucune absence prévue.</p> : <ul className="divide-y">{upcoming.map(row)}</ul>}
      </section>
      {past.length > 0 && (
        <section aria-label="Absences passées">
          <h3 className="text-sm font-semibold text-muted-foreground">Passées</h3>
          <ul className="divide-y opacity-80">{past.map(row)}</ul>
        </section>
      )}
    </div>
  )
}

/** Jours fériés (administrateur) : ajout manuel ou jours fériés français de l'année en un clic. */
export function HolidaysPanel() {
  const { data: holidays = [] } = useHolidays()
  const save = useSaveHolidays()
  const remove = useDeleteHoliday()
  const [year, setYear] = useState(new Date().getFullYear())
  const [day, setDay] = useState("")
  const [name, setName] = useState("")
  const shown = holidays.filter((h) => h.day.startsWith(String(year)))

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end gap-2">
        <Field label="Année">
          <Input type="number" value={year} onChange={(e) => setYear(Number(e.target.value))} className="w-28" />
        </Field>
        <Button variant="outline" onClick={() => save.mutate(frenchHolidays(year))} disabled={save.isPending}>
          Ajouter les jours fériés français {year}
        </Button>
      </div>
      <form
        className="flex flex-wrap items-end gap-2"
        onSubmit={(e) => {
          e.preventDefault()
          if (!day || !name.trim()) return void toast.error("Indiquez la date et le nom.")
          save.mutate([{ day, name: name.trim().slice(0, 80) }], { onSuccess: () => (setDay(""), setName("")) })
        }}
      >
        <Field label="Date">
          <Input type="date" value={day} onChange={(e) => setDay(e.target.value)} />
        </Field>
        <Field label="Nom">
          <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="ex. Pont de l'Ascension" maxLength={80} />
        </Field>
        <Button type="submit" variant="secondary">
          <Plus aria-hidden /> Ajouter
        </Button>
      </form>
      {shown.length === 0 ? (
        <p className="text-sm text-muted-foreground">Aucun jour férié enregistré pour {year}.</p>
      ) : (
        <ul className="divide-y" aria-label={`Jours fériés ${year}`}>
          {shown.map((h) => (
            <li key={h.day} className="flex items-center gap-3 py-2 text-sm">
              <span className="w-32 text-muted-foreground">{formatDate(h.day)}</span>
              <span className="flex-1">{h.name}</span>
              <Button variant="ghost" size="icon-sm" aria-label={`Supprimer ${h.name}`} onClick={() => remove.mutate(h.day)}>
                <Trash2 />
              </Button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

/** Tags de l'équipe (administrateur) : suppression ; la création se fait depuis une tâche ou un projet. */
export function TagsPanel() {
  const { data: tags = [] } = useTags()
  const remove = useDeleteTag()
  const confirm = useConfirm()
  if (tags.length === 0) return <p className="text-sm text-muted-foreground">Aucun tag. Créez-en depuis le détail d&apos;une tâche ou la fiche d&apos;un projet.</p>
  return (
    <ul className="flex flex-wrap gap-2" aria-label="Tags de l'équipe">
      {tags.map((t) => (
        <li key={t.id} className={cn("flex items-center gap-1 rounded-full py-0.5 pr-1 pl-2.5 text-xs font-medium", TAG_COLORS[t.color as TagColor])}>
          {t.name}
          <button
            type="button"
            aria-label={`Supprimer le tag ${t.name}`}
            className="grid size-5 place-items-center rounded-full hover:bg-black/10"
            onClick={async () => {
              if (await confirm({ title: `Supprimer le tag « ${t.name} » ?`, description: "Il sera retiré de toutes les tâches et de tous les projets.", confirmLabel: "Supprimer", destructive: true }))
                remove.mutate(t.id)
            }}
          >
            <Trash2 className="size-3" />
          </button>
        </li>
      ))}
    </ul>
  )
}
