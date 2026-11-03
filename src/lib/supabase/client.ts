import { createBrowserClient } from "@supabase/ssr"
import type { Database } from "@/lib/database.types"
import { AUTH_COOKIE, browserConfig } from "./config"

let client: ReturnType<typeof createBrowserClient<Database>> | undefined

export function getSupabase() {
  if (!client) {
    const { url, anonKey } = browserConfig()
    client = createBrowserClient<Database>(url, anonKey, { cookieOptions: { name: AUTH_COOKIE } })
  }
  return client
}
