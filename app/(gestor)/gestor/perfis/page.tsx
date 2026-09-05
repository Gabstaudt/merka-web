"use client";

import { useCallback, useEffect, useState, type FormEvent } from "react";

// domain.Role e domain.PermissionCatalogo não têm json tag nenhuma, então
// serializam em PascalCase — diferente de usuarioResponse/auditoriaResponse
// (ver notas nas outras abas do Gestor). GET /perfis/:id/permissoes e
// POST/PUT do corpo da requisição, por outro lado, usam minúsculo — os
// dois formatos convivem nesta mesma tela, cada um no seu lugar.
type Role = { ID: string; Nome: string; Sistema: boolean };
type PermissionCatalogo = { ID: string; Chave: string; Descricao: string };

export default function PerfisPage() {
  const [perfis, setPerfis] = useState<Role[]>([]);
  const [catalogo, setCatalogo] = useState<PermissionCatalogo[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const [mostrarCriar, setMostrarCriar] = useState(false);
  const [perfilEditandoId, setPerfilEditandoId] = useState<string | null>(null);

  const carregar = useCallback(() => {
    setCarregando(true);
    setErro(null);
    Promise.all([
      fetch("/api/perfis").then((res) => res.json().then((data) => ({ ok: res.ok, data }))),
      fetch("/api/permissoes").then((res) => res.json().then((data) => ({ ok: res.ok, data }))),
    ])
      .then(([perfisRes, catalogoRes]) => {
        if (!perfisRes.ok) {
          setErro(perfisRes.data.erro ?? "não foi possível carregar os perfis");
          return;
        }
        setPerfis(Array.isArray(perfisRes.data) ? perfisRes.data : []);
        setCatalogo(Array.isArray(catalogoRes.data) ? catalogoRes.data : []);
      })
      .catch(() => setErro("Sem conexão com o servidor. Confira a rede e tente de novo."))
      .finally(() => setCarregando(false));
  }, []);

  useEffect(() => {
    Promise.resolve().then(carregar);
  }, [carregar]);

  return (
    <div className="flex flex-col gap-8">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl text-tinta">Perfis e Permissões</h1>
          <p className="mt-1 text-sm text-texto-secundario">
            Perfis de sistema (ex: Admin Super) são imutáveis. Perfis customizados podem ter as permissões editadas
            a qualquer momento.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setMostrarCriar((v) => !v)}
          className="shrink-0 bg-tinta px-5 py-2 text-sm font-medium text-papel"
        >
          {mostrarCriar ? "Fechar" : "Novo perfil"}
        </button>
      </div>

      {mostrarCriar && (
        <CriarPerfilForm
          catalogo={catalogo}
          onCriado={() => {
            setMostrarCriar(false);
            carregar();
          }}
        />
      )}

      {carregando && <p className="text-sm text-texto-secundario">Carregando…</p>}
      {erro && <p className="text-sm text-ambar">{erro}</p>}

      {!carregando && !erro && (
        <ul className="flex flex-col">
          {perfis.length === 0 && <li className="py-6 text-sm text-texto-secundario">Nenhum perfil cadastrado.</li>}
          {perfis.map((p) => (
            <li key={p.ID} className="border-t border-linha py-4 first:border-t-0">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <p className="text-base text-tinta">
                    {p.Nome} {p.Sistema && <span className="text-sm text-texto-secundario">· perfil de sistema</span>}
                  </p>
                </div>
                {p.Sistema ? (
                  <span
                    title="Perfis de sistema são imutáveis — não podem ter as permissões editadas, pra nunca travar o próprio acesso do sistema."
                    className="shrink-0 text-sm text-texto-secundario/60"
                  >
                    Imutável
                  </span>
                ) : (
                  <button
                    type="button"
                    onClick={() => setPerfilEditandoId(perfilEditandoId === p.ID ? null : p.ID)}
                    className="shrink-0 text-sm text-texto-secundario underline underline-offset-2 hover:text-tinta"
                  >
                    {perfilEditandoId === p.ID ? "Fechar" : "Editar permissões"}
                  </button>
                )}
              </div>

              {perfilEditandoId === p.ID && (
                <EditarPermissoesPanel
                  perfil={p}
                  catalogo={catalogo}
                  onSalvo={() => setPerfilEditandoId(null)}
                />
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

// PermissoesCheckboxList: catálogo fixo inteiro, uma linha por permissão
// (chave em mono + descrição). Não agrupa por categoria — o catálogo é
// pequeno o bastante (~17 chaves) pra uma lista só ser mais rápida de
// escanear do que seções colapsáveis.
function PermissoesCheckboxList({
  catalogo,
  selecionadas,
  onMudar,
}: {
  catalogo: PermissionCatalogo[];
  selecionadas: Set<string>;
  onMudar: (chave: string, marcado: boolean) => void;
}) {
  if (catalogo.length === 0) {
    return <p className="text-sm text-texto-secundario">Catálogo de permissões vazio.</p>;
  }

  return (
    <ul className="grid grid-cols-1 gap-x-8 gap-y-2 sm:grid-cols-2">
      {catalogo.map((perm) => (
        <li key={perm.ID}>
          <label className="flex items-start gap-3 py-1">
            <input
              type="checkbox"
              checked={selecionadas.has(perm.Chave)}
              onChange={(e) => onMudar(perm.Chave, e.target.checked)}
              className="mt-1 h-4 w-4 accent-tinta"
            />
            <span className="text-sm">
              <span className="block font-mono text-tinta">{perm.Chave}</span>
              <span className="block text-texto-secundario">{perm.Descricao}</span>
            </span>
          </label>
        </li>
      ))}
    </ul>
  );
}

function CriarPerfilForm({ catalogo, onCriado }: { catalogo: PermissionCatalogo[]; onCriado: () => void }) {
  const [nome, setNome] = useState("");
  const [selecionadas, setSelecionadas] = useState<Set<string>>(new Set());
  const [criando, setCriando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  function alternar(chave: string, marcado: boolean) {
    setSelecionadas((atual) => {
      const novo = new Set(atual);
      if (marcado) novo.add(chave);
      else novo.delete(chave);
      return novo;
    });
  }

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (nome.trim() === "" || criando) return;

    setCriando(true);
    setErro(null);
    const res = await fetch("/api/perfis", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ nome: nome.trim(), permissoes: Array.from(selecionadas) }),
    });
    setCriando(false);

    if (res.ok) {
      onCriado();
    } else {
      const data = await res.json().catch(() => ({}));
      setErro(data.erro ?? "não foi possível criar o perfil");
    }
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-4 border-y border-linha py-6">
      <label className="flex flex-col gap-1 sm:w-64">
        <span className="text-sm text-texto-secundario">Nome do perfil</span>
        <input
          type="text"
          value={nome}
          onChange={(e) => setNome(e.target.value)}
          autoFocus
          className="border-b border-linha bg-transparent py-2 text-sm text-tinta outline-none focus:border-ambar"
        />
      </label>

      <PermissoesCheckboxList catalogo={catalogo} selecionadas={selecionadas} onMudar={alternar} />

      <button
        type="submit"
        disabled={nome.trim() === "" || criando}
        className="self-start bg-tinta px-6 py-2 text-sm font-medium text-papel transition-opacity disabled:opacity-40"
      >
        {criando ? "Criando…" : "Criar perfil"}
      </button>

      {erro && <p className="text-sm text-ambar">{erro}</p>}
    </form>
  );
}

function EditarPermissoesPanel({
  perfil,
  catalogo,
  onSalvo,
}: {
  perfil: Role;
  catalogo: PermissionCatalogo[];
  onSalvo: () => void;
}) {
  const [selecionadas, setSelecionadas] = useState<Set<string> | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    fetch(`/api/perfis/${encodeURIComponent(perfil.ID)}/permissoes`)
      .then((res) => res.json().then((data) => ({ ok: res.ok, data })))
      .then(({ ok, data }) => {
        if (!ok) {
          setErro(data.erro ?? "não foi possível carregar as permissões atuais");
          return;
        }
        setSelecionadas(new Set(Array.isArray(data) ? data : []));
      })
      .catch(() => setErro("Sem conexão com o servidor. Confira a rede e tente de novo."))
      .finally(() => setCarregando(false));
  }, [perfil.ID]);

  function alternar(chave: string, marcado: boolean) {
    setSelecionadas((atual) => {
      const novo = new Set(atual ?? []);
      if (marcado) novo.add(chave);
      else novo.delete(chave);
      return novo;
    });
  }

  async function salvar() {
    if (!selecionadas || salvando) return;
    setSalvando(true);
    setErro(null);

    const res = await fetch(`/api/perfis/${encodeURIComponent(perfil.ID)}/permissoes`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ permissoes: Array.from(selecionadas) }),
    });
    setSalvando(false);

    if (res.ok) {
      onSalvo();
    } else {
      const data = await res.json().catch(() => ({}));
      setErro(data.erro ?? "não foi possível salvar as permissões");
    }
  }

  return (
    <div className="mt-4 flex flex-col gap-4 border-l-2 border-ambar pl-4">
      {carregando && <p className="text-sm text-texto-secundario">Carregando permissões atuais…</p>}
      {!carregando && selecionadas && (
        <>
          <PermissoesCheckboxList catalogo={catalogo} selecionadas={selecionadas} onMudar={alternar} />
          <button
            type="button"
            onClick={salvar}
            disabled={salvando}
            className="self-start bg-tinta px-6 py-2 text-sm font-medium text-papel transition-opacity disabled:opacity-40"
          >
            {salvando ? "Salvando…" : "Salvar alterações"}
          </button>
        </>
      )}
      {erro && <p className="text-sm text-ambar">{erro}</p>}
    </div>
  );
}
