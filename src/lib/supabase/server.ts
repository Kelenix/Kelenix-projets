import "server-only"
import { createServerClient } from "@supabase/ssr"
import { createClient } from "@supabase/supabase-js"
import { cookies } from "next/headers"
import type { Database } from "@/lib/database.types"
import { AUTH_COOKIE, serverConfig } from "./config"

/** Client lié à la session de l'utilisateur (soumis à la RLS). */
export async function createSessionClient() {
  const cookieStore = await cookies()
  const { url, anonKey } = serverConfig()
  return createServerClient<Database>(url, anonKey, {
    cookieOptions: { name: AUTH_COOKIE },
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
  })
}

/** Client administrateur (clé service, contourne la RLS) : à n'utiliser qu'après contrôle du rôle. */
export function createAdminClient() {
  // En production, passerelle interne : l'administration n'est pas exposée publiquement.
  return createClient<Database>(
    serverConfig().url,
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
