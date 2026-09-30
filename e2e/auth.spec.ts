import { expect, test } from "@playwright/test";
import { expectNoHorizontalScroll, login } from "./helpers";
import { E2E } from "./fixtures";

test("visitante anônimo é redirecionado para o login", async ({ page }) => {
  await page.goto("/inicio");
  await expect(page).toHaveURL(/\/login$/);
  await expectNoHorizontalScroll(page);
});

test("login com senha errada mostra mensagem genérica", async ({ page }) => {
  await login(page, E2E.ana.email, "senha-errada");
  await expect(page.getByRole("alert").filter({ hasText: "Email ou senha inválidos" })).toBeVisible();
});

test("login, navegação inferior e logout", async ({ page }) => {
  await login(page, E2E.ana.email, E2E.ana.password);
  await expect(page).toHaveURL(/\/inicio$/);

  const nav = page.getByRole("navigation", { name: "Navegação principal" });
  for (const label of ["Início", "Lançamentos", "Planejamento", "Relatórios", "Mais"]) {
    await expect(nav.getByRole("link", { name: label })).toBeVisible();
  }
  await expect(page.getByRole("link", { name: "Novo lançamento" })).toBeVisible();
  await expectNoHorizontalScroll(page);

  await nav.getByRole("link", { name: "Mais" }).click();
  await expect(nav.getByRole("link", { name: "Mais" })).toHaveAttribute("aria-current", "page");
  await expectNoHorizontalScroll(page);
  await page.getByRole("button", { name: "Sair" }).click();
  await expect(page).toHaveURL(/\/login$/);
  await page.goto("/inicio");
  await expect(page).toHaveURL(/\/login$/);
});

test("senha temporária exige troca antes de continuar", async ({ page }) => {
  await login(page, E2E.temp.email, E2E.temp.password);
  await expect(page).toHaveURL(/\/definir-senha$/);
  await page.goto("/lancamentos");
  await expect(page).toHaveURL(/\/definir-senha$/);

  await page.getByLabel("Senha temporária").fill(E2E.temp.password);
  await page.getByLabel("Nova senha", { exact: true }).fill("minha-nova-senha");
  await page.getByLabel("Confirme a nova senha").fill("minha-nova-senha");
  await page.getByRole("button", { name: "Definir senha e continuar" }).click();
  await expect(page).toHaveURL(/\/inicio$/);
  await page.goto("/lancamentos");
  await expect(page).toHaveURL(/\/lancamentos$/);
});
