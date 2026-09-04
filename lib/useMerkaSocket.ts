"use client";

import { useEffect, useRef } from "react";

// Evento é o mesmo envelope que o backend manda (ver
// merka-api/internal/ws/events.go): sempre {tipo, payload}, o front
// despacha por "tipo" sem precisar inspecionar a forma do payload antes.
export type EventoWS = {
  tipo: "comanda_atualizada" | "alerta_pendencia";
  payload: unknown;
};

const WS_URL = process.env.NEXT_PUBLIC_MERKA_WS_URL ?? "ws://localhost:8080/ws";

// useMerkaSocket abre a conexão WebSocket com o backend e chama
// `onEvento` pra cada mensagem recebida — usado por qualquer tela que
// precisa refletir em tempo real ações feitas por outro dispositivo (ex:
// Garçom vendo a Balança lançar um peso na mesma comanda). Reconecta
// sozinho com backoff simples se a conexão cair (rede instável é o normal
// num salão, não uma exceção).
//
// Only exceção documentada à regra de "o cliente nunca vê o JWT" (ver
// CLAUDE.md): o WebSocket do navegador não aceita headers customizados no
// handshake, então o token precisa ir na querystring — por isso este hook
// busca um token efêmero em /api/ws-token (que lê o cookie httpOnly no
// servidor) só pra abrir a conexão, nunca o armazena além disso.
export function useMerkaSocket(onEvento: (evento: EventoWS) => void) {
  const onEventoRef = useRef(onEvento);
  useEffect(() => {
    onEventoRef.current = onEvento;
  }, [onEvento]);

  useEffect(() => {
    let socket: WebSocket | null = null;
    let cancelado = false;
    let tentativa = 0;
    let timeoutId: ReturnType<typeof setTimeout> | undefined;

    async function conectar() {
      if (cancelado) return;

      const res = await fetch("/api/ws-token").catch(() => null);
      const data = await res?.json().catch(() => null);
      if (cancelado || !data?.token) return;

      socket = new WebSocket(`${WS_URL}?token=${encodeURIComponent(data.token)}`);

      socket.onmessage = (event) => {
        try {
          const evento = JSON.parse(event.data) as EventoWS;
          onEventoRef.current(evento);
        } catch {
          // mensagem que não é um Evento válido — ignora
        }
      };

      socket.onclose = () => {
        if (cancelado) return;
        tentativa += 1;
        const espera = Math.min(1000 * 2 ** tentativa, 15000);
        timeoutId = setTimeout(conectar, espera);
      };

      socket.onopen = () => {
        tentativa = 0;
      };
    }

    conectar();

    return () => {
      cancelado = true;
      if (timeoutId) clearTimeout(timeoutId);
      socket?.close();
    };
  }, []);
}
