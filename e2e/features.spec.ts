import { expect, test } from "@playwright/test"
import { goTo, login, OWNER, searchProject } from "./helpers"

test("calendrier, tags, heures facturables et validées, journal d'audit, absences et jours fériés", async ({ page }) => {
  test.setTimeout(150_000)
  const id = Date.now().toString(36)
  const title = "Rédiger les mentions légales"
  await login(page, OWNER)
  await goTo(page, "Projets")
  await searchProject(page, "Site e-commerce (démo)")
  await page.getByRole("button", { name: /Site e-commerce \(démo\)/ }).click()

  // Vue calendrier
  await page.getByRole("tab", { name: "Calendrier" }).click()
  await expect(page.getByRole("region", { name: "Calendrier des tâches" })).toBeVisible()
  await page.getByRole("tab", { name: "Kanban" }).click()

  // Tag créé à la volée depuis la tâche, puis filtre par tag
  await page.getByRole("button", { name: title, exact: true }).click()
  const sheet = page.getByRole("dialog")
  await sheet.getByRole("button", { name: `Tags de « ${title} »` }).click()
  await page.getByLabel("Nom du nouveau tag").fill(`Juridique ${id}`)
  await page.getByRole("button", { name: "Créer le tag" }).click()
  await page.keyboard.press("Escape")
  await expect(sheet.getByRole("list", { name: "Tags" })).toContainText(`Juridique ${id}`)

  // Heures oubliées, rendues non facturables puis validées par l'administrateur
  const daysAgo = 30 + Math.floor(Math.random() * 300)
  const d = new Date()
  d.setDate(d.getDate() - daysAgo)
  const date = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`
  const hour = String(5 + Math.floor(Math.random() * 12)).padStart(2, "0")
  await sheet.getByRole("button", { name: "Ajouter du temps oublié" }).click()
  const add = page.getByRole("dialog", { name: "Ajouter du temps oublié" })
  await add.getByLabel("Date").fill(date)
  await add.getByLabel("Début").fill(`${hour}:00`)
  await add.getByLabel("Fin").fill(`${hour}:30`)
  await add.getByLabel("Travail réalisé (facultatif)").fill(`Audit ${id}`)
  await add.getByRole("button", { name: "Ajouter" }).click()
  const session = sheet.getByRole("listitem").filter({ hasText: `Audit ${id}` })
  await expect(session).toContainText("À valider")
  await session.getByRole("button", { name: "Facturable : rendre non facturable" }).click()
  await expect(session).toContainText("Non facturable")
  await session.getByRole("button", { name: "Valider" }).click()
  await expect(session).toContainText("Validée")
  await page.keyboard.press("Escape")

  // Filtre par tag : seule la tâche taguée reste
  await page.getByLabel("Filtrer par tag").selectOption({ label: `Juridique ${id}` })
  await expect(page.getByRole("button", { name: title, exact: true })).toBeVisible()
  await expect(page.getByRole("button", { name: "Intégration du paiement", exact: true })).toHaveCount(0)

  // Journal d'audit dans les rapports
  await goTo(page, "Rapports")
  const filters = page.getByRole("region", { name: "Filtres du rapport" })
  await filters.getByLabel("Rapport").selectOption({ label: "Journal d'audit des heures" })
  const audit = page.getByRole("table", { name: "Journal d'audit des heures" })
  await expect(audit).toContainText("Validation")
  await expect(audit).toContainText("Rendue non facturable")
  await expect(audit).toContainText("Ajout manuel")

  // Absences et jours fériés
  await page.getByRole("button", { name: "Équipe et paramètres" }).first().click()
  const team = page.getByRole("dialog")
  await team.getByRole("tab", { name: "Absences" }).click()
  await team.getByLabel("Type").selectOption({ label: "Formation" })
  await team.getByRole("button", { name: "Déclarer l'absence" }).click()
  await expect(team.getByRole("region", { name: "Absences à venir" })).toContainText("Formation")
  await team.getByRole("tab", { name: "Jours fériés" }).click()
  await team.getByLabel("Année").fill("2027")
  await team.getByRole("button", { name: "Ajouter les jours fériés français 2027" }).click()
  await expect(team.getByRole("list", { name: "Jours fériés 2027" })).toContainText("Lundi de Pâques")
})
