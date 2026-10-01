import type { Metadata } from "next";
import { randomUUID } from "node:crypto";
import { PageHeader } from "@/components/app-shell/page-header";
import { todayISO } from "@/lib/dates";
import { DomainError } from "@/server/errors";
import { duplicateDraft } from "@/server/finance/transactions";
import { requireHousehold } from "@/server/session";
import { loadFormOptions } from "../form-data";
import { TransactionForm, type TransactionInitial } from "../transaction-form";

export const metadata: Metadata = { title: "Novo lançamento" };

export default async function NewTransactionPage({ searchParams }: PageProps<"/lancamentos/novo">) {
  const { ctx } = await requireHousehold();
  const { duplicar, tipo } = await searchParams;
  const today = todayISO();

  let initial: TransactionInitial = {
    kind: tipo === "receita" ? "INCOME" : tipo === "transferencia" ? "TRANSFER" : "EXPENSE",
    description: "",
    amountCents: null,
    categoryId: null,
    accountId: null,
    toAccountId: null,
    status: "EFFECTIVE",
    dueDate: today,
    effectiveDate: today,
    responsibleMemberId: null,
    notes: null,
  };
  let duplicated = false;
  if (typeof duplicar === "string") {
    try {
      const d = await duplicateDraft(ctx, duplicar);
      initial = { ...d, effectiveDate: null };
      duplicated = true;
    } catch (e) {
      // Inexistente ou não duplicável (ex.: pagamento de fatura): abre o formulário em branco.
      if (!(e instanceof DomainError)) throw e;
    }
  }
  const options = await loadFormOptions(ctx);

  return (
    <>
      <PageHeader
        title={duplicated ? "Duplicar lançamento" : "Novo lançamento"}
        backHref="/lancamentos"
        description={duplicated ? "Revise os dados. A cópia começa pendente, com a data de hoje." : undefined}
      />
      {/* Chave nova a cada abertura do formulário: reenvios do mesmo formulário não duplicam. */}
      <TransactionForm transactionId={null} idempotencyKey={randomUUID()} initial={initial} today={today} {...options} />
    </>
  );
}
