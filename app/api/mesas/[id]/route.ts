import { NextResponse } from "next/server";

import { apiFetch } from "@/lib/api";

// Proxy autenticado para PATCH /mesas/:id (renomear, Configurações) —
// ver merka-api/internal/handler/table_handler.go. Restrito a Admin
// Super (permissão "configurar_sistema").
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await request.json().catch(() => ({}));

  let backendRes: Response;
  try {
    backendRes = await apiFetch(`/mesas/${encodeURIComponent(id)}`, {
      method: "PATCH",
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
