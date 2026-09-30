"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import { CheckCircle2, Download, EllipsisVertical, Share, SquarePlus } from "lucide-react";
import { Button } from "@/components/ui/button";

type InstallPromptEvent = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: string }> };

const noop = () => () => {};

export function InstallGuide() {
  const standalone = useSyncExternalStore(
    noop,
    () => window.matchMedia("(display-mode: standalone)").matches || ("standalone" in navigator && Boolean((navigator as { standalone?: boolean }).standalone)),
    () => false,
  );
  const [promptEvent, setPromptEvent] = useState<InstallPromptEvent | null>(null);

  useEffect(() => {
    const onPrompt = (e: Event) => {
      e.preventDefault();
      setPromptEvent(e as InstallPromptEvent);
    };
    window.addEventListener("beforeinstallprompt", onPrompt);
    return () => window.removeEventListener("beforeinstallprompt", onPrompt);
  }, []);

  if (standalone) {
    return (
      <p className="flex items-center gap-2 rounded-2xl bg-income-soft p-4 font-medium text-income">
        <CheckCircle2 aria-hidden className="size-5" /> O Afinia já está instalado neste aparelho.
      </p>
    );
  }

  return (
    <div className="grid gap-4">
      {promptEvent && (
        <Button
          size="lg"
          onClick={async () => {
            await promptEvent.prompt();
            await promptEvent.userChoice;
            setPromptEvent(null);
          }}
        >
          <Download aria-hidden /> Instalar o Afinia
        </Button>
      )}
      <section aria-labelledby="android" className="grid gap-2 rounded-2xl bg-card p-4 ring-1 ring-border">
        <h2 id="android" className="font-semibold">Android (Chrome)</h2>
        <ol className="grid list-decimal gap-2 pl-5 text-sm">
          <li>
            Toque no menu <EllipsisVertical aria-label="três pontos" className="inline size-4 align-text-bottom" /> no canto
            superior.
          </li>
          <li>Escolha <strong>Instalar app</strong> (ou <strong>Adicionar à tela inicial</strong>).</li>
          <li>Confirme. O ícone do Afinia aparece junto dos outros apps.</li>
        </ol>
      </section>
      <section aria-labelledby="ios" className="grid gap-2 rounded-2xl bg-card p-4 ring-1 ring-border">
        <h2 id="ios" className="font-semibold">iPhone e iPad (Safari)</h2>
        <ol className="grid list-decimal gap-2 pl-5 text-sm">
          <li>
            Toque em <strong>Compartilhar</strong> <Share aria-hidden className="inline size-4 align-text-bottom" /> na barra
            do Safari.
          </li>
          <li>
            Role e toque em <strong>Adicionar à Tela de Início</strong>{" "}
            <SquarePlus aria-hidden className="inline size-4 align-text-bottom" />.
          </li>
          <li>Toque em <strong>Adicionar</strong>.</li>
        </ol>
      </section>
      <p className="text-sm text-muted-foreground">
        Mesmo instalado, o Afinia precisa de internet para mostrar e salvar as finanças. Nenhum dado financeiro fica
        guardado no aparelho.
      </p>
    </div>
  );
}
