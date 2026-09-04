import type { Metadata, Viewport } from "next";
import { Fraunces, IBM_Plex_Mono, IBM_Plex_Sans } from "next/font/google";
import "./globals.css";

import { ServiceWorkerRegister } from "@/components/ServiceWorkerRegister";

// Sistema de design Merka — ver CLAUDE.md. Fraunces carrega os valores
// grandes (total, código de comanda em destaque); IBM Plex Sans é o texto
// de interface; IBM Plex Mono é reservado pra código/horário/protocolo —
// não é decoração, é o mesmo registro tipográfico de um cupom fiscal real.
const fraunces = Fraunces({
  variable: "--font-fraunces",
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  style: ["normal", "italic"],
});

const plexSans = IBM_Plex_Sans({
  variable: "--font-plex-sans",
  subsets: ["latin"],
  weight: ["400", "500", "600"],
});

const plexMono = IBM_Plex_Mono({
  variable: "--font-plex-mono",
  subsets: ["latin"],
  weight: ["400", "500"],
});

export const metadata: Metadata = {
  title: "Merka",
  description: "Sistema de comandas para churrascaria — Merka.",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "Merka",
  },
};

export const viewport: Viewport = {
  themeColor: "#2a2f3a",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="pt-BR"
      className={`${fraunces.variable} ${plexSans.variable} ${plexMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col bg-slate-50 text-slate-900 dark:bg-slate-950 dark:text-slate-50">
        <ServiceWorkerRegister />
        {children}
      </body>
    </html>
  );
}
