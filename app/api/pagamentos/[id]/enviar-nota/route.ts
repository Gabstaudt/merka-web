import { NextResponse } from "next/server";

import { apiFetch } from "@/lib/api";

// Proxy autenticado para POST /pagamentos/:id/enviar-nota — ver
// merka-api/internal/handler/payment_handler.go. Canal "email" envia de
// verdade (real via SMTP se configurado no backend, ou simulado em dev);
// canal "whatsapp" é recusado pelo backend com 501 — ainda não há
// integração com nenhum provedor externo, e este proxy não esconde isso.
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await request.json().catch(() => ({}));

  let backendRes: Response;
  try {
    backendRes = await apiFetch(`/pagamentos/${encodeURIComponent(id)}/enviar-nota`, {
      method: "POST",
      body: JSON.stringify(body ?? {}),
    });
  } catch {
    return NextResponse.json({ erro: "não foi possível conectar ao servidor" }, { status: 502 });
  }

  if (backendRes.status === 204) {
    return new NextResponse(null, { status: 204 });
  }

  const data = await backendRes.json().catch(() => ({}));
  return NextResponse.json(data, { status: backendRes.status });
}
