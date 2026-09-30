import type { Metadata } from "next";
import Link from "next/link";
import { ChevronLeft, ChevronRight, Target } from "lucide-react";
import { PageHeader } from "@/components/app-shell/page-header";
import { BudgetAlertLabel, BudgetBar } from "@/components/budget-bar";
import { CategoryBadge } from "@/components/category-icon";
import { EmptyState } from "@/components/empty-state";
import { Money } from "@/components/money";
import { addMonths, currentMonth, formatMonthLong, isISOMonth, monthRange } from "@/lib/dates";
import { budgetAlert } from "@/lib/finance/rules";
import { percentOf } from "@/lib/money";
import { monthBudget } from "@/server/finance/budgets";
import { requireHousehold } from "@/server/session";
import { CopyPreviousButton, LimitEditor } from "./budget-controls";

export const metadata: Metadata = { title: "Planejamento" };

export default async function PlanningPage({ searchParams }: PageProps<"/planejamento">) {
  const { ctx } = await requireHousehold();
  const { mes } = await searchParams;
  const month = typeof mes === "string" && isISOMonth(mes) ? mes : currentMonth();
  const budget = await monthBudget(ctx, month);
  const { from, to } = monthRange(month);
  const totalAlert = budget.totals.limitCents ? budgetAlert(budget.totals.realizedCents, budget.totals.limitCents) : null;

  return (
    <>
      <PageHeader title="Planejamento" description="Limites mensais por categoria de despesa." />
      <div className="grid gap-4">
        <div className="flex items-center justify-between gap-2">
          <Link href={`/planejamento?mes=${addMonths(month, -1)}`} aria-label="Mês anterior" className="flex size-11 items-center justify-center rounded-full hover:bg-muted">
            <ChevronLeft aria-hidden />
          </Link>
          <p className="font-semibold first-letter:uppercase">{formatMonthLong(month)}</p>
          <Link href={`/planejamento?mes=${addMonths(month, 1)}`} aria-label="Próximo mês" className="flex size-11 items-center justify-center rounded-full hover:bg-muted">
            <ChevronRight aria-hidden />
          </Link>
        </div>

        {budget.rows.length > 0 && totalAlert && (
          <section aria-label="Resumo do orçamento" className="grid gap-3 rounded-2xl bg-card p-4 ring-1 ring-border">
            <div className="flex items-start justify-between gap-2">
              <div>
                <p className="text-sm text-muted-foreground">Gasto realizado</p>
                <p className="text-2xl font-semibold"><Money cents={budget.totals.realizedCents} /></p>
                <p className="text-sm text-muted-foreground">de <Money cents={budget.totals.limitCents} /> planejados</p>
              </div>
              <BudgetAlertLabel alert={totalAlert} />
            </div>
            <BudgetBar
              realized={budget.totals.realizedCents}
              pending={budget.totals.pendingCents}
              limit={budget.totals.limitCents}
              alert={totalAlert}
              label="Consumo total do orçamento"
            />
            <div className="flex flex-wrap justify-between gap-2 text-sm">
              <span>
                Disponível: <Money cents={budget.totals.limitCents - budget.totals.realizedCents} className="font-semibold" />
              </span>
              {budget.totals.pendingCents > 0 && (
                <span className="text-muted-foreground">
                  Previsto a pagar: <Money cents={budget.totals.pendingCents} />
                </span>
              )}
            </div>
          </section>
        )}

        <CopyPreviousButton month={month} />

        {budget.rows.length === 0 && budget.withoutLimit.length === 0 ? (
          <EmptyState icon={Target} title="Nenhuma categoria de despesa" description="Crie categorias de despesa em Mais → Categorias." />
        ) : null}

        {budget.rows.length > 0 && (
          <section aria-labelledby="com-limite" className="grid gap-2">
            <h2 id="com-limite" className="px-1 text-sm font-semibold text-muted-foreground">Com limite</h2>
            <ul className="grid gap-2">
              {budget.rows.map((r) => (
                <li key={r.categoryId} className="grid gap-2.5 rounded-2xl bg-card p-4 ring-1 ring-border">
                  <div className="flex items-center gap-3">
                    <CategoryBadge icon={r.icon} color={r.color} />
                    <div className="min-w-0 flex-1">
                      <Link
                        href={`/lancamentos?categoria=${r.categoryId}&de=${from}&ate=${to}`}
                        className="block truncate font-medium hover:underline"
                      >
                        {r.name}
                      </Link>
                      <BudgetAlertLabel alert={r.alert} />
                    </div>
                    <div className="text-right">
                      <p className="font-semibold"><Money cents={r.realizedCents} /></p>
                      <p className="text-xs text-muted-foreground">de <Money cents={r.limitCents} /></p>
                    </div>
                  </div>
                  <BudgetBar
                    realized={r.realizedCents}
                    pending={r.pendingCents}
                    limit={r.limitCents}
                    alert={r.alert}
                    label={`${r.name}: ${percentOf(r.realizedCents, r.limitCents)}% do limite`}
                  />
                  <dl className="grid grid-cols-3 gap-2 text-xs">
                    <div>
                      <dt className="text-muted-foreground">Consumido</dt>
                      <dd className="font-semibold">{r.percent}%</dd>
                    </div>
                    <div>
                      <dt className="text-muted-foreground">Disponível</dt>
                      <dd className="font-semibold"><Money cents={r.availableCents} /></dd>
                    </div>
                    <div>
                      <dt className="text-muted-foreground">Previsto</dt>
                      <dd className="font-semibold"><Money cents={r.pendingCents} /></dd>
                    </div>
                  </dl>
                  <LimitEditor month={month} categoryId={r.categoryId} name={r.name} limitCents={r.limitCents} />
                </li>
              ))}
            </ul>
          </section>
        )}

        {budget.withoutLimit.length > 0 && (
          <section aria-labelledby="sem-limite" className="grid gap-2">
            <h2 id="sem-limite" className="px-1 text-sm font-semibold text-muted-foreground">Sem limite neste mês</h2>
            <ul className="divide-y rounded-2xl bg-card ring-1 ring-border">
              {budget.withoutLimit.map((c) => (
                <li key={c.id} className="grid gap-2 p-4">
                  <div className="flex items-center gap-3">
                    <CategoryBadge icon={c.icon} color={c.color} size="sm" />
                    <span className="min-w-0 flex-1 truncate font-medium">{c.name}</span>
                    <span className="text-right text-sm">
                      <Money cents={c.realizedCents} />
                      {c.pendingCents > 0 && (
                        <span className="block text-xs text-muted-foreground">+ <Money cents={c.pendingCents} /> previsto</span>
                      )}
                    </span>
                  </div>
                  <LimitEditor month={month} categoryId={c.id} name={c.name} limitCents={null} />
                </li>
              ))}
            </ul>
          </section>
        )}
      </div>
    </>
  );
}
