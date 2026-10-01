// Regras puras de recorrência: datas, término, janela de geração e contagens.
// Sem acesso a banco ou interface. Posição (índice) 0 = primeira ocorrência.
import { addDays, type ISODate } from "@/lib/dates";

export type Frequency = "WEEKLY" | "MONTHLY" | "YEARLY";
export type EndMode = "COUNT" | "UNTIL" | "NONE";

export const MIN_OCCURRENCES = 2;
export const MAX_OCCURRENCES = 600;
export const MAX_YEARS = 30;
export const WINDOW_MONTHS = 12;

export type Schedule = {
  startDate: ISODate;
  frequency: Frequency;
  endMode: EndMode;
  occurrenceCount: number | null;
  untilDate: ISODate | null;
  /** "Excluir este e os próximos": a programação termina antes desta posição. */
  stopBeforeIndex: number | null;
  /** "Encerrar recorrência": nenhuma posição com data prevista ≥ esta data. */
  stoppedOn: ISODate | null;
};

function parts(iso: ISODate) {
  const [y, m, d] = iso.split("-").map(Number);
  return { y, m, d };
}

function lastDayOfMonth(y: number, m: number) {
  return new Date(Date.UTC(y, m, 0)).getUTCDate();
}

function fmt(y: number, m: number, d: number): ISODate {
  return `${String(y).padStart(4, "0")}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}

/** Soma meses de calendário mantendo o dia de referência, limitado ao último dia do mês. */
export function addCalendarMonths(iso: ISODate, months: number, referenceDay?: number): ISODate {
  const { y, m, d } = parts(iso);
  const idx = y * 12 + (m - 1) + months;
  const ny = Math.floor(idx / 12);
  const nm = (idx % 12) + 1;
  return fmt(ny, nm, Math.min(referenceDay ?? d, lastDayOfMonth(ny, nm)));
}

/** Data prevista original da posição `index`. O dia de referência é sempre o da primeira ocorrência. */
export function scheduledDate(startDate: ISODate, frequency: Frequency, index: number): ISODate {
  if (frequency === "WEEKLY") return addDays(startDate, 7 * index);
  const day = parts(startDate).d;
  return addCalendarMonths(startDate, frequency === "MONTHLY" ? index : 12 * index, day);
}

/** Limite da janela de geração: hoje + 12 meses de calendário, inclusive. */
export function horizon(today: ISODate): ISODate {
  return addCalendarMonths(today, WINDOW_MONTHS);
}

const SEARCH_CAP = 100_000;

/** Maior índice cuja data prevista satisfaz `ok` (datas crescem com o índice); -1 se nenhum. */
function lastIndexWhere(s: Pick<Schedule, "startDate" | "frequency">, ok: (date: ISODate) => boolean) {
  if (!ok(scheduledDate(s.startDate, s.frequency, 0))) return -1;
  // Busca exponencial + binária sobre datas monotônicas.
  let lo = 0;
  let hi = 1;
  while (hi < SEARCH_CAP && ok(scheduledDate(s.startDate, s.frequency, hi))) {
    lo = hi;
    hi *= 2;
  }
  if (hi >= SEARCH_CAP) return SEARCH_CAP;
  while (hi - lo > 1) {
    const mid = Math.floor((lo + hi) / 2);
    if (ok(scheduledDate(s.startDate, s.frequency, mid))) lo = mid;
    else hi = mid;
  }
  return lo;
}

/** Última posição do fim lógico da programação (Infinity = sem término). */
export function lastLogicalIndex(s: Schedule): number {
  let last = Infinity;
  if (s.endMode === "COUNT" && s.occurrenceCount) last = s.occurrenceCount - 1;
  if (s.endMode === "UNTIL" && s.untilDate) last = lastIndexWhere(s, (d) => d <= s.untilDate!);
  if (s.stopBeforeIndex !== null) last = Math.min(last, s.stopBeforeIndex - 1);
  if (s.stoppedOn) last = Math.min(last, lastIndexWhere(s, (d) => d < s.stoppedOn!));
  return last;
}

/** Posições a materializar a partir de `fromIndex`, até o fim lógico e o horizonte (inclusive). */
export function positionsToGenerate(s: Schedule, horizonDate: ISODate, fromIndex: number): number[] {
  const last = Math.min(lastLogicalIndex(s), lastIndexWhere(s, (d) => d <= horizonDate));
  const out: number[] = [];
  for (let i = Math.max(0, fromIndex); i <= last; i++) out.push(i);
  return out;
}

export type RuleLike = { fromIndex: number };

/** Regra vigente de uma posição: a de maior `fromIndex` ≤ posição. */
export function ruleFor<T extends RuleLike>(rules: T[], index: number): T {
  let best: T | undefined;
  for (const r of rules) if (r.fromIndex <= index && (!best || r.fromIndex > best.fromIndex)) best = r;
  if (!best) throw new Error(`Sem regra para a posição ${index}`);
  return best;
}

const FREQ_LABEL: Record<Frequency, string> = { WEEKLY: "semanal", MONTHLY: "mensal", YEARLY: "anual" };

export function frequencyLabel(f: Frequency) {
  return FREQ_LABEL[f];
}

/** "Ocorrência 3 de 12" para séries com N ocorrências; "Recorrente · mensal" nas demais. */
export function positionLabel(index: number, s: Pick<Schedule, "endMode" | "occurrenceCount" | "frequency">) {
  if (s.endMode === "COUNT" && s.occurrenceCount) return `Ocorrência ${index + 1} de ${s.occurrenceCount}`;
  return `Recorrente · ${FREQ_LABEL[s.frequency]}`;
}

export type OccurrenceState = { index: number; status: "PENDING" | "EFFECTIVE"; amountCents: number };

export type SeriesSummary = {
  programming: "active" | "ended";
  pendingCount: number;
  pendingCents: number;
  /** Somente para término após N ocorrências: posições do fim lógico ainda não geradas. */
  toGenerate: number | null;
};

/**
 * Situação da série. Pendentes contam só lançamentos existentes (exclusões não aparecem como
 * devidas); "previstas para geração" são posições ainda não avaliadas dentro do fim lógico.
 */
export function summarize(
  s: Schedule,
  occurrences: OccurrenceState[],
  exceptions: Set<number>,
  generatedThroughIndex: number,
): SeriesSummary {
  const last = lastLogicalIndex(s);
  const pending = occurrences.filter((o) => o.status === "PENDING");
  let toGenerate: number | null = null;
  if (s.endMode === "COUNT" && Number.isFinite(last)) {
    let n = 0;
    for (let i = generatedThroughIndex + 1; i <= last; i++) if (!exceptions.has(i)) n++;
    toGenerate = n;
  }
  const ended = s.stopBeforeIndex !== null || s.stoppedOn !== null || (Number.isFinite(last) && generatedThroughIndex >= last);
  return {
    programming: ended ? "ended" : "active",
    pendingCount: pending.length,
    pendingCents: pending.reduce((sum, o) => sum + o.amountCents, 0),
    toGenerate,
  };
}

/** Validação do término na criação. Retorna mensagem de erro ou null. */
export function validateEnd(s: Pick<Schedule, "startDate" | "endMode" | "occurrenceCount" | "untilDate">): string | null {
  if (s.endMode === "COUNT") {
    const n = s.occurrenceCount ?? 0;
    if (!Number.isInteger(n) || n < MIN_OCCURRENCES || n > MAX_OCCURRENCES) {
      return `Informe de ${MIN_OCCURRENCES} a ${MAX_OCCURRENCES} ocorrências`;
    }
  }
  if (s.endMode === "UNTIL") {
    if (!s.untilDate || s.untilDate <= s.startDate) return "A data final deve ser posterior à primeira ocorrência";
    if (s.untilDate > addCalendarMonths(s.startDate, 12 * MAX_YEARS)) return `A data final pode ser no máximo ${MAX_YEARS} anos depois`;
  }
  return null;
}
