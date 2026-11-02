import { expect, test } from "@playwright/test"
import { goTo, login, OWNER } from "./helpers"

test("barre latérale : se réduit, reste utilisable et mémorise son état", async ({ page }) => {
  await login(page, OWNER)
  const sidebar = page.locator("aside")
  await page.getByRole("button", { name: "Réduire la barre latérale" }).click()
  await expect(sidebar).toHaveCSS("width", "64px")

  await goTo(page, "Statistiques")
  await page.reload()
  await expect(page.getByRole("button", { name: "Ouvrir la barre latérale" })).toBeVisible()

  await page.getByRole("button", { name: "Ouvrir la barre latérale" }).click()
  await expect(sidebar).toHaveCSS("width", "240px")
})
