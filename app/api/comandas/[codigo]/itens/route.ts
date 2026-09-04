import { NextResponse } from "next/server";

import { apiFetch } from "@/lib/api";

// Proxy autenticado para GET/POST /comandas/:id/itens (US-11/US-12) — ver
// merka-api/internal/handler/comanda_handler.go. Reaproveita o segmento
// dinâmico [codigo] do restante de app/api/comandas/ (rotas irmãs no
// mesmo nível do Next precisam do mesmo nome de parâmetro), mas aqui o
// valor esperado é o UUID da comanda, não o código físico — mesma
// convenção já usada em app/api/comandas/[codigo]/pesos/route.ts.
export async function GET(request: Request, { params }: { params: Promise<{ codigo: string }> }) {
  const { codigo: comandaId } = await params;

  let backendRes: Response;
  try {
    backendRes = await apiFetch(`/comandas/${encodeURIComponent(comandaId)}/itens`, { method: "GET" });
  } catch {
    return NextResponse.json({ erro: "não foi possível conectar ao servidor" }, { status: 502 });
  }

  const data = await backendRes.json().catch(() => ({}));
  return NextResponse.json(data, { status: backendRes.status });
}

export async function POST(request: Request, { params }: { params: Promise<{ codigo: string }> }) {
  const { codigo: comandaId } = await params;
  const body = await request.json().catch(() => ({}));

  let backendRes: Response;
  try {
    backendRes = await apiFetch(`/comandas/${encodeURIComponent(comandaId)}/itens`, {
      method: "POST",
      body: JSON.stringify(body ?? {}),
    });
  } catch {
    return NextResponse.json({ erro: "não foi possível conectar ao servidor" }, { status: 502 });
  }

  const data = await backendRes.json().catch(() => ({}));
  return NextResponse.json(data, { status: backendRes.status });
}
