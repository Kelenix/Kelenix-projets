// Remplace l'e-mail du compte propriétaire principal (le plus ancien) par TARGET_EMAIL.
// Exécuté dans le conteneur de l'application en production (opération ponctuelle, idempotente).
// Variables : SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, TARGET_EMAIL. N'affiche aucune adresse.
const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL
const key = process.env.SUPABASE_SERVICE_ROLE_KEY
const email = process.env.TARGET_EMAIL?.trim().toLowerCase()

function fail(message) {
  console.error(`Échec : ${message}`)
  process.exit(1)
}
if (!url || !key || !email) fail("SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY et TARGET_EMAIL sont requis.")

async function call(path, init = {}) {
  const response = await fetch(`${url}${path}`, {
    ...init,
    headers: { apikey: key, Authorization: `Bearer ${key}`, "Content-Type": "application/json", ...init.headers },
  })
  const body = await response.text()
  if (!response.ok) fail(`${response.status} ${body}`)
  return body ? JSON.parse(body) : null
}

const [owner] = await call("/rest/v1/profiles?select=id,email&role=eq.owner&order=created_at.asc&limit=1")
if (!owner) fail("aucun propriétaire.")
if (owner.email === email) {
  console.log("E-mail du propriétaire déjà à jour.")
  process.exit(0)
}
await call(`/auth/v1/admin/users/${owner.id}`, { method: "PUT", body: JSON.stringify({ email, email_confirm: true }) })
await call(`/rest/v1/profiles?id=eq.${owner.id}`, { method: "PATCH", body: JSON.stringify({ email }) })
console.log("E-mail du propriétaire mis à jour.")
