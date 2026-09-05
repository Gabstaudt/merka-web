import { NextResponse } from "next/server";

import { apiFetch } from "@/lib/api";

// Proxy autenticado para GET /mesas/todas (Configurações) — ver
// merka-api/internal/handler/table_handler.go. Lista todas as mesas,
// ativas e inativas — restrito a Admin Super (permissão
// "configurar_sistema"), diferente de GET /api/mesas (só ativas, aberto
// a qualquer perfil).
export async function GET() {
  let backendRes: Response;
  try {
    backendRes = await apiFetch("/mesas/todas", { method: "GET" });
  } catch {
    return NextResponse.json({ erro: "não foi possível conectar ao servidor" }, { status: 502 });
  }

  const data = await backendRes.json().catch(() => ({}));
  return NextResponse.json(data, { status: backendRes.status });
}
