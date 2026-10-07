import { AppShell } from "@/components/shell";

export default function WorkspaceLayout({ children }: LayoutProps<"/">) {
  return <AppShell>{children}</AppShell>;
}
