import { NextResponse } from "next/server";

import { apiFetch } from "@/lib/api";

// Proxy autenticado para POST /pagamentos/:id/cancelar-nota (US-22) — ver
// merka-api/internal/handler/payment_handler.go. Só funciona dentro do
// prazo regulamentar a partir da emissão; passado o prazo o backend
// devolve um erro específico (não genérico) que a tela repassa direto.
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await request.json().catch(() => ({}));

  let backendRes: Response;
  try {
    backendRes = await apiFetch(`/pagamentos/${encodeURIComponent(id)}/cancelar-nota`, {
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
