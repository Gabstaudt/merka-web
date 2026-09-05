import { NextResponse } from "next/server";

import { apiFetch } from "@/lib/api";

// Proxy autenticado para GET /configuracoes (Configurações) — ver
// merka-api/internal/handler/pricing_rule_handler.go. Restrito a Admin
// Super (permissão "configurar_sistema").
export async function GET() {
  let backendRes: Response;
  try {
    backendRes = await apiFetch("/configuracoes", { method: "GET" });
  } catch {
    return NextResponse.json({ erro: "não foi possível conectar ao servidor" }, { status: 502 });
  }

  const data = await backendRes.json().catch(() => ({}));
  return NextResponse.json(data, { status: backendRes.status });
}
