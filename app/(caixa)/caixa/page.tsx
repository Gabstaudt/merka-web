"use client";

import { useRef, useState, type FormEvent } from "react";

import { LogoutButton } from "@/components/LogoutButton";
import { conectarQZTray, imprimirCupom } from "@/lib/qz";

type Comanda = { ID: string; Status: string; CodigoFisico: string };
type OrderItem = { Valor: number; Status: "ativo" | "removido" | "estornado" };

type ComandaFechamento = { id: string; codigo: string; subtotal: number };

const METODOS = [
  { valor: "credito", label: "Crédito" },
  { valor: "debito", label: "Débito" },
  { valor: "voucher", label: "Voucher" },
  { valor: "pix", label: "PIX" },
  { valor: "dinheiro", label: "Dinheiro" },
  { valor: "ticket_alimentacao", label: "Ticket alimentação" },
] as const;

type Metodo = (typeof METODOS)[number]["valor"];

type PagamentoParcial = { chave: number; metodo: Metodo; valor: number };

type Resultado =
  | { tipo: "sucesso"; paymentIds: string[]; comandas: string[]; total: number; chave: number }
  | { tipo: "erro"; mensagem: string; chave: number };

function formatarMoeda(valor: number) {
  return valor.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

const METODOS_COM_NOTA_AUTOMATICA: Metodo[] = ["credito", "debito", "voucher"];

export default function CaixaPage() {
  const [codigo, setCodigo] = useState("");
  const [adicionando, setAdicionando] = useState(false);
  const [erroAdicionar, setErroAdicionar] = useState<string | null>(null);
  const [comandas, setComandas] = useState<ComandaFechamento[]>([]);

  const [metodoAtual, setMetodoAtual] = useState<Metodo>("credito");
  const [valorAtual, setValorAtual] = useState("");
  const [pagamentos, setPagamentos] = useState<PagamentoParcial[]>([]);

  // TODO(config-tenant): valor padrão devia vir de uma configuração por
  // tenant (ex: tenants.imprimir_cupom_padrao) — não existe esse campo
  // ainda no backend, então por enquanto o padrão é fixo (true) e some
  // que o operador ajusta manualmente quando quiser.
  const [imprimirCupomAoFechar, setImprimirCupomAoFechar] = useState(true);
  const [enviarEmail, setEnviarEmail] = useState(false);
  const [emailDestino, setEmailDestino] = useState("");
  const [enviarWhatsapp, setEnviarWhatsapp] = useState(false);
  const [whatsappDestino, setWhatsappDestino] = useState("");

  const [confirmando, setConfirmando] = useState(false);
  const [resultado, setResultado] = useState<Resultado | null>(null);

  // Contador local em vez de Date.now(): só serve pra dar uma key nova ao
  // painel de resultado (força a animação de entrada a rodar de novo a
  // cada resultado), não precisa ser um timestamp real.
  const proximaChaveRef = useRef(0);
  function proximaChave() {
    proximaChaveRef.current += 1;
    return proximaChaveRef.current;
  }

  const total = comandas.reduce((soma, c) => soma + c.subtotal, 0);
  const somaPagamentos = pagamentos.reduce((soma, p) => soma + p.valor, 0);
  const faltaCobrir = Math.round((total - somaPagamentos) * 100) / 100;

  async function adicionarComanda(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const codigoAtual = codigo.trim();
    if (codigoAtual === "" || adicionando) return;

    if (comandas.some((c) => c.codigo === codigoAtual)) {
      setErroAdicionar(`Comanda ${codigoAtual} já está neste fechamento.`);
      return;
    }

    setAdicionando(true);
    setErroAdicionar(null);

    try {
      const res = await fetch(`/api/comandas/${encodeURIComponent(codigoAtual)}`);
      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        setErroAdicionar(
          data.erro?.includes("não encontrada")
            ? `Comanda ${codigoAtual} não encontrada. Confira o código e tente de novo.`
            : `Comanda ${codigoAtual}: ${data.erro ?? "não foi possível consultar"}`
        );
        return;
      }

      const comanda = data as Comanda;
      if (comanda.Status === "paga") {
        setErroAdicionar(`Comanda ${codigoAtual} já foi paga anteriormente.`);
        return;
      }
      if (comanda.Status !== "em_uso") {
        setErroAdicionar(`Comanda ${codigoAtual} está ${comanda.Status} — não há o que cobrar.`);
        return;
      }

      const itensRes = await fetch(`/api/comandas/${encodeURIComponent(comanda.ID)}/itens`);
      const itensData = await itensRes.json().catch(() => []);
      const subtotal = Array.isArray(itensData)
        ? (itensData as OrderItem[]).filter((i) => i.Status === "ativo").reduce((soma, i) => soma + i.Valor, 0)
        : 0;

      setComandas((atual) => [...atual, { id: comanda.ID, codigo: comanda.CodigoFisico, subtotal }]);
      setCodigo("");
    } catch {
      setErroAdicionar("Sem conexão com o servidor. Confira a rede e tente de novo.");
    } finally {
      setAdicionando(false);
    }
  }

  function removerComanda(id: string) {
    setComandas((atual) => atual.filter((c) => c.id !== id));
  }

  function adicionarPagamento() {
    const valor = parseFloat(valorAtual.replace(",", "."));
    if (Number.isNaN(valor) || valor <= 0) return;
    setPagamentos((atual) => [...atual, { chave: proximaChave(), metodo: metodoAtual, valor }]);
    setValorAtual("");
  }

  function removerPagamento(chave: number) {
    setPagamentos((atual) => atual.filter((p) => p.chave !== chave));
  }

  async function confirmarPagamento() {
    if (comandas.length === 0 || pagamentos.length === 0 || Math.abs(faltaCobrir) > 0.005 || confirmando) return;

    setConfirmando(true);
    try {
      const res = await fetch("/api/pagamentos", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          comanda_ids: comandas.map((c) => c.id),
          pagamentos: pagamentos.map((p) => ({ metodo: p.metodo, valor: p.valor })),
        }),
      });
      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        setResultado({ tipo: "erro", mensagem: data.erro ?? "não foi possível concluir o fechamento", chave: proximaChave() });
        return;
      }

      if (imprimirCupomAoFechar) {
        await imprimirCupomFechamento(comandas, pagamentos, total);
      }

      setResultado({
        tipo: "sucesso",
        paymentIds: (data.payment_ids as string[]) ?? [],
        comandas: comandas.map((c) => c.codigo),
        total,
        chave: proximaChave(),
      });
      setComandas([]);
      setPagamentos([]);
      setEnviarEmail(false);
      setEmailDestino("");
      setEnviarWhatsapp(false);
      setWhatsappDestino("");
    } catch {
      setResultado({
        tipo: "erro",
        mensagem: "Sem conexão com o servidor. Confira a rede e tente de novo.",
        chave: proximaChave(),
      });
    } finally {
      setConfirmando(false);
    }
  }

  const temNotaAutomatica = pagamentos.some((p) => METODOS_COM_NOTA_AUTOMATICA.includes(p.metodo));
  const podeConfirmar = comandas.length > 0 && pagamentos.length > 0 && Math.abs(faltaCobrir) <= 0.005;

  return (
    <div className="flex min-h-dvh flex-col">
      <header className="flex items-center justify-between border-b border-linha px-6 py-4">
        <div className="flex items-center gap-3">
          {/* eslint-disable-next-line @next/next/no-img-element -- fundo desta tela é sempre Papel (claro), sem modo escuro — ver CLAUDE.md */}
          <img src="/logos/merka-logo.svg" alt="Merka" className="h-6 w-auto" />
          <span className="text-linha">/</span>
          <span className="text-sm text-texto-secundario">Caixa</span>
        </div>
        <LogoutButton />
      </header>

      <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col px-6 py-8">
        {resultado && (
          <section key={resultado.chave} className="animate-feedback-in mb-8 border-l-2 border-ambar pl-6">
            {resultado.tipo === "erro" ? (
              <>
                <p className="text-sm font-medium text-ambar">Não foi possível concluir</p>
                <p className="mt-2 text-lg leading-snug text-tinta">{resultado.mensagem}</p>
              </>
            ) : (
              <>
                <p className="text-sm font-medium text-ambar">Pagamento fechado</p>
                <p className="mt-2 font-display text-4xl text-tinta">{formatarMoeda(resultado.total)}</p>
                <p className="mt-2 text-sm text-texto-secundario">
                  comanda{resultado.comandas.length > 1 ? "s" : ""} {resultado.comandas.join(", ")} ·{" "}
                  {resultado.paymentIds.length} lançamento{resultado.paymentIds.length > 1 ? "s" : ""} de pagamento
                </p>
              </>
            )}
          </section>
        )}

        <form onSubmit={adicionarComanda} className="flex flex-col gap-2">
          <span className="text-sm text-texto-secundario">Adicionar comanda ao fechamento</span>
          <div className="flex gap-3">
            <input
              type="text"
              value={codigo}
              onChange={(e) => setCodigo(e.target.value)}
              placeholder="—"
              autoFocus
              autoComplete="off"
              className="flex-1 border-b-2 border-tinta bg-transparent pb-2 font-mono text-2xl text-tinta outline-none placeholder:text-texto-secundario/50 focus:border-ambar"
            />
            <button
              type="submit"
              disabled={codigo.trim() === "" || adicionando}
              className="bg-tinta px-5 text-sm font-medium text-papel transition-opacity disabled:opacity-40"
            >
              {adicionando ? "Adicionando…" : "Adicionar"}
            </button>
          </div>
          {erroAdicionar && <p className="text-sm text-ambar">{erroAdicionar}</p>}
        </form>

        <ul className="mt-6 flex flex-col">
          {comandas.length === 0 && (
            <li className="py-4 text-sm text-texto-secundario">Nenhuma comanda adicionada ainda.</li>
          )}
          {comandas.map((c) => (
            <li key={c.id} className="flex items-center justify-between border-t border-linha py-3 first:border-t-0">
              <span className="font-mono text-base text-tinta">comanda {c.codigo}</span>
              <div className="flex items-center gap-4">
                <span className="text-sm text-texto-secundario">{formatarMoeda(c.subtotal)}</span>
                <button
                  type="button"
                  onClick={() => removerComanda(c.id)}
                  className="text-sm text-texto-secundario underline underline-offset-2 hover:text-tinta"
                >
                  Remover
                </button>
              </div>
            </li>
          ))}
        </ul>

        <div className="mt-4 flex items-baseline justify-between border-y border-linha py-4">
          <span className="text-sm text-texto-secundario">total consolidado</span>
          <span className="font-display text-4xl text-ambar">{formatarMoeda(total)}</span>
        </div>

        <div className="mt-8">
          <span className="text-sm text-texto-secundario">Forma de pagamento</span>
          <div className="mt-2 flex gap-3">
            <select
              value={metodoAtual}
              onChange={(e) => setMetodoAtual(e.target.value as Metodo)}
              className="flex-1 border-b border-linha bg-transparent py-2 text-base text-tinta outline-none focus:border-ambar"
            >
              {METODOS.map((m) => (
                <option key={m.valor} value={m.valor}>
                  {m.label}
                </option>
              ))}
            </select>
            <input
              type="text"
              inputMode="decimal"
              value={valorAtual}
              onChange={(e) => setValorAtual(e.target.value)}
              placeholder="0,00"
              className="w-32 border-b-2 border-tinta bg-transparent py-2 text-right font-mono text-lg text-tinta outline-none placeholder:text-texto-secundario/50 focus:border-ambar"
            />
            <button
              type="button"
              onClick={adicionarPagamento}
              disabled={valorAtual.trim() === ""}
              className="bg-tinta px-4 text-sm font-medium text-papel transition-opacity disabled:opacity-40"
            >
              Adicionar
            </button>
          </div>

          {pagamentos.length > 0 && (
            <ul className="mt-4 flex flex-col">
              {pagamentos.map((p) => (
                <li key={p.chave} className="flex items-center justify-between border-t border-linha py-3 first:border-t-0">
                  <span className="text-base text-tinta">{METODOS.find((m) => m.valor === p.metodo)?.label}</span>
                  <div className="flex items-center gap-4">
                    <span className="font-mono text-sm text-texto-secundario">{formatarMoeda(p.valor)}</span>
                    <button
                      type="button"
                      onClick={() => removerPagamento(p.chave)}
                      className="text-sm text-texto-secundario underline underline-offset-2 hover:text-tinta"
                    >
                      Remover
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}

          {comandas.length > 0 && (
            <p className="mt-3 text-sm text-texto-secundario">
              {faltaCobrir > 0.005
                ? `Falta cobrir ${formatarMoeda(faltaCobrir)}.`
                : faltaCobrir < -0.005
                  ? `Pagamentos ultrapassam o total em ${formatarMoeda(-faltaCobrir)}.`
                  : pagamentos.length > 0
                    ? "Pagamentos cobrem o total."
                    : ""}
            </p>
          )}
        </div>

        <div className="mt-8 flex flex-col gap-4 border-t border-linha pt-6">
          <label className="flex items-center justify-between gap-3">
            <span className="text-sm text-texto-secundario">Imprimir cupom ao fechar?</span>
            <input
              type="checkbox"
              checked={imprimirCupomAoFechar}
              onChange={(e) => setImprimirCupomAoFechar(e.target.checked)}
              className="h-4 w-4 accent-tinta"
            />
          </label>

          <label className="flex items-center justify-between gap-3">
            <span className="text-sm text-texto-secundario">Enviar cupom por e-mail</span>
            <input
              type="checkbox"
              checked={enviarEmail}
              onChange={(e) => setEnviarEmail(e.target.checked)}
              className="h-4 w-4 accent-tinta"
            />
          </label>
          {enviarEmail && (
            <input
              type="email"
              value={emailDestino}
              onChange={(e) => setEmailDestino(e.target.value)}
              placeholder="email@cliente.com"
              className="border-b border-linha bg-transparent py-2 text-sm text-tinta outline-none placeholder:text-texto-secundario/50 focus:border-ambar"
            />
          )}

          <label className="flex items-center justify-between gap-3">
            <span className="text-sm text-texto-secundario">Enviar cupom por WhatsApp</span>
            <input
              type="checkbox"
              checked={enviarWhatsapp}
              onChange={(e) => setEnviarWhatsapp(e.target.checked)}
              className="h-4 w-4 accent-tinta"
            />
          </label>
          {enviarWhatsapp && (
            <input
              type="tel"
              value={whatsappDestino}
              onChange={(e) => setWhatsappDestino(e.target.value)}
              placeholder="(00) 00000-0000"
              className="border-b border-linha bg-transparent py-2 text-sm text-tinta outline-none placeholder:text-texto-secundario/50 focus:border-ambar"
            />
          )}

          {(enviarEmail || enviarWhatsapp) && (
            <p className="text-sm text-texto-secundario">
              TODO: envio por e-mail/WhatsApp ainda não tem endpoint no backend — o destino fica
              só aqui até essa entrega existir (ver CLAUDE.md).
            </p>
          )}
        </div>

        {temNotaAutomatica && (
          <p className="mt-6 text-sm text-texto-secundario">
            Pagamento em cartão/voucher emite NFC-e automaticamente, em segundo plano — o cupom sai
            mesmo se a SEFAZ demorar a responder; confira em Notas Fiscais se precisar confirmar.
          </p>
        )}

        <button
          type="button"
          onClick={() => confirmarPagamento()}
          disabled={!podeConfirmar || confirmando}
          className="mt-8 bg-tinta px-6 py-4 text-base font-medium text-papel transition-opacity disabled:opacity-40"
        >
          {confirmando ? "Fechando…" : "Confirmar pagamento"}
        </button>

        <TestesImpressora />
      </main>
    </div>
  );
}

async function imprimirCupomFechamento(comandas: ComandaFechamento[], pagamentos: PagamentoParcial[], total: number) {
  const conexao = await conectarQZTray();
  if (!conexao.ok) return;

  const linhas = [
    "MERKA",
    "--------------------------------",
    ...comandas.map((c) => `comanda ${c.codigo}  ${formatarMoeda(c.subtotal)}`),
    "--------------------------------",
    `TOTAL  ${formatarMoeda(total)}`,
    ...pagamentos.map((p) => `${METODOS.find((m) => m.valor === p.metodo)?.label}  ${formatarMoeda(p.valor)}`),
  ];

  await imprimirCupom(linhas);
}

// Verificação isolada da impressora — não faz parte do fluxo de
// fechamento, só ajuda o operador a confirmar que o QZ Tray está rodando
// nesta máquina antes de fechar o primeiro pagamento do turno.
function TestesImpressora() {
  const [status, setStatus] = useState<"idle" | "verificando" | "disponivel" | "indisponivel">("idle");
  const [aviso, setAviso] = useState<string | null>(null);

  async function testar() {
    setStatus("verificando");
    setAviso(null);
    const resultado = await conectarQZTray();
    if (!resultado.ok) {
      setStatus("indisponivel");
      setAviso(resultado.motivo);
      return;
    }
    setStatus("disponivel");
  }

  return (
    <div className="mt-10 border-t border-linha pt-6">
      <button
        type="button"
        onClick={testar}
        disabled={status === "verificando"}
        className="text-sm text-texto-secundario underline underline-offset-2 hover:text-tinta"
      >
        {status === "verificando" ? "Verificando impressora…" : "Testar conexão com a impressora"}
      </button>
      {status === "disponivel" && <p className="mt-2 text-sm text-texto-secundario">QZ Tray conectado.</p>}
      {status === "indisponivel" && <p className="mt-2 text-sm text-ambar">{aviso}</p>}
    </div>
  );
}
