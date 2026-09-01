"use client";

import { useState, type FormEvent } from "react";

type Comanda = {
  ID: string;
  TenantID: string;
  CodigoFisico: string;
  Status: string;
  TableID: string | null;
  AbertaEm: string | null;
  FechadaEm: string | null;
};

// US-07: entregar comanda zerada ao cliente na entrada. Já conectado de
// verdade em POST /api/comandas/:codigo/abrir → backend
// POST /comandas/:codigo/abrir (ver merka-api CLAUDE.md).
//
// US-08 (receber comanda na saída) ainda não tem endpoint no backend —
// fica como próximo passo, não implementado aqui ainda.
export default function PorteiroPage() {
  const [codigo, setCodigo] = useState("");
  const [resultado, setResultado] = useState<Comanda | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [carregando, setCarregando] = useState(false);

  async function abrirComanda(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setErro(null);
    setResultado(null);
    setCarregando(true);

    try {
      const res = await fetch(`/api/comandas/${encodeURIComponent(codigo)}/abrir`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        setErro(data.erro ?? "erro ao abrir a comanda");
        return;
      }

      setResultado(data as Comanda);
      setCodigo("");
    } catch {
      setErro("erro de conexão com o servidor");
    } finally {
      setCarregando(false);
    }
  }

  return (
    <div className="mx-auto flex w-full max-w-sm flex-col gap-6">
      <div>
        <h2 className="text-lg font-semibold">Entregar comanda</h2>
        <p className="text-sm text-slate-500 dark:text-slate-400">
          Escaneie ou digite o código físico da comanda para liberá-la ao cliente.
        </p>
      </div>

      <form onSubmit={abrirComanda} className="flex flex-col gap-3">
        <label className="flex flex-col gap-1 text-sm">
          <span className="font-medium text-slate-700 dark:text-slate-300">Código da comanda</span>
          <input
            type="text"
            value={codigo}
            onChange={(e) => setCodigo(e.target.value)}
            placeholder="ex: C001"
            autoFocus
            required
            className="rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:border-slate-500 dark:border-slate-700 dark:bg-slate-950"
          />
        </label>

        <button
          type="submit"
          disabled={carregando || codigo.trim() === ""}
          className="rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-slate-800 disabled:opacity-50 dark:bg-slate-50 dark:text-slate-900 dark:hover:bg-slate-200"
        >
          {carregando ? "Abrindo…" : "Abrir comanda"}
        </button>
      </form>

      {erro && (
        <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-950 dark:text-red-300">
          {erro}
        </p>
      )}

      {resultado && (
        <div className="rounded-md border border-emerald-200 bg-emerald-50 px-3 py-3 text-sm text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950 dark:text-emerald-300">
          <p className="font-medium">Comanda {resultado.CodigoFisico} liberada</p>
          <dl className="mt-2 grid grid-cols-[auto_1fr] gap-x-2 gap-y-1 text-xs">
            <dt className="text-emerald-600 dark:text-emerald-400">status</dt>
            <dd>{resultado.Status}</dd>
            <dt className="text-emerald-600 dark:text-emerald-400">aberta em</dt>
            <dd>{resultado.AbertaEm ? new Date(resultado.AbertaEm).toLocaleString("pt-BR") : "—"}</dd>
          </dl>
        </div>
      )}
    </div>
  );
}
