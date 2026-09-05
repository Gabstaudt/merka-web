import { NextResponse } from "next/server";

import { apiFetch } from "@/lib/api";

// Proxy autenticado para GET /comandas/:id/notas-fiscais (US-22) — ver
// merka-api/internal/handler/payment_handler.go. Reaproveita o segmento
// [codigo], mas o valor esperado é o UUID da comanda (mesma convenção de
// app/api/comandas/[codigo]/{pesos,itens,mesa,desconto}).
export async function GET(request: Request, { params }: { params: Promise<{ codigo: string }> }) {
  const { codigo: comandaId } = await params;

  let backendRes: Response;
  try {
    backendRes = await apiFetch(`/comandas/${encodeURIComponent(comandaId)}/notas-fiscais`, { method: "GET" });
  } catch {
    return NextResponse.json({ erro: "não foi possível conectar ao servidor" }, { status: 502 });
  }

  const data = await backendRes.json().catch(() => ({}));
  return NextResponse.json(data, { status: backendRes.status });
}
