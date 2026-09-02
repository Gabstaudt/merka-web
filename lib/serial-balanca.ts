"use client";

// Leitura de peso via Web Serial API (Chrome/Edge) — balança Toledo
// Prix 3 ligada por RS-232. O CLAUDE.md do backend já apontava essa
// direção ("recomendado usar Web Serial API direto no navegador... mas
// isso ainda não foi implementado nem validado na prática") — esta é essa
// primeira implementação, ainda NÃO validada contra o equipamento físico.
//
// Protocolo: a Toledo Prix 3 transmite continuamente uma string de peso
// pela serial. O formato exato do frame (delimitador, casas decimais, se
// tem STX/ETX/checksum) precisa ser confirmado com o equipamento real —
// PARSE_PESO abaixo faz uma extração best-effort do primeiro número
// decimal encontrado em cada linha recebida. Os parâmetros de porta
// (4800 8N1) são o padrão de mercado mais comum pra esse modelo, mas
// também merecem confirmação/ajuste na integração real.
const PARSE_PESO = /(-?\d+[.,]\d+)/;

export function suportaWebSerial(): boolean {
  return typeof navigator !== "undefined" && "serial" in navigator;
}

export type LeitorBalanca = {
  parar: () => Promise<void>;
};

export async function conectarBalanca(
  onPeso: (pesoKg: number) => void,
  onErro: (motivo: string) => void
): Promise<LeitorBalanca | null> {
  if (!suportaWebSerial()) {
    onErro("Este navegador não suporta Web Serial API — funciona em Chrome/Edge.");
    return null;
  }

  let port: SerialPort;
  try {
    port = await navigator.serial!.requestPort();
    await port.open({ baudRate: 4800, dataBits: 8, stopBits: 1, parity: "none" });
  } catch (err) {
    onErro(err instanceof Error ? err.message : "não foi possível conectar à balança");
    return null;
  }

  const reader = port.readable?.getReader();
  if (!reader) {
    onErro("não foi possível abrir o canal de leitura da porta serial");
    await port.close().catch(() => {});
    return null;
  }

  let cancelado = false;

  (async () => {
    const decoder = new TextDecoder();
    let buffer = "";

    try {
      while (!cancelado) {
        const { value, done } = await reader.read();
        if (done) break;
        if (!value) continue;

        buffer += decoder.decode(value, { stream: true });

        // Frames separados por \r ou \n — ajustar aqui se o equipamento
        // real usar outro delimitador de linha.
        const linhas = buffer.split(/[\r\n]+/);
        buffer = linhas.pop() ?? "";

        for (const linha of linhas) {
          const match = linha.match(PARSE_PESO);
          if (match) {
            const peso = parseFloat(match[1].replace(",", "."));
            if (!Number.isNaN(peso)) onPeso(peso);
          }
        }
      }
    } catch (err) {
      if (!cancelado) {
        onErro(err instanceof Error ? err.message : "erro de leitura da porta serial — conexão perdida");
      }
    } finally {
      reader.releaseLock();
    }
  })();

  return {
    parar: async () => {
      cancelado = true;
      await reader.cancel().catch(() => {
        // porta pode já ter sido fisicamente desconectada
      });
      await port.close().catch(() => {});
    },
  };
}
