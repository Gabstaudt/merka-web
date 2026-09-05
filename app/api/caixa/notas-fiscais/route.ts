import { NextResponse } from "next/server";

import { apiFetch } from "@/lib/api";

// Proxy autenticado para GET /caixa/notas-fiscais — alias de
// GET /notas-fiscais (US-05) sob a permissão "cancelar_nota_fiscal", que
// o Caixa tem (diferente de "ver_relatorios", restrita a Gestor/Admin
// Super) — ver merka-api/internal/handler/report_handler.go. Lista as
// notas fiscais emitidas recentemente, pro Caixa localizar/conferir sem
// precisar buscar comanda por comanda.
export async function GET(request: Request) {
  const { search } = new URL(request.url);

  let backendRes: Response;
  try {
    backendRes = await apiFetch(`/caixa/notas-fiscais${search}`, { method: "GET" });
  } catch {
    return NextResponse.json({ erro: "não foi possível conectar ao servidor" }, { status: 502 });
  }

  const data = await backendRes.json().catch(() => ({}));
  return NextResponse.json(data, { status: backendRes.status });
}
