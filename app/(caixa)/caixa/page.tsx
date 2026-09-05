"use client";

import { useEffect, useRef, useState, type FormEvent, type KeyboardEvent } from "react";

import { LogoutButton } from "@/components/LogoutButton";
import { conectarQZTray, imprimirCupom } from "@/lib/qz";

type Comanda = { ID: string; Status: string; CodigoFisico: string };

type OrderItem = {
  ID: string;
  ProductID: string;
  Quantidade: number | null;
  PesoKg: number | null;
  Valor: number;
  Status: "ativo" | "removido" | "estornado";
};

type Produto = {
  ID: string;
  Nome: string;
  TipoCobranca: "unitario" | "peso";
  PrecoUnitario: number;
  CodigoCurto: string | null;
};

type Discount = { ValorAplicado: number };

type FiscalReceipt = {
  PaymentID: string;
  Emitida: boolean;
  EmitidaEm: string | null;
  NumeroNota: string | null;
  ChaveAcesso: string | null;
  MotivoFalha: string | null;
  Cancelada: boolean;
  CanceladaEm: string | null;
  MotivoCancelamento: string | null;
  ProcessadoEm: string;
};

// Cada comanda no fechamento guarda os próprios itens (ativos) — o Caixa
// vê o detalhamento completo, não só um subtotal (é dinheiro real sendo
// conferido, não um resumo). O desconto NÃO é por comanda — é sobre a
// soma de tudo (ver descontoGlobalAplicado em CaixaPage) — por isso essa
// struct não guarda desconto nenhum.
type ComandaFechamento = { id: string; codigo: string; itens: OrderItem[] };

const TIPOS_DESCONTO = [
  { valor: "valor_fixo", label: "Valor fixo (R$)" },
  { valor: "percentual", label: "Percentual (%)" },
] as const;

type TipoDesconto = (typeof TIPOS_DESCONTO)[number]["valor"];

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

function totalItens(itens: OrderItem[]) {
  return itens.filter((i) => i.Status === "ativo").reduce((soma, i) => soma + i.Valor, 0);
}

const METODOS_COM_NOTA_AUTOMATICA: Metodo[] = ["credito", "debito", "voucher"];

export default function CaixaPage() {
  const [codigo, setCodigo] = useState("");
  const [adicionando, setAdicionando] = useState(false);
  const [erroAdicionar, setErroAdicionar] = useState<string | null>(null);
  const [comandas, setComandas] = useState<ComandaFechamento[]>([]);
  const [produtos, setProdutos] = useState<Produto[]>([]);

  const [metodoAtual, setMetodoAtual] = useState<Metodo>("credito");
  const [valorAtual, setValorAtual] = useState("");
  const [valorEditadoManualmente, setValorEditadoManualmente] = useState(false);
  const [pagamentos, setPagamentos] = useState<PagamentoParcial[]>([]);

  // TODO(config-tenant): valor padrão devia vir de uma configuração por
  // tenant (ex: tenants.imprimir_cupom_padrao) — não existe esse campo
  // ainda no backend, então por enquanto o padrão é fixo (true) e some
  // que o operador ajusta manualmente quando quiser.
  const [imprimirCupomAoFechar, setImprimirCupomAoFechar] = useState(true);
  const [enviarEmail, setEnviarEmail] = useState(false);
  const [emailDestino, setEmailDestino] = useState("");

  // CPF/CNPJ é sempre opcional — vale tanto pro cupom simples (NFC-e)
  // quanto pra nota fiscal completa, não é exclusivo de nenhum dos dois.
  const [documentoCliente, setDocumentoCliente] = useState("");
  const [solicitarNotaCompleta, setSolicitarNotaCompleta] = useState(false);
  const [imprimirA4, setImprimirA4] = useState(false);

  const [mostrarDesconto, setMostrarDesconto] = useState(false);
  const [descontoGlobalAplicado, setDescontoGlobalAplicado] = useState(0);

  const [confirmando, setConfirmando] = useState(false);
  const [resultado, setResultado] = useState<Resultado | null>(null);

  const [mostrarNotasEmitidas, setMostrarNotasEmitidas] = useState(false);

  // Contador local em vez de Date.now(): só serve pra dar uma key nova ao
  // painel de resultado (força a animação de entrada a rodar de novo a
  // cada resultado), não precisa ser um timestamp real.
  const proximaChaveRef = useRef(0);
  function proximaChave() {
    proximaChaveRef.current += 1;
    return proximaChaveRef.current;
  }

  useEffect(() => {
    fetch("/api/produtos")
      .then((res) => res.json())
      .then((data: Produto[]) => {
        if (Array.isArray(data)) setProdutos(data.filter((p) => p.TipoCobranca === "unitario"));
      })
      .catch(() => {});
  }, []);

  const totalBruto = comandas.reduce((soma, c) => soma + totalItens(c.itens), 0);
  const total = Math.max(totalBruto - descontoGlobalAplicado, 0);
  const somaPagamentos = pagamentos.reduce((soma, p) => soma + p.valor, 0);
  const faltaCobrir = Math.round((total - somaPagamentos) * 100) / 100;

  // O valor da forma de pagamento já nasce preenchido com o total (ou o
  // que falta cobrir) — o caixa só digita algo diferente quando vai
  // dividir entre mais de um método. É um valor derivado (calculado a
  // cada render a partir de faltaCobrir), não um efeito sincronizando
  // estado: assim que o operador edita à mão, some do "piloto automático"
  // (ver valorEditadoManualmente) até o próximo pagamento adicionado/removido.
  const valorPadrao = faltaCobrir > 0.005 ? faltaCobrir.toFixed(2).replace(".", ",") : "";
  const valorExibido = valorEditadoManualmente ? valorAtual : valorPadrao;

  async function carregarItens(comandaId: string): Promise<OrderItem[]> {
    const res = await fetch(`/api/comandas/${encodeURIComponent(comandaId)}/itens`);
    const data = await res.json().catch(() => []);
    return Array.isArray(data) ? (data as OrderItem[]) : [];
  }

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

      const itens = await carregarItens(comanda.ID);
      setComandas((atual) => [...atual, { id: comanda.ID, codigo: comanda.CodigoFisico, itens }]);
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

  async function recarregarItensComanda(comandaId: string) {
    const itens = await carregarItens(comandaId);
    setComandas((atual) => atual.map((c) => (c.id === comandaId ? { ...c, itens } : c)));
  }

  // Desconto é sobre a SOMA de tudo no fechamento, não sobre uma comanda
  // isolada — mas o endpoint (POST /comandas/:id/desconto) só sabe
  // aplicar a uma comanda específica. Pra manter a matemática correta
  // mesmo com N comandas somadas, o valor em reais é sempre calculado
  // aqui (sobre o total consolidado) e enviado como valor_fixo — nunca
  // deixamos o backend recalcular um percentual em cima de só uma das
  // comandas, o que daria um valor diferente do que o caixa vê na tela.
  async function aplicarDescontoGlobal(tipo: TipoDesconto, valor: number, motivo: string): Promise<string | null> {
    if (comandas.length === 0) return "adicione uma comanda antes de aplicar desconto";

    const valorReais = tipo === "percentual" ? Math.round(((total * valor) / 100) * 100) / 100 : valor;
    const comandaAlvo = comandas[0].id;

    const res = await fetch(`/api/comandas/${encodeURIComponent(comandaAlvo)}/desconto`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ tipo: "valor_fixo", valor: valorReais, motivo }),
    });
    const data = await res.json().catch(() => ({}));

    if (!res.ok) {
      return data.erro ?? "não foi possível aplicar o desconto";
    }

    const discount = data as Discount;
    setDescontoGlobalAplicado((atual) => atual + discount.ValorAplicado);
    return null;
  }

  function adicionarPagamento() {
    const valor = parseFloat(valorExibido.replace(",", "."));
    if (Number.isNaN(valor) || valor <= 0) return;
    setPagamentos((atual) => [...atual, { chave: proximaChave(), metodo: metodoAtual, valor }]);
    setValorEditadoManualmente(false);
  }

  function removerPagamento(chave: number) {
    setPagamentos((atual) => atual.filter((p) => p.chave !== chave));
    setValorEditadoManualmente(false);
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
          documento: documentoCliente.replace(/\D/g, ""),
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

      const paymentIds = (data.payment_ids as string[]) ?? [];

      // Best-effort: a emissão fiscal roda em background (ver
      // merka-api/CLAUDE.md — ExecutarEmBackground), então a nota pode
      // ainda não existir no instante exato do fechamento. Se falhar por
      // esse motivo, o operador tem o caminho confiável (por nota, já
      // emitida) no ícone "Notas fiscais emitidas" — por isso o erro
      // aqui não trava nem aparece pro operador, só não confirma sucesso.
      if (enviarEmail && emailDestino.trim() !== "" && paymentIds.length > 0) {
        fetch(`/api/pagamentos/${encodeURIComponent(paymentIds[0])}/enviar-nota`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ canal: "email", destino: emailDestino.trim() }),
        }).catch(() => {});
      }

      setResultado({
        tipo: "sucesso",
        paymentIds,
        comandas: comandas.map((c) => c.codigo),
        total,
        chave: proximaChave(),
      });
      setComandas([]);
      setPagamentos([]);
      setDescontoGlobalAplicado(0);
      setEnviarEmail(false);
      setEmailDestino("");
      setDocumentoCliente("");
      setSolicitarNotaCompleta(false);
      setImprimirA4(false);
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
  const documentoDigitos = documentoCliente.replace(/\D/g, "");
  const documentoValido = documentoDigitos.length === 0 || documentoDigitos.length === 11 || documentoDigitos.length === 14;
  const podeConfirmar =
    comandas.length > 0 && pagamentos.length > 0 && Math.abs(faltaCobrir) <= 0.005 && documentoValido;

  return (
    <div className="flex min-h-dvh flex-col">
      <header className="flex items-center justify-between border-b border-linha px-6 py-4">
        <div className="flex items-center gap-3">
          {/* eslint-disable-next-line @next/next/no-img-element -- fundo desta tela é sempre Papel (claro), sem modo escuro — ver CLAUDE.md */}
          <img src="/logos/merka-logo.svg" alt="Merka" className="h-6 w-auto" />
          <span className="text-linha">/</span>
          <span className="text-sm text-texto-secundario">Caixa</span>
        </div>
        <div className="flex items-center gap-4">
          <button
            type="button"
            onClick={() => setMostrarNotasEmitidas(true)}
            title="Notas fiscais emitidas"
            aria-label="Notas fiscais emitidas"
            className="text-texto-secundario transition-colors hover:text-tinta"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path
                d="M6 2h9l3 3v17l-3-1.5-2.5 1.5L10 20l-2.5 1.5L5 20V4a2 2 0 0 1 1-2Z"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinejoin="round"
              />
              <path d="M8 8h8M8 12h8M8 16h5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
            </svg>
          </button>
          <LogoutButton />
        </div>
      </header>

      {mostrarNotasEmitidas && <NotasEmitidasPanel onFechar={() => setMostrarNotasEmitidas(false)} />}

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

        <div className="mt-6 flex flex-col">
          {comandas.length === 0 && (
            <p className="py-4 text-sm text-texto-secundario">Nenhuma comanda adicionada ainda.</p>
          )}
          {comandas.map((c) => (
            <ComandaFechamentoRow
              key={c.id}
              comanda={c}
              produtos={produtos}
              onRemoverComanda={() => removerComanda(c.id)}
              onItensAtualizados={() => recarregarItensComanda(c.id)}
            />
          ))}
        </div>

        <div className="mt-4 flex flex-col gap-2 border-y border-linha py-4">
          {descontoGlobalAplicado > 0 && (
            <div className="flex items-baseline justify-between text-sm text-texto-secundario">
              <span>subtotal</span>
              <span>{formatarMoeda(totalBruto)}</span>
            </div>
          )}
          {descontoGlobalAplicado > 0 && (
            <div className="flex items-baseline justify-between text-sm text-texto-secundario">
              <span>desconto aplicado</span>
              <span>− {formatarMoeda(descontoGlobalAplicado)}</span>
            </div>
          )}
          <div className="flex items-baseline justify-between">
            <span className="text-sm text-texto-secundario">total consolidado</span>
            <span className="font-display text-4xl text-ambar">{formatarMoeda(total)}</span>
          </div>

          <button
            type="button"
            onClick={() => setMostrarDesconto((v) => !v)}
            disabled={comandas.length === 0}
            className="mt-1 self-start text-sm text-texto-secundario underline underline-offset-2 hover:text-tinta disabled:opacity-40"
          >
            {mostrarDesconto ? "Fechar desconto" : "Aplicar desconto"}
          </button>
          {mostrarDesconto && (
            <DescontoPanel
              totalAtual={total}
              onAplicar={async (tipo, valor, motivo) => {
                const erro = await aplicarDescontoGlobal(tipo, valor, motivo);
                if (!erro) setMostrarDesconto(false);
                return erro;
              }}
              onCancelar={() => setMostrarDesconto(false)}
            />
          )}
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
              value={valorExibido}
              onChange={(e) => {
                setValorAtual(e.target.value);
                setValorEditadoManualmente(true);
              }}
              placeholder="0,00"
              className="w-32 border-b-2 border-tinta bg-transparent py-2 text-right font-mono text-lg text-tinta outline-none placeholder:text-texto-secundario/50 focus:border-ambar"
            />
            <button
              type="button"
              onClick={adicionarPagamento}
              disabled={valorExibido.trim() === ""}
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
          <label className="flex flex-col gap-1">
            <span className="text-sm text-texto-secundario">CPF ou CNPJ do cliente (opcional)</span>
            <input
              type="text"
              inputMode="numeric"
              value={documentoCliente}
              onChange={(e) => setDocumentoCliente(e.target.value)}
              placeholder="000.000.000-00"
              className="border-b-2 border-tinta bg-transparent py-2 font-mono text-lg text-tinta outline-none placeholder:text-texto-secundario/50 focus:border-ambar"
            />
            {documentoDigitos.length > 0 && !documentoValido && (
              <span className="text-sm text-ambar">CPF tem 11 dígitos, CNPJ tem 14 — confira o número.</span>
            )}
          </label>

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
          {enviarEmail && temNotaAutomatica && (
            <p className="text-sm text-texto-secundario">
              Enviado assim que a nota for confirmada — se a SEFAZ ainda não respondeu no instante do
              fechamento, use &quot;Enviar por e-mail&quot; na nota, em Notas fiscais emitidas.
            </p>
          )}

          <label className="flex items-center justify-between gap-3 opacity-50">
            <span className="text-sm text-texto-secundario">Enviar cupom por WhatsApp</span>
            <input type="checkbox" disabled className="h-4 w-4 accent-tinta" />
          </label>
          <p className="text-sm text-texto-secundario">
            WhatsApp ainda não tem integração com nenhum provedor externo (ex: Twilio, Meta Business
            API) — o backend recusa essa opção explicitamente em vez de fingir que enviou.
          </p>
        </div>

        <div className="mt-6 flex flex-col gap-4 border-t border-linha pt-6">
          <label className="flex items-center justify-between gap-3">
            <span className="text-sm text-texto-secundario">Solicitar nota fiscal completa</span>
            <input
              type="checkbox"
              checked={solicitarNotaCompleta}
              onChange={(e) => setSolicitarNotaCompleta(e.target.checked)}
              className="h-4 w-4 accent-tinta"
            />
          </label>

          {solicitarNotaCompleta && (
            <>
              <label className="flex items-center justify-between gap-3">
                <span className="text-sm text-texto-secundario">Imprimir nota em A4</span>
                <input
                  type="checkbox"
                  checked={imprimirA4}
                  onChange={(e) => setImprimirA4(e.target.checked)}
                  className="h-4 w-4 accent-tinta"
                />
              </label>

              <p className="text-sm text-texto-secundario">
                TODO: não há distinção entre NFC-e e nota fiscal completa no backend (só NFC-e
                modelo 65 está implementado), nem impressão A4/envio por e-mail/WhatsApp da nota
                (ver CLAUDE.md). O CPF/CNPJ acima é enviado de verdade independente desta opção.
              </p>
            </>
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

        <CancelamentoNotaFiscal />

        <TestesImpressora />
      </main>
    </div>
  );
}

function ComandaFechamentoRow({
  comanda,
  produtos,
  onRemoverComanda,
  onItensAtualizados,
}: {
  comanda: ComandaFechamento;
  produtos: Produto[];
  onRemoverComanda: () => void;
  onItensAtualizados: () => void;
}) {
  const [mostrarAdicionar, setMostrarAdicionar] = useState(false);
  const produtosPorId = new Map(produtos.map((p) => [p.ID, p]));
  const itensAtivos = comanda.itens.filter((i) => i.Status === "ativo");
  const subtotal = totalItens(comanda.itens);

  return (
    <div className="border-t border-linha py-3 first:border-t-0">
      <div className="flex items-center justify-between">
        <span className="font-mono text-base text-tinta">comanda {comanda.codigo}</span>
        <div className="flex items-center gap-4">
          <span className="text-sm text-texto-secundario">{formatarMoeda(subtotal)}</span>
          <button
            type="button"
            onClick={() => setMostrarAdicionar((v) => !v)}
            className="text-sm text-texto-secundario underline underline-offset-2 hover:text-tinta"
          >
            Adicionar item
          </button>
          <button
            type="button"
            onClick={onRemoverComanda}
            className="text-sm text-texto-secundario underline underline-offset-2 hover:text-tinta"
          >
            Remover
          </button>
        </div>
      </div>

      <ul className="mt-2 flex flex-col pl-1">
        {itensAtivos.length === 0 && <li className="py-1 text-sm text-texto-secundario">Nenhum item lançado.</li>}
        {itensAtivos.map((item) => {
          const produto = produtosPorId.get(item.ProductID);
          const ehPeso = item.PesoKg !== null;
          return (
            <li key={item.ID} className="flex items-center justify-between py-1 text-sm">
              <span className="text-texto-secundario">
                {produto?.CodigoCurto && <span className="font-mono text-xs">{produto.CodigoCurto} · </span>}
                {produto?.Nome ?? "Produto"}{" "}
                <span className="font-mono text-xs">{ehPeso ? `· ${item.PesoKg!.toFixed(3).replace(".", ",")} kg` : `· ${item.Quantidade} un.`}</span>
              </span>
              <span className="font-mono text-texto-secundario">{formatarMoeda(item.Valor)}</span>
            </li>
          );
        })}
      </ul>

      {mostrarAdicionar && (
        <AdicionarItemPanel
          produtos={produtos}
          onLancar={async (produto, quantidade) => {
            const res = await fetch(`/api/comandas/${encodeURIComponent(comanda.id)}/itens`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ product_id: produto.ID, quantidade }),
            });
            // Não fecha o painel ao lançar com sucesso — o Caixa costuma
            // lançar vários itens em sequência (código + Enter, código +
            // Enter...), igual um leitor de código de barras passando item
            // por item; fechar a cada um quebraria esse ritmo.
            if (res.ok) {
              onItensAtualizados();
            }
            return res.ok ? null : "não foi possível lançar o item";
          }}
        />
      )}
    </div>
  );
}

// AdicionarItemPanel: pensado pro fluxo de caixa registradora — digita o
// código curto do item (ex: "17" pra Água Mineral) e aperta Enter, entra
// na hora, sem confirmar quantidade nem clicar em nada mais. Pra lançar
// mais de uma unidade, é só repetir código + Enter de novo (mesmo
// comportamento de um leitor de código de barras passando o item duas
// vezes). Nome também funciona, pra quando não sabe o código de cor: se
// achar exatamente um produto (por código OU por nome), Enter já lança;
// se achar mais de um por nome, aparece uma lista pra navegar com
// ↑/↓ e confirmar com Enter (ou clicar) — cada linha mostra o código do
// item ao lado do nome, pra quem for decorando os códigos com o uso.
function AdicionarItemPanel({
  produtos,
  onLancar,
}: {
  produtos: Produto[];
  onLancar: (produto: Produto, quantidade: number) => Promise<string | null>;
}) {
  const [entrada, setEntrada] = useState("");
  const [indiceSelecionado, setIndiceSelecionado] = useState(-1);
  const [lancando, setLancando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const termo = entrada.trim().toLowerCase();
  const porCodigo = termo === "" ? undefined : produtos.find((p) => p.CodigoCurto?.toLowerCase() === termo);
  const porNome = termo === "" || porCodigo ? [] : produtos.filter((p) => p.Nome.toLowerCase().includes(termo));

  async function lancar(produto: Produto) {
    setLancando(true);
    setErro(null);
    const erroResposta = await onLancar(produto, 1);
    setLancando(false);
    if (erroResposta) {
      setErro(erroResposta);
    } else {
      setEntrada("");
      setIndiceSelecionado(-1);
      inputRef.current?.focus();
    }
  }

  function onKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (porNome.length === 0) return;
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setIndiceSelecionado((i) => Math.min(i + 1, porNome.length - 1));
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setIndiceSelecionado((i) => Math.max(i - 1, 0));
    }
  }

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (lancando || termo === "") return;
    if (porCodigo) {
      await lancar(porCodigo);
      return;
    }
    // Com 1 só resultado (ex: nome completo digitado) ou nenhuma seta
    // usada ainda, o primeiro item da lista já está pré-destacado — Enter
    // direto lança ele, sem precisar apertar ↓ primeiro.
    const alvo = porNome[Math.max(indiceSelecionado, 0)];
    if (alvo) await lancar(alvo);
  }

  return (
    <form onSubmit={onSubmit} className="mt-3 flex flex-col gap-2 border-l-2 border-ambar pl-4">
      <input
        ref={inputRef}
        type="text"
        value={entrada}
        onChange={(e) => {
          setEntrada(e.target.value);
          setIndiceSelecionado(-1);
        }}
        onKeyDown={onKeyDown}
        placeholder="Código ou nome do item…"
        autoFocus
        autoComplete="off"
        className="border-b-2 border-tinta bg-transparent py-1 font-mono text-lg text-tinta outline-none placeholder:text-texto-secundario/50 focus:border-ambar"
      />

      {termo !== "" && !porCodigo && porNome.length >= 1 && (
        <ul className="flex max-h-52 flex-col overflow-y-auto">
          {porNome.map((p, i) => (
            <li key={p.ID} className="border-t border-linha first:border-t-0">
              <button
                type="button"
                onClick={() => lancar(p)}
                onMouseEnter={() => setIndiceSelecionado(i)}
                className={`flex w-full items-center justify-between py-2 text-left text-sm ${
                  i === Math.max(indiceSelecionado, 0) ? "bg-linha/60" : ""
                }`}
              >
                <span className="text-tinta">
                  {p.CodigoCurto && <span className="font-mono text-xs text-texto-secundario">{p.CodigoCurto} · </span>}
                  {p.Nome}
                </span>
                <span className="font-mono text-texto-secundario">{formatarMoeda(p.PrecoUnitario)}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
      {termo !== "" && !porCodigo && porNome.length === 0 && (
        <p className="text-sm text-texto-secundario">Nada encontrado para &quot;{entrada}&quot;.</p>
      )}
      {erro && <p className="text-sm text-ambar">{erro}</p>}
    </form>
  );
}

async function imprimirCupomFechamento(comandas: ComandaFechamento[], pagamentos: PagamentoParcial[], total: number) {
  const conexao = await conectarQZTray();
  if (!conexao.ok) return;

  const linhas = [
    "MERKA",
    "--------------------------------",
    ...comandas.map((c) => `comanda ${c.codigo}  ${formatarMoeda(totalItens(c.itens))}`),
    "--------------------------------",
    `TOTAL  ${formatarMoeda(total)}`,
    ...pagamentos.map((p) => `${METODOS.find((m) => m.valor === p.metodo)?.label}  ${formatarMoeda(p.valor)}`),
  ];

  await imprimirCupom(linhas);
}

// DescontoPanel: valor fixo ou percentual, motivo sempre obrigatório
// (US-17) — incide sobre o total consolidado do fechamento inteiro, não
// sobre uma comanda isolada.
function DescontoPanel({
  totalAtual,
  onAplicar,
  onCancelar,
}: {
  totalAtual: number;
  onAplicar: (tipo: TipoDesconto, valor: number, motivo: string) => Promise<string | null>;
  onCancelar: () => void;
}) {
  const [tipo, setTipo] = useState<TipoDesconto>("percentual");
  const [valor, setValor] = useState("");
  const [motivo, setMotivo] = useState("");
  const [aplicando, setAplicando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  const valorNumero = parseFloat(valor.replace(",", "."));
  const previa =
    !Number.isNaN(valorNumero) && valorNumero > 0
      ? tipo === "percentual"
        ? (totalAtual * valorNumero) / 100
        : valorNumero
      : null;

  async function confirmar() {
    if (Number.isNaN(valorNumero) || valorNumero <= 0 || motivo.trim() === "" || aplicando) return;
    setAplicando(true);
    setErro(null);
    const erroResposta = await onAplicar(tipo, valorNumero, motivo.trim());
    setAplicando(false);
    if (erroResposta) setErro(erroResposta);
  }

  return (
    <div className="mt-1 flex flex-col gap-3 border-l-2 border-ambar pl-4">
      <div className="flex gap-3">
        <select
          value={tipo}
          onChange={(e) => setTipo(e.target.value as TipoDesconto)}
          className="border-b border-linha bg-transparent py-2 text-sm text-tinta outline-none focus:border-ambar"
        >
          {TIPOS_DESCONTO.map((t) => (
            <option key={t.valor} value={t.valor}>
              {t.label}
            </option>
          ))}
        </select>
        <input
          type="text"
          inputMode="decimal"
          value={valor}
          onChange={(e) => setValor(e.target.value)}
          placeholder={tipo === "percentual" ? "10" : "0,00"}
          autoFocus
          className="w-24 border-b-2 border-tinta bg-transparent py-2 text-right font-mono text-sm text-tinta outline-none placeholder:text-texto-secundario/50 focus:border-ambar"
        />
      </div>

      <input
        type="text"
        value={motivo}
        onChange={(e) => setMotivo(e.target.value)}
        placeholder="Motivo do desconto"
        className="border-b border-linha bg-transparent py-2 text-sm text-tinta outline-none placeholder:text-texto-secundario/50 focus:border-ambar"
      />

      {previa !== null && (
        <p className="text-sm text-texto-secundario">
          Reduz {formatarMoeda(previa)} do total consolidado ({formatarMoeda(Math.max(totalAtual - previa, 0))} restante).
        </p>
      )}

      <div className="flex gap-3">
        <button
          type="button"
          onClick={confirmar}
          disabled={Number.isNaN(valorNumero) || valorNumero <= 0 || motivo.trim() === "" || aplicando}
          className="bg-tinta px-4 py-2 text-sm font-medium text-papel transition-opacity disabled:opacity-40"
        >
          {aplicando ? "Aplicando…" : "Aplicar desconto"}
        </button>
        <button type="button" onClick={onCancelar} className="text-sm text-texto-secundario hover:text-tinta">
          Cancelar
        </button>
      </div>

      {erro && <p className="text-sm text-ambar">{erro}</p>}
    </div>
  );
}

function formatarDataHora(iso: string | null) {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("pt-BR");
}

// NotasEmitidasPanel: ícone no header abre uma lista de TODAS as notas
// fiscais já emitidas (não só de uma comanda específica) — pra conferência
// rápida, sem precisar saber o código de nenhuma comanda de antemão.
// Reaproveita GET /caixa/notas-fiscais (alias de GET /notas-fiscais sob a
// permissão que o Caixa já tem — ver merka-api/internal/handler/report_handler.go)
// e a mesma linha/ação de cancelamento já usada na busca por comanda.
function NotasEmitidasPanel({ onFechar }: { onFechar: () => void }) {
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const [notas, setNotas] = useState<FiscalReceipt[]>([]);

  useEffect(() => {
    fetch("/api/caixa/notas-fiscais?limit=50")
      .then((res) => res.json().then((data) => ({ ok: res.ok, data })))
      .then(({ ok, data }) => {
        if (!ok) {
          setErro(data.erro ?? "não foi possível carregar as notas fiscais");
          return;
        }
        setNotas(Array.isArray(data.itens) ? data.itens : []);
      })
      .catch(() => setErro("Sem conexão com o servidor. Confira a rede e tente de novo."))
      .finally(() => setCarregando(false));
  }, []);

  return (
    <div className="fixed inset-0 z-10 flex flex-col bg-papel">
      <header className="flex items-center justify-between border-b border-linha px-6 py-4">
        <button type="button" onClick={onFechar} className="text-sm text-texto-secundario hover:text-tinta">
          ← Voltar
        </button>
        <span className="text-sm text-texto-secundario">Notas fiscais emitidas</span>
      </header>

      <main className="mx-auto w-full max-w-2xl flex-1 overflow-y-auto px-6 py-8">
        {carregando && <p className="text-sm text-texto-secundario">Carregando…</p>}
        {erro && <p className="text-sm text-ambar">{erro}</p>}
        {!carregando && !erro && notas.length === 0 && (
          <p className="text-sm text-texto-secundario">Nenhuma nota fiscal emitida ainda.</p>
        )}
        {!carregando && !erro && notas.length > 0 && (
          <ul className="flex flex-col">
            {notas.map((nota) => (
              <NotaFiscalRow key={nota.PaymentID} nota={nota} />
            ))}
          </ul>
        )}
      </main>
    </div>
  );
}

// CancelamentoNotaFiscal (US-22): localiza a(s) nota(s) fiscal(is) de uma
// comanda pelo código e cancela dentro do prazo. Seção separada do
// fluxo de fechamento — cancelar uma nota já emitida é uma ação de
// correção sobre algo que já aconteceu, não parte de fechar um pagamento
// novo.
function CancelamentoNotaFiscal() {
  const [aberto, setAberto] = useState(false);
  const [codigo, setCodigo] = useState("");
  const [buscando, setBuscando] = useState(false);
  const [erroBusca, setErroBusca] = useState<string | null>(null);
  const [notas, setNotas] = useState<FiscalReceipt[] | null>(null);
  const [codigoConsultado, setCodigoConsultado] = useState("");

  async function buscar(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const codigoAtual = codigo.trim();
    if (codigoAtual === "" || buscando) return;

    setBuscando(true);
    setErroBusca(null);
    setNotas(null);

    try {
      const res = await fetch(`/api/comandas/${encodeURIComponent(codigoAtual)}`);
      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        setErroBusca(
          data.erro?.includes("não encontrada")
            ? `Comanda ${codigoAtual} não encontrada. Confira o código e tente de novo.`
            : `Comanda ${codigoAtual}: ${data.erro ?? "não foi possível consultar"}`
        );
        return;
      }

      const comanda = data as Comanda;
      const notasRes = await fetch(`/api/comandas/${encodeURIComponent(comanda.ID)}/notas-fiscais`);
      const notasData = await notasRes.json().catch(() => []);

      if (!notasRes.ok) {
        setErroBusca((notasData as { erro?: string }).erro ?? "não foi possível consultar as notas fiscais");
        return;
      }

      setNotas(Array.isArray(notasData) ? (notasData as FiscalReceipt[]) : []);
      setCodigoConsultado(comanda.CodigoFisico);
    } catch {
      setErroBusca("Sem conexão com o servidor. Confira a rede e tente de novo.");
    } finally {
      setBuscando(false);
    }
  }

  return (
    <div className="mt-10 border-t border-linha pt-6">
      <button
        type="button"
        onClick={() => setAberto((v) => !v)}
        className="text-sm text-texto-secundario underline underline-offset-2 hover:text-tinta"
      >
        {aberto ? "Fechar cancelamento de nota fiscal" : "Cancelar nota fiscal já emitida"}
      </button>

      {aberto && (
        <div className="mt-4 flex flex-col gap-4">
          <form onSubmit={buscar} className="flex flex-col gap-2">
            <span className="text-sm text-texto-secundario">Buscar pelo código da comanda</span>
            <div className="flex gap-3">
              <input
                type="text"
                value={codigo}
                onChange={(e) => setCodigo(e.target.value)}
                placeholder="—"
                autoComplete="off"
                className="flex-1 border-b-2 border-tinta bg-transparent pb-2 font-mono text-xl text-tinta outline-none placeholder:text-texto-secundario/50 focus:border-ambar"
              />
              <button
                type="submit"
                disabled={codigo.trim() === "" || buscando}
                className="bg-tinta px-4 text-sm font-medium text-papel transition-opacity disabled:opacity-40"
              >
                {buscando ? "Buscando…" : "Buscar"}
              </button>
            </div>
            {erroBusca && <p className="text-sm text-ambar">{erroBusca}</p>}
          </form>

          {notas !== null && (
            <div>
              {notas.length === 0 ? (
                <p className="text-sm text-texto-secundario">
                  Nenhuma nota fiscal encontrada pra comanda {codigoConsultado}.
                </p>
              ) : (
                <ul className="flex flex-col">
                  {notas.map((nota) => (
                    <NotaFiscalRow key={nota.PaymentID} nota={nota} />
                  ))}
                </ul>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function NotaFiscalRow({ nota }: { nota: FiscalReceipt }) {
  const [mostrarCancelar, setMostrarCancelar] = useState(false);
  const [justificativa, setJustificativa] = useState("");
  const [cancelando, setCancelando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [cancelada, setCancelada] = useState(nota.Cancelada);

  const [mostrarEnviar, setMostrarEnviar] = useState(false);
  const [emailDestino, setEmailDestino] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [erroEnvio, setErroEnvio] = useState<string | null>(null);
  const [enviado, setEnviado] = useState(false);

  async function confirmarCancelamento() {
    if (justificativa.trim().length < 15 || cancelando) return;
    setCancelando(true);
    setErro(null);

    const res = await fetch(`/api/pagamentos/${encodeURIComponent(nota.PaymentID)}/cancelar-nota`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ justificativa: justificativa.trim() }),
    });

    setCancelando(false);
    if (res.ok) {
      setCancelada(true);
      setMostrarCancelar(false);
    } else {
      const data = await res.json().catch(() => ({}));
      setErro(data.erro ?? "não foi possível cancelar a nota");
    }
  }

  async function confirmarEnvio() {
    if (emailDestino.trim() === "" || enviando) return;
    setEnviando(true);
    setErroEnvio(null);

    const res = await fetch(`/api/pagamentos/${encodeURIComponent(nota.PaymentID)}/enviar-nota`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ canal: "email", destino: emailDestino.trim() }),
    });

    setEnviando(false);
    if (res.ok) {
      setEnviado(true);
      setMostrarEnviar(false);
    } else {
      const data = await res.json().catch(() => ({}));
      setErroEnvio(data.erro ?? "não foi possível enviar o e-mail");
    }
  }

  return (
    <li className="border-t border-linha py-4 first:border-t-0">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="font-mono text-sm text-tinta">
            {nota.Emitida ? `NFC-e nº ${nota.NumeroNota ?? "—"}` : "Emissão não concluída"}
          </p>
          <p className="mt-1 text-sm text-texto-secundario">
            emitida em {formatarDataHora(nota.EmitidaEm)}
            {cancelada && <span className="text-ambar"> · cancelada em {formatarDataHora(nota.CanceladaEm)}</span>}
            {!nota.Emitida && nota.MotivoFalha && <span> · {nota.MotivoFalha}</span>}
            {enviado && <span className="text-ambar"> · reenviada por e-mail</span>}
          </p>
        </div>
        <div className="flex shrink-0 gap-4">
          {nota.Emitida && (
            <button
              type="button"
              onClick={() => setMostrarEnviar((v) => !v)}
              className="text-sm text-texto-secundario underline underline-offset-2 hover:text-tinta"
            >
              Enviar por e-mail
            </button>
          )}
          {nota.Emitida && !cancelada && (
            <button
              type="button"
              onClick={() => setMostrarCancelar((v) => !v)}
              className="text-sm text-texto-secundario underline underline-offset-2 hover:text-tinta"
            >
              Cancelar nota
            </button>
          )}
        </div>
      </div>

      {mostrarEnviar && (
        <div className="mt-3 flex flex-col gap-3 border-l-2 border-ambar pl-4">
          <label className="flex flex-col gap-1">
            <span className="text-sm text-texto-secundario">E-mail de destino</span>
            <input
              type="email"
              value={emailDestino}
              onChange={(e) => setEmailDestino(e.target.value)}
              autoFocus
              className="border-b border-linha bg-transparent py-1 text-sm text-tinta outline-none focus:border-ambar"
            />
          </label>
          <div className="flex gap-3">
            <button
              type="button"
              onClick={confirmarEnvio}
              disabled={emailDestino.trim() === "" || enviando}
              className="bg-tinta px-4 py-2 text-sm font-medium text-papel transition-opacity disabled:opacity-40"
            >
              {enviando ? "Enviando…" : "Enviar"}
            </button>
            <button type="button" onClick={() => setMostrarEnviar(false)} className="text-sm text-texto-secundario hover:text-tinta">
              Cancelar
            </button>
          </div>
          {erroEnvio && <p className="text-sm text-ambar">{erroEnvio}</p>}
        </div>
      )}

      {mostrarCancelar && (
        <div className="mt-3 flex flex-col gap-3 border-l-2 border-ambar pl-4">
          <label className="flex flex-col gap-1">
            <span className="text-sm text-texto-secundario">
              Justificativa (15 a 255 caracteres, exigido pela SEFAZ)
            </span>
            <input
              type="text"
              value={justificativa}
              onChange={(e) => setJustificativa(e.target.value)}
              autoFocus
              className="border-b border-linha bg-transparent py-1 text-sm text-tinta outline-none focus:border-ambar"
            />
          </label>
          <div className="flex gap-3">
            <button
              type="button"
              onClick={confirmarCancelamento}
              disabled={justificativa.trim().length < 15 || cancelando}
              className="bg-tinta px-4 py-2 text-sm font-medium text-papel transition-opacity disabled:opacity-40"
            >
              {cancelando ? "Cancelando…" : "Confirmar cancelamento"}
            </button>
            <button
              type="button"
              onClick={() => setMostrarCancelar(false)}
              className="text-sm text-texto-secundario hover:text-tinta"
            >
              Voltar
            </button>
          </div>
          {erro && <p className="text-sm text-ambar">{erro}</p>}
        </div>
      )}
    </li>
  );
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
