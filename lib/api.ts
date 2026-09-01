import "server-only";

import { getToken } from "./session";

// URL do backend Go — em dev/Docker Compose local, aponta pro merka-api
// exposto em localhost:8080 (ver docker-compose.yml do backend).
const API_URL = process.env.MERKA_API_URL ?? "http://localhost:8080";

/**
 * apiFetch é o único ponto que fala com o backend Go a partir do
 * servidor Next.js — sempre anexa o Bearer token lido do cookie httpOnly
 * (nunca exposto ao JS do navegador). Usado pelos Route Handlers em
 * app/api/** que fazem de proxy autenticado entre o cliente e o Fiber.
 */
export async function apiFetch(path: string, init: RequestInit = {}): Promise<Response> {
  const token = await getToken();

  const headers = new Headers(init.headers);
  headers.set("Content-Type", "application/json");
  if (token) {
    headers.set("Authorization", `Bearer ${token}`);
  }

  return fetch(`${API_URL}${path}`, {
    ...init,
    headers,
    cache: "no-store",
  });
}
