import { NavShell } from "@/components/NavShell";

export default function GestorLayout({ children }: { children: React.ReactNode }) {
  return <NavShell perfil="Gestor">{children}</NavShell>;
}
