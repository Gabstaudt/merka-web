import { NextResponse } from "next/server";

import { apiFetch } from "@/lib/api";

// Proxy autenticado para GET /produtos (catálogo) — ver
// merka-api/internal/handler/product_handler.go. Qualquer perfil
// autenticado pode listar; usado pela Balança (US-09) e Garçom (US-11)
// pra escolher o que lançar.
export async function GET() {
  let backendRes: Response;
  try {
    backendRes = await apiFetch("/produtos", { method: "GET" });
  } catch {
    return NextResponse.json({ erro: "não foi possível conectar ao servidor" }, { status: 502 });
  }

  const data = await backendRes.json().catch(() => ({}));
  return NextResponse.json(data, { status: backendRes.status });
}
