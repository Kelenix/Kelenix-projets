import { expect, test } from "@playwright/test"
import { goTo, login, OWNER, searchProject } from "./helpers"

test("suivi des projets : budget et alerte, statuts, tâches par état, jalons, charge, dépassements", async ({ page }) => {
  test.setTimeout(120_000)
  const id = Date.now().toString(36)
  const project = "Refonte site vitrine (démo)"
  await login(page, OWNER)

  // Alerte de budget dès la vue d'ensemble (le projet de démo dépasse son budget de 15 h).
  await expect(page.getByRole("alert", { name: "Alertes de budget" })).toContainText(project)

  // Projets par statut : actifs, suspendus, terminés.
  await goTo(page, "Projets")
  const byStatus = page.getByRole("group", { name: "Projets par statut" })
  await byStatus.getByRole("button", { name: /^Suspendus/ }).click()
  await expect(page.getByRole("button", { name: /Audit SEO \(démo\)/ })).toBeVisible()
  await expect(page.getByRole("button", { name: new RegExp(project.replace(/[()]/g, "\\$&")) })).toHaveCount(0)
  await byStatus.getByRole("button", { name: /^Suspendus/ }).click()

  // Fiche projet : tâches par état, heures investies face au budget, jalons.
  await searchProject(page, project)
  await page.getByRole("button", { name: new RegExp(project.replace(/[()]/g, "\\$&")) }).click()
  await expect(page.getByText("Budget d'heures dépassé de")).toBeVisible()
  await expect(page.getByRole("definition").filter({ hasText: /\d/ }).first()).toBeVisible()
  const milestones = page.getByRole("list", { name: "Jalons du projet" })
  await expect(milestones.getByRole("listitem").filter({ hasText: "Recette client" })).toContainText("En retard")

  await page.getByLabel("Titre du jalon").fill(`Livraison ${id}`)
  await page.getByLabel("Échéance du jalon").fill("2027-01-15")
  await page.getByRole("button", { name: "Ajouter le jalon" }).click()
  const added = milestones.getByRole("listitem").filter({ hasText: `Livraison ${id}` })
  await expect(added).toBeVisible()
  await added.getByRole("checkbox").click()
  await expect(added.getByRole("checkbox")).toBeChecked()
  await added.getByRole("button", { name: `Supprimer le jalon « Livraison ${id} »` }).click()
  await expect(added).toHaveCount(0)

  // Budget modifiable : l'alerte disparaît avec un budget suffisant, puis on remet 15 h.
  await page.getByRole("button", { name: "Modifier", exact: true }).click()
  await page.getByLabel("Budget d'heures (facultatif)").fill("500")
  await page.getByRole("button", { name: "Enregistrer" }).click()
  await expect(page.getByText("Budget d'heures dépassé de")).toHaveCount(0)
  await page.getByRole("button", { name: "Modifier", exact: true }).click()
  await page.getByLabel("Budget d'heures (facultatif)").fill("15")
  await page.getByRole("button", { name: "Enregistrer" }).click()
  await expect(page.getByText("Budget d'heures dépassé de")).toBeVisible()

  // Statistiques : charge de travail et tâches en dépassement.
  await goTo(page, "Statistiques")
  await expect(page.getByRole("table", { name: "Charge de travail par collaborateur" })).toContainText("Sam Leroy (démo)")
  await expect(page.getByRole("list", { name: "Tâches qui prennent plus de temps que prévu" })).toContainText("Calendrier des créneaux")
})
