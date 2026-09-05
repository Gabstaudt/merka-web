"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";

import { MerkaLogo } from "@/components/MerkaLogo";

export default function LoginPage() {
  const router = useRouter();
  const [login, setLogin] = useState("");
  const [senha, setSenha] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  const [carregando, setCarregando] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setErro(null);
    setCarregando(true);

    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ login, senha }),
      });
      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        setErro(data.erro ?? "não foi possível entrar");
        return;
      }

      // router.refresh() garante que o middleware reavalie o cookie recém
      // gravado antes de qualquer navegação subsequente.
      router.push("/");
      router.refresh();
    } catch {
      setErro("Sem conexão com o servidor. Confira a rede e tente de novo.");
    } finally {
      setCarregando(false);
    }
  }

  return (
    <main className="flex min-h-dvh items-center justify-center bg-papel px-6">
      <form onSubmit={handleSubmit} className="flex w-full max-w-xs flex-col gap-8">
        <div>
          <MerkaLogo className="h-8 w-auto" />
          <p className="mt-3 text-sm text-texto-secundario">Entre com seu usuário</p>
        </div>

        <div className="flex flex-col gap-6 border-y border-linha py-6">
          <label className="flex flex-col gap-2">
            <span className="text-sm text-texto-secundario">Login</span>
            <input
              type="text"
              value={login}
              onChange={(e) => setLogin(e.target.value)}
              autoComplete="username"
              autoFocus
              required
              className="border-b-2 border-tinta bg-transparent pb-2 text-lg text-tinta outline-none focus:border-ambar"
            />
          </label>

          <label className="flex flex-col gap-2">
            <span className="text-sm text-texto-secundario">Senha</span>
            <input
              type="password"
              value={senha}
              onChange={(e) => setSenha(e.target.value)}
              autoComplete="current-password"
              required
              className="border-b-2 border-tinta bg-transparent pb-2 text-lg text-tinta outline-none focus:border-ambar"
            />
          </label>
        </div>

        {erro && <p className="text-sm text-ambar">{erro}</p>}

        <button
          type="submit"
          disabled={carregando}
          className="bg-tinta px-6 py-3 text-base font-medium text-papel transition-opacity disabled:opacity-40"
        >
          {carregando ? "Entrando…" : "Entrar"}
        </button>
      </form>
    </main>
  );
}
