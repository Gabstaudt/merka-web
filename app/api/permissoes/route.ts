import { NextResponse } from "next/server";

import { apiFetch } from "@/lib/api";

// Proxy autenticado para GET /permissoes (US-02) — ver
// merka-api/internal/handler/role_handler.go. Catálogo fixo de
// permissões, usado pra popular os checkboxes de criar/editar perfil.
export async function GET() {
  let backendRes: Response;
  try {
    backendRes = await apiFetch("/permissoes", { method: "GET" });
  } catch {
    return NextResponse.json({ erro: "não foi possível conectar ao servidor" }, { status: 502 });
  }

  const data = await backendRes.json().catch(() => ({}));
  return NextResponse.json(data, { status: backendRes.status });
}
