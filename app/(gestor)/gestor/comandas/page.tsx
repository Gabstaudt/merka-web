"use client";

import { useEffect, useState, type FormEvent } from "react";

type Comanda = { ID: string; Status: string; CodigoFisico: string; TableID: string | null };

type ComandaVisaoGeral = {
  id: string;
  codigo_fisico: string;
  status: string;
  mesa: string | null;
  quantidade_itens: number;
  valor_total: number;
};

function statusLabel(status: string) {
  if (status === "em_uso") return "em uso";
  if (status === "disponivel") return "disponível";
  if (status === "paga") return "paga";
  if (status === "cancelada") return "cancelada";
  return status;
}

function formatarMoeda(valor: number) {
  return valor.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

// TodasComandasSection: visão geral de TODAS as comandas do tenant, com o
// que está lançado em cada uma — pra conferência rápida (ex: "essa
// comanda tem algo pendente?") sem precisar saber o código de antemão.
// Quem tem a permissão "criar_comanda" (Admin Super/Gestor) também
// cadastra uma comanda física nova aqui — o código já existe no
// cartão/pulseira confeccionado, só falta entrar no banco.
function TodasComandasSection() {
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const [comandas, setComandas] = useState<ComandaVisaoGeral[]>([]);
  const [podeCriar, setPodeCriar] = useState(false);
  const [podeExcluir, setPodeExcluir] = useState(false);

  function carregar() {
    setCarregando(true);
    setErro(null);
    fetch("/api/comandas/todas")
      .then((res) => res.json().then((data) => ({ ok: res.ok, data })))
      .then(({ ok, data }) => {
        if (!ok) {
          setErro(data.erro ?? "não foi possível carregar as comandas");
          return;
        }
        setComandas(Array.isArray(data) ? data : []);
      })
      .catch(() => setErro("Sem conexão com o servidor. Confira a rede e tente de novo."))
      .finally(() => setCarregando(false));
  }

  useEffect(() => {
    Promise.resolve().then(() => carregar());
    fetch("/api/me")
      .then((res) => res.json())
      .then((data) => {
        const permissoes = Array.isArray(data.permissoes) ? data.permissoes : [];
        setPodeCriar(permissoes.includes("criar_comanda"));
        setPodeExcluir(permissoes.includes("excluir_comanda"));
      })
      .catch(() => {
        setPodeCriar(false);
        setPodeExcluir(false);
      });
  }, []);

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="font-display text-2xl text-tinta">Todas as comandas</h1>
        <p className="mt-1 text-sm text-texto-secundario">
          Status e o que está lançado em cada comanda do tenant, de uma vez só.
        </p>
      </div>

      {podeCriar && <CriarComandaForm onCriada={carregar} />}

      {carregando && <p className="text-sm text-texto-secundario">Carregando…</p>}
      {erro && <p className="text-sm text-ambar">{erro}</p>}
      {!carregando && !erro && comandas.length === 0 && (
        <p className="text-sm text-texto-secundario">Nenhuma comanda cadastrada.</p>
      )}
      {!carregando && !erro && comandas.length > 0 && (
        <ul className="flex flex-col border-y border-linha">
          {comandas.map((c) => (
            <ComandaRow key={c.id} comanda={c} podeExcluir={podeExcluir} onExcluida={carregar} />
          ))}
        </ul>
      )}
    </div>
  );
}

// ComandaRow: uma linha da visão geral, com a ação de excluir (permissão
// excluir_comanda, Admin Super/Gestor) — exclusão DE VERDADE (o código
// físico deixa de existir e pode ser reaproveitado depois), não um soft-
// delete. Só funciona se a comanda NÃO estiver em uso e nunca tiver tido
// item/pagamento/desconto/alerta (backend recusa com 409 em ambos os
// casos — aqui só evita o clique inútil no primeiro). Confirmação
// inline, sem motivo — a exclusão em si continua auditada.
function ComandaRow({
  comanda,
  podeExcluir,
  onExcluida,
}: {
  comanda: ComandaVisaoGeral;
  podeExcluir: boolean;
  onExcluida: () => void;
}) {
  const [confirmando, setConfirmando] = useState(false);
  const [excluindo, setExcluindo] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  async function excluir() {
    if (excluindo) return;
    setExcluindo(true);
    setErro(null);

    try {
      const res = await fetch(`/api/comandas/${encodeURIComponent(comanda.id)}`, { method: "DELETE" });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setErro(data.erro ?? "não foi possível excluir a comanda");
        return;
      }
      onExcluida();
    } catch {
      setErro("Sem conexão com o servidor. Confira a rede e tente de novo.");
    } finally {
      setExcluindo(false);
    }
  }

  return (
    <li className="border-t border-linha py-3 first:border-t-0">
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-baseline gap-3">
          <span className="font-mono text-base text-tinta">{comanda.codigo_fisico}</span>
          <span className="text-sm text-texto-secundario">
            {statusLabel(comanda.status)}
            {comanda.mesa && ` · ${comanda.mesa}`}
          </span>
        </div>
        <div className="flex items-center gap-4">
          <span className="text-sm text-texto-secundario">
            {comanda.quantidade_itens > 0
              ? `${comanda.quantidade_itens} ${comanda.quantidade_itens > 1 ? "itens" : "item"} · ${formatarMoeda(comanda.valor_total)}`
              : "sem itens lançados"}
          </span>
          {podeExcluir && !confirmando && (
            <button
              type="button"
              onClick={() => setConfirmando(true)}
              disabled={comanda.status === "em_uso"}
              title={comanda.status === "em_uso" ? "Não é possível excluir uma comanda em uso" : undefined}
              className="text-sm text-texto-secundario underline underline-offset-2 hover:text-tinta disabled:opacity-40 disabled:no-underline"
            >
              Excluir
            </button>
          )}
        </div>
      </div>

      {confirmando && (
        <div className="mt-2 flex items-center gap-4 border-l-2 border-ambar pl-4">
          <span className="text-sm text-texto-secundario">
            Excluir a comanda {comanda.codigo_fisico} de vez? O código deixa de existir no sistema — essa ação não
            pode ser desfeita, mas o código fica livre pra um cartão físico novo.
          </span>
          <button
            type="button"
            onClick={excluir}
            disabled={excluindo}
            className="bg-tinta px-4 py-1.5 text-sm font-medium text-papel transition-opacity disabled:opacity-40"
          >
            {excluindo ? "Excluindo…" : "Confirmar"}
          </button>
          <button type="button" onClick={() => setConfirmando(false)} className="text-sm text-texto-secundario hover:text-tinta">
            Cancelar
          </button>
        </div>
      )}
      {erro && <p className="mt-2 text-sm text-ambar">{erro}</p>}
    </li>
  );
}

// CriarComandaForm: cadastra o código físico de uma comanda recém-
// confeccionada — nasce sempre "disponivel", pronta pro Porteiro
// entregar. Não é "gerar numeração": o código já existe no cartão/
// pulseira, aqui só registra no sistema.
function CriarComandaForm({ onCriada }: { onCriada: () => void }) {
  const [codigo, setCodigo] = useState("");
  const [criando, setCriando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  async function criar(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const codigoAtual = codigo.trim();
    if (codigoAtual === "" || criando) return;

    setCriando(true);
    setErro(null);

    try {
      const res = await fetch("/api/comandas", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ codigo_fisico: codigoAtual }),
      });
      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        setErro(data.erro ?? "não foi possível cadastrar a comanda");
        return;
      }

      setCodigo("");
      onCriada();
    } catch {
      setErro("Sem conexão com o servidor. Confira a rede e tente de novo.");
    } finally {
      setCriando(false);
    }
  }

  return (
    <form onSubmit={criar} className="flex flex-col gap-2 border-b border-linha pb-4">
      <span className="text-sm text-texto-secundario">Cadastrar comanda física nova</span>
      <div className="flex gap-3">
        <input
          type="text"
          value={codigo}
          onChange={(e) => setCodigo(e.target.value)}
          placeholder="Código físico (ex: C123)"
          autoComplete="off"
          className="flex-1 border-b-2 border-tinta bg-transparent pb-2 font-mono text-lg text-tinta outline-none placeholder:text-texto-secundario/50 focus:border-ambar sm:flex-none sm:w-64"
        />
        <button
          type="submit"
          disabled={codigo.trim() === "" || criando}
          className="bg-tinta px-5 text-sm font-medium text-papel transition-opacity disabled:opacity-40"
        >
          {criando ? "Cadastrando…" : "Cadastrar"}
        </button>
      </div>
      {erro && <p className="text-sm text-ambar">{erro}</p>}
    </form>
  );
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
    <div className="flex flex-col gap-12">
      <TodasComandasSection />

      <div className="flex flex-col gap-8 border-t border-linha pt-10">
        <div>
          <h2 className="font-display text-2xl text-tinta">Cancelamento total de comanda</h2>
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
    </div>
  );
}
