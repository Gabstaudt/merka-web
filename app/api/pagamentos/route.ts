import { NextResponse } from "next/server";

import { apiFetch } from "@/lib/api";

// Proxy autenticado para POST /pagamentos (US-13 + US-14) — ver
// merka-api/internal/handler/payment_handler.go. Soma o total ativo das
// comandas informadas, confere contra os pagamentos parciais (suporta
// misto) e, se bater, fecha as comandas como pagas. Emissão de NFC-e para
// métodos de cartão roda em background no backend — esta chamada não
// espera a SEFAZ responder.
export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}));

  let backendRes: Response;
  try {
    backendRes = await apiFetch("/pagamentos", {
      method: "POST",
      body: JSON.stringify(body ?? {}),
    });
  } catch {
    return NextResponse.json({ erro: "não foi possível conectar ao servidor" }, { status: 502 });
  }

  const data = await backendRes.json().catch(() => ({}));
  return NextResponse.json(data, { status: backendRes.status });
}
