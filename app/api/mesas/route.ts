import { NextResponse } from "next/server";

import { apiFetch } from "@/lib/api";

// Proxy autenticado para GET /mesas (US-16) — ver
// merka-api/internal/handler/table_handler.go. Lista todas as mesas do
// tenant com a comanda em_uso associada quando houver; usado pelo Garçom
// pra ver mesas ocupadas e escolher a mesa de destino de uma transferência.
export async function GET() {
  let backendRes: Response;
  try {
    backendRes = await apiFetch("/mesas", { method: "GET" });
  } catch {
    return NextResponse.json({ erro: "não foi possível conectar ao servidor" }, { status: 502 });
  }

  const data = await backendRes.json().catch(() => ({}));
  return NextResponse.json(data, { status: backendRes.status });
}
