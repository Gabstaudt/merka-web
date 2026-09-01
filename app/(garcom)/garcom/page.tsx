import { PlaceholderCard } from "@/components/PlaceholderCard";

// US-11 (lançar item), US-12 (remover item), US-16 (transferir mesa) —
// backend já tem POST /comandas/:id/itens; falta o endpoint de listar
// comandas/cardápio pro front escolher o que lançar.
export default function GarcomPage() {
  return (
    <PlaceholderCard
      titulo="Comanda da mesa"
      descricao="Lançar bebidas e sobremesas, remover item lançado por engano, transferir mesa."
      itens={["Lançar item (US-11)", "Remover item (US-12)", "Transferir mesa (US-16)"]}
    />
  );
}
