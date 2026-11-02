import { expect, test } from "@playwright/test"
import { COLLABORATOR, dragTo, goTo, login, logout, OWNER, searchProject } from "./helpers"

test("accès protégé : sans session, redirection vers la connexion", async ({ page }) => {
  await page.goto("/?s=projects")
  await expect(page).toHaveURL(/\/login$/)
  await expect(page.getByText("Gérez vos projets, simplement.")).toBeVisible()
})

test("connexion : identifiants incorrects et affichage du mot de passe", async ({ page }) => {
  await page.goto("/login")
  await page.getByRole("button", { name: "Se connecter" }).click()
  await expect(page.getByText("Saisissez votre e-mail.")).toBeVisible()

  await page.getByLabel("E-mail").fill(OWNER.email)
  const password = page.getByLabel("Mot de passe", { exact: true })
  await password.fill("mauvais-mot-de-passe")
  await page.getByRole("button", { name: "Afficher le mot de passe" }).click()
  await expect(password).toHaveAttribute("type", "text")
  await page.getByRole("button", { name: "Se connecter" }).click()
  await expect(page.getByRole("alert").filter({ hasText: "incorrect" })).toHaveText("E-mail ou mot de passe incorrect.")
})

test("parcours complet du propriétaire", async ({ page }) => {
  const id = Date.now().toString(36)
  const clientName = `Client E2E ${id}`
  const projectName = `Projet E2E ${id}`

  await login(page, OWNER)

  // Création d'un client
  await goTo(page, "Clients")
  await page.getByRole("button", { name: "Nouveau client" }).click()
  const clientDialog = page.getByRole("dialog")
  await clientDialog.getByRole("button", { name: "Créer le client" }).click()
  await expect(clientDialog.getByText("Le nom est obligatoire.")).toBeVisible()
  await clientDialog.getByLabel("Nom", { exact: true }).fill(clientName)
  await clientDialog.getByLabel("E-mail (facultatif)").fill("contact@exemple.test")
  await clientDialog.getByRole("button", { name: "Créer le client" }).click()
  await expect(page.getByText(clientName)).toBeVisible()

  // Création d'un projet lié au client, avec le collaborateur comme membre
  await goTo(page, "Projets")
  await page.getByRole("button", { name: "Nouveau projet" }).click()
  const projectDialog = page.getByRole("dialog")
  await projectDialog.getByLabel("Nom du projet").fill(projectName)
  await projectDialog.getByLabel("Client (facultatif)").selectOption({ label: clientName })
  await projectDialog.getByLabel("Statut").selectOption("in_progress")
  // Échéance dépassée d'un an : le projet figure en tête de la vue d'ensemble (triée par échéance).
  await projectDialog.getByLabel("Échéance (facultatif)").fill(new Date(Date.now() - 365 * 86_400_000).toISOString().slice(0, 10))
  await projectDialog.getByLabel("Sam Leroy (démo)").check()
  await projectDialog.getByRole("button", { name: "Créer le projet" }).click()
  await page.getByRole("button", { name: new RegExp(projectName) }).click()
  await expect(page.getByRole("heading", { level: 2, name: projectName })).toBeVisible()
  await expect(page.getByText("Aucune tâche").first()).toBeVisible()

  // Ajout de deux tâches : l'une assignée au collaborateur, l'autre à soi par défaut
  for (const [title, assignee] of [
    ["Rédiger le cahier de recette", "Sam Leroy (démo)"],
    ["Préparer la mise en ligne", null],
  ] as const) {
    await page.getByRole("button", { name: "Nouvelle tâche" }).click()
    const taskDialog = page.getByRole("dialog")
    await taskDialog.getByLabel("Titre").fill(title)
    if (assignee) await taskDialog.getByLabel("Responsable").selectOption({ label: assignee })
    else await expect(taskDialog.getByLabel("Responsable")).toHaveValue(/.+/)
    await taskDialog.getByRole("button", { name: "Créer la tâche" }).click()
    await expect(taskDialog).toBeHidden()
  }
  await expect(page.getByText("0 tâche terminée sur 2")).toBeVisible()

  // Changement de statut par glisser-déposer
  const card = page.locator('[aria-roledescription="tâche déplaçable"]', { hasText: "Préparer la mise en ligne" })
  const doneColumn = page.getByRole("region", { name: /^Terminé/ })
  await dragTo(page, card, doneColumn)
  await expect(doneColumn.getByText("Préparer la mise en ligne")).toBeVisible()
  await expect(page.getByText("1 tâche terminée sur 2")).toBeVisible()

  // Changement de statut depuis le panneau de détail + checklist + blocage
  await page.getByRole("button", { name: "Rédiger le cahier de recette", exact: true }).click()
  const sheet = page.getByRole("dialog")
  await sheet.getByLabel("Statut").selectOption("in_progress")
  await sheet.getByLabel("Nouvel élément de checklist").fill("Lister les cas de test")
  await sheet.getByRole("button", { name: "Ajouter" }).first().click()
  await expect(sheet.getByText("Lister les cas de test")).toBeVisible()
  await sheet.getByRole("button", { name: "Marquer comme bloquée" }).click()
  await sheet.getByLabel("Qu'est-ce qui bloque ?").fill("En attente des retours client")
  await sheet.getByRole("button", { name: "Marquer bloquée" }).click()
  await expect(sheet.getByText("Tâche bloquée")).toBeVisible()
  await sheet.getByLabel("Nouveau commentaire").fill("Relance envoyée.")
  await sheet.getByRole("button", { name: "Commenter" }).click()
  await expect(sheet.getByText("Relance envoyée.")).toBeVisible()
  await page.keyboard.press("Escape")
  await expect(page.getByRole("region", { name: /^En cours/ }).getByText("Rédiger le cahier de recette")).toBeVisible()
  // Checklist cochée directement depuis la carte, sans ouvrir la tâche
  const recipeCard = page.locator('[aria-roledescription="tâche déplaçable"]', { hasText: "Rédiger le cahier de recette" })
  await expect(recipeCard).toContainText("Checklist :0/1")
  await recipeCard.getByRole("button", { name: /^Checklist 0 sur 1/ }).click()
  await recipeCard.getByRole("checkbox", { name: "Lister les cas de test" }).click()
  await expect(recipeCard).toContainText("Checklist :1/1")
  await expect(page.getByRole("dialog")).toHaveCount(0)

  // Chronomètre démarré puis mis en pause depuis la carte : l'intervenant et son temps restent affichés
  await recipeCard.getByRole("button", { name: "Démarrer le chrono sur « Rédiger le cahier de recette »" }).click()
  const people = recipeCard.getByRole("list", { name: "Temps passé par intervenant" })
  await expect(people.getByRole("listitem")).toHaveCount(1)
  await expect(people).toContainText("AM")
  await recipeCard.getByRole("button", { name: "Mettre en pause « Rédiger le cahier de recette »" }).click()
  await expect(recipeCard.getByRole("button", { name: /^Démarrer le chrono/ })).toBeVisible()
  await expect(people.getByRole("listitem")).toHaveCount(1)

  // Persistance après actualisation
  await page.reload()
  await expect(page.getByText("1 tâche terminée sur 2")).toBeVisible()

  // Vue d'ensemble : le projet actif et sa progression
  await goTo(page, "Vue d'ensemble")
  await expect(page.getByRole("button", { name: new RegExp(`${projectName}.*1 tâche terminée sur 2`) })).toBeVisible()

  // Clôture avec alerte sur les tâches ouvertes, puis archivage
  await page.getByRole("button", { name: new RegExp(projectName) }).click()
  await page.getByRole("button", { name: "Clôturer" }).click()
  await expect(page.getByRole("alertdialog")).toContainText("1 tâche est encore ouverte")
  await page.getByRole("button", { name: "Clôturer le projet" }).click()
  await expect(page.getByText("Terminé").first()).toBeVisible()
  await page.getByRole("button", { name: "Archiver" }).click()
  await expect(page.getByText("Archivé", { exact: true })).toBeVisible()
  await page.getByRole("button", { name: "Tous les projets" }).click()
  await expect(page.getByRole("button", { name: new RegExp(projectName) })).toHaveCount(0)
  await page.getByLabel("Filtrer par statut").selectOption("archived")
  await expect(page.getByRole("button", { name: new RegExp(projectName) })).toBeVisible()

  // Suppression d'une tâche avec confirmation (projet archivé, toujours consultable)
  await page.getByRole("button", { name: new RegExp(projectName) }).click()
  await page.getByRole("button", { name: "Préparer la mise en ligne", exact: true }).click()
  await page.getByRole("button", { name: "Supprimer la tâche" }).click()
  await page.getByRole("alertdialog").getByRole("button", { name: "Supprimer" }).click()
  await expect(page.getByText("0 tâche terminée sur 1")).toBeVisible()

  await logout(page)
  await page.goto("/")
  await expect(page).toHaveURL(/\/login$/)
})

test("permissions du collaborateur", async ({ page }) => {
  await login(page, COLLABORATOR)
  await goTo(page, "Projets")
  await searchProject(page, "Site e-commerce (démo)")
  await expect(page.getByRole("button", { name: /Site e-commerce \(démo\)/ })).toBeVisible()
  await searchProject(page, "Application mobile (démo)")
  await expect(page.getByRole("button", { name: /Application mobile \(démo\)/ })).toHaveCount(0)
  await expect(page.getByRole("button", { name: "Nouveau projet" })).toHaveCount(0)

  await goTo(page, "Clients")
  await expect(page.getByRole("button", { name: "Nouveau client" })).toHaveCount(0)

  // Mes tâches : uniquement celles qui lui sont attribuées
  await goTo(page, "Mes tâches")
  await expect(page.getByRole("button", { name: "Intégration du paiement", exact: true })).toBeVisible()
  await expect(page.getByRole("button", { name: "Atelier de cadrage", exact: true })).toHaveCount(0)
  await logout(page)
})
