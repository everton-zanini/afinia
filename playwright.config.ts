import { defineConfig, devices } from "@playwright/test";

// Rodar via `npm run e2e`, que aponta DATABASE_URL para o banco _test.
const PORT = Number(process.env.E2E_PORT ?? 3100);
const baseURL = `http://localhost:${PORT}`;

export default defineConfig({
  testDir: "e2e",
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: [["list"]],
  globalSetup: "./e2e/global-setup.ts",
  use: {
    baseURL,
    locale: "pt-BR",
    timezoneId: "America/Sao_Paulo",
    trace: "retain-on-failure",
  },
  projects: [
    { name: "mobile-360", use: { ...devices["Pixel 5"], viewport: { width: 360, height: 780 } } },
  ],
  webServer: {
    command: process.env.E2E_SERVER === "start" ? `npx next start -p ${PORT}` : `npx next dev -p ${PORT}`,
    url: `${baseURL}/login`,
    reuseExistingServer: false,
    timeout: 180_000,
    env: { BETTER_AUTH_URL: baseURL, NEXT_TELEMETRY_DISABLED: "1" },
  },
});
