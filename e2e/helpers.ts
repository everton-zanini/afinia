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
  const result = await page.evaluate(() => {
    const width = document.documentElement.clientWidth;
    const overflow = document.documentElement.scrollWidth - width;
    const offenders = overflow > 0
      ? [...document.querySelectorAll("body *")]
          .filter((el) => el.getBoundingClientRect().width > width - 32 + 1)
          .slice(-5)
          .map((el) => `${el.tagName.toLowerCase()}[${Math.round(el.getBoundingClientRect().width)}].${String(el.className).slice(0, 50)}`)
      : [];
    return { overflow, offenders };
  });
  expect(result.overflow, `página não deve ter rolagem horizontal: ${result.offenders.join(" | ")}`).toBeLessThanOrEqual(0);
}
