import { z } from "zod"

const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max, `${max} caractères maximum.`)
    .transform((v) => v || null)

const optionalDate = z
  .string()
  .regex(/^(\d{4}-\d{2}-\d{2})?$/, "Date invalide.")
  .transform((v) => v || null)

export const loginSchema = z.object({
  email: z.string().trim().min(1, "Saisissez votre e-mail.").pipe(z.email("Adresse e-mail invalide.")),
  password: z.string().min(1, "Saisissez votre mot de passe."),
})

export const clientSchema = z.object({
  name: z.string().trim().min(1, "Le nom est obligatoire.").max(120, "120 caractères maximum."),
  company: optionalText(120),
  email: z
    .string()
    .trim()
    .refine((v) => v === "" || z.email().safeParse(v).success, "Adresse e-mail invalide.")
    .transform((v) => v || null),
  notes: optionalText(5000),
})

export const projectSchema = z.object({
  name: z.string().trim().min(1, "Le nom est obligatoire.").max(120, "120 caractères maximum."),
  description: optionalText(5000),
  client_id: z.string().transform((v) => v || null),
  due_date: optionalDate,
  status: z.enum(["planned", "in_progress", "paused", "done"]),
  member_ids: z.array(z.string()),
})

export const taskSchema = z
  .object({
    title: z.string().trim().min(1, "Le titre est obligatoire.").max(200, "200 caractères maximum."),
    description: optionalText(10000),
    status: z.enum(["todo", "in_progress", "rescheduled", "done"]),
    priority: z.enum(["low", "normal", "high"]),
    assignee_id: z.string().transform((v) => v || null),
    due_date: optionalDate,
    is_blocked: z.boolean(),
    blocked_reason: optionalText(1000),
  })
  .refine((t) => !t.is_blocked || t.blocked_reason, {
    message: "Expliquez ce qui bloque la tâche.",
    path: ["blocked_reason"],
  })

export const linkSchema = z.object({
  label: optionalText(120),
  url: z
    .string()
    .trim()
    .min(1, "Saisissez une adresse.")
    .refine((v) => /^https?:\/\/\S+$/i.test(v), "L'adresse doit commencer par http:// ou https://."),
})

export const memberSchema = z.object({
  full_name: z.string().trim().min(1, "Le nom est obligatoire.").max(120, "120 caractères maximum."),
  email: z.string().trim().toLowerCase().pipe(z.email("Adresse e-mail invalide.")),
  password: z.string().min(8, "8 caractères minimum."),
  role: z.enum(["owner", "collaborator"]),
})

export const passwordSchema = z.string().min(8, "8 caractères minimum.")

/** Erreurs Zod → { champ: message } pour l'affichage sous chaque champ. */
export function fieldErrors(error: z.ZodError) {
  const errors: Record<string, string> = {}
  for (const issue of error.issues) {
    const key = String(issue.path[0] ?? "form")
    errors[key] ??= issue.message
  }
  return errors
}
