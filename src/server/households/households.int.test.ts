import { beforeEach, describe, expect, it } from "vitest";
import { auth } from "@/lib/auth";
import { db } from "@/server/db";
import { ACCESS_DISABLED_MESSAGE } from "@/server/login-policy";
import { addMember } from "@/server/households/members";
import { getHouseholdContext } from "@/server/households/context";
import { runBootstrap } from "@/server/bootstrap";
import * as admin from "@/server/services/admin";
import { resetDatabase } from "../../../test/db";
import { createHouseholdWith, createUser } from "../../../test/factories";

const signIn = (email: string, password: string) =>
  auth.api.signInEmail({ body: { email, password }, asResponse: true });

async function expectAccessDisabled(res: Promise<Response>) {
  const r = await res;
  expect(r.status).toBe(403);
  expect((await r.json()).message).toBe(ACCESS_DISABLED_MESSAGE);
}

beforeEach(async () => {
  await resetDatabase();
});

describe("vínculo de membros", () => {
  it("recusa terceiro membro ativo", async () => {
    const { household } = await createHouseholdWith("Casal A");
    const third = await createUser();
    await expect(db.$transaction((tx) => addMember(tx, household.id, third.id))).rejects.toThrow(
      "Este casal já tem dois participantes",
    );
    expect(await db.householdMember.count({ where: { householdId: household.id } })).toBe(2);
  });

  it("recusa usuário já vinculado a outro casal", async () => {
    const { users } = await createHouseholdWith("Casal A");
    const { household: b } = await createHouseholdWith("Casal B", [await createUser()]);
    await expect(db.$transaction((tx) => addMember(tx, b.id, users[0].id))).rejects.toThrow("já participa");
  });

  it("inclusões simultâneas não ultrapassam o limite", async () => {
    const { household } = await createHouseholdWith("Casal A", [await createUser()]);
    const [x, y] = [await createUser(), await createUser()];
    const results = await Promise.allSettled([
      db.$transaction((tx) => addMember(tx, household.id, x.id)),
      db.$transaction((tx) => addMember(tx, household.id, y.id)),
    ]);
    expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
    expect(await db.householdMember.count({ where: { householdId: household.id, active: true } })).toBe(2);
  });
});

describe("contexto do casal", () => {
  it("os dois membros recebem o mesmo casal; casal ou vínculo inativo não gera contexto", async () => {
    const { household, users, contexts } = await createHouseholdWith("Casal A");
    expect(contexts[0].householdId).toBe(household.id);
    expect(contexts[1].householdId).toBe(household.id);
    expect(contexts[0].members.map((m) => m.userId).sort()).toEqual(users.map((u) => u.id).sort());

    await db.householdMember.update({ where: { userId: users[1].id }, data: { active: false } });
    expect(await getHouseholdContext(users[1].id)).toBeNull();

    await db.household.update({ where: { id: household.id }, data: { active: false } });
    expect(await getHouseholdContext(users[0].id)).toBeNull();
  });

  it("usuário sem casal não tem contexto", async () => {
    const u = await createUser();
    expect(await getHouseholdContext(u.id)).toBeNull();
  });
});

describe("política de login", () => {
  it("recusa usuário sem casal e aceita administrador sem casal", async () => {
    await createUser({ email: "solto@teste.dev", password: "senha-de-teste-1" });
    await expectAccessDisabled(signIn("solto@teste.dev", "senha-de-teste-1"));
    await createUser({ email: "adm@teste.dev", password: "senha-de-teste-1", isPlatformAdmin: true });
    expect((await signIn("adm@teste.dev", "senha-de-teste-1")).status).toBe(200);
  });
});

describe("administração", () => {
  it("cria casal com dois participantes que precisam trocar a senha", async () => {
    const adm = await createUser({ isPlatformAdmin: true });
    const h = await admin.createHousehold(adm.id, {
      name: "Casal Teste",
      includeMe: false,
      participants: [
        { name: "Carla", email: "carla@teste.dev", password: "temporaria-123" },
        { name: "Davi", email: "davi@teste.dev", password: "temporaria-456" },
      ],
    });
    const members = await db.householdMember.findMany({ where: { householdId: h.id }, include: { user: true } });
    expect(members).toHaveLength(2);
    expect(members.every((m) => m.user.mustChangePassword)).toBe(true);
    expect((await signIn("carla@teste.dev", "temporaria-123")).status).toBe(200);
  });

  it("é atômico: email duplicado não cria nada", async () => {
    const adm = await createUser({ isPlatformAdmin: true });
    await createUser({ email: "carla@teste.dev" });
    await expect(
      admin.createHousehold(adm.id, {
        name: "Casal Teste",
        includeMe: false,
        participants: [
          { name: "Nova", email: "nova@teste.dev", password: "temporaria-123" },
          { name: "Carla", email: "carla@teste.dev", password: "temporaria-456" },
        ],
      }),
    ).rejects.toThrow("carla@teste.dev");
    expect(await db.household.count()).toBe(0);
    expect(await db.user.count({ where: { email: "nova@teste.dev" } })).toBe(0);
  });

  it("administrador participa do próprio casal e adiciona a segunda pessoa", async () => {
    const adm = await createUser({ isPlatformAdmin: true });
    const h = await admin.createHousehold(adm.id, { name: "Casa", includeMe: true, participants: [] });
    await admin.addParticipant(h.id, { name: "Bia", email: "bia@teste.dev", password: "temporaria-123" });
    const admCtx = await getHouseholdContext(adm.id);
    const bia = await db.user.findUniqueOrThrow({ where: { email: "bia@teste.dev" } });
    expect((await getHouseholdContext(bia.id))?.householdId).toBe(admCtx?.householdId);
    await expect(
      admin.addParticipant(h.id, { name: "Terceiro", email: "t@teste.dev", password: "temporaria-123" }),
    ).rejects.toThrow("dois participantes");
    expect(await db.user.count({ where: { email: "t@teste.dev" } })).toBe(0);
  });

  it("desativar revoga sessões e bloqueia login; reativar libera", async () => {
    const carla = await createUser({ email: "carla@teste.dev", password: "senha-de-teste-1" });
    const { household } = await createHouseholdWith("Casal Teste", [carla]);
    await signIn("carla@teste.dev", "senha-de-teste-1");
    expect(await db.session.count({ where: { userId: carla.id } })).toBe(1);

    await admin.setHouseholdActive(household.id, false);
    expect(await db.session.count({ where: { userId: carla.id } })).toBe(0);
    await expectAccessDisabled(signIn("carla@teste.dev", "senha-de-teste-1"));
    expect(await db.household.count()).toBe(1);

    await admin.setHouseholdActive(household.id, true);
    expect((await signIn("carla@teste.dev", "senha-de-teste-1")).status).toBe(200);
  });

  it("redefinir senha temporária revoga sessões e exige troca", async () => {
    const davi = await createUser({ email: "davi@teste.dev", password: "senha-antiga-1" });
    const { household } = await createHouseholdWith("Casal Teste", [davi]);
    await signIn("davi@teste.dev", "senha-antiga-1");
    await admin.resetParticipantPassword(household.id, davi.id, "temporaria-nova");
    expect(await db.session.count({ where: { userId: davi.id } })).toBe(0);
    expect((await db.user.findUniqueOrThrow({ where: { id: davi.id } })).mustChangePassword).toBe(true);
    expect((await signIn("davi@teste.dev", "senha-antiga-1")).status).toBe(401);
    expect((await signIn("davi@teste.dev", "temporaria-nova")).status).toBe(200);
  });

  it("redefinir senha exige que a pessoa seja do casal informado", async () => {
    const { household: a } = await createHouseholdWith("A");
    const { users: bUsers } = await createHouseholdWith("B");
    await expect(admin.resetParticipantPassword(a.id, bUsers[0].id, "temporaria-nova")).rejects.toThrow(
      "não encontrado",
    );
  });

  it("listagem administrativa não expõe dados além dos de gestão", async () => {
    await createHouseholdWith("Casal A");
    const [h] = await admin.listHouseholds();
    expect(Object.keys(h).sort()).toEqual(["active", "createdAt", "id", "members", "name"]);
    expect(Object.keys(h.members[0].user).sort()).toEqual(
      ["email", "id", "isPlatformAdmin", "mustChangePassword", "name"].sort(),
    );
  });
});

describe("bootstrap com casal", () => {
  it("cria um único casal com o administrador, mesmo executado duas vezes", async () => {
    const env = {
      BOOTSTRAP_ADMIN_EMAIL: "admin@teste.dev",
      BOOTSTRAP_ADMIN_NAME: "Admin",
      BOOTSTRAP_ADMIN_PASSWORD: "senha-temporaria-forte",
      BOOTSTRAP_HOUSEHOLD_NAME: "Casa Silva",
    };
    expect((await runBootstrap(env)).householdCreated).toBe(true);
    expect((await runBootstrap(env)).householdCreated).toBe(false);
    const households = await db.household.findMany({ include: { members: true } });
    expect(households).toHaveLength(1);
    expect(households[0].name).toBe("Casa Silva");
    expect(households[0].members).toHaveLength(1);
  });
});
