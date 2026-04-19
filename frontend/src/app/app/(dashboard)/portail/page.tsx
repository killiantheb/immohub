"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { PlusCircle, Trash2, Users2, Eye, Link2, MessageSquare, Send, CheckCircle2 } from "lucide-react";

const S = {
  bg:      "var(--cream)",
  surface: "var(--background-card)",
  surface2:"var(--althy-surface-2)",
  border:  "var(--border-subtle)",
  text:    "var(--charcoal)",
  text2:   "var(--text-secondary)",
  text3:   "var(--text-tertiary)",
  orange:  "var(--terracotta-primary)",
  orangeBg:"var(--althy-orange-bg)",
  amber:   "var(--althy-amber)",
  amberBg: "var(--althy-amber-bg)",
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

interface Invitation {
  id: string;
  proprio_email: string;
  proprio_name: string | null;
  bien_id: string | null;
  token: string;
  inv_status: string;
  created_at: string;
}

interface PortailMessage {
  id: string;
  sender_type: string;
  content: string;
  created_at: string;
}

function InvitationsTab() {
  const qc = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ proprio_email: "", proprio_name: "", bien_id: "" });
  const [selectedInv, setSelectedInv] = useState<Invitation | null>(null);
  const [newMessage, setNewMessage] = useState("");

  const { data, isLoading } = useQuery<{ items: Invitation[] }>({
    queryKey: ["portail-invitations"],
    queryFn: () => api.get<{ items: Invitation[] }>("/portail/invitations").then(r => r.data),
  });

  const createInv = useMutation({
    mutationFn: () => api.post("/portail/invitations", { ...form, bien_id: form.bien_id || null }).then(r => r.data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["portail-invitations"] }); setShowForm(false); setForm({ proprio_email: "", proprio_name: "", bien_id: "" }); },
  });

  const { data: messagesData } = useQuery<{ items: PortailMessage[] }>({
    queryKey: ["portail-messages", selectedInv?.id],
    queryFn: () => api.get<{ items: PortailMessage[] }>(`/portail/messages/${selectedInv!.id}`).then(r => r.data),
    enabled: !!selectedInv,
    refetchInterval: 5000,
  });

  const sendMsg = useMutation({
    mutationFn: (content: string) => api.post(`/portail/messages/${selectedInv!.id}`, { content }).then(r => r.data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["portail-messages", selectedInv?.id] }); setNewMessage(""); },
  });

  const invitations = data?.items ?? [];
  const messages = messagesData?.items ?? [];

  if (selectedInv) {
    return (
      <div>
        <button onClick={() => setSelectedInv(null)} style={{ display: "flex", alignItems: "center", gap: 6, background: "none", border: "none", color: S.text3, fontSize: 13, cursor: "pointer", marginBottom: 16 }}>← Retour</button>
        <div style={{ backgroundColor: S.surface, border: `1px solid ${S.border}`, borderRadius: 14, overflow: "hidden" }}>
          <div style={{ padding: "14px 18px", borderBottom: `1px solid ${S.border}`, backgroundColor: S.surface2 }}>
            <div style={{ fontSize: 14, fontWeight: 700, color: S.text }}>{selectedInv.proprio_name ?? selectedInv.proprio_email}</div>
            <div style={{ fontSize: 12, color: S.text3 }}>
              Portail : <code style={{ fontSize: 11, backgroundColor: S.bg, padding: "1px 6px", borderRadius: 4 }}>/portail/{selectedInv.token}</code>
              <button onClick={() => navigator.clipboard.writeText(`${window.location.origin}/portail/${selectedInv.token}`)} style={{ marginLeft: 8, padding: "2px 8px", border: `1px solid ${S.border}`, borderRadius: 6, fontSize: 11, backgroundColor: "transparent", color: S.text3, cursor: "pointer" }}>Copier le lien</button>
            </div>
          </div>
          {/* Messages */}
          <div style={{ padding: 16, minHeight: 200, maxHeight: 360, overflowY: "auto", display: "flex", flexDirection: "column", gap: 8 }}>
            {messages.length === 0 && <div style={{ textAlign: "center", padding: "30px 0", color: S.text3, fontSize: 13 }}>Aucun message pour l&apos;instant</div>}
            {messages.map(m => (
              <div key={m.id} style={{ display: "flex", justifyContent: m.sender_type === "agency" ? "flex-end" : "flex-start" }}>
                <div style={{
                  maxWidth: "70%", padding: "8px 12px", borderRadius: m.sender_type === "agency" ? "12px 12px 4px 12px" : "12px 12px 12px 4px",
                  backgroundColor: m.sender_type === "agency" ? S.orange : m.sender_type === "ai" ? S.amberBg : S.surface2,
                  color: m.sender_type === "agency" ? "#fff" : S.text,
                  fontSize: 13, lineHeight: 1.5,
                }}>
                  {m.sender_type === "ai" && <div style={{ fontSize: 10, fontWeight: 700, color: S.amber, marginBottom: 3 }}>✨ Althy IA</div>}
                  {m.content}
                </div>
              </div>
            ))}
          </div>
          {/* Input */}
          <div style={{ padding: "12px 16px", borderTop: `1px solid ${S.border}`, display: "flex", gap: 8 }}>
            <input
              value={newMessage}
              onChange={e => setNewMessage(e.target.value)}
              onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey && newMessage.trim()) { e.preventDefault(); sendMsg.mutate(newMessage.trim()); } }}
              placeholder="Votre message…"
              style={{ flex: 1, padding: "9px 12px", border: `1px solid ${S.border}`, borderRadius: 9, fontSize: 13, outline: "none", backgroundColor: S.surface2, color: S.text }}
            />
            <button onClick={() => newMessage.trim() && sendMsg.mutate(newMessage.trim())} disabled={sendMsg.isPending || !newMessage.trim()}
              style={{ padding: "9px 14px", backgroundColor: S.orange, color: "#fff", border: "none", borderRadius: 9, cursor: "pointer" }}>
              <Send size={14} />
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20 }}>
        <p style={{ margin: 0, fontSize: 13, color: S.text3 }}>Invitations token CHF 9/mois — le proprio accède à son portail sans créer de compte.</p>
        <button onClick={() => setShowForm(v => !v)} style={{ display: "flex", alignItems: "center", gap: 6, padding: "8px 16px", backgroundColor: S.orange, color: "#fff", border: "none", borderRadius: 9, fontSize: 13, fontWeight: 600, cursor: "pointer" }}>
          <PlusCircle size={14} /> Inviter un proprio
        </button>
      </div>

      {showForm && (
        <div style={{ backgroundColor: S.surface, border: `1px solid ${S.border}`, borderRadius: 14, padding: 20, marginBottom: 20 }}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 12 }}>
            {[
              { key: "proprio_email", label: "Email", placeholder: "proprio@email.ch", col: "1/3" },
              { key: "proprio_name",  label: "Nom (optionnel)", placeholder: "Jean Dupont" },
              { key: "bien_id",       label: "ID Bien (optionnel)", placeholder: "UUID du bien" },
            ].map(({ key, label, placeholder, col }) => (
              <div key={key} style={{ gridColumn: col ?? "auto" }}>
                <label style={{ display: "block", fontSize: 11, fontWeight: 600, color: S.text3, marginBottom: 4, textTransform: "uppercase", letterSpacing: "0.06em" }}>{label}</label>
                <input value={(form as Record<string, string>)[key]} onChange={e => setForm(p => ({ ...p, [key]: e.target.value }))} placeholder={placeholder}
                  style={{ width: "100%", padding: "9px 12px", border: `1px solid ${S.border}`, borderRadius: 8, fontSize: 13, backgroundColor: S.bg, color: S.text, outline: "none", boxSizing: "border-box" }}
                />
              </div>
            ))}
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <button onClick={() => createInv.mutate()} disabled={!form.proprio_email || createInv.isPending}
              style={{ padding: "9px 18px", backgroundColor: S.orange, color: "#fff", border: "none", borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: "pointer" }}>
              {createInv.isPending ? "Création…" : "Créer l'invitation"}
            </button>
            <button onClick={() => setShowForm(false)} style={{ padding: "9px 18px", border: `1px solid ${S.border}`, borderRadius: 8, backgroundColor: "transparent", color: S.text3, fontSize: 13, cursor: "pointer" }}>Annuler</button>
          </div>
        </div>
      )}

      {isLoading ? (
        <div style={{ textAlign: "center", padding: 30, color: S.text3 }}>Chargement…</div>
      ) : invitations.length === 0 ? (
        <div style={{ textAlign: "center", padding: "40px 20px", backgroundColor: S.surface, border: `1px solid ${S.border}`, borderRadius: 14 }}>
          <Link2 size={28} style={{ color: S.text3, marginBottom: 10 }} />
          <div style={{ fontSize: 14, fontWeight: 600, color: S.text, marginBottom: 4 }}>Aucune invitation envoyée</div>
          <div style={{ fontSize: 13, color: S.text3 }}>Invitez vos propriétaires mandants pour leur donner accès à leur portail.</div>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {invitations.map(inv => (
            <div key={inv.id} style={{ backgroundColor: S.surface, border: `1px solid ${S.border}`, borderRadius: 12, padding: "14px 18px", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
              <div>
                <div style={{ fontSize: 14, fontWeight: 600, color: S.text }}>{inv.proprio_name ?? inv.proprio_email}</div>
                <div style={{ fontSize: 12, color: S.text3 }}>{inv.proprio_email}</div>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span style={{ padding: "2px 8px", borderRadius: 20, fontSize: 10.5, fontWeight: 600, backgroundColor: inv.inv_status === "active" ? S.greenBg : S.surface2, color: inv.inv_status === "active" ? S.green : S.text3 }}>
                  {inv.inv_status === "active" ? <><CheckCircle2 size={10} style={{ display: "inline", marginRight: 3 }} />Actif</> : "En attente"}
                </span>
                <button onClick={() => setSelectedInv(inv)} style={{ display: "flex", alignItems: "center", gap: 4, padding: "6px 12px", border: `1px solid ${S.border}`, borderRadius: 8, backgroundColor: "transparent", color: S.text2, fontSize: 12, fontWeight: 600, cursor: "pointer" }}>
                  <MessageSquare size={12} /> Canal
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default function PortailPage() {
  const qc = useQueryClient();
  const [activeTab, setActiveTab] = useState<"comptes" | "invitations">("invitations");
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
      </div>

      {/* Tabs */}
      <div style={{ display: "flex", gap: 2, borderBottom: `1px solid ${S.border}`, marginBottom: 24 }}>
        {([
          { id: "invitations", label: "Invitations proprio", icon: <Link2 size={13} /> },
          { id: "comptes",     label: "Comptes Supabase",    icon: <Users2 size={13} /> },
        ] as const).map(t => (
          <button key={t.id} onClick={() => setActiveTab(t.id)} style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "10px 16px", background: "none", border: "none", borderBottom: `2px solid ${activeTab === t.id ? S.orange : "transparent"}`, color: activeTab === t.id ? S.orange : S.text3, fontWeight: activeTab === t.id ? 700 : 500, fontSize: 13, cursor: "pointer" }}>
            {t.icon}{t.label}
          </button>
        ))}
      </div>

      {activeTab === "invitations" && <InvitationsTab />}

      {activeTab === "comptes" && <>

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
                    color: S.text, background: "var(--cream)",
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
                color: S.text, background: "var(--cream)",
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
                    color: "var(--althy-red)", padding: 4, borderRadius: 6,
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
      </>}
    </div>
  );
}
