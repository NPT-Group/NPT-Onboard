import type { IGeoLocation } from "@/types/shared.types";

function getTimezoneBestEffort(): string | undefined {
  try {
    return Intl?.DateTimeFormat?.().resolvedOptions?.().timeZone || undefined;
  } catch {
    return undefined;
  }
}

type ReverseGeocodeResult = Pick<IGeoLocation, "country" | "region" | "city">;

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

/**
 * Best-effort reverse geocode to populate { country, region, city }.
 *
 * Uses BigDataCloud's reverse-geocode-client endpoint (no API key required).
 * If the request fails for any reason, returns {} and submission can still proceed
 * with lat/lng/timezone (permission is the hard requirement).
 */
export async function reverseGeocodeBestEffort(
  latitude: number,
  longitude: number,
  opts: { timeoutMs?: number } = {}
): Promise<ReverseGeocodeResult> {
  const timeoutMs = opts.timeoutMs ?? 4000;

  if (typeof window === "undefined") return {};
  if (!isValidLatLng(latitude, longitude)) return {};

  const controller = new AbortController();
  const timer = window.setTimeout(() => controller.abort(), timeoutMs);

  try {
    const url =
      "https://api.bigdatacloud.net/data/reverse-geocode-client" +
      `?latitude=${encodeURIComponent(latitude)}` +
      `&longitude=${encodeURIComponent(longitude)}` +
      `&localityLanguage=en`;

    const res = await fetch(url, {
      method: "GET",
      signal: controller.signal,
      headers: { Accept: "application/json" },
    });

    if (!res.ok) return {};
    const data: any = await res.json();

    const country =
      typeof data?.countryName === "string" ? data.countryName : undefined;
    const region =
      typeof data?.principalSubdivision === "string"
        ? data.principalSubdivision
        : undefined;

    // BigDataCloud sometimes returns "locality" rather than "city"
    const city =
      typeof data?.city === "string" && data.city.trim().length > 0
        ? data.city
        : typeof data?.locality === "string" && data.locality.trim().length > 0
          ? data.locality
          : undefined;

    const out: ReverseGeocodeResult = {};
    if (country) out.country = country;
    if (region) out.region = region;
    if (city) out.city = city;
    return out;
  } catch {
    return {};
  } finally {
    window.clearTimeout(timer);
  }
}

/**
 * Location permission flow:
 * - Location is requested immediately on page entry (page.tsx)
 * - At submit time, we verify we can extract location
 * - If location is missing/invalid, we request again
 * - Submission is blocked without coordinates (product requirement)
 */
export async function ensureGeoAtSubmit(params: {
  geo: IGeoLocation;
  geoDenied: boolean;
}): Promise<IGeoLocation> {
  const { geo, geoDenied } = params;

  const timezone = geo?.timezone || getTimezoneBestEffort();
  const base: IGeoLocation = { ...geo, timezone };

  // Already have coords -> verify they're valid and return
  if (base.latitude != null && base.longitude != null) {
    if (isValidLatLng(base.latitude, base.longitude)) {
      const enrich =
        !base.country || !base.region || !base.city
          ? await reverseGeocodeBestEffort(base.latitude, base.longitude)
          : {};
      return { ...base, ...enrich };
    }
  }

  if (typeof window === "undefined" || !navigator?.geolocation) {
    throw new Error(
      "Geolocation is not available in this browser. Please use a supported browser to submit the form."
    );
  }

  const coords = await new Promise<{ latitude: number; longitude: number }>(
    (resolve, reject) => {
    navigator.geolocation.getCurrentPosition(
      (pos) =>
        resolve({
          latitude: pos.coords.latitude,
          longitude: pos.coords.longitude,
        }),
      (error) => {
        let errorMessage = "Location access is required to submit the form.";

        if (error.code === error.PERMISSION_DENIED) {
          errorMessage =
            "Location permission was denied. Please enable location access in your browser settings and try again.";
        } else if (error.code === error.POSITION_UNAVAILABLE) {
          errorMessage =
            "Location information is unavailable. Please check your device settings and try again.";
        } else if (error.code === error.TIMEOUT) {
          errorMessage =
            "Location request timed out. Please check your connection and try again.";
        } else {
          errorMessage = geoDenied
            ? "Location permission is required to submit. Please enable location access in your browser settings and try again."
            : "Please allow location access to submit the form.";
        }

        reject(new Error(errorMessage));
      },
      { enableHighAccuracy: false, timeout: 10000, maximumAge: 0 }
    );
  });

  const enrich = await reverseGeocodeBestEffort(coords.latitude, coords.longitude);
  return { ...base, ...coords, ...enrich };
}


