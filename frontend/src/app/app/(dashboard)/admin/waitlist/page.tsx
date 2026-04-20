"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Download, Send, Loader2, Users } from "lucide-react";
import { api } from "@/lib/api";
import { C } from "@/lib/design-tokens";

type WaitlistStats = {
  total: number;
  by_role: Record<string, number>;
  pending_notification: number;
};

type WaitlistItem = {
  id: string;
  email: string;
  role: string;
  source: string | null;
  created_at: string;
  notified_at: string | null;
  converted_user_id: string | null;
};

type WaitlistPage = {
  items: WaitlistItem[];
  total: number;
  page: number;
  size: number;
};

const ROLE_LABELS: Record<string, string> = {
  artisan: "Artisan",
  ouvreur: "Ouvreur",
  expert: "Expert",
  hunter: "Hunter",
  acheteur_premium: "Acheteur Premium",
  agence: "Agence",
  portail_proprio: "Portail Proprio",
  other: "Autre",
};

const ROLE_FILTERS = [
  { value: "", label: "Tous les rôles" },
  ...Object.entries(ROLE_LABELS).map(([value, label]) => ({ value, label })),
];

function formatDate(iso: string): string {
  if (!iso) return "—";
  const d = new Date(iso);
  return d.toLocaleDateString("fr-CH", { day: "2-digit", month: "2-digit", year: "numeric" });
}

function toCSV(items: WaitlistItem[]): string {
  const header = ["email", "role", "source", "created_at", "notified_at"];
  const rows = items.map(i => [
    i.email,
    i.role,
    i.source ?? "",
    i.created_at,
    i.notified_at ?? "",
  ]);
  return [header, ...rows]
    .map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(","))
    .join("\n");
}

export default function AdminWaitlistPage() {
  const [role, setRole] = useState<string>("");
  const [page, setPage] = useState(1);
  const size = 50;
  const [notifyTarget, setNotifyTarget] = useState<WaitlistItem | null>(null);

  const statsQ = useQuery({
    queryKey: ["admin-waitlist-stats"],
    queryFn: async (): Promise<WaitlistStats> =>
      (await api.get("/waitlist/stats")).data,
  });

  const listQ = useQuery({
    queryKey: ["admin-waitlist", role, page],
    queryFn: async (): Promise<WaitlistPage> =>
      (await api.get("/waitlist", { params: { role: role || undefined, page, size } })).data,
    placeholderData: (prev) => prev,
  });

  const exportCSV = () => {
    if (!listQ.data) return;
    const csv = toCSV(listQ.data.items);
    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `waitlist${role ? "-" + role : ""}-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const totalPages = listQ.data ? Math.max(1, Math.ceil(listQ.data.total / size)) : 1;

  return (
    <div style={{ maxWidth: 1200, margin: "0 auto", padding: "24px" }}>
      <Link
        href="/app/admin"
        style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 13, color: C.text3, textDecoration: "none", marginBottom: 16 }}
      >
        <ArrowLeft size={14} /> Admin
      </Link>

      <h1 style={{ fontFamily: "var(--font-serif)", fontSize: 28, fontWeight: 400, color: C.text, margin: "0 0 8px" }}>
        Waitlist
      </h1>
      <p style={{ color: C.textMuted, fontSize: 14, margin: "0 0 24px" }}>
        Emails collectés via les pages <code>/bientot/[role]</code>.
      </p>

      {/* Stats par rôle */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(160px, 1fr))", gap: 12, marginBottom: 24 }}>
        <StatCard label="Total" value={statsQ.data?.total} accent={C.prussian} icon={<Users size={16} />} />
        <StatCard label="À notifier" value={statsQ.data?.pending_notification} accent={C.gold} />
        {statsQ.data && Object.entries(statsQ.data.by_role)
          .sort((a, b) => b[1] - a[1])
          .map(([r, n]) => (
            <StatCard key={r} label={ROLE_LABELS[r] ?? r} value={n} />
          ))}
      </div>

      {/* Controls */}
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 16, flexWrap: "wrap" }}>
        <select
          value={role}
          onChange={(e) => { setRole(e.target.value); setPage(1); }}
          style={{ padding: "8px 12px", borderRadius: 8, border: `1px solid ${C.border}`, fontSize: 14, background: C.surface, color: C.text }}
        >
          {ROLE_FILTERS.map(f => (
            <option key={f.value} value={f.value}>{f.label}</option>
          ))}
        </select>

        <button
          onClick={exportCSV}
          disabled={!listQ.data || listQ.data.items.length === 0}
          style={{
            display: "inline-flex", alignItems: "center", gap: 6,
            padding: "8px 14px", borderRadius: 8,
            background: C.surface, color: C.text, border: `1px solid ${C.border}`,
            fontSize: 14, fontWeight: 500, cursor: "pointer",
          }}
        >
          <Download size={14} /> Exporter CSV
        </button>

        <div style={{ marginLeft: "auto", color: C.textMuted, fontSize: 13 }}>
          {listQ.data ? `${listQ.data.total} entrée${listQ.data.total > 1 ? "s" : ""}` : null}
        </div>
      </div>

      {/* Table */}
      <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 12, overflow: "hidden" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 14 }}>
          <thead>
            <tr style={{ background: C.surface2, color: C.text2 }}>
              <Th>Email</Th>
              <Th>Rôle</Th>
              <Th>Source</Th>
              <Th>Inscrit</Th>
              <Th>Notifié</Th>
              <Th>Action</Th>
            </tr>
          </thead>
          <tbody>
            {listQ.isLoading && (
              <tr><td colSpan={6} style={{ padding: 32, textAlign: "center", color: C.textMuted }}>
                <Loader2 size={16} className="animate-spin" /> Chargement…
              </td></tr>
            )}
            {!listQ.isLoading && listQ.data?.items.length === 0 && (
              <tr><td colSpan={6} style={{ padding: 32, textAlign: "center", color: C.textMuted }}>
                Aucune entrée.
              </td></tr>
            )}
            {listQ.data?.items.map(item => (
              <tr key={item.id} style={{ borderTop: `1px solid ${C.border}` }}>
                <Td><span style={{ color: C.text, fontWeight: 500 }}>{item.email}</span></Td>
                <Td><RoleBadge role={item.role} /></Td>
                <Td><span style={{ color: C.textMuted, fontSize: 13 }}>{item.source ?? "—"}</span></Td>
                <Td>{formatDate(item.created_at)}</Td>
                <Td>
                  {item.notified_at ? (
                    <span style={{ color: C.green, fontSize: 13 }}>{formatDate(item.notified_at)}</span>
                  ) : (
                    <span style={{ color: C.textMuted, fontSize: 13 }}>—</span>
                  )}
                </Td>
                <Td>
                  <button
                    onClick={() => setNotifyTarget(item)}
                    style={{
                      display: "inline-flex", alignItems: "center", gap: 4,
                      padding: "4px 10px", borderRadius: 6,
                      background: "transparent", border: `1px solid ${C.border}`,
                      color: C.text, fontSize: 12, cursor: "pointer",
                    }}
                  >
                    <Send size={12} /> Notifier
                  </button>
                </Td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {listQ.data && listQ.data.total > size && (
        <div style={{ display: "flex", justifyContent: "center", alignItems: "center", gap: 12, marginTop: 16 }}>
          <button
            onClick={() => setPage(p => Math.max(1, p - 1))}
            disabled={page <= 1}
            style={{ padding: "6px 12px", borderRadius: 6, background: C.surface, border: `1px solid ${C.border}`, color: C.text, fontSize: 13, cursor: page <= 1 ? "not-allowed" : "pointer", opacity: page <= 1 ? 0.5 : 1 }}
          >
            ← Précédent
          </button>
          <span style={{ color: C.textMuted, fontSize: 13 }}>
            Page {page} / {totalPages}
          </span>
          <button
            onClick={() => setPage(p => p + 1)}
            disabled={page >= totalPages}
            style={{ padding: "6px 12px", borderRadius: 6, background: C.surface, border: `1px solid ${C.border}`, color: C.text, fontSize: 13, cursor: page >= totalPages ? "not-allowed" : "pointer", opacity: page >= totalPages ? 0.5 : 1 }}
          >
            Suivant →
          </button>
        </div>
      )}

      {notifyTarget && (
        <NotifyModal
          target={notifyTarget}
          onClose={() => setNotifyTarget(null)}
        />
      )}
    </div>
  );
}

function StatCard({ label, value, accent, icon }: { label: string; value: number | undefined; accent?: string; icon?: React.ReactNode }) {
  return (
    <div style={{
      background: C.surface, border: `1px solid ${C.border}`, borderRadius: 10,
      padding: "12px 14px",
    }}>
      <div style={{ fontSize: 12, color: C.textMuted, marginBottom: 4, display: "flex", alignItems: "center", gap: 4 }}>
        {icon} {label}
      </div>
      <div style={{ fontSize: 22, fontWeight: 700, color: accent ?? C.text, fontFamily: "var(--font-serif)" }}>
        {value ?? "—"}
      </div>
    </div>
  );
}

function RoleBadge({ role }: { role: string }) {
  return (
    <span style={{
      display: "inline-block", padding: "2px 8px", borderRadius: 999,
      fontSize: 12, fontWeight: 500,
      background: C.prussianBg, color: C.prussian,
    }}>
      {ROLE_LABELS[role] ?? role}
    </span>
  );
}

function Th({ children }: { children: React.ReactNode }) {
  return <th style={{ textAlign: "left", padding: "10px 14px", fontSize: 12, fontWeight: 600, letterSpacing: "0.04em", textTransform: "uppercase" }}>{children}</th>;
}

function Td({ children }: { children: React.ReactNode }) {
  return <td style={{ padding: "10px 14px", verticalAlign: "middle" }}>{children}</td>;
}

// ── Notify modal ──────────────────────────────────────────────────────────────

function NotifyModal({ target, onClose }: { target: WaitlistItem; onClose: () => void }) {
  const qc = useQueryClient();
  const [subject, setSubject] = useState(`Althy — ${ROLE_LABELS[target.role] ?? target.role} est disponible`);
  const defaultHTML = useMemo(() => (
    `<div style="font-family:system-ui,sans-serif;max-width:560px;padding:24px;color:#1A1208">
  <h2 style="color:#0F2E4C;font-weight:400">Bonne nouvelle.</h2>
  <p style="color:#475569;line-height:1.6">
    L'espace ${ROLE_LABELS[target.role] ?? target.role} est désormais ouvert sur Althy.
    Activez votre compte dès maintenant :
  </p>
  <p style="margin:24px 0">
    <a href="https://althy.ch/register" style="display:inline-block;background:#0F2E4C;color:#fff;padding:10px 18px;border-radius:999px;text-decoration:none;font-weight:600">
      Créer mon compte
    </a>
  </p>
</div>`
  ), [target.role]);
  const [html, setHtml] = useState(defaultHTML);

  const notify = useMutation({
    mutationFn: async () => (await api.post(`/waitlist/${target.id}/notify`, { subject, html })).data,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-waitlist"] });
      qc.invalidateQueries({ queryKey: ["admin-waitlist-stats"] });
      onClose();
    },
  });

  return (
    <div
      onClick={onClose}
      style={{
        position: "fixed", inset: 0, background: "rgba(15,23,42,0.35)",
        display: "flex", alignItems: "center", justifyContent: "center",
        zIndex: 50, padding: 16,
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: C.surface, borderRadius: 12, maxWidth: 640, width: "100%",
          padding: 24, boxShadow: "0 16px 48px rgba(0,0,0,0.15)",
          maxHeight: "90vh", overflow: "auto",
        }}
      >
        <h2 style={{ fontFamily: "var(--font-serif)", fontSize: 22, margin: "0 0 4px", color: C.text }}>
          Notifier {target.email}
        </h2>
        <p style={{ color: C.textMuted, fontSize: 13, margin: "0 0 20px" }}>
          Rôle : {ROLE_LABELS[target.role] ?? target.role}
        </p>

        <label style={{ display: "block", fontSize: 13, fontWeight: 600, color: C.text2, marginBottom: 6 }}>Sujet</label>
        <input
          value={subject}
          onChange={e => setSubject(e.target.value)}
          style={{ width: "100%", padding: "8px 12px", borderRadius: 8, border: `1px solid ${C.border}`, fontSize: 14, marginBottom: 16, boxSizing: "border-box" }}
        />

        <label style={{ display: "block", fontSize: 13, fontWeight: 600, color: C.text2, marginBottom: 6 }}>Message HTML</label>
        <textarea
          value={html}
          onChange={e => setHtml(e.target.value)}
          rows={10}
          style={{ width: "100%", padding: "10px 12px", borderRadius: 8, border: `1px solid ${C.border}`, fontSize: 13, fontFamily: "ui-monospace, monospace", boxSizing: "border-box", resize: "vertical" }}
        />

        {notify.isError && (
          <p style={{ color: "#b91c1c", fontSize: 13, marginTop: 12 }}>
            Envoi échoué. Vérifier la clé Resend.
          </p>
        )}

        <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 20 }}>
          <button
            onClick={onClose}
            disabled={notify.isPending}
            style={{ padding: "8px 14px", borderRadius: 8, background: "transparent", border: `1px solid ${C.border}`, color: C.text2, fontSize: 14, cursor: "pointer" }}
          >
            Annuler
          </button>
          <button
            onClick={() => notify.mutate()}
            disabled={notify.isPending || !subject.trim() || !html.trim()}
            style={{
              display: "inline-flex", alignItems: "center", gap: 6,
              padding: "8px 16px", borderRadius: 8,
              background: C.prussian, color: "#fff", border: "none",
              fontSize: 14, fontWeight: 600, cursor: "pointer",
              opacity: notify.isPending ? 0.7 : 1,
            }}
          >
            {notify.isPending ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
            Envoyer
          </button>
        </div>
      </div>
    </div>
  );
}
