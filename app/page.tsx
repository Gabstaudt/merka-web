import Link from "next/link";

import { LogoutButton } from "@/components/LogoutButton";

const AREAS = [
  { href: "/porteiro", label: "Porteiro", descricao: "Entregar / receber comanda" },
  { href: "/balanca", label: "Balança", descricao: "Registrar peso" },
  { href: "/garcom", label: "Garçom", descricao: "Lançar itens, transferir mesa" },
  { href: "/caixa", label: "Caixa", descricao: "Fechar pagamento" },
  { href: "/gestor", label: "Gestor", descricao: "Auditoria, relatórios" },
];

// Hub pós-login: como ainda não checamos permissão granular por perfil
// (só se existe token — ver middleware.ts), toda área fica navegável
// daqui. Quando o backend expuser o role do usuário, isto vira uma lista
// filtrada pelas permissões dele.
export default function HomePage() {
  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col items-center justify-center gap-8 p-6">
      <div className="text-center">
        <h1 className="text-2xl font-semibold">Merka</h1>
        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">Escolha a área de trabalho</p>
      </div>

      <nav className="grid w-full grid-cols-1 gap-3 sm:grid-cols-2">
        {AREAS.map((area) => (
          <Link
            key={area.href}
            href={area.href}
            className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm transition hover:border-slate-300 hover:shadow dark:border-slate-800 dark:bg-slate-900 dark:hover:border-slate-700"
          >
            <span className="block font-medium text-slate-900 dark:text-slate-50">{area.label}</span>
            <span className="mt-1 block text-xs text-slate-500 dark:text-slate-400">{area.descricao}</span>
          </Link>
        ))}
      </nav>

      <LogoutButton />
    </main>
  );
}
