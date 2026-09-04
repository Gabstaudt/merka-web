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
  andando pelo salão), single-column, duas telas dentro do mesmo
  componente: lista de mesas em atendimento (com busca direta por código,
  mesmo padrão dos outros perfis) e a comanda aberta (itens lançados +
  total parcial + adicionar item + remover + transferir mesa). Itens de
  peso e unitário aparecem juntos na mesma lista, distinguidos por um
  rótulo `· peso` / `· unidade` em `font-mono` ao lado do nome do produto
  — nenhuma seção separada, já que ao garçom interessa o lançamento
  completo da comanda, não a origem do lançamento. Remoção (US-12) só
  aparece em itens unitários ativos (itens de peso só se estornam pela
  Balança, rota/permissão diferente). Total parcial usa `text-ambar` +
  `font-display` — é literalmente "valor total", o uso canônico do
  acento âmbar. Conflito de sincronização usa a mesma mensagem específica
  da Balança.

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
  dado mockado): `GET /mesas` (lista mesas + comanda em_uso associada,
  `internal/handler/table_handler.go`) e `GET /comandas/:id/itens`
  (lista todos os order_items de uma comanda, `ComandaHandler.ListarItens`
  em `comanda_handler.go`) — ambos sem `RequerPermissao` (leitura, qualquer
  perfil autenticado). Duas mesas extras de teste (`Mesa 2`, `Mesa 3`) em
  `migrations/0021_seed_mesas_extra.sql`.

- **Caixa** — placeholder navegável (`components/PlaceholderCard.tsx`),
  UI genérica slate/Tailwind default, **ainda não migrada** pro sistema
  de design nem conectada ao backend de verdade (os endpoints já existem
  em merka-api).
- **Gestor** (auditoria, relatórios) — idem, placeholder.
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
