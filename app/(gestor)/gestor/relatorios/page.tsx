import { PlaceholderCard } from "@/components/PlaceholderCard";

// US-04/US-05. O backend ainda não tem nenhum endpoint de relatório
// gerencial (ver CLAUDE.md do backend — próximos passos).
export default function RelatoriosPage() {
  return (
    <PlaceholderCard
      titulo="Relatórios"
      descricao="Itens vendidos por forma de pagamento e período, notas fiscais emitidas/não emitidas."
      itens={["Relatório por período (dia/semana/mês/ano)", "Notas fiscais emitidas x não emitidas"]}
    />
  );
}
