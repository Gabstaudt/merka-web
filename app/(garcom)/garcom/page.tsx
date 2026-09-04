"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from "react";

import { LogoutButton } from "@/components/LogoutButton";
import { useMerkaSocket, type EventoWS } from "@/lib/useMerkaSocket";

type Mesa = {
  id: string;
  identificador: string;
  comanda_id: string | null;
  codigo_fisico: string | null;
};

type Comanda = {
  ID: string;
  Status: string;
  CodigoFisico: string;
  TableID: string | null;
};

type Produto = {
  ID: string;
  Nome: string;
  TipoCobranca: "unitario" | "peso";
  PrecoUnitario: number;
};

type OrderItem = {
  ID: string;
  ComandaID: string;
  ProductID: string;
  Quantidade: number | null;
  PesoKg: number | null;
  Valor: number;
  Status: "ativo" | "removido" | "estornado";
  LancadoEm: string;
};

type Resultado = { tipo: "sucesso"; mensagem: string; chave: number } | { tipo: "erro"; mensagem: string; chave: number };

function formatarMoeda(valor: number) {
  return valor.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

// Mesmo tratamento de conflito de sincronização usado na Balança — a
// comanda já finalizada é um caso de negócio específico, não erro
// genérico (ver merka-api/internal/usecase/lancar_item.go).
function mensagemDeErro(codigo: string, erroBackend?: string): string {
  if (erroBackend?.includes("já finalizada")) {
    return `Comanda ${codigo}: ${erroBackend}. Chame o Gestor se isso for inesperado.`;
  }
  if (erroBackend?.includes("não encontrada")) {
    return `Comanda ${codigo} não encontrada. Confira o código e tente de novo.`;
  }
  return `Comanda ${codigo}: ${erroBackend ?? "não foi possível concluir"}`;
}

export default function GarcomPage() {
  const [mesas, setMesas] = useState<Mesa[]>([]);
  const [produtos, setProdutos] = useState<Produto[]>([]);
  const [comandaAberta, setComandaAberta] = useState<Comanda | null>(null);
  const [itens, setItens] = useState<OrderItem[]>([]);
  const [codigoBusca, setCodigoBusca] = useState("");
  const [buscando, setBuscando] = useState(false);
  const [resultado, setResultado] = useState<Resultado | null>(null);

  const produtosUnitario = useMemo(() => produtos.filter((p) => p.TipoCobranca === "unitario"), [produtos]);
  const produtosPorId = useMemo(() => new Map(produtos.map((p) => [p.ID, p])), [produtos]);
  const mesaAtual = mesas.find((m) => m.comanda_id === comandaAberta?.ID) ?? null;

  const carregarMesas = useCallback(() => {
    fetch("/api/mesas")
      .then((res) => res.json())
      .then((data: Mesa[]) => {
        if (Array.isArray(data)) setMesas(data);
      })
      .catch(() => {});
  }, []);

  const carregarItens = useCallback((comandaId: string) => {
    fetch(`/api/comandas/${encodeURIComponent(comandaId)}/itens`)
      .then((res) => res.json())
      .then((data: OrderItem[]) => {
        if (Array.isArray(data)) setItens(data);
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    carregarMesas();
    fetch("/api/produtos")
      .then((res) => res.json())
      .then((data: Produto[]) => {
        if (Array.isArray(data)) setProdutos(data);
      })
      .catch(() => {});
  }, [carregarMesas]);

  // Tempo real (US-11/US-12): se a Balança lançar um peso — ou outro
  // garçom lançar/remover um item — nesta mesma comanda enquanto a tela
  // está aberta, atualiza sozinho, sem precisar de refresh manual.
  useMerkaSocket(
    useCallback(
      (evento: EventoWS) => {
        if (evento.tipo !== "comanda_atualizada") return;
        const payload = evento.payload as { comanda_id?: string };
        if (comandaAberta && payload.comanda_id === comandaAberta.ID) {
          carregarItens(comandaAberta.ID);
        }
        carregarMesas();
      },
      [comandaAberta, carregarItens, carregarMesas]
    )
  );

  function abrirComandaSelecionada(comanda: Comanda) {
    setComandaAberta(comanda);
    setResultado(null);
    carregarItens(comanda.ID);
  }

  async function buscarComanda(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const codigo = codigoBusca.trim();
    if (codigo === "" || buscando) return;

    setBuscando(true);
    try {
      const res = await fetch(`/api/comandas/${encodeURIComponent(codigo)}`);
      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        setResultado({ tipo: "erro", mensagem: mensagemDeErro(codigo, data.erro), chave: Date.now() });
        return;
      }

      const comanda = data as Comanda;
      if (comanda.Status !== "em_uso") {
        setResultado({
          tipo: "erro",
          mensagem:
            comanda.Status === "disponivel"
              ? `Comanda ${codigo} ainda não foi entregue ao cliente pelo porteiro.`
              : mensagemDeErro(codigo, "comanda já finalizada — lançamento rejeitado e alerta enviado ao Gestor"),
          chave: Date.now(),
        });
        return;
      }

      abrirComandaSelecionada(comanda);
      setCodigoBusca("");
    } catch {
      setResultado({
        tipo: "erro",
        mensagem: "Sem conexão com o servidor. Confira a rede e tente de novo.",
        chave: Date.now(),
      });
    } finally {
      setBuscando(false);
    }
  }

  const mesasAtivas = mesas.filter((m) => m.comanda_id !== null);
  const totalParcial = itens.filter((i) => i.Status === "ativo").reduce((soma, i) => soma + i.Valor, 0);

  if (!comandaAberta) {
    return (
      <div className="flex min-h-dvh flex-col">
        <header className="flex items-center justify-between border-b border-linha px-6 py-4">
          <div className="flex items-center gap-3">
            {/* eslint-disable-next-line @next/next/no-img-element -- fundo desta tela é sempre Papel (claro), sem modo escuro — ver CLAUDE.md */}
            <img src="/logos/merka-logo.svg" alt="Merka" className="h-6 w-auto" />
            <span className="text-linha">/</span>
            <span className="text-sm text-texto-secundario">Garçom</span>
          </div>
          <LogoutButton />
        </header>

        <main className="mx-auto flex w-full max-w-xl flex-1 flex-col px-6 py-8">
          {resultado && (
            <div key={resultado.chave} className="animate-feedback-in mb-8 border-l-2 border-ambar pl-6">
              <p className="text-sm font-medium text-ambar">
                {resultado.tipo === "erro" ? "Não foi possível abrir" : "Feito"}
              </p>
              <p className="mt-2 text-lg leading-snug text-tinta">{resultado.mensagem}</p>
            </div>
          )}

          <form onSubmit={buscarComanda} className="flex flex-col gap-2">
            <span className="text-sm text-texto-secundario">Buscar comanda pelo código</span>
            <div className="flex gap-3">
              <input
                type="text"
                value={codigoBusca}
                onChange={(e) => setCodigoBusca(e.target.value)}
                placeholder="—"
                autoComplete="off"
                className="flex-1 border-b-2 border-tinta bg-transparent pb-2 font-mono text-2xl text-tinta outline-none placeholder:text-texto-secundario/50 focus:border-ambar"
              />
              <button
                type="submit"
                disabled={codigoBusca.trim() === "" || buscando}
                className="bg-tinta px-5 text-sm font-medium text-papel transition-opacity disabled:opacity-40"
              >
                {buscando ? "Abrindo…" : "Abrir"}
              </button>
            </div>
          </form>

          <h2 className="mt-10 text-sm text-texto-secundario">Mesas em atendimento</h2>
          {mesasAtivas.length === 0 ? (
            <p className="mt-4 text-sm text-texto-secundario">Nenhuma mesa com comanda em uso agora.</p>
          ) : (
            <ul className="mt-4 flex flex-col">
              {mesasAtivas.map((m) => (
                <li key={m.id} className="border-t border-linha first:border-t-0">
                  <button
                    type="button"
                    onClick={() =>
                      abrirComandaSelecionada({
                        ID: m.comanda_id as string,
                        Status: "em_uso",
                        CodigoFisico: m.codigo_fisico as string,
                        TableID: m.id,
                      })
                    }
                    className="flex w-full items-center justify-between py-4 text-left"
                  >
                    <span className="text-lg text-tinta">{m.identificador}</span>
                    <span className="font-mono text-sm text-texto-secundario">comanda {m.codigo_fisico}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </main>
      </div>
    );
  }

  return (
    <ComandaAbertaView
      comanda={comandaAberta}
      mesaIdentificador={mesaAtual?.identificador ?? null}
      itens={itens}
      produtosUnitario={produtosUnitario}
      produtosPorId={produtosPorId}
      mesas={mesas}
      totalParcial={totalParcial}
      onVoltar={() => {
        setComandaAberta(null);
        carregarMesas();
      }}
      onItensAtualizados={() => carregarItens(comandaAberta.ID)}
      onMesaTransferida={(novaMesaId) => {
        setComandaAberta({ ...comandaAberta, TableID: novaMesaId });
        carregarMesas();
      }}
    />
  );
}

function ComandaAbertaView({
  comanda,
  mesaIdentificador,
  itens,
  produtosUnitario,
  produtosPorId,
  mesas,
  totalParcial,
  onVoltar,
  onItensAtualizados,
  onMesaTransferida,
}: {
  comanda: Comanda;
  mesaIdentificador: string | null;
  itens: OrderItem[];
  produtosUnitario: Produto[];
  produtosPorId: Map<string, Produto>;
  mesas: Mesa[];
  totalParcial: number;
  onVoltar: () => void;
  onItensAtualizados: () => void;
  onMesaTransferida: (novaMesaId: string) => void;
}) {
  const [resultado, setResultado] = useState<Resultado | null>(null);
  const [produtoId, setProdutoId] = useState(produtosUnitario[0]?.ID ?? "");
  const [quantidade, setQuantidade] = useState("1");
  const [adicionando, setAdicionando] = useState(false);
  const [removendoId, setRemovendoId] = useState<string | null>(null);
  const [motivoRemocao, setMotivoRemocao] = useState("");
  const [mostrarTransferencia, setMostrarTransferencia] = useState(false);
  const codigoInputRef = useRef<HTMLSelectElement>(null);

  async function adicionarItem(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const produto = produtosUnitario.find((p) => p.ID === produtoId);
    const qtd = parseFloat(quantidade.replace(",", "."));
    if (!produto || Number.isNaN(qtd) || qtd <= 0 || adicionando) return;

    setAdicionando(true);
    try {
      const res = await fetch(`/api/comandas/${encodeURIComponent(comanda.ID)}/itens`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ product_id: produto.ID, quantidade: qtd }),
      });
      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        setResultado({ tipo: "erro", mensagem: mensagemDeErro(comanda.CodigoFisico, data.erro), chave: Date.now() });
      } else {
        setResultado({
          tipo: "sucesso",
          mensagem: `${produto.Nome} lançado — ${formatarMoeda((data as OrderItem).Valor)}.`,
          chave: Date.now(),
        });
        onItensAtualizados();
        setQuantidade("1");
      }
    } finally {
      setAdicionando(false);
    }
  }

  async function confirmarRemocao(item: OrderItem) {
    if (motivoRemocao.trim() === "") return;

    const res = await fetch(`/api/order-items/${encodeURIComponent(item.ID)}/remover`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ motivo: motivoRemocao.trim() }),
    });

    if (res.ok) {
      onItensAtualizados();
    }
    setRemovendoId(null);
    setMotivoRemocao("");
  }

  return (
    <div className="flex min-h-dvh flex-col">
      <header className="flex items-center justify-between border-b border-linha px-6 py-4">
        <button type="button" onClick={onVoltar} className="text-sm text-texto-secundario hover:text-tinta">
          ← Mesas
        </button>
        <LogoutButton />
      </header>

      <main className="mx-auto flex w-full max-w-xl flex-1 flex-col px-6 py-8">
        <div>
          <p className="text-sm text-texto-secundario">{mesaIdentificador ?? "Sem mesa associada"}</p>
          <p className="font-mono text-2xl text-tinta">comanda {comanda.CodigoFisico}</p>
        </div>

        {resultado && (
          <div key={resultado.chave} className="animate-feedback-in mt-6 border-l-2 border-ambar pl-6">
            <p className="text-sm font-medium text-ambar">
              {resultado.tipo === "erro" ? "Não foi possível concluir" : "Lançado"}
            </p>
            <p className="mt-1 text-base leading-snug text-tinta">{resultado.mensagem}</p>
          </div>
        )}

        <div className="mt-8 flex items-baseline justify-between border-y border-linha py-4">
          <span className="text-sm text-texto-secundario">total parcial</span>
          <span className="font-display text-3xl text-ambar">{formatarMoeda(totalParcial)}</span>
        </div>

        <ul className="mt-2 flex flex-col">
          {itens.length === 0 && <li className="py-4 text-sm text-texto-secundario">Nenhum item lançado ainda.</li>}
          {itens.map((item) => {
            const produto = produtosPorId.get(item.ProductID);
            const ehPeso = item.PesoKg !== null;
            return (
              <li key={item.ID} className="border-t border-linha py-4 first:border-t-0">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="text-base text-tinta">
                      {produto?.Nome ?? "Produto"}{" "}
                      <span className="font-mono text-xs text-texto-secundario">
                        {ehPeso ? "· peso" : "· unidade"}
                      </span>
                    </p>
                    <p className="mt-1 text-sm text-texto-secundario">
                      {ehPeso
                        ? `${item.PesoKg!.toFixed(3).replace(".", ",")} kg líquido`
                        : `${item.Quantidade} un.`}{" "}
                      ·{" "}
                      {item.Status === "ativo" ? (
                        formatarMoeda(item.Valor)
                      ) : (
                        <span className="text-ambar">{item.Status}</span>
                      )}
                    </p>
                  </div>
                  {item.Status === "ativo" && !ehPeso && (
                    <button
                      type="button"
                      onClick={() => {
                        setRemovendoId(removendoId === item.ID ? null : item.ID);
                        setMotivoRemocao("");
                      }}
                      className="shrink-0 text-sm text-texto-secundario underline underline-offset-2 hover:text-tinta"
                    >
                      Remover
                    </button>
                  )}
                </div>

                {removendoId === item.ID && (
                  <div className="mt-3 flex flex-col gap-3 border-l-2 border-ambar pl-4">
                    <label className="flex flex-col gap-1">
                      <span className="text-sm text-texto-secundario">
                        Motivo da remoção (o lançamento original é preservado, só muda o status)
                      </span>
                      <input
                        type="text"
                        value={motivoRemocao}
                        onChange={(e) => setMotivoRemocao(e.target.value)}
                        autoFocus
                        className="border-b border-linha bg-transparent py-1 text-sm text-tinta outline-none focus:border-ambar"
                      />
                    </label>
                    <div className="flex gap-3">
                      <button
                        type="button"
                        onClick={() => confirmarRemocao(item)}
                        disabled={motivoRemocao.trim() === ""}
                        className="bg-tinta px-4 py-2 text-sm font-medium text-papel transition-opacity disabled:opacity-40"
                      >
                        Confirmar remoção
                      </button>
                      <button
                        type="button"
                        onClick={() => setRemovendoId(null)}
                        className="text-sm text-texto-secundario hover:text-tinta"
                      >
                        Cancelar
                      </button>
                    </div>
                  </div>
                )}
              </li>
            );
          })}
        </ul>

        <form onSubmit={adicionarItem} className="mt-8 flex flex-col gap-4 border-t border-linha pt-8">
          <span className="text-sm text-texto-secundario">Adicionar item</span>
          <div className="flex gap-3">
            <select
              ref={codigoInputRef}
              value={produtoId}
              onChange={(e) => setProdutoId(e.target.value)}
              className="flex-1 border-b border-linha bg-transparent py-2 text-base text-tinta outline-none focus:border-ambar"
            >
              {produtosUnitario.length === 0 && <option value="">Nenhum item unitário cadastrado</option>}
              {produtosUnitario.map((p) => (
                <option key={p.ID} value={p.ID}>
                  {p.Nome} — {formatarMoeda(p.PrecoUnitario)}
                </option>
              ))}
            </select>
            <input
              type="text"
              inputMode="numeric"
              value={quantidade}
              onChange={(e) => setQuantidade(e.target.value)}
              className="w-16 border-b-2 border-tinta bg-transparent py-2 text-center font-mono text-lg text-tinta outline-none focus:border-ambar"
            />
          </div>
          <button
            type="submit"
            disabled={produtosUnitario.length === 0 || adicionando}
            className="bg-tinta px-6 py-4 text-base font-medium text-papel transition-opacity disabled:opacity-40"
          >
            {adicionando ? "Lançando…" : "Adicionar item"}
          </button>
        </form>

        <div className="mt-8 border-t border-linha pt-6">
          <button
            type="button"
            onClick={() => setMostrarTransferencia((v) => !v)}
            className="text-sm text-texto-secundario underline underline-offset-2 hover:text-tinta"
          >
            {mostrarTransferencia ? "Fechar transferência de mesa" : "Transferir mesa"}
          </button>

          {mostrarTransferencia && (
            <TransferenciaMesa
              comandaId={comanda.ID}
              mesaAtualId={mesaIdentificador ? mesas.find((m) => m.identificador === mesaIdentificador)?.id ?? null : null}
              mesas={mesas}
              onTransferida={(novaMesaId) => {
                onMesaTransferida(novaMesaId);
                setMostrarTransferencia(false);
              }}
            />
          )}
        </div>
      </main>
    </div>
  );
}

function TransferenciaMesa({
  comandaId,
  mesaAtualId,
  mesas,
  onTransferida,
}: {
  comandaId: string;
  mesaAtualId: string | null;
  mesas: Mesa[];
  onTransferida: (novaMesaId: string) => void;
}) {
  const mesasDisponiveis = mesas.filter((m) => m.id !== mesaAtualId && m.comanda_id === null);
  const [novaMesaId, setNovaMesaId] = useState(mesasDisponiveis[0]?.id ?? "");
  const [transferindo, setTransferindo] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  async function transferir() {
    if (novaMesaId === "" || transferindo) return;
    setTransferindo(true);
    setErro(null);

    try {
      const res = await fetch(`/api/comandas/${encodeURIComponent(comandaId)}/mesa`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ table_id: novaMesaId }),
      });
      const data = await res.json().catch(() => ({}));

      if (res.ok) {
        onTransferida(novaMesaId);
      } else {
        setErro(data.erro ?? "não foi possível transferir a mesa");
      }
    } finally {
      setTransferindo(false);
    }
  }

  if (mesasDisponiveis.length === 0) {
    return <p className="mt-4 text-sm text-texto-secundario">Nenhuma mesa livre no momento.</p>;
  }

  return (
    <div className="mt-4 flex flex-col gap-4 border-l-2 border-linha pl-4">
      <label className="flex flex-col gap-1">
        <span className="text-sm text-texto-secundario">Nova mesa</span>
        <select
          value={novaMesaId}
          onChange={(e) => setNovaMesaId(e.target.value)}
          className="border-b border-linha bg-transparent py-2 text-sm text-tinta outline-none focus:border-ambar"
        >
          {mesasDisponiveis.map((m) => (
            <option key={m.id} value={m.id}>
              {m.identificador}
            </option>
          ))}
        </select>
      </label>

      <button
        type="button"
        onClick={transferir}
        disabled={transferindo}
        className="self-start bg-tinta px-4 py-2 text-sm font-medium text-papel transition-opacity disabled:opacity-40"
      >
        {transferindo ? "Transferindo…" : "Confirmar transferência"}
      </button>

      {erro && <p className="text-sm text-ambar">{erro}</p>}
    </div>
  );
}
