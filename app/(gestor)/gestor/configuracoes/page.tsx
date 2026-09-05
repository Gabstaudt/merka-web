"use client";

import { useCallback, useEffect, useState, type FormEvent } from "react";

// pricingRuleResponse usa json tags minúsculos (ver
// merka-api/internal/handler/pricing_rule_handler.go) — mesmo padrão de
// outras respostas em envelope desta área (ver notas nas abas Auditoria/
// Notas Fiscais/Perfis). mesaCompletaResponse idem.
type PricingRule = { id: string; chave: string; configuracao: Record<string, unknown>; ativo: boolean };
type Mesa = { id: string; identificador: string; ativo: boolean };

function regraPorChave(regras: PricingRule[], chave: string): PricingRule | undefined {
  return regras.find((r) => r.chave === chave);
}

// Configurações estruturais do tenant (ETAPA 3 do Admin Super) — taxa de
// serviço, rodízio por pessoa (pricing_rules) e gestão de mesas. Cada
// seção salva/atualiza de verdade contra o backend (GET/PUT
// /configuracoes e /mesas, ambos implementados nesta mesma rodada).
export default function ConfiguracoesPage() {
  const [regras, setRegras] = useState<PricingRule[]>([]);
  const [carregandoRegras, setCarregandoRegras] = useState(true);
  const [erroRegras, setErroRegras] = useState<string | null>(null);

  const carregarRegras = useCallback(() => {
    setCarregandoRegras(true);
    setErroRegras(null);
    fetch("/api/configuracoes")
      .then((res) => res.json().then((data) => ({ ok: res.ok, data })))
      .then(({ ok, data }) => {
        if (!ok) {
          setErroRegras(data.erro ?? "não foi possível carregar as configurações");
          return;
        }
        setRegras(Array.isArray(data) ? data : []);
      })
      .catch(() => setErroRegras("Sem conexão com o servidor. Confira a rede e tente de novo."))
      .finally(() => setCarregandoRegras(false));
  }, []);

  useEffect(() => {
    Promise.resolve().then(carregarRegras);
  }, [carregarRegras]);

  return (
    <div className="flex flex-col gap-12">
      <div>
        <h1 className="font-display text-2xl text-tinta">Configurações</h1>
        <p className="mt-1 text-sm text-texto-secundario">
          Regras gerais do tenant — taxa de serviço, rodízio por pessoa e gestão de mesas.
        </p>
      </div>

      <section className="flex flex-col gap-6">
        <h2 className="text-sm text-texto-secundario">Regras de precificação</h2>
        {carregandoRegras && <p className="text-sm text-texto-secundario">Carregando…</p>}
        {erroRegras && <p className="text-sm text-ambar">{erroRegras}</p>}
        {!carregandoRegras && !erroRegras && (
          <>
            <TaxaServicoForm regra={regraPorChave(regras, "taxa_servico")} onSalvo={carregarRegras} />
            <RodizioPorPessoaForm regra={regraPorChave(regras, "rodizio_por_pessoa")} onSalvo={carregarRegras} />
          </>
        )}
      </section>

      <section className="flex flex-col gap-6 border-t border-linha pt-8">
        <h2 className="text-sm text-texto-secundario">Mesas</h2>
        <MesasSection />
      </section>
    </div>
  );
}

function TaxaServicoForm({ regra, onSalvo }: { regra: PricingRule | undefined; onSalvo: () => void }) {
  const percentualAtual = typeof regra?.configuracao.percentual === "number" ? regra.configuracao.percentual : 0;
  const [ativo, setAtivo] = useState(regra?.ativo ?? false);
  const [percentual, setPercentual] = useState(String(percentualAtual).replace(".", ","));
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [salvo, setSalvo] = useState(false);

  async function salvar(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSalvando(true);
    setErro(null);
    setSalvo(false);

    const valor = parseFloat(percentual.replace(",", "."));
    const res = await fetch("/api/configuracoes/taxa_servico", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ configuracao: { percentual: Number.isNaN(valor) ? 0 : valor }, ativo }),
    });
    setSalvando(false);

    if (res.ok) {
      setSalvo(true);
      onSalvo();
    } else {
      const data = await res.json().catch(() => ({}));
      setErro(data.erro ?? "não foi possível salvar");
    }
  }

  return (
    <form onSubmit={salvar} className="flex flex-col gap-3 border-l-2 border-linha pl-4">
      <div className="flex items-center justify-between gap-4">
        <span className="text-base text-tinta">Taxa de serviço</span>
        <label className="flex items-center gap-2 text-sm text-texto-secundario">
          Ativa
          <input type="checkbox" checked={ativo} onChange={(e) => setAtivo(e.target.checked)} className="h-4 w-4 accent-tinta" />
        </label>
      </div>
      <label className="flex flex-col gap-1 sm:w-40">
        <span className="text-sm text-texto-secundario">Percentual (%)</span>
        <input
          type="text"
          inputMode="decimal"
          value={percentual}
          onChange={(e) => setPercentual(e.target.value)}
          className="border-b-2 border-tinta bg-transparent py-1 font-mono text-lg text-tinta outline-none focus:border-ambar"
        />
      </label>
      <button
        type="submit"
        disabled={salvando}
        className="self-start bg-tinta px-5 py-2 text-sm font-medium text-papel transition-opacity disabled:opacity-40"
      >
        {salvando ? "Salvando…" : "Salvar"}
      </button>
      {salvo && <p className="text-sm text-ambar">Salvo.</p>}
      {erro && <p className="text-sm text-ambar">{erro}</p>}
    </form>
  );
}

function RodizioPorPessoaForm({ regra, onSalvo }: { regra: PricingRule | undefined; onSalvo: () => void }) {
  const valorAtual = typeof regra?.configuracao.valor_por_pessoa === "number" ? regra.configuracao.valor_por_pessoa : 0;
  const [ativo, setAtivo] = useState(regra?.ativo ?? false);
  const [valor, setValor] = useState(String(valorAtual).replace(".", ","));
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [salvo, setSalvo] = useState(false);

  async function salvar(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSalvando(true);
    setErro(null);
    setSalvo(false);

    const numero = parseFloat(valor.replace(",", "."));
    const res = await fetch("/api/configuracoes/rodizio_por_pessoa", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ configuracao: { valor_por_pessoa: Number.isNaN(numero) ? 0 : numero }, ativo }),
    });
    setSalvando(false);

    if (res.ok) {
      setSalvo(true);
      onSalvo();
    } else {
      const data = await res.json().catch(() => ({}));
      setErro(data.erro ?? "não foi possível salvar");
    }
  }

  return (
    <form onSubmit={salvar} className="flex flex-col gap-3 border-l-2 border-linha pl-4">
      <div className="flex items-center justify-between gap-4">
        <span className="text-base text-tinta">Rodízio por pessoa</span>
        <label className="flex items-center gap-2 text-sm text-texto-secundario">
          Ativo
          <input type="checkbox" checked={ativo} onChange={(e) => setAtivo(e.target.checked)} className="h-4 w-4 accent-tinta" />
        </label>
      </div>
      <label className="flex flex-col gap-1 sm:w-40">
        <span className="text-sm text-texto-secundario">Valor por pessoa (R$)</span>
        <input
          type="text"
          inputMode="decimal"
          value={valor}
          onChange={(e) => setValor(e.target.value)}
          className="border-b-2 border-tinta bg-transparent py-1 font-mono text-lg text-tinta outline-none focus:border-ambar"
        />
      </label>
      <button
        type="submit"
        disabled={salvando}
        className="self-start bg-tinta px-5 py-2 text-sm font-medium text-papel transition-opacity disabled:opacity-40"
      >
        {salvando ? "Salvando…" : "Salvar"}
      </button>
      {salvo && <p className="text-sm text-ambar">Salvo.</p>}
      {erro && <p className="text-sm text-ambar">{erro}</p>}
    </form>
  );
}

function MesasSection() {
  const [mesas, setMesas] = useState<Mesa[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const [novoIdentificador, setNovoIdentificador] = useState("");
  const [criando, setCriando] = useState(false);
  const [erroCriar, setErroCriar] = useState<string | null>(null);

  const carregar = useCallback(() => {
    setCarregando(true);
    setErro(null);
    fetch("/api/mesas/todas")
      .then((res) => res.json().then((data) => ({ ok: res.ok, data })))
      .then(({ ok, data }) => {
        if (!ok) {
          setErro(data.erro ?? "não foi possível carregar as mesas");
          return;
        }
        setMesas(Array.isArray(data) ? data : []);
      })
      .catch(() => setErro("Sem conexão com o servidor. Confira a rede e tente de novo."))
      .finally(() => setCarregando(false));
  }, []);

  useEffect(() => {
    Promise.resolve().then(carregar);
  }, [carregar]);

  async function criarMesa(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (novoIdentificador.trim() === "" || criando) return;

    setCriando(true);
    setErroCriar(null);
    const res = await fetch("/api/mesas", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ identificador: novoIdentificador.trim() }),
    });
    setCriando(false);

    if (res.ok) {
      setNovoIdentificador("");
      carregar();
    } else {
      const data = await res.json().catch(() => ({}));
      setErroCriar(data.erro ?? "não foi possível criar a mesa");
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <form onSubmit={criarMesa} className="flex gap-3">
        <input
          type="text"
          value={novoIdentificador}
          onChange={(e) => setNovoIdentificador(e.target.value)}
          placeholder="Ex: Mesa 12"
          className="flex-1 border-b border-linha bg-transparent py-2 text-sm text-tinta outline-none placeholder:text-texto-secundario/50 focus:border-ambar sm:flex-none sm:w-56"
        />
        <button
          type="submit"
          disabled={novoIdentificador.trim() === "" || criando}
          className="bg-tinta px-5 text-sm font-medium text-papel transition-opacity disabled:opacity-40"
        >
          {criando ? "Criando…" : "Nova mesa"}
        </button>
      </form>
      {erroCriar && <p className="text-sm text-ambar">{erroCriar}</p>}

      {carregando && <p className="text-sm text-texto-secundario">Carregando…</p>}
      {erro && <p className="text-sm text-ambar">{erro}</p>}
      {!carregando && !erro && (
        <ul className="flex flex-col">
          {mesas.length === 0 && <li className="py-4 text-sm text-texto-secundario">Nenhuma mesa cadastrada.</li>}
          {mesas.map((m) => (
            <MesaRow key={m.id} mesa={m} onAlterada={carregar} />
          ))}
        </ul>
      )}
    </div>
  );
}

function MesaRow({ mesa, onAlterada }: { mesa: Mesa; onAlterada: () => void }) {
  const [editando, setEditando] = useState(false);
  const [identificador, setIdentificador] = useState(mesa.identificador);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  async function renomear() {
    if (identificador.trim() === "" || salvando) return;
    setSalvando(true);
    setErro(null);
    const res = await fetch(`/api/mesas/${encodeURIComponent(mesa.id)}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ identificador: identificador.trim() }),
    });
    setSalvando(false);
    if (res.ok) {
      setEditando(false);
      onAlterada();
    } else {
      const data = await res.json().catch(() => ({}));
      setErro(data.erro ?? "não foi possível renomear");
    }
  }

  async function alternarAtivo() {
    setSalvando(true);
    setErro(null);
    const acao = mesa.ativo ? "desativar" : "reativar";
    const res = await fetch(`/api/mesas/${encodeURIComponent(mesa.id)}/${acao}`, { method: "PATCH" });
    setSalvando(false);
    if (res.ok) {
      onAlterada();
    } else {
      const data = await res.json().catch(() => ({}));
      setErro(data.erro ?? `não foi possível ${acao} a mesa`);
    }
  }

  return (
    <li className="border-t border-linha py-3 first:border-t-0">
      <div className="flex items-center justify-between gap-4">
        {editando ? (
          <div className="flex flex-1 items-center gap-3">
            <input
              type="text"
              value={identificador}
              onChange={(e) => setIdentificador(e.target.value)}
              autoFocus
              className="flex-1 border-b border-linha bg-transparent py-1 text-sm text-tinta outline-none focus:border-ambar sm:flex-none sm:w-48"
            />
            <button type="button" onClick={renomear} disabled={salvando} className="text-sm text-texto-secundario underline underline-offset-2 hover:text-tinta">
              Salvar
            </button>
            <button type="button" onClick={() => setEditando(false)} className="text-sm text-texto-secundario hover:text-tinta">
              Cancelar
            </button>
          </div>
        ) : (
          <span className="text-base text-tinta">
            {mesa.identificador} {!mesa.ativo && <span className="text-sm text-texto-secundario">· desativada</span>}
          </span>
        )}

        {!editando && (
          <div className="flex shrink-0 gap-4">
            <button type="button" onClick={() => setEditando(true)} className="text-sm text-texto-secundario underline underline-offset-2 hover:text-tinta">
              Renomear
            </button>
            <button
              type="button"
              onClick={alternarAtivo}
              disabled={salvando}
              className="text-sm text-texto-secundario underline underline-offset-2 hover:text-tinta disabled:opacity-40"
            >
              {mesa.ativo ? "Desativar" : "Reativar"}
            </button>
          </div>
        )}
      </div>
      {erro && <p className="mt-2 text-sm text-ambar">{erro}</p>}
    </li>
  );
}
