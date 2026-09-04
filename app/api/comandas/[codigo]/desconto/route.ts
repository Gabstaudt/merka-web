import { NextResponse } from "next/server";

import { apiFetch } from "@/lib/api";

// Proxy autenticado para POST /comandas/:id/desconto (US-17) — ver
// merka-api/internal/handler/comanda_handler.go. Reaproveita o segmento
// [codigo], mas o valor esperado é o UUID da comanda (mesma convenção de
// app/api/comandas/[codigo]/{pesos,itens,mesa}).
export async function POST(request: Request, { params }: { params: Promise<{ codigo: string }> }) {
  const { codigo: comandaId } = await params;
  const body = await request.json().catch(() => ({}));

  let backendRes: Response;
  try {
    backendRes = await apiFetch(`/comandas/${encodeURIComponent(comandaId)}/desconto`, {
      method: "POST",
      body: JSON.stringify(body ?? {}),
    });
  } catch {
    return NextResponse.json({ erro: "não foi possível conectar ao servidor" }, { status: 502 });
  }

  const data = await backendRes.json().catch(() => ({}));
  return NextResponse.json(data, { status: backendRes.status });
}
