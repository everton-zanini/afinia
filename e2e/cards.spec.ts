import { expect, test, type Page } from "@playwright/test";
import { expectNoHorizontalScroll, loginOk } from "./helpers";
import { E2E } from "./fixtures";

test.describe.configure({ mode: "serial" });

const shot = (page: Page, name: string) =>
  process.env.E2E_SHOTS ? page.screenshot({ path: `${process.env.E2E_SHOTS}/${name}.png`, fullPage: true }) : Promise.resolve();

let cardUrl = "";

test("cartão: cadastro com validação de dados sensíveis e lista", async ({ page }) => {
  await loginOk(page, E2E.card.email, E2E.card.password);

  await page.goto("/cartoes");
  await expect(page.getByText("Nenhum cartão cadastrado")).toBeVisible();
  await expectNoHorizontalScroll(page);

  await page.goto("/mais");
  await page.getByRole("link", { name: /Cartões/ }).click();
  await expect(page).toHaveURL(/\/cartoes$/);

  await page.goto("/cartoes/novo");
  await page.getByLabel("Nome do cartão").fill("Cartão roxo");
  await page.getByLabel("Emissor (opcional)").fill("Banco X");
  await page.getByLabel("Últimos 4 dígitos (opcional)").fill("1234 5678 9012 3456");
  await page.getByLabel("Limite informado (R$)").fill("5.000,00");
  await page.getByLabel("Dia de fechamento").fill("5");
  await page.getByLabel("Dia de vencimento").fill("15");
  await expectNoHorizontalScroll(page);
  await shot(page, "cartao-form");
  await page.getByRole("button", { name: "Cadastrar cartão" }).click();
  await expect(page.getByText("Informe somente os 4 últimos dígitos").first()).toBeVisible();

  await page.getByLabel("Últimos 4 dígitos (opcional)").fill("1234");
  await page.getByRole("button", { name: "Cadastrar cartão" }).click();
  await expect(page).toHaveURL(/\/cartoes\/[^/?]+\?salvo=novo/);
  await expect(page.getByText("Cartão cadastrado.")).toBeVisible();
  cardUrl = new URL(page.url()).pathname;

  await page.goto("/cartoes");
  const item = page.getByRole("listitem").filter({ hasText: "Cartão roxo" });
  await expect(item).toContainText("final 1234");
  await expect(item).toContainText("Sem fatura");
  await expect(item.getByRole("meter")).toBeVisible();
  await expectNoHorizontalScroll(page);

  // Mudança de dias: a tela explica o efeito antes de salvar.
  await page.goto(`${cardUrl}/editar`);
  await expect(page.getByText(/vale só para faturas criadas depois/)).toBeVisible();
});

test("compra parcelada: prévia, arredondamento, parcela zero, limite e fatura", async ({ page }) => {
  await loginOk(page, E2E.card.email, E2E.card.password);
  await page.goto(`${cardUrl}/compra`);

  await page.getByLabel("Descrição").fill("Sofá");
  await page.getByLabel("Categoria").selectOption({ label: "Moradia" });
  await page.getByLabel("Valor total (R$)").fill("0,02");
  await page.getByLabel("Parcelas", { exact: true }).fill("3");
  await expect(page.getByText("O valor não permite essa quantidade de parcelas")).toBeVisible();

  await page.getByLabel("Valor total (R$)").fill("100,00");
  const preview = page.getByRole("list", { name: "Prévia das parcelas" });
  await expect(preview.getByRole("listitem")).toHaveCount(3);
  await expect(preview).toContainText("R$ 33,34");
  await expect(preview.getByRole("listitem").nth(2)).toContainText("R$ 33,33");
  await expect(page.getByText(/previsão manual e pode diferir da instituição/)).toBeVisible();
  await expectNoHorizontalScroll(page);
  await shot(page, "cartao-compra");
  await page.getByRole("button", { name: "Registrar compra" }).click();

  await expect(page).toHaveURL(/salvo=compra/);
  await expect(page.getByText("Compra registrada.")).toBeVisible();
  const compras = page.getByRole("region", { name: "Compras e parcelas" }).or(page.locator("section[aria-labelledby=compras]"));
  await expect(compras).toContainText("Sofá");
  await expect(compras).toContainText("parcela 1/3");
  await expect(compras).toContainText("R$ 33,34");
  await expect(page.getByRole("meter")).toBeVisible();
  await expect(page.getByText("Próximas faturas e parcelas futuras")).toBeVisible();
  await expect(page.getByRole("table", { name: "Compromissos por mês de vencimento" })).toBeVisible();
  await expectNoHorizontalScroll(page);
  await shot(page, "cartao-detalhe");

  // Estouro de limite apenas avisa e salva.
  await page.goto(`${cardUrl}/compra`);
  await page.getByLabel("Descrição").fill("Viagem");
  await page.getByLabel("Categoria").selectOption({ label: "Lazer" });
  await page.getByLabel("Valor total (R$)").fill("6.000,00");
  await expect(page.getByText(/acima do limite estimado/)).toBeVisible();
  await page.getByRole("button", { name: "Registrar compra" }).click();
  await expect(page).toHaveURL(/salvo=compra&acima=1/);
  await expect(page.getByText("Acima do limite estimado").first()).toBeVisible();
});

test("fatura: pagamento parcial, excedente recusado, desfazer e compra bloqueada", async ({ page }) => {
  await loginOk(page, E2E.card.email, E2E.card.password);
  await page.goto(cardUrl);

  await page.getByRole("button", { name: "Pagar fatura" }).click();
  const dialog = page.getByRole("dialog");
  await expect(dialog).toContainText("Juros, multas e encargos não estão incluídos");
  await dialog.getByLabel("Valor pago (R$)").fill("999.999,00");
  await dialog.getByRole("button", { name: "Registrar pagamento" }).click();
  await expect(dialog).toContainText("O valor excede o saldo devedor da fatura");

  await dialog.getByLabel("Valor pago (R$)").fill("20,00");
  await dialog.getByRole("button", { name: "Registrar pagamento" }).click();
  await expect(dialog).toBeHidden();
  await expect(page.getByText("Parcial").first()).toBeVisible();
  const pagamentos = page.locator("section[aria-labelledby=pagamentos]");
  await expect(pagamentos).toContainText("R$ 20,00");
  await expectNoHorizontalScroll(page);

  // A compra com fatura paga fica bloqueada para valores e exclusão.
  await page.locator("section[aria-labelledby=compras]").getByRole("link", { name: /Sofá/ }).click();
  await expect(page.getByText(/Há pagamento registrado em uma fatura desta compra/).first()).toBeVisible();
  await expect(page.getByRole("button", { name: "Excluir compra" })).toHaveCount(0);
  await expect(page.getByLabel("Valor total (R$)")).toHaveCount(0);
  await page.getByLabel("Categoria").selectOption({ label: "Lazer" });
  await page.getByRole("button", { name: "Salvar alterações" }).click();
  await expect(page.getByText("Alterações salvas.")).toBeVisible();

  // Pagamento aparece em Lançamentos sem ações comuns.
  await page.goto("/lancamentos");
  const row = page.getByRole("link", { name: /Pagamento de fatura/ }).first();
  await expect(row).toContainText("Cartão roxo");
  await row.click();
  await expect(page.getByRole("link", { name: "Editar" })).toHaveCount(0);
  await expect(page.getByRole("link", { name: "Duplicar" })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Excluir" })).toHaveCount(0);
  await page.getByRole("link", { name: "Ver fatura" }).click();
  await expect(page).toHaveURL(/\/cartoes\/[^/]+\?fatura=/);

  // Desfazer restaura o saldo devedor.
  await page.locator("section[aria-labelledby=pagamentos]").getByRole("button", { name: "Desfazer" }).click();
  await page.getByRole("alertdialog").getByRole("button", { name: "Desfazer" }).click();
  await expect(page.locator("section[aria-labelledby=pagamentos]")).toContainText("Nenhum pagamento registrado");
  await expect(page.getByText("Em aberto").first()).toBeVisible();
});

test("compra: editar recalculando parcelas, remanejar e excluir", async ({ page }) => {
  await loginOk(page, E2E.card.email, E2E.card.password);
  await page.goto(cardUrl);
  await page.locator("section[aria-labelledby=compras]").getByRole("link", { name: /Sofá/ }).click();

  await expect(page.getByText("Alterar valor, parcelas, data ou fatura recalcula todas as 3 parcelas.")).toBeVisible();
  await page.getByLabel("Valor total (R$)").fill("400,00");
  await page.locator("input[name=installmentCount]").fill("4");
  await page.getByRole("button", { name: "Salvar alterações" }).click();
  await expect(page.getByText("Alterações salvas.")).toBeVisible();
  const parcelas = page.locator("section[aria-labelledby=parcelas]");
  await expect(parcelas.getByRole("listitem")).toHaveCount(4);
  await expect(parcelas).toContainText("R$ 100,00");
  await expectNoHorizontalScroll(page);

  await parcelas.getByRole("button", { name: "Remanejar parcela 2/4" }).click();
  await page.getByRole("alertdialog").getByRole("button", { name: "Remanejar" }).click();
  await expect(page.getByText("Parcela remanejada.")).toBeVisible();

  await page.getByRole("button", { name: "Excluir compra" }).click();
  await expect(page.getByRole("alertdialog")).toContainText("todas as 4 parcelas");
  await page.getByRole("alertdialog").getByRole("button", { name: "Excluir" }).click();
  await expect(page).toHaveURL(/salvo=excluida/);
  await expect(page.locator("section[aria-labelledby=compras]")).not.toContainText("Sofá");
});

test("recorrência no cartão: previsão, confirmação e pular", async ({ page }) => {
  await loginOk(page, E2E.card.email, E2E.card.password);
  await page.goto("/lancamentos/novo");
  await page.getByLabel("Valor").fill("55,90");
  await page.getByLabel("Descrição").fill("Streaming");
  await page.getByLabel("Todas as categorias").selectOption({ label: "Assinaturas" });
  await page.getByRole("switch", { name: "Repetir" }).click();
  await page.locator("label").filter({ hasText: /^Cartão$/ }).click();
  await expect(page.getByText(/encerre esta recorrência antes e crie outra/)).toBeVisible();
  await page.getByRole("radio", { name: "Mensal" }).check();
  await expectNoHorizontalScroll(page);
  await shot(page, "recorrencia-cartao-form");
  await page.getByRole("button", { name: "Salvar recorrência" }).click();
  await expect(page).toHaveURL(/salvo=recorrencia/);

  await page.goto("/mais/recorrencias");
  await expect(page.getByRole("article").filter({ hasText: "Streaming" })).toContainText("Cartão roxo");

  await page.goto(cardUrl);
  const previstas = page.locator("section[aria-labelledby=previsoes]");
  await expect(previstas).toContainText("Streaming");
  await expect(previstas).toContainText("Previsto");
  await expect(previstas.getByRole("button", { name: /Marcar como pago/ })).toHaveCount(0);

  // Confirmar com valor revisado vira compra à vista, uma única vez.
  await previstas.getByRole("link", { name: /Confirmar cobrança Streaming/ }).first().click();
  await page.getByLabel("Valor (R$)").fill("59,90");
  await page.getByRole("button", { name: "Confirmar cobrança" }).click();
  await expect(page).toHaveURL(/salvo=confirmada/);
  await expect(page.locator("section[aria-labelledby=compras]")).toContainText("R$ 59,90");

  // Pular uma previsão.
  await page.goto(cardUrl);
  const next = page.locator("section[aria-labelledby=previsoes]");
  if (await next.count()) {
    await next.getByRole("button", { name: /Pular cobrança/ }).first().click();
    await page.getByRole("alertdialog").getByRole("button", { name: "Pular" }).click();
    await expect(page.getByText("Cobrança removida.")).toBeVisible();
  }
});

test("Início mostra dívidas de cartão sem tratar o limite como saldo", async ({ page }) => {
  await loginOk(page, E2E.card.email, E2E.card.password);
  await page.goto("/inicio");
  const cards = page.locator("section[aria-labelledby=cartoes]");
  await expect(cards).toContainText("Dívidas de cartão");
  await expect(cards).toContainText("Cartão roxo");
  await expect(cards).toContainText("O limite do cartão não é saldo nem dinheiro disponível");
  await expectNoHorizontalScroll(page);
  await shot(page, "inicio-cartoes");
});
