// Nome do cookie httpOnly que guarda o JWT emitido pelo backend
// (POST /auth/login — ver merka-api/internal/usecase/autenticar.go).
// Fica num arquivo próprio, sem depender de "next/headers", porque
// middleware.ts roda no Edge runtime e só pode ler `request.cookies`.
export const TOKEN_COOKIE = "merka_token";
