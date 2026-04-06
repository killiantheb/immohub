"use client";

import { useState } from "react";
import Link from "next/link";
import {
  Building2,
  ChevronLeft,
  ChevronRight,
  Filter,
  Home,
  MapPin,
  Plus,
  Search,
  X,
} from "lucide-react";
import { useProperties } from "@/lib/hooks/useProperties";
import {
  PROPERTY_STATUS_COLORS,
  PROPERTY_STATUS_LABELS,
  PROPERTY_TYPE_LABELS,
} from "@/lib/constants/properties";
import type { PropertyFilters, PropertyStatus, PropertyType } from "@/lib/types";

// ── Filter bar ────────────────────────────────────────────────────────────────

function FilterBar({
  filters,
  onChange,
}: {
  filters: PropertyFilters;
  onChange: (f: PropertyFilters) => void;
}) {
  const TYPES: PropertyType[] = [
    "apartment", "villa", "parking", "garage", "box",
    "cave", "depot", "office", "commercial", "hotel",
  ];
  const STATUSES: PropertyStatus[] = ["available", "rented", "for_sale", "sold", "maintenance"];

  return (
    <div className="mb-6 card p-4 space-y-3">
      <div className="flex flex-wrap gap-3">
        {/* Search */}
        <div className="relative flex-1 min-w-48">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
          <input
            type="search"
            placeholder="Ville, adresse…"
            value={filters.city ?? ""}
            onChange={(e) => onChange({ ...filters, city: e.target.value || undefined })}
            className="input pl-9"
          />
        </div>

        {/* Type */}
        <select
          value={filters.type ?? ""}
          onChange={(e) => onChange({ ...filters, type: (e.target.value as PropertyType) || undefined })}
          className="input w-auto"
        >
          <option value="">Tous les types</option>
          {TYPES.map((t) => (
            <option key={t} value={t}>{PROPERTY_TYPE_LABELS[t]}</option>
          ))}
        </select>

        {/* Status */}
        <select
          value={filters.status ?? ""}
          onChange={(e) => onChange({ ...filters, status: (e.target.value as PropertyStatus) || undefined })}
          className="input w-auto"
        >
          <option value="">Tous les statuts</option>
          {STATUSES.map((s) => (
            <option key={s} value={s}>{PROPERTY_STATUS_LABELS[s]}</option>
          ))}
        </select>

        {/* Reset */}
        {(filters.city || filters.type || filters.status) && (
          <button
            onClick={() => onChange({})}
            className="flex items-center gap-1 text-sm text-gray-500 hover:text-gray-800"
          >
            <X className="h-4 w-4" />
            Effacer
          </button>
        )}
      </div>
    </div>
  );
}

// ── Property card ─────────────────────────────────────────────────────────────

function PropertyCard({ property }: { property: import("@/lib/types").Property }) {
  const cover = property.images?.find((i) => i.is_cover) ?? property.images?.[0];

  const price = property.monthly_rent
    ? `${property.monthly_rent.toLocaleString("fr-FR")} €/mois`
    : property.price_sale
    ? `${property.price_sale.toLocaleString("fr-FR")} €`
    : null;

  return (
    <Link
      href={`/properties/${property.id}`}
      className="card group flex flex-col hover:border-primary-300 hover:shadow-md transition-all p-0 overflow-hidden"
    >
      {/* Image */}
      <div className="relative h-40 bg-gray-100">
        {cover ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={cover.url}
            alt={property.address}
            className="h-full w-full object-cover"
          />
        ) : (
          <div className="flex h-full items-center justify-center text-gray-300">
            <Home className="h-12 w-12" />
          </div>
        )}
        <span
          className={`absolute right-2 top-2 rounded-full px-2 py-0.5 text-xs font-medium ${PROPERTY_STATUS_COLORS[property.status as PropertyStatus]}`}
        >
          {PROPERTY_STATUS_LABELS[property.status as PropertyStatus] ?? property.status}
        </span>
      </div>

      {/* Content */}
      <div className="flex flex-col gap-1 p-4">
        <p className="font-semibold text-gray-900 truncate">
          {PROPERTY_TYPE_LABELS[property.type as PropertyType] ?? property.type}
          {property.surface ? ` · ${property.surface} m²` : ""}
          {property.rooms ? ` · ${property.rooms} p.` : ""}
        </p>
        <p className="flex items-center gap-1 text-sm text-gray-500 truncate">
          <MapPin className="h-3.5 w-3.5 shrink-0" />
          {property.address}, {property.city}
        </p>
        {price && (
          <p className="mt-1 text-base font-bold text-primary-600">{price}</p>
        )}
      </div>
    </Link>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function PropertiesPage() {
  const [filters, setFilters] = useState<PropertyFilters>({});
  const [page, setPage] = useState(1);

  const { data, isLoading, isError } = useProperties({ ...filters, page, size: 12 });

  const handleFilterChange = (f: PropertyFilters) => {
    setFilters(f);
    setPage(1);
  };

  return (
    <div>
      {/* Header */}
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Biens immobiliers</h1>
          <p className="mt-0.5 text-sm text-gray-500">
            {data ? `${data.total} bien${data.total !== 1 ? "s" : ""}` : "Gérez votre portefeuille"}
          </p>
        </div>
        <Link href="/properties/new" className="btn-primary flex items-center gap-2">
          <Plus className="h-4 w-4" />
          Ajouter un bien
        </Link>
      </div>

      {/* Filters */}
      <FilterBar filters={filters} onChange={handleFilterChange} />

      {/* States */}
      {isLoading ? (
        <div className="flex justify-center py-16">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary-600 border-t-transparent" />
        </div>
      ) : isError ? (
        <div className="card flex flex-col items-center py-16 text-center">
          <Building2 className="mb-3 h-10 w-10 text-red-300" />
          <p className="text-gray-600">Erreur lors du chargement des biens</p>
        </div>
      ) : !data?.items.length ? (
        <div className="card flex flex-col items-center py-16 text-center">
          <Home className="mb-3 h-10 w-10 text-gray-300" />
          <p className="font-medium text-gray-700">Aucun bien trouvé</p>
          <p className="mt-1 text-sm text-gray-400">
            {Object.values(filters).some(Boolean)
              ? "Essayez de modifier vos filtres"
              : "Commencez par ajouter votre premier bien"}
          </p>
          {!Object.values(filters).some(Boolean) && (
            <Link href="/properties/new" className="btn-primary mt-4">
              Ajouter un bien
            </Link>
          )}
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {data.items.map((p) => (
              <PropertyCard key={p.id} property={p} />
            ))}
          </div>

          {/* Pagination */}
          {data.pages > 1 && (
            <div className="mt-8 flex items-center justify-center gap-2">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1}
                className="btn-secondary flex items-center gap-1 disabled:opacity-40"
              >
                <ChevronLeft className="h-4 w-4" />
                Précédent
              </button>
              <span className="text-sm text-gray-600">
                Page {page} / {data.pages}
              </span>
              <button
                onClick={() => setPage((p) => Math.min(data.pages, p + 1))}
                disabled={page === data.pages}
                className="btn-secondary flex items-center gap-1 disabled:opacity-40"
              >
                Suivant
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
