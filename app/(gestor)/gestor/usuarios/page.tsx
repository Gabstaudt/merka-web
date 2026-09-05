"use client";

import { useCallback, useEffect, useState, type FormEvent } from "react";

// usuarioResponse e criarUsuarioRequest usam json tags minúsculos (ver
// merka-api/internal/handler/user_handler.go) — mesmo padrão de
// GET /auditoria e GET /notas-fiscais (ver notas nas outras abas do
// Gestor). domain.Role (perfis) não tem tag nenhuma, então serializa em
// PascalCase — os dois formatos convivem nesta mesma tela.
type Usuario = { id: string; nome: string; login: string; role_id: string; ativo: boolean };
type Role = { ID: string; Nome: string; Sistema: boolean };

export default function UsuariosPage() {
  const [usuarios, setUsuarios] = useState<Usuario[]>([]);
  const [perfis, setPerfis] = useState<Role[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const [mostrarCriar, setMostrarCriar] = useState(false);

  const carregar = useCallback(() => {
    setCarregando(true);
    setErro(null);
    Promise.all([
      fetch("/api/usuarios").then((res) => res.json().then((data) => ({ ok: res.ok, data }))),
      fetch("/api/perfis").then((res) => res.json().then((data) => ({ ok: res.ok, data }))),
    ])
      .then(([usuariosRes, perfisRes]) => {
        if (!usuariosRes.ok) {
          setErro(usuariosRes.data.erro ?? "não foi possível carregar os usuários");
          return;
        }
        setUsuarios(Array.isArray(usuariosRes.data) ? usuariosRes.data : []);
        setPerfis(Array.isArray(perfisRes.data) ? perfisRes.data : []);
      })
      .catch(() => setErro("Sem conexão com o servidor. Confira a rede e tente de novo."))
      .finally(() => setCarregando(false));
  }, []);

  useEffect(() => {
    Promise.resolve().then(carregar);
  }, [carregar]);

  const perfisPorId = new Map(perfis.map((p) => [p.ID, p]));

  return (
    <div className="flex flex-col gap-8">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl text-tinta">Usuários</h1>
          <p className="mt-1 text-sm text-texto-secundario">Quem tem acesso ao sistema, e com qual perfil.</p>
        </div>
        <button
          type="button"
          onClick={() => setMostrarCriar((v) => !v)}
          className="shrink-0 bg-tinta px-5 py-2 text-sm font-medium text-papel"
        >
          {mostrarCriar ? "Fechar" : "Novo usuário"}
        </button>
      </div>

      {mostrarCriar && (
        <CriarUsuarioForm
          perfis={perfis}
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
          {usuarios.length === 0 && <li className="py-6 text-sm text-texto-secundario">Nenhum usuário cadastrado.</li>}
          {usuarios.map((u) => (
            <UsuarioRow key={u.id} usuario={u} perfilNome={perfisPorId.get(u.role_id)?.Nome} onAlterado={carregar} />
          ))}
        </ul>
      )}
    </div>
  );
}

function UsuarioRow({
  usuario,
  perfilNome,
  onAlterado,
}: {
  usuario: Usuario;
  perfilNome: string | undefined;
  onAlterado: () => void;
}) {
  const [desativando, setDesativando] = useState(false);
  const [confirmando, setConfirmando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  async function desativar() {
    setDesativando(true);
    setErro(null);
    const res = await fetch(`/api/usuarios/${encodeURIComponent(usuario.id)}/desativar`, { method: "PATCH" });
    setDesativando(false);
    if (res.ok) {
      onAlterado();
    } else {
      const data = await res.json().catch(() => ({}));
      setErro(data.erro ?? "não foi possível desativar o usuário");
      setConfirmando(false);
    }
  }

  return (
    <li className="border-t border-linha py-4 first:border-t-0">
      <div className="flex items-center justify-between gap-4">
        <div>
          <p className="text-base text-tinta">
            {usuario.nome} {!usuario.ativo && <span className="text-sm text-texto-secundario">· desativado</span>}
          </p>
          <p className="mt-1 text-sm text-texto-secundario">
            {usuario.login} · {perfilNome ?? "perfil desconhecido"}
          </p>
        </div>
        {usuario.ativo && !confirmando && (
          <button
            type="button"
            onClick={() => setConfirmando(true)}
            className="shrink-0 text-sm text-texto-secundario underline underline-offset-2 hover:text-tinta"
          >
            Desativar
          </button>
        )}
        {usuario.ativo && confirmando && (
          <div className="flex shrink-0 items-center gap-3">
            <span className="text-sm text-texto-secundario">Desativar {usuario.nome}?</span>
            <button
              type="button"
              onClick={desativar}
              disabled={desativando}
              className="bg-tinta px-3 py-1.5 text-sm font-medium text-papel transition-opacity disabled:opacity-40"
            >
              {desativando ? "Desativando…" : "Confirmar"}
            </button>
            <button type="button" onClick={() => setConfirmando(false)} className="text-sm text-texto-secundario hover:text-tinta">
              Cancelar
            </button>
          </div>
        )}
      </div>
      {erro && <p className="mt-2 text-sm text-ambar">{erro}</p>}
    </li>
  );
}

function CriarUsuarioForm({ perfis, onCriado }: { perfis: Role[]; onCriado: () => void }) {
  const [nome, setNome] = useState("");
  const [login, setLogin] = useState("");
  const [senha, setSenha] = useState("");
  const [roleId, setRoleId] = useState(perfis[0]?.ID ?? "");
  const [criando, setCriando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (nome.trim() === "" || login.trim() === "" || senha.trim() === "" || roleId === "" || criando) return;

    setCriando(true);
    setErro(null);
    const res = await fetch("/api/usuarios", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ nome: nome.trim(), login: login.trim(), senha, role_id: roleId }),
    });
    setCriando(false);

    if (res.ok) {
      onCriado();
    } else {
      const data = await res.json().catch(() => ({}));
      setErro(data.erro ?? "não foi possível criar o usuário");
    }
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-4 border-y border-linha py-6">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <label className="flex flex-col gap-1">
          <span className="text-sm text-texto-secundario">Nome</span>
          <input
            type="text"
            value={nome}
            onChange={(e) => setNome(e.target.value)}
            autoFocus
            className="border-b border-linha bg-transparent py-2 text-sm text-tinta outline-none focus:border-ambar"
          />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-sm text-texto-secundario">Login</span>
          <input
            type="text"
            value={login}
            onChange={(e) => setLogin(e.target.value)}
            autoComplete="off"
            className="border-b border-linha bg-transparent py-2 font-mono text-sm text-tinta outline-none focus:border-ambar"
          />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-sm text-texto-secundario">Senha</span>
          <input
            type="password"
            value={senha}
            onChange={(e) => setSenha(e.target.value)}
            autoComplete="new-password"
            className="border-b border-linha bg-transparent py-2 text-sm text-tinta outline-none focus:border-ambar"
          />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-sm text-texto-secundario">Perfil</span>
          <select
            value={roleId}
            onChange={(e) => setRoleId(e.target.value)}
            className="border-b border-linha bg-transparent py-2 text-sm text-tinta outline-none focus:border-ambar"
          >
            {perfis.length === 0 && <option value="">Nenhum perfil cadastrado</option>}
            {perfis.map((p) => (
              <option key={p.ID} value={p.ID}>
                {p.Nome}
              </option>
            ))}
          </select>
        </label>
      </div>

      <button
        type="submit"
        disabled={criando}
        className="self-start bg-tinta px-6 py-2 text-sm font-medium text-papel transition-opacity disabled:opacity-40"
      >
        {criando ? "Criando…" : "Criar usuário"}
      </button>

      {erro && <p className="text-sm text-ambar">{erro}</p>}
    </form>
  );
}
