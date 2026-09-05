import { NextResponse } from "next/server";

import { apiFetch } from "@/lib/api";

// Proxy autenticado para GET/PUT /perfis/:id/permissoes (US-02) — ver
// merka-api/internal/handler/role_handler.go. GET lista o que o perfil
// já tem (pra pré-marcar os checkboxes); PUT substitui o conjunto
// inteiro (não faz diff).
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  let backendRes: Response;
  try {
    backendRes = await apiFetch(`/perfis/${encodeURIComponent(id)}/permissoes`, { method: "GET" });
  } catch {
    return NextResponse.json({ erro: "não foi possível conectar ao servidor" }, { status: 502 });
  }

  const data = await backendRes.json().catch(() => ({}));
  return NextResponse.json(data, { status: backendRes.status });
}

export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await request.json().catch(() => ({}));

  let backendRes: Response;
  try {
    backendRes = await apiFetch(`/perfis/${encodeURIComponent(id)}/permissoes`, {
      method: "PUT",
      body: JSON.stringify(body ?? {}),
    });
  } catch {
    return NextResponse.json({ erro: "não foi possível conectar ao servidor" }, { status: 502 });
  }

  const data = await backendRes.json().catch(() => ({}));
  return NextResponse.json(data, { status: backendRes.status });
}
