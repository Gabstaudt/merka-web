import { NextResponse } from "next/server";

import { getToken } from "@/lib/session";

// Única exceção deliberada à regra de "o cliente nunca vê o JWT" (ver
// CLAUDE.md, seção Stack): o WebSocket nativo do navegador não permite
// enviar headers customizados no handshake, então o backend Go exige o
// token via querystring (?token=...) — o mesmo motivo que já levou o
// próprio backend a fazer essa exceção pra si (ver
// merka-api/internal/handler/ws_handler.go). Este endpoint só existe pra
// entregar o token ao client component que abre a conexão — nada além
// disso deve ler o token no cliente.
export async function GET() {
  const token = await getToken();
  if (!token) {
    return NextResponse.json({ erro: "sessão expirada — autentique-se novamente" }, { status: 401 });
  }
  return NextResponse.json({ token });
}
