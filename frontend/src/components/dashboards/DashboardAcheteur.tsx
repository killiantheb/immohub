// src/components/dashboards/DashboardAcheteur.tsx
"use client";

import Link from "next/link";
import {
  ArrowRight,
  Bell,
  Heart,
  Plus,
  Search,
  Star,
  TrendingUp,
} from "lucide-react";
import {
  DC,
  DCard,
  DKpi,
  DRoleHeader,
  DTopNav,
  DSectionTitle,
} from "@/components/dashboards/DashBoardShared";

// ── Mock data ─────────────────────────────────────────────────────────────────
const BIENS_EXCLUSIFS = [
  {
    id: 1,
    titre: "Villa contemporaine, Cologny",
    prix: "CHF 3.2M",
    surface: "280 m²",
    pieces: 6,
    dispo: "Avant-première · 48h",
    gradient: "135deg, #E8D8C4, #CCBA9C",
    exclusive: true,
  },
  {
    id: 2,
    titre: "Penthouse vue lac, Lausanne",
    prix: "CHF 1.85M",
    surface: "145 m²",
    pieces: 4,
    dispo: "Avant-première · 72h",
    gradient: "135deg, #C8D0E0, #98A8C8",
    exclusive: true,
  },
  {
    id: 3,
    titre: "Maison de maître, Nyon",
    prix: "CHF 2.1M",
    surface: "210 m²",
    pieces: 5,
    dispo: "En vente",
    gradient: "135deg, #C4D8C4, #9CC89C",
    exclusive: false,
  },
];

const ALERTES_ACTIVES = [
  { label: "Appartement 3-4p · Lausanne · < CHF 1.5M", count: 4 },
  { label: "Maison · Vaud · < CHF 2M",                 count: 7 },
];

// ══════════════════════════════════════════════════════════════════════════════
// DashboardAcheteur
// ══════════════════════════════════════════════════════════════════════════════
interface Props {
  firstName: string;
}

export function DashboardAcheteur({ firstName }: Props) {
  const initials = firstName ? firstName.slice(0, 2).toUpperCase() : "AC";

  return (
    <div style={{ minHeight: "100vh", background: DC.bg }}>
      <DTopNav />
          <DRoleHeader role="acheteur_premium" initials={initials} />

      {/* Greeting */}
      <div style={{ marginBottom: "2rem" }}>
        <h1
          style={{
            fontSize: 30,
            fontWeight: 400,
            fontFamily: DC.serif,
            color: DC.text,
            marginBottom: 4,
            letterSpacing: "0.01em",
          }}
        >
          Bonjour{firstName ? `, ${firstName}` : ""}
        </h1>
        <p style={{ fontSize: 14, color: DC.muted }}>
          {new Date().toLocaleDateString("fr-CH", {
            weekday: "long",
            day: "numeric",
            month: "long",
            year: "numeric",
          })}
        </p>
      </div>

      {/* 4 KPI cards */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(190px, 1fr))",
          gap: "1rem",
          marginBottom: "2rem",
        }}
      >
        <DKpi
          icon={TrendingUp}
          iconColor="#0E7490"
          iconBg="rgba(14,116,144,0.10)"
          value="CHF 2.5M"
          label="Budget max"
          sub="Configuré dans le profil"
          trend="neutral"
        />
        <DKpi
          icon={Star}
          iconColor={DC.orange}
          iconBg="rgba(232,96,44,0.10)"
          value="3"
          label="Avant-premières"
          sub="Accès exclusif 48-72h"
          trend="up"
        />
        <DKpi
          icon={Heart}
          iconColor="var(--althy-red)"
          iconBg="var(--althy-red-bg)"
          value="8"
          label="Favoris"
          sub="Biens sauvegardés"
          trend="neutral"
        />
        <DKpi
          icon={Bell}
          iconColor="var(--althy-green)"
          iconBg="var(--althy-green-bg)"
          value="1"
          label="Offres en cours"
          sub="En négociation"
          trend="up"
        />
      </div>

      {/* Biens exclusifs */}
      <div style={{ marginBottom: "2rem" }}>
        <DSectionTitle>Biens exclusifs — Avant-premières</DSectionTitle>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))",
            gap: "1rem",
          }}
        >
          {BIENS_EXCLUSIFS.map((bien) => (
            <DCard key={bien.id} style={{ padding: 0, overflow: "hidden" }}>
              {/* Gradient image placeholder */}
              <div
                style={{
                  height: 140,
                  background: `linear-gradient(${bien.gradient})`,
                  position: "relative",
                  display: "flex",
                  alignItems: "flex-start",
                  justifyContent: "flex-end",
                  padding: "12px",
                }}
              >
                <span
                  style={{
                    fontSize: 11,
                    fontWeight: 700,
                    padding: "3px 10px",
                    borderRadius: 20,
                    background: bien.exclusive ? "var(--althy-red)" : "var(--althy-green)",
                    color: "#fff",
                  }}
                >
                  {bien.dispo}
                </span>
              </div>

              {/* Content */}
              <div style={{ padding: "1rem" }}>
                <p
                  style={{
                    fontSize: 14,
                    fontWeight: 700,
                    color: DC.text,
                    marginBottom: 4,
                  }}
                >
                  {bien.titre}
                </p>
                <p
                  style={{
                    fontSize: 16,
                    fontWeight: 800,
                    color: DC.orange,
                    marginBottom: 4,
                    fontFamily: DC.serif,
                  }}
                >
                  {bien.prix}
                </p>
                <p style={{ fontSize: 12, color: DC.muted, marginBottom: "1rem" }}>
                  {bien.surface} · {bien.pieces} pièces
                </p>
                <Link
                  href="/app/biens"
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: 6,
                    padding: "8px 0",
                    borderRadius: 10,
                    background: DC.orange,
                    color: "#fff",
                    fontSize: 12,
                    fontWeight: 700,
                    textDecoration: "none",
                  }}
                >
                  Voir le bien <ArrowRight size={12} />
                </Link>
              </div>
            </DCard>
          ))}
        </div>
      </div>

      {/* Alertes actives */}
      <div style={{ marginBottom: "2rem" }}>
        <DSectionTitle>Alertes actives</DSectionTitle>
        <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
          {ALERTES_ACTIVES.map((alerte, i) => (
            <DCard
              key={i}
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: 12,
                flexWrap: "wrap",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <Bell size={15} style={{ color: DC.orange, flexShrink: 0 }} />
                <p style={{ fontSize: 13, color: DC.text }}>{alerte.label}</p>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <span
                  style={{
                    fontSize: 11,
                    fontWeight: 700,
                    padding: "2px 9px",
                    borderRadius: 20,
                    color: "var(--althy-green)",
                    background: "var(--althy-green-bg)",
                  }}
                >
                  {alerte.count} correspondance{alerte.count > 1 ? "s" : ""}
                </span>
                <Link
                  href="/app/biens"
                  style={{
                    fontSize: 12,
                    color: DC.orange,
                    textDecoration: "none",
                    fontWeight: 600,
                  }}
                >
                  Modifier
                </Link>
              </div>
            </DCard>
          ))}
        </div>
      </div>

      {/* Créer une alerte */}
      <div style={{ marginBottom: "2rem" }}>
        <DSectionTitle>Créer une alerte</DSectionTitle>
        <DCard
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 16,
            flexWrap: "wrap",
          }}
        >
          <div>
            <p style={{ fontSize: 15, fontWeight: 600, color: DC.text, marginBottom: 4 }}>
              Recevez les avant-premières en priorité
            </p>
            <p style={{ fontSize: 13, color: DC.muted }}>
              Définissez vos critères — zone, prix, surface, pièces. Althy vous
              alerte avant la mise sur le marché.
            </p>
          </div>
          <Link
            href="/app/biens"
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
              padding: "10px 20px",
              borderRadius: 10,
              background: DC.orange,
              color: "#fff",
              fontSize: 13,
              fontWeight: 700,
              textDecoration: "none",
              flexShrink: 0,
            }}
          >
            <Plus size={14} />
            Créer une alerte
          </Link>
        </DCard>
      </div>
    </div>
  );
}
