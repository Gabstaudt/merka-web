import { NavShell } from "@/components/NavShell";

export default function GarcomLayout({ children }: { children: React.ReactNode }) {
  return <NavShell perfil="Garçom">{children}</NavShell>;
}
