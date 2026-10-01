"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { Banknote } from "lucide-react";
import { toast } from "sonner";
import { ActionForm, Field, FormMessage, SubmitButton } from "@/components/form";
import { NativeSelect } from "@/components/native-select";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { centsToInput, formatBRL } from "@/lib/money";
import { payInvoiceAction } from "@/server/actions/cards";

/** Pagamento parcial ou total da fatura, limitado ao saldo devedor (validado também no servidor). */
export function PayInvoice({
  invoiceId,
  remainingCents,
  accounts,
  defaultAccountId,
  today,
}: {
  invoiceId: string;
  remainingCents: number;
  accounts: { id: string; name: string }[];
  defaultAccountId: string | null;
  today: string;
}) {
  const [open, setOpen] = useState(false);
  const [key, setKey] = useState(() => crypto.randomUUID());
  const [state, action] = useActionState(payInvoiceAction, { ok: false });
  const handled = useRef(state);
  const e = state.fieldErrors ?? {};

  useEffect(() => {
    if (state !== handled.current && state.ok) {
      handled.current = state;
      toast.success(state.message ?? "Pagamento registrado.");
      setOpen(false);
      setKey(crypto.randomUUID());
    }
  }, [state]);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="lg" disabled={remainingCents <= 0 || accounts.length === 0}>
          <Banknote aria-hidden />
          Pagar fatura
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Pagar fatura</DialogTitle>
          <DialogDescription>
            Saldo devedor: {formatBRL(remainingCents)}. Juros, multas e encargos não estão incluídos: informe o valor que foi pago.
          </DialogDescription>
        </DialogHeader>
        <ActionForm action={action} className="grid gap-4" offlineMessage="Sem conexão. O pagamento não foi registrado.">
          <input type="hidden" name="idempotencyKey" value={key} />
          <input type="hidden" name="invoiceId" value={invoiceId} />
          <div className="grid gap-1.5">
            <Label htmlFor="pay-account">Conta de origem</Label>
            <NativeSelect id="pay-account" name="accountId" defaultValue={defaultAccountId ?? accounts[0]?.id ?? ""} aria-invalid={e.accountId ? true : undefined}>
              {accounts.map((a) => (
                <option key={a.id} value={a.id}>{a.name}</option>
              ))}
            </NativeSelect>
            {e.accountId && <p className="text-sm font-medium text-destructive">{e.accountId}</p>}
          </div>
          <Field label="Valor pago (R$)" name="amount" inputMode="decimal" defaultValue={centsToInput(remainingCents)} error={e.amount} />
          <Field label="Data do pagamento" name="date" type="date" defaultValue={today} max={today} error={e.date} />
          <FormMessage ok={state.ok} message={state.ok ? undefined : state.message} />
          <SubmitButton size="lg" pendingLabel="Registrando…">Registrar pagamento</SubmitButton>
        </ActionForm>
      </DialogContent>
    </Dialog>
  );
}
