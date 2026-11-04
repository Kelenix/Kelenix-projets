import { readFile } from "node:fs/promises"
import { expect, test } from "@playwright/test"
import { COLLABORATOR, goTo, login, logout, OWNER } from "./helpers"

const euros = (text: string) => new RegExp(text.replace(/ /g, "\\s?").replace(/,/g, ",") + "\\s€")

test("finances : revenu réparti, règle propre au mois, dépense, épargne, historique, export, accès réservé", async ({ page }) => {
  test.setTimeout(150_000)
  // Mois passé tiré au hasard : les opérations de ce test n'interfèrent avec aucune autre exécution.
  const year = 1990 + Math.floor(Math.random() * 30)
  const month = `${year}-${String(1 + Math.floor(Math.random() * 12)).padStart(2, "0")}`
  const id = Date.now().toString(36)

  await login(page, OWNER)
  await goTo(page, "Finances")
  await page.getByLabel("Choisir le mois").fill(month)
  await expect(page.getByText("Aucune donnée financière sur cette période")).toBeVisible()

  // Revenu : saisi librement, réparti automatiquement selon 25 / 15 / 50 / 10.
  await page.getByRole("tab", { name: "Revenus" }).click()
  await page.getByRole("button", { name: "Ajouter un revenu" }).click()
  const income = page.getByRole("dialog", { name: "Ajouter un revenu" })
  await income.getByLabel("Montant (€)").fill("1 400")
  await income.getByLabel("Source").fill(`Salaire ${id}`)
  await income.getByRole("button", { name: "Enregistrer" }).click()
  await expect(income).toBeHidden()
  await expect(page.getByRole("list", { name: "Revenus du mois" })).toContainText(`Salaire ${id}`)
  await expect(page.getByText(/Croissance \(25 %\)/).locator("..")).toContainText(euros("350,00"))

  // Règle propre au mois : total contrôlé à 100 %.
  await page.getByRole("tab", { name: "Répartition" }).click()
  await page.getByLabel("Pourcentage Croissance").fill("30")
  await expect(page.getByText("la somme doit être égale à 100 %")).toBeVisible()
  await expect(page.getByRole("button", { name: "Appliquer à ce mois uniquement" })).toBeDisabled()
  await page.getByLabel("Pourcentage Récompense").fill("5")
  await page.getByRole("button", { name: "Appliquer à ce mois uniquement" }).click()
  await expect(page.getByText("utilise une répartition qui lui est propre")).toBeVisible()

  // Dépense : budget restant mis à jour.
  await page.getByRole("tab", { name: "Dépenses" }).click()
  await page.getByRole("button", { name: "Ajouter une dépense" }).first().click()
  const expense = page.getByRole("dialog", { name: "Ajouter une dépense" })
  await expense.getByLabel("Montant (€)").fill("200")
  await expense.getByLabel("Date").fill(`${month}-10`)
  await expense.getByLabel("Description").fill(`Courses ${id}`)
  await expense.getByRole("button", { name: "Enregistrer" }).click()
  await expect(page.getByRole("list", { name: "Liste des dépenses" })).toContainText(`Courses ${id}`)
  await expect(page.getByText(/200,00\s€ \/ 700,00\s€/)).toBeVisible()

  // Fonds d'urgence : versement daté du mois.
  await page.getByRole("tab", { name: "Stabilité" }).click()
  await page.getByRole("button", { name: "Versement", exact: true }).click()
  const deposit = page.getByRole("dialog", { name: "Versement sur le fonds d'urgence" })
  await deposit.getByLabel("Montant (€)").fill("150")
  await deposit.getByLabel("Date").fill(`${month}-12`)
  await deposit.getByLabel("Note (facultatif)").fill(`Réserve ${id}`)
  await deposit.getByRole("button", { name: "Enregistrer" }).click()
  await expect(page.getByRole("list", { name: "Mouvements du fonds d'urgence" })).toContainText(`Réserve ${id}`)

  // Vue d'ensemble cohérente avec les opérations.
  await page.getByRole("tab", { name: "Vue d'ensemble" }).click()
  const overview = page.getByRole("tabpanel")
  await expect(overview.getByText("Revenus", { exact: true }).first().locator("..")).toContainText(euros("1 400,00"))
  await expect(overview.getByText("Dépenses", { exact: true }).first().locator("..")).toContainText(euros("200,00"))
  await expect(page.getByRole("region", { name: "Répartition du revenu" })).toContainText(euros("420,00"))

  // Historique : le mois est renseigné ; export CSV.
  await page.getByRole("tab", { name: "Historique et rapports" }).click()
  await page.getByRole("tabpanel").getByLabel("Année").selectOption(String(year))
  const history = page.getByRole("table", { name: `Historique financier ${year}` })
  await expect(history).toContainText(euros("1 400,00"))
  const [csv] = await Promise.all([page.waitForEvent("download"), page.getByRole("group", { name: "Exporter l'historique" }).getByRole("button", { name: "CSV" }).click()])
  const content = await readFile((await csv.path())!, "utf8")
  expect(content).toContain("Revenu (€)")
  expect(content).toContain("1400")
  await logout(page)

  // Espace réservé aux administrateurs.
  await login(page, COLLABORATOR)
  await expect(page.getByRole("navigation", { name: "Navigation principale" }).first().getByRole("button", { name: "Finances" })).toHaveCount(0)
})
