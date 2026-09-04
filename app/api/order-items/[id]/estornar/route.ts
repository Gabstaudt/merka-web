import { NextResponse } from "next/server";

import { apiFetch } from "@/lib/api";

// Proxy autenticado para PATCH /order-items/:id/estornar (US-10) — ver
// merka-api/internal/handler/order_item_handler.go. O registro original é
// preservado (nunca DELETE físico); só muda o status pra "estornado".
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await request.json().catch(() => ({}));

  let backendRes: Response;
  try {
    backendRes = await apiFetch(`/order-items/${encodeURIComponent(id)}/estornar`, {
      method: "PATCH",
      body: JSON.stringify(body ?? {}),
    });
  } catch {
    return NextResponse.json({ erro: "não foi possível conectar ao servidor" }, { status: 502 });
  }

  const data = await backendRes.json().catch(() => ({}));
  return NextResponse.json(data, { status: backendRes.status });
}
