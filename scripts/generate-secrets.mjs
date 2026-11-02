// Génère les secrets de production (format .env) : mot de passe Postgres, secret JWT et
// clés Supabase signées (anon, service_role). Utilisé une fois, par l'installation automatique.
import { createHmac, randomBytes } from "node:crypto"

const b64 = (value) => Buffer.from(JSON.stringify(value)).toString("base64url")
const sign = (payload, secret) => {
  const body = `${b64({ alg: "HS256", typ: "JWT" })}.${b64(payload)}`
  return `${body}.${createHmac("sha256", secret).update(body).digest("base64url")}`
}

const jwtSecret = randomBytes(48).toString("hex")
const iat = Math.floor(Date.now() / 1000)
const exp = iat + 10 * 365 * 24 * 3600

console.log(`POSTGRES_PASSWORD=${randomBytes(24).toString("hex")}`)
console.log(`JWT_SECRET=${jwtSecret}`)
console.log(`ANON_KEY=${sign({ role: "anon", iss: "supabase", iat, exp }, jwtSecret)}`)
console.log(`SERVICE_ROLE_KEY=${sign({ role: "service_role", iss: "supabase", iat, exp }, jwtSecret)}`)
console.log(`ADMIN_PASSWORD=${randomBytes(12).toString("base64url")}`)
