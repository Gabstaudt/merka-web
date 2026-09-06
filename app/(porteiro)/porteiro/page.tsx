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

type Resultado =
  | { tipo: "liberada"; comanda: Comanda; horario: string; chave: number }
  | { tipo: "recebida"; comanda: Comanda; horario: string; chave: number }
  | { tipo: "erro"; codigo: string; mensagem: string; bloqueada: boolean; chave: number };

// O porteiro só escaneia — não escolhe "entregar" ou "receber" na tela.
// O sistema consulta o status atual da comanda e decide sozinho a
// próxima ação (US-07/US-08):
//   disponivel -> entregar ao cliente (POST /abrir)
//   paga       -> receber na saída, liberar pro estoque (POST /liberar)
//   em_uso     -> bloqueado: cliente ainda está com a comanda, sem pagar
function proximaAcao(status: string): "abrir" | "liberar" | null {
  if (status === "disponivel") return "abrir";
  if (status === "paga") return "liberar";
  return null;
}

// Traduz o erro cru do backend (já em português simples, ver
// merka-api/internal/usecase/{consultar,abrir,liberar}_comanda.go) pro
// tom de voz da interface: sempre "o que houve" + "o que fazer", nunca
// "ops" nem pedido de desculpa — sempre com o código da comanda na frase.
function mensagemDeErro(codigo: string, status: string | null, erroBackend?: string): string {
  if (status === "em_uso") {
    return `Comanda ${codigo} está em uso. O cliente ainda não fechou a conta no caixa.`;
  }
  if (erroBackend?.includes("não encontrada")) {
    return `Comanda ${codigo} não encontrada. Confira o código e tente de novo.`;
  }
  return `Comanda ${codigo}: ${erroBackend ?? "não foi possível concluir"}`;
}

export default function PorteiroPage() {
  const [codigo, setCodigo] = useState("");
  const [resultado, setResultado] = useState<Resultado | null>(null);
  const [carregando, setCarregando] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  // O leitor de código de barras simula digitação + Enter — depois de
  // qualquer ação, o campo já volta limpo e em foco, pronto pro próximo
  // cliente, sem o porteiro precisar tocar na tela.
  useEffect(() => {
    inputRef.current?.focus();
  }, [resultado]);

  async function passarComanda(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const codigoAtual = codigo.trim();
    if (codigoAtual === "" || carregando) return;

    setCarregando(true);

    try {
      const consulta = await fetch(`/api/comandas/${encodeURIComponent(codigoAtual)}`);
      const dadosConsulta = await consulta.json().catch(() => ({}));

      if (!consulta.ok) {
        setResultado({
          tipo: "erro",
          codigo: codigoAtual,
          mensagem: mensagemDeErro(codigoAtual, null, dadosConsulta.erro),
          bloqueada: false,
          chave: Date.now(),
        });
        return;
      }

      const acao = proximaAcao(dadosConsulta.Status);
      if (!acao) {
        setResultado({
          tipo: "erro",
          codigo: codigoAtual,
          mensagem: mensagemDeErro(codigoAtual, dadosConsulta.Status),
          bloqueada: dadosConsulta.Status === "em_uso",
          chave: Date.now(),
        });
        return;
      }

      const res = await fetch(`/api/comandas/${encodeURIComponent(codigoAtual)}/${acao}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        setResultado({
          tipo: "erro",
          codigo: codigoAtual,
          mensagem: mensagemDeErro(codigoAtual, null, data.erro),
          bloqueada: false,
          chave: Date.now(),
        });
      } else {
        setResultado({
          tipo: acao === "abrir" ? "liberada" : "recebida",
          comanda: data as Comanda,
          horario: new Date().toLocaleTimeString("pt-BR"),
          chave: Date.now(),
        });
      }
    } catch {
      setResultado({
        tipo: "erro",
        codigo: codigoAtual,
        mensagem: "Sem conexão com o servidor. Confira a rede e tente de novo.",
        bloqueada: false,
        chave: Date.now(),
      });
    } finally {
      setCodigo("");
      setCarregando(false);
    }
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
            className={`animate-feedback-in border-b border-linha px-6 py-10 sm:px-10 sm:py-14 ${
              resultado.tipo === "erro" && resultado.bloqueada
                ? "bg-bloqueado/10"
                : resultado.tipo === "liberada" || resultado.tipo === "recebida"
                  ? "bg-liberado/10"
                  : ""
            }`}
          >
            <div
              className={`border-l-2 pl-6 ${
                resultado.tipo === "erro" && resultado.bloqueada
                  ? "border-bloqueado"
                  : resultado.tipo === "liberada" || resultado.tipo === "recebida"
                    ? "border-liberado"
                    : "border-ambar"
              }`}
            >
              {resultado.tipo === "erro" ? (
                <>
                  <p className={`text-sm font-medium ${resultado.bloqueada ? "text-bloqueado" : "text-ambar"}`}>
                    {resultado.bloqueada ? "Bloqueada — não pode sair" : "Não foi possível concluir"}
                  </p>
                  <p
                    className={`mt-2 max-w-xl text-2xl leading-snug sm:text-3xl ${
                      resultado.bloqueada ? "text-bloqueado" : "text-tinta"
                    }`}
                  >
                    {resultado.mensagem}
                  </p>
                </>
              ) : (
                <>
                  <p className="text-sm font-medium text-liberado">
                    {resultado.tipo === "liberada" ? "Liberada ao cliente" : "Liberada — pode sair"}
                  </p>
                  <p className="mt-2 font-display text-6xl text-liberado sm:text-7xl">
                    {resultado.comanda.CodigoFisico}
                  </p>
                  <p className="mt-3 font-mono text-sm text-texto-secundario">{resultado.horario}</p>
                </>
              )}
            </div>
          </section>
        )}

        <div className="flex flex-1 flex-col justify-center px-6 py-10 sm:px-10">
          <form onSubmit={passarComanda} className="mx-auto flex w-full max-w-xl flex-col gap-8">
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

            <button
              type="submit"
              disabled={codigo.trim() === "" || carregando}
              className="bg-tinta px-6 py-4 text-base font-medium text-papel transition-opacity disabled:opacity-40"
            >
              {carregando ? "Verificando…" : "Passar comanda"}
            </button>
          </form>
        </div>
      </main>
    </div>
  );
}
