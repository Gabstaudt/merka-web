"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";

import { LogoutButton } from "@/components/LogoutButton";
import { MerkaLogo } from "@/components/MerkaLogo";

// Painel administrativo — usa --branco-marca (não --papel) — é a
// distinção deliberada do sistema de design entre "operação" (Porteiro/
// Balança/Garçom/Caixa, telas de fluxo único) e "administração" (aqui,
// estrutura em abas). Acessado de computador/tablet maior, por isso mais
// denso em informação do que as telas operacionais.
//
// Cada aba declara a PERMISSÃO que a libera, nunca o nome de um perfil —
// perfis são customizáveis (seção 16 do planejamento: Admin Super pode
// criar perfis novos com qualquer combinação de permissões), então
// checar "role === Gestor" travaria a navegação assim que alguém criasse
// um perfil customizado com as mesmas permissões. Gestor e Admin Super
// veem as mesmas abas operacionais porque têm as mesmas permissões —
// "Perfis e Permissões" e "Configurações" só aparecem pra quem tem
// "criar_perfil", hoje exclusiva do Admin Super (ver
// merka-api/CLAUDE.md).
const ABAS = [
  { href: "/gestor", label: "Dashboard", permissao: "ver_relatorios" },
  { href: "/gestor/relatorios", label: "Relatórios", permissao: "ver_relatorios" },
  { href: "/gestor/notas-fiscais", label: "Notas Fiscais", permissao: "ver_relatorios" },
  { href: "/gestor/auditoria", label: "Auditoria", permissao: "ver_auditoria" },
  { href: "/gestor/usuarios", label: "Usuários", permissao: "criar_usuario" },
  { href: "/gestor/comandas", label: "Comandas", permissao: "cancelar_comanda" },
  { href: "/gestor/perfis", label: "Perfis e Permissões", permissao: "criar_perfil" },
  { href: "/gestor/configuracoes", label: "Configurações", permissao: "criar_perfil" },
];

export default function GestorLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [permissoes, setPermissoes] = useState<string[] | null>(null);

  useEffect(() => {
    fetch("/api/me")
      .then((res) => res.json())
      .then((data) => setPermissoes(Array.isArray(data.permissoes) ? data.permissoes : []))
      .catch(() => setPermissoes([]));
  }, []);

  const abasVisiveis = permissoes === null ? [] : ABAS.filter((aba) => permissoes.includes(aba.permissao));

  return (
    <div className="min-h-dvh bg-branco-marca">
      <header className="border-b border-linha">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-6 py-4">
          <div className="flex items-center gap-3">
            <MerkaLogo className="h-6 w-auto" />
            <span className="text-linha">/</span>
            <span className="text-sm text-texto-secundario">Gestor</span>
          </div>
          <LogoutButton />
        </div>
        <nav className="mx-auto flex max-w-5xl gap-8 px-6">
          {abasVisiveis.map((aba) => {
            const ativo = pathname === aba.href;
            return (
              <Link
                key={aba.href}
                href={aba.href}
                className={`border-b-2 py-3 text-sm transition-colors ${
                  ativo ? "border-tinta text-tinta" : "border-transparent text-texto-secundario hover:text-tinta"
                }`}
              >
                {aba.label}
              </Link>
            );
          })}
        </nav>
      </header>

      <main className="mx-auto max-w-5xl px-6 py-10">{children}</main>
    </div>
  );
}
