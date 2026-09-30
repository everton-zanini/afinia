import type { Metadata } from "next";
import { randomUUID } from "node:crypto";
import { notFound } from "next/navigation";
import { PageHeader } from "@/components/app-shell/page-header";
import { todayISO } from "@/lib/dates";
import { NotFoundError } from "@/server/errors";
import { getTransaction } from "@/server/finance/transactions";
import { requireHousehold } from "@/server/session";
import { loadFormOptions } from "../../form-data";
import { TransactionForm } from "../../transaction-form";

export const metadata: Metadata = { title: "Editar lançamento" };

export default async function EditTransactionPage({ params }: PageProps<"/lancamentos/[id]/editar">) {
  const { ctx } = await requireHousehold();
  const { id } = await params;
  const t = await getTransaction(ctx, id).catch((e) => {
    if (e instanceof NotFoundError) notFound();
    throw e;
  });
  const options = await loadFormOptions(ctx, {
    categoryId: t.category?.id,
    accountIds: [t.account.id, t.toAccount?.id ?? null],
  });
  return (
    <>
      <PageHeader title="Editar lançamento" backHref={`/lancamentos/${id}`} />
      <TransactionForm
        transactionId={id}
        idempotencyKey={randomUUID()}
        today={todayISO()}
        initial={{
          kind: t.kind,
          description: t.description,
          amountCents: t.amountCents,
          categoryId: t.category?.id ?? null,
          accountId: t.account.id,
          toAccountId: t.toAccount?.id ?? null,
          status: t.status,
          dueDate: t.dueDate,
          effectiveDate: t.effectiveDate,
          responsibleMemberId: t.responsible?.memberId ?? null,
          notes: t.notes,
        }}
        {...options}
      />
    </>
  );
}
