import "server-only";

import { cookies } from "next/headers";

import { TOKEN_COOKIE } from "./constants";

// Lê o token da sessão a partir do cookie httpOnly — só pode ser chamado
// em Server Components, Route Handlers ou Server Actions (nunca no
// cliente: por isso o cookie nem tem essa informação acessível via JS).
export async function getToken(): Promise<string | undefined> {
  const store = await cookies();
  return store.get(TOKEN_COOKIE)?.value;
}
