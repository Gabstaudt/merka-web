"use client";

// Cliente da impressora térmica via agente local QZ Tray (decisão do
// CLAUDE.md: "impressora térmica via USB → precisa de agente local (ex:
// QZ Tray) na máquina do caixa, backend não fala direto com ela").
//
// Requer o QZ Tray (https://qz.io/download/) instalado e rodando na
// máquina do caixa — ele expõe um WebSocket local (padrão
// wss://localhost:8181) que este código conversa via o pacote npm
// "qz-tray". Em produção, qz.print() também exige certificado + chave de
// assinatura configurados via qz.security.set*Promise (ver
// https://qz.io/wiki/2.0-signing-messages) — sem isso o QZ Tray mostra um
// pop-up de "conexão não confiável" a cada impressão; aceitável em
// desenvolvimento, não em produção. Isso ainda não está configurado aqui.
//
// O import de "qz-tray" é sempre dinâmico (só roda no clique do usuário,
// nunca no carregamento da página) — se o agente não estiver instalado ou
// a conexão falhar, cai no catch e devolve { ok: false }, para a tela
// mostrar um aviso em vez de travar o fluxo de pagamento.

export type ResultadoQZ = { ok: true } | { ok: false; motivo: string };

async function carregarQZ() {
  const mod = await import("qz-tray");
  return mod.default;
}

export async function conectarQZTray(): Promise<ResultadoQZ> {
  try {
    const qz = await carregarQZ();

    if (qz.websocket.isActive()) {
      return { ok: true };
    }

    await qz.websocket.connect();
    return { ok: true };
  } catch (err) {
    return { ok: false, motivo: mensagemDeErro(err) };
  }
}

export async function imprimirCupom(linhas: string[]): Promise<ResultadoQZ> {
  try {
    const qz = await carregarQZ();

    if (!qz.websocket.isActive()) {
      const conexao = await conectarQZTray();
      if (!conexao.ok) return conexao;
    }

    const impressoraPadrao = await qz.printers.getDefault();
    const config = qz.configs.create(impressoraPadrao);
    const dados = linhas.map((linha) => ({ type: "raw", format: "plain", data: `${linha}\n` }));

    await qz.print(config, dados);
    return { ok: true };
  } catch (err) {
    return { ok: false, motivo: mensagemDeErro(err) };
  }
}

function mensagemDeErro(err: unknown): string {
  if (err instanceof Error) return err.message;
  return "QZ Tray indisponível — verifique se o agente está instalado e rodando nesta máquina.";
}
