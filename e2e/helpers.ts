import { expect, type Locator, type Page } from "@playwright/test"

// Comptes de démonstration fictifs créés par supabase/seed.sql (base locale uniquement).
export const OWNER = { email: "demo.owner@kelenix.test", password: "KelenixDemo2026!" }
export const COLLABORATOR = { email: "demo.collab@kelenix.test", password: "KelenixDemo2026!" }
/** Chef du projet « Site e-commerce (démo) ». */
export const PROJECT_LEAD = { email: "demo.lead@kelenix.test", password: "KelenixDemo2026!" }

export async function login(page: Page, account: { email: string; password: string }) {
  await page.goto("/login")
  await page.getByLabel("E-mail").fill(account.email)
  await page.getByLabel("Mot de passe", { exact: true }).fill(account.password)
  await page.getByRole("button", { name: "Se connecter" }).click()
  await expect(page.getByRole("heading", { level: 1, name: "Vue d'ensemble" })).toBeVisible()
  // Attendre l'hydratation et le chargement des données avant d'interagir.
  await page.waitForLoadState("networkidle")
}

/** Change de section via la barre latérale et attend l'affichage du titre. */
export async function goTo(page: Page, section: string) {
  await page.getByRole("navigation", { name: "Navigation principale" }).first().getByRole("button", { name: section, exact: true }).click()
  await expect(page.getByRole("heading", { level: 1, name: section, exact: true })).toBeVisible()
}

/** Filtre la liste des projets par son champ de recherche (la liste est affichée par paquets). */
export async function searchProject(page: Page, text: string) {
  await page.getByLabel("Rechercher un projet", { exact: true }).fill(text)
}

/** Glisser-déposer progressif (dnd-kit a besoin de plusieurs mouvements de pointeur). */
export async function dragTo(page: Page, source: Locator, target: Locator) {
  await source.scrollIntoViewIfNeeded()
  const from = (await source.boundingBox())!
  const to = (await target.boundingBox())!
  // Saisie par le haut de la carte (le titre), hors des contrôles checklist / chronomètre.
  await page.mouse.move(from.x + from.width / 2, from.y + 12)
  await page.mouse.down()
  await page.mouse.move(to.x + to.width / 2, to.y + 60, { steps: 15 })
  await page.mouse.up()
}

export async function logout(page: Page) {
  await page.getByRole("button", { name: "Profil et déconnexion" }).first().click()
  await page.getByRole("menuitem", { name: "Se déconnecter" }).click()
  await expect(page).toHaveURL(/\/login$/)
}
