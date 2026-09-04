import { NextRequest, NextResponse } from "next/server";

import { TOKEN_COOKIE } from "./lib/constants";

// Protege todas as rotas de página exceto /login: se não houver cookie de
// sessão, redireciona pro login. Verificação simples (só presença do
// cookie) — quem valida a assinatura/expiração do JWT de verdade é o
// backend Go (internal/middleware/auth.go), a cada chamada de API. Checar
// permissão granular por perfil (role) fica para depois.
//
// (Next.js 16 renomeou a convenção "middleware.ts" para "proxy.ts" — a
// função continua rodando antes de toda rota que bater no matcher.)
const PUBLIC_PATHS = ["/login"];

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (PUBLIC_PATHS.some((path) => pathname.startsWith(path))) {
    return NextResponse.next();
  }

  const token = request.cookies.get(TOKEN_COOKIE)?.value;
  if (!token) {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("from", pathname);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  // Não intercepta /api/**: os Route Handlers ali dentro fazem sua própria
  // checagem (repassam o Bearer token pro backend, que responde 401 se
  // inválido/ausente — redirecionar uma chamada fetch() pro HTML de
  // /login quebraria o cliente). Também ignora assets estáticos, os
  // arquivos da PWA (manifest, service worker, ícone) e public/logos/ —
  // a marca precisa aparecer até na tela de login, sem sessão.
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico|manifest.json|sw.js|icon.svg|logos/).*)"],
};
