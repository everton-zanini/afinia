import type { Metadata } from "next";
import Link from "next/link";
import { Archive, ChevronRight, Plus, Wallet } from "lucide-react";
import { ACCOUNT_ICON } from "@/components/account-icon";
import { PageHeader } from "@/components/app-shell/page-header";
import { EmptyState } from "@/components/empty-state";
import { Money } from "@/components/money";
import { Button } from "@/components/ui/button";
import { ACCOUNT_KIND_LABEL, accountsWithBalances } from "@/server/finance/accounts";
import { requireHousehold } from "@/server/session";

export const metadata: Metadata = { title: "Contas" };

export default async function AccountsPage({ searchParams }: PageProps<"/mais/contas">) {
  const { ctx } = await requireHousehold();
  const { arquivadas } = await searchParams;
  const showArchived = arquivadas === "1";
  const accounts = await accountsWithBalances(ctx, { includeArchived: showArchived });
  const total = accounts.filter((a) => !a.archived).reduce((s, a) => s + a.balanceCents, 0);

  return (
    <>
      <PageHeader
        title="Contas"
        backHref="/mais"
        description="Onde o dinheiro está. O saldo considera apenas lançamentos efetivados."
        actions={
          <Button asChild size="icon" aria-label="Nova conta">
            <Link href="/mais/contas/nova">
              <Plus aria-hidden />
            </Link>
          </Button>
        }
      />
      {accounts.length === 0 ? (
        <EmptyState
          icon={Wallet}
          title="Nenhuma conta cadastrada"
          description="Cadastre a conta do banco, o dinheiro em mãos ou uma reserva para começar a lançar."
          action={
            <Button asChild>
              <Link href="/mais/contas/nova">Cadastrar conta</Link>
            </Button>
          }
        />
      ) : (
        <div className="grid gap-4">
          <div className="rounded-2xl bg-primary p-4 text-primary-foreground">
            <p className="text-sm opacity-90">Saldo realizado das contas ativas</p>
            <p className="text-2xl font-semibold tabular">
              <Money cents={total} />
            </p>
          </div>
          <ul className="divide-y overflow-hidden rounded-2xl bg-card ring-1 ring-border">
            {accounts.map((a) => {
              const Icon = ACCOUNT_ICON[a.kind];
              return (
                <li key={a.id}>
                  <Link href={`/mais/contas/${a.id}`} className="flex min-h-16 items-center gap-3 px-4 py-3 hover:bg-muted/60">
                    <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-secondary text-primary">
                      <Icon aria-hidden className="size-5" />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-medium">{a.name}</span>
                      <span className="flex items-center gap-1 text-sm text-muted-foreground">
                        {a.archived && <Archive aria-hidden className="size-3.5" />}
                        {a.archived ? "Arquivada" : ACCOUNT_KIND_LABEL[a.kind]}
                      </span>
                    </span>
                    <span className="text-right">
                      <Money cents={a.balanceCents} className="block font-semibold" />
                      {a.projectedCents !== a.balanceCents && (
                        <span className="block text-xs text-muted-foreground">
                          Previsto: <Money cents={a.projectedCents} />
                        </span>
                      )}
                    </span>
                    <ChevronRight aria-hidden className="size-5 shrink-0 text-muted-foreground" />
                  </Link>
                </li>
              );
            })}
          </ul>
          <Link
            href={showArchived ? "/mais/contas" : "/mais/contas?arquivadas=1"}
            className="flex min-h-11 items-center justify-center text-sm font-medium text-primary"
          >
            {showArchived ? "Ocultar arquivadas" : "Mostrar arquivadas"}
          </Link>
        </div>
      )}
    </>
  );
}
