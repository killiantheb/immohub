/**
 * Map components — dynamic SSR-safe exports.
 *
 * Usage:
 *   import { ZoneMap, PropertyMap, DashboardMap } from "@/components/map";
 */
import dynamic from "next/dynamic";

function MapSkeleton({ height }: { height: number }) {
  return (
    <div
      style={{
        height,
        background: "linear-gradient(90deg, #f0ede8 25%, #faf8f4 50%, #f0ede8 75%)",
        backgroundSize: "200% 100%",
        borderRadius: 14,
        border: "1px solid #E8E4DC",
        animation: "althy-shimmer 1.5s infinite",
      }}
    >
      <style>{`@keyframes althy-shimmer { 0%{background-position:200% 0} 100%{background-position:-200% 0} }`}</style>
    </div>
  );
}

export const ZoneMap = dynamic(() => import("./ZoneMap"), {
  ssr: false,
  loading: () => <MapSkeleton height={360} />,
});

export const PropertyMap = dynamic(() => import("./PropertyMap"), {
  ssr: false,
  loading: () => <MapSkeleton height={320} />,
});

export const DashboardMap = dynamic(() => import("./DashboardMap"), {
  ssr: false,
  loading: () => <MapSkeleton height={500} />,
});

export type { ZoneMapData, ZoneLocation, TempZone } from "./ZoneMap";
