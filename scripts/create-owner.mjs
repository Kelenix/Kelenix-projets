// Crée un compte propriétaire (aucune inscription publique n'existe).
// Usage : pnpm create-owner [--if-missing] <email> "<Nom complet>"
//   --if-missing : ne fait rien s'il existe déjà un propriétaire (utilisé au déploiement).
// Variables : SUPABASE_URL (ou NEXT_PUBLIC_SUPABASE_URL en local), SUPABASE_SERVICE_ROLE_KEY,
// KELENIX_OWNER_PASSWORD (facultatif ; sinon un mot de passe provisoire est généré et affiché une fois).
// Sans dépendance : appels HTTP directs (utilisable dans l'image Docker de production).
import { randomBytes } from "node:crypto"

const args = process.argv.slice(2)
const ifMissing = args.includes("--if-missing")
const [email, fullName] = args.filter((a) => a !== "--if-missing")
const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

function fail(message) {
  console.error(`Échec : ${message}`)
  process.exit(1)
}

if (!email || !fullName) {
  console.error('Usage : pnpm create-owner [--if-missing] <email> "<Nom complet>"')
  process.exit(1)
}
if (!url || !serviceKey) fail("variables NEXT_PUBLIC_SUPABASE_URL et SUPABASE_SERVICE_ROLE_KEY requises.")

async function call(path, init = {}) {
  const response = await fetch(`${url}${path}`, {
    ...init,
    headers: {
      apikey: serviceKey,
      Authorization: `Bearer ${serviceKey}`,
      "Content-Type": "application/json",
      ...init.headers,
    },
  })
  const body = await response.text()
  if (!response.ok) fail(`${response.status} ${body}`)
  return body ? JSON.parse(body) : null
}

if (ifMissing) {
  const owners = await call("/rest/v1/profiles?select=id&role=eq.owner&limit=1")
  if (owners.length > 0) {
    console.log("Un propriétaire existe déjà : aucun compte créé.")
    process.exit(0)
  }
}

const provided = process.env.KELENIX_OWNER_PASSWORD
const password = provided || randomBytes(12).toString("base64url")
const user = await call("/auth/v1/admin/users", {
  method: "POST",
  body: JSON.stringify({
    email,
    password,
    email_confirm: true,
    user_metadata: { full_name: fullName },
    app_metadata: { role: "owner" },
  }),
})
// Le rôle est fixé explicitement sur le profil (app_metadata peut arriver après le trigger de création).
await call(`/rest/v1/profiles?id=eq.${user.id}`, { method: "PATCH", body: JSON.stringify({ role: "owner" }) })

console.log(`Propriétaire créé : ${email}`)
if (!provided) console.log(`Mot de passe provisoire (affiché une seule fois) : ${password}`)
