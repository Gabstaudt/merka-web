// Lockup principal da marca (ícone + nome "Merka") — usar SEMPRE em fundo
// claro (Papel/Branco da marca); troca pra merka-logo-inverse.svg
// automaticamente quando o SO está em modo escuro, via <picture> (o
// navegador baixa só o arquivo que vai usar, não os dois). Ver regras de
// uso completas em CLAUDE.md, seção "Uso da marca/logos" — nunca
// substituir por merka-symbol/merka-icon fora dos contextos descritos
// lá, nunca editar os SVGs.
export function MerkaLogo({ className = "h-6 w-auto" }: { className?: string }) {
  return (
    <picture>
      <source srcSet="/logos/merka-logo-inverse.svg" media="(prefers-color-scheme: dark)" />
      <img src="/logos/merka-logo.svg" alt="Merka" className={className} />
    </picture>
  );
}
