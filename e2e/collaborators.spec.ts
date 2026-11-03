import { expect, test } from "@playwright/test"
import { goTo, login, logout, OWNER, PROJECT_LEAD, searchProject } from "./helpers"

test("collaborateurs : affectation multiple, temps estimé, rôles et rapports selon les droits", async ({ page }) => {
  test.setTimeout(120_000)
  await login(page, OWNER)
  await goTo(page, "Projets")
  await searchProject(page, "Site e-commerce (démo)")
  await page.getByRole("button", { name: /Site e-commerce \(démo\)/ }).click()
  await page.getByRole("button", { name: "Intégration du paiement", exact: true }).click()

  // Plusieurs collaborateurs sur la même tâche, chacun avec son temps estimé.
  const sheet = page.getByRole("dialog")
  const assignees = sheet.getByRole("region", { name: "Collaborateurs affectés" })
  await expect(assignees.getByRole("table")).toContainText("Sam Leroy (démo)")
  await expect(assignees.getByRole("table")).toContainText("Nora Diallo (démo)")
  await assignees.getByLabel("Affecter un collaborateur").selectOption({ label: "Alex Martin (démo)" })
  const estimate = assignees.getByLabel("Temps estimé de Alex Martin (démo) (heures)")
  await estimate.fill("1,5")
  await estimate.press("Enter")
  await expect(page.getByText("Temps estimé enregistré.")).toBeVisible()
  await expect(estimate).toHaveValue("1,5")
  await assignees.getByRole("button", { name: "Désaffecter Alex Martin (démo)" }).click()
  await expect(assignees.getByLabel("Temps estimé de Alex Martin (démo) (heures)")).toHaveCount(0)
  await page.keyboard.press("Escape")

  // Rôles : administrateur, chef de projet par projet, accès aux rapports.
  await page.getByRole("button", { name: "Équipe et paramètres" }).first().click()
  const team = page.getByRole("dialog")
  await expect(team.getByRole("listitem").filter({ hasText: "demo.lead@kelenix.test" })).toContainText("Chef de projet (1 projet)")
  await team.getByRole("tab", { name: "Projets et rôles" }).click()
  await expect(team.getByLabel("Accès de Nora Diallo (démo) à Site e-commerce (démo)")).toHaveValue("manager")
  await page.keyboard.press("Escape")
  await logout(page)

  // Chef de projet sans accès aux rapports : ses chiffres, puis l'équipe de son projet.
  await login(page, PROJECT_LEAD)
  await goTo(page, "Statistiques")
  await expect(page.getByText("Vous voyez vos propres chiffres.")).toBeVisible()
  await expect(page.getByRole("heading", { name: "Votre activité en ce moment" })).toBeVisible()
  await page.getByLabel("Projet", { exact: true }).selectOption({ label: "Site e-commerce (démo)" })
  await expect(page.getByRole("heading", { name: "L'équipe en ce moment" })).toBeVisible()
  await expect(page.getByRole("list", { name: "Activité de chaque collaborateur" })).toContainText("Sam Leroy (démo)")
  await expect(page.getByRole("table", { name: "Temps estimé et temps réel par collaborateur" })).toContainText("Sam Leroy (démo)")
})
