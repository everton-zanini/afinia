import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import { todayISO } from "@/lib/dates";
import { getHouseholdContext } from "@/server/households/context";
import { transactionsToCsv } from "@/server/finance/export";
import { listTransactions } from "@/server/finance/transactions";
import { parseListParams } from "../params";

// Exporta exatamente os lançamentos do filtro, sempre do casal da sessão. Nunca cacheado.
export async function GET(request: Request) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session || session.user.mustChangePassword) return new Response("Não autorizado", { status: 401 });
  const ctx = await getHouseholdContext(session.user.id);
  if (!ctx) return new Response("Não encontrado", { status: 404 });

  const url = new URL(request.url);
  const { filters } = parseListParams(Object.fromEntries(url.searchParams));
  const rows = await listTransactions(ctx, filters, { limit: 50_000 });
  return new Response(transactionsToCsv(rows), {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="afinia-lancamentos-${todayISO()}.csv"`,
      "Cache-Control": "private, no-store",
    },
  });
}
