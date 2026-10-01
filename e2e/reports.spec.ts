import { expect, test, type Page } from "@playwright/test";
import { expectNoHorizontalScroll, loginOk } from "./helpers";
import { E2E } from "./fixtures";

// Valores esperados = FIXTURE_EXPECTED (src/lib/finance/fixture.ts), exibidos pela interface.
const shot = (page: Page, name: string) =>
  process.env.E2E_SHOTS
    ? page.waitForTimeout(1500).then(() => page.screenshot({ path: `${process.env.E2E_SHOTS}/${name}.png`, fullPage: true }))
    : Promise.resolve();

test.beforeEach(async ({ page }) => {
  await loginOk(page, E2E.fixture.email, E2E.fixture.password);
});

test("início mostra o saldo total reconciliado com a fixture", async ({ page }) => {
  await page.goto("/inicio");
  // Sem benefícios, o disponível para uso geral é o saldo total da fixture.
  await expect(page.getByRole("region", { name: "Disponível para uso geral" })).toContainText("R$ 13.106,85");
  await expect(page.getByRole("region", { name: "Em benefícios" })).toHaveCount(0);
  await expectNoHorizontalScroll(page);
  await shot(page, "inicio");
});

test("relatórios de março batem com a fixture", async ({ page }) => {
  await page.goto("/relatorios?mes=2026-03");
  const list = page.getByRole("list", { name: "Valores por categoria" });
  await expect(list).toContainText("Moradia");
  await expect(list).toContainText("R$ 1.800,00");
  await expect(list).toContainText("76% das despesas");
  await expect(list).toContainText("R$ 582,85");
  await expect(list).toContainText("24% das despesas");
  await expect(list).toContainText("R$ 2.382,85");
  await expect(page.getByRole("img", { name: /Gráfico de rosca/ })).toBeVisible();
  await expectNoHorizontalScroll(page);
  await shot(page, "relatorio-categorias");

  await page.getByRole("link", { name: "Entradas × saídas" }).click();
  const march = page.getByRole("row", { name: /mar\/26/ });
  await expect(march).toContainText("R$ 5.000,00");
  await expect(march).toContainText("R$ 2.382,85");
  await expect(march).toContainText("R$ 2.617,15");
  await expectNoHorizontalScroll(page);
  await shot(page, "relatorio-mensal");

  await page.getByRole("link", { name: "Saldo" }).click();
  await expect(page.getByText("R$ 10.700,00")).toBeVisible();
  await expect(page.getByText("R$ 13.317,15").first()).toBeVisible();
  await expectNoHorizontalScroll(page);
  await shot(page, "relatorio-saldo");

  await page.getByRole("link", { name: "Categorias" }).click();
  await expect(page).toHaveURL(/aba=categorias/);
  await page.getByLabel("Conta").selectOption({ label: "Carteira" });
  await expect(page).toHaveURL(/conta=/);
  await expect(page.getByRole("list", { name: "Valores por categoria" })).toContainText("R$ 12,35");
  await expect(page.getByRole("list", { name: "Valores por categoria" })).not.toContainText("Moradia");
});

test("legenda abre os lançamentos da categoria e o calendário mostra pendências", async ({ page }) => {
  await page.goto("/relatorios?mes=2026-03");
  await page.getByRole("link", { name: /Alimentação/ }).click();
  await expect(page).toHaveURL(/categoria=/);
  for (const d of ["Padaria", "Restaurante", "Mercado março"]) {
    await expect(page.getByRole("link", { name: new RegExp(d) })).toBeVisible();
  }
  await expect(page.getByRole("link", { name: /Aluguel/ })).toHaveCount(0);

  await page.goto("/lancamentos?mes=2026-03&visao=calendario");
  const day28 = page.getByRole("link", { name: /^28, .*pendente/ });
  await expect(day28).toBeVisible();
  await expectNoHorizontalScroll(page);
  await shot(page, "calendario");
  await day28.click();
  await expect(page.getByRole("link", { name: /Cinema/ })).toBeVisible();
});
