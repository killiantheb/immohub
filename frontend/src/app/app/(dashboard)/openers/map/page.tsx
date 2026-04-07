"use client";

import dynamic from "next/dynamic";
import { useState } from "react";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import type { MissionType } from "@/lib/types";

// Leaflet requires no SSR
const OpenerMap = dynamic(() => import("@/components/OpenerMap"), { ssr: false });

const TYPE_LABELS: Record<MissionType, string> = {
  visit: "Visite",
  check_in: "Remise de clés",
  check_out: "État des lieux sortant",
  inspection: "Inspection",
  photography: "Photographie",
  other: "Autre",
};

export default function OpenerMapPage() {
  const [lat, setLat] = useState("48.8566");
  const [lng, setLng] = useState("2.3522");
  const [radius, setRadius] = useState("30");
  const [missionType, setMissionType] = useState<MissionType>("visit");

  const parsedLat = parseFloat(lat);
  const parsedLng = parseFloat(lng);
  const parsedRadius = parseFloat(radius);

  const valid = !isNaN(parsedLat) && !isNaN(parsedLng) && !isNaN(parsedRadius);

  return (
    <div className="flex flex-col h-full">
      <div className="mb-4 flex items-center gap-3">
        <Link href="/app/openers" className="text-gray-400 hover:text-gray-700">
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <h1 className="text-xl font-bold text-gray-900">Carte des ouvreurs</h1>
      </div>

      {/* Controls */}
      <div className="mb-4 card p-4">
        <div className="flex flex-wrap gap-3">
          <div>
            <label className="label">Latitude</label>
            <input
              type="number"
              step="any"
              value={lat}
              onChange={(e) => setLat(e.target.value)}
              className="input w-36"
            />
          </div>
          <div>
            <label className="label">Longitude</label>
            <input
              type="number"
              step="any"
              value={lng}
              onChange={(e) => setLng(e.target.value)}
              className="input w-36"
            />
          </div>
          <div>
            <label className="label">Rayon (km)</label>
            <input
              type="number"
              min={1}
              max={200}
              value={radius}
              onChange={(e) => setRadius(e.target.value)}
              className="input w-24"
            />
          </div>
          <div>
            <label className="label">Type de mission</label>
            <select
              value={missionType}
              onChange={(e) => setMissionType(e.target.value as MissionType)}
              className="input w-auto"
            >
              {(Object.entries(TYPE_LABELS) as [MissionType, string][]).map(([v, l]) => (
                <option key={v} value={v}>{l}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Map */}
      <div className="flex-1 rounded-xl overflow-hidden border border-gray-200 min-h-[500px]">
        {valid && (
          <OpenerMap
            center={[parsedLat, parsedLng]}
            radiusKm={parsedRadius}
            missionType={missionType}
          />
        )}
      </div>
    </div>
  );
}
