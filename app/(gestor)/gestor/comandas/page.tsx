"use client";

import { useState, type FormEvent } from "react";

type Comanda = { ID: string; Status: string; CodigoFisico: string; TableID: string | null };

function statusLabel(status: string) {
  if (status === "em_uso") return "em uso";
  if (status === "disponivel") return "disponível";
  if (status === "paga") return "paga";
  if (status === "cancelada") return "cancelada";
  return status;
}

// Cancelamento total de comanda (US-15) — restrito a Gestor/Admin Super.
// Zera todos os itens/pesos já lançados (marcados como removidos, nunca
// apagados) e libera a comanda de volta pro estoque. Motivo sempre
// obrigatório.
export default function ComandasPage() {
  const [codigo, setCodigo] = useState("");
  const [buscando, setBuscando] = useState(false);
  const [erroBusca, setErroBusca] = useState<string | null>(null);
  const [comanda, setComanda] = useState<Comanda | null>(null);

  const [motivo, setMotivo] = useState("");
  const [cancelando, setCancelando] = useState(false);
  const [erroCancelar, setErroCancelar] = useState<string | null>(null);
  const [sucesso, setSucesso] = useState<string | null>(null);

  async function buscar(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const codigoAtual = codigo.trim();
    if (codigoAtual === "" || buscando) return;

    setBuscando(true);
    setErroBusca(null);
    setSucesso(null);
    setComanda(null);

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
      setComanda(data as Comanda);
    } catch {
      setErroBusca("Sem conexão com o servidor. Confira a rede e tente de novo.");
    } finally {
      setBuscando(false);
    }
  }

  async function cancelar() {
    if (!comanda || motivo.trim().length === 0 || cancelando) return;
    setCancelando(true);
    setErroCancelar(null);

    try {
      const res = await fetch(`/api/comandas/${encodeURIComponent(comanda.ID)}/cancelar`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ motivo: motivo.trim() }),
      });
      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        setErroCancelar(data.erro ?? "não foi possível cancelar a comanda");
        return;
      }

      setSucesso(`Comanda ${comanda.CodigoFisico} cancelada — todos os itens foram zerados e ela voltou pro estoque.`);
      setComanda(null);
      setCodigo("");
      setMotivo("");
    } catch {
      setErroCancelar("Sem conexão com o servidor. Confira a rede e tente de novo.");
    } finally {
      setCancelando(false);
    }
  }

  return (
    <div className="flex flex-col gap-8">
      <div>
        <h1 className="font-display text-2xl text-tinta">Cancelamento total de comanda</h1>
        <p className="mt-1 text-sm text-texto-secundario">
          Zera todos os itens/pesos lançados e libera a comanda de volta pro estoque. Ação restrita e irreversível —
          sempre com motivo.
        </p>
      </div>

      {sucesso && (
        <div className="animate-feedback-in border-l-2 border-ambar pl-6">
          <p className="text-sm font-medium text-ambar">Comanda cancelada</p>
          <p className="mt-1 text-base text-tinta">{sucesso}</p>
        </div>
      )}

      <form onSubmit={buscar} className="flex flex-col gap-2">
        <span className="text-sm text-texto-secundario">Buscar comanda pelo código</span>
        <div className="flex gap-3">
          <input
            type="text"
            value={codigo}
            onChange={(e) => setCodigo(e.target.value)}
            placeholder="—"
            autoFocus
            autoComplete="off"
            className="flex-1 border-b-2 border-tinta bg-transparent pb-2 font-mono text-2xl text-tinta outline-none placeholder:text-texto-secundario/50 focus:border-ambar sm:flex-none sm:w-64"
          />
          <button
            type="submit"
            disabled={codigo.trim() === "" || buscando}
            className="bg-tinta px-5 text-sm font-medium text-papel transition-opacity disabled:opacity-40"
          >
            {buscando ? "Buscando…" : "Buscar"}
          </button>
        </div>
        {erroBusca && <p className="text-sm text-ambar">{erroBusca}</p>}
      </form>

      {comanda && (
        <div className="flex flex-col gap-4 border-y border-linha py-6">
          <div>
            <p className="font-mono text-xl text-tinta">comanda {comanda.CodigoFisico}</p>
            <p className="mt-1 text-sm text-texto-secundario">status atual: {statusLabel(comanda.Status)}</p>
          </div>

          {comanda.Status !== "em_uso" ? (
            <p className="text-sm text-ambar">
              Só é possível cancelar uma comanda em atendimento ativo (em uso) — esta está {statusLabel(comanda.Status)}.
            </p>
          ) : (
            <>
              <label className="flex flex-col gap-1">
                <span className="text-sm text-texto-secundario">Motivo do cancelamento</span>
                <input
                  type="text"
                  value={motivo}
                  onChange={(e) => setMotivo(e.target.value)}
                  className="border-b border-linha bg-transparent py-2 text-sm text-tinta outline-none focus:border-ambar"
                />
              </label>

              <button
                type="button"
                onClick={cancelar}
                disabled={motivo.trim() === "" || cancelando}
                className="self-start bg-tinta px-6 py-3 text-sm font-medium text-papel transition-opacity disabled:opacity-40"
              >
                {cancelando ? "Cancelando…" : `Cancelar comanda ${comanda.CodigoFisico}`}
              </button>
              {erroCancelar && <p className="text-sm text-ambar">{erroCancelar}</p>}
            </>
          )}
        </div>
      )}
    </div>
  );
}
