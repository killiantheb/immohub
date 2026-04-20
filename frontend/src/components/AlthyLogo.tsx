import React from "react";

/**
 * Logo officiel Althy — le "A-toit".
 *
 * Un A stylisé dont les deux jambages forment la silhouette d'un toit de
 * maison. Barre horizontale centrale = plancher. Rectangle en bas = fondation.
 *
 * 4 variantes :
 *   - "full"     : monogramme + texte "althy" (défaut — headers, emails, PDFs)
 *   - "mark"     : monogramme seul (sidebar, avatars, favicons compacts)
 *   - "inverted" : fond sombre — stroke blanc + plancher/fondation en Or
 *   - "favicon"  : carré arrondi Bleu de Prusse, A-toit blanc, plancher Or
 *
 * `size` = hauteur en pixels (la largeur s'adapte au ratio).
 */

type AlthyLogoProps = {
  variant?: "full" | "mark" | "inverted" | "favicon";
  size?: number;
  className?: string;
  style?: React.CSSProperties;
};

export function AlthyLogo({
  variant = "full",
  size,
  className,
  style,
}: AlthyLogoProps) {
  if (variant === "mark") {
    const s = size ?? 40;
    return (
      <svg
        width={s}
        height={s}
        viewBox="0 0 40 40"
        className={className}
        style={style}
        xmlns="http://www.w3.org/2000/svg"
        aria-label="Althy"
        role="img"
      >
        <rect
          x="12"
          y="28"
          width="16"
          height="6"
          rx="1.5"
          fill="var(--althy-prussian, #0F2E4C)"
          opacity="0.15"
        />
        <path
          d="M6 32L20 6L34 32"
          fill="none"
          stroke="var(--althy-prussian, #0F2E4C)"
          strokeWidth="3.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <line
          x1="11"
          y1="22"
          x2="29"
          y2="22"
          stroke="var(--althy-prussian, #0F2E4C)"
          strokeWidth="2.5"
          strokeLinecap="round"
        />
      </svg>
    );
  }

  if (variant === "inverted") {
    const h = size ?? 56;
    const w = (h * 220) / 56;
    return (
      <svg
        width={w}
        height={h}
        viewBox="0 0 220 56"
        className={className}
        style={style}
        xmlns="http://www.w3.org/2000/svg"
        aria-label="Althy"
        role="img"
      >
        <rect
          x="14"
          y="38"
          width="16"
          height="6"
          rx="1.5"
          fill="var(--althy-gold, #C9A961)"
          opacity="0.3"
        />
        <path
          d="M8 44L22 8L36 44"
          fill="none"
          stroke="#FFFFFF"
          strokeWidth="3.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <line
          x1="13"
          y1="32"
          x2="31"
          y2="32"
          stroke="var(--althy-gold, #C9A961)"
          strokeWidth="2.5"
          strokeLinecap="round"
        />
        <text
          x="48"
          y="38"
          fontFamily="var(--font-serif), 'Fraunces', serif"
          fontSize="28"
          fontWeight="500"
          fill="#FFFFFF"
          letterSpacing="-0.5"
        >
          althy
        </text>
      </svg>
    );
  }

  if (variant === "favicon") {
    const s = size ?? 32;
    return (
      <svg
        width={s}
        height={s}
        viewBox="0 0 32 32"
        className={className}
        style={style}
        xmlns="http://www.w3.org/2000/svg"
        aria-label="Althy"
        role="img"
      >
        <rect width="32" height="32" rx="6" fill="#0F2E4C" />
        <path
          d="M6 26L16 6L26 26"
          fill="none"
          stroke="#FFFFFF"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <line
          x1="10"
          y1="19"
          x2="22"
          y2="19"
          stroke="#C9A961"
          strokeWidth="2"
          strokeLinecap="round"
        />
      </svg>
    );
  }

  // variant === "full" (default)
  const h = size ?? 56;
  const w = (h * 220) / 56;
  return (
    <svg
      width={w}
      height={h}
      viewBox="0 0 220 56"
      className={className}
      style={style}
      xmlns="http://www.w3.org/2000/svg"
      aria-label="Althy"
      role="img"
    >
      <rect
        x="14"
        y="38"
        width="16"
        height="6"
        rx="1.5"
        fill="var(--althy-prussian, #0F2E4C)"
        opacity="0.15"
      />
      <path
        d="M8 44L22 8L36 44"
        fill="none"
        stroke="var(--althy-prussian, #0F2E4C)"
        strokeWidth="3.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <line
        x1="13"
        y1="32"
        x2="31"
        y2="32"
        stroke="var(--althy-prussian, #0F2E4C)"
        strokeWidth="2.5"
        strokeLinecap="round"
      />
      <text
        x="48"
        y="38"
        fontFamily="var(--font-serif), 'Fraunces', serif"
        fontSize="28"
        fontWeight="500"
        fill="var(--althy-prussian, #0F2E4C)"
        letterSpacing="-0.5"
      >
        althy
      </text>
    </svg>
  );
}

export default AlthyLogo;
