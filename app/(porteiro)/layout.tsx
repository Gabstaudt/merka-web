// Porteiro é destino único do perfil (ver CLAUDE.md e a tela em
// porteiro/page.tsx) — sem NavShell (breadcrumb "← Início" não faz
// sentido pra um perfil de tela única). O próprio page.tsx monta seu
// cabeçalho mínimo (nome + sair).
export default function PorteiroLayout({ children }: { children: React.ReactNode }) {
  return <div className="min-h-dvh bg-papel">{children}</div>;
}
