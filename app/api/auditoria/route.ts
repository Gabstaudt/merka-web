import { NextResponse } from "next/server";

import { apiFetch } from "@/lib/api";

// Proxy autenticado para GET /auditoria (US-03) — ver
// merka-api/internal/handler/audit_log_handler.go. Repassa todos os
// filtros (usuario_id, acao, comanda_id, data_inicio, data_fim, limit,
// offset) como vieram da querystring.
export async function GET(request: Request) {
  const { search } = new URL(request.url);

  let backendRes: Response;
  try {
    backendRes = await apiFetch(`/auditoria${search}`, { method: "GET" });
  } catch {
    return NextResponse.json({ erro: "não foi possível conectar ao servidor" }, { status: 502 });
  }

  const data = await backendRes.json().catch(() => ({}));
  return NextResponse.json(data, { status: backendRes.status });
}
