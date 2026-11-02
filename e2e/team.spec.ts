import { expect, test } from "@playwright/test"
import { login, logout, OWNER } from "./helpers"

test("équipe : ajout d'un collaborateur, accès à un projet, puis retrait", async ({ page }) => {
  const id = Date.now().toString(36)
  const member = { name: `Membre ${id}`, email: `membre-${id}@kelenix.test`, password: `Provisoire-${id}` }

  await login(page, OWNER)
  await page.getByRole("button", { name: "Équipe et paramètres" }).first().click()
  const dialog = page.getByRole("dialog")
  await dialog.getByLabel("Nom complet").fill(member.name)
  await dialog.getByLabel("E-mail").fill(member.email)
  await dialog.getByLabel("Mot de passe provisoire").fill(member.password)
  await dialog.getByRole("button", { name: "Ajouter le membre" }).click()
  await expect(dialog.getByText(member.email)).toBeVisible()

  await dialog.getByRole("tab", { name: "Accès aux projets" }).click()
  const access = dialog.getByRole("group", { name: member.name })
  await access.getByRole("checkbox", { name: "Application mobile (démo)" }).click()
  await expect(access.getByLabel("Application mobile (démo)")).toBeChecked()
  await page.keyboard.press("Escape")
  await logout(page)

  // Le nouveau collaborateur ne voit que le projet autorisé.
  await login(page, member)
  await page.getByRole("navigation", { name: "Navigation principale" }).first().getByRole("button", { name: "Projets", exact: true }).click()
  await expect(page.getByRole("button", { name: /Application mobile \(démo\)/ })).toBeVisible()
  await expect(page.getByRole("button", { name: /Site e-commerce \(démo\)/ })).toHaveCount(0)
  await logout(page)

  await login(page, OWNER)
  await page.getByRole("button", { name: "Équipe et paramètres" }).first().click()
  await page.getByRole("dialog").getByRole("button", { name: `Retirer ${member.name}` }).click()
  await page.getByRole("alertdialog").getByRole("button", { name: "Retirer le membre" }).click()
  await expect(page.getByRole("dialog").getByText(member.email)).toHaveCount(0)
})
