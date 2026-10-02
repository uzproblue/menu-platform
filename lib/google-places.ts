import { importLibrary, setOptions } from "@googlemaps/js-api-loader";
import type { GeoCoordinates } from "./address-types";

/** Address strings and map labels are requested in Russian. */
export const GOOGLE_ADDRESS_LANGUAGE = "ru";

const BIAS_DELTA_DEG = 0.25;

export type AddressSuggestion = {
  placeId: string;
  primaryText: string;
  secondaryText: string;
  prediction: google.maps.places.PlacePrediction;
};

let mapsReady: Promise<void> | null = null;
let sessionToken: google.maps.places.AutocompleteSessionToken | null = null;

export async function ensureGoogleMaps(apiKey: string): Promise<void> {
  const key = apiKey.trim();
  if (!key) {
    throw new Error("Google Maps API key is not configured");
  }

  if (!mapsReady) {
    mapsReady = (async () => {
      setOptions({
        key,
        v: "weekly",
        language: GOOGLE_ADDRESS_LANGUAGE,
      });
      await importLibrary("maps");
      await importLibrary("places");
      await importLibrary("geocoding");
    })().catch((error) => {
      mapsReady = null;
      throw error;
    });
  }

  await mapsReady;
}

function currentSessionToken(): google.maps.places.AutocompleteSessionToken {
  if (!sessionToken) {
    sessionToken = new google.maps.places.AutocompleteSessionToken();
  }
  return sessionToken;
}

/** Start a fresh autocomplete session after a place is selected. */
export function beginNewPlacesSession(): void {
  sessionToken = new google.maps.places.AutocompleteSessionToken();
}

function biasAround(coords: GeoCoordinates): google.maps.LatLngBoundsLiteral {
  const [lng, lat] = coords;
  return {
    south: lat - BIAS_DELTA_DEG,
    west: lng - BIAS_DELTA_DEG,
    north: lat + BIAS_DELTA_DEG,
    east: lng + BIAS_DELTA_DEG,
  };
}

export async function searchGoogleAddresses(
  query: string,
  apiKey: string,
  bias?: GeoCoordinates | null,
): Promise<AddressSuggestion[]> {
  const q = query.trim();
  if (q.length < 2 || !apiKey.trim()) return [];

  await ensureGoogleMaps(apiKey);

  const { suggestions } = await google.maps.places.AutocompleteSuggestion.fetchAutocompleteSuggestions({
    input: q,
    language: GOOGLE_ADDRESS_LANGUAGE,
    sessionToken: currentSessionToken(),
    ...(bias ? { locationBias: biasAround(bias) } : {}),
  });

  const out: AddressSuggestion[] = [];
  for (const suggestion of suggestions) {
    const prediction = suggestion.placePrediction;
    if (!prediction) continue;
    out.push({
      placeId: prediction.placeId,
      primaryText: prediction.mainText?.text || prediction.text.text,
      secondaryText: prediction.secondaryText?.text ?? "",
      prediction,
    });
  }
  return out;
}

/**
 * Place Details for the selected suggestion. Uses the same session token as
 * the preceding autocomplete calls, then starts a new session.
 */
export async function resolveGooglePlace(
  prediction: google.maps.places.PlacePrediction,
  apiKey: string,
): Promise<{ formattedAddress: string; coordinates: GeoCoordinates } | null> {
  await ensureGoogleMaps(apiKey);
  try {
    const place = prediction.toPlace();
    await place.fetchFields({
      fields: ["formattedAddress", "location"],
    });
    const loc = place.location;
    const formattedAddress = place.formattedAddress?.trim() ?? "";
    if (!loc || !formattedAddress) return null;
    return {
      formattedAddress,
      coordinates: [loc.lng(), loc.lat()],
    };
  } finally {
    beginNewPlacesSession();
  }
}

export async function reverseGeocodeGoogle(
  coords: GeoCoordinates,
  apiKey: string,
): Promise<string | null> {
  const [lng, lat] = coords;
  if (!Number.isFinite(lng) || !Number.isFinite(lat) || !apiKey.trim()) return null;

  await ensureGoogleMaps(apiKey);
  const geocoder = new google.maps.Geocoder();
  const { results } = await geocoder.geocode({
    location: { lat, lng },
    language: GOOGLE_ADDRESS_LANGUAGE,
  });
  const formatted = results[0]?.formatted_address?.trim();
  return formatted || null;
}
