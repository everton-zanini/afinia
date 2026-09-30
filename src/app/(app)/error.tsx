"use client";

import { useEffect, useState } from "react";
import { CloudOff, RefreshCw, TriangleAlert } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function AppError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  const [offline, setOffline] = useState(false);
  useEffect(() => {
    console.error(error);
    const update = () => setOffline(!navigator.onLine);
    update();
    window.addEventListener("online", update);
    window.addEventListener("offline", update);
    return () => {
      window.removeEventListener("online", update);
      window.removeEventListener("offline", update);
    };
  }, [error]);

  const Icon = offline ? CloudOff : TriangleAlert;
  return (
    <div role="alert" className="mt-10 flex flex-col items-center gap-3 rounded-2xl bg-card px-6 py-10 text-center ring-1 ring-border">
      <span className="flex size-12 items-center justify-center rounded-full bg-expense-soft text-expense">
        <Icon aria-hidden className="size-6" />
      </span>
      <p className="font-semibold">{offline ? "Você está sem conexão" : "Não foi possível carregar esta tela"}</p>
      <p className="max-w-xs text-sm text-muted-foreground">
        {offline
          ? "O Afinia precisa de internet para mostrar e salvar as finanças. Nada foi salvo enquanto você estava sem conexão."
          : "Algo deu errado do nosso lado. Tente novamente em instantes."}
      </p>
      <Button onClick={reset}>
        <RefreshCw aria-hidden />
        Tentar novamente
      </Button>
    </div>
  );
}
