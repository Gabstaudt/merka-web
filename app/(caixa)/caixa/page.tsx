"use client";

import { useRef, useState, type FormEvent } from "react";

import { LogoutButton } from "@/components/LogoutButton";
import { conectarQZTray, imprimirCupom } from "@/lib/qz";

type Comanda = { ID: string; Status: string; CodigoFisico: string };
type OrderItem = { Valor: number; Status: "ativo" | "removido" | "estornado" };
type Discount = { ValorAplicado: number };

// subtotal = itensTotal - descontoAplicado. Guardamos os dois separados
// (não só o resultado) porque um desconto percentual "congela" em cima do
// itensTotal no momento em que é aplicado — se aplicar um segundo
// desconto depois, ele incide sobre o que sobrou, não sobre o valor já
// líquido (mesmo comportamento do backend, ver
// merka-api/internal/usecase/aplicar_desconto.go).
type ComandaFechamento = { id: string; codigo: string; itensTotal: number; descontoAplicado: number };

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

  const [solicitarNotaCompleta, setSolicitarNotaCompleta] = useState(false);
  const [documentoCliente, setDocumentoCliente] = useState("");
  const [imprimirA4, setImprimirA4] = useState(false);

  const [descontoAbertoPara, setDescontoAbertoPara] = useState<string | null>(null);

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

  const total = comandas.reduce((soma, c) => soma + (c.itensTotal - c.descontoAplicado), 0);
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
      const itensTotal = Array.isArray(itensData)
        ? (itensData as OrderItem[]).filter((i) => i.Status === "ativo").reduce((soma, i) => soma + i.Valor, 0)
        : 0;

      setComandas((atual) => [...atual, { id: comanda.ID, codigo: comanda.CodigoFisico, itensTotal, descontoAplicado: 0 }]);
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

  async function aplicarDesconto(
    comandaId: string,
    tipo: TipoDesconto,
    valor: number,
    motivo: string
  ): Promise<string | null> {
    const res = await fetch(`/api/comandas/${encodeURIComponent(comandaId)}/desconto`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ tipo, valor, motivo }),
    });
    const data = await res.json().catch(() => ({}));

    if (!res.ok) {
      return data.erro ?? "não foi possível aplicar o desconto";
    }

    const discount = data as Discount;
    setComandas((atual) =>
      atual.map((c) => (c.id === comandaId ? { ...c, descontoAplicado: c.descontoAplicado + discount.ValorAplicado } : c))
    );
    return null;
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
          documento: solicitarNotaCompleta ? documentoCliente.replace(/\D/g, "") : "",
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
      setSolicitarNotaCompleta(false);
      setDocumentoCliente("");
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
  const documentoValido = documentoDigitos.length === 11 || documentoDigitos.length === 14;
  const podeConfirmar =
    comandas.length > 0 &&
    pagamentos.length > 0 &&
    Math.abs(faltaCobrir) <= 0.005 &&
    (!solicitarNotaCompleta || documentoValido);

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
            <li key={c.id} className="border-t border-linha py-3 first:border-t-0">
              <div className="flex items-center justify-between">
                <span className="font-mono text-base text-tinta">comanda {c.codigo}</span>
                <div className="flex items-center gap-4">
                  <span className="text-sm text-texto-secundario">
                    {c.descontoAplicado > 0 && (
                      <span className="mr-2 line-through">{formatarMoeda(c.itensTotal)}</span>
                    )}
                    {formatarMoeda(c.itensTotal - c.descontoAplicado)}
                  </span>
                  <button
                    type="button"
                    onClick={() => setDescontoAbertoPara(descontoAbertoPara === c.id ? null : c.id)}
                    className="text-sm text-texto-secundario underline underline-offset-2 hover:text-tinta"
                  >
                    Desconto
                  </button>
                  <button
                    type="button"
                    onClick={() => removerComanda(c.id)}
                    className="text-sm text-texto-secundario underline underline-offset-2 hover:text-tinta"
                  >
                    Remover
                  </button>
                </div>
              </div>

              {descontoAbertoPara === c.id && (
                <DescontoPanel
                  totalAtual={c.itensTotal - c.descontoAplicado}
                  onAplicar={async (tipo, valor, motivo) => {
                    const erro = await aplicarDesconto(c.id, tipo, valor, motivo);
                    if (!erro) setDescontoAbertoPara(null);
                    return erro;
                  }}
                  onCancelar={() => setDescontoAbertoPara(null)}
                />
              )}
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
              <label className="flex flex-col gap-1">
                <span className="text-sm text-texto-secundario">CPF ou CNPJ do cliente</span>
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
                <span className="text-sm text-texto-secundario">Imprimir nota em A4</span>
                <input
                  type="checkbox"
                  checked={imprimirA4}
                  onChange={(e) => setImprimirA4(e.target.checked)}
                  className="h-4 w-4 accent-tinta"
                />
              </label>

              <p className="text-sm text-texto-secundario">
                TODO: o CPF/CNPJ é enviado de verdade e chega até a emissão fiscal quando o
                pagamento é em cartão/débito/voucher. O restante ainda não existe no backend — não
                há distinção entre NFC-e e nota fiscal completa (só NFC-e modelo 65 está
                implementado), nem impressão A4/envio por e-mail/WhatsApp da nota (ver CLAUDE.md).
                {!temNotaAutomatica &&
                  " Nenhuma forma de pagamento adicionada aqui dispara emissão automática — sem cartão/débito/voucher, nenhuma nota sai."}
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
    ...comandas.map((c) => `comanda ${c.codigo}  ${formatarMoeda(c.itensTotal - c.descontoAplicado)}`),
    "--------------------------------",
    `TOTAL  ${formatarMoeda(total)}`,
    ...pagamentos.map((p) => `${METODOS.find((m) => m.valor === p.metodo)?.label}  ${formatarMoeda(p.valor)}`),
  ];

  await imprimirCupom(linhas);
}

// DescontoPanel: valor fixo ou percentual, motivo sempre obrigatório
// (US-17) — o backend rejeita sem motivo e rejeita se o desconto deixaria
// o total negativo; ambos os erros já vêm com mensagem clara do backend.
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
    <div className="mt-3 flex flex-col gap-3 border-l-2 border-ambar pl-4">
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
          Reduz {formatarMoeda(previa)} do total desta comanda ({formatarMoeda(Math.max(totalAtual - previa, 0))}
          {" "}restante).
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
