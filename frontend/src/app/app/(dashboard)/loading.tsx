import { C } from "@/lib/design-tokens";

export default function DashboardLoading() {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        minHeight: "calc(100vh - 80px)",
        padding: 32,
      }}
      role="status"
      aria-label="Chargement"
    >
      <div
        style={{
          width: 32,
          height: 32,
          border: `3px solid ${C.prussianBg}`,
          borderTopColor: C.prussian,
          borderRadius: "50%",
          animation: "spin 0.8s linear infinite",
        }}
      />
    </div>
  );
}
