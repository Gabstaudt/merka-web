"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";

import { LogoutButton } from "@/components/LogoutButton";

type Comanda = {
  ID: string;
  TenantID: string;
  CodigoFisico: string;
  Status: string;
  TableID: string | null;
  AbertaEm: string | null;
  FechadaEm: string | null;
};

type Acao = "entregar" | "receber";

type Resultado =
  | { tipo: "sucesso"; acao: Acao; comanda: Comanda; horario: string; chave: number }
  | { tipo: "erro"; acao: Acao; codigo: string; mensagem: string; chave: number };

// Traduz o erro cru do backend (já em português simples, ver
// merka-api/internal/usecase/{abrir,liberar}_comanda.go) pro tom de voz
// da interface: sempre "o que houve" + "o que fazer", nunca "ops" nem
// pedido de desculpa — e sempre com o código da comanda na frase, porque
// é a informação que o porteiro precisa repassar a quem está na fila.
function mensagemDeErro(codigo: string, erroBackend: string): string {
  if (erroBackend.includes("não encontrada")) {
    return `Comanda ${codigo} não encontrada. Confira o código e tente de novo.`;
  }
  if (erroBackend.includes("saldo") || erroBackend.includes("ainda não foi paga")) {
    return `Comanda ${codigo} ainda não foi paga. Direcione o cliente ao caixa.`;
  }
  if (erroBackend.includes("não está disponível")) {
    return `Comanda ${codigo} já está em uso. Confira se ela já foi entregue.`;
  }
  return `Comanda ${codigo}: ${erroBackend}`;
}

export default function PorteiroPage() {
  const [codigo, setCodigo] = useState("");
  const [resultado, setResultado] = useState<Resultado | null>(null);
  const [carregando, setCarregando] = useState<Acao | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // O leitor de código de barras simula digitação + Enter — depois de
  // qualquer ação, o campo já volta limpo e em foco, pronto pro próximo
  // cliente, sem o porteiro precisar tocar na tela.
  useEffect(() => {
    inputRef.current?.focus();
  }, [resultado]);

  async function executar(acao: Acao) {
    const codigoAtual = codigo.trim();
    if (codigoAtual === "" || carregando) return;

    setCarregando(acao);
    const rota = acao === "entregar" ? "abrir" : "liberar";

    try {
      const res = await fetch(`/api/comandas/${encodeURIComponent(codigoAtual)}/${rota}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        setResultado({
          tipo: "erro",
          acao,
          codigo: codigoAtual,
          mensagem: mensagemDeErro(codigoAtual, data.erro ?? "não foi possível concluir"),
          chave: Date.now(),
        });
      } else {
        setResultado({
          tipo: "sucesso",
          acao,
          comanda: data as Comanda,
          horario: new Date().toLocaleTimeString("pt-BR"),
          chave: Date.now(),
        });
      }
    } catch {
      setResultado({
        tipo: "erro",
        acao,
        codigo: codigoAtual,
        mensagem: "Sem conexão com o servidor. Confira a rede e tente de novo.",
        chave: Date.now(),
      });
    } finally {
      setCodigo("");
      setCarregando(null);
    }
  }

  // Enter no campo (inclusive vindo do leitor de código de barras) aciona
  // "Entregar" — é o fluxo mais frequente numa entrada (cliente chegando).
  // "Receber" fica só no botão explícito, pra devolução na saída.
  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    executar("entregar");
  }

  return (
    <div className="flex min-h-dvh flex-col">
      <header className="flex items-center justify-between border-b border-linha px-6 py-4">
        <div className="flex items-center gap-3">
          {/* eslint-disable-next-line @next/next/no-img-element -- fundo desta tela é sempre Papel (claro), sem modo escuro — ver CLAUDE.md */}
          <img src="/logos/merka-logo.svg" alt="Merka" className="h-6 w-auto" />
          <span className="text-linha">/</span>
          <span className="text-sm text-texto-secundario">Porteiro</span>
        </div>
        <LogoutButton />
      </header>

      <main className="flex flex-1 flex-col">
        {resultado && (
          <section
            key={resultado.chave}
            className="animate-feedback-in border-b border-linha px-6 py-10 sm:px-10 sm:py-14"
          >
            <div className="border-l-2 border-ambar pl-6">
              {resultado.tipo === "sucesso" ? (
                <>
                  <p className="text-sm font-medium text-ambar">
                    {resultado.acao === "entregar" ? "Liberada ao cliente" : "Recebida, pronta pro próximo cliente"}
                  </p>
                  <p className="mt-2 font-display text-6xl text-tinta sm:text-7xl">
                    {resultado.comanda.CodigoFisico}
                  </p>
                  <p className="mt-3 font-mono text-sm text-texto-secundario">{resultado.horario}</p>
                </>
              ) : (
                <>
                  <p className="text-sm font-medium text-ambar">Não foi possível concluir</p>
                  <p className="mt-2 max-w-xl text-2xl leading-snug text-tinta sm:text-3xl">
                    {resultado.mensagem}
                  </p>
                </>
              )}
            </div>
          </section>
        )}

        <div className="flex flex-1 flex-col justify-center px-6 py-10 sm:px-10">
          <form onSubmit={handleSubmit} className="mx-auto flex w-full max-w-xl flex-col gap-8">
            <label className="flex flex-col gap-3">
              <span className="text-sm text-texto-secundario">Código da comanda</span>
              <input
                ref={inputRef}
                type="text"
                value={codigo}
                onChange={(e) => setCodigo(e.target.value)}
                placeholder="—"
                autoFocus
                autoComplete="off"
                className="border-b-2 border-tinta bg-transparent pb-2 font-mono text-5xl text-tinta outline-none placeholder:text-texto-secundario/50 focus:border-ambar sm:text-6xl"
              />
            </label>

            <div className="flex flex-col gap-3 sm:flex-row">
              <button
                type="submit"
                disabled={codigo.trim() === "" || carregando !== null}
                className="flex-1 bg-tinta px-6 py-4 text-base font-medium text-papel transition-opacity disabled:opacity-40"
              >
                {carregando === "entregar" ? "Entregando…" : "Entregar comanda"}
              </button>
              <button
                type="button"
                onClick={() => executar("receber")}
                disabled={codigo.trim() === "" || carregando !== null}
                className="flex-1 border border-tinta px-6 py-4 text-base font-medium text-tinta transition-opacity disabled:opacity-40"
              >
                {carregando === "receber" ? "Recebendo…" : "Receber comanda"}
              </button>
            </div>
          </form>
        </div>
      </main>
    </div>
  );
}
