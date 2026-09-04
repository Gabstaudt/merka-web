// Garçom é destino único do perfil, mesmo padrão de Porteiro e Balança
// (ver CLAUDE.md) — celular/tablet andando pelo salão, sem breadcrumb
// "← Início". O próprio page.tsx monta seu cabeçalho mínimo.
export default function GarcomLayout({ children }: { children: React.ReactNode }) {
  return <div className="min-h-dvh bg-papel">{children}</div>;
}
