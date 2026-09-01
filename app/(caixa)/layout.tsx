import { NavShell } from "@/components/NavShell";

export default function CaixaLayout({ children }: { children: React.ReactNode }) {
  return <NavShell perfil="Caixa">{children}</NavShell>;
}
