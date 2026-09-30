"use client";

import { useTransition, type ReactNode } from "react";
import { toast } from "sonner";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import type { ActionState } from "@/server/action-result";
import { ensureOnline } from "@/components/pwa/ensure-online";

/** Botão que pede confirmação e executa uma Server Action, informando o resultado. */
export function ConfirmAction({
  action,
  title,
  description,
  confirmLabel,
  children,
  variant = "outline",
  destructive = false,
  className,
}: {
  action: () => Promise<ActionState | void>;
  title: string;
  description: ReactNode;
  confirmLabel: string;
  children: ReactNode;
  variant?: "outline" | "destructive" | "secondary" | "ghost" | "default";
  destructive?: boolean;
  className?: string;
}) {
  const [pending, startTransition] = useTransition();
  const run = () =>
    ensureOnline() &&
    startTransition(async () => {
      try {
        const result = await action();
        if (result && result.message) (result.ok ? toast.success : toast.error)(result.message);
      } catch (error) {
        // Redirecionamentos do Next também chegam aqui; só relata falhas reais.
        if (error instanceof Error && error.message.includes("NEXT_REDIRECT")) throw error;
        toast.error("Não foi possível concluir. Verifique sua conexão e tente novamente.");
      }
    });
  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <Button variant={variant} disabled={pending} className={className}>
          {children}
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{title}</AlertDialogTitle>
          <AlertDialogDescription>{description}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancelar</AlertDialogCancel>
          <AlertDialogAction
            onClick={run}
            className={destructive ? "bg-destructive text-white hover:bg-destructive/90" : undefined}
          >
            {confirmLabel}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
