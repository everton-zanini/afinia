import { beforeEach, describe, expect, it } from "vitest";
import { auth, LOCKED_MESSAGE } from "@/lib/auth";
import { db } from "@/server/db";
import { createCredentialUser } from "@/server/credentials";
import { changePassword, updateEmail, updateName } from "@/server/services/profile";
import { runBootstrap } from "@/server/bootstrap";
import { resetDatabase } from "../../test/db";

async function signIn(email: string, password: string) {
  return auth.api.signInEmail({ body: { email, password }, asResponse: true });
}

beforeEach(async () => {
  await resetDatabase();
});

describe("login", () => {
  it("cria sessão com credenciais válidas e recusa inválidas com a mesma mensagem", async () => {
    await createCredentialUser({ name: "Ana", email: "ana@exemplo.com", password: "senha-correta-1" });

    const ok = await signIn("ana@exemplo.com", "senha-correta-1");
    expect(ok.status).toBe(200);
    expect(ok.headers.get("set-cookie")).toContain("HttpOnly");

    const wrong = await signIn("ana@exemplo.com", "errada-123");
    const unknown = await signIn("ninguem@exemplo.com", "errada-123");
    expect(wrong.status).toBe(401);
    expect(unknown.status).toBe(401);
    expect((await wrong.json()).message).toBe((await unknown.json()).message);
  });

  it("recusa cadastro público", async () => {
    const res = await auth.api.signUpEmail({
      body: { name: "Intruso", email: "intruso@exemplo.com", password: "qualquer-123" },
      asResponse: true,
    });
    expect(res.status).toBeGreaterThanOrEqual(400);
    expect(await db.user.count({ where: { email: "intruso@exemplo.com" } })).toBe(0);
  });

  it("bloqueia após 5 falhas, mesmo com a senha correta", async () => {
    await createCredentialUser({ name: "Ana", email: "ana@exemplo.com", password: "senha-correta-1" });
    for (let i = 0; i < 5; i++) {
      expect((await signIn("ana@exemplo.com", "errada-123")).status).toBe(401);
    }
    // Erros lançados no hook "before" chegam como exceção mesmo com asResponse.
    await expect(signIn("ANA@exemplo.com", "senha-correta-1")).rejects.toMatchObject({
      status: "TOO_MANY_REQUESTS",
      message: LOCKED_MESSAGE,
    });
    expect(await db.session.count()).toBe(0);
  });

  it("sucesso zera o contador de falhas", async () => {
    await createCredentialUser({ name: "Ana", email: "ana@exemplo.com", password: "senha-correta-1" });
    await signIn("ana@exemplo.com", "errada-123");
    await signIn("ana@exemplo.com", "errada-123");
    expect((await signIn("ana@exemplo.com", "senha-correta-1")).status).toBe(200);
    expect(await db.loginThrottle.count()).toBe(0);
  });
});

describe("perfil", () => {
  it("altera o nome", async () => {
    const u = await createCredentialUser({ name: "Ana", email: "ana@exemplo.com", password: "senha-correta-1" });
    await updateName(u.id, "  Ana Paula ");
    expect((await db.user.findUniqueOrThrow({ where: { id: u.id } })).name).toBe("Ana Paula");
  });

  it("recusa email já usado e senha atual incorreta", async () => {
    const ana = await createCredentialUser({ name: "Ana", email: "ana@exemplo.com", password: "senha-correta-1" });
    await createCredentialUser({ name: "Bia", email: "bia@exemplo.com", password: "senha-correta-2" });
    await expect(updateEmail(ana.id, "bia@exemplo.com", "senha-correta-1")).rejects.toThrow("já está em uso");
    await expect(updateEmail(ana.id, "nova@exemplo.com", "errada")).rejects.toThrow("Senha atual incorreta");
    await updateEmail(ana.id, "Nova@Exemplo.com", "senha-correta-1");
    expect((await db.user.findUniqueOrThrow({ where: { id: ana.id } })).email).toBe("nova@exemplo.com");
  });
});

describe("troca de senha", () => {
  it("revoga as outras sessões e mantém a atual", async () => {
    const u = await createCredentialUser({
      name: "Ana",
      email: "ana@exemplo.com",
      password: "senha-temporaria",
      mustChangePassword: true,
    });
    await signIn("ana@exemplo.com", "senha-temporaria");
    await signIn("ana@exemplo.com", "senha-temporaria");
    const [a, b] = await db.session.findMany({ where: { userId: u.id }, orderBy: { createdAt: "asc" } });

    await expect(
      changePassword({ userId: u.id, currentSessionId: a.id, currentPassword: "errada", newPassword: "nova-senha-1" }),
    ).rejects.toThrow("Senha atual incorreta");

    await changePassword({
      userId: u.id,
      currentSessionId: a.id,
      currentPassword: "senha-temporaria",
      newPassword: "nova-senha-1",
    });
    const remaining = await db.session.findMany({ where: { userId: u.id } });
    expect(remaining.map((s) => s.id)).toEqual([a.id]);
    expect(remaining.some((s) => s.id === b.id)).toBe(false);
    expect((await db.user.findUniqueOrThrow({ where: { id: u.id } })).mustChangePassword).toBe(false);
    expect((await signIn("ana@exemplo.com", "nova-senha-1")).status).toBe(200);
    expect((await signIn("ana@exemplo.com", "senha-temporaria")).status).toBe(401);
  });
});

describe("bootstrap", () => {
  const env = {
    BOOTSTRAP_ADMIN_EMAIL: "admin@exemplo.com",
    BOOTSTRAP_ADMIN_NAME: "Admin",
    BOOTSTRAP_ADMIN_PASSWORD: "senha-temporaria-forte",
  };

  it("falha sem senha e não cria nada", async () => {
    await expect(runBootstrap({ ...env, BOOTSTRAP_ADMIN_PASSWORD: "" })).rejects.toThrow("BOOTSTRAP_ADMIN_PASSWORD");
    await expect(runBootstrap({ ...env, BOOTSTRAP_ADMIN_PASSWORD: "curta" })).rejects.toThrow("12 caracteres");
    expect(await db.user.count()).toBe(0);
  });

  it("é idempotente e não sobrescreve a senha", async () => {
    const first = await runBootstrap(env);
    expect(first.created).toBe(true);
    const admin = await db.user.findUniqueOrThrow({ where: { email: "admin@exemplo.com" } });
    expect(admin.isPlatformAdmin).toBe(true);
    expect(admin.mustChangePassword).toBe(true);

    const second = await runBootstrap({ ...env, BOOTSTRAP_ADMIN_PASSWORD: "outra-senha-qualquer", BOOTSTRAP_ADMIN_NAME: "X" });
    expect(second).toEqual({ userId: admin.id, created: false });
    expect((await db.user.findUniqueOrThrow({ where: { id: admin.id } })).name).toBe("Admin");
    expect((await signIn("admin@exemplo.com", "senha-temporaria-forte")).status).toBe(200);
    expect((await signIn("admin@exemplo.com", "outra-senha-qualquer")).status).toBe(401);
  });
});
