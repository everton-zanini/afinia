"use client";

import { CloudOff } from "lucide-react";
import { useOnline } from "./use-online";

export function ConnectionBanner() {
  const online = useOnline();
  if (online) return null;
  return (
    <div
      role="status"
      className="fixed inset-x-0 top-0 z-50 flex items-center justify-center gap-2 bg-foreground px-4 py-2 pt-[max(0.5rem,env(safe-area-inset-top))] text-sm font-medium text-background"
    >
      <CloudOff aria-hidden className="size-4" />
      Sem conexão. Consultas e lançamentos ficam indisponíveis até a internet voltar.
    </div>
  );
}
