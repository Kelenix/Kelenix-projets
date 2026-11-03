import { expect, test } from "@playwright/test"
import { goTo, login, OWNER, searchProject } from "./helpers"

test("carte : actions directes sans ouvrir la tâche", async ({ page }) => {
  test.setTimeout(120_000)
  const title = "Rédiger les mentions légales"
  const id = Date.now().toString(36)
  await login(page, OWNER)
  await goTo(page, "Projets")
  await searchProject(page, "Site e-commerce (démo)")
  await page.getByRole("button", { name: /Site e-commerce \(démo\)/ }).click()

  // Priorité
  const priority = page.getByRole("button", { name: new RegExp(`^Priorité de « ${title} »`) })
  const originalPriority = (await priority.getAttribute("aria-label"))!.split(" : ")[1]!
  await priority.click()
  await page.getByRole("menuitemradio", { name: "Haute" }).click()
  await expect(priority).toHaveAccessibleName(`Priorité de « ${title} » : Haute`)

  // Statut
  const status = page.getByRole("button", { name: new RegExp(`^Statut de « ${title} »`) })
  const originalStatus = (await status.getAttribute("aria-label"))!.split(" : ")[1]!
  await status.click()
  await page.getByRole("menuitemradio", { name: "Reprogrammé" }).click()
  await expect(page.getByRole("region", { name: /^Reprogrammé/ }).getByRole("button", { name: title, exact: true })).toBeVisible()

  // Blocage avec explication, puis déblocage
  await page.getByRole("button", { name: `Autres actions sur « ${title} »` }).click()
  await page.getByRole("menuitem", { name: "Marquer comme bloquée" }).click()
  await page.getByRole("dialog", { name: "Marquer comme bloquée" }).getByLabel("Qu'est-ce qui bloque ?").fill(`Attente ${id}`)
  await page.getByRole("dialog").getByRole("button", { name: "Marquer bloquée" }).click()
  await expect(page.getByText(`Attente ${id}`)).toBeVisible()
  await page.getByRole("button", { name: `Autres actions sur « ${title} »` }).click()
  await page.getByRole("menuitem", { name: "Débloquer" }).click()
  await expect(page.getByText(`Attente ${id}`)).toHaveCount(0)

  // Checklist
  await page.getByRole("button", { name: `Autres actions sur « ${title} »` }).click()
  await page.getByRole("menuitem", { name: "Ajouter à la checklist" }).click()
  await page.getByLabel(`Nouvel élément de checklist pour « ${title} »`).fill(`Relire ${id}`)
  await page.getByLabel(`Nouvel élément de checklist pour « ${title} »`).press("Enter")
  await expect(page.getByRole("list", { name: `Checklist de « ${title} »` })).toContainText(`Relire ${id}`)

  // Affectation
  const assignees = page.getByRole("button", { name: `Collaborateurs affectés à « ${title} »` })
  await assignees.click()
  await page.getByRole("menuitemcheckbox", { name: /Sam Leroy/ }).click()
  await page.keyboard.press("Escape")
  await expect(assignees.getByRole("img", { name: /Sam Leroy/ })).toBeVisible()
  await assignees.click()
  await page.getByRole("menuitemcheckbox", { name: /Sam Leroy/ }).click()
  await page.keyboard.press("Escape")
  await expect(assignees.getByRole("img", { name: /Sam Leroy/ })).toHaveCount(0)

  // Remise dans l'état d'origine
  await priority.click()
  await page.getByRole("menuitemradio", { name: originalPriority }).click()
  await status.click()
  await page.getByRole("menuitemradio", { name: originalStatus }).click()
  await expect(status).toHaveAccessibleName(`Statut de « ${title} » : ${originalStatus}`)
})
