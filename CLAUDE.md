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
  Conectada a `POST /comandas/:codigo/abrir` (US-07) e
  `POST /comandas/:codigo/liberar` (US-08) via proxy em
  `app/api/comandas/[codigo]/{abrir,liberar}/route.ts`. Tela de destino
  único do perfil — sem navegação além de um botão discreto de logout
  (por isso não usa `components/NavShell.tsx`, que tem breadcrumb "←
  Início"; ver `app/(porteiro)/layout.tsx`).
- **Balança, Garçom, Caixa** — placeholders navegáveis
  (`components/PlaceholderCard.tsx`), UI genérica slate/Tailwind default,
  **ainda não migradas** pro sistema de design nem conectadas ao backend
  de verdade (os endpoints já existem em merka-api).
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
