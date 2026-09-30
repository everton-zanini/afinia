import type { Metadata } from "next";
import Link from "next/link";
import { ChevronLeft, ChevronRight, PieChart as PieIcon } from "lucide-react";
import { PageHeader } from "@/components/app-shell/page-header";
import { CategoryBadge } from "@/components/category-icon";
import { BalanceLine, CategoryDonut, IncomeExpenseBars } from "@/components/charts";
import { EmptyState } from "@/components/empty-state";
import { Money } from "@/components/money";
import { addMonths, currentMonth, formatDate, formatMonthLong, formatMonthShort, isISOMonth, todayISO } from "@/lib/dates";
import { formatBRL } from "@/lib/money";
import { cn } from "@/lib/utils";
import { reports } from "@/server/finance/reports";
import { requireHousehold } from "@/server/session";
import { AccountFilter } from "./account-filter";

export const metadata: Metadata = { title: "Relatórios" };

const TABS = [
  { id: "categorias", label: "Categorias" },
  { id: "mensal", label: "Entradas × saídas" },
  { id: "saldo", label: "Saldo" },
] as const;
type Tab = (typeof TABS)[number]["id"];

export default async function ReportsPage({ searchParams }: PageProps<"/relatorios">) {
  const { ctx } = await requireHousehold();
  const sp = await searchParams;
  const month = typeof sp.mes === "string" && isISOMonth(sp.mes) ? sp.mes : currentMonth();
  const tab: Tab = TABS.some((t) => t.id === sp.aba) ? (sp.aba as Tab) : "categorias";
  const accountParam = typeof sp.conta === "string" ? sp.conta : undefined;
  const data = await reports(ctx, { month, accountId: accountParam, today: todayISO() });

  const query = (patch: Record<string, string | null>) => {
    const p = new URLSearchParams();
    const base: Record<string, string | null> = { mes: month, aba: tab, conta: data.accountId, ...patch };
    for (const [k, v] of Object.entries(base)) if (v) p.set(k, v);
    return p.toString();
  };
  const txBase = `mes=${month}${data.accountId ? `&conta=${data.accountId}` : ""}`;

  return (
    <>
      <PageHeader title="Relatórios" description="Somente valores realizados, a partir dos lançamentos do casal." />
      <div className="grid gap-4">
        <div className="flex items-center justify-between gap-2">
          <Link href={`/relatorios?${query({ mes: addMonths(month, -1) })}`} aria-label="Mês anterior" className="flex size-11 items-center justify-center rounded-full hover:bg-muted">
            <ChevronLeft aria-hidden />
          </Link>
          <p className="font-semibold first-letter:uppercase">{formatMonthLong(month)}</p>
          <Link href={`/relatorios?${query({ mes: addMonths(month, 1) })}`} aria-label="Próximo mês" className="flex size-11 items-center justify-center rounded-full hover:bg-muted">
            <ChevronRight aria-hidden />
          </Link>
        </div>

        {data.accounts.length > 1 && <AccountFilter accounts={data.accounts} value={data.accountId ?? ""} baseQuery={query({ conta: null })} />}

        <nav aria-label="Tipo de relatório" className="grid grid-cols-3 gap-1 rounded-xl bg-muted p-1">
          {TABS.map((t) => (
            <Link
              key={t.id}
              href={`/relatorios?${query({ aba: t.id })}`}
              aria-current={tab === t.id ? "page" : undefined}
              className={cn(
                "flex min-h-11 items-center justify-center rounded-lg px-1 text-center text-sm font-medium leading-tight text-muted-foreground",
                tab === t.id && "bg-card text-foreground shadow-sm",
              )}
            >
              {t.label}
            </Link>
          ))}
        </nav>

        {tab === "categorias" && (
          <section aria-labelledby="t-cat" className="grid gap-4 rounded-2xl bg-card p-4 ring-1 ring-border">
            <h2 id="t-cat" className="font-semibold">Despesas realizadas por categoria</h2>
            {data.byCategory.slices.length === 0 ? (
              <EmptyState icon={PieIcon} title="Sem despesas realizadas neste mês" description="Quando houver despesas pagas no mês, elas aparecem aqui por categoria." />
            ) : (
              <>
                <CategoryDonut
                  data={data.byCategory.slices.map((s) => ({ name: s.name, value: s.amountCents, fill: s.color }))}
                  totalLabel={formatBRL(data.byCategory.totalCents)}
                  label={`Gráfico de rosca: ${data.byCategory.slices.map((s) => `${s.name} ${s.percent}%`).join(", ")}`}
                />
                <ul className="divide-y" aria-label="Valores por categoria">
                  {data.byCategory.slices.map((s) => (
                    <li key={s.categoryId}>
                      <Link
                        href={`/lancamentos?${txBase}&categoria=${s.categoryId}&tipo=despesa&situacao=efetivado`}
                        className="flex min-h-14 items-center gap-3 py-2 hover:bg-muted/50"
                      >
                        <CategoryBadge icon={s.icon} color={s.color} size="sm" />
                        <span className="min-w-0 flex-1 truncate font-medium">{s.name}</span>
                        <span className="text-right">
                          <Money cents={s.amountCents} className="block font-semibold" />
                          <span className="text-xs text-muted-foreground">{s.percent}% das despesas</span>
                        </span>
                        <ChevronRight aria-hidden className="size-4 text-muted-foreground" />
                      </Link>
                    </li>
                  ))}
                  <li className="flex justify-between py-3 font-semibold">
                    <span>Total</span>
                    <Money cents={data.byCategory.totalCents} />
                  </li>
                </ul>
              </>
            )}
          </section>
        )}

        {tab === "mensal" && (
          <section aria-labelledby="t-mes" className="grid gap-4 rounded-2xl bg-card p-4 ring-1 ring-border">
            <h2 id="t-mes" className="font-semibold">Receitas × despesas realizadas (6 meses)</h2>
            {data.series.every((p) => p.incomeCents === 0 && p.expenseCents === 0) ? (
              <EmptyState icon={PieIcon} title="Sem movimentações realizadas" description="Nenhuma receita ou despesa efetivada nos últimos seis meses." />
            ) : (
              <IncomeExpenseBars
                data={data.series.map((p) => ({ label: formatMonthShort(p.month), Receitas: p.incomeCents, Despesas: p.expenseCents }))}
                label="Gráfico de barras de receitas e despesas dos últimos seis meses; valores na tabela abaixo."
              />
            )}
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <caption className="sr-only">Receitas, despesas e resultado por mês</caption>
                <thead>
                  <tr className="text-left text-xs text-muted-foreground">
                    <th scope="col" className="py-2 font-medium">Mês</th>
                    <th scope="col" className="py-2 text-right font-medium">Receitas</th>
                    <th scope="col" className="py-2 text-right font-medium">Despesas</th>
                    <th scope="col" className="py-2 text-right font-medium">Resultado</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {data.series.map((p) => (
                    <tr key={p.month}>
                      <th scope="row" className="py-2 text-left font-medium">
                        <Link href={`/lancamentos?mes=${p.month}${data.accountId ? `&conta=${data.accountId}` : ""}`} className="hover:underline">
                          {formatMonthShort(p.month)}
                        </Link>
                      </th>
                      <td className="py-2 text-right"><Money cents={p.incomeCents} tone="income" /></td>
                      <td className="py-2 text-right"><Money cents={p.expenseCents} tone="expense" /></td>
                      <td className="py-2 text-right font-semibold"><Money cents={p.incomeCents - p.expenseCents} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        )}

        {tab === "saldo" && (
          <section aria-labelledby="t-saldo" className="grid gap-4 rounded-2xl bg-card p-4 ring-1 ring-border">
            <h2 id="t-saldo" className="font-semibold">Evolução do saldo realizado</h2>
            <dl className="grid grid-cols-2 gap-3">
              <div>
                <dt className="text-xs text-muted-foreground">Saldo no início do mês</dt>
                <dd className="font-semibold"><Money cents={data.evolution.openingCents} /></dd>
              </div>
              <div>
                <dt className="text-xs text-muted-foreground">
                  {data.evolution.points.length ? `Saldo em ${formatDate(data.evolution.points.at(-1)!.date)}` : "Saldo"}
                </dt>
                <dd className="font-semibold"><Money cents={data.evolution.closingCents} /></dd>
              </div>
            </dl>
            {data.evolution.points.length === 0 ? (
              <EmptyState icon={PieIcon} title="Mês ainda não começou" description="A evolução aparece a partir do primeiro dia do mês." />
            ) : (
              <>
                <BalanceLine
                  data={data.evolution.points.map((p) => ({ label: p.date.slice(8), Saldo: p.balanceCents }))}
                  openingCents={data.evolution.openingCents}
                  label={`Linha do saldo: de ${formatBRL(data.evolution.openingCents)} para ${formatBRL(data.evolution.closingCents)}. Dias com mudança na lista abaixo.`}
                />
                <details className="rounded-lg bg-muted/50">
                  <summary className="flex min-h-11 cursor-pointer items-center px-3 text-sm font-medium">Ver dias com movimentação</summary>
                  <ul className="divide-y px-3 pb-2 text-sm">
                    {data.evolution.points
                      .filter((p, i, arr) => p.balanceCents !== (i === 0 ? data.evolution.openingCents : arr[i - 1].balanceCents))
                      .map((p) => (
                        <li key={p.date} className="flex justify-between py-2">
                          <Link href={`/lancamentos?de=${p.date}&ate=${p.date}${data.accountId ? `&conta=${data.accountId}` : ""}`} className="hover:underline">
                            {formatDate(p.date)}
                          </Link>
                          <Money cents={p.balanceCents} />
                        </li>
                      ))}
                  </ul>
                </details>
              </>
            )}
          </section>
        )}
      </div>
    </>
  );
}
