import Link from "next/link";
import { Clock } from "lucide-react";
import { addDays, monthRange, weekdayOf, type ISOMonth } from "@/lib/dates";
import { cn } from "@/lib/utils";
import type { TransactionDTO } from "@/server/finance/transactions";

const WEEK = ["D", "S", "T", "Q", "Q", "S", "S"];
const WEEK_FULL = ["domingo", "segunda", "terça", "quarta", "quinta", "sexta", "sábado"];

/** Valor curto para células pequenas: "1,2 mil", "85". Apenas exibição. */
function short(cents: number) {
  const reais = Math.round(cents / 100);
  if (reais >= 1000) return `${(Math.round(reais / 100) / 10).toString().replace(".", ",")}k`;
  return String(reais);
}

export function MonthCalendar({
  month,
  rows,
  today,
  linkQuery,
}: {
  month: ISOMonth;
  rows: TransactionDTO[];
  today: string;
  linkQuery: (day: string) => string;
}) {
  const { from, to } = monthRange(month);
  const days: { date: string; income: number; expense: number; pending: number; count: number }[] = [];
  for (let d = from; d <= to; d = addDays(d, 1)) days.push({ date: d, income: 0, expense: 0, pending: 0, count: 0 });
  const byDate = new Map(days.map((d) => [d.date, d]));
  for (const t of rows) {
    const cell = byDate.get(t.referenceDate);
    if (!cell) continue;
    cell.count += 1;
    if (t.status === "PENDING") cell.pending += 1;
    else if (t.kind === "INCOME") cell.income += t.amountCents;
    else if (t.kind === "EXPENSE") cell.expense += t.amountCents;
  }
  const lead = weekdayOf(from);

  return (
    <div className="rounded-2xl bg-card p-2 ring-1 ring-border">
      <div className="grid grid-cols-7 text-center text-xs font-medium text-muted-foreground" aria-hidden>
        {WEEK.map((w, i) => <div key={i} className="py-1">{w}</div>)}
      </div>
      <ol className="grid grid-cols-7 gap-0.5" aria-label="Calendário do mês">
        {Array.from({ length: lead }, (_, i) => <li key={`e${i}`} aria-hidden />)}
        {days.map((d) => {
          const dayNum = Number(d.date.slice(8));
          const parts = [
            `${dayNum}, ${WEEK_FULL[weekdayOf(d.date)]}`,
            d.income ? `entrou ${short(d.income)} reais` : null,
            d.expense ? `saiu ${short(d.expense)} reais` : null,
            d.pending ? `${d.pending} pendente(s)` : null,
            d.count === 0 ? "sem lançamentos" : null,
          ].filter(Boolean);
          return (
            <li key={d.date}>
              <Link
                href={`/lancamentos${linkQuery(d.date)}`}
                aria-label={parts.join(", ")}
                className={cn(
                  "flex min-h-16 flex-col items-center gap-0.5 rounded-lg px-0.5 py-1 text-[0.65rem] leading-tight hover:bg-muted",
                  d.date === today && "ring-2 ring-primary",
                  d.count === 0 && "text-muted-foreground",
                )}
              >
                <span className="text-sm font-semibold">{dayNum}</span>
                {d.income > 0 && <span className="tabular text-income">+{short(d.income)}</span>}
                {d.expense > 0 && <span className="tabular text-expense">−{short(d.expense)}</span>}
                {d.pending > 0 && <Clock aria-hidden className="size-3 text-warning" />}
              </Link>
            </li>
          );
        })}
      </ol>
      <p className="flex flex-wrap gap-x-3 gap-y-1 px-2 pb-1 pt-2 text-xs text-muted-foreground">
        <span><span className="text-income">+</span> entrou (R$)</span>
        <span><span className="text-expense">−</span> saiu (R$)</span>
        <span className="inline-flex items-center gap-1"><Clock aria-hidden className="size-3 text-warning" /> pendência</span>
      </p>
    </div>
  );
}
