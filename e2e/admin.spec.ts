import { expect, test } from "@playwright/test";
import { expectNoHorizontalScroll, login, loginOk } from "./helpers";
import { E2E } from "./fixtures";

test("membro comum não acessa a administração", async ({ page }) => {
  await login(page, E2E.ana.email, E2E.ana.password);
  await expect(page).toHaveURL(/\/inicio$/);
  const res = await page.goto("/admin");
  expect(res?.status()).toBe(404);
  await page.goto("/mais");
  await expect(page.getByRole("link", { name: /Administração/ })).toHaveCount(0);
});

test("administrador sem casal cadastra um casal e o novo participante troca a senha", async ({ page, browser }) => {
  await login(page, E2E.admin.email, E2E.admin.password);
  await expect(page).toHaveURL(/\/sem-casal$/);
  await page.getByRole("link", { name: "Ir para a administração" }).click();
  await expect(page.getByRole("heading", { name: "Casais" })).toBeVisible();
  await expectNoHorizontalScroll(page);

  await page.getByRole("link", { name: "Novo casal" }).click();
  await page.getByLabel("Nome do casal").fill("Casal E2E");
  const p1 = page.getByRole("group", { name: "Participante 1" });
  await p1.getByLabel("Nome").fill("Carla E2E");
  await p1.getByLabel("Email").fill("carla@e2e.test");
  await p1.getByLabel("Senha temporária").fill("temporaria-carla");
  await expectNoHorizontalScroll(page);
  await page.getByRole("button", { name: "Cadastrar casal" }).click();

  await expect(page.getByRole("heading", { name: "Casal E2E" })).toBeVisible();
  await expect(page.getByText("Aguardando troca da senha temporária")).toBeVisible();

  const ctx = await browser.newContext({ viewport: { width: 360, height: 780 } });
  const carla = await ctx.newPage();
  await login(carla, "carla@e2e.test", "temporaria-carla");
  await expect(carla).toHaveURL(/\/definir-senha$/);
  await ctx.close();
});

test("validação do cadastro preserva os campos preenchidos", async ({ page }) => {
  await loginOk(page, E2E.admin.email, E2E.admin.password);
  await page.goto("/admin/casais/novo");
  await page.getByLabel("Nome do casal").fill("Casal Incompleto");
  const p1 = page.getByRole("group", { name: "Participante 1" });
  await p1.getByLabel("Nome").fill("Fulano");
  await p1.getByLabel("Email").fill("fulano@e2e.test");
  await p1.getByLabel("Senha temporária").fill("curta");
  await page.getByRole("button", { name: "Cadastrar casal" }).click();
  await expect(page.getByText("pelo menos 10 caracteres")).toBeVisible();
  await expect(page.getByLabel("Nome do casal")).toHaveValue("Casal Incompleto");
});
