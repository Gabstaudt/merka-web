"use client";

import { useEffect } from "react";

// Registra o service worker (public/sw.js) assim que a página carrega no
// cliente — é isso que torna o app instalável (junto com o manifest.json)
// e dá o cache básico offline. Feito manualmente (sem next-pwa) para
// manter o setup simples e sem dependência extra nesta primeira versão.
export function ServiceWorkerRegister() {
  useEffect(() => {
    if (typeof window === "undefined" || !("serviceWorker" in navigator)) {
      return;
    }

    navigator.serviceWorker.register("/sw.js").catch((err) => {
      console.error("Falha ao registrar o service worker:", err);
    });
  }, []);

  return null;
}
