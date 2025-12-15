// src/lib/utils/reverseGeocode.server.ts
import "server-only";

import type { IGeoLocation } from "@/types/shared.types";

type ReverseGeocodeResult = Required<Pick<IGeoLocation, "country" | "region" | "city">>;

function isValidLatLng(lat: unknown, lng: unknown): lat is number {
  return (
    typeof lat === "number" &&
    typeof lng === "number" &&
    !Number.isNaN(lat) &&
    !Number.isNaN(lng) &&
    lat >= -90 &&
    lat <= 90 &&
    lng >= -180 &&
    lng <= 180
  );
}

function nonEmpty(v: unknown): v is string {
  return typeof v === "string" && v.trim().length > 0;
}

async function fetchJsonWithTimeout(url: string, timeoutMs: number) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      method: "GET",
      signal: controller.signal,
      headers: { Accept: "application/json" },
      // avoid any caching surprises for geo
      cache: "no-store",
    });
    if (!res.ok) throw new Error(`Reverse geocode HTTP ${res.status}`);
    return await res.json();
  } finally {
    clearTimeout(timer);
  }
}

async function reverseGeocodeWithMapbox(
  latitude: number,
  longitude: number
): Promise<ReverseGeocodeResult> {
  const token = process.env.MAPBOX_ACCESS_TOKEN;
  if (!nonEmpty(token)) {
    throw new Error("Missing MAPBOX_ACCESS_TOKEN");
  }

  const url =
    "https://api.mapbox.com/geocoding/v5/mapbox.places/" +
    `${encodeURIComponent(longitude)},${encodeURIComponent(latitude)}.json` +
    `?access_token=${encodeURIComponent(token)}` +
    `&types=place,region,country` +
    `&language=en`;

  const data: any = await fetchJsonWithTimeout(url, 6000);
  const features: any[] = Array.isArray(data?.features) ? data.features : [];

  // Mapbox returns multiple features; pick best matches by place_type
  const countryFeat = features.find((f) => Array.isArray(f?.place_type) && f.place_type.includes("country"));
  const regionFeat = features.find((f) => Array.isArray(f?.place_type) && f.place_type.includes("region"));
  const placeFeat = features.find((f) => Array.isArray(f?.place_type) && f.place_type.includes("place"));

  const country = countryFeat?.text;
  const region = regionFeat?.text;
  const city = placeFeat?.text;

  if (!nonEmpty(country) || !nonEmpty(region) || !nonEmpty(city)) {
    throw new Error("Mapbox reverse geocode did not return country/region/city");
  }

  return { country, region, city };
}

async function reverseGeocodeWithBigDataCloud(
  latitude: number,
  longitude: number
): Promise<ReverseGeocodeResult> {
  const url =
    "https://api.bigdatacloud.net/data/reverse-geocode-client" +
    `?latitude=${encodeURIComponent(latitude)}` +
    `&longitude=${encodeURIComponent(longitude)}` +
    `&localityLanguage=en`;

  const data: any = await fetchJsonWithTimeout(url, 6000);

  const country = data?.countryName;
  const region = data?.principalSubdivision;
  const city =
    nonEmpty(data?.city) ? data.city : nonEmpty(data?.locality) ? data.locality : undefined;

  if (!nonEmpty(country) || !nonEmpty(region) || !nonEmpty(city)) {
    throw new Error("BigDataCloud reverse geocode did not return country/region/city");
  }

  return { country, region, city };
}

async function withRetry<T>(fn: () => Promise<T>, attempts: number): Promise<T> {
  let lastErr: unknown;
  for (let i = 0; i < attempts; i++) {
    try {
      return await fn();
    } catch (e) {
      lastErr = e;
      // small backoff
      await new Promise((r) => setTimeout(r, 200 * (i + 1)));
    }
  }
  throw lastErr instanceof Error ? lastErr : new Error("Reverse geocode failed");
}

/**
 * Server-trusted reverse geocode.
 *
 * - Always derives {country, region, city} from the submitted lat/lng.
 * - Prefers Mapbox when configured (industry standard with SLA), otherwise
 *   falls back to BigDataCloud.
 * - Throws if required fields cannot be derived (so stored location is complete).
 */
export async function reverseGeocodeStrict(params: {
  latitude: number;
  longitude: number;
}): Promise<ReverseGeocodeResult> {
  const { latitude, longitude } = params;
  if (!isValidLatLng(latitude, longitude)) {
    throw new Error("Invalid latitude/longitude for reverse geocoding");
  }

  // Prefer a paid/provider-key solution when available.
  if (nonEmpty(process.env.MAPBOX_ACCESS_TOKEN)) {
    return await withRetry(() => reverseGeocodeWithMapbox(latitude, longitude), 2);
  }

  // Fallback (no key required). Still enforced to be complete.
  return await withRetry(() => reverseGeocodeWithBigDataCloud(latitude, longitude), 2);
}

