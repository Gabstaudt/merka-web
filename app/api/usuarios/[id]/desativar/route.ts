import { NextResponse } from "next/server";

import { apiFetch } from "@/lib/api";

// Proxy autenticado para PATCH /usuarios/:id/desativar (US-01) — ver
// merka-api/internal/handler/user_handler.go. Nunca deleta — o usuário
// perde acesso na hora, mas o histórico em audit_log continua intacto.
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  let backendRes: Response;
  try {
    backendRes = await apiFetch(`/usuarios/${encodeURIComponent(id)}/desativar`, { method: "PATCH" });
  } catch {
    return NextResponse.json({ erro: "não foi possível conectar ao servidor" }, { status: 502 });
  }

  if (backendRes.status === 204) {
    return new NextResponse(null, { status: 204 });
  }

  const data = await backendRes.json().catch(() => ({}));
  return NextResponse.json(data, { status: backendRes.status });
}
