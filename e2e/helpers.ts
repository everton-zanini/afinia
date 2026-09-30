import { expect, type Page } from "@playwright/test";

export async function login(page: Page, email: string, password: string) {
  await page.goto("/login");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Senha", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Entrar" }).click();
}

/** Login que aguarda sair da tela de login (sessão estabelecida). */
export async function loginOk(page: Page, email: string, password: string) {
  await login(page, email, password);
  await page.waitForURL((url) => !url.pathname.startsWith("/login"));
}

export async function expectNoHorizontalScroll(page: Page) {
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  expect(overflow, "página não deve ter rolagem horizontal").toBeLessThanOrEqual(0);
}
