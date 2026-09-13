"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import { useI18n } from "@/app/components/i18n-provider";
import type { GeoCoordinates, MapboxGeocodeFeature } from "@/lib/address-types";
import { searchMapboxAddress, reverseGeocodeMapbox } from "@/lib/geo-utils";

interface MapboxLocationPickerProps {
  address: string;
  setAddress: (val: string) => void;
  latitude: number | null;
  longitude: number | null;
  onChangeCoordinates: (coords: GeoCoordinates) => void;
  disabled?: boolean;
}

export function MapboxLocationPicker({
  address,
  setAddress,
  latitude,
  longitude,
  onChangeCoordinates,
  disabled = false,
}: MapboxLocationPickerProps) {
  const { t } = useI18n();
  const mapboxToken = process.env.NEXT_PUBLIC_MAPBOX_TOKEN?.trim() || "";

  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const mapInstanceRef = useRef<any>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const markerInstanceRef = useRef<any>(null);
  const searchAbortRef = useRef<AbortController | null>(null);

  // Default start center: provided coords -> Astana center fallback [71.43, 51.13]
  const defaultCenter: GeoCoordinates =
    longitude != null && latitude != null ? [longitude, latitude] : [71.43, 51.13];

  const [currentCoords, setCurrentCoords] = useState<GeoCoordinates>(defaultCenter);
  const [searchQuery, setSearchQuery] = useState<string>(address || "");
  const [searchResults, setSearchResults] = useState<MapboxGeocodeFeature[]>([]);
  const [isSearching, setIsSearching] = useState<boolean>(false);
  const [showDropdown, setShowDropdown] = useState<boolean>(false);
  const [isReverseGeocoding, setIsReverseGeocoding] = useState<boolean>(false);
  const [isLocatingUser, setIsLocatingUser] = useState<boolean>(false);
  const [mapLoaded, setMapLoaded] = useState<boolean>(false);

  // Keep local query in sync if parent address changes externally
  useEffect(() => {
    if (address && address !== searchQuery && !showDropdown) {
      setSearchQuery(address);
    }
  }, [address, searchQuery, showDropdown]);

  // Reverse geocoding on drag
  const triggerReverseGeocode = useCallback(
    async (coords: GeoCoordinates) => {
      if (!mapboxToken) return;
      setIsReverseGeocoding(true);
      try {
        const res = await reverseGeocodeMapbox(coords, mapboxToken);
        if (res?.placeName) {
          setAddress(res.placeName);
          setSearchQuery(res.placeName);
        }
      } catch (e) {
        console.error("Reverse geocoding error:", e);
      } finally {
        setIsReverseGeocoding(false);
      }
    },
    [mapboxToken, setAddress],
  );

  // Initialize Mapbox map
  useEffect(() => {
    if (!mapContainerRef.current || !mapboxToken || mapInstanceRef.current) return;

    let isMounted = true;

    async function initMap() {
      try {
        // Inject Mapbox stylesheet if not present
        if (!document.getElementById("mapbox-gl-css")) {
          const link = document.createElement("link");
          link.id = "mapbox-gl-css";
          link.rel = "stylesheet";
          link.href = "https://api.mapbox.com/mapbox-gl-js/v3.11.1/mapbox-gl.css";
          document.head.appendChild(link);
        }

        const mapboxgl = (await import("mapbox-gl")).default;
        if (!isMounted || !mapContainerRef.current) return;

        mapboxgl.accessToken = mapboxToken;

        const map = new mapboxgl.Map({
          container: mapContainerRef.current,
          style: "mapbox://styles/mapbox/streets-v12",
          center: defaultCenter,
          zoom: longitude != null && latitude != null ? 15 : 12,
        });

        mapInstanceRef.current = map;

        map.addControl(new mapboxgl.NavigationControl({ showCompass: false }), "top-right");

        // Draggable restaurant pin marker
        const markerEl = document.createElement("div");
        markerEl.className = "cursor-grab active:cursor-grabbing";
        markerEl.innerHTML = `
          <div style="transform: translate(-50%, -100%); display: flex; flex-direction: column; align-items: center;">
            <div style="background-color: #ef4444; color: white; width: 36px; height: 36px; border-radius: 9999px; display: flex; align-items: center; justify-content: center; box-shadow: 0 4px 12px rgba(0,0,0,0.3); border: 2px solid white;">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                <path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/>
                <circle cx="12" cy="10" r="3"/>
              </svg>
            </div>
            <div style="background: rgba(0,0,0,0.8); color: white; font-size: 11px; font-weight: 600; padding: 2px 6px; border-radius: 4px; margin-top: 2px; white-space: nowrap;">
              Restaurant Pin
            </div>
          </div>
        `;

        const marker = new mapboxgl.Marker({
          element: markerEl,
          draggable: !disabled,
        })
          .setLngLat(defaultCenter)
          .addTo(map);

        markerInstanceRef.current = marker;

        marker.on("dragend", () => {
          const lngLat = marker.getLngLat();
          const newCoords: GeoCoordinates = [lngLat.lng, lngLat.lat];
          setCurrentCoords(newCoords);
          onChangeCoordinates(newCoords);
          void triggerReverseGeocode(newCoords);
        });

        map.on("click", (e) => {
          if (disabled) return;
          const newCoords: GeoCoordinates = [e.lngLat.lng, e.lngLat.lat];
          marker.setLngLat(newCoords);
          setCurrentCoords(newCoords);
          onChangeCoordinates(newCoords);
          void triggerReverseGeocode(newCoords);
        });

        map.on("load", () => {
          if (!isMounted) return;
          setMapLoaded(true);
          map.resize();
        });
      } catch (err) {
        console.error("Failed to load Mapbox:", err);
      }
    }

    void initMap();

    return () => {
      isMounted = false;
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mapboxToken]);

  // Debounced search
  useEffect(() => {
    if (!mapboxToken || !searchQuery.trim() || searchQuery.trim().length < 2) {
      setSearchResults([]);
      setIsSearching(false);
      return;
    }

    if (searchAbortRef.current) {
      searchAbortRef.current.abort();
    }
    const controller = new AbortController();
    searchAbortRef.current = controller;

    const timer = setTimeout(async () => {
      setIsSearching(true);
      try {
        const results = await searchMapboxAddress(
          searchQuery,
          mapboxToken,
          currentCoords,
          controller.signal,
        );
        setSearchResults(results);
      } catch (e) {
        console.error("Search error:", e);
      } finally {
        setIsSearching(false);
      }
    }, 300);

    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [searchQuery, mapboxToken, currentCoords]);

  const handleSelectResult = (feature: MapboxGeocodeFeature) => {
    const coords = feature.center;
    setAddress(feature.place_name);
    setSearchQuery(feature.place_name);
    setCurrentCoords(coords);
    onChangeCoordinates(coords);
    setShowDropdown(false);

    if (mapInstanceRef.current) {
      mapInstanceRef.current.flyTo({
        center: coords,
        zoom: 16,
        essential: true,
      });
      if (markerInstanceRef.current) {
        markerInstanceRef.current.setLngLat(coords);
      }
    }
  };

  const handleLocateMe = () => {
    if (!navigator.geolocation) return;
    setIsLocatingUser(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setIsLocatingUser(false);
        const coords: GeoCoordinates = [pos.coords.longitude, pos.coords.latitude];
        setCurrentCoords(coords);
        onChangeCoordinates(coords);

        if (mapInstanceRef.current) {
          mapInstanceRef.current.flyTo({
            center: coords,
            zoom: 16,
            essential: true,
          });
          if (markerInstanceRef.current) {
            markerInstanceRef.current.setLngLat(coords);
          }
        }
        void triggerReverseGeocode(coords);
      },
      (err) => {
        setIsLocatingUser(false);
        console.warn("Geolocation denied or failed:", err);
      },
      { timeout: 10000, enableHighAccuracy: true },
    );
  };

  return (
    <div className="space-y-3">
      {/* Search Bar & Geolocation */}
      <div className="relative">
        <div className="flex items-center gap-2">
          <div className="relative flex-1">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setAddress(e.target.value);
                setShowDropdown(true);
              }}
              onFocus={() => {
                if (searchResults.length > 0) setShowDropdown(true);
              }}
              placeholder={t("restaurants.mapboxSearchPlaceholder")}
              disabled={disabled}
              className="w-full rounded-xl border border-foreground/15 bg-background/80 px-3.5 py-2.5 text-sm text-foreground placeholder:text-foreground/40 outline-none ring-foreground/20 focus:ring-2 disabled:cursor-not-allowed disabled:opacity-60 pr-9"
            />
            {isSearching || isReverseGeocoding ? (
              <div className="absolute right-3 top-1/2 -translate-y-1/2">
                <svg className="size-4 animate-spin text-foreground/50" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
              </div>
            ) : searchQuery ? (
              <button
                type="button"
                onClick={() => {
                  setSearchQuery("");
                  setAddress("");
                  setSearchResults([]);
                }}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-foreground/40 hover:text-foreground"
              >
                ✕
              </button>
            ) : null}
          </div>

          <button
            type="button"
            onClick={handleLocateMe}
            disabled={disabled || isLocatingUser}
            title={t("restaurants.mapboxLocateMeTitle")}
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-foreground/15 bg-background hover:bg-foreground/5 text-foreground/70 hover:text-foreground disabled:opacity-50 transition"
          >
            {isLocatingUser ? (
              <svg className="size-4 animate-spin text-foreground/60" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
              </svg>
            ) : (
              <svg className="size-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <circle cx="12" cy="12" r="7" strokeWidth="2" />
                <circle cx="12" cy="12" r="3" fill="currentColor" />
                <line x1="12" y1="1" x2="12" y2="4" strokeWidth="2" strokeLinecap="round" />
                <line x1="12" y1="20" x2="12" y2="23" strokeWidth="2" strokeLinecap="round" />
                <line x1="1" y1="12" x2="4" y2="12" strokeWidth="2" strokeLinecap="round" />
                <line x1="20" y1="12" x2="23" y2="12" strokeWidth="2" strokeLinecap="round" />
              </svg>
            )}
          </button>
        </div>

        {/* Autocomplete Dropdown */}
        {showDropdown && searchResults.length > 0 && (
          <div className="absolute left-0 right-0 top-full z-50 mt-1.5 max-h-56 overflow-y-auto rounded-xl border border-foreground/10 bg-background shadow-xl">
            {searchResults.map((result) => (
              <button
                key={result.id}
                type="button"
                onClick={() => handleSelectResult(result)}
                className="w-full text-left px-3.5 py-2.5 text-xs text-foreground/80 hover:bg-foreground/5 hover:text-foreground border-b border-foreground/5 last:border-0 transition flex items-start gap-2"
              >
                <span className="text-red-500 mt-0.5">📍</span>
                <div>
                  <div className="font-semibold text-foreground">{result.text}</div>
                  <div className="text-foreground/50 text-[11px] line-clamp-1">{result.place_name}</div>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Interactive Map */}
      <div className="relative overflow-hidden rounded-xl border border-foreground/15 bg-foreground/5">
        <div ref={mapContainerRef} className="h-72 w-full" />

        {!mapboxToken ? (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-background/90 p-4 text-center">
            <p className="text-xs font-medium text-amber-800 dark:text-amber-200">
              {t("restaurants.mapboxNotConfigured")} (<code className="font-mono">NEXT_PUBLIC_MAPBOX_TOKEN</code>)
            </p>
            <p className="text-[11px] text-foreground/50 mt-1">
              {t("restaurants.mapboxManualFallback")}
            </p>
          </div>
        ) : !mapLoaded ? (
          <div className="absolute inset-0 flex items-center justify-center bg-background/50">
            <div className="flex items-center gap-2 text-xs text-foreground/60">
              <svg className="size-4 animate-spin text-foreground/50" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
              </svg>
              <span>{t("restaurants.mapboxLoadingMap")}</span>
            </div>
          </div>
        ) : null}

        {/* Pin Helper Badge */}
        <div className="pointer-events-none absolute bottom-2 left-2 rounded-lg bg-background/90 px-2.5 py-1 text-[11px] font-medium text-foreground/70 shadow border border-foreground/10">
          {t("restaurants.mapboxDragPinHint")}
        </div>
      </div>

      {/* Lat/Lon Coordinates Display */}
      <div className="flex items-center justify-between text-[11px] text-foreground/50 px-1">
        <span>
          {t("restaurants.mapboxCoordinatesLabel")}:{" "}
          <span className="font-mono font-medium text-foreground/70">
            {currentCoords[1].toFixed(5)}, {currentCoords[0].toFixed(5)}
          </span>
        </span>
        {isReverseGeocoding && <span className="text-blue-600 dark:text-blue-400">{t("restaurants.mapboxUpdatingAddress")}</span>}
      </div>
    </div>
  );
}
