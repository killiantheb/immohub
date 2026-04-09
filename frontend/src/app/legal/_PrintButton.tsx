"use client";
export default function PrintButton() {
  return (
    <button
      onClick={() => window.print()}
      style={{ padding: "6px 14px", borderRadius: 8, border: "1px solid #E8E4DC", background: "#fff", color: "#7A7469", fontSize: 12, fontWeight: 500, cursor: "pointer", display: "flex", alignItems: "center", gap: 5 }}
    >
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="6 9 6 2 18 2 18 9"/><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><rect x="6" y="14" width="12" height="8"/></svg>
      Imprimer / PDF
    </button>
  );
}
