"use client";

import { useCallback, useEffect, useState, type FormEvent } from "react";

type FiscalReceipt = {
  PaymentID: string;
  TipoDocumento: string;
  Documento: string | null;
  Emitida: boolean;
  EmitidaEm: string | null;
  NumeroNota: string | null;
  ChaveAcesso: string | null;
  MotivoFalha: string | null;
  Cancelada: boolean;
  CanceladaEm: string | null;
  ProcessadoEm: string;
};

// Envelope de GET /notas-fiscais usa json tags minúsculos (ver
// merka-api/internal/handler/report_handler.go) — mesmo padrão de
// GET /auditoria (ver nota em app/(gestor)/gestor/auditoria/page.tsx).
type NotasFiscaisResponse = { itens: FiscalReceipt[]; total: number; limit: number; offset: number };

const LIMITE_PAGINA = 50;

type FiltroEmitida = "todas" | "emitida" | "nao_emitida";

function formatarDataHora(iso: string | null) {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("pt-BR");
}

export default function NotasFiscaisPage() {
  const [dataInicio, setDataInicio] = useState("");
  const [dataFim, setDataFim] = useState("");
  const [filtroEmitida, setFiltroEmitida] = useState<FiltroEmitida>("todas");

  const [offset, setOffset] = useState(0);
  const [itens, setItens] = useState<FiscalReceipt[]>([]);
  const [total, setTotal] = useState(0);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);

  const buscar = useCallback(
    async (offsetAlvo: number) => {
      setCarregando(true);
      setErro(null);

      const params = new URLSearchParams({ limit: String(LIMITE_PAGINA), offset: String(offsetAlvo) });
      if (dataInicio) params.set("data_inicio", dataInicio);
      if (dataFim) params.set("data_fim", dataFim);
      if (filtroEmitida !== "todas") params.set("emitida", filtroEmitida === "emitida" ? "true" : "false");

      try {
        const res = await fetch(`/api/notas-fiscais?${params.toString()}`);
        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
          setErro(data.erro ?? "não foi possível consultar as notas fiscais");
          return;
        }
        const resposta = data as NotasFiscaisResponse;
        setItens(resposta.itens ?? []);
        setTotal(resposta.total ?? 0);
        setOffset(offsetAlvo);
      } catch {
        setErro("Sem conexão com o servidor. Confira a rede e tente de novo.");
      } finally {
        setCarregando(false);
      }
    },
    [dataInicio, dataFim, filtroEmitida]
  );

  useEffect(() => {
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
        <h1 className="font-display text-2xl text-tinta">Notas fiscais</h1>
        <p className="mt-1 text-sm text-texto-secundario">Emitidas, não emitidas e canceladas, por período.</p>
      </div>

      <form onSubmit={onSubmit} className="grid grid-cols-2 gap-4 border-y border-linha py-6 sm:grid-cols-4">
        <label className="flex flex-col gap-1">
          <span className="text-sm text-texto-secundario">Status</span>
          <select
            value={filtroEmitida}
            onChange={(e) => setFiltroEmitida(e.target.value as FiltroEmitida)}
            className="border-b border-linha bg-transparent py-2 text-sm text-tinta outline-none focus:border-ambar"
          >
            <option value="todas">Todas</option>
            <option value="emitida">Emitidas</option>
            <option value="nao_emitida">Não emitidas</option>
          </select>
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
        <ul className="flex flex-col">
          {itens.length === 0 && !carregando && (
            <li className="py-6 text-sm text-texto-secundario">Nenhuma nota fiscal encontrada.</li>
          )}
          {itens.map((nota) => (
            <NotaFiscalRow key={nota.PaymentID} nota={nota} onAlterada={() => buscar(offset)} />
          ))}
        </ul>
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

// NotaFiscalRow: mesma ação de cancelamento (US-22) já usada na tela do
// Caixa — Gestor também tem a permissão "cancelar_nota_fiscal" (ver
// migrations/0016_seed_permissao_cancelar_nota.sql: "Caixa/Gestor").
function NotaFiscalRow({ nota, onAlterada }: { nota: FiscalReceipt; onAlterada: () => void }) {
  const [mostrarCancelar, setMostrarCancelar] = useState(false);
  const [justificativa, setJustificativa] = useState("");
  const [cancelando, setCancelando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

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
      setMostrarCancelar(false);
      onAlterada();
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
            processada em {formatarDataHora(nota.ProcessadoEm)}
            {nota.Emitida && <span> · emitida em {formatarDataHora(nota.EmitidaEm)}</span>}
            {nota.Cancelada && <span className="text-ambar"> · cancelada em {formatarDataHora(nota.CanceladaEm)}</span>}
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
          {nota.Emitida && !nota.Cancelada && (
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
