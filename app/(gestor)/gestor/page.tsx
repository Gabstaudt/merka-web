"use client";

import { useEffect, useState } from "react";

type VendaPorFormaPagamento = { Metodo: string; Total: number };

type RelatorioVendas = {
  Periodo: string;
  Inicio: string;
  Fim: string;
  TotalGeral: number;
  NumeroComandas: number;
  PorFormaPagamento: VendaPorFormaPagamento[];
};

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
  const ano = agora.getFullYear();
  const mes = String(agora.getMonth() + 1).padStart(2, "0");
  const dia = String(agora.getDate()).padStart(2, "0");
  return `${ano}-${mes}-${dia}`;
}

// Dashboard (US-04): visão geral do dia — total vendido, comandas
// fechadas e o detalhamento por forma de pagamento. Período fixo em
// "dia" aqui; o seletor de período completo (semana/mês/ano) e o
// detalhamento por produto ficam na aba Relatórios (próxima etapa).
export default function GestorDashboardPage() {
  const [dados, setDados] = useState<RelatorioVendas | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    fetch(`/api/relatorios/vendas?periodo=dia&data_referencia=${hojeISO()}`)
      .then((res) => res.json().then((data) => ({ ok: res.ok, data })))
      .then(({ ok, data }) => {
        if (!ok) {
          setErro(data.erro ?? "não foi possível carregar o dashboard");
          return;
        }
        setDados(data as RelatorioVendas);
      })
      .catch(() => setErro("Sem conexão com o servidor. Confira a rede e tente de novo."))
      .finally(() => setCarregando(false));
  }, []);

  const maiorValor = dados ? Math.max(1, ...dados.PorFormaPagamento.map((v) => v.Total)) : 1;

  return (
    <div className="flex flex-col gap-10">
      <div>
        <h1 className="font-display text-2xl text-tinta">Visão geral do dia</h1>
        <p className="mt-1 text-sm text-texto-secundario">
          {new Date().toLocaleDateString("pt-BR", { weekday: "long", day: "2-digit", month: "long" })}
        </p>
      </div>

      {carregando && <p className="text-sm text-texto-secundario">Carregando…</p>}
      {erro && <p className="text-sm text-ambar">{erro}</p>}

      {dados && (
        <>
          <div className="grid grid-cols-1 gap-8 border-y border-linha py-8 sm:grid-cols-2">
            <div>
              <p className="text-sm text-texto-secundario">total vendido hoje</p>
              <p className="mt-1 font-display text-5xl text-ambar">{formatarMoeda(dados.TotalGeral)}</p>
            </div>
            <div>
              <p className="text-sm text-texto-secundario">comandas fechadas</p>
              <p className="mt-1 font-display text-5xl text-tinta">{dados.NumeroComandas}</p>
            </div>
          </div>

          <div>
            <h2 className="text-sm text-texto-secundario">Por forma de pagamento</h2>
            {dados.PorFormaPagamento.length === 0 ? (
              <p className="mt-4 text-sm text-texto-secundario">Nenhum pagamento processado hoje ainda.</p>
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
                        style={{ width: `${Math.max((v.Total / maiorValor) * 100, 2)}%` }}
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
