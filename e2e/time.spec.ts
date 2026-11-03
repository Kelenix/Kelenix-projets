import { expect, test } from "@playwright/test"
import { login, OWNER, searchProject } from "./helpers"

test("temps : heures oubliées, modification justifiée, description, historique et périodes", async ({ page }) => {
  test.setTimeout(120_000)
  // Jour passé tiré au hasard : la plage ne chevauche pas celle d'une exécution précédente.
  const daysAgo = 30 + Math.floor(Math.random() * 300)
  const d = new Date()
  d.setDate(d.getDate() - daysAgo)
  const date = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`
  const hour = String(5 + Math.floor(Math.random() * 12)).padStart(2, "0")
  const id = Date.now().toString(36)

  await login(page, OWNER)
  await page.getByRole("navigation", { name: "Navigation principale" }).first().getByRole("button", { name: "Projets", exact: true }).click()
  await searchProject(page, "Site e-commerce (démo)")
  await page.getByRole("button", { name: /Site e-commerce \(démo\)/ }).click()
  await page.getByRole("button", { name: "Rédiger les mentions légales", exact: true }).click()
  const sheet = page.getByRole("dialog")

  // Heures oubliées
  await sheet.getByRole("button", { name: "Ajouter du temps oublié" }).click()
  const add = page.getByRole("dialog", { name: "Ajouter du temps oublié" })
  await add.getByLabel("Date").fill(date)
  await add.getByLabel("Début").fill(`${hour}:00`)
  await add.getByLabel("Fin").fill(`${hour}:45`)
  await add.getByLabel("Travail réalisé (facultatif)").fill(`Brouillon ${id}`)
  await add.getByRole("button", { name: "Ajouter" }).click()
  await expect(add).toBeHidden()
  const session = sheet.getByRole("listitem").filter({ hasText: `Brouillon ${id}` })
  await expect(session).toContainText("Ajout manuel")
  await expect(session).toContainText("45 min")

  // Modification justifiée
  await session.getByRole("button", { name: "Modifier la session" }).click()
  const edit = page.getByRole("dialog", { name: "Modifier la session" })
  await edit.getByLabel("Fin").fill(`${date}T${hour}:55`)
  await edit.getByRole("button", { name: "Enregistrer" }).click()
  await expect(edit.getByText("Expliquez la raison de la modification.")).toBeVisible()
  await edit.getByLabel("Justification").fill("Dix minutes oubliées")
  await edit.getByRole("button", { name: "Enregistrer" }).click()
  await expect(edit).toBeHidden()
  await expect(session).toContainText("55 min")
  await expect(session).toContainText("Modifiée")
  await expect(session).toContainText("« Dix minutes oubliées »")

  // Description modifiée sans justification
  await session.getByRole("button", { name: "Modifier la description" }).click()
  // Le texte d'origine passe dans le champ : la ligne est ciblée par le champ lui-même.
  await sheet.getByLabel("Description du travail réalisé").fill(`Relecture ${id}`)
  await sheet.getByRole("button", { name: "Enregistrer", exact: true }).click()
  await expect(sheet.getByText(`Relecture ${id}`)).toBeVisible()

  // Périodes : jour, mois, année
  for (const period of ["Jour", "Mois", "Année"]) {
    await sheet.getByRole("tab", { name: period }).click()
    await expect(sheet.getByRole("tab", { name: period })).toHaveAttribute("aria-selected", "true")
  }
  await page.keyboard.press("Escape")

  // Vue projet : temps total, par tâche, historique
  await expect(page.getByRole("heading", { name: /^Temps passé · .* au total/ })).toBeVisible()
  await page.getByRole("tab", { name: "Par tâche" }).click()
  await expect(page.getByRole("table", { name: "Temps total par tâche" })).toContainText("Rédiger les mentions légales")
  await page.getByRole("tab", { name: "Historique des sessions" }).click()
  await expect(page.locator("#contenu").getByText(`Relecture ${id}`)).toBeVisible()
})
