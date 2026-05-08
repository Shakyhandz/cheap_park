import { useCallback, useState } from "react";

export const BRUNNSPARKEN = { lat: 57.7068, lng: 11.9685 } as const;

export type GeoState =
  | { status: "unknown"; lat: number; lng: number }
  | { status: "granted"; lat: number; lng: number }
  | { status: "denied"; lat: number; lng: number; reason: string };

export function useGeolocation(): { state: GeoState; request: () => void } {
  const [state, setState] = useState<GeoState>({ status: "unknown", ...BRUNNSPARKEN });

  const request = useCallback(() => {
    if (!("geolocation" in navigator)) {
      setState({ status: "denied", ...BRUNNSPARKEN, reason: "geolocation not supported" });
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setState({ status: "granted", lat: pos.coords.latitude, lng: pos.coords.longitude });
      },
      (err) => {
        setState({ status: "denied", ...BRUNNSPARKEN, reason: err.message });
      },
      { enableHighAccuracy: false, timeout: 10000, maximumAge: 60000 },
    );
  }, []);

  return { state, request };
}
