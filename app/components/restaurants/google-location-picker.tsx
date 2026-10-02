"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import { useI18n } from "@/app/components/i18n-provider";
import type { GeoCoordinates } from "@/lib/address-types";
import {
  type AddressSuggestion,
  ensureGoogleMaps,
  resolveGooglePlace,
  reverseGeocodeGoogle,
  searchGoogleAddresses,
} from "@/lib/google-places";

interface GoogleLocationPickerProps {
  address: string;
  setAddress: (val: string) => void;
  latitude: number | null;
  longitude: number | null;
  onChangeCoordinates: (coords: GeoCoordinates) => void;
  disabled?: boolean;
  googleMapsApiKey?: string;
}

export function GoogleLocationPicker({
  address,
  setAddress,
  latitude,
  longitude,
  onChangeCoordinates,
  disabled = false,
  googleMapsApiKey: initialKey,
}: GoogleLocationPickerProps) {
  const { t } = useI18n();
  const [activeKey, setActiveKey] = useState<string>(
    initialKey?.trim() || process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY?.trim() || "",
  );
  const [isFetchingKey, setIsFetchingKey] = useState<boolean>(!activeKey);

  useEffect(() => {
    if (initialKey?.trim()) {
      setActiveKey(initialKey.trim());
      setIsFetchingKey(false);
      return;
    }
    if (activeKey) {
      setIsFetchingKey(false);
      return;
    }

    let cancelled = false;
    setIsFetchingKey(true);
    fetch("/api/settings/google-maps-key")
      .then(async (res) => {
        if (!res.ok) return null;
        return (await res.json()) as { key?: string };
      })
      .then((data) => {
        if (!cancelled) {
          if (data?.key?.trim()) {
            setActiveKey(data.key.trim());
          }
          setIsFetchingKey(false);
        }
      })
      .catch(() => {
        if (!cancelled) setIsFetchingKey(false);
      });

    return () => {
      cancelled = true;
    };
  }, [initialKey, activeKey]);

  const apiKey = activeKey;

  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const mapInstanceRef = useRef<google.maps.Map | null>(null);
  const markerInstanceRef = useRef<google.maps.Marker | null>(null);
  const searchGenRef = useRef(0);
  const userAdjustedRef = useRef(false);

  const defaultCenter: GeoCoordinates =
    longitude != null && latitude != null ? [longitude, latitude] : [71.43, 51.13];

  const [currentCoords, setCurrentCoords] = useState<GeoCoordinates>(defaultCenter);
  const [searchQuery, setSearchQuery] = useState<string>(address || "");
  const [searchResults, setSearchResults] = useState<AddressSuggestion[]>([]);
  const [isSearching, setIsSearching] = useState<boolean>(false);
  const [showDropdown, setShowDropdown] = useState<boolean>(false);
  const [isReverseGeocoding, setIsReverseGeocoding] = useState<boolean>(false);
  const [isLocatingUser, setIsLocatingUser] = useState<boolean>(false);
  const [mapLoaded, setMapLoaded] = useState<boolean>(false);

  useEffect(() => {
    if (address && address !== searchQuery && !showDropdown) {
      setSearchQuery(address);
    }
  }, [address, searchQuery, showDropdown]);

  const moveMapTo = useCallback((coords: GeoCoordinates, zoom = 16) => {
    const position = { lat: coords[1], lng: coords[0] };
    mapInstanceRef.current?.panTo(position);
    mapInstanceRef.current?.setZoom(zoom);
    markerInstanceRef.current?.setPosition(position);
  }, []);

  const triggerReverseGeocode = useCallback(
    async (coords: GeoCoordinates) => {
      if (!apiKey) return;
      setIsReverseGeocoding(true);
      try {
        const placeName = await reverseGeocodeGoogle(coords, apiKey);
        if (placeName) {
          setAddress(placeName);
          setSearchQuery(placeName);
        }
      } catch (e) {
        console.error("Reverse geocoding error:", e);
      } finally {
        setIsReverseGeocoding(false);
      }
    },
    [apiKey, setAddress],
  );

  useEffect(() => {
    if (!mapContainerRef.current || !apiKey || mapInstanceRef.current) return;

    let isMounted = true;

    async function initMap() {
      try {
        await ensureGoogleMaps(apiKey);
        if (!isMounted || !mapContainerRef.current) return;

        const hasSavedPin = longitude != null && latitude != null;
        const map = new google.maps.Map(mapContainerRef.current, {
          center: { lat: defaultCenter[1], lng: defaultCenter[0] },
          zoom: hasSavedPin ? 15 : 12,
          disableDefaultUI: true,
          zoomControl: true,
          gestureHandling: "greedy",
          clickableIcons: false,
        });
        mapInstanceRef.current = map;

        const marker = new google.maps.Marker({
          map,
          position: { lat: defaultCenter[1], lng: defaultCenter[0] },
          draggable: !disabled,
        });
        markerInstanceRef.current = marker;

        marker.addListener("dragend", () => {
          const pos = marker.getPosition();
          if (!pos) return;
          userAdjustedRef.current = true;
          const newCoords: GeoCoordinates = [pos.lng(), pos.lat()];
          setCurrentCoords(newCoords);
          onChangeCoordinates(newCoords);
          void triggerReverseGeocode(newCoords);
        });

        map.addListener("click", (event: google.maps.MapMouseEvent) => {
          if (disabled || !event.latLng) return;
          userAdjustedRef.current = true;
          const newCoords: GeoCoordinates = [event.latLng.lng(), event.latLng.lat()];
          marker.setPosition(event.latLng);
          setCurrentCoords(newCoords);
          onChangeCoordinates(newCoords);
          void triggerReverseGeocode(newCoords);
        });

        if (isMounted) setMapLoaded(true);
      } catch (err) {
        console.error("Failed to load Google map:", err);
      }
    }

    void initMap();

    return () => {
      isMounted = false;
      markerInstanceRef.current?.setMap(null);
      markerInstanceRef.current = null;
      mapInstanceRef.current = null;
    };
    // Map is created once the key is known. defaultCenter is the initial camera.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [apiKey]);

  useEffect(() => {
    if (userAdjustedRef.current) return;
    if (longitude == null || latitude == null) return;
    const coords: GeoCoordinates = [longitude, latitude];
    setCurrentCoords(coords);
    moveMapTo(coords, 15);
  }, [longitude, latitude, mapLoaded, moveMapTo]);

  useEffect(() => {
    if (!apiKey || !searchQuery.trim() || searchQuery.trim().length < 2) {
      setSearchResults([]);
      setIsSearching(false);
      return;
    }

    const gen = ++searchGenRef.current;
    const timer = setTimeout(() => {
      setIsSearching(true);
      void searchGoogleAddresses(searchQuery, apiKey, currentCoords)
        .then((results) => {
          if (gen !== searchGenRef.current) return;
          setSearchResults(results);
        })
        .catch((e) => {
          if (gen !== searchGenRef.current) return;
          console.error("Search error:", e);
        })
        .finally(() => {
          if (gen === searchGenRef.current) setIsSearching(false);
        });
    }, 300);

    return () => {
      clearTimeout(timer);
    };
  }, [searchQuery, apiKey, currentCoords]);

  const handleSelectResult = (item: AddressSuggestion) => {
    setShowDropdown(false);
    setIsSearching(true);
    void resolveGooglePlace(item.prediction, apiKey)
      .then((resolved) => {
        const formatted =
          resolved?.formattedAddress ||
          [item.primaryText, item.secondaryText].filter(Boolean).join(", ");
        setAddress(formatted);
        setSearchQuery(formatted);
        if (!resolved) return;
        userAdjustedRef.current = true;
        setCurrentCoords(resolved.coordinates);
        onChangeCoordinates(resolved.coordinates);
        moveMapTo(resolved.coordinates, 16);
      })
      .catch((e) => {
        console.error("Place details failed:", e);
        const fallback = [item.primaryText, item.secondaryText].filter(Boolean).join(", ");
        setAddress(fallback);
        setSearchQuery(fallback);
      })
      .finally(() => {
        setIsSearching(false);
      });
  };

  const handleLocateMe = () => {
    if (!navigator.geolocation) return;
    setIsLocatingUser(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setIsLocatingUser(false);
        userAdjustedRef.current = true;
        const coords: GeoCoordinates = [pos.coords.longitude, pos.coords.latitude];
        setCurrentCoords(coords);
        onChangeCoordinates(coords);
        moveMapTo(coords, 16);
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

        {showDropdown && searchResults.length > 0 && (
          <div className="absolute left-0 right-0 top-full z-50 mt-1.5 max-h-56 overflow-y-auto rounded-xl border border-foreground/10 bg-background shadow-xl">
            {searchResults.map((result) => (
              <button
                key={result.placeId}
                type="button"
                onClick={() => handleSelectResult(result)}
                className="w-full text-left px-3.5 py-2.5 text-xs text-foreground/80 hover:bg-foreground/5 hover:text-foreground border-b border-foreground/5 last:border-0 transition flex items-start gap-2"
              >
                <span className="text-red-500 mt-0.5">📍</span>
                <div>
                  <div className="font-semibold text-foreground">{result.primaryText}</div>
                  {result.secondaryText ? (
                    <div className="text-foreground/50 text-[11px] line-clamp-1">{result.secondaryText}</div>
                  ) : null}
                </div>
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="relative overflow-hidden rounded-xl border border-foreground/15 bg-foreground/5">
        <div ref={mapContainerRef} className="h-72 w-full" />

        {isFetchingKey || (apiKey && !mapLoaded) ? (
          <div className="absolute inset-0 flex items-center justify-center bg-background/50">
            <div className="flex items-center gap-2 text-xs text-foreground/60">
              <svg className="size-4 animate-spin text-foreground/50" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
              </svg>
              <span>{t("restaurants.mapboxLoadingMap")}</span>
            </div>
          </div>
        ) : !apiKey ? (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-background/90 p-4 text-center">
            <p className="text-xs font-medium text-amber-800 dark:text-amber-200">
              {t("restaurants.mapboxNotConfigured")} (<code className="font-mono">NEXT_PUBLIC_GOOGLE_MAPS_API_KEY</code>)
            </p>
            <p className="text-[11px] text-foreground/50 mt-1">
              {t("restaurants.mapboxManualFallback")}
            </p>
          </div>
        ) : null}

        <div className="pointer-events-none absolute bottom-2 left-2 rounded-lg bg-background/90 px-2.5 py-1 text-[11px] font-medium text-foreground/70 shadow border border-foreground/10">
          {t("restaurants.mapboxDragPinHint")}
        </div>
      </div>

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
