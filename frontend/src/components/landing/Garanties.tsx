import { GARANTIES } from "@/lib/data/landing"
import { Shield, FileText, CalendarCheck, Headphones } from "lucide-react"
import { C } from "@/lib/design-tokens"

// Cette bannière de garanties alterne sur un fond plus sombre
const sectionBg = C.surface2

const ICONS: Record<string, React.ReactNode> = {
  shield: <Shield size={20} color={C.orange} strokeWidth={1.5} />,
  file: <FileText size={20} color={C.orange} strokeWidth={1.5} />,
  calendar: <CalendarCheck size={20} color={C.orange} strokeWidth={1.5} />,
  headphones: <Headphones size={20} color={C.orange} strokeWidth={1.5} />,
}

export function Garanties() {
  return (
    <div
      style={{
        background: sectionBg,
        borderTop: `1px solid ${C.border}`,
        borderBottom: `1px solid ${C.border}`,
        padding: "2.5rem 1.5rem",
      }}
    >
      <div
        style={{
          maxWidth: 960,
          margin: "0 auto",
          display: "flex",
          flexWrap: "wrap",
          justifyContent: "center",
          alignItems: "center",
          gap: "2.5rem 4rem",
        }}
      >
        {GARANTIES.map((g) => (
          <div
            key={g.label}
            style={{
              display: "flex",
              alignItems: "center",
              gap: "0.75rem",
            }}
          >
            <div>{ICONS[g.icon]}</div>
            <span
              style={{
                color: C.text,
                fontSize: "0.9rem",
                fontWeight: 500,
                whiteSpace: "nowrap",
              }}
            >
              {g.label}
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}
