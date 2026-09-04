"use client";

import { useEffect, useMemo, useRef, useState, useSyncExternalStore, type FormEvent } from "react";

import { LogoutButton } from "@/components/LogoutButton";
import { conectarBalanca, suportaWebSerial, type LeitorBalanca } from "@/lib/serial-balanca";

type Comanda = {
  ID: string;
  Status: string;
  CodigoFisico: string;
};

type Produto = {
  ID: string;
  Nome: string;
  TipoCobranca: "unitario" | "peso";
  PrecoPorKg: number;
  TaraKg: number;
};

type OrderItem = {
  ID: string;
  ComandaID: string;
  ProductID: string;
  PesoKg: number;
  Valor: number;
  Status: "ativo" | "removido" | "estornado";
  LancadoEm: string;
};

type Lancamento = {
  item: OrderItem;
  codigoComanda: string;
  produtoNome: string;
};

type Resultado =
  | { tipo: "lancado"; lancamento: Lancamento; chave: number }
  | { tipo: "erro"; mensagem: string; chave: number };

// Sem inscrição real (a capacidade do navegador não muda em runtime) — só
// precisamos do snapshot certo em cada lado, sem cair no erro de
// hidratação (server nunca tem `navigator.serial`).
const semInscricao = () => () => {};

function useWebSerialDisponivel(): boolean {
  return useSyncExternalStore(semInscricao, suportaWebSerial, () => false);
}

function formatarMoeda(valor: number) {
  return valor.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

// Traduz o erro cru do backend pro tom de voz da interface: o que houve +
// o que fazer, sempre com o código da comanda na frase. O conflito de
// sincronização (comanda já finalizada) é um caso de negócio específico —
// já vem com mensagem clara do backend (ver
// merka-api/internal/usecase/registrar_peso.go), então só adicionamos o
// código pra contexto.
function mensagemDeErro(codigo: string, erroBackend?: string): string {
  if (erroBackend?.includes("já finalizada")) {
    return `Comanda ${codigo}: ${erroBackend}. Chame o Gestor se isso for inesperado.`;
  }
  if (erroBackend?.includes("não encontrada")) {
    return `Comanda ${codigo} não encontrada. Confira o código e tente de novo.`;
  }
  return `Comanda ${codigo}: ${erroBackend ?? "não foi possível concluir o lançamento"}`;
}

export default function BalancaPage() {
  const [codigo, setCodigo] = useState("");
  const [produtos, setProdutos] = useState<Produto[]>([]);
  const [produtoId, setProdutoId] = useState("");
  const [pesoBruto, setPesoBruto] = useState("");
  const [lancando, setLancando] = useState(false);
  const [resultado, setResultado] = useState<Resultado | null>(null);
  const [historico, setHistorico] = useState<Lancamento[]>([]);
  const [estornoAberto, setEstornoAberto] = useState<string | null>(null);
  const [motivoEstorno, setMotivoEstorno] = useState("");
  const [estornando, setEstornando] = useState(false);
  const [mostrarAjuste, setMostrarAjuste] = useState(false);

  const webSerialDisponivel = useWebSerialDisponivel();
  const [statusBalanca, setStatusBalanca] = useState<"desconectada" | "conectando" | "conectada" | "erro">(
    "desconectada"
  );
  const [erroBalanca, setErroBalanca] = useState<string | null>(null);
  const leitorRef = useRef<LeitorBalanca | null>(null);
  const codigoInputRef = useRef<HTMLInputElement>(null);

  const produtosPeso = useMemo(() => produtos.filter((p) => p.TipoCobranca === "peso"), [produtos]);
  const produto = produtosPeso.find((p) => p.ID === produtoId) ?? produtosPeso[0];

  useEffect(() => {
    fetch("/api/produtos")
      .then((res) => res.json())
      .then((data: Produto[]) => {
        if (Array.isArray(data)) {
          setProdutos(data);
          const primeiro = data.find((p) => p.TipoCobranca === "peso");
          if (primeiro) setProdutoId(primeiro.ID);
        }
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    return () => {
      leitorRef.current?.parar();
    };
  }, []);

  const pesoBrutoNumero = useMemo(() => {
    const valor = parseFloat(pesoBruto.replace(",", "."));
    return Number.isNaN(valor) ? null : valor;
  }, [pesoBruto]);

  const pesoLiquido =
    pesoBrutoNumero !== null && produto ? Math.max(pesoBrutoNumero - produto.TaraKg, 0) : null;
  const valorCalculado = pesoLiquido !== null && produto ? pesoLiquido * produto.PrecoPorKg : null;

  async function conectarLeitor() {
    setStatusBalanca("conectando");
    setErroBalanca(null);

    const leitor = await conectarBalanca(
      (peso) => setPesoBruto(peso.toFixed(3).replace(".", ",")),
      (motivo) => {
        setStatusBalanca("erro");
        setErroBalanca(motivo);
      }
    );

    if (!leitor) {
      setStatusBalanca("erro");
      return;
    }

    leitorRef.current = leitor;
    setStatusBalanca("conectada");
  }

  async function desconectarLeitor() {
    await leitorRef.current?.parar();
    leitorRef.current = null;
    setStatusBalanca("desconectada");
  }

  async function confirmarLancamento(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const codigoAtual = codigo.trim();
    if (codigoAtual === "" || !produto || pesoBrutoNumero === null || pesoBrutoNumero <= 0 || lancando) {
      return;
    }

    setLancando(true);

    try {
      const consulta = await fetch(`/api/comandas/${encodeURIComponent(codigoAtual)}`);
      const dadosConsulta = await consulta.json().catch(() => ({}));

      if (!consulta.ok) {
        setResultado({ tipo: "erro", mensagem: mensagemDeErro(codigoAtual, dadosConsulta.erro), chave: Date.now() });
        return;
      }

      const comanda = dadosConsulta as Comanda;
      const res = await fetch(`/api/comandas/${encodeURIComponent(comanda.ID)}/pesos`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ product_id: produto.ID, peso_bruto: pesoBrutoNumero }),
      });
      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        setResultado({ tipo: "erro", mensagem: mensagemDeErro(codigoAtual, data.erro), chave: Date.now() });
        return;
      }

      const lancamento: Lancamento = {
        item: data as OrderItem,
        codigoComanda: comanda.CodigoFisico,
        produtoNome: produto.Nome,
      };
      setResultado({ tipo: "lancado", lancamento, chave: Date.now() });
      setHistorico((atual) => [lancamento, ...atual]);
    } catch {
      setResultado({
        tipo: "erro",
        mensagem: "Sem conexão com o servidor. Confira a rede e tente de novo.",
        chave: Date.now(),
      });
    } finally {
      setCodigo("");
      setPesoBruto("");
      setLancando(false);
      codigoInputRef.current?.focus();
    }
  }

  async function confirmarEstorno(item: OrderItem) {
    if (motivoEstorno.trim() === "" || estornando) return;
    setEstornando(true);

    try {
      const res = await fetch(`/api/order-items/${encodeURIComponent(item.ID)}/estornar`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ motivo: motivoEstorno.trim() }),
      });
      const data = await res.json().catch(() => ({}));

      if (res.ok) {
        setHistorico((atual) =>
          atual.map((l) => (l.item.ID === item.ID ? { ...l, item: data as OrderItem } : l))
        );
      }
    } finally {
      setEstornando(false);
      setEstornoAberto(null);
      setMotivoEstorno("");
    }
  }

  return (
    <div className="flex min-h-dvh flex-col">
      <header className="flex items-center justify-between border-b border-linha px-6 py-4">
        <div className="flex items-center gap-3">
          {/* eslint-disable-next-line @next/next/no-img-element -- fundo desta tela é sempre Papel (claro), sem modo escuro — ver CLAUDE.md */}
          <img src="/logos/merka-logo.svg" alt="Merka" className="h-6 w-auto" />
          <span className="text-linha">/</span>
          <span className="text-sm text-texto-secundario">Balança</span>
        </div>
        <LogoutButton />
      </header>

      <main className="flex flex-1 flex-col">
        {resultado && (
          <section
            key={resultado.chave}
            className="animate-feedback-in border-b border-linha px-6 py-8 sm:px-10"
          >
            <div className="border-l-2 border-ambar pl-6">
              {resultado.tipo === "erro" ? (
                <>
                  <p className="text-sm font-medium text-ambar">Não foi possível concluir</p>
                  <p className="mt-2 max-w-xl text-xl leading-snug text-tinta sm:text-2xl">
                    {resultado.mensagem}
                  </p>
                </>
              ) : (
                <>
                  <p className="text-sm font-medium text-ambar">Peso lançado</p>
                  <p className="mt-2 font-display text-4xl text-tinta sm:text-5xl">
                    {formatarMoeda(resultado.lancamento.item.Valor)}
                  </p>
                  <p className="mt-2 font-mono text-sm text-texto-secundario">
                    comanda {resultado.lancamento.codigoComanda} · {resultado.lancamento.produtoNome} ·{" "}
                    {resultado.lancamento.item.PesoKg.toFixed(3).replace(".", ",")} kg líquido
                  </p>
                </>
              )}
            </div>
          </section>
        )}

        <div className="grid flex-1 grid-cols-1 lg:grid-cols-[1.1fr_0.9fr]">
          {/* Lançamento (US-09) */}
          <div className="border-b border-linha px-6 py-8 sm:px-10 lg:border-b-0 lg:border-r">
            <form onSubmit={confirmarLancamento} className="flex flex-col gap-6">
              <label className="flex flex-col gap-2">
                <span className="text-sm text-texto-secundario">Código da comanda</span>
                <input
                  ref={codigoInputRef}
                  type="text"
                  value={codigo}
                  onChange={(e) => setCodigo(e.target.value)}
                  placeholder="—"
                  autoFocus
                  autoComplete="off"
                  className="border-b-2 border-tinta bg-transparent pb-2 font-mono text-3xl text-tinta outline-none placeholder:text-texto-secundario/50 focus:border-ambar sm:text-4xl"
                />
              </label>

              <label className="flex flex-col gap-2">
                <span className="text-sm text-texto-secundario">Item</span>
                <select
                  value={produto?.ID ?? ""}
                  onChange={(e) => setProdutoId(e.target.value)}
                  className="border-b border-linha bg-transparent py-2 text-base text-tinta outline-none focus:border-ambar"
                >
                  {produtosPeso.length === 0 && <option value="">Nenhum item por peso cadastrado</option>}
                  {produtosPeso.map((p) => (
                    <option key={p.ID} value={p.ID}>
                      {p.Nome} — {formatarMoeda(p.PrecoPorKg)}/kg
                    </option>
                  ))}
                </select>
              </label>

              <div className="flex flex-col gap-3 border-y border-linha py-5">
                <span className="text-sm text-texto-secundario">Peso bruto (kg)</span>
                {webSerialDisponivel ? (
                  <div className="flex items-center gap-3">
                    {statusBalanca === "conectada" ? (
                      <button
                        type="button"
                        onClick={desconectarLeitor}
                        className="text-sm text-texto-secundario underline underline-offset-2 hover:text-tinta"
                      >
                        Desconectar balança
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={conectarLeitor}
                        disabled={statusBalanca === "conectando"}
                        className="bg-tinta px-4 py-2 text-sm font-medium text-papel transition-opacity disabled:opacity-40"
                      >
                        {statusBalanca === "conectando" ? "Conectando…" : "Conectar balança"}
                      </button>
                    )}
                    <span className="font-mono text-xs text-texto-secundario">
                      {statusBalanca === "conectada" && "lendo continuamente"}
                      {statusBalanca === "desconectada" && "desconectada — digite manualmente"}
                      {statusBalanca === "erro" && "erro de conexão — digite manualmente"}
                    </span>
                  </div>
                ) : (
                  <p className="text-sm text-texto-secundario">
                    Este navegador não lê a balança direto (Web Serial só existe em Chrome/Edge) —
                    digite o peso manualmente abaixo.
                  </p>
                )}

                <input
                  type="text"
                  inputMode="decimal"
                  value={pesoBruto}
                  onChange={(e) => setPesoBruto(e.target.value)}
                  placeholder="0,000"
                  readOnly={statusBalanca === "conectada"}
                  className="border-b-2 border-tinta bg-transparent pb-2 font-mono text-3xl text-tinta outline-none placeholder:text-texto-secundario/50 focus:border-ambar read-only:text-texto-secundario sm:text-4xl"
                />

                {erroBalanca && (
                  <p className="text-sm text-texto-secundario">
                    {erroBalanca} A digitação manual continua funcionando normalmente.
                  </p>
                )}
              </div>

              {produto && (
                <div className="flex flex-col gap-1 font-mono text-sm text-texto-secundario">
                  <div className="flex justify-between">
                    <span>peso bruto</span>
                    <span>{pesoBrutoNumero !== null ? `${pesoBrutoNumero.toFixed(3).replace(".", ",")} kg` : "—"}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>tara ({produto.Nome})</span>
                    <span>− {produto.TaraKg.toFixed(3).replace(".", ",")} kg</span>
                  </div>
                  <div className="flex justify-between">
                    <span>peso líquido</span>
                    <span>{pesoLiquido !== null ? `${pesoLiquido.toFixed(3).replace(".", ",")} kg` : "—"}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>preço/kg vigente</span>
                    <span>{formatarMoeda(produto.PrecoPorKg)}</span>
                  </div>
                  <div className="mt-2 flex items-baseline justify-between border-t border-linha pt-2 text-tinta">
                    <span className="font-sans text-sm text-texto-secundario">valor a lançar</span>
                    <span className="font-display text-3xl text-tinta">
                      {valorCalculado !== null ? formatarMoeda(valorCalculado) : "—"}
                    </span>
                  </div>
                </div>
              )}

              <button
                type="submit"
                disabled={
                  codigo.trim() === "" || !produto || pesoBrutoNumero === null || pesoBrutoNumero <= 0 || lancando
                }
                className="bg-tinta px-6 py-4 text-base font-medium text-papel transition-opacity disabled:opacity-40"
              >
                {lancando ? "Lançando…" : "Lançar peso"}
              </button>
            </form>

            <div className="mt-8">
              <button
                type="button"
                onClick={() => setMostrarAjuste((v) => !v)}
                className="text-sm text-texto-secundario underline underline-offset-2 hover:text-tinta"
              >
                {mostrarAjuste ? "Fechar ajuste de preço/tara" : "Ajustar preço/tara de um produto existente"}
              </button>

              {mostrarAjuste && (
                <AjustePrecoTara
                  produtos={produtosPeso}
                  onAjustado={(atualizado) =>
                    setProdutos((atual) => atual.map((p) => (p.ID === atualizado.ID ? atualizado : p)))
                  }
                />
              )}
            </div>
          </div>

          {/* Histórico / estorno (US-10) */}
          <div className="px-6 py-8 sm:px-10">
            <h2 className="text-sm text-texto-secundario">Lançamentos desta estação</h2>

            {historico.length === 0 ? (
              <p className="mt-4 text-sm text-texto-secundario">Nenhum lançamento ainda nesta sessão.</p>
            ) : (
              <ul className="mt-4 flex flex-col">
                {historico.map((l) => (
                  <li key={l.item.ID} className="border-t border-linha py-4 first:border-t-0">
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <p className="font-mono text-sm text-tinta">
                          comanda {l.codigoComanda} · {l.produtoNome}
                        </p>
                        <p className="mt-1 text-sm text-texto-secundario">
                          {l.item.PesoKg.toFixed(3).replace(".", ",")} kg líquido ·{" "}
                          {l.item.Status === "estornado" ? (
                            <span className="text-ambar">estornado</span>
                          ) : (
                            formatarMoeda(l.item.Valor)
                          )}
                        </p>
                      </div>
                      {l.item.Status === "ativo" && (
                        <button
                          type="button"
                          onClick={() => {
                            setEstornoAberto(estornoAberto === l.item.ID ? null : l.item.ID);
                            setMotivoEstorno("");
                          }}
                          className="shrink-0 text-sm text-texto-secundario underline underline-offset-2 hover:text-tinta"
                        >
                          Estornar
                        </button>
                      )}
                    </div>

                    {estornoAberto === l.item.ID && (
                      <div className="mt-3 flex flex-col gap-3 border-l-2 border-ambar pl-4">
                        <label className="flex flex-col gap-1">
                          <span className="text-sm text-texto-secundario">
                            Motivo do estorno (o lançamento original é preservado, só muda o status)
                          </span>
                          <input
                            type="text"
                            value={motivoEstorno}
                            onChange={(e) => setMotivoEstorno(e.target.value)}
                            autoFocus
                            className="border-b border-linha bg-transparent py-1 text-sm text-tinta outline-none focus:border-ambar"
                          />
                        </label>
                        <div className="flex gap-3">
                          <button
                            type="button"
                            onClick={() => confirmarEstorno(l.item)}
                            disabled={motivoEstorno.trim() === "" || estornando}
                            className="bg-tinta px-4 py-2 text-sm font-medium text-papel transition-opacity disabled:opacity-40"
                          >
                            {estornando ? "Estornando…" : "Confirmar estorno"}
                          </button>
                          <button
                            type="button"
                            onClick={() => setEstornoAberto(null)}
                            className="text-sm text-texto-secundario hover:text-tinta"
                          >
                            Cancelar
                          </button>
                        </div>
                      </div>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}

function AjustePrecoTara({
  produtos,
  onAjustado,
}: {
  produtos: Produto[];
  onAjustado: (produto: Produto) => void;
}) {
  const [produtoId, setProdutoId] = useState(produtos[0]?.ID ?? "");
  const produto = produtos.find((p) => p.ID === produtoId) ?? produtos[0];

  return produto ? (
    <FormularioAjuste
      key={produto.ID}
      produto={produto}
      produtos={produtos}
      onTrocarProduto={setProdutoId}
      onAjustado={onAjustado}
    />
  ) : (
    <p className="mt-4 text-sm text-texto-secundario">Nenhum produto por peso cadastrado ainda.</p>
  );
}

function FormularioAjuste({
  produto,
  produtos,
  onTrocarProduto,
  onAjustado,
}: {
  produto: Produto;
  produtos: Produto[];
  onTrocarProduto: (id: string) => void;
  onAjustado: (produto: Produto) => void;
}) {
  // key={produto.ID} no componente pai remonta este formulário sempre que
  // o produto selecionado muda — os campos já nascem com os valores atuais
  // dele, sem precisar sincronizar via useEffect.
  const [precoPorKg, setPrecoPorKg] = useState(produto.PrecoPorKg.toFixed(2).replace(".", ","));
  const [taraKg, setTaraKg] = useState(produto.TaraKg.toFixed(3).replace(".", ","));
  const [salvando, setSalvando] = useState(false);
  const [mensagem, setMensagem] = useState<string | null>(null);

  async function salvar() {
    if (salvando) return;
    setSalvando(true);
    setMensagem(null);

    try {
      const res = await fetch(`/api/produtos/${encodeURIComponent(produto.ID)}/preco-peso`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          preco_por_kg: parseFloat(precoPorKg.replace(",", ".")),
          tara_kg: parseFloat(taraKg.replace(",", ".")),
        }),
      });
      const data = await res.json().catch(() => ({}));

      if (res.ok) {
        onAjustado(data as Produto);
        setMensagem(`Preço/tara de ${produto.Nome} atualizado.`);
      } else {
        setMensagem(data.erro ?? "não foi possível salvar o ajuste");
      }
    } finally {
      setSalvando(false);
    }
  }

  return (
    <div className="mt-4 flex flex-col gap-4 border-l-2 border-linha pl-4">
      <p className="text-sm text-texto-secundario">
        Isto só ajusta valores de um produto já existente — não cadastra produto novo.
      </p>

      <label className="flex flex-col gap-1">
        <span className="text-sm text-texto-secundario">Produto</span>
        <select
          value={produto.ID}
          onChange={(e) => onTrocarProduto(e.target.value)}
          className="border-b border-linha bg-transparent py-2 text-sm text-tinta outline-none focus:border-ambar"
        >
          {produtos.map((p) => (
            <option key={p.ID} value={p.ID}>
              {p.Nome}
            </option>
          ))}
        </select>
      </label>

      <div className="flex gap-6">
        <label className="flex flex-1 flex-col gap-1">
          <span className="text-sm text-texto-secundario">Preço/kg</span>
          <input
            type="text"
            inputMode="decimal"
            value={precoPorKg}
            onChange={(e) => setPrecoPorKg(e.target.value)}
            className="border-b border-linha bg-transparent py-1 font-mono text-sm text-tinta outline-none focus:border-ambar"
          />
        </label>
        <label className="flex flex-1 flex-col gap-1">
          <span className="text-sm text-texto-secundario">Tara (kg)</span>
          <input
            type="text"
            inputMode="decimal"
            value={taraKg}
            onChange={(e) => setTaraKg(e.target.value)}
            className="border-b border-linha bg-transparent py-1 font-mono text-sm text-tinta outline-none focus:border-ambar"
          />
        </label>
      </div>

      <button
        type="button"
        onClick={salvar}
        disabled={salvando}
        className="self-start bg-tinta px-4 py-2 text-sm font-medium text-papel transition-opacity disabled:opacity-40"
      >
        {salvando ? "Salvando…" : "Salvar ajuste"}
      </button>

      {mensagem && <p className="text-sm text-ambar">{mensagem}</p>}
    </div>
  );
}
