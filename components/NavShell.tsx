import Link from "next/link";

import { LogoutButton } from "./LogoutButton";

/**
 * Cabeçalho compartilhado pelas telas por perfil — mostra qual área está
 * ativa, um link de volta pro hub e o botão de logout. Cada route group
 * ((porteiro)/, (balanca)/, ...) usa isto no seu layout.tsx.
 */
export function NavShell({
  perfil,
  children,
}: {
  perfil: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-dvh flex-col">
      <header className="flex items-center justify-between border-b border-slate-200 bg-white px-4 py-3 dark:border-slate-800 dark:bg-slate-950">
        <div className="flex items-center gap-3">
          <Link href="/" className="text-sm font-medium text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-100">
            ← Início
          </Link>
          <span className="text-slate-300 dark:text-slate-700">/</span>
          <h1 className="text-sm font-semibold text-slate-900 dark:text-slate-50">{perfil}</h1>
        </div>
        <LogoutButton />
      </header>
      <main className="flex flex-1 flex-col p-4">{children}</main>
    </div>
  );
}
