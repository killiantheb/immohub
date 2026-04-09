"use client";

const DEFAULT_SUGGESTIONS = [
  "Ma chaudière est cassée",
  "Génère la quittance d'avril",
  "Dupont n'a pas payé ce mois",
  "Combien vaut mon bien ?",
  "Rédige un email de bienvenue",
  "Mes baux expirent bientôt ?",
];

interface Props {
  suggestions?: string[];
  onSelect: (s: string) => void;
}

export function SuggestionChips({ suggestions = DEFAULT_SUGGESTIONS, onSelect }: Props) {
  return (
    <div
      style={{
        display: "flex",
        flexWrap: "wrap",
        gap: 8,
        justifyContent: "center",
        animation: "fadeIn 0.4s ease",
      }}
    >
      {suggestions.map((s) => (
        <button
          key={s}
          onClick={() => onSelect(s)}
          style={{
            padding: "7px 14px",
            borderRadius: 20,
            border: "1px solid var(--althy-border)",
            background: "var(--althy-surface)",
            color: "var(--althy-text-2)",
            fontSize: 12.5,
            cursor: "pointer",
            transition: "all 0.15s",
            whiteSpace: "nowrap",
            boxShadow: "var(--althy-shadow)",
          }}
          onMouseEnter={(e) => {
            (e.currentTarget as HTMLButtonElement).style.borderColor = "var(--althy-orange)";
            (e.currentTarget as HTMLButtonElement).style.color = "var(--althy-orange)";
            (e.currentTarget as HTMLButtonElement).style.background = "var(--althy-orange-bg)";
          }}
          onMouseLeave={(e) => {
            (e.currentTarget as HTMLButtonElement).style.borderColor = "var(--althy-border)";
            (e.currentTarget as HTMLButtonElement).style.color = "var(--althy-text-2)";
            (e.currentTarget as HTMLButtonElement).style.background = "var(--althy-surface)";
          }}
        >
          {s}
        </button>
      ))}
    </div>
  );
}
