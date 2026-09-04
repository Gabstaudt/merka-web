// Balança é destino único do perfil, assim como Porteiro (ver CLAUDE.md) —
// tablet fixo na estação de pesagem, sem breadcrumb "← Início". O próprio
// page.tsx monta seu cabeçalho mínimo (logo + nome do perfil + sair).
export default function BalancaLayout({ children }: { children: React.ReactNode }) {
  return <div className="min-h-dvh bg-papel">{children}</div>;
}
