import { NextResponse } from "next/server";

import { apiFetch } from "@/lib/api";

// Proxy autenticado para GET /perfis (US-02) — ver
// merka-api/internal/handler/role_handler.go. Usado pra popular o
// seletor de perfil na criação de usuário (US-01).
export async function GET() {
  let backendRes: Response;
  try {
    backendRes = await apiFetch("/perfis", { method: "GET" });
  } catch {
    return NextResponse.json({ erro: "não foi possível conectar ao servidor" }, { status: 502 });
  }

  const data = await backendRes.json().catch(() => ({}));
  return NextResponse.json(data, { status: backendRes.status });
}
