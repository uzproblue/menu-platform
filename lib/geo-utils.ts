import type { GeoCoordinates, MapboxGeocodeFeature, MapboxGeocodeResponse } from "./address-types";

/**
 * Search addresses using the Mapbox Geocoding REST API.
 */
export async function searchMapboxAddress(
  query: string,
  token?: string,
  proximity?: GeoCoordinates,
  signal?: AbortSignal,
): Promise<MapboxGeocodeFeature[]> {
  const q = query.trim();
  if (!q || q.length < 2) return [];

  const mapboxToken = token || process.env.NEXT_PUBLIC_MAPBOX_TOKEN;
  if (!mapboxToken) {
    return [];
  }

  const proximityParam = proximity ? `&proximity=${proximity[0]},${proximity[1]}` : "";
  const endpoint = `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(
    q,
  )}.json?access_token=${mapboxToken}&autocomplete=true&types=address,poi,neighborhood,locality${proximityParam}&limit=5`;

  try {
    const res = await fetch(endpoint, { signal });
    if (!res.ok) {
      return [];
    }
    const data = (await res.json()) as MapboxGeocodeResponse;
    return Array.isArray(data.features) ? data.features : [];
  } catch (error: unknown) {
    if (error instanceof Error && error.name === "AbortError") {
      return [];
    }
    console.error("Mapbox search error:", error);
    return [];
  }
}

/**
 * Reverse geocode [longitude, latitude] into a human-readable address.
 */
export async function reverseGeocodeMapbox(
  coords: GeoCoordinates,
  token?: string,
  signal?: AbortSignal,
): Promise<{ placeName: string; text?: string } | null> {
  const [lng, lat] = coords;
  if (!Number.isFinite(lng) || !Number.isFinite(lat)) return null;

  const mapboxToken = token || process.env.NEXT_PUBLIC_MAPBOX_TOKEN;
  if (!mapboxToken) {
    return null;
  }

  const endpoint = `https://api.mapbox.com/geocoding/v5/mapbox.places/${lng},${lat}.json?access_token=${mapboxToken}&types=address,poi,neighborhood,locality&limit=1`;

  try {
    const res = await fetch(endpoint, { signal });
    if (!res.ok) return null;
    const data = (await res.json()) as MapboxGeocodeResponse;
    const first = data.features?.[0];
    if (!first) return null;

    return {
      placeName: first.place_name,
      text: first.text,
    };
  } catch (error: unknown) {
    if (error instanceof Error && error.name === "AbortError") {
      return null;
    }
    console.error("Mapbox reverse geocode error:", error);
    return null;
  }
}
