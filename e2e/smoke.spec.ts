import { expect, test } from "@playwright/test"

// Tests de fumée d'un environnement déployé (préproduction) : PLAYWRIGHT_BASE_URL,
// SMOKE_EMAIL et SMOKE_PASSWORD sont fournis par le pipeline. Compte et données jetables.
const email = process.env.SMOKE_EMAIL!
const password = process.env.SMOKE_PASSWORD!

test("sécurité de l'API exposée", async ({ request }) => {
  expect((await request.get("/auth/v1/admin/users")).status()).toBe(404)
  expect((await request.post("/auth/v1/signup", { data: { email: "intrus@kelenix.test", password: "Intrus-12345" } })).status()).toBe(422)
  const page = await request.get("/login")
  expect(page.status()).toBe(200)
  expect(page.headers()["content-security-policy"]).toContain("frame-ancestors 'none'")
  expect(page.headers()["x-powered-by"]).toBeUndefined()
})

test("parcours principal", async ({ page }) => {
  const errors: string[] = []
  page.on("pageerror", (e) => errors.push(e.message))
  page.on("console", (m) => m.type() === "error" && errors.push(m.text()))

  await page.goto("/")
  await expect(page).toHaveURL(/\/login$/)
  await page.getByLabel("E-mail").fill(email)
  await page.getByLabel("Mot de passe", { exact: true }).fill(password)
  await page.getByRole("button", { name: "Se connecter" }).click()
  await expect(page.getByRole("heading", { level: 1, name: "Vue d'ensemble" })).toBeVisible()
  await page.waitForLoadState("networkidle")

  const nav = page.getByRole("navigation", { name: "Navigation principale" }).first()
  await nav.getByRole("button", { name: "Projets", exact: true }).click()
  await page.getByRole("button", { name: "Nouveau projet" }).first().click()
  await page.getByRole("dialog").getByLabel("Nom du projet").fill("Projet de préproduction")
  await page.getByRole("dialog").getByRole("button", { name: "Créer le projet" }).click()
  await page.locator("#contenu").getByRole("button", { name: /Projet de préproduction/ }).click()

  await page.getByRole("button", { name: "Nouvelle tâche" }).first().click()
  await page.getByRole("dialog").getByLabel("Titre").fill("Tâche de préproduction")
  await page.getByRole("dialog").getByRole("button", { name: "Créer la tâche" }).click()
  await page.getByRole("button", { name: /^Démarrer le chrono sur « Tâche de préproduction/ }).click()
  await page.getByRole("button", { name: /^Mettre en pause « Tâche de préproduction/ }).click()
  await page.getByRole("menuitem", { name: /^Repos/ }).click()
  await page.getByRole("button", { name: /^Reprendre « Tâche de préproduction/ }).click()
  await page.getByRole("button", { name: /^Terminer la session sur « Tâche de préproduction/ }).click()

  await page.reload()
  await expect(page.locator("#contenu").getByText("Tâche de préproduction")).toBeVisible()
  await nav.getByRole("button", { name: "Statistiques", exact: true }).click()
  await expect(page.getByRole("region", { name: "Tâches terminées par semaine" })).toBeVisible()

  await page.getByRole("button", { name: "Profil et déconnexion" }).first().click()
  await page.getByRole("menuitem", { name: "Se déconnecter" }).click()
  await expect(page).toHaveURL(/\/login$/)
  expect(errors).toEqual([])
})
