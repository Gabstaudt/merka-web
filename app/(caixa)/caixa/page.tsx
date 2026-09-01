import { PlaceholderCard } from "@/components/PlaceholderCard";

// US-13 (somar N comandas) + US-14 (pagamento misto, emissão condicional
// de nota) — backend já tem POST /pagamentos; falta o endpoint de listar
// comandas em aberto por mesa pro front montar a tela de fechamento.
export default function CaixaPage() {
  return (
    <PlaceholderCard
      titulo="Fechamento de caixa"
      descricao="Somar comandas de uma mesa e processar o pagamento (único ou misto)."
      itens={["Somar comandas (US-13)", "Fechar pagamento (US-14)", "Emitir nota fiscal (US-14/US-19)"]}
    />
  );
}
