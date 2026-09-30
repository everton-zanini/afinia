"use client";

import { useId, useRef } from "react";
import { Wand2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { FieldError } from "@/components/form";

const ALPHABET = "abcdefghjkmnpqrstuvwxyzABCDEFGHJKMNPQRSTUVWXYZ23456789";

function generatePassword(length = 14) {
  const bytes = new Uint32Array(length);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => ALPHABET[b % ALPHABET.length]).join("");
}

/** Senha temporária visível (o admin precisa repassá-la), com gerador aleatório local. */
export function TempPasswordField({ name, error, label = "Senha temporária" }: { name: string; error?: string; label?: string }) {
  const id = useId();
  const ref = useRef<HTMLInputElement>(null);
  return (
    <div className="grid gap-1.5">
      <Label htmlFor={id}>{label}</Label>
      <div className="flex gap-2">
        <Input
          ref={ref}
          id={id}
          name={name}
          type="text"
          autoComplete="off"
          spellCheck={false}
          className="font-mono"
          aria-invalid={error ? true : undefined}
          aria-describedby={`${id}-hint`}
        />
        <Button
          type="button"
          variant="outline"
          onClick={() => {
            if (ref.current) ref.current.value = generatePassword();
          }}
        >
          <Wand2 aria-hidden />
          Gerar
        </Button>
      </div>
      {error ? (
        <FieldError>{error}</FieldError>
      ) : (
        <p id={`${id}-hint`} className="text-sm text-muted-foreground">
          Mínimo de 10 caracteres. A pessoa deverá trocá-la no primeiro acesso.
        </p>
      )}
    </div>
  );
}
