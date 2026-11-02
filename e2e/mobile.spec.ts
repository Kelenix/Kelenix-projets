import { expect, test } from "@playwright/test"
import { login, OWNER, searchProject } from "./helpers"

test("mobile : navigation compacte et statut modifiable depuis le détail", async ({ page }) => {
  await login(page, OWNER)
  const nav = page.getByRole("navigation", { name: "Navigation principale" }).last()
  await expect(nav).toBeVisible()
  await page.screenshot({ path: "test-results/screens/mobile-overview.png", fullPage: true })

  await nav.getByRole("button", { name: "Projets" }).click()
  await expect(page.getByRole("heading", { level: 1, name: "Projets", exact: true })).toBeVisible()
  await searchProject(page, "Site e-commerce (démo)")
  await page.getByRole("button", { name: /Site e-commerce \(démo\)/ }).click()
  await page.getByRole("tab", { name: "Liste" }).click()
  await page.screenshot({ path: "test-results/screens/mobile-project.png", fullPage: true })

  await page.getByRole("button", { name: "Atelier de cadrage" }).or(page.getByRole("button", { name: "Rédiger les mentions légales" })).first().click()
  const sheet = page.getByRole("dialog")
  const status = sheet.getByLabel("Statut")
  const original = await status.inputValue()
  const next = original === "in_progress" ? "todo" : "in_progress"
  await status.selectOption(next)
  await expect(status).toHaveValue(next)
  await page.screenshot({ path: "test-results/screens/mobile-task.png" })
  await status.selectOption(original)
  await expect(status).toHaveValue(original)
})
