import { NextResponse } from "next/server";

import { TOKEN_COOKIE } from "@/lib/constants";

const API_URL = process.env.MERKA_API_URL ?? "http://localhost:8080";

// Proxy de login: recebe login/senha do form, chama POST /auth/login no
// backend Go, e — se der certo — grava o JWT retornado num cookie
// httpOnly (nunca no corpo da resposta pro cliente, nunca em
// localStorage). O front só sabe que "está logado", nunca vê o token.
export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  if (!body?.login || !body?.senha) {
    return NextResponse.json({ erro: "informe login e senha" }, { status: 400 });
  }

  let backendRes: Response;
  try {
    backendRes = await fetch(`${API_URL}/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ login: body.login, senha: body.senha }),
      cache: "no-store",
    });
  } catch {
    return NextResponse.json({ erro: "não foi possível conectar ao servidor" }, { status: 502 });
  }

  const data = await backendRes.json().catch(() => ({}));

  if (!backendRes.ok || typeof data.token !== "string") {
    return NextResponse.json(data.erro ? data : { erro: "login ou senha inválidos" }, {
      status: backendRes.status || 401,
    });
  }

  const response = NextResponse.json({ ok: true });
  response.cookies.set(TOKEN_COOKIE, data.token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    // Mesmo TTL do JWT emitido pelo backend (12h — ver
    // merka-api/internal/usecase/autenticar.go).
    maxAge: 60 * 60 * 12,
  });

  return response;
}
