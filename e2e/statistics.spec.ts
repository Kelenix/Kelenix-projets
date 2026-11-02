import { expect, test } from "@playwright/test"
import { goTo, login, OWNER, searchProject } from "./helpers"

test("statistiques : graphiques et tableau par membre, mis à jour en direct", async ({ page }) => {
  await login(page, OWNER)
  await goTo(page, "Statistiques")

  await expect(page.getByRole("region", { name: "Tâches terminées par semaine" })).toBeVisible()
  await expect(page.getByRole("group", { name: "Répartition des tâches par statut" })).toBeVisible()
  const table = page.getByRole("table")
  await expect(table.getByRole("rowheader", { name: /Alex Martin \(démo\)/ })).toBeVisible()
  await expect(table.getByRole("rowheader", { name: "Sam Leroy (démo)" })).toBeVisible()

  // Filtre par projet : le collaborateur n'a pas de tâche sur « Application mobile ».
  await page.getByLabel("Projet", { exact: true }).selectOption({ label: "Application mobile (démo)" })
  const samRow = table.getByRole("row", { name: /Sam Leroy/ })
  await expect(samRow.getByRole("cell").nth(1)).toHaveText("0")

  // Terminer une tâche met à jour les graphiques sans recharger.
  const tiles = page.getByText(/^Terminées \(8 sem\.\)$/).locator("..")
  const before = Number(await tiles.locator("p").nth(1).textContent())
  await goTo(page, "Projets")
  await searchProject(page, "Application mobile (démo)")
  await page.getByRole("button", { name: /Application mobile \(démo\)/ }).click()
  await page.getByRole("tab", { name: "Liste" }).click()
  const statusSelect = page.getByLabel("Statut de « Atelier de cadrage »")
  const original = await statusSelect.inputValue()
  test.skip(original === "done", "La tâche de démo est déjà terminée dans cette base.")
  await statusSelect.selectOption("done")
  await goTo(page, "Statistiques")
  await page.getByLabel("Projet", { exact: true }).selectOption({ label: "Application mobile (démo)" })
  await expect(tiles.locator("p").nth(1)).toHaveText(String(before + 1))

  // Remise dans l'état d'origine.
  await goTo(page, "Projets")
  await searchProject(page, "Application mobile (démo)")
  await page.getByRole("button", { name: /Application mobile \(démo\)/ }).click()
  await page.getByRole("tab", { name: "Liste" }).click()
  await page.getByLabel("Statut de « Atelier de cadrage »").selectOption(original)
})
