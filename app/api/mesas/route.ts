import { NextResponse } from "next/server";

import { apiFetch } from "@/lib/api";

// Proxy autenticado para GET/POST /mesas (US-16 + Configurações) — ver
// merka-api/internal/handler/table_handler.go. GET lista as mesas ATIVAS
// com a comanda em_uso associada quando houver (Garçom); POST cadastra
// mesa nova (Configurações, exclusivo de Admin Super).
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

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}));

  let backendRes: Response;
  try {
    backendRes = await apiFetch("/mesas", {
      method: "POST",
      body: JSON.stringify(body ?? {}),
    });
  } catch {
    return NextResponse.json({ erro: "não foi possível conectar ao servidor" }, { status: 502 });
  }

  const data = await backendRes.json().catch(() => ({}));
  return NextResponse.json(data, { status: backendRes.status });
}
