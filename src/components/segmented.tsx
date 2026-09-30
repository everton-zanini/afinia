"use client";

import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/** Grupo de opções exclusivas com rádios nativos (teclado e leitores de tela funcionam por padrão). */
export function Segmented<T extends string>({
  name,
  legend,
  options,
  value,
  onChange,
  disabled,
  className,
}: {
  name: string;
  legend: string;
  options: { value: T; label: ReactNode; activeClass?: string }[];
  value: T;
  onChange?: (v: T) => void;
  disabled?: boolean;
  className?: string;
}) {
  return (
    <fieldset className={cn("grid gap-1.5", className)} disabled={disabled}>
      <legend className="sr-only">{legend}</legend>
      <div className="grid grid-cols-none auto-cols-fr grid-flow-col gap-1 rounded-xl bg-muted p-1">
        {options.map((o) => (
          <label
            key={o.value}
            className={cn(
              "flex min-h-11 cursor-pointer items-center justify-center gap-1.5 rounded-lg px-2 text-sm font-medium text-muted-foreground transition-colors has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-ring",
              value === o.value && (o.activeClass ?? "bg-card text-foreground shadow-sm"),
            )}
          >
            <input
              type="radio"
              name={name}
              value={o.value}
              checked={value === o.value}
              onChange={() => onChange?.(o.value)}
              className="sr-only"
            />
            {o.label}
          </label>
        ))}
      </div>
    </fieldset>
  );
}
