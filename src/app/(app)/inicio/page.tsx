import type { Metadata } from "next";
import Link from "next/link";
import { AlertTriangle, ArrowDownRight, ArrowUpRight, CalendarClock, ChevronRight, Lightbulb, Minus, Wallet } from "lucide-react";
import { BudgetAlertLabel, BudgetBar } from "@/components/budget-bar";
import { BalanceSummary } from "@/components/balance-summary";
import { CategoryBadge } from "@/components/category-icon";
import { EmptyState } from "@/components/empty-state";
import { Money } from "@/components/money";
import { TransactionRow } from "@/components/transaction-row";
import { Button } from "@/components/ui/button";
import { currentMonth, formatMonthLong, todayISO } from "@/lib/dates";
import type { Comparison } from "@/lib/finance/reports";
import { formatBRL } from "@/lib/money";
import { cn } from "@/lib/utils";
import { dashboard } from "@/server/finance/reports";
import { requireHousehold } from "@/server/session";

export const metadata: Metadata = { title: "Início" };

/** Variação vs mês anterior. `goodWhenUp` define se subir é positivo (receita) ou não (despesa). */
function Delta({ c, goodWhenUp }: { c: Comparison; goodWhenUp: boolean }) {
  if (c.deltaCents === 0) {
    return (
      <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
        <Minus aria-hidden className="size-3" /> igual ao mês anterior
      </span>
    );
  }
  const up = c.deltaCents > 0;
  const good = up === goodWhenUp;
  const Icon = up ? ArrowUpRight : ArrowDownRight;
  return (
    <span className={cn("inline-flex flex-wrap items-center gap-x-1 text-xs", good ? "text-income" : "text-expense")}>
      <Icon aria-hidden className="size-3.5" />
      <span>
        {up ? "+" : "−"}
        {formatBRL(Math.abs(c.deltaCents))}
      </span>
      <span className="text-muted-foreground">
        {c.percent === null ? "· sem base de comparação" : `· ${Math.abs(c.percent)}% vs mês anterior`}
      </span>
    </span>
  );
}

export default async function HomePage() {
  const { ctx, user } = await requireHousehold();
  const today = todayISO();
  const month = currentMonth();
  const d = await dashboard(ctx, month, today);
  const firstName = user.name.split(" ")[0];

  return (
    <div className="grid gap-5 pt-2">
      <header>
        <p className="text-sm text-muted-foreground">Olá, {firstName} · {ctx.householdName}</p>
        <h1 className="text-2xl font-semibold tracking-tight first-letter:uppercase">{formatMonthLong(month)}</h1>
      </header>

      <BalanceSummary
        generalCents={d.generalBalanceCents}
        benefitCents={d.benefitBalanceCents}
        totalCents={d.totalBalanceCents}
        benefits={d.benefits}
        showAccountsLink
      />

      {!d.hasAccounts ? (
        <EmptyState
          icon={Wallet}
          title="Vamos começar"
          description="Cadastre a conta do banco, o dinheiro em mãos ou uma reserva. Depois é só registrar receitas e despesas."
          action={<Button asChild><Link href="/mais/contas/nova">Cadastrar primeira conta</Link></Button>}
        />
      ) : (
        <>
          <section aria-labelledby="mes-atual" className="grid gap-2">
            <h2 id="mes-atual" className="sr-only">Resumo do mês</h2>
            <div className="grid grid-cols-2 gap-2">
              <div className="grid gap-1 rounded-2xl bg-card p-4 ring-1 ring-border">
                <p className="text-xs font-medium text-muted-foreground">Entrou</p>
                <Money cents={d.current.incomeRealized} tone="income" className="text-xl font-semibold" />
                {d.current.incomeBenefit > 0 && (
                  <p className="text-xs text-muted-foreground">
                    <Money cents={d.current.incomeCash} /> em dinheiro + <Money cents={d.current.incomeBenefit} /> em benefícios
                  </p>
                )}
                <Delta c={d.comparison.income} goodWhenUp />
              </div>
              <div className="grid gap-1 rounded-2xl bg-card p-4 ring-1 ring-border">
                <p className="text-xs font-medium text-muted-foreground">Saiu</p>
                <Money cents={d.current.expenseRealized} tone="expense" className="text-xl font-semibold" />
                <Delta c={d.comparison.expense} goodWhenUp={false} />
              </div>
            </div>
            <div className="grid gap-1 rounded-2xl bg-card p-4 ring-1 ring-border">
              <div className="flex items-baseline justify-between gap-2">
                <p className="text-sm font-medium">Resultado do mês</p>
                <Money cents={d.current.result} className={cn("text-xl font-semibold", d.current.result < 0 ? "text-expense" : "text-income")} />
              </div>
              <Delta c={d.comparison.result} goodWhenUp />
              {(d.current.incomePending > 0 || d.current.expensePending > 0) && (
                <p className="mt-1 border-t pt-2 text-sm text-muted-foreground">
                  Previsto até o fim do mês: <Money cents={d.current.incomePending} tone="income" /> a receber e{" "}
                  <Money cents={d.current.expensePending} tone="expense" /> a pagar.
                </p>
              )}
            </div>
          </section>

          {(d.overdue.length > 0 || d.next.length > 0) && (
            <section aria-labelledby="vencimentos" className="grid gap-2">
              <div className="flex items-center justify-between px-1">
                <h2 id="vencimentos" className="flex items-center gap-1.5 font-semibold">
                  <CalendarClock aria-hidden className="size-4 text-primary" /> Vencimentos
                </h2>
                <Link href="/lancamentos?situacao=pendente&mes=todos" className="flex min-h-11 items-center text-sm font-medium text-primary">
                  Ver pendências
                </Link>
              </div>
              {d.overdue.length > 0 && (
                <div className="overflow-hidden rounded-2xl bg-card ring-1 ring-expense/40">
                  <p className="flex items-center gap-1.5 bg-expense-soft px-4 py-2 text-sm font-semibold text-expense">
                    <AlertTriangle aria-hidden className="size-4" /> Atrasados ({d.overdue.length})
                  </p>
                  <ul className="divide-y">
                    {d.overdue.slice(0, 4).map((t) => <li key={t.id}><TransactionRow t={t} today={today} /></li>)}
                  </ul>
                </div>
              )}
              {d.next.length > 0 && (
                <div className="overflow-hidden rounded-2xl bg-card ring-1 ring-border">
                  <p className="px-4 pt-3 text-sm font-semibold text-muted-foreground">Próximos 7 dias</p>
                  <ul className="divide-y">
                    {d.next.slice(0, 4).map((t) => <li key={t.id}><TransactionRow t={t} today={today} /></li>)}
                  </ul>
                </div>
              )}
            </section>
          )}

          {d.insights.length > 0 && (
            <section aria-labelledby="destaques" className="grid gap-2 rounded-2xl bg-secondary/60 p-4">
              <h2 id="destaques" className="flex items-center gap-1.5 font-semibold text-secondary-foreground">
                <Lightbulb aria-hidden className="size-4" /> Destaques do mês
              </h2>
              <ul className="grid gap-1.5 text-sm">
                {d.insights.map((i) => <li key={i} className="leading-snug">• {i}</li>)}
              </ul>
            </section>
          )}

          {d.topCategories.length > 0 && (
            <section aria-labelledby="onde" className="grid gap-2">
              <div className="flex items-center justify-between px-1">
                <h2 id="onde" className="font-semibold">Onde estamos gastando</h2>
                <Link href={`/relatorios?mes=${month}`} className="flex min-h-11 items-center text-sm font-medium text-primary">Relatórios</Link>
              </div>
              <ul className="divide-y rounded-2xl bg-card ring-1 ring-border">
                {d.topCategories.map((c) => (
                  <li key={c.categoryId}>
                    <Link href={`/lancamentos?mes=${month}&categoria=${c.categoryId}&tipo=despesa&situacao=efetivado`} className="flex min-h-14 items-center gap-3 px-4 py-2 hover:bg-muted/50">
                      <CategoryBadge icon={c.icon} color={c.color} size="sm" />
                      <span className="min-w-0 flex-1 truncate font-medium">{c.name}</span>
                      <span className="text-right">
                        <Money cents={c.amountCents} className="block font-semibold" />
                        <span className="text-xs text-muted-foreground">{c.percent}%</span>
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          )}

          <section aria-labelledby="orcamento" className="grid gap-2">
            <div className="flex items-center justify-between px-1">
              <h2 id="orcamento" className="font-semibold">Orçamento</h2>
              <Link href="/planejamento" className="flex min-h-11 items-center gap-0.5 text-sm font-medium text-primary">
                Planejamento <ChevronRight aria-hidden className="size-4" />
              </Link>
            </div>
            {d.budgetRows.length === 0 ? (
              <p className="rounded-2xl bg-card p-4 text-sm text-muted-foreground ring-1 ring-border">
                Nenhum limite definido para este mês. <Link href="/planejamento" className="font-medium text-primary underline">Definir limites</Link>
              </p>
            ) : (
              <ul className="grid gap-3 rounded-2xl bg-card p-4 ring-1 ring-border">
                {d.budgetRows.slice(0, 3).map((r) => (
                  <li key={r.categoryId} className="grid gap-1.5">
                    <div className="flex items-baseline justify-between gap-2 text-sm">
                      <span className="truncate font-medium">{r.name}</span>
                      <span className="shrink-0 text-muted-foreground">
                        <Money cents={r.realizedCents} className="font-semibold text-foreground" /> de <Money cents={r.limitCents} />
                      </span>
                    </div>
                    <BudgetBar realized={r.realizedCents} pending={r.pendingCents} limit={r.limitCents} alert={r.alert} label={`${r.name}: ${r.percent}% do limite`} />
                    <BudgetAlertLabel alert={r.alert} />
                  </li>
                ))}
              </ul>
            )}
          </section>

          {!d.hasTransactions && (
            <EmptyState
              icon={CalendarClock}
              title="Nenhum lançamento ainda"
              description="Toque em “Novo lançamento” para registrar a primeira receita ou despesa."
            />
          )}
        </>
      )}
    </div>
  );
}
