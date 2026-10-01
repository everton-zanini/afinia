// Regras puras de cartões de crédito: ciclos de fatura, parcelas, situação e limite.
// Sem acesso a banco ou interface. Datas de calendário "YYYY-MM-DD"; valores em centavos.
import { addDays, type ISODate } from "@/lib/dates";
import { assertCents } from "@/lib/money";

export const MAX_INSTALLMENTS = 48;

/** Valor de `invoiceId` para uma fatura que ainda não existe: "closing:AAAA-MM-DD" (fechamento do ciclo). */
export const CLOSING_PREFIX = "closing:";

function ym(iso: ISODate) {
  const [y, m] = iso.split("-").map(Number);
  return { y, m };
}

/** Dia configurado limitado ao último dia do mês (o dia de referência nunca muda). */
export function clampDay(year: number, month: number, day: number): ISODate {
  const idx = year * 12 + (month - 1);
  const y = Math.floor(idx / 12);
  const m = (idx % 12) + 1;
  const last = new Date(Date.UTC(y, m, 0)).getUTCDate();
  return `${String(y).padStart(4, "0")}-${String(m).padStart(2, "0")}-${String(Math.min(day, last)).padStart(2, "0")}`;
}

function clampInMonthOf(iso: ISODate, offsetMonths: number, day: number) {
  const { y, m } = ym(iso);
  return clampDay(y, m + offsetMonths, day);
}

/** Vencimento: primeira ocorrência do dia configurado estritamente posterior ao fechamento. */
export function dueDateFor(closingDate: ISODate, dueDay: number): ISODate {
  const sameMonth = clampInMonthOf(closingDate, 0, dueDay);
  return sameMonth > closingDate ? sameMonth : clampInMonthOf(closingDate, 1, dueDay);
}

export type Cycle = { periodStart: ISODate; closingDate: ISODate; dueDate: ISODate };
export type CardDays = { closingDay: number; dueDay: number };

/** Primeira fatura de um cartão: o ciclo que contém `date`, pela configuração atual. */
export function cycleContaining(date: ISODate, card: CardDays): Cycle {
  let closingDate = clampInMonthOf(date, 0, card.closingDay);
  if (date > closingDate) closingDate = clampInMonthOf(date, 1, card.closingDay);
  const periodStart = addDays(clampInMonthOf(closingDate, -1, card.closingDay), 1);
  return { periodStart, closingDate, dueDate: dueDateFor(closingDate, card.dueDay) };
}

/** Fatura seguinte a uma já gravada: começa no dia após o fechamento e fecha no mês seguinte. */
export function nextCycle(prev: Pick<Cycle, "closingDate">, card: CardDays): Cycle {
  const closingDate = clampInMonthOf(prev.closingDate, 1, card.closingDay);
  return { periodStart: addDays(prev.closingDate, 1), closingDate, dueDate: dueDateFor(closingDate, card.dueDay) };
}

/** Fatura anterior à primeira gravada: termina no dia anterior ao início dela. */
export function previousCycle(first: Pick<Cycle, "periodStart">, card: CardDays): Cycle {
  const closingDate = addDays(first.periodStart, -1);
  let periodStart = addDays(clampInMonthOf(closingDate, -1, card.closingDay), 1);
  if (periodStart > closingDate) periodStart = closingDate;
  return { periodStart, closingDate, dueDate: dueDateFor(closingDate, card.dueDay) };
}

/**
 * Divide o total em parcelas de centavos exatos: quociente inteiro para todas e os centavos
 * restantes, um a um, nas primeiras. Retorna null se alguma parcela seria zero.
 */
export function splitInstallments(totalCents: number, count: number): number[] | null {
  assertCents(totalCents);
  if (!Number.isInteger(count) || count < 1 || count > MAX_INSTALLMENTS || totalCents <= 0) return null;
  const q = Math.floor(totalCents / count);
  if (q === 0) return null;
  const r = totalCents - q * count;
  return Array.from({ length: count }, (_, i) => (i < r ? q + 1 : q));
}

export type InvoiceStatus = {
  cycle: "open" | "closed";
  /** empty: sem compras (nunca devida nem vencida). */
  payment: "empty" | "open" | "partial" | "paid";
  overdue: boolean;
  totalCents: number;
  paidCents: number;
  remainingCents: number;
};

/** Situação calculada na consulta (sem tarefa agendada). */
export function invoiceStatus(
  invoice: Pick<Cycle, "closingDate" | "dueDate">,
  totalCents: number,
  paidCents: number,
  today: ISODate,
): InvoiceStatus {
  const remainingCents = totalCents - paidCents;
  const payment = totalCents === 0 ? "empty" : paidCents === 0 ? "open" : remainingCents > 0 ? "partial" : "paid";
  return {
    cycle: today <= invoice.closingDate ? "open" : "closed",
    payment,
    overdue: invoice.dueDate < today && remainingCents > 0,
    totalCents,
    paidCents,
    remainingCents,
  };
}

export type LimitView = {
  limitCents: number;
  /** Σ parcelas confirmadas (inclusive futuras) − Σ pagamentos das faturas do cartão. */
  committedCents: number;
  availableCents: number;
  over: boolean;
};

/** Limite estimado: previsões de recorrência e saldos de contas não entram. */
export function limitView(limitCents: number, installmentsCents: number, paymentsCents: number): LimitView {
  const committedCents = installmentsCents - paymentsCents;
  const availableCents = limitCents - committedCents;
  return { limitCents, committedCents, availableCents, over: availableCents < 0 };
}

export const PAYMENT_STATUS_LABEL: Record<InvoiceStatus["payment"], string> = {
  empty: "Sem compras",
  open: "Em aberto",
  partial: "Parcial",
  paid: "Quitada",
};

const MAX_CYCLE_STEPS = 600;

/**
 * Faturas que faltam criar para existir uma que contenha `date`, a partir das já gravadas
 * (ou a primeira pela configuração atual). O último elemento é a que contém a data.
 */
export function cyclesNeededFor(
  date: ISODate,
  bounds: { first: Cycle | null; last: Cycle | null },
  card: CardDays,
): Cycle[] {
  const { first, last } = bounds;
  if (!first || !last) return [cycleContaining(date, card)];
  const cycles: Cycle[] = [];
  if (date > last.closingDate) {
    let prev = last;
    for (let i = 0; i < MAX_CYCLE_STEPS; i++) {
      prev = nextCycle(prev, card);
      cycles.push(prev);
      if (prev.closingDate >= date) break;
    }
  } else if (date < first.periodStart) {
    let next = first;
    for (let i = 0; i < MAX_CYCLE_STEPS; i++) {
      next = previousCycle(next, card);
      cycles.push(next);
      if (next.periodStart <= date) break;
    }
  }
  return cycles;
}

export type KnownCycle = Cycle & { paid: boolean };

/** Fatura sugerida para a data (a do ciclo ou a próxima, se aquela já estiver quitada), sem gravar nada. */
export function suggestCycle(date: ISODate, known: KnownCycle[], card: CardDays): Cycle {
  const sorted = [...known].sort((a, b) => a.closingDate.localeCompare(b.closingDate));
  const containing = sorted.find((c) => c.periodStart <= date && date <= c.closingDate);
  let current: KnownCycle | Cycle =
    containing ??
    cyclesNeededFor(date, { first: sorted[0] ?? null, last: sorted.at(-1) ?? null }, card).at(-1)!;
  for (let i = 0; i < 60; i++) {
    const paid = "paid" in current && current.paid;
    if (!paid) return current;
    current = sorted.find((c) => c.periodStart > current.closingDate) ?? nextCycle(current, card);
    if (!("paid" in current)) return current;
  }
  return current;
}

/** As `n` faturas que começam em `start` (inclusive), usando as já gravadas e criando as demais pela regra. */
export function cyclesFrom(start: Cycle, known: Cycle[], n: number, card: CardDays): Cycle[] {
  const out: Cycle[] = [start];
  const sorted = [...known].sort((a, b) => a.closingDate.localeCompare(b.closingDate));
  while (out.length < n) {
    const prev = out[out.length - 1];
    out.push(sorted.find((c) => c.closingDate > prev.closingDate) ?? nextCycle(prev, card));
  }
  return out;
}
