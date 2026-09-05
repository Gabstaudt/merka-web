// ETAPA 3 (configurações estruturais do tenant) — verificado antes de
// construir: existe a tabela `pricing_rules` (migrations/0003_pricing_rules.sql
// — chave, configuracao jsonb, ativo), mas NENHUM domain struct,
// repository, usecase, handler ou rota foi implementado sobre ela desde
// que o projeto começou. Não existe GET/PUT/POST algum pra taxa de
// serviço, rodízio por pessoa ou qualquer outra regra de precificação.
//
// Por instrução explícita do usuário: não inventar um endpoint aqui.
// Esta tela fica funcional (navegável, dentro do sistema de design) mas
// deixa isso visível em vez de simular dados — quando o endpoint
// existir, o formulário real substitui este aviso.
export default function ConfiguracoesPage() {
  return (
    <div className="flex flex-col gap-8">
      <div>
        <h1 className="font-display text-2xl text-tinta">Configurações</h1>
        <p className="mt-1 text-sm text-texto-secundario">
          Regras gerais do tenant — taxa de serviço, rodízio por pessoa e outras regras de precificação.
        </p>
      </div>

      <div className="border-l-2 border-ambar pl-6">
        <p className="text-sm font-medium text-ambar">Aguardando endpoint no backend</p>
        <p className="mt-2 max-w-xl text-base leading-snug text-tinta">
          A tabela <code className="font-mono text-sm">pricing_rules</code> existe no banco desde o início do
          projeto (migration <code className="font-mono text-sm">0003</code>), mas nenhum endpoint foi
          implementado sobre ela — não há como ler nem gravar taxa de serviço, rodízio por pessoa ou qualquer
          outra regra de precificação ainda. Esta tela ficará pronta assim que o backend expuser
          <code className="font-mono text-sm"> GET/PUT /configuracoes</code> (ou rota equivalente) — é uma tarefa
          de backend separada, fora do escopo desta etapa.
        </p>
      </div>
    </div>
  );
}
