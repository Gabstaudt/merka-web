"use client";

import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";

import { LogoutButton } from "@/components/LogoutButton";
import { useMerkaSocket, type EventoWS } from "@/lib/useMerkaSocket";

type ComandaResumo = { id: string; codigo_fisico: string };

type Mesa = {
  id: string;
  identificador: string;
  comandas: ComandaResumo[];
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
  const [mesaSelecionada, setMesaSelecionada] = useState<Mesa | null>(null);
  const [itens, setItens] = useState<OrderItem[]>([]);
  const [codigoBusca, setCodigoBusca] = useState("");
  const [buscando, setBuscando] = useState(false);
  const [resultado, setResultado] = useState<Resultado | null>(null);

  const produtosUnitario = useMemo(() => produtos.filter((p) => p.TipoCobranca === "unitario"), [produtos]);
  const produtosPorId = useMemo(() => new Map(produtos.map((p) => [p.ID, p])), [produtos]);

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

  function abrirComanda(comanda: Comanda) {
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

      abrirComanda(comanda);
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

  const mesasAtivas = mesas.filter((m) => m.comandas.length > 0);
  const totalParcial = itens.filter((i) => i.Status === "ativo").reduce((soma, i) => soma + i.Valor, 0);

  if (mesaSelecionada) {
    return (
      <SelecionarComandaView
        mesa={mesaSelecionada}
        onVoltar={() => setMesaSelecionada(null)}
        onSelecionar={(c) => {
          abrirComanda({ ID: c.id, Status: "em_uso", CodigoFisico: c.codigo_fisico, TableID: mesaSelecionada.id });
          setMesaSelecionada(null);
        }}
      />
    );
  }

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

        <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col px-6 py-8">
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
            <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3">
              {mesasAtivas.map((m) => (
                <button
                  key={m.id}
                  type="button"
                  onClick={() => {
                    if (m.comandas.length === 1) {
                      abrirComanda({
                        ID: m.comandas[0].id,
                        Status: "em_uso",
                        CodigoFisico: m.comandas[0].codigo_fisico,
                        TableID: m.id,
                      });
                    } else {
                      setMesaSelecionada(m);
                    }
                  }}
                  className="flex aspect-square w-full flex-col items-center justify-center gap-1 border border-linha px-2 text-center transition-colors hover:border-tinta"
                >
                  <span className="text-lg text-tinta">{m.identificador}</span>
                  <span className="font-mono text-xs text-texto-secundario">
                    {m.comandas.length === 1 ? `comanda ${m.comandas[0].codigo_fisico}` : `${m.comandas.length} comandas`}
                  </span>
                </button>
              ))}
            </div>
          )}
        </main>
      </div>
    );
  }

  if (comandaAberta.TableID === null) {
    return (
      <AssociarMesaView
        comanda={comandaAberta}
        mesas={mesas}
        onVoltar={() => setComandaAberta(null)}
        onAssociada={(mesaId) => {
          setComandaAberta({ ...comandaAberta, TableID: mesaId });
          carregarMesas();
        }}
      />
    );
  }

  return (
    <ComandaAbertaView
      comanda={comandaAberta}
      mesaIdentificador={mesas.find((m) => m.id === comandaAberta.TableID)?.identificador ?? null}
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

// AssociarMesaView é obrigatória antes de qualquer lançamento numa comanda
// sem mesa associada (comanda.TableID === null) — a mesa só é definida no
// primeiro lançamento do Garçom, não antes. Reaproveita a mesma rota de
// transferência (PATCH .../mesa também serve pra atribuição inicial).
// SelecionarComandaView é uma tela própria (não um dropdown/expansão
// dentro do grid) — uma mesa com mais de uma comanda em_uso ao mesmo
// tempo exige escolher qual delas antes de ir pro lançamento, já que
// itens/total são sempre de UMA comanda por vez.
function SelecionarComandaView({
  mesa,
  onVoltar,
  onSelecionar,
}: {
  mesa: Mesa;
  onVoltar: () => void;
  onSelecionar: (comanda: ComandaResumo) => void;
}) {
  return (
    <div className="flex min-h-dvh flex-col">
      <header className="flex items-center justify-between border-b border-linha px-6 py-4">
        <button type="button" onClick={onVoltar} className="text-sm text-texto-secundario hover:text-tinta">
          ← Mesas
        </button>
        <LogoutButton />
      </header>

      <main className="mx-auto flex w-full max-w-xl flex-1 flex-col px-6 py-8">
        <p className="text-2xl text-tinta">{mesa.identificador}</p>
        <p className="mt-1 text-sm text-texto-secundario">
          {mesa.comandas.length} comandas nesta mesa — escolha qual atender.
        </p>

        <ul className="mt-6 flex flex-col">
          {mesa.comandas.map((c) => (
            <li key={c.id} className="border-t border-linha first:border-t-0">
              <button
                type="button"
                onClick={() => onSelecionar(c)}
                className="flex w-full items-center justify-between py-4 text-left"
              >
                <span className="font-mono text-lg text-tinta">comanda {c.codigo_fisico}</span>
                <span className="text-sm text-texto-secundario">abrir</span>
              </button>
            </li>
          ))}
        </ul>
      </main>
    </div>
  );
}

function AssociarMesaView({
  comanda,
  mesas,
  onVoltar,
  onAssociada,
}: {
  comanda: Comanda;
  mesas: Mesa[];
  onVoltar: () => void;
  onAssociada: (mesaId: string) => void;
}) {
  const [associando, setAssociando] = useState<string | null>(null);
  const [erro, setErro] = useState<string | null>(null);

  async function associar(mesaId: string) {
    setAssociando(mesaId);
    setErro(null);

    try {
      const res = await fetch(`/api/comandas/${encodeURIComponent(comanda.ID)}/mesa`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ table_id: mesaId }),
      });
      const data = await res.json().catch(() => ({}));

      if (res.ok) {
        onAssociada(mesaId);
      } else {
        setErro(data.erro ?? "não foi possível associar a mesa");
      }
    } finally {
      setAssociando(null);
    }
  }

  return (
    <div className="flex min-h-dvh flex-col">
      <header className="flex items-center justify-between border-b border-linha px-6 py-4">
        <button type="button" onClick={onVoltar} className="text-sm text-texto-secundario hover:text-tinta">
          ← Mesas
        </button>
        <LogoutButton />
      </header>

      <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col px-6 py-8">
        <p className="font-mono text-2xl text-tinta">comanda {comanda.CodigoFisico}</p>
        <div className="mt-4 border-l-2 border-ambar pl-6">
          <p className="text-sm font-medium text-ambar">Sem mesa associada</p>
          <p className="mt-1 text-base leading-snug text-tinta">
            Esta comanda ainda não está ligada a uma mesa. Escolha a mesa antes de lançar o primeiro item.
          </p>
        </div>

        {mesas.length === 0 ? (
          <p className="mt-6 text-sm text-texto-secundario">Nenhuma mesa cadastrada.</p>
        ) : (
          <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-3">
            {mesas.map((m) => (
              <button
                key={m.id}
                type="button"
                onClick={() => associar(m.id)}
                disabled={associando !== null}
                className="flex aspect-square flex-col items-center justify-center gap-1 border border-linha px-2 text-center transition-colors hover:border-tinta disabled:opacity-40"
              >
                <span className="text-lg text-tinta">{m.identificador}</span>
                <span className="font-mono text-xs text-texto-secundario">
                  {associando === m.id
                    ? "associando…"
                    : m.comandas.length > 0
                      ? `${m.comandas.length} comanda(s)`
                      : "livre"}
                </span>
              </button>
            ))}
          </div>
        )}

        {erro && <p className="mt-4 text-sm text-ambar">{erro}</p>}
      </main>
    </div>
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
  const [removendoId, setRemovendoId] = useState<string | null>(null);
  const [motivoRemocao, setMotivoRemocao] = useState("");
  const [mostrarTransferencia, setMostrarTransferencia] = useState(false);
  const [mostrarAdicionar, setMostrarAdicionar] = useState(false);
  const [verHistorico, setVerHistorico] = useState(false);

  const itensAtivos = itens.filter((i) => i.Status === "ativo");
  const itensHistorico = itens.filter((i) => i.Status !== "ativo");

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

  function ItemLinha({ item, permiteRemover }: { item: OrderItem; permiteRemover: boolean }) {
    const produto = produtosPorId.get(item.ProductID);
    const ehPeso = item.PesoKg !== null;
    return (
      <li className="border-t border-linha py-4 first:border-t-0">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-base text-tinta">
              {produto?.Nome ?? "Produto"}{" "}
              <span className="font-mono text-xs text-texto-secundario">{ehPeso ? "· peso" : "· unidade"}</span>
            </p>
            <p className="mt-1 text-sm text-texto-secundario">
              {ehPeso ? `${item.PesoKg!.toFixed(3).replace(".", ",")} kg líquido` : `${item.Quantidade} un.`} ·{" "}
              {item.Status === "ativo" ? formatarMoeda(item.Valor) : <span className="text-ambar">{item.Status}</span>}
            </p>
          </div>
          {permiteRemover && item.Status === "ativo" && !ehPeso && (
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
          {itensAtivos.length === 0 && (
            <li className="py-4 text-sm text-texto-secundario">Nenhum item lançado ainda.</li>
          )}
          {itensAtivos.map((item) => (
            <ItemLinha key={item.ID} item={item} permiteRemover />
          ))}
        </ul>

        {itensHistorico.length > 0 && (
          <div className="mt-2">
            <button
              type="button"
              onClick={() => setVerHistorico((v) => !v)}
              className="text-sm text-texto-secundario underline underline-offset-2 hover:text-tinta"
            >
              {verHistorico
                ? "Ocultar histórico"
                : `Ver mais (${itensHistorico.length} removido${itensHistorico.length > 1 ? "s" : ""}/estornado${itensHistorico.length > 1 ? "s" : ""})`}
            </button>
            {verHistorico && (
              <ul className="mt-2 flex flex-col">
                {itensHistorico.map((item) => (
                  <ItemLinha key={item.ID} item={item} permiteRemover={false} />
                ))}
              </ul>
            )}
          </div>
        )}

        <div className="mt-8 border-t border-linha pt-6">
          <button
            type="button"
            onClick={() => setMostrarAdicionar((v) => !v)}
            className="bg-tinta px-6 py-4 text-base font-medium text-papel"
          >
            {mostrarAdicionar ? "Fechar" : "Adicionar item"}
          </button>

          {mostrarAdicionar && (
            <AdicionarItemPanel
              produtos={produtosUnitario}
              onLancar={async (produto, quantidade) => {
                const res = await fetch(`/api/comandas/${encodeURIComponent(comanda.ID)}/itens`, {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({ product_id: produto.ID, quantidade }),
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
                  setMostrarAdicionar(false);
                }
              }}
            />
          )}
        </div>

        <div className="mt-6 border-t border-linha pt-6">
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
              mesaAtualId={comanda.TableID}
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

// AdicionarItemPanel: cardápio pesquisável — o Garçom digita pra filtrar
// em vez de rolar um <select> longo, útil andando pelo salão.
function AdicionarItemPanel({
  produtos,
  onLancar,
}: {
  produtos: Produto[];
  onLancar: (produto: Produto, quantidade: number) => Promise<void>;
}) {
  const [busca, setBusca] = useState("");
  const [selecionado, setSelecionado] = useState<Produto | null>(null);
  const [quantidade, setQuantidade] = useState("1");
  const [lancando, setLancando] = useState(false);

  const filtrados = produtos.filter((p) => p.Nome.toLowerCase().includes(busca.trim().toLowerCase()));

  async function confirmar() {
    const qtd = parseFloat(quantidade.replace(",", "."));
    if (!selecionado || Number.isNaN(qtd) || qtd <= 0 || lancando) return;
    setLancando(true);
    try {
      await onLancar(selecionado, qtd);
    } finally {
      setLancando(false);
    }
  }

  if (selecionado) {
    return (
      <div className="mt-4 flex flex-col gap-4 border-l-2 border-ambar pl-4">
        <div className="flex items-center justify-between">
          <p className="text-base text-tinta">
            {selecionado.Nome} — {formatarMoeda(selecionado.PrecoUnitario)}
          </p>
          <button
            type="button"
            onClick={() => setSelecionado(null)}
            className="text-sm text-texto-secundario underline underline-offset-2 hover:text-tinta"
          >
            Trocar
          </button>
        </div>
        <label className="flex flex-col gap-1">
          <span className="text-sm text-texto-secundario">Quantidade</span>
          <input
            type="text"
            inputMode="numeric"
            value={quantidade}
            onChange={(e) => setQuantidade(e.target.value)}
            autoFocus
            className="w-24 border-b-2 border-tinta bg-transparent py-2 text-center font-mono text-lg text-tinta outline-none focus:border-ambar"
          />
        </label>
        <button
          type="button"
          onClick={confirmar}
          disabled={lancando}
          className="self-start bg-tinta px-6 py-3 text-sm font-medium text-papel transition-opacity disabled:opacity-40"
        >
          {lancando ? "Lançando…" : "Lançar item"}
        </button>
      </div>
    );
  }

  return (
    <div className="mt-4 flex flex-col gap-3 border-l-2 border-linha pl-4">
      <input
        type="text"
        value={busca}
        onChange={(e) => setBusca(e.target.value)}
        placeholder="Buscar no cardápio…"
        autoFocus
        className="border-b border-linha bg-transparent py-2 text-base text-tinta outline-none placeholder:text-texto-secundario/60 focus:border-ambar"
      />
      {produtos.length === 0 ? (
        <p className="text-sm text-texto-secundario">Nenhum item unitário cadastrado.</p>
      ) : filtrados.length === 0 ? (
        <p className="text-sm text-texto-secundario">Nada encontrado para &quot;{busca}&quot;.</p>
      ) : (
        <ul className="flex max-h-64 flex-col overflow-y-auto">
          {filtrados.map((p) => (
            <li key={p.ID} className="border-t border-linha first:border-t-0">
              <button
                type="button"
                onClick={() => setSelecionado(p)}
                className="flex w-full items-center justify-between py-3 text-left"
              >
                <span className="text-base text-tinta">{p.Nome}</span>
                <span className="font-mono text-sm text-texto-secundario">{formatarMoeda(p.PrecoUnitario)}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
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
  const mesasDisponiveis = mesas.filter((m) => m.id !== mesaAtualId);
  const [transferindoId, setTransferindoId] = useState<string | null>(null);
  const [erro, setErro] = useState<string | null>(null);

  async function transferir(mesaId: string) {
    setTransferindoId(mesaId);
    setErro(null);

    try {
      const res = await fetch(`/api/comandas/${encodeURIComponent(comandaId)}/mesa`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ table_id: mesaId }),
      });
      const data = await res.json().catch(() => ({}));

      if (res.ok) {
        onTransferida(mesaId);
      } else {
        setErro(data.erro ?? "não foi possível transferir a mesa");
      }
    } finally {
      setTransferindoId(null);
    }
  }

  if (mesasDisponiveis.length === 0) {
    return <p className="mt-4 text-sm text-texto-secundario">Nenhuma outra mesa cadastrada.</p>;
  }

  return (
    <div className="mt-4 flex flex-col gap-4 border-l-2 border-linha pl-4">
      <div className="grid grid-cols-3 gap-3 sm:grid-cols-4">
        {mesasDisponiveis.map((m) => (
          <button
            key={m.id}
            type="button"
            onClick={() => transferir(m.id)}
            disabled={transferindoId !== null}
            className="flex aspect-square flex-col items-center justify-center gap-1 border border-linha px-2 text-center transition-colors hover:border-tinta disabled:opacity-40"
          >
            <span className="text-base text-tinta">{m.identificador}</span>
            <span className="font-mono text-xs text-texto-secundario">
              {transferindoId === m.id ? "…" : m.comandas.length > 0 ? `${m.comandas.length} comanda(s)` : "livre"}
            </span>
          </button>
        ))}
      </div>

      {erro && <p className="text-sm text-ambar">{erro}</p>}
    </div>
  );
}
