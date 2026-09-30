// Casal de demonstração com dados FICTÍCIOS — somente desenvolvimento/demonstração.
// Uso: DEMO_SEED=1 DEMO_PASSWORD=<senha> npm run seed:demo
// Recusa rodar em produção, sem DEMO_SEED=1 ou sem DEMO_PASSWORD. Idempotente.
import "dotenv/config";
import { randomUUID } from "node:crypto";
import { db } from "../src/server/db";
import { createCredentialUser } from "../src/server/credentials";
import { addMember } from "../src/server/households/members";
import { getHouseholdContext } from "../src/server/households/context";
import { onHouseholdCreated } from "../src/server/households/setup";
import { createAccount } from "../src/server/finance/accounts";
import { listCategories } from "../src/server/finance/categories";
import { createTransaction } from "../src/server/finance/transactions";
import { setBudgetLimit } from "../src/server/finance/budgets";
import { addDays, addMonths, currentMonth, todayISO } from "../src/lib/dates";
import { transactionSchema } from "../src/lib/validation/finance";
import { centsToInput } from "../src/lib/money";

const HOUSEHOLD = "Casal Demonstração";
const USERS = [
  { name: "Demo Um", email: "demo1@afinia.local" },
  { name: "Demo Dois", email: "demo2@afinia.local" },
];

export function assertDemoAllowed(env: Record<string, string | undefined>) {
  if (env.NODE_ENV === "production") throw new Error("Seed de demonstração não pode rodar em produção.");
  if (env.DEMO_SEED !== "1") throw new Error("Defina DEMO_SEED=1 para confirmar a criação de dados fictícios.");
  if (!env.DEMO_PASSWORD || env.DEMO_PASSWORD.length < 10) {
    throw new Error("Defina DEMO_PASSWORD (mínimo 10 caracteres) para os usuários de demonstração.");
  }
}

async function main() {
  assertDemoAllowed(process.env);
  if (await db.household.findFirst({ where: { name: HOUSEHOLD } })) {
    console.log("Casal de demonstração já existe; nada foi alterado.");
    return;
  }
  const taken = await db.user.findMany({ where: { email: { in: USERS.map((u) => u.email) } } });
  if (taken.length) throw new Error("Emails de demonstração já usados por outros usuários; nada foi alterado.");

  const users: Awaited<ReturnType<typeof createCredentialUser>>[] = [];
  for (const u of USERS) {
    users.push(await createCredentialUser({ ...u, password: process.env.DEMO_PASSWORD!, mustChangePassword: false }));
  }
  await db.$transaction(async (tx) => {
    const h = await tx.household.create({ data: { name: HOUSEHOLD } });
    await onHouseholdCreated(tx, h.id);
    for (const u of users) await addMember(tx, h.id, u.id);
  });
  const ctx = (await getHouseholdContext(users[0].id))!;

  const month = currentMonth();
  const start = `${addMonths(month, -3)}-01`;
  const corrente = await createAccount(ctx, { name: "Conta corrente", kind: "CHECKING", openingBalance: 250_000, openingDate: start });
  const reserva = await createAccount(ctx, { name: "Reserva", kind: "RESERVE", openingBalance: 800_000, openingDate: start });
  const cats = Object.fromEntries((await listCategories(ctx)).map((c) => [c.name, c.id]));

  const today = todayISO();
  const add = async (d: { description: string; kind: "INCOME" | "EXPENSE" | "TRANSFER"; cents: number; cat?: string; date: string; to?: string; pending?: boolean }) => {
    const effective = !d.pending && d.date <= today;
    await createTransaction(
      ctx,
      transactionSchema.parse({
        idempotencyKey: randomUUID(),
        kind: d.kind,
        description: d.description,
        amount: centsToInput(d.cents),
        categoryId: d.cat ? cats[d.cat] : "",
        accountId: corrente.id,
        toAccountId: d.to ?? "",
        status: effective ? "EFFECTIVE" : "PENDING",
        dueDate: d.date,
        effectiveDate: effective ? d.date : "",
      }),
    );
  };

  for (let i = 3; i >= 0; i--) {
    const m = addMonths(month, -i);
    await add({ description: "Salário", kind: "INCOME", cents: 620_000, cat: "Salários", date: `${m}-05` });
    await add({ description: "Aluguel", kind: "EXPENSE", cents: 210_000, cat: "Moradia", date: `${m}-10` });
    await add({ description: "Mercado", kind: "EXPENSE", cents: 68_000 + i * 3_150, cat: "Alimentação", date: `${m}-12` });
    await add({ description: "Combustível", kind: "EXPENSE", cents: 32_000, cat: "Transporte", date: `${m}-15` });
    await add({ description: "Streaming", kind: "EXPENSE", cents: 5_590, cat: "Assinaturas", date: `${m}-18` });
    await add({ description: "Guardar na reserva", kind: "TRANSFER", cents: 50_000, date: `${m}-20`, to: reserva.id });
  }
  await add({ description: "Conta de luz", kind: "EXPENSE", cents: 23_450, cat: "Moradia", date: addDays(today, 3), pending: true });
  await add({ description: "Consulta", kind: "EXPENSE", cents: 30_000, cat: "Saúde", date: addDays(today, -2), pending: true });

  await setBudgetLimit(ctx, month, cats["Alimentação"], 80_000);
  await setBudgetLimit(ctx, month, cats["Moradia"], 240_000);
  await setBudgetLimit(ctx, month, cats["Lazer"], 30_000);
  console.log(`Casal de demonstração criado: ${USERS.map((u) => u.email).join(", ")}`);
}

main()
  .catch((error) => {
    console.error(`Seed de demonstração não executado: ${error instanceof Error ? error.message : error}`);
    process.exitCode = 1;
  })
  .finally(() => db.$disconnect());
