import { NextResponse } from "next/server";

import { apiFetch } from "@/lib/api";

// Proxy autenticado para PATCH /produtos/:id/preco-peso (US-20) — ver
// merka-api/internal/handler/product_handler.go. Só ajusta preço/kg e/ou
// tara de um produto do tipo peso já existente; não cadastra produto novo.
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await request.json().catch(() => ({}));

  let backendRes: Response;
  try {
    backendRes = await apiFetch(`/produtos/${encodeURIComponent(id)}/preco-peso`, {
      method: "PATCH",
      body: JSON.stringify(body ?? {}),
    });
  } catch {
    return NextResponse.json({ erro: "não foi possível conectar ao servidor" }, { status: 502 });
  }

  const data = await backendRes.json().catch(() => ({}));
  return NextResponse.json(data, { status: backendRes.status });
}
