"use client";

import { useMemo } from "react";
import { NativeSelect } from "@/components/native-select";
import { Label } from "@/components/ui/label";
import { formatDate } from "@/lib/dates";
import { CLOSING_PREFIX, cyclesFrom, suggestCycle, type CardDays, type KnownCycle } from "@/lib/finance/cards";
import { formatBRL } from "@/lib/money";

export type KnownInvoice = KnownCycle & { id: string };

/** Fatura inicial: sugerida pela data ou outra não quitada (inclusive a seguinte, ainda não criada). */
export function useInvoiceChoice(known: KnownInvoice[], card: CardDays, date: string, chosen: string, count = 1) {
  return useMemo(() => {
    const valid = /^\d{4}-\d{2}-\d{2}$/.test(date);
    if (!valid) return null;
    const suggested = suggestCycle(date, known, card);
    const options: { value: string; label: string; closingDate: string }[] = [];
    const idOf = (c: { closingDate: string }) => known.find((k) => k.closingDate === c.closingDate)?.id ?? `${CLOSING_PREFIX}${c.closingDate}`;
    const label = (c: { dueDate: string; closingDate: string }) => `vence ${formatDate(c.dueDate)} (fecha ${formatDate(c.closingDate)})`;
    options.push({ value: "", label: `Sugerida pela data: ${label(suggested)}`, closingDate: suggested.closingDate });
    const prior = [...known].reverse().find((k) => k.closingDate < suggested.closingDate && !k.paid);
    if (prior) options.push({ value: prior.id, label: `Anterior: ${label(prior)}`, closingDate: prior.closingDate });
    for (const c of cyclesFrom(suggested, known, 4, card).slice(1)) {
      const k = known.find((x) => x.closingDate === c.closingDate);
      if (k?.paid) continue;
      options.push({ value: idOf(c), label: `${label(c)}`, closingDate: c.closingDate });
    }
    const current = known.find((k) => k.id === chosen);
    if (current && !options.some((o) => o.value === chosen)) {
      options.push({ value: current.id, label: `Atual: ${label(current)}`, closingDate: current.closingDate });
    }
    const start = options.find((o) => o.value === chosen) ?? options[0];
    const startCycle = [...known, suggested, ...cyclesFrom(suggested, known, 4, card)].find((c) => c.closingDate === start.closingDate)!;
    const installments = cyclesFrom(startCycle, known, count, card);
    return { suggested, options, installments };
  }, [known, card, date, chosen, count]);
}

export function InvoiceSelect({
  options,
  value,
  onChange,
  error,
}: {
  options: { value: string; label: string }[];
  value: string;
  onChange: (v: string) => void;
  error?: string;
}) {
  return (
    <div className="grid gap-1.5">
      <Label htmlFor="invoiceId">Fatura</Label>
      <NativeSelect id="invoiceId" name="invoiceId" value={value} onChange={(e) => onChange(e.target.value)} aria-invalid={error ? true : undefined}>
        {options.map((o) => (
          <option key={o.value || "suggested"} value={o.value}>{o.label}</option>
        ))}
      </NativeSelect>
      <p className="text-sm text-muted-foreground">
        A fatura sugerida é uma previsão manual e pode diferir da instituição. Se o banco lançou em outra fatura, escolha-a aqui.
      </p>
      {error && <p className="text-sm font-medium text-destructive">{error}</p>}
    </div>
  );
}

export function InstallmentPreview({ parts, cycles }: { parts: number[] | null; cycles: { dueDate: string }[] }) {
  if (!parts) {
    return <p className="text-sm font-medium text-destructive">O valor não permite essa quantidade de parcelas</p>;
  }
  return (
    <div className="grid gap-1.5">
      <p className="text-sm font-medium">Prévia {parts.length > 1 ? "das parcelas" : "da cobrança"}</p>
      <ol aria-label="Prévia das parcelas" className="max-h-56 divide-y overflow-auto rounded-lg bg-muted/50 text-sm">
        {parts.map((cents, i) => (
          <li key={i} className="flex items-center justify-between gap-3 px-3 py-1.5">
            <span>{parts.length > 1 ? `Parcela ${i + 1}/${parts.length}` : "À vista"} · vence {cycles[i] ? formatDate(cycles[i].dueDate) : "—"}</span>
            <span className="tabular font-medium">{formatBRL(cents)}</span>
          </li>
        ))}
      </ol>
    </div>
  );
}
