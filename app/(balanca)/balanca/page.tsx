"use client";

import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";

import { conectarBalanca, suportaWebSerial, type LeitorBalanca } from "@/lib/serial-balanca";

// Sem inscrição real (a capacidade do navegador não muda em runtime) —
// só precisamos do snapshot certo em cada lado. useSyncExternalStore é o
// jeito correto de ler uma API só-do-browser sem cair no erro de hidratação
// (server nunca tem `navigator.serial`) nem chamar setState dentro de um
// useEffect só para sincronizar esse valor uma vez.
const semInscricao = () => () => {};

function useWebSerialDisponivel(): boolean {
  return useSyncExternalStore(semInscricao, suportaWebSerial, () => false);
}

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

type StatusBalanca = "desconectada" | "conectando" | "conectada" | "erro";

export default function BalancaPage() {
  const [produtoId, setProdutoId] = useState(PRODUTOS_PESO[0].id);
  const [pesoBruto, setPesoBruto] = useState("");
  const webSerialDisponivel = useWebSerialDisponivel();
  const [status, setStatus] = useState<StatusBalanca>("desconectada");
  const [erroBalanca, setErroBalanca] = useState<string | null>(null);

  const leitorRef = useRef<LeitorBalanca | null>(null);

  useEffect(() => {
    // Desconecta a porta serial ao sair da tela — nunca deixa a leitura
    // rodando em background sem ninguém olhando.
    return () => {
      leitorRef.current?.parar();
    };
  }, []);

  const produto = PRODUTOS_PESO.find((p) => p.id === produtoId) ?? PRODUTOS_PESO[0];

  const valorCalculado = useMemo(() => {
    const bruto = parseFloat(pesoBruto.replace(",", "."));
    if (Number.isNaN(bruto)) return null;
    const liquido = Math.max(bruto - produto.taraKg, 0);
    return liquido * produto.precoPorKg;
  }, [pesoBruto, produto]);

  async function conectar() {
    setStatus("conectando");
    setErroBalanca(null);

    const leitor = await conectarBalanca(
      (peso) => setPesoBruto(peso.toFixed(3).replace(".", ",")),
      (motivo) => {
        setStatus("erro");
        setErroBalanca(motivo);
      }
    );

    if (!leitor) {
      setStatus("erro");
      return;
    }

    leitorRef.current = leitor;
    setStatus("conectada");
  }

  async function desconectar() {
    await leitorRef.current?.parar();
    leitorRef.current = null;
    setStatus("desconectada");
  }

  return (
    <div className="mx-auto flex w-full max-w-sm flex-col gap-6">
      <div>
        <h2 className="text-lg font-semibold">Registrar peso</h2>
        <p className="text-sm text-slate-500 dark:text-slate-400">
          Leitura do peso bruto do prato — o valor é calculado automaticamente.
        </p>
      </div>

      <div className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-300">
        Tela ainda não conectada ao backend — falta o endpoint de listar produtos do catálogo, e o
        botão &quot;Confirmar&quot; abaixo ainda não chama <code>POST /comandas/:id/pesos</code>.
        Isto é só uma prévia do cálculo, com um produto de exemplo.
      </div>

      <div className="flex flex-col gap-3 rounded-lg border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
        <div>
          <h3 className="text-sm font-semibold">Leitura da balança</h3>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Balança Toledo Prix 3, via Web Serial API (Chrome/Edge) — ainda não validado contra o
            equipamento físico, ver comentário em lib/serial-balanca.ts.
          </p>
        </div>

        {webSerialDisponivel ? (
          <div className="flex items-center gap-2">
            {status === "conectada" ? (
              <button
                type="button"
                onClick={desconectar}
                className="flex-1 rounded-md border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-600 transition hover:bg-slate-100 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
              >
                Desconectar
              </button>
            ) : (
              <button
                type="button"
                onClick={conectar}
                disabled={status === "conectando"}
                className="flex-1 rounded-md bg-slate-900 px-3 py-1.5 text-xs font-medium text-white transition hover:bg-slate-800 disabled:opacity-50 dark:bg-slate-50 dark:text-slate-900 dark:hover:bg-slate-200"
              >
                {status === "conectando" ? "Conectando…" : "Conectar balança"}
              </button>
            )}
            <span className="text-xs text-slate-400">
              {status === "conectada" && "● lendo continuamente"}
              {status === "desconectada" && "○ desconectada"}
              {status === "erro" && "○ erro"}
            </span>
          </div>
        ) : (
          <p className="rounded-md bg-slate-100 px-3 py-2 text-xs text-slate-600 dark:bg-slate-800 dark:text-slate-300">
            Este navegador não suporta Web Serial API — use o campo de peso manual abaixo.
          </p>
        )}

        {erroBalanca && (
          <p className="rounded-md bg-red-50 px-3 py-2 text-xs text-red-700 dark:bg-red-950 dark:text-red-300">
            {erroBalanca} — a digitação manual continua funcionando normalmente.
          </p>
        )}
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
          <span className="font-medium text-slate-700 dark:text-slate-300">
            Peso bruto (kg) {status === "conectada" && <span className="text-slate-400">— ao vivo</span>}
          </span>
          <input
            type="text"
            inputMode="decimal"
            value={pesoBruto}
            onChange={(e) => setPesoBruto(e.target.value)}
            placeholder="0,000"
            readOnly={status === "conectada"}
            autoFocus
            className="rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:border-slate-500 read-only:bg-slate-50 dark:border-slate-700 dark:bg-slate-950 dark:read-only:bg-slate-900"
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
