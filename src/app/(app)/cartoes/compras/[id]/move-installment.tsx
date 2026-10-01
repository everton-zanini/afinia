"use client";

import { useState, useTransition } from "react";
import { MoveRight } from "lucide-react";
import { toast } from "sonner";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { NativeSelect } from "@/components/native-select";
import { Label } from "@/components/ui/label";
import { ensureOnline } from "@/components/pwa/ensure-online";
import { moveInstallmentAction } from "@/server/actions/cards";

/** Remanejar uma parcela para outra fatura sem pagamentos do mesmo cartão. */
export function MoveInstallment({
  installmentId,
  label,
  currentInvoiceId,
  options,
}: {
  installmentId: string;
  label: string;
  currentInvoiceId: string;
  options: { id: string; label: string }[];
}) {
  const targets = options.filter((o) => o.id !== currentInvoiceId);
  const [target, setTarget] = useState(targets[0]?.id ?? "");
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const run = () =>
    ensureOnline() &&
    startTransition(async () => {
      try {
        const r = await moveInstallmentAction(installmentId, target);
        if (r.message) (r.ok ? toast.success : toast.error)(r.message);
        if (r.ok) setOpen(false);
      } catch {
        toast.error("Não foi possível concluir. Verifique sua conexão e tente novamente.");
      }
    });
  return (
    <AlertDialog open={open} onOpenChange={setOpen}>
      <AlertDialogTrigger asChild>
        <Button variant="outline" size="sm" disabled={targets.length === 0} aria-label={`Remanejar ${label}`}>
          <MoveRight aria-hidden />
          Mover
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Remanejar {label}</AlertDialogTitle>
          <AlertDialogDescription>
            A parcela passa para a fatura escolhida e os totais das duas faturas são atualizados. Só é possível entre faturas sem pagamentos.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <div className="grid gap-1.5">
          <Label htmlFor={`move-${installmentId}`}>Fatura de destino</Label>
          <NativeSelect id={`move-${installmentId}`} value={target} onChange={(e) => setTarget(e.target.value)}>
            {targets.map((t) => (
              <option key={t.id} value={t.id}>{t.label}</option>
            ))}
          </NativeSelect>
        </div>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancelar</AlertDialogCancel>
          <Button onClick={run} disabled={pending || !target}>Remanejar</Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
