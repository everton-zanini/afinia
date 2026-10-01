"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { formatBRL } from "@/lib/money";

// Gráficos recebem dados já agregados no servidor. A alternativa textual é renderizada
// fora deles (tabela/lista), então os SVGs têm só um rótulo resumido.

const money = (v: unknown) => (typeof v === "number" ? formatBRL(v) : String(v ?? ""));
const compactReais = (cents: number) => {
  const reais = Math.round(cents / 100);
  if (Math.abs(reais) >= 1000) return `${Math.round(reais / 100) / 10}k`.replace(".", ",");
  return String(reais);
};

const tooltipStyle = {
  contentStyle: {
    borderRadius: 12,
    border: "1px solid var(--border)",
    background: "var(--card)",
    color: "var(--foreground)",
    fontSize: 14,
  },
  labelStyle: { fontWeight: 600, marginBottom: 4 },
};

export function CategoryDonut({
  data,
  totalLabel,
  label,
}: {
  data: { name: string; value: number; fill: string }[];
  totalLabel: string;
  label: string;
}) {
  return (
    <figure className="relative mx-auto h-60 w-full max-w-64" aria-label={label} role="img">
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie
            data={data}
            dataKey="value"
            nameKey="name"
            innerRadius="62%"
            outerRadius="98%"
            paddingAngle={data.length > 1 ? 2 : 0}
            stroke="var(--card)"
            strokeWidth={2}
            isAnimationActive
            animationDuration={500}
          />
          <Tooltip formatter={money} {...tooltipStyle} />
        </PieChart>
      </ResponsiveContainer>
      <figcaption className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center text-center">
        <span className="text-xs text-muted-foreground">Total</span>
        <span className="text-lg font-semibold tabular">{totalLabel}</span>
      </figcaption>
    </figure>
  );
}

export function IncomeExpenseBars({
  data,
  label,
}: {
  data: { label: string; Receitas: number; "Créditos de benefício"?: number; Despesas: number }[];
  label: string;
}) {
  return (
    <div role="img" aria-label={label} className="h-64 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 8, right: 4, left: -4, bottom: 0 }} barGap={2}>
          <CartesianGrid vertical={false} stroke="var(--border)" />
          <XAxis dataKey="label" tickLine={false} axisLine={false} fontSize={12} />
          <YAxis tickFormatter={compactReais} tickLine={false} axisLine={false} fontSize={12} width={52} />
          <Tooltip formatter={money} cursor={{ fill: "var(--muted)" }} {...tooltipStyle} />
          <Legend iconType="circle" wrapperStyle={{ fontSize: 13 }} />
          <Bar dataKey="Receitas" fill="var(--income)" radius={[4, 4, 0, 0]} maxBarSize={22} />
          {data.some((d) => (d["Créditos de benefício"] ?? 0) > 0) && (
            <Bar dataKey="Créditos de benefício" fill="var(--chart-2)" radius={[4, 4, 0, 0]} maxBarSize={22} />
          )}
          <Bar dataKey="Despesas" fill="var(--expense)" radius={[4, 4, 0, 0]} maxBarSize={22} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

export function BalanceLine({
  data,
  openingCents,
  label,
}: {
  data: { label: string; Saldo: number }[];
  openingCents: number;
  label: string;
}) {
  return (
    <div role="img" aria-label={label} className="h-64 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 8, right: 8, left: -4, bottom: 0 }}>
          <CartesianGrid vertical={false} stroke="var(--border)" />
          <XAxis dataKey="label" tickLine={false} axisLine={false} fontSize={12} interval="preserveStartEnd" minTickGap={24} />
          <YAxis tickFormatter={compactReais} tickLine={false} axisLine={false} fontSize={12} width={52} domain={["auto", "auto"]} />
          <Tooltip formatter={money} {...tooltipStyle} />
          <ReferenceLine y={openingCents} stroke="var(--muted-foreground)" strokeDasharray="4 4" />
          <Line type="stepAfter" dataKey="Saldo" stroke="var(--primary)" strokeWidth={2.5} dot={false} activeDot={{ r: 5 }} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

/** Compromissos por mês de vencimento das próximas faturas (a tabela textual fica fora do gráfico). */
export function FutureInvoicesBars({ data, label }: { data: { label: string; Compromisso: number }[]; label: string }) {
  return (
    <div role="img" aria-label={label} className="h-52 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 8, right: 4, left: -4, bottom: 0 }}>
          <CartesianGrid vertical={false} stroke="var(--border)" />
          <XAxis dataKey="label" tickLine={false} axisLine={false} fontSize={12} />
          <YAxis tickFormatter={compactReais} tickLine={false} axisLine={false} fontSize={12} width={52} />
          <Tooltip formatter={money} cursor={{ fill: "var(--muted)" }} {...tooltipStyle} />
          <Bar dataKey="Compromisso" fill="var(--chart-2)" radius={[4, 4, 0, 0]} maxBarSize={28} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
