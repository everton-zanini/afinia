import { test } from "@playwright/test";
import { expectNoHorizontalScroll, loginOk } from "./helpers";
import { E2E } from "./fixtures";

const PAGES = [
  "/inicio",
  "/lancamentos?mes=2026-03",
  "/lancamentos?mes=2026-03&visao=calendario",
  "/lancamentos/novo",
  "/planejamento?mes=2026-03",
  "/relatorios?mes=2026-03",
  "/relatorios?mes=2026-03&aba=mensal",
  "/relatorios?mes=2026-03&aba=saldo",
  "/mais",
  "/mais/categorias",
  "/mais/contas",
  "/mais/instalar",
];

for (const [label, width, height] of [
  ["360px", 360, 780],
  ["430px", 430, 932],
  ["tablet", 820, 1180],
  ["desktop", 1366, 900],
] as const) {
  test(`sem rolagem horizontal (${label})`, async ({ page }) => {
    await page.setViewportSize({ width, height });
    await loginOk(page, E2E.fixture.email, E2E.fixture.password);
    for (const path of PAGES) {
      await page.goto(path);
      await expectNoHorizontalScroll(page);
    }
  });
}
