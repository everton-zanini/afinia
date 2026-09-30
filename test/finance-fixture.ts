import { randomUUID } from "node:crypto";
import { db } from "@/server/db";
import type { HouseholdContext } from "@/server/households/context";
import { createAccount } from "@/server/finance/accounts";
import { createCategory } from "@/server/finance/categories";
import { createTransaction } from "@/server/finance/transactions";
import { setBudgetLimit } from "@/server/finance/budgets";
import { centsToInput } from "@/lib/money";
import {
  FIXTURE_ACCOUNTS,
  FIXTURE_BUDGETS_2026_03,
  FIXTURE_CATEGORIES,
  FIXTURE_MOVEMENTS,
} from "@/lib/finance/fixture";
import { transactionSchema } from "@/lib/validation/finance";

/** Grava a fixture conhecida no casal usando os serviços reais. Retorna chave → id. */
export async function loadFixture(ctx: HouseholdContext) {
  const accounts: Record<string, string> = {};
  for (const a of FIXTURE_ACCOUNTS) {
    const created = await createAccount(ctx, {
      name: a.name,
      kind: a.kind,
      openingBalance: a.openingBalanceCents,
      openingDate: a.openingDate,
    });
    accounts[a.key] = created.id;
  }

  const categories: Record<string, string> = {};
  for (const c of FIXTURE_CATEGORIES) {
    const parentId = c.parent ? categories[c.parent] : null;
    const existing = await db.category.findFirst({
      where: { householdId: ctx.householdId, name: c.name, kind: c.kind, parentId },
      select: { id: true },
    });
    categories[c.key] =
      existing?.id ??
      (await createCategory(ctx, { name: c.name, kind: c.kind, parentId, color: "#0e6b69", icon: "tag" })).id;
  }

  const transactions: string[] = [];
  for (const m of FIXTURE_MOVEMENTS) {
    const input = transactionSchema.parse({
      idempotencyKey: randomUUID(),
      kind: m.kind,
      description: m.description,
      amount: centsToInput(m.amountCents),
      categoryId: m.category ? categories[m.category] : "",
      accountId: accounts[m.account],
      toAccountId: m.toAccount ? accounts[m.toAccount] : "",
      status: m.status,
      dueDate: m.dueDate,
      effectiveDate: m.effectiveDate ?? "",
    });
    transactions.push((await createTransaction(ctx, input)).id);
  }

  for (const b of FIXTURE_BUDGETS_2026_03) {
    await setBudgetLimit(ctx, "2026-03", categories[b.category], b.limitCents);
  }
  return { accounts, categories, transactions };
}
