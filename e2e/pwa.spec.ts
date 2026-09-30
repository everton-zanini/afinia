import { expect, test } from "@playwright/test";
import { loginOk } from "./helpers";
import { E2E } from "./fixtures";

test("manifest instalável e service worker ativo", async ({ page, request }) => {
  const res = await request.get("/manifest.webmanifest");
  expect(res.ok()).toBe(true);
  const m = await res.json();
  expect(m).toMatchObject({ name: "Afinia", short_name: "Afinia", display: "standalone", start_url: "/inicio" });
  expect(m.icons.map((i: { sizes: string; purpose: string }) => `${i.sizes}:${i.purpose}`)).toEqual(
    expect.arrayContaining(["192x192:any", "512x512:any", "512x512:maskable"]),
  );
  for (const icon of m.icons) expect((await request.get(icon.src)).ok()).toBe(true);

  const sw = await request.get("/sw.js");
  expect(sw.headers()["cache-control"]).toContain("no-store");

  await page.goto("/login");
  await expect
    .poll(() => page.evaluate(async () => (await navigator.serviceWorker.ready).active?.state))
    .toBe("activated");
});

test("páginas autenticadas e APIs nunca entram no cache", async ({ page }) => {
  await loginOk(page, E2E.fixture.email, E2E.fixture.password);
  await page.evaluate(() => navigator.serviceWorker.ready);
  await page.reload(); // passa a ser controlada pelo service worker
  for (const path of ["/inicio", "/lancamentos?mes=2026-03", "/relatorios?mes=2026-03", "/mais/contas"]) {
    await page.goto(path);
  }
  const cached = await page.evaluate(async () => {
    const urls: string[] = [];
    for (const key of await caches.keys()) {
      for (const req of await (await caches.open(key)).keys()) urls.push(new URL(req.url).pathname);
    }
    return urls;
  });
  expect(cached.length).toBeGreaterThan(0);
  const forbidden = cached.filter(
    (p) => !(p.startsWith("/_next/static/") || p.startsWith("/icons/") || p === "/offline" || p === "/manifest.webmanifest"),
  );
  expect(forbidden, `entradas indevidas no cache: ${forbidden.join(", ")}`).toEqual([]);
});

test("sem conexão: página offline e nada é salvo", async ({ page, context }) => {
  await loginOk(page, E2E.fixture.email, E2E.fixture.password);
  await page.evaluate(() => navigator.serviceWorker.ready);
  await page.reload();

  await page.goto("/lancamentos/novo");
  await page.getByLabel("Valor").fill("12,34");
  await page.getByLabel("Descrição").fill("Tentativa offline");
  await context.setOffline(true);
  await expect(page.getByRole("status").filter({ hasText: "Sem conexão" }).first()).toBeVisible();
  await page.getByRole("button", { name: "Salvar lançamento" }).click();
  await expect(page.getByText("Sem conexão. O lançamento não foi salvo.").first()).toBeVisible();

  await page.goto("/lancamentos").catch(() => {});
  await expect(page.getByRole("heading", { name: "Você está sem conexão" })).toBeVisible();
  await expect(page.getByText("Casa Fixture")).toHaveCount(0);

  await context.setOffline(false);
  await page.goto("/lancamentos?q=Tentativa&mes=todos");
  await expect(page.getByText("Nenhum lançamento encontrado")).toBeVisible();
});

test("orientação de instalação", async ({ page }) => {
  await loginOk(page, E2E.fixture.email, E2E.fixture.password);
  await page.goto("/mais/instalar");
  await expect(page.getByRole("heading", { name: "iPhone e iPad (Safari)" })).toBeVisible();
  await expect(page.getByText("Adicionar à Tela de Início")).toBeVisible();
  await expect(page.getByRole("heading", { name: "Android (Chrome)" })).toBeVisible();
});
