"use client";

import { useActionState, useTransition } from "react";
import { toast } from "sonner";
import { ActionForm, Field, FormMessage, SubmitButton } from "@/components/form";
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
import {
  addParticipantAction,
  resetPasswordAction,
  setHouseholdActiveAction,
} from "@/server/actions/admin";
import { TempPasswordField } from "../../temp-password-field";

export function ToggleActiveButton({ householdId, active, name }: { householdId: string; active: boolean; name: string }) {
  const [pending, startTransition] = useTransition();
  const run = () =>
    startTransition(async () => {
      try {
        await setHouseholdActiveAction(householdId, !active);
        toast.success(active ? "Acesso desativado." : "Acesso reativado.");
      } catch {
        toast.error("Não foi possível alterar o acesso. Tente novamente.");
      }
    });

  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <Button variant={active ? "destructive" : "default"} disabled={pending}>
          {active ? "Desativar acesso" : "Reativar acesso"}
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{active ? `Desativar "${name}"?` : `Reativar "${name}"?`}</AlertDialogTitle>
          <AlertDialogDescription>
            {active
              ? "Os participantes serão desconectados e não conseguirão entrar. Os dados do casal serão preservados."
              : "Os participantes voltarão a conseguir entrar com suas senhas."}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancelar</AlertDialogCancel>
          <AlertDialogAction onClick={run}>{active ? "Desativar" : "Reativar"}</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

export function AddParticipantForm({ householdId }: { householdId: string }) {
  const [state, action] = useActionState(addParticipantAction.bind(null, householdId), { ok: false });
  const e = state.fieldErrors ?? {};
  return (
    <ActionForm action={action} state={state} resetOnSuccess className="grid gap-3">
      <Field label="Nome" name="name" autoComplete="off" error={e.name} />
      <Field label="Email" name="email" type="email" inputMode="email" autoComplete="off" error={e.email} />
      <TempPasswordField name="password" error={e.password} />
      <FormMessage ok={state.ok} message={state.message} />
      <SubmitButton>Adicionar participante</SubmitButton>
    </ActionForm>
  );
}

export function ResetPasswordForm({ householdId, userId }: { householdId: string; userId: string }) {
  const [state, action] = useActionState(resetPasswordAction.bind(null, householdId, userId), { ok: false });
  return (
    <ActionForm action={action} className="grid gap-3">
      <TempPasswordField name="password" label="Nova senha temporária" error={state.fieldErrors?.password} />
      <FormMessage ok={state.ok} message={state.message} />
      <SubmitButton variant="secondary">Salvar senha temporária</SubmitButton>
    </ActionForm>
  );
}
