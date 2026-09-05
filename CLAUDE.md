@AGENTS.md

# Merka Web — Contexto do Projeto (para Claude Code)

> Frontend do sistema Merka. Leia isto antes de qualquer alteração — é a
> fonte de verdade rápida do que já foi decidido e por quê. Mantenha
> atualizado conforme o projeto evolui. Para o contexto completo de
> negócio (histórias de usuário, schema, regras não-negociáveis), ver
> `../merka-api/CLAUDE.md` — este arquivo só repete o essencial pro
> frontend, não duplica tudo.

## Antes de qualquer UI nova: reler a skill frontend-design

**Isto vale pra toda sessão futura, não só a que criou esta seção.**
Antes de escrever ou alterar qualquer componente visual — mesmo que a
skill já tenha sido lida nesta mesma sessão — invoque de novo a skill
`frontend-design` (`example-skills:frontend-design` ou
`frontend-design:frontend-design`, conforme o que estiver disponível) e
siga as diretrizes dela à risca. Ela existe pra evitar exatamente os
defaults genéricos de UI gerada por IA (cards com sombra, gradiente,
eyebrow label em caixa alta, "→" decorativo em botão, tom cream+terracota)
— o sistema de design da Merka (abaixo) é a aplicação concreta dessas
diretrizes pro domínio de churrascaria/comandas, não um substituto pra
reler a skill.

## Toda UI deve rodar perfeitamente em celular, tablet e computador

**Isto vale pra toda sessão futura e toda tela, sem exceção.** O sistema é
operado ao vivo em dispositivos diferentes por perfil — Porteiro/Garçom
tipicamente em celular ou tablet na mão, Balança em tablet fixo perto da
balança, Caixa em computador ou tablet, Gestor majoritariamente em
computador — então nenhuma tela pode ser projetada pensando só em desktop
e "depois adaptar". Ao criar ou alterar qualquer componente visual:

- Layout fluido com unidades relativas e `flex`/`grid` (nunca largura fixa
  em px que quebre abaixo de um certo viewport); testar mentalmente (ou de
  fato, via devtools/responsive mode) pelo menos três larguras: celular
  (~375px), tablet (~768px) e desktop (~1280px+).
- Alvos de toque grandes o bastante pro dedo (não só pro cursor do mouse)
  em qualquer tela usada em celular/tablet — Porteiro, Balança, Garçom,
  Caixa. Gestor/Admin, mais tipicamente em computador, ainda assim não pode
  quebrar em tablet.
- Tipografia e espaçamento com `clamp()`/breakpoints do Tailwind quando o
  tamanho fixo (ex: números grandes em `font-display`) não se sustenta em
  tela pequena — nunca assumir que sobra largura.
- PWA instalável (ver seção Stack) reforça isso: a tela precisa parecer
  nativa tanto instalada num celular quanto aberta num monitor de caixa.
- Nenhuma tela nova é considerada pronta sem verificar visualmente como
  fica em pelo menos um tamanho móvel e um tamanho desktop antes de pedir
  validação do usuário.

## O que é o Merka (resumo — ver merka-api/CLAUDE.md para o completo)

Sistema de comandas para uma churrascaria (buffet self-service por peso +
mesa com garçom), multi-tenant. Perfis: Porteiro, Balança, Garçom, Caixa
(telas operacionais) e Gestor/Admin Super (painéis administrativos).

## Stack

- **Next.js 16** (App Router, convenção `proxy.ts` — não
  `middleware.ts`, renomeada nesta versão) + **React 19** + **Tailwind
  v4** (config só em CSS via `@theme` em `app/globals.css`, sem
  `tailwind.config.js`)
- Rotas por perfil como route groups: `app/(porteiro)/`, `app/(balanca)/`,
  `app/(garcom)/`, `app/(caixa)/`, `app/(gestor)/`, `app/(auth)/`
- **Autenticação**: login grava o JWT do backend num cookie **httpOnly**
  (`lib/constants.ts` → `TOKEN_COOKIE`) — o cliente nunca vê o token.
  Toda chamada ao backend passa por um Route Handler em `app/api/**` que
  lê o cookie no servidor (`lib/session.ts`) e repassa como
  `Authorization: Bearer` via `lib/api.ts` (`apiFetch`). Nunca chame o
  backend Go direto do client component — sempre via esse proxy.
- `proxy.ts` protege toda rota de página (redireciona pra `/login` sem
  cookie) exceto `/login` e tudo em `/api/**` (cada Route Handler faz sua
  própria checagem, repassando o 401 do backend).
- PWA: `manifest.json` + `ServiceWorkerRegister` — instalável no celular
  do garçom/balança/tablet do porteiro (ver merka-api/CLAUDE.md, decisão
  de stack).

## Sistema de design Merka

Conceito central: **cada tela operacional é um objeto de papel —
uma ficha, um cupom — não um dashboard de cards com sombra.** Estrutura
por linha fina, não por card flutuante. Um único acento de cor, usado com
escassez. Isso é uma decisão de marca, não um detalhe estético — não
"volte ao genérico" se a tela ficar difícil; resolva dentro do sistema.

### Cores (tokens CSS em `app/globals.css`, expostos como utilities Tailwind: `bg-papel`, `text-tinta`, `border-linha`, etc.)

| Token | Hex | Uso |
|---|---|---|
| `--color-tinta` | `#2A2F3A` | Texto principal, estrutura, botões primários |
| `--color-ambar` | `#D69B3F` | **Único** acento — valor total, confirmação de ação concluída, estado que precisa atenção. Nunca decorativo, nunca em mais de um elemento por tela |
| `--color-papel` | `#FAF9F7` | Fundo das telas operacionais (Porteiro, Balança, Garçom, Caixa) |
| `--color-branco-marca` | `#FAFAFA` | Fundo de painéis administrativos (Gestor, Admin) — sutilmente distinto do papel |
| `--color-linha` | `#EAE8E5` | Bordas e divisórias — regra fina, nunca sombra nem card com border-radius genérico |
| `--color-texto-secundario` | `#8A8783` | Metadados: horário, código, labels auxiliares |

### Tipografia (`next/font/google` em `app/layout.tsx`, expostas como `font-display`/`font-sans`/`font-mono`)

- **Fraunces** (`font-display`) — valores monetários e números grandes (ex: código da comanda em destaque numa tela de confirmação). Carrega personalidade de impresso.
- **IBM Plex Sans** (`font-sans`) — labels, ações, texto de interface.
- **IBM Plex Mono** (`font-mono`) — códigos de comanda, timestamps, protocolos. Não é decoração: cupons/recibos reais são compostos assim, é autenticidade com o objeto físico.

### Uso da marca/logos

Arquivos em `public/logos/` — **nunca editar/recriar os SVGs, nunca usar
um arquivo fora do contexto abaixo** (ex: nunca `merka-symbol.svg` como
logo de header, nunca PNG em tela onde um SVG serviria). Sempre SVG em
tela; PNG só nos contextos que exigem raster (PDF, e-mail, manifest).

| Arquivo | Contexto de uso |
|---|---|
| `merka-logo.svg` | Lockup principal (ícone + nome), fundo **claro** (Papel/Branco da marca) — header de toda área logada (`components/NavShell.tsx`) e tela de login. Componente `components/MerkaLogo.tsx` já encapsula a troca automática pra `merka-logo-inverse.svg` em modo escuro via `<picture>`/`prefers-color-scheme` — usar esse componente em qualquer lugar com fundo claro que possa alternar pra escuro (a maioria das telas com `dark:` no Tailwind). Em telas de tema único e sempre-claro (ex: Porteiro, que não define nenhuma classe `dark:`), usar `<img>` direto com `merka-logo.svg` — não precisa do componente. |
| `merka-logo-inverse.svg` | Mesmo lockup, fundo **escuro** (Tinta ou similar) — usado automaticamente por `MerkaLogo`; só referenciar direto se alguma tela nova tiver fundo escuro fixo (não condicional a dark mode). |
| `merka-symbol.svg` / `.png` | Só o M com a barra âmbar, sem quadrado — marca d'água discreta (loading, watermark de relatório exportado). **Nunca como logo principal de header.** |
| `merka-icon.svg` | Ícone quadrado (M no tile) — favicon SVG fallback, ícone do manifest PWA, avatar sem foto. |
| `merka-icon-inverse.svg` | Mesmo ícone, fundo escuro (ex: barra de navegação escura, se algum dia existir). |
| `merka-icon-mono.svg` | Uma cor só, sem âmbar — **exclusivamente impressão térmica P&B** (cabeçalho do cupom NFC-e). Ainda não aplicado em código (a geração do cupom térmico, US-14, é tarefa separada) — quando for implementada, é este o arquivo correto, não `merka-icon.svg`. |
| `merka-icon-simple.svg` | Traço mais grosso, sem barra — contextos ≤32px onde `merka-icon.svg` perde detalhe. Usado como favicon primário (`app/layout.tsx`, `metadata.icons`). |
| `merka-logo.png` / `merka-logo-inverse.png` (1404px) | Raster do lockup — **PDF gerado pelo sistema** (NF-e completa/DANFE A4, US-19) e **e-mail transacional** (cupom/nota por e-mail). Ainda não aplicado (tarefas de impressão/PDF são separadas) — este é o arquivo correto quando forem implementadas. |
| `merka-icon.png` / `merka-icon-inverse.png` (512×512) | Ícones do manifest PWA (`public/manifest.json`, 192×192 e 512×512 — mesmo arquivo, o navegador reamostra). |
| `merka-symbol.png` (512px) | Watermark em relatório PDF exportado pelo Gestor (equivalente raster do SVG). |
| `favicon-32.png` | Fallback do favicon pra navegador sem suporte a favicon SVG (`metadata.icons` em `app/layout.tsx`). |

**Favicon configurado**: `merka-icon-simple.svg` primário +
`favicon-32.png` fallback, via `metadata.icons` em `app/layout.tsx` —
substituiu o `app/favicon.ico` padrão do create-next-app (removido).

**Pendente, de propósito, fora desta tarefa**: nenhum logo foi aplicado
na geração do cupom térmico nem no PDF de nota fiscal — isso pertence às
tarefas de impressão (US-14/US-19), ainda não implementadas. Quando
forem: cupom térmico usa `merka-icon-mono.svg`, PDF A4 usa
`merka-logo.png`/`merka-logo-inverse.png` (ver tabela acima).

### Layout

- Alinhamento à esquerda, estrutura por **linhas com regra fina**
  (`border-linha`), nunca cards flutuantes com sombra.
- Sem `border-radius` grande generalizado.
- Sem eyebrow label em caixa alta acima de título.
- Sem "→" decorativo em botão.
- Sem gradiente.
- Sem o padrão "PALAVRA — fragmento" com travessão espaçado (é uma das
  marcas mais óbvias de chrome genérico gerado por IA — ver skill
  `frontend-design`).
- Movimento: no máximo um momento orquestrado por tela (ex: o painel de
  resultado entrando depois de uma ação) — nunca fade-in espalhado em
  cada seção/hover.

### Voz de interface

Erros/bloqueios explicam o que houve e o que fazer, no tom da interface —
nunca "Ops" nem pedido de desculpa. Exemplo real (`app/(porteiro)/porteiro/page.tsx`,
função `mensagemDeErro`): *"Comanda 0231 ainda não foi paga. Direcione o
cliente ao caixa."* Sempre que possível, inclua o código/identificador
relevante na própria frase — quem opera o caixa/porteiro/balança
raramente olha só uma tela por vez.

## Estado atual das telas

- **Porteiro** (`app/(porteiro)/porteiro/page.tsx`) — **implementada de
  verdade**, primeira aplicação do sistema de design (prova de conceito).
  Um único campo + um único botão ("Passar comanda") — o porteiro só
  escaneia, **não escolhe** entre entregar/receber. O fluxo consulta
  `GET /comandas/:codigo` (via proxy `app/api/comandas/[codigo]/route.ts`)
  pra saber o status atual e decide sozinho a próxima chamada:
  `disponivel` → `POST .../abrir` (US-07, entrega ao cliente);
  `paga` → `POST .../liberar` (US-08, recebe na saída); `em_uso` →
  bloqueado, mensagem clara (cliente ainda não fechou a conta). Rotas
  proxy em `app/api/comandas/[codigo]/{,abrir,liberar}/route.ts`. Tela de
  destino único do perfil — sem navegação além de um botão discreto de
  logout (por isso não usa `components/NavShell.tsx`, que tem breadcrumb
  "← Início"; ver `app/(porteiro)/layout.tsx`).
- **Balança** (`app/(balanca)/balanca/page.tsx`) — **implementada de
  verdade**, segunda aplicação do sistema de design. Tela de estação fixa
  (tablet), duas colunas em telas largas: lançamento de peso (US-09) à
  esquerda, histórico da estação + estorno (US-10) à direita. Fluxo:
  código da comanda → resolve via `GET /api/comandas/:codigo` (mesmo
  endpoint do Porteiro) → escolhe item por peso do catálogo (`GET
  /api/produtos`) → lê peso via Web Serial (`lib/serial-balanca.ts`) ou
  digitação manual (fallback automático, sem travar o fluxo, ver decisão
  abaixo) → mostra o cálculo completo (bruto/tara/líquido/preço/valor)
  antes de confirmar → `POST /api/comandas/:id/pesos`. Conflito de
  sincronização (comanda já finalizada) usa a mensagem específica que já
  vem do backend, distinta de erro genérico. Estorno é inline por linha do
  histórico (sem modal), pede motivo, chama `PATCH
  /api/order-items/:id/estornar`. Ajuste de preço/tara (US-20) é uma seção
  recolhida por padrão, aberta por um link discreto — deixa explícito que
  não cadastra produto novo (`PATCH /api/produtos/:id/preco-peso`). Tela
  de destino único do perfil, mesmo padrão de header do Porteiro (sem
  `NavShell`).

  **Fallback de Web Serial**: `navigator.serial` só existe em
  Chrome/Edge com HTTPS ou localhost, e mesmo lá depende do usuário
  conceder permissão de porta serial interativamente — não dá pra
  detectar de antemão se a permissão será negada, só tentar. A tela nunca
  bloqueia à espera disso: o campo de peso bruto é sempre editável por
  digitação (some o campo, não o fluxo), e o botão "Conectar balança" só
  aparece quando `"serial" in navigator` é verdadeiro (checado via
  `useSyncExternalStore`, pra não quebrar hidratação SSR); num navegador
  sem suporte, ou se a conexão falhar, aparece direto a instrução pra
  digitar manualmente, sem erro alarmante.

- **Garçom** (`app/(garcom)/garcom/page.tsx`) — **implementada de
  verdade**, terceira aplicação do sistema de design. Mobile-first (celular
  andando pelo salão), três telas dentro do mesmo componente:

  1. **Grid de mesas em atendimento** — quadrados (`aspect-square`), não
     lista, mostrando identificador + contagem de comandas. Uma mesa pode
     ter mais de uma comanda em_uso ao mesmo tempo (dois grupos na mesma
     mesa); clicar numa mesa com 1 comanda abre ela direto, com 2+ leva a
     uma tela própria (`SelecionarComandaView`, não um dropdown/expansão
     inline no grid) pra escolher qual comanda atender antes de ir pro
     lançamento. Busca direta por código (mesmo padrão dos outros perfis)
     continua disponível no topo.
  2. **Associação obrigatória de mesa** — a mesa de uma comanda só é
     definida no primeiro lançamento do Garçom, não antes (o Porteiro não
     associa mesa nenhuma ao entregar a comanda). Por isso, se
     `comanda.TableID` vier nulo (comanda aberta por busca direta, ainda
     sem mesa), a tela bloqueia com um grid de todas as mesas — inclusive
     ocupadas, já que mais de uma comanda pode dividir a mesma mesa — antes
     de liberar qualquer lançamento. Reaproveita a mesma rota `PATCH
     .../mesa` que a transferência usa (funciona igual pra atribuição
     inicial).
  3. **Comanda aberta** — itens lançados aparecem **resumidos**: só os
     ativos ficam sempre visíveis; itens removidos/estornados somem atrás
     de um "Ver mais (N)" (a lista real de teste tinha uma dúzia de itens
     removidos de sessões anteriores — sem esse corte a tela vira ruído).
     Peso e unitário aparecem juntos na mesma lista, distinguidos por um
     rótulo `· peso` / `· unidade` em `font-mono` ao lado do nome do
     produto. Remoção (US-12) só aparece em itens unitários ativos (peso
     só se estorna pela Balança, rota/permissão diferente). "Adicionar
     item" abre um cardápio pesquisável (campo de busca por nome, filtra a
     lista ao digitar) em vez de um `<select>` longo — mais rápido de usar
     andando pelo salão. Total parcial usa `text-ambar` + `font-display`.
     Conflito de sincronização usa a mesma mensagem específica da Balança.

  **Tempo real** (`lib/useMerkaSocket.ts`): hook que abre WebSocket com o
  backend e re-busca os itens da comanda aberta quando chega um evento
  `comanda_atualizada` — por isso a tela reflete sozinha um peso que a
  Balança acabou de lançar na mesma comanda, sem refresh manual. Único
  ponto do frontend que expõe o JWT ao JS do cliente: o WebSocket nativo
  do navegador não aceita headers customizados no handshake (mesma razão
  que já levou o próprio backend a autenticar o `/ws` via querystring —
  ver `merka-api/internal/handler/ws_handler.go`), então
  `app/api/ws-token/route.ts` lê o cookie httpOnly no servidor e entrega
  um token efêmero só pra abrir a conexão. Documentado aqui pra próxima
  sessão não reintroduzir isso por engano em outro lugar.

  **Endpoints novos no backend, adicionados durante esta tela** (não
  existiam antes — a tela precisava deles pra "conectar de verdade", sem
  dado mockado): `GET /mesas` (lista mesas + TODAS as comandas em_uso
  associadas a cada uma — não é 1:1, `internal/handler/table_handler.go`)
  e `GET /comandas/:id/itens` (lista todos os order_items de uma comanda,
  `ComandaHandler.ListarItens` em `comanda_handler.go`) — ambos sem
  `RequerPermissao` (leitura, qualquer perfil autenticado). Duas mesas
  extras de teste (`Mesa 2`, `Mesa 3`) em
  `migrations/0021_seed_mesas_extra.sql`.

- **Caixa** (`app/(caixa)/caixa/page.tsx`) — **as 3 etapas planejadas
  estão prontas e testadas de verdade**, mais uma rodada de ajustes de UX
  pedidos depois de revisar a ETAPA 2 (ver lista no fim desta seção).

  **ETAPA 1** (US-13/US-14): campo de código adiciona comandas ao
  fechamento (resolve por `GET /api/comandas/:codigo`, busca os itens
  ativos de cada uma via `GET /api/comandas/:id/itens`, mesmo endpoint da
  tela do Garçom); pagamento misto (N métodos, cada um com seu valor,
  mostra "falta cobrir" até bater); toggle "Imprimir cupom?" (local,
  `TODO(config-tenant)`: valor padrão deveria vir de config por tenant,
  campo não existe no backend ainda); checkboxes de e-mail/WhatsApp com
  campo de destino (**local apenas — não existe endpoint de envio de
  cupom por canal ainda**, documentado como TODO visível na própria
  tela). Confirmar chama `POST /api/pagamentos` de verdade; se "Imprimir
  cupom" estiver ligado, tenta imprimir via QZ Tray (`lib/qz.ts`,
  integração pré-existente, real).

  Emissão de NFC-e para métodos de cartão/voucher é automática no backend
  e roda em background (`FecharPagamento.Executar`,
  `EmitirNotaFiscal.ExecutarEmBackground`) — a resposta de `POST
  /pagamentos` não espera a SEFAZ, então a tela não afirma "nota emitida",
  só avisa que a emissão está a caminho quando aplicável.

  **ETAPA 2** (US-17 desconto; nota fiscal completa parcial — ver gap
  abaixo). Uma ação "Aplicar desconto" (valor fixo ou percentual, motivo
  obrigatório, prévia do valor abatido antes de confirmar) chama `POST
  /api/comandas/:id/desconto` de verdade. **Importante: desconto incide
  sobre a soma total do fechamento, não sobre uma comanda isolada** (uma
  correção pedida depois da primeira versão, que aplicava por comanda) —
  como o endpoint só sabe aplicar a uma comanda específica, o valor em
  reais é sempre calculado no front sobre o total consolidado e enviado
  como `valor_fixo` (nunca deixa o backend recalcular um percentual em
  cima de só uma comanda, o que daria errado com 2+ comandas somadas).
  CPF/CNPJ do cliente é um campo sempre visível e sempre opcional (não é
  exclusivo de "nota fiscal completa" — outra correção pedida: o cupom
  simples também pode ter CPF/CNPJ) — vai em `documento` no `POST
  /pagamentos`, chega até a emissão fiscal quando o método é
  cartão/débito/voucher. "Solicitar nota fiscal completa" continua um
  checkbox à parte, só com "Imprimir nota em A4" dentro — a distinção
  NFC-e vs nota fiscal completa e a impressão A4/e-mail/WhatsApp da nota
  **não existem no backend** — só NFC-e modelo 65 está implementado (ver
  CLAUDE.md do merka-api) — documentado como TODO visível na própria
  tela.

  **Dois bugs de correção monetária real, achados e corrigidos durante
  esta etapa** (não eram só gap de escopo — o dinheiro cobrado do cliente
  estaria errado sem isso):
  1. `discounts.valor` nunca tinha um valor em reais persistido (só o
     input bruto do operador, ex: "10" — sem saber se era R$10 ou 10%) e
     `FecharPagamento` nunca lia a tabela `discounts` — aplicar um
     desconto não mudava em nada quanto o Caixa cobrava. Corrigido:
     `discounts.valor_aplicado` (migration `0022`) guarda o valor já
     calculado em reais; `FecharPagamento.Executar` agora abate a soma
     disso do total antes de conferir os pagamentos parciais (teste:
     `TestFecharPagamento_AbateDescontoAplicado`).
  2. Corrigido durante o teste ao vivo desta etapa: como a comanda física
     é reutilizada indefinidamente (`disponivel → em_uso → paga →
     disponivel`) e desconto nunca é apagado, sem escopo por ciclo o
     desconto do cliente de ontem ficaria abatendo o total do cliente de
     hoje só por calhar de pegar a mesma comanda física. Corrigido
     filtrando `discounts.aplicado_em >= comandas.aberta_em` — só conta
     desconto do ciclo de uso atual (`internal/repository/postgres/discount_repo.go`).

  **Gap relacionado, encontrado E CORRIGIDO logo em seguida** (mesma
  categoria de bug do desconto, escopo maior — tocava Balança/Garçom/
  Caixa já aprovados, corrigido a pedido explícito do usuário):
  `order_items` tinha o mesmo problema de reuso que `discounts` tinha —
  nenhuma query de soma de total (`SomarTotalAtivo`,
  `ListarAtivosPorComandas`, `ListarPorComanda`) filtrava por
  `comandas.aberta_em`. Um item lançado num ciclo anterior da mesma
  comanda física continuava contando no total de um cliente
  completamente diferente depois que a comanda voltava a ficar `em_uso`.
  Corrigido em `internal/repository/postgres/order_item_repo.go` (mesmo
  padrão do fix de `discounts`: `JOIN comandas c ... AND
  oi.lancado_em >= c.aberta_em`) — confirmado ao vivo via curl: um item de
  R$68,40 de um ciclo anterior sumiu do `GET /comandas/:id/itens` do ciclo
  novo, e o backend passou a rejeitar o fechamento pelo valor antigo,
  aceitando só o valor correto do ciclo atual.

  **ETAPA 3** (US-22, cancelamento de nota): seção própria "Cancelar
  nota fiscal já emitida", separada do fluxo de fechamento (é uma
  correção sobre algo que já aconteceu, não parte de fechar um pagamento
  novo). Busca por código da comanda — endpoint novo `GET
  /comandas/:id/notas-fiscais` (`internal/handler/payment_handler.go`,
  usecase `LocalizarNotasPorComanda`, repo
  `FiscalReceiptRepository.BuscarPorComanda` via `payment_comandas`, não
  existia antes) lista todas as notas ligadas à comanda (uma comanda pode
  ter mais de um payment histórico). Cada nota emitida e ainda não
  cancelada ganha ação "Cancelar nota" (justificativa 15–255 caracteres,
  exigida pela SEFAZ) → `POST /api/pagamentos/:id/cancelar-nota`. Erros
  específicos do backend (nota não emitida, já cancelada, prazo expirado)
  aparecem direto na tela, nunca um genérico. Testado ao vivo: localizou
  as 2 notas reais de C001 no ambiente de dev (uma com falha de emissão
  mostrando o motivo, uma emitida de verdade nº 500209) e tentou cancelar
  — o backend recusou com a mensagem específica correta porque esse
  registro de dev não tem protocolo de autorização gravado (dado de teste
  antigo incompleto, não um bug: confirma que a tela repassa o erro real
  em vez de fingir sucesso).

  **Ajustes pedidos numa segunda rodada, depois de validar a ETAPA 2**
  (todos implementados e testados ao vivo):
  1. Cada comanda no fechamento mostra a lista completa dos itens
     lançados nela (nome, peso/unidade, valor), não só um subtotal — é
     dinheiro real sendo conferido, o caixa precisa ver o detalhamento.
  2. O campo de valor da forma de pagamento já nasce preenchido com o
     total (ou o que falta cobrir) — só precisa digitar algo diferente
     pra dividir entre métodos; é um valor derivado por render (não um
     efeito), some do "piloto automático" assim que o operador edita à
     mão, volta a acompanhar o total quando um pagamento é
     adicionado/removido.
  3. Desconto passou a ser sobre o total do fechamento (ver ETAPA 2
     acima).
  4. Caixa também lança item na comanda (US-11, mesma ação que o
     Garçom tem), reusando `POST /api/comandas/:id/itens`.

  **Correção depois de testar o item 4 ao vivo**: a primeira versão era
  uma busca por nome com clique — o usuário pediu explicitamente algo
  "muito mais prático": digitar o código do item (ex: "17" pra Água
  Mineral) e apertar Enter, sem nenhum passo a mais. Isso exigiu um
  campo novo no catálogo que não existia — `products.codigo_curto`
  (migration `0023_products_codigo_curto.sql`, único por tenant quando
  preenchido, opcional). O painel de "Adicionar item" da Caixa virou um
  único campo: Enter lança direto se o texto bate um código OU um nome
  único; nomes ambíguos ainda mostram uma lista curta pra um clique. O
  painel **não fecha** depois de lançar — o Caixa costuma bipar vários
  itens em sequência (código + Enter, código + Enter...), igual um
  leitor de código de barras real, e fechar a cada um quebraria esse
  ritmo. Testado ao vivo: "17" + Enter lançou Água Mineral na hora,
  repetir "17" + Enter lançou uma segunda unidade sem reabrir nada.
  Produtos de seed de dev ganharam código (`5` Buffet por Peso, `10`
  Refrigerante Lata, `17` Água Mineral) só pra dar exemplos reais de
  teste — cadastro de produto novo (US-21) ainda não expõe esse campo na
  tela (só o backend aceita), fica pra quando essa tela for revisitada.

  **Navegação por teclado na lista de nomes** (pedida depois de testar o
  código): quando a busca por nome acha mais de um produto, ↓/↑ percorre
  a lista (destaque visual acompanha) e Enter confirma o item destacado —
  sem precisar soltar o teclado pra clicar com o mouse. O código do item
  também passou a aparecer ao lado do nome, tanto na lista de busca
  quanto na lista de itens já lançados na comanda (ex: "11 · Refrigerante
  Litro") — ajuda o caixa a ir decorando os códigos com o uso. Testado ao
  vivo: "re" → duas opções → ↓ até a segunda → Enter lançou o item
  destacado, não o primeiro da lista.

  **Bug corrigido logo depois**: digitar o nome completo de um produto
  (restando só 1 resultado) escondia a lista inteira — a condição de
  exibição exigia mais de 1 resultado, então nada aparecia e parecia que
  a busca "não achava nada" mesmo com o item existindo. Corrigido pra
  mostrar a lista com 1 resultado ou mais, sempre com o primeiro item
  pré-destacado — Enter direto já lança, com ou sem usar as setas.

  **Ícone "Notas fiscais emitidas" no header** (pedido depois): abre um
  painel cheio de tela listando TODAS as notas fiscais já emitidas
  (`GET /api/caixa/notas-fiscais?limit=50`, mais recente primeiro), não
  só as de uma comanda específica — cada linha reaproveita o mesmo
  componente de linha + ação "Cancelar nota" já usado na busca por
  comanda (US-22). Endpoint novo no backend: `GET /caixa/notas-fiscais`
  (`internal/handler/report_handler.go`) é um **alias** de `GET
  /notas-fiscais` (que já existia pro Gestor, US-05) só que gated pela
  permissão `cancelar_nota_fiscal` em vez de `ver_relatorios` — o Caixa
  tem a primeira, não a segunda (essa é exclusiva de Gestor/Admin Super
  pra relatórios gerenciais completos); mesmo handler e usecase, zero
  duplicação de lógica.

  **Bug real encontrado e corrigido ao construir isso**:
  `FiscalReceiptRepository.Listar` (usado por `GET /notas-fiscais` desde
  sempre, US-05) nunca selecionava as colunas de cancelamento
  (`cancelada`, `protocolo_autorizacao`, etc.) — toda nota aparecia como
  "não cancelada" mesmo quando já tinha sido cancelada de verdade, e o
  botão "Cancelar nota" apareceria de novo pra algo já cancelado.
  Corrigido igualando ao SELECT mais completo que `BuscarPorComanda` (da
  ETAPA 3) já usava.
- **Gestor** (`app/(gestor)/`) — **em implementação por etapas** (painel
  administrativo, não tela de fluxo operacional — validação a cada
  etapa). Diferença deliberada de sistema de design: fundo
  `bg-branco-marca` (não `bg-papel`), estrutura em **abas fixas no topo**
  (`app/(gestor)/layout.tsx`, client component por causa do destaque da
  aba ativa via `usePathname`), não mais tela de fluxo único — é acessado
  de computador/tablet maior, pode ser mais denso em informação.

  **ETAPA 1 pronta e testada de verdade** (US-03/US-04, aba "Dashboard" +
  aba "Auditoria"):
  - **Dashboard** (`app/(gestor)/gestor/page.tsx`): total vendido hoje
    (font-display, âmbar) + comandas fechadas hoje, lado a lado; abaixo,
    detalhamento por forma de pagamento com barra proporcional simples.
    Usa `GET /api/relatorios/vendas?periodo=dia&data_referencia=hoje`.
  - **Auditoria** (`app/(gestor)/gestor/auditoria/page.tsx`): filtros
    (ação — lista fixa espelhando as chamadas reais de `audit.Executar`
    no backend, comanda por código, período) + tabela paginada (50 por
    página), linha expansível mostrando o `dados` (JSON) de cada registro.
    Usa `GET /api/auditoria`. Testado ao vivo contra 118 registros reais
    do ambiente de dev.

  **Endpoint novo no backend, adicionado durante esta etapa**:
  `RelatorioVendas` não tinha "número de comandas fechadas" nenhum campo
  — só total e detalhamento por forma de pagamento/produto. Adicionado
  `NumeroComandas` (conta `comanda_id` distinto em `payment_comandas`
  dentro do período — uma comanda pode ter N payments num pagamento
  misto, por isso `DISTINCT`, não `COUNT(*)`), via novo método
  `RelatorioRepository.ContarComandasFechadas`
  (`internal/repository/postgres/relatorio_repo.go`).

  **Bug real encontrado e corrigido ao testar esta etapa**: o envelope de
  `GET /auditoria` (`{itens, total, limit, offset}`) usa `json:"itens"`
  minúsculo — diferente da maioria dos DTOs do backend, que não têm tag
  nenhuma e por isso serializam em PascalCase. O front inicialmente lia
  `resposta.Itens` (maiúsculo) e quebrava com "Cannot read properties of
  undefined" porque o campo real vem como `itens`. Mesmo padrão já existia
  em `notasFiscaisResponse` (Caixa) e já estava certo lá — só a Auditoria
  errou. Vale conferir isso sempre que um endpoint novo devolver um
  envelope `{itens, total, ...}` em vez do array/struct de domínio puro.

  **Ainda faltam** (próximas etapas, aguardando validação): ETAPA 2 —
  relatórios com seletor de período completo + gráfico + notas fiscais;
  ETAPA 3 — CRUD de usuários (falta `GET /usuarios`, não existe ainda) e
  cancelamento total de comanda (US-15).
- **Login** — ainda no visual genérico anterior ao sistema de design;
  candidato óbvio pra próxima migração (é a primeira tela que todo
  usuário vê).

Próximo passo natural: replicar o padrão do Porteiro nas demais telas
operacionais (Balança, Garçom, Caixa), uma de cada vez, revalidando com o
usuário a cada tela — não fazer um "rebrand" de todas de uma vez sem
checkpoint.

## Convenções de código

- Cada Route Handler em `app/api/**` é um proxy fino: lê o corpo, chama
  `apiFetch`, repassa status/corpo da resposta do backend — não duplica
  validação que já existe no Go (fonte de verdade é sempre o backend).
- Client components (`"use client"`) só onde há estado/interação; o
  resto fica Server Component por padrão (convenção do App Router).
- Textos de interface sempre em português — é o idioma de quem opera o
  sistema (garçom, balança, caixa, porteiro), não do time de engenharia.
