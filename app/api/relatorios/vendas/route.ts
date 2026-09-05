import { NextResponse } from "next/server";

import { apiFetch } from "@/lib/api";

// Proxy autenticado para GET /relatorios/vendas (US-04) — ver
// merka-api/internal/handler/report_handler.go. Repassa periodo e
// data_referencia como vieram da querystring.
export async function GET(request: Request) {
  const { search } = new URL(request.url);

  let backendRes: Response;
  try {
    backendRes = await apiFetch(`/relatorios/vendas${search}`, { method: "GET" });
  } catch {
    return NextResponse.json({ erro: "não foi possível conectar ao servidor" }, { status: 502 });
  }

  const data = await backendRes.json().catch(() => ({}));
  return NextResponse.json(data, { status: backendRes.status });
}
