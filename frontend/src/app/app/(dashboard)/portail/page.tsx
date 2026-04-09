"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { PlusCircle, Trash2, Users2, Eye } from "lucide-react";

const S = {
  surface: "var(--althy-surface)",
  border:  "var(--althy-border)",
  text:    "var(--althy-text)",
  text2:   "var(--althy-text-2)",
  text3:   "var(--althy-text-3)",
  orange:  "var(--althy-orange)",
  orangeBg:"var(--althy-orange-bg)",
  green:   "var(--althy-green)",
  greenBg: "var(--althy-green-bg)",
  shadow:  "var(--althy-shadow)",
} as const;

interface PortailUser {
  id: string;
  email: string;
  first_name: string;
  last_name: string;
  properties_count: number;
  created_at: string;
  sections: string[];
}

const AVAILABLE_SECTIONS = [
  { key: "biens",     label: "Biens" },
  { key: "finances",  label: "Finances" },
  { key: "documents", label: "Documents" },
];

export default function PortailPage() {
  const qc = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({
    email: "",
    first_name: "",
    last_name: "",
    sections: ["biens", "finances", "documents"] as string[],
  });

  const { data: users = [], isLoading } = useQuery<PortailUser[]>({
    queryKey: ["portail-users"],
    queryFn: () => api.get<PortailUser[]>("/portail").then(r => r.data),
  });

  const create = useMutation({
    mutationFn: () => api.post("/portail", form).then(r => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["portail-users"] });
      setShowForm(false);
      setForm({ email: "", first_name: "", last_name: "", sections: ["biens", "finances", "documents"] });
    },
  });

  const revoke = useMutation({
    mutationFn: (id: string) => api.delete(`/portail/${id}`).then(r => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["portail-users"] }),
  });

  const toggleSection = (key: string) => {
    setForm(prev => ({
      ...prev,
      sections: prev.sections.includes(key)
        ? prev.sections.filter(s => s !== key)
        : [...prev.sections, key],
    }));
  };

  return (
    <div style={{ maxWidth: 860, margin: "0 auto" }}>
      {/* Header */}
      <div style={{ marginBottom: 28, display: "flex", alignItems: "flex-start", justifyContent: "space-between", flexWrap: "wrap", gap: 12 }}>
        <div>
          <h1 style={{ fontFamily: "var(--font-serif)", fontSize: 28, fontWeight: 300, color: S.text, margin: "0 0 6px" }}>
            Portail Propriétaire
          </h1>
          <p style={{ color: S.text3, fontSize: 13.5, margin: 0 }}>
            Donnez accès à vos propriétaires · CHF 9/mois par portail
          </p>
        </div>
        <button
          onClick={() => setShowForm(v => !v)}
          style={{
            display: "flex", alignItems: "center", gap: 6,
            padding: "9px 18px", borderRadius: 9,
            background: S.orange, color: "white",
            fontWeight: 600, fontSize: 13, border: "none", cursor: "pointer",
          }}
        >
          <PlusCircle size={15} /> Créer un portail
        </button>
      </div>

      {/* Create form */}
      {showForm && (
        <div style={{
          background: S.surface, border: `1px solid ${S.border}`,
          borderRadius: 14, padding: 24, marginBottom: 24,
          boxShadow: S.shadow,
        }}>
          <h3 style={{ margin: "0 0 18px", fontSize: 15, fontWeight: 700, color: S.text }}>
            Nouveau portail propriétaire
          </h3>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 14 }}>
            {(["first_name", "last_name"] as const).map(field => (
              <div key={field}>
                <label style={{ fontSize: 12, color: S.text3, display: "block", marginBottom: 4 }}>
                  {field === "first_name" ? "Prénom" : "Nom"}
                </label>
                <input
                  value={form[field]}
                  onChange={e => setForm(p => ({ ...p, [field]: e.target.value }))}
                  style={{
                    width: "100%", padding: "9px 12px", borderRadius: 8,
                    border: `1px solid ${S.border}`, fontSize: 13.5,
                    outline: "none", boxSizing: "border-box",
                    color: S.text, background: "var(--althy-bg)",
                  }}
                />
              </div>
            ))}
          </div>

          <div style={{ marginBottom: 14 }}>
            <label style={{ fontSize: 12, color: S.text3, display: "block", marginBottom: 4 }}>Email</label>
            <input
              type="email"
              value={form.email}
              onChange={e => setForm(p => ({ ...p, email: e.target.value }))}
              style={{
                width: "100%", padding: "9px 12px", borderRadius: 8,
                border: `1px solid ${S.border}`, fontSize: 13.5,
                outline: "none", boxSizing: "border-box",
                color: S.text, background: "var(--althy-bg)",
              }}
            />
          </div>

          <div style={{ marginBottom: 20 }}>
            <label style={{ fontSize: 12, color: S.text3, display: "block", marginBottom: 8 }}>
              Sections accessibles
            </label>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              {AVAILABLE_SECTIONS.map(s => {
                const checked = form.sections.includes(s.key);
                return (
                  <button
                    key={s.key}
                    onClick={() => toggleSection(s.key)}
                    style={{
                      padding: "6px 14px", borderRadius: 20,
                      border: `1px solid ${checked ? S.orange : S.border}`,
                      background: checked ? S.orangeBg : "transparent",
                      color: checked ? S.orange : S.text3,
                      fontSize: 13, fontWeight: checked ? 600 : 400,
                      cursor: "pointer",
                    }}
                  >
                    {s.label}
                  </button>
                );
              })}
            </div>
          </div>

          <div style={{ display: "flex", gap: 10 }}>
            <button
              onClick={() => create.mutate()}
              disabled={create.isPending || !form.email || !form.first_name}
              style={{
                padding: "9px 20px", borderRadius: 8,
                background: S.orange, color: "white",
                fontWeight: 600, fontSize: 13, border: "none", cursor: "pointer",
                opacity: create.isPending ? 0.7 : 1,
              }}
            >
              {create.isPending ? "Création…" : "Créer & inviter"}
            </button>
            <button
              onClick={() => setShowForm(false)}
              style={{
                padding: "9px 20px", borderRadius: 8,
                background: "transparent", color: S.text3,
                fontWeight: 500, fontSize: 13,
                border: `1px solid ${S.border}`, cursor: "pointer",
              }}
            >
              Annuler
            </button>
          </div>
        </div>
      )}

      {/* Users list */}
      {isLoading ? (
        <div style={{ color: S.text3, fontSize: 13.5, padding: 20 }}>Chargement…</div>
      ) : users.length === 0 ? (
        <div style={{
          background: S.surface, border: `1px solid ${S.border}`,
          borderRadius: 14, padding: "40px 24px",
          textAlign: "center", boxShadow: S.shadow,
        }}>
          <Users2 size={32} style={{ color: S.text3, marginBottom: 12 }} />
          <div style={{ fontSize: 15, fontWeight: 600, color: S.text, marginBottom: 6 }}>
            Aucun portail actif
          </div>
          <div style={{ fontSize: 13, color: S.text3 }}>
            Créez des accès portail pour vos propriétaires
          </div>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {users.map(u => (
            <div key={u.id} style={{
              background: S.surface, border: `1px solid ${S.border}`,
              borderRadius: 12, padding: "16px 20px",
              display: "flex", alignItems: "center", justifyContent: "space-between",
              boxShadow: S.shadow, gap: 16,
            }}>
              <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
                <div style={{
                  width: 38, height: 38, borderRadius: "50%",
                  background: S.orangeBg, color: S.orange,
                  display: "flex", alignItems: "center", justifyContent: "center",
                  fontWeight: 700, fontSize: 14, flexShrink: 0,
                }}>
                  {u.first_name?.[0]?.toUpperCase() ?? "?"}
                </div>
                <div>
                  <div style={{ fontSize: 14, fontWeight: 600, color: S.text }}>
                    {u.first_name} {u.last_name}
                  </div>
                  <div style={{ fontSize: 12.5, color: S.text3 }}>{u.email}</div>
                </div>
              </div>

              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <div style={{ display: "flex", gap: 6 }}>
                  {u.sections.map(s => (
                    <span key={s} style={{
                      fontSize: 11, padding: "2px 8px", borderRadius: 20,
                      background: S.greenBg, color: S.green, fontWeight: 600,
                    }}>
                      {AVAILABLE_SECTIONS.find(a => a.key === s)?.label ?? s}
                    </span>
                  ))}
                </div>
                <span style={{
                  fontSize: 11, padding: "2px 8px", borderRadius: 20,
                  background: "var(--althy-surface-2)", color: S.text3,
                }}>
                  {u.properties_count} bien{u.properties_count !== 1 ? "s" : ""}
                </span>
                <button
                  onClick={() => revoke.mutate(u.id)}
                  disabled={revoke.isPending}
                  title="Révoquer l'accès"
                  style={{
                    background: "none", border: "none", cursor: "pointer",
                    color: "#C0392B", padding: 4, borderRadius: 6,
                    display: "flex", alignItems: "center",
                    opacity: revoke.isPending ? 0.5 : 1,
                  }}
                >
                  <Trash2 size={14} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Pricing note */}
      <div style={{
        marginTop: 20, padding: "12px 16px", borderRadius: 10,
        background: S.orangeBg, border: `1px solid rgba(181,90,48,0.2)`,
        fontSize: 12.5, color: S.text2,
      }}>
        <Eye size={13} style={{ display: "inline", verticalAlign: "middle", marginRight: 6 }} />
        Chaque portail actif est facturé CHF 9/mois. Le propriétaire reçoit un email d&apos;invitation automatique.
      </div>
    </div>
  );
}
