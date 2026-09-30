// Fixture financeira conhecida, usada para reconciliar regras puras, serviços, relatórios e gráficos.
// Valores esperados calculados à mão em FIXTURE_EXPECTED.
import type { AccountOpening, Movement } from "./types";

export const FIXTURE_ACCOUNTS = [
  { key: "corrente", name: "Conta corrente", kind: "CHECKING", openingBalanceCents: 100_000, openingDate: "2026-01-01" },
  { key: "reserva", name: "Reserva", kind: "RESERVE", openingBalanceCents: 500_000, openingDate: "2026-01-01" },
  { key: "carteira", name: "Carteira", kind: "CASH", openingBalanceCents: 0, openingDate: "2026-03-01" },
] as const;

export const FIXTURE_CATEGORIES = [
  { key: "salarios", name: "Salários", kind: "INCOME", parent: null },
  { key: "alimentacao", name: "Alimentação", kind: "EXPENSE", parent: null },
  { key: "mercado", name: "Mercado", kind: "EXPENSE", parent: "alimentacao" },
  { key: "moradia", name: "Moradia", kind: "EXPENSE", parent: null },
  { key: "lazer", name: "Lazer", kind: "EXPENSE", parent: null },
] as const;

type Key<T extends readonly { key: string }[]> = T[number]["key"];

export type FixtureMovement = {
  description: string;
  kind: Movement["kind"];
  status: Movement["status"];
  amountCents: number;
  account: Key<typeof FIXTURE_ACCOUNTS>;
  toAccount?: Key<typeof FIXTURE_ACCOUNTS>;
  category?: Key<typeof FIXTURE_CATEGORIES>;
  dueDate: string;
  effectiveDate?: string;
};

export const FIXTURE_MOVEMENTS: FixtureMovement[] = [
  { description: "Salário fevereiro", kind: "INCOME", status: "EFFECTIVE", amountCents: 500_000, account: "corrente", category: "salarios", dueDate: "2026-02-05", effectiveDate: "2026-02-05" },
  { description: "Mercado fevereiro", kind: "EXPENSE", status: "EFFECTIVE", amountCents: 30_000, account: "corrente", category: "mercado", dueDate: "2026-02-10", effectiveDate: "2026-02-10" },
  { description: "Saque", kind: "TRANSFER", status: "EFFECTIVE", amountCents: 10_000, account: "corrente", toAccount: "carteira", dueDate: "2026-03-02", effectiveDate: "2026-03-02" },
  { description: "Padaria", kind: "EXPENSE", status: "EFFECTIVE", amountCents: 1_235, account: "carteira", category: "alimentacao", dueDate: "2026-03-03", effectiveDate: "2026-03-03" },
  { description: "Salário março", kind: "INCOME", status: "EFFECTIVE", amountCents: 500_000, account: "corrente", category: "salarios", dueDate: "2026-03-05", effectiveDate: "2026-03-05" },
  { description: "Aluguel", kind: "EXPENSE", status: "EFFECTIVE", amountCents: 180_000, account: "corrente", category: "moradia", dueDate: "2026-03-10", effectiveDate: "2026-03-10" },
  { description: "Restaurante", kind: "EXPENSE", status: "EFFECTIVE", amountCents: 15_000, account: "corrente", category: "alimentacao", dueDate: "2026-03-12", effectiveDate: "2026-03-12" },
  { description: "Mercado março", kind: "EXPENSE", status: "EFFECTIVE", amountCents: 42_050, account: "corrente", category: "mercado", dueDate: "2026-03-15", effectiveDate: "2026-03-15" },
  { description: "Guardar na reserva", kind: "TRANSFER", status: "EFFECTIVE", amountCents: 100_000, account: "corrente", toAccount: "reserva", dueDate: "2026-03-20", effectiveDate: "2026-03-20" },
  { description: "Freela", kind: "INCOME", status: "PENDING", amountCents: 70_000, account: "corrente", category: "salarios", dueDate: "2026-03-25" },
  { description: "Cinema", kind: "EXPENSE", status: "PENDING", amountCents: 8_000, account: "corrente", category: "lazer", dueDate: "2026-03-28" },
  { description: "Conta de luz", kind: "EXPENSE", status: "EFFECTIVE", amountCents: 21_030, account: "corrente", category: "moradia", dueDate: "2026-03-31", effectiveDate: "2026-04-02" },
];

export const FIXTURE_BUDGETS_2026_03 = [
  { category: "alimentacao", limitCents: 50_000 },
  { category: "moradia", limitCents: 200_000 },
  { category: "lazer", limitCents: 10_000 },
] as const;

export const FIXTURE_EXPECTED = {
  balances: { corrente: 701_920, reserva: 600_000, carteira: 8_765 },
  totalBalance: 1_310_685,
  totalBalanceAt_2026_02_28: 1_070_000,
  march: { incomeRealized: 500_000, expenseRealized: 238_285, result: 261_715, incomePending: 70_000, expensePending: 8_000 },
  february: { incomeRealized: 500_000, expenseRealized: 30_000, result: 470_000, incomePending: 0, expensePending: 0 },
  april: { incomeRealized: 0, expenseRealized: 21_030, result: -21_030, incomePending: 0, expensePending: 0 },
  budgetMarch: {
    alimentacao: { realizedCents: 58_285, pendingCents: 0, availableCents: -8_285, percent: 117, alert: "over" },
    moradia: { realizedCents: 180_000, pendingCents: 0, availableCents: 20_000, percent: 90, alert: "near" },
    lazer: { realizedCents: 0, pendingCents: 8_000, availableCents: 10_000, percent: 0, alert: "ok" },
  },
} as const;

/** Converte a fixture para as formas das regras puras usando as próprias chaves como ids. */
export function fixtureAsPure(): { accounts: AccountOpening[]; movements: Movement[]; parentOf: Map<string, string> } {
  const accounts = FIXTURE_ACCOUNTS.map((a) => ({ id: a.key, openingBalanceCents: a.openingBalanceCents, openingDate: a.openingDate }));
  const movements: Movement[] = FIXTURE_MOVEMENTS.map((m) => ({
    kind: m.kind,
    status: m.status,
    amountCents: m.amountCents,
    accountId: m.account,
    toAccountId: m.toAccount ?? null,
    categoryId: m.category ?? null,
    dueDate: m.dueDate,
    effectiveDate: m.effectiveDate ?? null,
  }));
  const parentOf = new Map<string, string>();
  for (const c of FIXTURE_CATEGORIES) if (c.parent) parentOf.set(c.key, c.parent);
  return { accounts, movements, parentOf };
}
