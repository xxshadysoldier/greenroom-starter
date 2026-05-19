import { Sidebar } from "@/components/layout/sidebar";
import { CommandPaletteData } from "@/components/command-palette/command-data";

/**
 * Internal app layout — Mariana's surfaces. Sidebar nav + a scrollable
 * <main> so sticky elements inside routes (the deal-form readiness rail,
 * the show-detail poster header) have a real overflow ancestor.
 */
export default function AppLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <div className="h-screen flex">
      <Sidebar />
      <main className="flex-1 overflow-auto relative">{children}</main>
      <CommandPaletteData />
    </div>
  );
}
