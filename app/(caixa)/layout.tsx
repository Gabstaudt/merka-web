// Caixa é destino único do perfil, mesmo padrão de Porteiro/Balança/Garçom
// (ver CLAUDE.md) — sem breadcrumb "← Início". O próprio page.tsx monta
// seu cabeçalho mínimo.
export default function CaixaLayout({ children }: { children: React.ReactNode }) {
  return <div className="min-h-dvh bg-papel">{children}</div>;
}
