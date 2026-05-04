"use client";

/**
 * TabSection — pattern card pour sous-sections d'un tab (PR-A11.A.6.h).
 *
 * Hiérarchie visuelle Option A : chaque sous-section d'un tab devient
 * une card autonome (background subtil bleu pâle, border 1px gris,
 * padding 24px, border-radius 8px). Header avec titre Fraunces + séparateur
 * subtil + description optionnelle.
 *
 * Aligné `docs/3-ARCHITECTURE.md` §3.6 (DA scientifique — hiérarchie
 * visuelle forte, pattern cards) et §3.12 (tokens C.* exclusivement,
 * jamais d'hex direct).
 *
 * Espacement entre cards : géré par le parent via `gap` flex/grid,
 * cohérent avec le pattern `tabContentStyle.gap: 32px` du sprint 6.f.
 */

import { C } from "@/lib/design-tokens";

interface Props {
  title: string;
  description?: string;
  children: React.ReactNode;
}

export function TabSection({ title, description, children }: Props) {
  return (
    <section style={cardStyle}>
      <header style={headerStyle}>
        <h3 style={titleStyle}>{title}</h3>
        {description && <p style={descriptionStyle}>{description}</p>}
      </header>
      <div>{children}</div>
    </section>
  );
}

const cardStyle: React.CSSProperties = {
  background: C.surface2,
  border: `1px solid ${C.border}`,
  borderRadius: 12,
  padding: 24,
};

const headerStyle: React.CSSProperties = {
  marginBottom: 20,
  paddingBottom: 14,
  borderBottom: `1px solid ${C.border}`,
};

const titleStyle: React.CSSProperties = {
  fontFamily: "var(--font-serif)",
  fontSize: 18,
  fontWeight: 400,
  color: C.prussian,
  margin: 0,
  lineHeight: 1.35,
};

const descriptionStyle: React.CSSProperties = {
  fontSize: 13,
  color: C.text2,
  margin: "6px 0 0",
  lineHeight: 1.55,
};
