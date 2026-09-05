"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { LogoutButton } from "@/components/LogoutButton";
import { MerkaLogo } from "@/components/MerkaLogo";

// Painel do Gestor usa --branco-marca (não --papel) — é a distinção
// deliberada do sistema de design entre "operação" (Porteiro/Balança/
// Garçom/Caixa, telas de fluxo único) e "administração" (aqui, estrutura
// em abas). Acessado de computador/tablet maior, por isso mais denso em
// informação do que as telas operacionais.
const ABAS = [
  { href: "/gestor", label: "Dashboard" },
  { href: "/gestor/relatorios", label: "Relatórios" },
  { href: "/gestor/notas-fiscais", label: "Notas Fiscais" },
  { href: "/gestor/auditoria", label: "Auditoria" },
];

export default function GestorLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

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
          {ABAS.map((aba) => {
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
