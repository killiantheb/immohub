import { DashboardSidebar } from "@/components/DashboardSidebar";
import { SphereWidget } from "@/components/SphereWidget";

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ display: "flex", minHeight: "100vh", background: "var(--althy-bg)" }}>
      <DashboardSidebar />
      <main style={{ flex: 1, minWidth: 0, overflowY: "auto", padding: "2.5rem 2.5rem 4rem" }}>
        {children}
      </main>
      <SphereWidget />
    </div>
  );
}
