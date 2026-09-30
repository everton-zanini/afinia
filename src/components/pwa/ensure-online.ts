"use client";

import { toast } from "sonner";

/** Antes de qualquer operação de gravação: sem conexão, avisa e não envia. */
export function ensureOnline(message = "Sem conexão. Nada foi salvo.") {
  if (typeof navigator !== "undefined" && !navigator.onLine) {
    toast.error(message, { id: "offline" });
    return false;
  }
  return true;
}
