import { z } from "zod";
import { isISODate, isISOMonth } from "@/lib/dates";
import { MAX_AMOUNT_CENTS, parseBRL } from "@/lib/money";
import { CATEGORY_COLORS, CATEGORY_ICONS } from "@/lib/category-style";

const id = z.string().trim().min(1).max(64);
const optionalId = z
  .string()
  .trim()
  .max(64)
  .optional()
  .transform((v) => (v ? v : null));

export const isoDate = z.string().refine(isISODate, "Informe uma data válida");
export const isoMonth = z.string().refine(isISOMonth, "Mês inválido");

/** Valor digitado ("1.234,56") → centavos positivos dentro do limite. */
export const amountField = z
  .string({ error: "Informe o valor" })
  .transform((v, ctx) => {
    const cents = parseBRL(v);
    if (cents === null) {
      ctx.addIssue({ code: "custom", message: "Valor inválido. Use o formato 1.234,56" });
      return z.NEVER;
    }
    return cents;
  })
  .pipe(
    z
      .number()
      .int()
      .positive("Informe um valor maior que zero")
      .max(MAX_AMOUNT_CENTS, "O valor máximo é R$ 10.000.000,00"),
  );

/** Saldo inicial: aceita zero e negativo. */
export const signedAmountField = z.string().transform((v, ctx) => {
  const cents = v.trim() === "" ? 0 : parseBRL(v);
  if (cents === null || Math.abs(cents) > MAX_AMOUNT_CENTS) {
    ctx.addIssue({ code: "custom", message: "Valor inválido. Use o formato 1.234,56" });
    return z.NEVER;
  }
  return cents;
});

export const categorySchema = z.object({
  name: z.string().trim().min(1, "Informe o nome").max(40, "Use até 40 caracteres"),
  kind: z.enum(["INCOME", "EXPENSE"], { error: "Escolha receita ou despesa" }),
  parentId: optionalId,
  color: z.enum(CATEGORY_COLORS, { error: "Escolha uma cor" }),
  icon: z.enum(CATEGORY_ICONS, { error: "Escolha um ícone" }),
});
export type CategoryInput = z.infer<typeof categorySchema>;

export const accountSchema = z.object({
  name: z.string().trim().min(1, "Informe o nome").max(40, "Use até 40 caracteres"),
  kind: z.enum(["CHECKING", "CASH", "RESERVE"], { error: "Escolha o tipo" }),
  openingBalance: signedAmountField,
  openingDate: isoDate,
});
export type AccountInput = z.infer<typeof accountSchema>;

export const transactionSchema = z
  .object({
    idempotencyKey: z.string().trim().min(8).max(64),
    kind: z.enum(["INCOME", "EXPENSE", "TRANSFER"]),
    description: z.string().trim().min(1, "Informe uma descrição").max(120, "Use até 120 caracteres"),
    amount: amountField,
    categoryId: optionalId,
    accountId: id,
    toAccountId: optionalId,
    status: z.enum(["PENDING", "EFFECTIVE"]),
    dueDate: isoDate,
    effectiveDate: z
      .string()
      .optional()
      .transform((v) => (v ? v : null))
      .refine((v) => v === null || isISODate(v), "Informe uma data válida"),
    responsibleMemberId: optionalId,
    notes: z
      .string()
      .trim()
      .max(500, "Use até 500 caracteres")
      .optional()
      .transform((v) => (v ? v : null)),
  })
  .superRefine((d, ctx) => {
    if (d.kind === "TRANSFER") {
      if (!d.toAccountId) ctx.addIssue({ code: "custom", path: ["toAccountId"], message: "Escolha a conta de destino" });
      else if (d.toAccountId === d.accountId)
        ctx.addIssue({ code: "custom", path: ["toAccountId"], message: "Escolha contas diferentes" });
    } else if (!d.categoryId) {
      ctx.addIssue({ code: "custom", path: ["categoryId"], message: "Escolha uma categoria" });
    }
    if (d.status === "EFFECTIVE" && !d.effectiveDate) {
      ctx.addIssue({ code: "custom", path: ["effectiveDate"], message: "Informe a data de pagamento" });
    }
  })
  .transform((d) => ({
    ...d,
    categoryId: d.kind === "TRANSFER" ? null : d.categoryId,
    toAccountId: d.kind === "TRANSFER" ? d.toAccountId : null,
    effectiveDate: d.status === "EFFECTIVE" ? d.effectiveDate : null,
  }));
export type TransactionInput = z.infer<typeof transactionSchema>;

export const transactionFiltersSchema = z.object({
  from: isoDate.optional().catch(undefined),
  to: isoDate.optional().catch(undefined),
  q: z.string().trim().max(80).optional().catch(undefined),
  categoryId: z.string().max(64).optional().catch(undefined),
  accountId: z.string().max(64).optional().catch(undefined),
  status: z.enum(["PENDING", "EFFECTIVE"]).optional().catch(undefined),
  kind: z.enum(["INCOME", "EXPENSE", "TRANSFER"]).optional().catch(undefined),
  memberId: z.string().max(64).optional().catch(undefined),
});
export type TransactionFilters = z.infer<typeof transactionFiltersSchema>;

export const budgetLimitSchema = z.object({
  month: isoMonth,
  categoryId: id,
  limit: z.string().transform((v, ctx) => {
    if (v.trim() === "") return null;
    const cents = parseBRL(v);
    if (cents === null || cents <= 0 || cents > MAX_AMOUNT_CENTS) {
      ctx.addIssue({ code: "custom", message: "Informe um limite maior que zero" });
      return z.NEVER;
    }
    return cents;
  }),
});
