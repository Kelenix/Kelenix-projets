import "server-only"
import { createServerClient } from "@supabase/ssr"
import { createClient } from "@supabase/supabase-js"
import { cookies } from "next/headers"
import type { Database } from "@/lib/database.types"

/** Client lié à la session de l'utilisateur (soumis à la RLS). */
export async function createSessionClient() {
  const cookieStore = await cookies()
  return createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => cookieStore.getAll(),
        setAll: (toSet) => {
          try {
            toSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options))
          } catch {
            // Appel depuis un Server Component : le proxy rafraîchit déjà la session.
          }
        },
      },
    }
  )
}

/** Client administrateur (clé service, contourne la RLS) : à n'utiliser qu'après contrôle du rôle. */
export function createAdminClient() {
  // En production, passerelle interne : l'administration n'est pas exposée publiquement.
  return createClient<Database>(
    process.env.SUPABASE_INTERNAL_URL || process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )
}

/** Utilisateur connecté et son profil, ou null. */
export async function getViewer() {
  const supabase = await createSessionClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return null
  const { data: profile } = await supabase.from("profiles").select("*").eq("id", user.id).single()
  return profile
}
