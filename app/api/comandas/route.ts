import { NextResponse } from "next/server";

import { apiFetch } from "@/lib/api";

// Proxy autenticado para POST /comandas — cadastra uma comanda física
// nova (permissão "criar_comanda", Admin Super/Gestor). Ver
// merka-api/internal/handler/comanda_handler.go.
export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}));

  let backendRes: Response;
  try {
    backendRes = await apiFetch("/comandas", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
  } catch {
    return NextResponse.json({ erro: "não foi possível conectar ao servidor" }, { status: 502 });
  }

  const data = await backendRes.json().catch(() => ({}));
  return NextResponse.json(data, { status: backendRes.status });
}
