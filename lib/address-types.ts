export type GeoCoordinates = [number, number]; // [longitude, latitude]

export interface MapboxGeocodeFeature {
  id: string;
  place_name: string;
  text: string;
  center: GeoCoordinates;
  geometry: {
    type: string;
    coordinates: GeoCoordinates;
  };
  context?: Array<{
    id: string;
    text: string;
    wikidata?: string;
    short_code?: string;
  }>;
}

export interface MapboxGeocodeResponse {
  type: string;
  features: MapboxGeocodeFeature[];
}
