"use client";

import { useCallback, useEffect, useState } from "react";

type VendaPorFormaPagamento = { Metodo: string; Total: number };
type VendaPorProduto = {
  ProductID: string;
  ProdutoNome: string;
  CategoryID: string | null;
  CategoriaNome: string | null;
  Total: number;
};

type RelatorioVendas = {
  Periodo: string;
  Inicio: string;
  Fim: string;
  TotalGeral: number;
  NumeroComandas: number;
  PorFormaPagamento: VendaPorFormaPagamento[];
  PorProduto: VendaPorProduto[];
};

const PERIODOS = [
  { valor: "dia", label: "Dia" },
  { valor: "semana", label: "Semana" },
  { valor: "mes", label: "Mês" },
  { valor: "ano", label: "Ano" },
] as const;

type Periodo = (typeof PERIODOS)[number]["valor"];

const METODOS_LABEL: Record<string, string> = {
  credito: "Crédito",
  debito: "Débito",
  voucher: "Voucher",
  pix: "PIX",
  dinheiro: "Dinheiro",
  ticket_alimentacao: "Ticket alimentação",
};

function formatarMoeda(valor: number) {
  return valor.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function hojeISO() {
  const agora = new Date();
  return `${agora.getFullYear()}-${String(agora.getMonth() + 1).padStart(2, "0")}-${String(agora.getDate()).padStart(2, "0")}`;
}

function formatarPeriodo(inicio: string, fim: string, periodo: string) {
  const dataInicio = new Date(inicio);
  const dataFimExclusivo = new Date(new Date(fim).getTime() - 1);
  const opcoes: Intl.DateTimeFormatOptions =
    periodo === "dia" ? { day: "2-digit", month: "long", year: "numeric" } : { day: "2-digit", month: "short" };
  if (periodo === "dia") return dataInicio.toLocaleDateString("pt-BR", opcoes);
  return `${dataInicio.toLocaleDateString("pt-BR", opcoes)} – ${dataFimExclusivo.toLocaleDateString("pt-BR", opcoes)}`;
}

export default function RelatoriosPage() {
  const [periodo, setPeriodo] = useState<Periodo>("dia");
  const [dataReferencia, setDataReferencia] = useState(hojeISO());
  const [dados, setDados] = useState<RelatorioVendas | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);

  const buscar = useCallback((periodoAlvo: Periodo, dataAlvo: string) => {
    setCarregando(true);
    setErro(null);
    fetch(`/api/relatorios/vendas?periodo=${periodoAlvo}&data_referencia=${dataAlvo}`)
      .then((res) => res.json().then((data) => ({ ok: res.ok, data })))
      .then(({ ok, data }) => {
        if (!ok) {
          setErro(data.erro ?? "não foi possível carregar o relatório");
          return;
        }
        setDados(data as RelatorioVendas);
      })
      .catch(() => setErro("Sem conexão com o servidor. Confira a rede e tente de novo."))
      .finally(() => setCarregando(false));
  }, []);

  useEffect(() => {
    Promise.resolve().then(() => buscar(periodo, dataReferencia));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function trocarPeriodo(novoPeriodo: Periodo) {
    setPeriodo(novoPeriodo);
    buscar(novoPeriodo, dataReferencia);
  }

  function trocarData(novaData: string) {
    setDataReferencia(novaData);
    buscar(periodo, novaData);
  }

  const maiorFormaPagamento = dados ? Math.max(1, ...dados.PorFormaPagamento.map((v) => v.Total)) : 1;
  const maiorProduto = dados ? Math.max(1, ...dados.PorProduto.map((v) => v.Total)) : 1;

  return (
    <div className="flex flex-col gap-8">
      <div>
        <h1 className="font-display text-2xl text-tinta">Relatórios de vendas</h1>
        <p className="mt-1 text-sm text-texto-secundario">
          Itens vendidos por forma de pagamento e por produto, dentro do período escolhido.
        </p>
      </div>

      <div className="flex flex-wrap items-end gap-6 border-y border-linha py-6">
        <div className="flex gap-1">
          {PERIODOS.map((p) => (
            <button
              key={p.valor}
              type="button"
              onClick={() => trocarPeriodo(p.valor)}
              className={`px-3 py-1.5 text-sm transition-colors ${
                periodo === p.valor ? "bg-tinta text-papel" : "text-texto-secundario hover:text-tinta"
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>

        <label className="flex flex-col gap-1">
          <span className="text-sm text-texto-secundario">Data de referência</span>
          <input
            type="date"
            value={dataReferencia}
            onChange={(e) => trocarData(e.target.value)}
            className="border-b border-linha bg-transparent py-1 text-sm text-tinta outline-none focus:border-ambar"
          />
        </label>
      </div>

      {carregando && <p className="text-sm text-texto-secundario">Carregando…</p>}
      {erro && <p className="text-sm text-ambar">{erro}</p>}

      {dados && !carregando && (
        <>
          <div>
            <p className="text-sm text-texto-secundario">{formatarPeriodo(dados.Inicio, dados.Fim, dados.Periodo)}</p>
            <div className="mt-2 flex items-baseline gap-10">
              <p className="font-display text-4xl text-ambar">{formatarMoeda(dados.TotalGeral)}</p>
              <p className="text-sm text-texto-secundario">{dados.NumeroComandas} comanda(s) fechada(s)</p>
            </div>
          </div>

          <div>
            <h2 className="text-sm text-texto-secundario">Por forma de pagamento</h2>
            {dados.PorFormaPagamento.length === 0 ? (
              <p className="mt-4 text-sm text-texto-secundario">Nenhum pagamento neste período.</p>
            ) : (
              <ul className="mt-4 flex flex-col">
                {dados.PorFormaPagamento.map((v) => (
                  <li key={v.Metodo} className="border-t border-linha py-4 first:border-t-0">
                    <div className="flex items-baseline justify-between">
                      <span className="text-base text-tinta">{METODOS_LABEL[v.Metodo] ?? v.Metodo}</span>
                      <span className="font-mono text-sm text-texto-secundario">{formatarMoeda(v.Total)}</span>
                    </div>
                    <div className="mt-2 h-1.5 w-full bg-linha">
                      <div
                        className="h-1.5 bg-tinta"
                        style={{ width: `${Math.max((v.Total / maiorFormaPagamento) * 100, 2)}%` }}
                      />
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div>
            <h2 className="text-sm text-texto-secundario">Por produto</h2>
            {dados.PorProduto.length === 0 ? (
              <p className="mt-4 text-sm text-texto-secundario">Nenhum item vendido neste período.</p>
            ) : (
              <ul className="mt-4 flex flex-col">
                {dados.PorProduto.map((v) => (
                  <li key={v.ProductID} className="border-t border-linha py-4 first:border-t-0">
                    <div className="flex items-baseline justify-between">
                      <span className="text-base text-tinta">
                        {v.ProdutoNome}
                        {v.CategoriaNome && (
                          <span className="ml-2 text-sm text-texto-secundario">{v.CategoriaNome}</span>
                        )}
                      </span>
                      <span className="font-mono text-sm text-texto-secundario">{formatarMoeda(v.Total)}</span>
                    </div>
                    <div className="mt-2 h-1.5 w-full bg-linha">
                      <div
                        className="h-1.5 bg-ambar"
                        style={{ width: `${Math.max((v.Total / maiorProduto) * 100, 2)}%` }}
                      />
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </>
      )}
    </div>
  );
}
