"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { Check, SkipForward } from "lucide-react";
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
import { ensureOnline } from "@/components/pwa/ensure-online";
import { skipForecastAction } from "@/server/actions/cards";

/** Previsão de cobrança recorrente: confirmar (revisando valor/data/fatura) ou pular. Não há "pagar" aqui. */
export function ForecastActions({ id, cardId, archived, description }: { id: string; cardId: string; archived: boolean; description: string }) {
  const [scope, setScope] = useState<"only" | "following">("only");
  const [pending, startTransition] = useTransition();
  const run = () =>
    ensureOnline() &&
    startTransition(async () => {
      try {
        const r = await skipForecastAction(id, scope);
        if (r.message) (r.ok ? toast.success : toast.error)(r.message);
      } catch {
        toast.error("Não foi possível concluir. Verifique sua conexão e tente novamente.");
      }
    });
  return (
    <div className="flex flex-wrap gap-2">
      {!archived && (
        <Button asChild size="sm">
          <Link href={`/cartoes/${cardId}/compra?previsao=${id}`} aria-label={`Confirmar cobrança ${description}`}>
            <Check aria-hidden />
            Confirmar
          </Link>
        </Button>
      )}
      <AlertDialog>
        <AlertDialogTrigger asChild>
          <Button size="sm" variant="outline" disabled={pending} aria-label={`Pular cobrança ${description}`}>
            <SkipForward aria-hidden />
            Pular
          </Button>
        </AlertDialogTrigger>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Pular “{description}”?</AlertDialogTitle>
            <AlertDialogDescription>Cobranças já confirmadas são sempre preservadas.</AlertDialogDescription>
          </AlertDialogHeader>
          <fieldset className="grid gap-2">
            <legend className="sr-only">O que pular</legend>
            <label className="flex cursor-pointer items-start gap-3 rounded-lg p-3 ring-1 ring-border has-[:checked]:ring-2 has-[:checked]:ring-primary">
              <input type="radio" name="skip-scope" checked={scope === "only"} onChange={() => setScope("only")} className="mt-1 size-4" />
              <span>
                <span className="block font-medium">Só este mês</span>
                <span className="block text-sm text-muted-foreground">Esta cobrança não volta a ser prevista; as demais continuam.</span>
              </span>
            </label>
            <label className="flex cursor-pointer items-start gap-3 rounded-lg p-3 ring-1 ring-border has-[:checked]:ring-2 has-[:checked]:ring-primary">
              <input type="radio" name="skip-scope" checked={scope === "following"} onChange={() => setScope("following")} className="mt-1 size-4" />
              <span>
                <span className="block font-medium">Este e os próximos</span>
                <span className="block text-sm text-muted-foreground">Encerra a recorrência a partir daqui e remove as previsões seguintes.</span>
              </span>
            </label>
          </fieldset>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <Button onClick={run} disabled={pending}>Pular</Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
