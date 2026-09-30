// Dinheiro sempre em centavos inteiros. Nada aqui usa ponto flutuante para valores monetários.

export const MAX_AMOUNT_CENTS = 1_000_000_000; // R$ 10.000.000,00

export function assertCents(value: number): number {
  if (!Number.isSafeInteger(value)) throw new Error(`Valor em centavos inválido: ${value}`);
  return value;
}

/**
 * Converte texto no formato brasileiro para centavos.
 * Aceita "1234", "1234,5", "1.234,56", "R$ 1.234,56" e "1234.56" (ponto como decimal quando
 * houver exatamente 1–2 dígitos após o único ponto). Retorna null para entradas inválidas.
 */
export function parseBRL(input: string): number | null {
  let s = input.trim().replace(/^R\$\s*/i, "").replace(/\s/g, "");
  if (!s) return null;
  let negative = false;
  if (s.startsWith("-")) {
    negative = true;
    s = s.slice(1);
  }
  let intPart: string;
  let fracPart = "";
  if (s.includes(",")) {
    const [i, f, ...rest] = s.split(",");
    if (rest.length > 0) return null;
    if (!/^\d{1,3}(\.\d{3})*$|^\d*$/.test(i)) return null;
    if (!i && !f) return null;
    intPart = i.replace(/\./g, "");
    fracPart = f;
  } else if (/^\d+\.\d{1,2}$/.test(s)) {
    [intPart, fracPart] = s.split(".");
  } else if (/^\d{1,3}(\.\d{3})+$|^\d+$/.test(s)) {
    intPart = s.replace(/\./g, "");
  } else {
    return null;
  }
  if (!/^\d*$/.test(fracPart) || fracPart.length > 2) return null;
  if (intPart.length > 13) return null;
  const cents = Number(intPart || "0") * 100 + Number(fracPart.padEnd(2, "0"));
  if (!Number.isSafeInteger(cents)) return null;
  return negative ? -cents : cents;
}

const intFormatter = new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 0 });

/** Formata centavos como "R$ 1.234,56" usando apenas aritmética inteira. */
export function formatBRL(cents: number, opts: { signed?: boolean } = {}): string {
  assertCents(cents);
  const negative = cents < 0;
  const abs = Math.abs(cents);
  const reais = Math.trunc(abs / 100);
  const centavos = abs % 100;
  const body = `R$ ${intFormatter.format(reais)},${String(centavos).padStart(2, "0")}`;
  if (negative) return `−${body}`;
  if (opts.signed && cents > 0) return `+${body}`;
  return body;
}

/** Valor para campos de formulário: "1234,56" (sem símbolo, sem separador de milhar). */
export function centsToInput(cents: number): string {
  assertCents(cents);
  const abs = Math.abs(cents);
  return `${cents < 0 ? "-" : ""}${Math.trunc(abs / 100)},${String(abs % 100).padStart(2, "0")}`;
}

export function sumCents(values: Iterable<number>): number {
  let total = 0;
  for (const v of values) total += assertCents(v);
  return assertCents(total);
}

/** Percentual inteiro arredondado (ex.: 50 para 50%), sem ponto flutuante nos valores monetários. */
export function percentOf(part: number, whole: number): number | null {
  if (whole === 0) return null;
  return Math.round((part * 100) / whole);
}
