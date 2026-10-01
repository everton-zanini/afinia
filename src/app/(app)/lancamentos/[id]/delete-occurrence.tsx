"use client";

import { useState, useTransition } from "react";
import { Trash2 } from "lucide-react";
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
import { formatBRL } from "@/lib/money";
import { deleteOccurrenceAction, previewDeleteFollowingAction } from "@/server/actions/finance";

/** Exclusão de ocorrência com escolha de escopo e prévia do que "Este e os próximos" remove. */
export function DeleteOccurrence({ id, description }: { id: string; description: string }) {
  const [scope, setScope] = useState<"only" | "following">("only");
  const [preview, setPreview] = useState<{ count: number; totalCents: number } | null>(null);
  const [pending, startTransition] = useTransition();

  const loadPreview = () =>
    startTransition(async () => {
      try {
        setPreview(await previewDeleteFollowingAction(id));
      } catch {
        setPreview(null);
      }
    });

  const run = () =>
    ensureOnline() &&
    startTransition(async () => {
      try {
        const r = await deleteOccurrenceAction(id, scope);
        if (r?.message) toast.error(r.message);
      } catch {
        toast.error("Não foi possível excluir. Verifique sua conexão e tente novamente.");
      }
    });

  return (
    <AlertDialog onOpenChange={(open) => open && loadPreview()}>
      <AlertDialogTrigger asChild>
        <Button variant="destructive" className="col-span-2" disabled={pending}>
          <Trash2 aria-hidden />
          Excluir
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Excluir “{description}”?</AlertDialogTitle>
          <AlertDialogDescription>Este lançamento faz parte de uma recorrência. Lançamentos já efetivados são sempre preservados.</AlertDialogDescription>
        </AlertDialogHeader>
        <fieldset className="grid gap-2">
          <legend className="sr-only">O que excluir</legend>
          <label className="flex cursor-pointer items-start gap-3 rounded-lg p-3 ring-1 ring-border has-[:checked]:ring-2 has-[:checked]:ring-primary">
            <input type="radio" name="del-scope" checked={scope === "only"} onChange={() => setScope("only")} className="mt-1 size-4" />
            <span>
              <span className="block font-medium">Só este lançamento</span>
              <span className="block text-sm text-muted-foreground">Ele não volta a ser criado; os demais continuam.</span>
            </span>
          </label>
          <label className="flex cursor-pointer items-start gap-3 rounded-lg p-3 ring-1 ring-border has-[:checked]:ring-2 has-[:checked]:ring-primary">
            <input type="radio" name="del-scope" checked={scope === "following"} onChange={() => setScope("following")} className="mt-1 size-4" />
            <span>
              <span className="block font-medium">Este e os próximos</span>
              <span className="block text-sm text-muted-foreground">
                Encerra a recorrência a partir daqui.{" "}
                {preview
                  ? `Serão removidos ${preview.count} lançamento(s) pendente(s), somando ${formatBRL(preview.totalCents)}.`
                  : "Calculando o que será removido…"}
              </span>
            </span>
          </label>
        </fieldset>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancelar</AlertDialogCancel>
          <Button variant="destructive" onClick={run} disabled={pending || (scope === "following" && !preview)}>
            Excluir
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
