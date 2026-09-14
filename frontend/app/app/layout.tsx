import { AppShell } from "@/components/uphold/AppShell";

export default function ApplicationLayout({ children }: { children: React.ReactNode }) {
  return <AppShell>{children}</AppShell>;
}
