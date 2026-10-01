import { expect, test, type Page } from "@playwright/test";
import { expectNoHorizontalScroll, loginOk } from "./helpers";
import { E2E } from "./fixtures";

const shot = (page: Page, name: string) =>
  process.env.E2E_SHOTS ? page.screenshot({ path: `${process.env.E2E_SHOTS}/${name}.png`, fullPage: true }) : Promise.resolve();

async function launch(page: Page, o: { kind: "Receita" | "Despesa"; amount: string; description: string; category: string; account: string }) {
  await page.goto(o.kind === "Receita" ? "/lancamentos/novo?tipo=receita" : "/lancamentos/novo");
  await page.getByLabel("Valor").fill(o.amount);
  await page.getByLabel("Descrição").fill(o.description);
  await page.getByText(o.category, { exact: true }).first().click();
  await page.getByText(o.account, { exact: true }).click();
  await page.getByRole("button", { name: "Salvar lançamento" }).click();
  await expect(page).toHaveURL(/salvo=1/);
}

test("conta de benefício: cadastro, créditos separados, saldos e sem transferência", async ({ page }) => {
  await loginOk(page, E2E.ben.email, E2E.ben.password);

  await page.goto("/mais/contas/nova");
  await page.getByLabel("Tipo", { exact: true }).selectOption("BENEFIT");
  await page.getByLabel("Nome", { exact: true }).fill("Meu vale-alimentação");
  await page.getByLabel("Finalidade").selectOption("FOOD");
  await page.getByLabel("Saldo na data de abertura (R$)").fill("-10");
  await page.getByLabel("Data de abertura", { exact: true }).fill("2025-01-01");
  await page.getByRole("button", { name: "Cadastrar conta" }).click();
  await expect(page.getByText("O saldo de um benefício não pode ser negativo").first()).toBeVisible();
  await page.getByLabel("Saldo na data de abertura (R$)").fill("0");
  await expectNoHorizontalScroll(page);
  await page.getByRole("button", { name: "Cadastrar conta" }).click();
  await expect(page.getByRole("link", { name: /Meu vale-alimentação/ })).toContainText("Benefício · Alimentação");

  await launch(page, { kind: "Receita", amount: "5.000,00", description: "Salário", category: "Salários", account: "Corrente" });
  await launch(page, { kind: "Receita", amount: "800,00", description: "Crédito VA", category: "Outras receitas", account: "Meu vale-alimentação" });
  await launch(page, { kind: "Despesa", amount: "215,40", description: "Mercado no VA", category: "Alimentação", account: "Meu vale-alimentação" });

  await page.goto("/inicio");
  await expect(page.getByRole("region", { name: "Disponível para uso geral" })).toContainText("R$ 6.000,00");
  const benefits = page.getByRole("region", { name: "Em benefícios" });
  await expect(benefits).toContainText("R$ 584,60");
  await expect(benefits).toContainText("Total consolidado: R$ 6.584,60");
  await expect(benefits).toContainText("R$ 6.000,00 de uso geral + R$ 584,60 em benefícios");
  await expect(page.getByText("R$ 5.000,00 em dinheiro + R$ 800,00 em benefícios")).toBeVisible();
  await expectNoHorizontalScroll(page);
  await shot(page, "inicio-beneficios");

  await page.goto("/mais/contas");
  await expect(page.getByRole("region", { name: "Em benefícios" })).toContainText("R$ 584,60");
  await expectNoHorizontalScroll(page);

  // Transferência não oferece benefícios.
  await page.goto("/lancamentos/novo?tipo=transferencia");
  await expect(page.getByRole("group", { name: "De qual conta" })).not.toContainText("Meu vale-alimentação");
  await expect(page.getByText("benefícios não permitem transferência ou saque")).toBeVisible();

  await page.goto("/relatorios?aba=mensal");
  await expect(page.getByRole("columnheader", { name: "Benefícios" })).toBeVisible();
  await expectNoHorizontalScroll(page);
});
