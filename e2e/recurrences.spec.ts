import { expect, test, type Page } from "@playwright/test";
import { expectNoHorizontalScroll, loginOk } from "./helpers";
import { E2E } from "./fixtures";

test.describe.configure({ mode: "serial" });

async function newRecurring(page: Page, opts: { description: string; amount: string; category: string; count?: number; paid?: boolean }) {
  await page.goto("/lancamentos/novo");
  await page.getByLabel("Valor").fill(opts.amount);
  await page.getByLabel("Descrição").fill(opts.description);
  await page.getByText(opts.category, { exact: true }).first().click();
  if (!opts.paid) await page.getByRole("switch", { name: "Já foi pago" }).click();
  await page.getByRole("switch", { name: "Repetir" }).click();
  await page.getByRole("radio", { name: "Mensal" }).check();
  if (opts.count) {
    await page.getByRole("radio", { name: /Após/ }).check();
    await page.getByLabel("Número de ocorrências").fill(String(opts.count));
  }
  await expectNoHorizontalScroll(page);
  if (process.env.E2E_SHOTS) await page.screenshot({ path: `${process.env.E2E_SHOTS}/recorrencia-form-${opts.count ?? "sem"}.png`, fullPage: true });
  await page.getByRole("button", { name: "Salvar recorrência" }).click();
  await expect(page).toHaveURL(/salvo=recorrencia/);
}

test("criar, editar em escopo, excluir com prévia e encerrar recorrências", async ({ page }) => {
  await loginOk(page, E2E.rec.email, E2E.rec.password);

  // Sem término: hoje + 12 meses de calendário, inclusive = 13 ocorrências pendentes.
  await newRecurring(page, { description: "Aluguel", amount: "1.800,00", category: "Moradia" });
  await expect(page.getByText("Recorrência criada.")).toBeVisible();
  await expect(page.getByRole("link", { name: /Aluguel/ }).first()).toContainText("Recorrente · mensal");

  // Após 3 ocorrências, primeira já paga.
  await newRecurring(page, { description: "Curso de inglês", amount: "450,00", category: "Educação", count: 3, paid: true });
  await expect(page.getByRole("link", { name: /Curso de inglês/ }).first()).toContainText("Ocorrência 1 de 3");

  await page.goto("/mais/recorrencias");
  const aluguel = page.getByRole("article").filter({ hasText: "Aluguel" });
  await expect(aluguel).toContainText("Ativa");
  await expect(aluguel).toContainText("13 lançamentos");
  const curso = page.getByRole("article").filter({ hasText: "Curso de inglês" });
  await expect(curso).toContainText("2 lançamentos");
  await expectNoHorizontalScroll(page);
  if (process.env.E2E_SHOTS) await page.screenshot({ path: `${process.env.E2E_SHOTS}/recorrencias.png`, fullPage: true });

  // Editar a 2ª ocorrência do aluguel com "Este e os próximos".
  await aluguel.getByRole("link", { name: "Lançamentos" }).click();
  const rows = page.getByRole("link", { name: /Aluguel/ });
  await expect(rows).toHaveCount(13);
  // A lista é do mais recente para o mais antigo: a penúltima linha é a 2ª ocorrência.
  await rows.nth(11).click();
  await page.getByRole("link", { name: "Editar" }).click();
  await expect(page.getByText("Tipo e frequência não mudam")).toBeVisible();
  await page.getByRole("radio", { name: /Este e os próximos/ }).check();
  await page.getByLabel("Valor").fill("1.950,00");
  await page.getByRole("button", { name: "Salvar alterações" }).click();
  await expect(page).toHaveURL(/salvo=1/);
  await page.goBack();
  await page.goto(page.url().replace(/\/lancamentos\/[^?]+.*/, "/mais/recorrencias"));
  await expect(page.getByRole("article").filter({ hasText: "Aluguel" })).toContainText("R$ 1.950,00");

  // Excluir "este e os próximos" mostra a prévia do que será removido.
  await page.getByRole("article").filter({ hasText: "Curso de inglês" }).getByRole("link", { name: "Lançamentos" }).click();
  await page.getByRole("link", { name: /Ocorrência 3 de 3/ }).click();
  await page.getByRole("button", { name: "Excluir" }).click();
  const dialog = page.getByRole("alertdialog");
  await dialog.getByRole("radio", { name: /Este e os próximos/ }).check();
  await expect(dialog).toContainText("Serão removidos 1 lançamento(s) pendente(s), somando R$ 450,00.");
  await dialog.getByRole("button", { name: "Excluir" }).click();
  await expect(page).toHaveURL(/excluido=1/);

  await page.goto("/mais/recorrencias");
  const cursoEnded = page.getByRole("article").filter({ hasText: "Curso de inglês" });
  await expect(cursoEnded).toContainText("Encerrada");
  await expect(cursoEnded).toContainText("1 lançamento");

  // Encerrar o aluguel hoje.
  const aluguelCard = page.getByRole("article").filter({ hasText: "Aluguel" });
  await aluguelCard.getByRole("button", { name: "Encerrar" }).click();
  await expect(page.getByRole("alertdialog")).toContainText("Serão removidos 13 lançamento(s)");
  await page.getByRole("alertdialog").getByRole("button", { name: "Encerrar recorrência" }).click();
  await expect(page.getByRole("heading", { name: /Programação encerrada \(2\)/ })).toBeVisible();
  await expectNoHorizontalScroll(page);
});
