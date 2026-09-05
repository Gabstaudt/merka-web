"use client";

import { Fragment, useCallback, useEffect, useState, type FormEvent } from "react";

type AuditLogEntry = {
  ID: string;
  UsuarioID: string | null;
  Acao: string;
  ComandaID: string | null;
  Dados: Record<string, unknown> | null;
  Sucesso: boolean;
  CriadoEm: string;
};

// auditoriaResponse do backend usa json tags minúsculos (ver
// merka-api/internal/handler/audit_log_handler.go) — diferente da maioria
// dos structs de domínio, que não têm tag e por isso serializam em
// PascalCase (os itens dentro da lista continuam PascalCase, só o
// envelope é minúsculo).
type AuditoriaResponse = { itens: AuditLogEntry[]; total: number; limit: number; offset: number };

// Espelha as chamadas reais de audit.Executar em merka-api/internal/handler
// (ver CLAUDE.md do backend) — não existe endpoint de "listar ações
// possíveis", então esta lista é mantida manualmente; uma ação nova no
// backend só aparece aqui depois de alguém atualizar isto.
const ACOES = [
  "abrir_comanda",
  "liberar_comanda",
  "registrar_peso",
  "estornar_peso",
  "lancar_item",
  "remover_item",
  "transferir_mesa",
  "aplicar_desconto",
  "cancelar_comanda",
  "fechar_pagamento",
  "cancelar_nota_fiscal",
  "cadastrar_produto",
  "configurar_preco_peso",
  "criar_usuario",
  "desativar_usuario",
  "criar_perfil",
  "editar_permissoes_perfil",
];

const LIMITE_PAGINA = 50;

function formatarDataHora(iso: string) {
  return new Date(iso).toLocaleString("pt-BR");
}

function truncarID(id: string | null) {
  return id ? id.slice(0, 8) : "—";
}

export default function AuditoriaPage() {
  const [acao, setAcao] = useState("");
  const [codigoComanda, setCodigoComanda] = useState("");
  const [dataInicio, setDataInicio] = useState("");
  const [dataFim, setDataFim] = useState("");

  const [offset, setOffset] = useState(0);
  const [itens, setItens] = useState<AuditLogEntry[]>([]);
  const [total, setTotal] = useState(0);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const [linhaAberta, setLinhaAberta] = useState<string | null>(null);

  const buscar = useCallback(
    async (offsetAlvo: number) => {
      setCarregando(true);
      setErro(null);

      const params = new URLSearchParams({ limit: String(LIMITE_PAGINA), offset: String(offsetAlvo) });
      if (acao) params.set("acao", acao);
      if (dataInicio) params.set("data_inicio", dataInicio);
      if (dataFim) params.set("data_fim", dataFim);

      try {
        if (codigoComanda.trim() !== "") {
          const comandaRes = await fetch(`/api/comandas/${encodeURIComponent(codigoComanda.trim())}`);
          const comandaData = await comandaRes.json().catch(() => ({}));
          if (!comandaRes.ok) {
            setErro(
              comandaData.erro?.includes("não encontrada")
                ? `Comanda ${codigoComanda.trim()} não encontrada.`
                : `Comanda ${codigoComanda.trim()}: ${comandaData.erro ?? "não foi possível consultar"}`
            );
            setItens([]);
            setTotal(0);
            return;
          }
          params.set("comanda_id", comandaData.ID);
        }

        const res = await fetch(`/api/auditoria?${params.toString()}`);
        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
          setErro(data.erro ?? "não foi possível consultar a auditoria");
          return;
        }
        const resposta = data as AuditoriaResponse;
        setItens(resposta.itens ?? []);
        setTotal(resposta.total ?? 0);
        setOffset(offsetAlvo);
      } catch {
        setErro("Sem conexão com o servidor. Confira a rede e tente de novo.");
      } finally {
        setCarregando(false);
      }
    },
    [acao, codigoComanda, dataInicio, dataFim]
  );

  useEffect(() => {
    // Carrega a primeira página só na montagem — filtros disparam via
    // onSubmit, não a cada tecla. O Promise.resolve().then adia a
    // chamada pra fora do corpo síncrono do efeito (mesmo motivo de
    // nunca chamar setState direto ali).
    Promise.resolve().then(() => buscar(0));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    buscar(0);
  }

  return (
    <div className="flex flex-col gap-8">
      <div>
        <h1 className="font-display text-2xl text-tinta">Auditoria</h1>
        <p className="mt-1 text-sm text-texto-secundario">Toda ação de todo perfil, registrada automaticamente.</p>
      </div>

      <form onSubmit={onSubmit} className="grid grid-cols-2 gap-4 border-y border-linha py-6 sm:grid-cols-4">
        <label className="flex flex-col gap-1">
          <span className="text-sm text-texto-secundario">Ação</span>
          <select
            value={acao}
            onChange={(e) => setAcao(e.target.value)}
            className="border-b border-linha bg-transparent py-2 text-sm text-tinta outline-none focus:border-ambar"
          >
            <option value="">Todas</option>
            {ACOES.map((a) => (
              <option key={a} value={a}>
                {a}
              </option>
            ))}
          </select>
        </label>

        <label className="flex flex-col gap-1">
          <span className="text-sm text-texto-secundario">Comanda</span>
          <input
            type="text"
            value={codigoComanda}
            onChange={(e) => setCodigoComanda(e.target.value)}
            placeholder="código"
            className="border-b border-linha bg-transparent py-2 font-mono text-sm text-tinta outline-none placeholder:text-texto-secundario/50 focus:border-ambar"
          />
        </label>

        <label className="flex flex-col gap-1">
          <span className="text-sm text-texto-secundario">De</span>
          <input
            type="date"
            value={dataInicio}
            onChange={(e) => setDataInicio(e.target.value)}
            className="border-b border-linha bg-transparent py-2 text-sm text-tinta outline-none focus:border-ambar"
          />
        </label>

        <label className="flex flex-col gap-1">
          <span className="text-sm text-texto-secundario">Até</span>
          <input
            type="date"
            value={dataFim}
            onChange={(e) => setDataFim(e.target.value)}
            className="border-b border-linha bg-transparent py-2 text-sm text-tinta outline-none focus:border-ambar"
          />
        </label>

        <button
          type="submit"
          disabled={carregando}
          className="col-span-2 justify-self-start bg-tinta px-6 py-2 text-sm font-medium text-papel transition-opacity disabled:opacity-40 sm:col-span-4"
        >
          {carregando ? "Buscando…" : "Filtrar"}
        </button>
      </form>

      {erro && <p className="text-sm text-ambar">{erro}</p>}

      {!erro && (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px] border-collapse text-sm">
            <thead>
              <tr className="border-b border-linha text-left text-texto-secundario">
                <th className="py-2 pr-4 font-normal">Quando</th>
                <th className="py-2 pr-4 font-normal">Ação</th>
                <th className="py-2 pr-4 font-normal">Usuário</th>
                <th className="py-2 pr-4 font-normal">Comanda</th>
                <th className="py-2 pr-4 font-normal">Resultado</th>
              </tr>
            </thead>
            <tbody>
              {itens.length === 0 && !carregando && (
                <tr>
                  <td colSpan={5} className="py-6 text-texto-secundario">
                    Nenhum registro encontrado.
                  </td>
                </tr>
              )}
              {itens.map((item) => (
                <Fragment key={item.ID}>
                  <tr
                    onClick={() => setLinhaAberta(linhaAberta === item.ID ? null : item.ID)}
                    className="cursor-pointer border-b border-linha hover:bg-linha/40"
                  >
                    <td className="py-3 pr-4 font-mono text-xs text-texto-secundario">
                      {formatarDataHora(item.CriadoEm)}
                    </td>
                    <td className="py-3 pr-4 text-tinta">{item.Acao}</td>
                    <td className="py-3 pr-4 font-mono text-xs text-texto-secundario">{truncarID(item.UsuarioID)}</td>
                    <td className="py-3 pr-4 font-mono text-xs text-texto-secundario">{truncarID(item.ComandaID)}</td>
                    <td className="py-3 pr-4">
                      {item.Sucesso ? (
                        <span className="text-texto-secundario">sucesso</span>
                      ) : (
                        <span className="text-ambar">falhou</span>
                      )}
                    </td>
                  </tr>
                  {linhaAberta === item.ID && (
                    <tr className="border-b border-linha bg-linha/20">
                      <td colSpan={5} className="px-4 py-3">
                        <pre className="overflow-x-auto font-mono text-xs text-texto-secundario">
                          {JSON.stringify(item.Dados ?? {}, null, 2)}
                        </pre>
                      </td>
                    </tr>
                  )}
                </Fragment>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {total > 0 && (
        <div className="flex items-center justify-between text-sm text-texto-secundario">
          <span>
            {offset + 1}–{Math.min(offset + LIMITE_PAGINA, total)} de {total}
          </span>
          <div className="flex gap-4">
            <button
              type="button"
              onClick={() => buscar(Math.max(offset - LIMITE_PAGINA, 0))}
              disabled={offset === 0 || carregando}
              className="underline underline-offset-2 hover:text-tinta disabled:opacity-40"
            >
              Anterior
            </button>
            <button
              type="button"
              onClick={() => buscar(offset + LIMITE_PAGINA)}
              disabled={offset + LIMITE_PAGINA >= total || carregando}
              className="underline underline-offset-2 hover:text-tinta disabled:opacity-40"
            >
              Próxima
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
