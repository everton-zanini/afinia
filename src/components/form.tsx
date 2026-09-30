"use client";

import { useId, type ComponentProps, type ReactNode } from "react";
import { useFormStatus } from "react-dom";
import { AlertCircle, CheckCircle2, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function Field({
  label,
  error,
  hint,
  className,
  children,
  id: idProp,
  ...inputProps
}: ComponentProps<typeof Input> & {
  label: string;
  error?: string;
  hint?: ReactNode;
  children?: ReactNode;
}) {
  const autoId = useId();
  const id = idProp ?? autoId;
  const describedBy = [error ? `${id}-error` : null, hint ? `${id}-hint` : null]
    .filter(Boolean)
    .join(" ");
  return (
    <div className={cn("grid gap-1.5", className)}>
      <Label htmlFor={id}>{label}</Label>
      {children ?? (
        <Input
          id={id}
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy || undefined}
          {...inputProps}
        />
      )}
      {hint && !error && (
        <p id={`${id}-hint`} className="text-sm text-muted-foreground">
          {hint}
        </p>
      )}
      {error && <FieldError id={`${id}-error`}>{error}</FieldError>}
    </div>
  );
}

export function FieldError({ id, children }: { id?: string; children: ReactNode }) {
  return (
    <p id={id} className="flex items-center gap-1 text-sm font-medium text-destructive">
      <AlertCircle aria-hidden className="size-4 shrink-0" />
      {children}
    </p>
  );
}

export function SubmitButton({
  children,
  pendingLabel = "Salvando…",
  className,
  ...props
}: ComponentProps<typeof Button> & { pendingLabel?: string }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending || props.disabled} className={cn("w-full", className)} {...props}>
      {pending ? (
        <>
          <Loader2 aria-hidden className="animate-spin" />
          {pendingLabel}
        </>
      ) : (
        children
      )}
    </Button>
  );
}

export function FormMessage({ ok, message }: { ok: boolean; message?: string }) {
  if (!message) return null;
  return (
    <div
      role={ok ? "status" : "alert"}
      className={cn(
        "flex items-start gap-2 rounded-lg px-3 py-2.5 text-sm font-medium",
        ok ? "bg-income-soft text-income" : "bg-expense-soft text-destructive",
      )}
    >
      {ok ? (
        <CheckCircle2 aria-hidden className="mt-0.5 size-4 shrink-0" />
      ) : (
        <AlertCircle aria-hidden className="mt-0.5 size-4 shrink-0" />
      )}
      <span>{message}</span>
    </div>
  );
}
