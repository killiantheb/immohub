import dynamic from "next/dynamic";

// mapbox-gl ne supporte pas le SSR → import dynamique côté client uniquement
const CarteMapboxPage = dynamic(
  () => import("@/components/map/CarteMapboxPage"),
  { ssr: false, loading: () => (
    <div style={{
      display: "flex", alignItems: "center", justifyContent: "center",
      height: "100vh", background: "#FAF8F5",
      fontSize: 14, color: "var(--althy-text-3)",
    }}>
      Chargement de la carte…
    </div>
  )},
);

export const metadata = {
  title: "Carte — Althy",
  description: "Vue cartographique des biens disponibles en Suisse romande",
};

export default function CartePage() {
  return <CarteMapboxPage />;
}
