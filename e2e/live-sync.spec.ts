import { expect, test, type Page } from "@playwright/test"
import { COLLABORATOR, goTo, login, OWNER, searchProject } from "./helpers"

const title = "Intégration du paiement"

async function openProject(page: Page) {
  await goTo(page, "Projets")
  await searchProject(page, "Site e-commerce (démo)")
  await page.getByRole("button", { name: /Site e-commerce \(démo\)/ }).click()
}

test("synchronisation : un changement fait par un collaborateur apparaît chez les autres sans actualiser", async ({ browser }) => {
  test.setTimeout(120_000)
  const owner = await (await browser.newContext()).newPage()
  const collaborator = await (await browser.newContext()).newPage()
  await login(owner, OWNER)
  await login(collaborator, COLLABORATOR)
  await openProject(owner)
  await openProject(collaborator)

  const status = (page: Page) => page.getByRole("button", { name: new RegExp(`^Statut de « ${title} »`) })
  const original = (await status(collaborator).getAttribute("aria-label"))!.split(" : ")[1]!
  const target = original === "Terminé" ? "Reprogrammé" : "Terminé"

  // Le collaborateur déplace la tâche ; l'administrateur la voit changer de colonne, sans recharger.
  await status(collaborator).click()
  await collaborator.getByRole("menuitemradio", { name: target }).click()
  await expect(owner.getByRole("region", { name: new RegExp(`^${target}`) }).getByRole("button", { name: title, exact: true })).toBeVisible({ timeout: 15_000 })

  // Remise dans l'état d'origine, propagée de la même façon.
  await status(collaborator).click()
  await collaborator.getByRole("menuitemradio", { name: original }).click()
  await expect(owner.getByRole("region", { name: new RegExp(`^${original}`) }).getByRole("button", { name: title, exact: true })).toBeVisible({ timeout: 15_000 })
})
