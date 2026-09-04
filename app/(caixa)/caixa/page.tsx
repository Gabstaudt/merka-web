"use client";

import { useState } from "react";

import { PlaceholderCard } from "@/components/PlaceholderCard";
import { conectarQZTray, imprimirCupom } from "@/lib/qz";

type StatusImpressora = "idle" | "verificando" | "disponivel" | "indisponivel";

// US-13 (somar N comandas) + US-14 (pagamento misto, emissão condicional
// de nota) — backend já tem POST /pagamentos; falta o endpoint de listar
// comandas em aberto por mesa pro front montar a tela de fechamento. Por
// isso o fechamento em si continua placeholder (PlaceholderCard abaixo).
//
// A integração de impressão (QZ Tray), porém, já é real: funciona de
// forma isolada do fechamento de pagamento — testável mesmo sem a tela de
// fechamento estar pronta, e sem travar nada se o agente local não
// estiver instalado.
export default function CaixaPage() {
  const [imprimirAoFechar, setImprimirAoFechar] = useState(true);
  const [statusImpressora, setStatusImpressora] = useState<StatusImpressora>("idle");
  const [avisoImpressora, setAvisoImpressora] = useState<string | null>(null);

  async function testarImpressora() {
    setStatusImpressora("verificando");
    setAvisoImpressora(null);

    const resultado = await conectarQZTray();
    if (!resultado.ok) {
      setStatusImpressora("indisponivel");
      setAvisoImpressora(resultado.motivo);
      return;
    }

    setStatusImpressora("disponivel");
  }

  async function imprimirCupomTeste() {
    const resultado = await imprimirCupom([
      "MERKA — CUPOM DE TESTE",
      "--------------------------------",
      "Este é um cupom de teste da",
      "integração com o QZ Tray.",
      "--------------------------------",
    ]);

    if (!resultado.ok) {
      setStatusImpressora("indisponivel");
      setAvisoImpressora(resultado.motivo);
      return;
    }

    setStatusImpressora("disponivel");
    setAvisoImpressora(null);
  }

  return (
    <div className="mx-auto flex w-full max-w-sm flex-col gap-6">
      <PlaceholderCard
        titulo="Fechamento de caixa"
        descricao="Somar comandas de uma mesa e processar o pagamento (único ou misto)."
        itens={["Somar comandas (US-13)", "Fechar pagamento (US-14)", "Emitir nota fiscal (US-14/US-19)"]}
      />

      <div className="flex flex-col gap-3 rounded-lg border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
        <div>
          <h3 className="text-sm font-semibold">Impressão do cupom</h3>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Via impressora térmica USB, através do agente local{" "}
            <a
              href="https://qz.io/download/"
              target="_blank"
              rel="noreferrer"
              className="underline underline-offset-2"
            >
              QZ Tray
            </a>{" "}
            — precisa estar instalado e rodando nesta máquina.
          </p>
        </div>

        <label className="flex items-center justify-between gap-3 text-sm">
          <span className="text-slate-700 dark:text-slate-300">
            Imprimir cupom ao fechar? <span className="text-slate-400">(padrão configurável)</span>
          </span>
          <input
            type="checkbox"
            checked={imprimirAoFechar}
            onChange={(e) => setImprimirAoFechar(e.target.checked)}
            className="h-4 w-4"
          />
        </label>

        <div className="flex gap-2">
          <button
            type="button"
            onClick={testarImpressora}
            disabled={statusImpressora === "verificando"}
            className="flex-1 rounded-md border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-600 transition hover:bg-slate-100 disabled:opacity-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
          >
            {statusImpressora === "verificando" ? "Verificando…" : "Testar impressora"}
          </button>
          <button
            type="button"
            onClick={imprimirCupomTeste}
            disabled={!imprimirAoFechar}
            className="flex-1 rounded-md bg-slate-900 px-3 py-1.5 text-xs font-medium text-white transition hover:bg-slate-800 disabled:opacity-50 dark:bg-slate-50 dark:text-slate-900 dark:hover:bg-slate-200"
          >
            Imprimir cupom de teste
          </button>
        </div>

        {statusImpressora === "disponivel" && (
          <p className="rounded-md bg-emerald-50 px-3 py-2 text-xs text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300">
            QZ Tray conectado.
          </p>
        )}

        {statusImpressora === "indisponivel" && (
          <p className="rounded-md bg-amber-50 px-3 py-2 text-xs text-amber-800 dark:bg-amber-950 dark:text-amber-300">
            QZ Tray indisponível — o fechamento de pagamento não é bloqueado por isso, só a
            impressão fica pendente. {avisoImpressora}
          </p>
        )}
      </div>
    </div>
  );
}
