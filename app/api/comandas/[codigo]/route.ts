import { NextResponse } from "next/server";

import { apiFetch } from "@/lib/api";

// Proxy autenticado para GET /comandas/:codigo (consulta de status, sem
// efeito colateral) — ver merka-api/internal/handler/comanda_handler.go.
// Usado pelo Porteiro (US-07/US-08) pra decidir automaticamente, a partir
// do status devolvido, se a próxima chamada é .../abrir ou .../liberar.
export async function GET(request: Request, { params }: { params: Promise<{ codigo: string }> }) {
  const { codigo } = await params;

  let backendRes: Response;
  try {
    backendRes = await apiFetch(`/comandas/${encodeURIComponent(codigo)}`, { method: "GET" });
  } catch {
    return NextResponse.json({ erro: "não foi possível conectar ao servidor" }, { status: 502 });
  }

  const data = await backendRes.json().catch(() => ({}));
  return NextResponse.json(data, { status: backendRes.status });
}

// Proxy autenticado para DELETE /comandas/:id — exclui (soft-delete) uma
// comanda física que não esteja em uso (permissão "excluir_comanda",
// Admin Super/Gestor). Mesmo segmento dinâmico do GET acima (Next.js
// exige um nome de slug só por nível de rota) — aqui "codigo" carrega o
// ID (uuid) da comanda, não o código físico.
export async function DELETE(request: Request, { params }: { params: Promise<{ codigo: string }> }) {
  const { codigo: id } = await params;

  let backendRes: Response;
  try {
    backendRes = await apiFetch(`/comandas/${encodeURIComponent(id)}`, { method: "DELETE" });
  } catch {
    return NextResponse.json({ erro: "não foi possível conectar ao servidor" }, { status: 502 });
  }

  if (backendRes.status === 204) {
    return new NextResponse(null, { status: 204 });
  }

  const data = await backendRes.json().catch(() => ({}));
  return NextResponse.json(data, { status: backendRes.status });
}
