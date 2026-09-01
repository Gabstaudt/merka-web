import { NextResponse } from "next/server";

import { apiFetch } from "@/lib/api";

// Proxy autenticado para POST /comandas/:codigo/abrir (US-07 — ver
// merka-api/internal/handler/comanda_handler.go). O front nunca vê o JWT;
// este Route Handler lê o cookie httpOnly no servidor e repassa como
// Bearer token pro backend Go.
export async function POST(request: Request, { params }: { params: Promise<{ codigo: string }> }) {
  const { codigo } = await params;
  const body = await request.json().catch(() => ({}));

  let backendRes: Response;
  try {
    backendRes = await apiFetch(`/comandas/${encodeURIComponent(codigo)}/abrir`, {
      method: "POST",
      body: JSON.stringify(body ?? {}),
    });
  } catch {
    return NextResponse.json({ erro: "não foi possível conectar ao servidor" }, { status: 502 });
  }

  const data = await backendRes.json().catch(() => ({}));
  return NextResponse.json(data, { status: backendRes.status });
}
