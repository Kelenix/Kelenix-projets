import { defineConfig, devices } from "@playwright/test"

// Deux usages :
// - par défaut : parcours complets sur la base locale (`pnpm db:start`, comptes de supabase/seed.sql) ;
// - avec PLAYWRIGHT_BASE_URL : tests de fumée sur un environnement déployé (préproduction).
const deployedUrl = process.env.PLAYWRIGHT_BASE_URL
// Port dédié aux tests (3000 est souvent pris par d'autres projets en développement).
const PORT = 3100

export default defineConfig({
  testDir: "e2e",
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? "github" : "list",
  use: {
    baseURL: deployedUrl ?? `http://localhost:${PORT}`,
    locale: "fr-FR",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  projects: deployedUrl
    ? [{ name: "smoke", use: { ...devices["Desktop Chrome"] }, testMatch: /smoke\.spec\.ts/ }]
    : [
        { name: "desktop", use: { ...devices["Desktop Chrome"] }, testIgnore: /smoke\.spec\.ts/ },
        { name: "mobile", use: { ...devices["Pixel 7"] }, testMatch: /mobile\.spec\.ts/ },
      ],
  webServer: deployedUrl
    ? undefined
    : {
        command: process.env.CI ? `pnpm build && pnpm start -p ${PORT}` : `pnpm dev -p ${PORT}`,
        url: `http://localhost:${PORT}/login`,
        reuseExistingServer: !process.env.CI,
        timeout: 180_000,
      },
})
