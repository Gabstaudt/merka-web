import { PlaceholderCard } from "@/components/PlaceholderCard";

// US-03. O backend já grava tudo em audit_log automaticamente (ver
// merka-api/internal/audit/) — falta o endpoint GET de consulta
// (filtros por usuário, perfil, ação, comanda, período).
export default function AuditoriaPage() {
  return (
    <PlaceholderCard
      titulo="Auditoria"
      descricao="Ver todas as ações realizadas por todos os usuários."
      itens={["Filtrar por usuário/perfil", "Filtrar por tipo de ação", "Filtrar por comanda ou período"]}
    />
  );
}
