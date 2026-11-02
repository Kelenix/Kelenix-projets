"use server"

import { fieldErrors, memberSchema } from "@/lib/schemas"
import { createAdminClient, getViewer } from "@/lib/supabase/server"

type Result = { ok: true } | { ok: false; error: string; fields?: Record<string, string> }

async function requireOwner() {
  const viewer = await getViewer()
  return viewer?.role === "owner" ? viewer : null
}

/** Création d'un membre de l'équipe par le propriétaire (compte e-mail + mot de passe provisoire). */
export async function createMember(input: unknown): Promise<Result> {
  if (!(await requireOwner())) return { ok: false, error: "Seul un propriétaire peut ajouter un membre." }

  const parsed = memberSchema.safeParse(input)
  if (!parsed.success) return { ok: false, error: "Vérifiez le formulaire.", fields: fieldErrors(parsed.error) }

  const { email, password, full_name, role } = parsed.data
  const admin = createAdminClient()
  const { data, error } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { full_name },
    app_metadata: { role },
  })
  if (error) {
    const taken = error.code === "email_exists" || /already/i.test(error.message)
    return taken
      ? { ok: false, error: "Un compte existe déjà avec cet e-mail.", fields: { email: "E-mail déjà utilisé." } }
      : { ok: false, error: "Impossible de créer le compte. Réessayez." }
  }
  // Le rôle est fixé explicitement sur le profil (app_metadata peut arriver après le trigger de création).
  const { error: roleError } = await admin.from("profiles").update({ role }).eq("id", data.user.id)
  return roleError ? { ok: false, error: "Compte créé, mais le rôle n'a pas pu être enregistré." } : { ok: true }
}

/** Suppression d'un membre (jamais soi-même). Ses tâches repassent « À assigner ». */
export async function deleteMember(userId: unknown): Promise<Result> {
  const owner = await requireOwner()
  if (!owner) return { ok: false, error: "Seul un propriétaire peut retirer un membre." }
  if (typeof userId !== "string") return { ok: false, error: "Membre introuvable." }
  if (userId === owner.id) return { ok: false, error: "Vous ne pouvez pas supprimer votre propre compte." }

  const { error } = await createAdminClient().auth.admin.deleteUser(userId)
  return error ? { ok: false, error: "Impossible de retirer ce membre. Réessayez." } : { ok: true }
}
