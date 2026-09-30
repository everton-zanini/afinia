import type { Metadata } from "next";
import { CloudOff } from "lucide-react";
import { LogoMark } from "@/components/brand";
import { RetryButton } from "./retry-button";

export const metadata: Metadata = { title: "Sem conexão" };
export const dynamic = "force-static";

// Página pública e sem dados: é a única página guardada pelo service worker.
export default function OfflinePage() {
  return (
    <main className="mx-auto flex min-h-dvh max-w-sm flex-col items-center justify-center gap-5 px-6 text-center pt-safe">
      <LogoMark className="size-14" />
      <span className="flex size-12 items-center justify-center rounded-full bg-muted text-muted-foreground">
        <CloudOff aria-hidden className="size-6" />
      </span>
      <h1 className="text-xl font-semibold">Você está sem conexão</h1>
      <p className="text-muted-foreground">
        O Afinia precisa de internet para mostrar e salvar as finanças do casal. Nenhum dado fica guardado neste
        aparelho e nada foi salvo enquanto você estava offline.
      </p>
      <RetryButton />
    </main>
  );
}
