import { readFile } from "node:fs/promises"
import { expect, test, type Page } from "@playwright/test"
import { COLLABORATOR, goTo, login, logout, OWNER } from "./helpers"

async function download(page: Page, label: string) {
  const [file] = await Promise.all([
    page.waitForEvent("download"),
    page.getByRole("group", { name: "Exporter le rapport" }).getByRole("button", { name: label }).click(),
  ])
  return file
}

test("rapports : types, filtres et exports Excel, CSV, PDF selon les droits", async ({ page }) => {
  test.setTimeout(120_000)
  await login(page, OWNER)
  await goTo(page, "Rapports")
  const filters = page.getByRole("region", { name: "Filtres du rapport" })
  await filters.getByLabel("Période").selectOption({ label: "Cette année" })

  // Heures travaillées : quotidien, hebdomadaire, mensuel
  await expect(page.getByRole("table", { name: "Heures travaillées — quotidien" })).toBeVisible()
  await filters.getByLabel("Découpage").selectOption({ label: "Mensuel" })
  await expect(page.getByRole("table", { name: "Heures travaillées — mensuel" })).toContainText("Total")

  // Par projet, par tâche, par collaborateur, pauses, estimé / réel
  await filters.getByLabel("Rapport").selectOption({ label: "Temps par projet" })
  await expect(page.getByRole("table", { name: "Temps par projet" })).toContainText("Refonte site vitrine (démo)")
  await filters.getByLabel("Rapport").selectOption({ label: "Temps par tâche" })
  await expect(page.getByRole("table", { name: "Temps par tâche" })).toContainText("Intégration de la page d'accueil")
  await filters.getByLabel("Rapport").selectOption({ label: "Pauses par collaborateur" })
  await expect(page.getByRole("table", { name: "Pauses par collaborateur" })).toContainText("Repas")
  await filters.getByLabel("Rapport").selectOption({ label: "Heures estimées / réelles" })
  await expect(page.getByRole("table", { name: "Heures estimées / réelles" })).toContainText("Calendrier des créneaux")

  // Filtres projet, collaborateur et statut
  await filters.getByLabel("Rapport").selectOption({ label: "Temps par collaborateur" })
  await filters.getByLabel("Projet").selectOption({ label: "Refonte site vitrine (démo)" })
  await filters.getByLabel("Collaborateur").selectOption({ label: "Sam Leroy (démo)" })
  const people = page.getByRole("table", { name: "Temps par collaborateur" })
  await expect(people.getByRole("rowheader")).toHaveText(["Sam Leroy (démo)"])
  await filters.getByLabel("Statut de la tâche").selectOption({ label: "En cours" })
  await expect(page.getByText("Statut : En cours")).toBeVisible()

  // Exports
  const csv = await download(page, "CSV")
  expect(csv.suggestedFilename()).toMatch(/^kelenix-rapport-people-.*\.csv$/)
  const content = await readFile((await csv.path())!, "utf8")
  expect(content).toContain("Collaborateur;Jours travaillés")
  expect(content).toContain("Sam Leroy (démo)")
  const xlsx = await download(page, "Excel")
  expect(xlsx.suggestedFilename()).toMatch(/\.xlsx$/)
  expect((await readFile((await xlsx.path())!)).subarray(0, 2).toString()).toBe("PK") // classeur Office (zip)
  const pdf = await download(page, "PDF")
  expect(pdf.suggestedFilename()).toMatch(/\.pdf$/)
  expect((await readFile((await pdf.path())!)).subarray(0, 5).toString()).toBe("%PDF-")
  await logout(page)

  // Collaborateur sans accès aux rapports d'équipe : uniquement ses propres chiffres.
  await login(page, COLLABORATOR)
  await goTo(page, "Rapports")
  await expect(page.getByText("Vous voyez vos propres chiffres.")).toBeVisible()
  await expect(page.getByRole("region", { name: "Filtres du rapport" }).getByLabel("Collaborateur")).toBeDisabled()
})
