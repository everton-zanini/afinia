// Datas de calendário como "YYYY-MM-DD". Nunca dependem do fuso do servidor ou do navegador.

export const APP_TIME_ZONE = "America/Sao_Paulo";

const ISO_DATE = /^(\d{4})-(\d{2})-(\d{2})$/;
const ISO_MONTH = /^(\d{4})-(0[1-9]|1[0-2])$/;

export type ISODate = string; // YYYY-MM-DD
export type ISOMonth = string; // YYYY-MM

export function isISODate(value: string): value is ISODate {
  const m = ISO_DATE.exec(value);
  if (!m) return false;
  const [y, mo, d] = [Number(m[1]), Number(m[2]), Number(m[3])];
  const date = new Date(Date.UTC(y, mo - 1, d));
  return date.getUTCFullYear() === y && date.getUTCMonth() === mo - 1 && date.getUTCDate() === d;
}

export function isISOMonth(value: string): value is ISOMonth {
  return ISO_MONTH.test(value);
}

/** Data de hoje no fuso do aplicativo. */
export function todayISO(now: Date = new Date(), timeZone = APP_TIME_ZONE): ISODate {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(now);
  const get = (t: string) => parts.find((p) => p.type === t)!.value;
  return `${get("year")}-${get("month")}-${get("day")}`;
}

/** Converte "YYYY-MM-DD" para o Date usado pelo Prisma em colunas @db.Date (meia-noite UTC). */
export function toDbDate(iso: ISODate): Date {
  if (!isISODate(iso)) throw new Error(`Data inválida: ${iso}`);
  return new Date(`${iso}T00:00:00.000Z`);
}

export function fromDbDate(date: Date): ISODate {
  return date.toISOString().slice(0, 10);
}

export function monthOf(iso: ISODate): ISOMonth {
  return iso.slice(0, 7);
}

export function currentMonth(now: Date = new Date()): ISOMonth {
  return monthOf(todayISO(now));
}

export function addMonths(month: ISOMonth, delta: number): ISOMonth {
  const [y, m] = month.split("-").map(Number);
  const idx = y * 12 + (m - 1) + delta;
  const ny = Math.floor(idx / 12);
  const nm = (idx % 12) + 1;
  return `${String(ny).padStart(4, "0")}-${String(nm).padStart(2, "0")}`;
}

export function monthRange(month: ISOMonth): { from: ISODate; to: ISODate } {
  const [y, m] = month.split("-").map(Number);
  const last = new Date(Date.UTC(y, m, 0)).getUTCDate();
  return { from: `${month}-01`, to: `${month}-${String(last).padStart(2, "0")}` };
}

export function addDays(iso: ISODate, delta: number): ISODate {
  const d = toDbDate(iso);
  d.setUTCDate(d.getUTCDate() + delta);
  return fromDbDate(d);
}

const MONTHS = [
  "janeiro", "fevereiro", "março", "abril", "maio", "junho",
  "julho", "agosto", "setembro", "outubro", "novembro", "dezembro",
];
const MONTHS_SHORT = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];
const WEEKDAYS = ["domingo", "segunda", "terça", "quarta", "quinta", "sexta", "sábado"];

export function formatMonthLong(month: ISOMonth): string {
  const [y, m] = month.split("-").map(Number);
  return `${MONTHS[m - 1]} de ${y}`;
}

export function formatMonthShort(month: ISOMonth): string {
  const [y, m] = month.split("-").map(Number);
  return `${MONTHS_SHORT[m - 1]}/${String(y).slice(2)}`;
}

/** "31/03/2026" */
export function formatDate(iso: ISODate): string {
  const [y, m, d] = iso.split("-");
  return `${d}/${m}/${y}`;
}

/** "terça, 31 de março" */
export function formatDayHeading(iso: ISODate): string {
  const [y, m, d] = iso.split("-").map(Number);
  const weekday = WEEKDAYS[new Date(Date.UTC(y, m - 1, d)).getUTCDay()];
  return `${weekday}, ${d} de ${MONTHS[m - 1]}`;
}

/** Dia da semana (0 = domingo) de uma data de calendário. */
export function weekdayOf(iso: ISODate): number {
  return toDbDate(iso).getUTCDay();
}
