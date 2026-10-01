"use client";

import { useEffect, useState, useTransition } from "react";
import { CircleSlash } from "lucide-react";
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
import { Label } from "@/components/ui/label";
import { ensureOnline } from "@/components/pwa/ensure-online";
import { formatBRL } from "@/lib/money";
import { endSeriesAction, previewEndSeriesAction } from "@/server/actions/finance";

export function EndSeriesButton({ seriesId, description, today }: { seriesId: string; description: string; today: string }) {
  const [open, setOpen] = useState(false);
  const [date, setDate] = useState(today);
  const [preview, setPreview] = useState<{ count: number; totalCents: number } | null>(null);
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    if (!open || !date) return;
    let cancelled = false;
    previewEndSeriesAction(seriesId, date)
      .then((p) => !cancelled && setPreview(p))
      .catch(() => !cancelled && setPreview(null));
    return () => {
      cancelled = true;
    };
  }, [open, date, seriesId]);

  const run = () =>
    ensureOnline() &&
    startTransition(async () => {
      try {
        const r = await endSeriesAction(seriesId, date);
        if (r.message) (r.ok ? toast.success : toast.error)(r.message);
        if (r.ok) setOpen(false);
      } catch {
        toast.error("Não foi possível encerrar. Verifique sua conexão e tente novamente.");
      }
    });

  return (
    <AlertDialog open={open} onOpenChange={setOpen}>
      <AlertDialogTrigger asChild>
        <Button variant="destructive" disabled={pending}>
          <CircleSlash aria-hidden /> Encerrar
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Encerrar “{description}”?</AlertDialogTitle>
          <AlertDialogDescription>
            Nenhuma nova ocorrência será criada. Efetivadas e pendentes anteriores à data são mantidas.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <div className="grid gap-1.5">
          <Label htmlFor={`end-${seriesId}`}>Encerrar a partir de</Label>
          <input
            id={`end-${seriesId}`}
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="h-11 w-full rounded-lg border border-input bg-card px-3 text-base"
          />
          <p className="text-sm text-muted-foreground" aria-live="polite">
            {preview
              ? `Serão removidos ${preview.count} lançamento(s) pendente(s) com data a partir desta, somando ${formatBRL(preview.totalCents)}.`
              : "Calculando…"}
          </p>
        </div>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancelar</AlertDialogCancel>
          <Button variant="destructive" onClick={run} disabled={pending || !date || !preview}>
            Encerrar recorrência
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
