import { NextResponse } from "next/server";

import { apiFetch } from "@/lib/api";

// Proxy autenticado para PUT /configuracoes/:chave (Configurações) — ver
// merka-api/internal/handler/pricing_rule_handler.go. Upsert por chave —
// nunca duplica, sempre substitui a configuração inteira daquela chave.
export async function PUT(request: Request, { params }: { params: Promise<{ chave: string }> }) {
  const { chave } = await params;
  const body = await request.json().catch(() => ({}));

  let backendRes: Response;
  try {
    backendRes = await apiFetch(`/configuracoes/${encodeURIComponent(chave)}`, {
      method: "PUT",
      body: JSON.stringify(body ?? {}),
    });
  } catch {
    return NextResponse.json({ erro: "não foi possível conectar ao servidor" }, { status: 502 });
  }

  const data = await backendRes.json().catch(() => ({}));
  return NextResponse.json(data, { status: backendRes.status });
}
