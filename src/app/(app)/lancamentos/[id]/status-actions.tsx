"use client";

import { useState, useTransition } from "react";
import { CheckCircle2, Undo2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { markEffectiveAction, markPendingAction } from "@/server/actions/finance";
import { ensureOnline } from "@/components/pwa/ensure-online";

export function StatusActions({
  id,
  status,
  kind,
  today,
}: {
  id: string;
  status: "PENDING" | "EFFECTIVE";
  kind: "INCOME" | "EXPENSE" | "TRANSFER";
  today: string;
}) {
  const [date, setDate] = useState(today);
  const [pending, startTransition] = useTransition();
  const verb = kind === "INCOME" ? "recebido" : kind === "TRANSFER" ? "feita" : "pago";

  const run = (fn: () => Promise<{ ok: boolean; message?: string }>) =>
    ensureOnline() &&
    startTransition(async () => {
      try {
        const r = await fn();
        if (r.message) (r.ok ? toast.success : toast.error)(r.message);
      } catch {
        toast.error("Não foi possível salvar. Verifique sua conexão e tente novamente.");
      }
    });

  if (status === "EFFECTIVE") {
    return (
      <Button variant="ghost" disabled={pending} onClick={() => run(() => markPendingAction(id))}>
        <Undo2 aria-hidden />
        Voltar para pendente
      </Button>
    );
  }
  return (
    <section className="grid gap-3 rounded-2xl bg-card p-4 ring-1 ring-border">
      <div className="grid gap-1.5">
        <Label htmlFor="paid-date">Data em que foi {verb}</Label>
        <input
          id="paid-date"
          type="date"
          value={date}
          onChange={(e) => setDate(e.target.value)}
          className="h-11 w-full rounded-lg border border-input bg-card px-3 text-base"
        />
      </div>
      <Button size="lg" disabled={pending || !date} onClick={() => run(() => markEffectiveAction(id, date))}>
        <CheckCircle2 aria-hidden />
        Marcar como {verb}
      </Button>
    </section>
  );
}
