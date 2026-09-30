"use client";

import { useEffect } from "react";
import { toast } from "sonner";

/** Registra o service worker (produção) e oferece atualização quando há nova versão. */
export function PwaRegister() {
  useEffect(() => {
    if (process.env.NODE_ENV !== "production" || !("serviceWorker" in navigator)) return;
    // Recarrega apenas quando o usuário pediu a atualização; na primeira instalação o
    // clients.claim() também dispara controllerchange e não deve interromper o uso.
    let updateRequested = false;
    const onControllerChange = () => {
      if (!updateRequested) return;
      updateRequested = false;
      window.location.reload();
    };

    const offerUpdate = (worker: ServiceWorker) => {
      toast("Nova versão disponível", {
        id: "sw-update",
        duration: Infinity,
        description: "Atualize para usar a versão mais recente do Afinia.",
        action: {
          label: "Atualizar",
          onClick: () => {
            updateRequested = true;
            worker.postMessage({ type: "SKIP_WAITING" });
          },
        },
      });
    };

    navigator.serviceWorker
      .register("/sw.js", { scope: "/", updateViaCache: "none" })
      .then((registration) => {
        // Só oferece atualização se já havia uma versão controlando a página.
        if (registration.waiting && navigator.serviceWorker.controller) offerUpdate(registration.waiting);
        registration.addEventListener("updatefound", () => {
          const installing = registration.installing;
          installing?.addEventListener("statechange", () => {
            if (installing.state === "installed" && navigator.serviceWorker.controller) offerUpdate(installing);
          });
        });
        const check = () => registration.update().catch(() => {});
        document.addEventListener("visibilitychange", () => document.visibilityState === "visible" && check());
      })
      .catch((error) => console.error("Falha ao registrar o service worker", error));

    navigator.serviceWorker.addEventListener("controllerchange", onControllerChange);
    return () => navigator.serviceWorker.removeEventListener("controllerchange", onControllerChange);
  }, []);
  return null;
}
