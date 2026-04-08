"use client";

import { useRole } from "@/lib/hooks/useRole";
import { useAuthStore } from "@/lib/store/authStore";
import { useUser } from "@/lib/auth";
import Link from "next/link";

const T  = "#1C0F06";
const T3 = "rgba(80,35,8,0.32)";
const O  = "#D4601A";
const O20 = "rgba(212,96,26,0.20)";

function QuickCard({ icon, label, href, desc }: { icon: string; label: string; href: string; desc: string }) {
  return (
    <Link href={href} style={{
      display: "flex", flexDirection: "column", gap: 8, padding: "20px",
      background: "#fff", borderRadius: 16, border: `0.5px solid ${O20}`,
      textDecoration: "none", transition: "box-shadow 0.15s",
    }}>
      <span style={{ fontSize: 24 }}>{icon}</span>
      <span style={{ fontSize: 14, fontWeight: 500, color: T }}>{label}</span>
      <span style={{ fontSize: 12, color: T3, lineHeight: 1.4 }}>{desc}</span>
    </Link>
  );
}

const QUICK_BY_ROLE: Record<string, Array<{ icon: string; label: string; href: string; desc: string }>> = {
  owner: [
    { icon: "🏠", label: "Mes biens",       href: "/app/biens",         desc: "Gérer votre parc immobilier" },
    { icon: "💶", label: "Finances",         href: "/app/finances",      desc: "Loyers, transactions, comptabilité" },
    { icon: "🔧", label: "Interventions",    href: "/app/interventions", desc: "Appels d'offre et travaux" },
    { icon: "👥", label: "CRM",              href: "/app/crm",           desc: "Contacts, locataires, prospects" },
  ],
  agency: [
    { icon: "🏠", label: "Biens",            href: "/app/biens",             desc: "Gérer le parc immobilier" },
    { icon: "📍", label: "Ouvreurs",          href: "/app/ouvreurs",          desc: "Missions et planification" },
    { icon: "📢", label: "Publications",     href: "/app/publications/new",  desc: "Publier une mission ou un devis" },
    { icon: "👥", label: "CRM",              href: "/app/crm",               desc: "Contacts et prospects" },
  ],
  opener: [
    { icon: "📍", label: "Mes missions",     href: "/app/ouvreurs/missions", desc: "Voir et accepter les missions" },
    { icon: "💶", label: "Mes revenus",      href: "/app/ouvreurs/revenus",  desc: "Suivi de vos gains" },
    { icon: "📋", label: "Historique",       href: "/app/ouvreurs/historique", desc: "Missions passées" },
  ],
  tenant: [
    { icon: "🏠", label: "Mon logement",     href: "/app/biens",         desc: "Voir les infos de votre bien" },
    { icon: "💶", label: "Quittances",       href: "/app/finances",      desc: "Vos quittances de loyer" },
    { icon: "🔔", label: "Signalement",      href: "/app/interventions", desc: "Signaler un problème" },
  ],
  company: [
    { icon: "🏗️", label: "Mes chantiers",   href: "/app/artisans/chantiers", desc: "Chantiers en cours" },
    { icon: "📄", label: "Mes devis",        href: "/app/artisans/devis",     desc: "Devis soumis et en attente" },
    { icon: "💶", label: "Paiements",        href: "/app/artisans/paiements", desc: "Suivi de vos paiements" },
  ],
  super_admin: [
    { icon: "🏠", label: "Biens",            href: "/app/biens",         desc: "Tous les biens" },
    { icon: "👤", label: "Admin",            href: "/app/admin",         desc: "Gestion utilisateurs et stats" },
    { icon: "💶", label: "Finances",         href: "/app/finances",      desc: "Toutes les transactions" },
    { icon: "👥", label: "CRM",              href: "/app/crm",           desc: "CRM global" },
  ],
};

export default function DashboardHome() {
  const { role, label } = useRole();
  const { user } = useAuthStore();
  const { data: profile } = useUser();

  const firstName = profile?.first_name ?? user?.user_metadata?.first_name ?? "vous";
  const quickLinks = (role && QUICK_BY_ROLE[role]) ?? QUICK_BY_ROLE.owner;

  return (
    <div>
      {/* Header */}
      <div style={{ marginBottom: "2rem" }}>
        <p style={{ fontSize: 11, letterSpacing: "2px", textTransform: "uppercase", color: T3, marginBottom: 6 }}>
          {label}
        </p>
        <h1 style={{ fontFamily: "var(--font-serif)", fontSize: 32, fontWeight: 300, color: T, letterSpacing: "0.5px" }}>
          Bonjour, {firstName} 👋
        </h1>
        <p style={{ fontSize: 13, color: T3, marginTop: 6 }}>
          Bienvenue sur votre espace Althy.
        </p>
      </div>

      {/* Quick access */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))", gap: 14, marginBottom: "2.5rem" }}>
        {quickLinks.map(q => <QuickCard key={q.href} {...q} />)}
      </div>

      {/* Althy IA shortcut */}
      <Link href="/app/advisor" style={{
        display: "flex", alignItems: "center", gap: 16, padding: "20px 24px",
        background: "linear-gradient(135deg, rgba(212,96,26,0.08) 0%, rgba(212,96,26,0.04) 100%)",
        border: `0.5px solid ${O20}`, borderRadius: 16, textDecoration: "none",
      }}>
        <span style={{ fontSize: 28 }}>✦</span>
        <div>
          <div style={{ fontSize: 14, fontWeight: 500, color: O }}>Althy IA</div>
          <div style={{ fontSize: 12, color: T3 }}>Posez une question, dictez une action ou demandez une analyse.</div>
        </div>
        <span style={{ marginLeft: "auto", fontSize: 18, color: "rgba(212,96,26,0.4)" }}>→</span>
      </Link>
    </div>
  );
}
