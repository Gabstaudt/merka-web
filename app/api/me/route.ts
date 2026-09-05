import { NextResponse } from "next/server";

import { apiFetch } from "@/lib/api";

// Proxy autenticado para GET /me — ver
// merka-api/internal/handler/me_handler.go. Devolve as permissões do
// usuário autenticado; o frontend usa isso pra decidir o que mostrar na
// navegação (nunca pelo nome do perfil, que é customizável).
export async function GET() {
  let backendRes: Response;
  try {
    backendRes = await apiFetch("/me", { method: "GET" });
  } catch {
    return NextResponse.json({ erro: "não foi possível conectar ao servidor" }, { status: 502 });
  }

  const data = await backendRes.json().catch(() => ({}));
  return NextResponse.json(data, { status: backendRes.status });
}
