"use client";

import { useRouter } from "next/navigation";
import { NativeSelect } from "@/components/native-select";
import { Label } from "@/components/ui/label";

/** Atalho para qualquer fatura do cartão (além de anterior/próxima). */
export function InvoicePicker({
  cardId,
  selectedId,
  options,
}: {
  cardId: string;
  selectedId: string;
  options: { id: string; label: string }[];
}) {
  const router = useRouter();
  return (
    <div className="grid gap-1.5">
      <Label htmlFor="invoice-picker" className="sr-only">Escolher fatura</Label>
      <NativeSelect id="invoice-picker" value={selectedId} onChange={(e) => router.push(`/cartoes/${cardId}?fatura=${e.target.value}`)}>
        {options.map((o) => (
          <option key={o.id} value={o.id}>{o.label}</option>
        ))}
      </NativeSelect>
    </div>
  );
}
