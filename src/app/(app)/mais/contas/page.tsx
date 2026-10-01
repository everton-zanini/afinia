import type { Metadata } from "next";
import Link from "next/link";
import { Archive, ChevronRight, Plus, Wallet } from "lucide-react";
import { ACCOUNT_ICON } from "@/components/account-icon";
import { PageHeader } from "@/components/app-shell/page-header";
import { EmptyState } from "@/components/empty-state";
import { Money } from "@/components/money";
import { Button } from "@/components/ui/button";
import { accountKindLabel, accountsWithBalances } from "@/server/finance/accounts";
import { splitBalances } from "@/lib/finance/rules";
import { BalanceSummary } from "@/components/balance-summary";
import { requireHousehold } from "@/server/session";

export const metadata: Metadata = { title: "Contas" };

export default async function AccountsPage({ searchParams }: PageProps<"/mais/contas">) {
  const { ctx } = await requireHousehold();
  const { arquivadas } = await searchParams;
  const showArchived = arquivadas === "1";
  const accounts = await accountsWithBalances(ctx, { includeArchived: showArchived });
  const split = splitBalances(accounts, new Map(accounts.map((a) => [a.id, a.balanceCents])));
  const names = new Map(accounts.map((a) => [a.id, a.name]));

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
          description="Cadastre a conta do banco, o dinheiro em mãos, uma reserva ou um benefício (vale) para começar a lançar."
          action={
            <Button asChild>
              <Link href="/mais/contas/nova">Cadastrar conta</Link>
            </Button>
          }
        />
      ) : (
        <div className="grid gap-4">
          <BalanceSummary
            generalCents={split.generalCents}
            benefitCents={split.benefitCents}
            totalCents={split.totalCents}
            benefits={split.benefits.map((b) => ({ ...b, name: names.get(b.id)! }))}
          />
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
                        {a.archived ? "Arquivada" : accountKindLabel(a)}
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
