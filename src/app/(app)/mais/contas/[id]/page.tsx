import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Archive, ArchiveRestore, ListOrdered, Trash2 } from "lucide-react";
import { PageHeader } from "@/components/app-shell/page-header";
import { ConfirmAction } from "@/components/confirm-action";
import { Money } from "@/components/money";
import { Button } from "@/components/ui/button";
import { todayISO } from "@/lib/dates";
import { NotFoundError } from "@/server/errors";
import { accountsWithBalances, getAccount } from "@/server/finance/accounts";
import { archiveAccountAction, deleteAccountAction } from "@/server/actions/finance";
import { requireHousehold } from "@/server/session";
import { AccountForm } from "../account-form";

export const metadata: Metadata = { title: "Editar conta" };

export default async function EditAccountPage({ params }: PageProps<"/mais/contas/[id]">) {
  const { ctx } = await requireHousehold();
  const { id } = await params;
  const account = await getAccount(ctx, id).catch((e) => {
    if (e instanceof NotFoundError) notFound();
    throw e;
  });
  const balance = (await accountsWithBalances(ctx, { includeArchived: true })).find((a) => a.id === id)!;

  return (
    <>
      <PageHeader title={account.name} backHref="/mais/contas" />
      <div className="grid gap-4">
        <section className="flex items-center justify-between gap-3 rounded-2xl bg-card p-4 ring-1 ring-border">
          <div>
            <p className="text-sm text-muted-foreground">Saldo realizado</p>
            <p className="text-xl font-semibold">
              <Money cents={balance.balanceCents} />
            </p>
            {balance.projectedCents !== balance.balanceCents && (
              <p className="text-sm text-muted-foreground">
                Previsto com pendências: <Money cents={balance.projectedCents} />
              </p>
            )}
          </div>
          <Button asChild variant="outline">
            <Link href={`/lancamentos?conta=${id}`}>
              <ListOrdered aria-hidden />
              Lançamentos
            </Link>
          </Button>
        </section>
        <AccountForm account={account} today={todayISO()} />
        <section className="grid gap-2 rounded-2xl bg-card p-4 ring-1 ring-border">
          <h2 className="font-semibold">Arquivar ou excluir</h2>
          <p className="text-sm text-muted-foreground">
            Contas com lançamentos não podem ser excluídas: arquive para escondê-las dos novos lançamentos.
          </p>
          <div className="grid gap-2 sm:grid-cols-2">
            <ConfirmAction
              action={archiveAccountAction.bind(null, id, !account.archived)}
              title={account.archived ? "Reativar conta?" : "Arquivar conta?"}
              description={
                account.archived
                  ? "Ela voltará a aparecer nos novos lançamentos."
                  : "Ela deixará de aparecer nos novos lançamentos. O histórico é mantido."
              }
              confirmLabel={account.archived ? "Reativar" : "Arquivar"}
            >
              {account.archived ? <ArchiveRestore aria-hidden /> : <Archive aria-hidden />}
              {account.archived ? "Reativar" : "Arquivar"}
            </ConfirmAction>
            <ConfirmAction
              action={deleteAccountAction.bind(null, id)}
              title="Excluir conta?"
              description="Só é possível excluir contas sem lançamentos. Esta ação não pode ser desfeita."
              confirmLabel="Excluir"
              variant="destructive"
              destructive
            >
              <Trash2 aria-hidden />
              Excluir
            </ConfirmAction>
          </div>
        </section>
      </div>
    </>
  );
}
