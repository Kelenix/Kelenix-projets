// Configuration Supabase lue à l'exécution : une même image Docker sert la préproduction puis
// la production. En développement, les variables NEXT_PUBLIC_* de .env.local suffisent.

/** Nom fixe du cookie de session, identique côté navigateur et serveur quelle que soit l'URL. */
export const AUTH_COOKIE = "sb-kelenix-auth-token"

/**
 * Côté serveur : en production SUPABASE_URL vise la passerelle interne (réseau Docker),
 * sans dépendre du DNS public.
 */
export function serverConfig() {
  const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL
  const anonKey = process.env.SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!url || !anonKey) throw new Error("Configuration Supabase manquante (SUPABASE_URL, SUPABASE_ANON_KEY).")
  return { url, anonKey }
}

/** Côté navigateur : l'API est servie sur la même origine que l'application en production. */
export function browserConfig() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || window.location.origin
  const anonKey =
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
    document.querySelector<HTMLMetaElement>('meta[name="supabase-anon-key"]')?.content
  if (!anonKey) throw new Error("Clé publique Supabase introuvable.")
  return { url, anonKey }
}
