import { currentMonth, isISODate, isISOMonth, monthRange, type ISOMonth } from "@/lib/dates";
import { transactionFiltersSchema, type TransactionFilters } from "@/lib/validation/finance";

type Raw = Record<string, string | string[] | undefined>;

const first = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) || undefined;

export type ListParams = {
  filters: TransactionFilters;
  month: ISOMonth | null;
  raw: Record<string, string>;
};

/**
 * Parâmetros da URL (em português) → filtros do serviço. Período padrão: mês atual.
 * `de`/`ate` substituem o mês. Nenhum parâmetro identifica o casal: isso vem sempre da sessão.
 */
export function parseListParams(sp: Raw): ListParams {
  const raw: Record<string, string> = {};
  for (const key of ["mes", "de", "ate", "q", "categoria", "conta", "situacao", "tipo", "pessoa"]) {
    const v = first(sp[key]);
    if (v) raw[key] = v;
  }
  let month: ISOMonth | null = null;
  let from: string | undefined;
  let to: string | undefined;
  if ((raw.de && isISODate(raw.de)) || (raw.ate && isISODate(raw.ate))) {
    from = raw.de && isISODate(raw.de) ? raw.de : undefined;
    to = raw.ate && isISODate(raw.ate) ? raw.ate : undefined;
  } else if (raw.mes !== "todos") {
    month = raw.mes && isISOMonth(raw.mes) ? raw.mes : currentMonth();
    ({ from, to } = monthRange(month));
  }
  const filters = transactionFiltersSchema.parse({
    from,
    to,
    q: raw.q,
    categoryId: raw.categoria,
    accountId: raw.conta,
    status: raw.situacao === "pendente" ? "PENDING" : raw.situacao === "efetivado" ? "EFFECTIVE" : undefined,
    kind: raw.tipo === "receita" ? "INCOME" : raw.tipo === "despesa" ? "EXPENSE" : raw.tipo === "transferencia" ? "TRANSFER" : undefined,
    memberId: raw.pessoa,
  });
  return { filters, month, raw };
}

export function toQuery(raw: Record<string, string>, patch: Record<string, string | null> = {}) {
  const params = new URLSearchParams();
  for (const [k, v] of Object.entries({ ...raw, ...patch })) if (v) params.set(k, v);
  const s = params.toString();
  return s ? `?${s}` : "";
}
