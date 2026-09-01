import Link from "next/link";

const SECOES = [
  { href: "/gestor/auditoria", label: "Auditoria", descricao: "Trilha de ações por usuário e comanda" },
  { href: "/gestor/relatorios", label: "Relatórios", descricao: "Itens vendidos por forma de pagamento e período" },
];

// Visão geral do Gestor: acesso a tudo que os outros perfis fazem, mais
// auditoria e relatórios (US-03/US-04 do planejamento). O backend já
// audita tudo automaticamente (internal/audit/), mas ainda não expõe
// endpoint de consulta — por isso as subtelas abaixo são placeholder.
export default function GestorPage() {
  return (
    <div className="mx-auto flex w-full max-w-sm flex-col gap-6">
      <div>
        <h2 className="text-lg font-semibold">Visão geral</h2>
        <p className="text-sm text-slate-500 dark:text-slate-400">
          Acesso a toda a operação, auditoria e relatórios gerenciais.
        </p>
      </div>

      <nav className="flex flex-col gap-3">
        {SECOES.map((secao) => (
          <Link
            key={secao.href}
            href={secao.href}
            className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm transition hover:border-slate-300 hover:shadow dark:border-slate-800 dark:bg-slate-900 dark:hover:border-slate-700"
          >
            <span className="block font-medium text-slate-900 dark:text-slate-50">{secao.label}</span>
            <span className="mt-1 block text-xs text-slate-500 dark:text-slate-400">{secao.descricao}</span>
          </Link>
        ))}
      </nav>
    </div>
  );
}
