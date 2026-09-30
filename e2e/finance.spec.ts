import { expect, test, type Page } from "@playwright/test";
import { readFile } from "node:fs/promises";
import { expectNoHorizontalScroll, loginOk } from "./helpers";
import { E2E } from "./fixtures";

const shot = (page: Page, name: string) =>
  process.env.E2E_SHOTS ? page.screenshot({ path: `${process.env.E2E_SHOTS}/${name}.png`, fullPage: true }) : Promise.resolve();

test.describe.configure({ mode: "serial" });

test("fluxo financeiro do casal no celular", async ({ page, browser }) => {
  await loginOk(page, E2E.ana.email, E2E.ana.password);

  // Contas
  await page.goto("/mais/contas");
  await expect(page.getByText("Nenhuma conta cadastrada")).toBeVisible();
  await shot(page, "contas-vazio");
  await page.getByRole("link", { name: "Cadastrar conta" }).click();
  await page.getByLabel("Nome", { exact: true }).fill("Conta corrente");
  await page.getByLabel("Saldo na data de abertura (R$)").fill("1.000,00");
  await page.getByLabel("Data de abertura", { exact: true }).fill("2026-01-01");
  await expectNoHorizontalScroll(page);
  await page.getByRole("button", { name: "Cadastrar conta" }).click();
  await expect(page.getByRole("link", { name: /Conta corrente/ })).toBeVisible();

  await page.goto("/mais/contas/nova");
  await page.getByLabel("Nome", { exact: true }).fill("Reserva");
  await page.getByLabel("Tipo", { exact: true }).selectOption("RESERVE");
  await page.getByLabel("Data de abertura", { exact: true }).fill("2026-01-01");
  await page.getByRole("button", { name: "Cadastrar conta" }).click();
  await expect(page.getByRole("link", { name: /Reserva/ })).toBeVisible();

  // Despesa paga, com duplo toque no salvar
  await page.goto("/lancamentos/novo");
  await page.getByLabel("Valor").fill("45,90");
  await page.getByLabel("Descrição").fill("Mercado da semana");
  await page.getByText("Alimentação", { exact: true }).first().click();
  await page.getByText("Conta corrente", { exact: true }).click();
  await expectNoHorizontalScroll(page);
  await shot(page, "novo-lancamento");
  await page.getByRole("button", { name: "Salvar lançamento" }).dblclick();
  await expect(page).toHaveURL(/\/lancamentos\?salvo=1$/);
  await expect(page.getByRole("link", { name: /Mercado da semana/ })).toHaveCount(1);
  await expectNoHorizontalScroll(page);

  // Transferência não altera receitas/despesas
  await page.goto("/lancamentos/novo?tipo=transferencia");
  await page.getByLabel("Valor").fill("100");
  await page.getByLabel("Descrição").fill("Guardar");
  await page.getByRole("group", { name: "De qual conta" }).getByText("Conta corrente").click();
  await page.getByRole("group", { name: "Para qual conta" }).getByText("Reserva").click();
  await page.getByRole("button", { name: "Salvar lançamento" }).click();
  await expect(page).toHaveURL(/\/lancamentos\?salvo=1$/);
  const summary = page.getByRole("region", { name: "Resumo do período" });
  await expect(summary).toContainText("R$ 0,00");
  await expect(summary).toContainText("R$ 45,90");
  await shot(page, "lista-lancamentos");

  await page.goto("/mais/contas");
  await expect(page.getByRole("link", { name: /Conta corrente/ })).toContainText("R$ 854,10");
  await expect(page.getByRole("link", { name: /Reserva/ })).toContainText("R$ 100,00");

  // Despesa pendente: não altera saldo, depois marcada como paga
  await page.goto("/lancamentos/novo");
  await page.getByLabel("Valor").fill("200,00");
  await page.getByLabel("Descrição").fill("Conta de luz");
  await page.getByText("Moradia", { exact: true }).first().click();
  await page.getByRole("switch", { name: "Já foi pago" }).click();
  await page.getByRole("button", { name: "Salvar lançamento" }).click();
  await expect(page).toHaveURL(/salvo=1/);
  await page.goto("/mais/contas");
  await expect(page.getByRole("link", { name: /Conta corrente/ })).toContainText("R$ 854,10");
  await expect(page.getByRole("link", { name: /Conta corrente/ })).toContainText("Previsto: R$ 654,10");

  await page.goto("/lancamentos?situacao=pendente");
  await page.getByRole("link", { name: /Conta de luz/ }).click();
  await shot(page, "detalhe-pendente");
  await page.getByRole("button", { name: "Marcar como pago" }).click();
  await expect(page.getByText("Pago", { exact: true })).toBeVisible();
  await page.goto("/mais/contas");
  await expect(page.getByRole("link", { name: /Conta corrente/ })).toContainText("R$ 654,10");

  // O outro membro vê os mesmos dados e a autoria
  const betoCtx = await browser.newContext({ viewport: { width: 360, height: 780 } });
  const beto = await betoCtx.newPage();
  await loginOk(beto, E2E.beto.email, E2E.beto.password);
  await beto.goto("/lancamentos");
  await beto.getByRole("link", { name: /Mercado da semana/ }).click();
  await expect(beto.getByText("Ana Teste")).toBeVisible();
  await betoCtx.close();

  // Orçamento
  await page.goto("/planejamento");
  const alimentacao = page.getByRole("listitem").filter({ hasText: "Alimentação" }).first();
  await alimentacao.getByRole("button", { name: "Definir limite" }).click();
  await page.getByLabel("Limite de Alimentação (R$)").fill("500,00");
  await page.getByRole("button", { name: "Salvar", exact: true }).click();
  const row = page.getByRole("list").first().getByRole("listitem").filter({ hasText: "Alimentação" });
  await expect(row).toContainText("9%");
  await expect(row).toContainText("Dentro do limite");
  await expectNoHorizontalScroll(page);
  await shot(page, "planejamento");

  // Exportação CSV do filtro
  await page.goto("/lancamentos?q=Mercado");
  const download = page.waitForEvent("download");
  await page.getByRole("link", { name: "Exportar CSV dos resultados filtrados" }).click();
  const csv = await readFile((await (await download).path())!, "utf8");
  expect(csv).toContain("Mercado da semana");
  expect(csv).not.toContain("Guardar");

  // Categorias: subcategoria e arquivamento
  await page.goto("/mais/categorias/nova");
  await page.getByLabel("Nome", { exact: true }).fill("Feira");
  await page.getByLabel("Categoria principal").selectOption({ label: "Alimentação" });
  await page.getByRole("button", { name: "Criar categoria" }).click();
  await expect(page.getByRole("link", { name: /Feira/ })).toBeVisible();
  await expectNoHorizontalScroll(page);
  await shot(page, "categorias");

  // Exclusão com confirmação
  await page.goto("/lancamentos?q=Guardar");
  await page.getByRole("link", { name: /Guardar/ }).click();
  await page.getByRole("button", { name: "Excluir" }).click();
  await page.getByRole("alertdialog").getByRole("button", { name: "Excluir" }).click();
  await expect(page).toHaveURL(/excluido=1/);
  await page.goto("/mais/contas");
  await expect(page.getByRole("link", { name: /Reserva/ })).toContainText("R$ 0,00");
});
