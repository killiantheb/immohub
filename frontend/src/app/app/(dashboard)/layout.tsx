import { DashboardSidebar } from "@/components/DashboardSidebar";

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ display: "flex", minHeight: "100vh", background: "#FAF5EB" }}>
      <DashboardSidebar />
      <main style={{ flex: 1, minWidth: 0, padding: "2rem 2rem 3rem", overflowY: "auto" }}>
        {children}
      </main>
    </div>
  );
}
