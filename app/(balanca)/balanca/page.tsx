"use client";

import { useMemo, useState } from "react";

// Produtos de exemplo — os mesmos do seed de dev do backend
// (merka-api/migrations/0009_seed_dev.sql), só pra pré-visualizar o
// cálculo aqui. O backend ainda não expõe um endpoint de listar produtos,
// então esta tela NÃO chama a API ainda (nem POST /comandas/:id/pesos) —
// é só a prévia visual da regra de cálculo de US-09:
// valor = (peso_bruto - tara_kg) × preço_por_kg
// (ver merka-api/internal/domain/order_item.go).
const PRODUTOS_PESO = [{ id: "buffet", nome: "Buffet por Peso", precoPorKg: 79.9, taraKg: 0.35 }];

function formatarMoeda(valor: number) {
  return valor.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

export default function BalancaPage() {
  const [produtoId, setProdutoId] = useState(PRODUTOS_PESO[0].id);
  const [pesoBruto, setPesoBruto] = useState("");

  const produto = PRODUTOS_PESO.find((p) => p.id === produtoId) ?? PRODUTOS_PESO[0];

  const valorCalculado = useMemo(() => {
    const bruto = parseFloat(pesoBruto.replace(",", "."));
    if (Number.isNaN(bruto)) return null;
    const liquido = Math.max(bruto - produto.taraKg, 0);
    return liquido * produto.precoPorKg;
  }, [pesoBruto, produto]);

  return (
    <div className="mx-auto flex w-full max-w-sm flex-col gap-6">
      <div>
        <h2 className="text-lg font-semibold">Registrar peso</h2>
        <p className="text-sm text-slate-500 dark:text-slate-400">
          Leitura do peso bruto do prato — o valor é calculado automaticamente.
        </p>
      </div>

      <div className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-300">
        Tela ainda não conectada ao backend — falta o endpoint de listar produtos do catálogo.
        Isto é só uma prévia do cálculo, com um produto de exemplo.
      </div>

      <div className="flex flex-col gap-3">
        <label className="flex flex-col gap-1 text-sm">
          <span className="font-medium text-slate-700 dark:text-slate-300">Produto</span>
          <select
            value={produtoId}
            onChange={(e) => setProdutoId(e.target.value)}
            className="rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:border-slate-500 dark:border-slate-700 dark:bg-slate-950"
          >
            {PRODUTOS_PESO.map((p) => (
              <option key={p.id} value={p.id}>
                {p.nome} — {formatarMoeda(p.precoPorKg)}/kg
              </option>
            ))}
          </select>
        </label>

        <label className="flex flex-col gap-1 text-sm">
          <span className="font-medium text-slate-700 dark:text-slate-300">Peso bruto (kg)</span>
          <input
            type="text"
            inputMode="decimal"
            value={pesoBruto}
            onChange={(e) => setPesoBruto(e.target.value)}
            placeholder="0,000"
            autoFocus
            className="rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:border-slate-500 dark:border-slate-700 dark:bg-slate-950"
          />
        </label>
      </div>

      <div className="rounded-md border border-slate-200 bg-white p-4 text-center dark:border-slate-800 dark:bg-slate-900">
        <p className="text-xs text-slate-500 dark:text-slate-400">Valor calculado</p>
        <p className="mt-1 text-2xl font-semibold">
          {valorCalculado === null ? "—" : formatarMoeda(valorCalculado)}
        </p>
        <p className="mt-1 text-xs text-slate-400 dark:text-slate-500">
          (peso bruto − {produto.taraKg.toFixed(3)} kg de tara) × {formatarMoeda(produto.precoPorKg)}/kg
        </p>
      </div>

      <button
        type="button"
        disabled
        title="Endpoint de registro ainda não conectado nesta tela"
        className="rounded-md bg-slate-300 px-4 py-2 text-sm font-medium text-slate-500 dark:bg-slate-800 dark:text-slate-500"
      >
        Confirmar (em breve)
      </button>
    </div>
  );
}
