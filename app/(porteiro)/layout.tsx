import { NavShell } from "@/components/NavShell";

export default function PorteiroLayout({ children }: { children: React.ReactNode }) {
  return <NavShell perfil="Porteiro">{children}</NavShell>;
}
