import type { PropertyStatus, PropertyType } from "@/lib/types";

export const PROPERTY_TYPE_LABELS: Record<PropertyType, string> = {
  apartment: "Appartement",
  villa: "Villa",
  parking: "Parking",
  garage: "Garage",
  box: "Box",
  cave: "Cave",
  depot: "Dépôt",
  office: "Bureau",
  commercial: "Local commercial",
  hotel: "Hôtel",
};

export const PROPERTY_STATUS_LABELS: Record<PropertyStatus, string> = {
  available: "Disponible",
  rented: "Loué",
  for_sale: "À vendre",
  sold: "Vendu",
  maintenance: "En travaux",
};

export const PROPERTY_STATUS_COLORS: Record<PropertyStatus, string> = {
  available: "bg-green-100 text-green-700",
  rented: "bg-blue-100 text-blue-700",
  for_sale: "bg-amber-100 text-amber-700",
  sold: "bg-gray-100 text-gray-600",
  maintenance: "bg-orange-100 text-orange-700",
};
