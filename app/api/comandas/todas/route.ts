import { NextResponse } from "next/server";

import { apiFetch } from "@/lib/api";

// Proxy autenticado para GET /comandas/todas — visão geral de TODAS as
// comandas do tenant (permissão "ver_comandas"), com resumo do que está
// lançado em cada uma. Ver merka-api/internal/handler/comanda_handler.go.
export async function GET() {
  let backendRes: Response;
  try {
    backendRes = await apiFetch("/comandas/todas", { method: "GET" });
  } catch {
    return NextResponse.json({ erro: "não foi possível conectar ao servidor" }, { status: 502 });
  }

  const data = await backendRes.json().catch(() => ({}));
  return NextResponse.json(data, { status: backendRes.status });
}
