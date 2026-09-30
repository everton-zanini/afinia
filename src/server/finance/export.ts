import { centsToInput } from "@/lib/money";
import { formatDate } from "@/lib/dates";
import type { TransactionDTO } from "./transactions";

const KIND_LABEL = { INCOME: "Receita", EXPENSE: "Despesa", TRANSFER: "Transferência" } as const;
const STATUS_LABEL = { PENDING: "Pendente", EFFECTIVE: "Efetivado" } as const;

/** Neutraliza fórmulas de planilha e escapa aspas/separadores. */
export function csvCell(value: string | null | undefined): string {
  let s = value ?? "";
  if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`;
  if (/[";\n\r]/.test(s)) s = `"${s.replace(/"/g, '""')}"`;
  return s;
}

const HEADER = [
  "Data de referência",
  "Tipo",
  "Situação",
  "Descrição",
  "Categoria",
  "Subcategoria",
  "Conta",
  "Conta de destino",
  "Valor (R$)",
  "Vencimento",
  "Efetivação",
  "Responsável",
  "Cadastrado por",
  "Observação",
];

/** CSV para Excel/LibreOffice em pt-BR: BOM UTF-8, separador ";" e vírgula decimal. */
export function transactionsToCsv(rows: TransactionDTO[]): string {
  const lines = [HEADER.join(";")];
  for (const t of rows) {
    const category = t.category?.parentName ?? t.category?.name ?? "";
    const sub = t.category?.parentName ? t.category.name : "";
    lines.push(
      [
        formatDate(t.referenceDate),
        KIND_LABEL[t.kind],
        STATUS_LABEL[t.status],
        t.description,
        category,
        sub,
        t.account.name,
        t.toAccount?.name ?? "",
        // Valor sempre positivo; o tipo define o efeito.
        centsToInput(t.amountCents),
        formatDate(t.dueDate),
        t.effectiveDate ? formatDate(t.effectiveDate) : "",
        t.responsible?.name ?? "",
        t.createdBy.name,
        t.notes ?? "",
      ]
        .map(csvCell)
        .join(";"),
    );
  }
  return `﻿${lines.join("\r\n")}\r\n`;
}
