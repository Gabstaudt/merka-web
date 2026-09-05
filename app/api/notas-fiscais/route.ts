import { NextResponse } from "next/server";

import { apiFetch } from "@/lib/api";

// Proxy autenticado para GET /notas-fiscais (US-05) — ver
// merka-api/internal/handler/report_handler.go. Restrito a Gestor/Admin
// Super (permissão "ver_relatorios"); diferente do alias
// /api/caixa/notas-fiscais usado na tela do Caixa, que roda sob
// "cancelar_nota_fiscal". Repassa data_inicio, data_fim, emitida, limit,
// offset como vieram da querystring.
export async function GET(request: Request) {
  const { search } = new URL(request.url);

  let backendRes: Response;
  try {
    backendRes = await apiFetch(`/notas-fiscais${search}`, { method: "GET" });
  } catch {
    return NextResponse.json({ erro: "não foi possível conectar ao servidor" }, { status: 502 });
  }

  const data = await backendRes.json().catch(() => ({}));
  return NextResponse.json(data, { status: backendRes.status });
}
