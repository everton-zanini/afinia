import { z } from "zod";
import { CATEGORY_COLORS } from "@/lib/category-style";
import { MAX_INSTALLMENTS } from "@/lib/finance/cards";
import { amountField, isoDate } from "./finance";

const optionalId = z
  .string()
  .trim()
  .max(64)
  .optional()
  .transform((v) => (v ? v : null));

const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max, `Use até ${max} caracteres`)
    .optional()
    .transform((v) => (v ? v : null));

const dayField = (label: string) =>
  z
    .string({ error: `Informe o dia de ${label}` })
    .trim()
    .regex(/^\d{1,2}$/, `Informe o dia de ${label} (1 a 31)`)
    .transform(Number)
    .pipe(z.number().int().min(1, `Informe o dia de ${label} (1 a 31)`).max(31, `Informe o dia de ${label} (1 a 31)`));

/** Nunca aceita número completo, CVV ou senha: somente os 4 últimos dígitos. */
export const cardSchema = z.object({
  name: z.string().trim().min(1, "Informe o nome do cartão").max(40, "Use até 40 caracteres"),
  issuer: optionalText(40),
  lastFour: z
    .string()
    .trim()
    .optional()
    .transform((v) => (v ? v : null))
    .refine((v) => v === null || /^\d{4}$/.test(v), "Informe somente os 4 últimos dígitos"),
  color: z.enum(CATEGORY_COLORS, { error: "Escolha uma cor" }),
  limit: amountField,
  closingDay: dayField("fechamento"),
  dueDay: dayField("vencimento"),
  holderMemberId: z.string().trim().min(1, "Escolha o titular").max(64),
  paymentAccountId: optionalId,
});
export type CardInput = z.infer<typeof cardSchema>;

const installmentCount = z
  .string()
  .optional()
  .transform((v) => (v && v.trim() ? Number(v) : 1))
  .pipe(
    z
      .number()
      .int("Informe a quantidade de parcelas")
      .min(1, "Informe de 1 a 48 parcelas")
      .max(MAX_INSTALLMENTS, `Informe de 1 a ${MAX_INSTALLMENTS} parcelas`),
  );

export const purchaseSchema = z.object({
  idempotencyKey: z.string().trim().min(8).max(64),
  cardId: z.string().trim().min(1).max(64),
  description: z.string().trim().min(1, "Informe uma descrição").max(120, "Use até 120 caracteres"),
  total: amountField,
  purchaseDate: isoDate,
  categoryId: z.string().trim().min(1, "Escolha uma categoria").max(64),
  responsibleMemberId: optionalId,
  notes: optionalText(500),
  installmentCount,
  /** Fatura inicial escolhida; vazio = fatura sugerida pela data. */
  invoiceId: optionalId,
});
export type PurchaseInput = z.infer<typeof purchaseSchema>;

export const invoicePaymentSchema = z.object({
  idempotencyKey: z.string().trim().min(8).max(64),
  invoiceId: z.string().trim().min(1).max(64),
  accountId: z.string().trim().min(1, "Escolha a conta de origem").max(64),
  date: isoDate,
  amount: amountField,
});
export type InvoicePaymentInput = z.infer<typeof invoicePaymentSchema>;

/** Confirmação de uma cobrança recorrente prevista: revisa data, valor e fatura. */
export const confirmForecastSchema = z.object({
  date: isoDate,
  amount: amountField,
  invoiceId: optionalId,
});
export type ConfirmForecastInput = z.infer<typeof confirmForecastSchema>;
