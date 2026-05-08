export type FilterState = {
  free: boolean;
  accessible: boolean;
  longTerm: boolean;
  maxPricePerHour: number | null;
};

export type AppState = {
  durationMinutes: number | null;
  filters: FilterState;
};

export const defaultState: AppState = {
  durationMinutes: null,
  filters: {
    free: false,
    accessible: false,
    longTerm: false,
    maxPricePerHour: null,
  },
};

function parseInt10(v: string | null): number | null {
  if (v === null) return null;
  const n = parseInt(v, 10);
  return Number.isFinite(n) ? n : null;
}

function parseBool(v: string | null): boolean {
  return v === "1";
}

export function readState(params: URLSearchParams): AppState {
  return {
    durationMinutes: parseInt10(params.get("duration")),
    filters: {
      free: parseBool(params.get("free")),
      accessible: parseBool(params.get("accessible")),
      longTerm: parseBool(params.get("long")),
      maxPricePerHour: parseInt10(params.get("max")),
    },
  };
}

export function writeState(state: AppState): URLSearchParams {
  const p = new URLSearchParams();
  if (state.durationMinutes !== null) p.set("duration", String(state.durationMinutes));
  if (state.filters.free) p.set("free", "1");
  if (state.filters.accessible) p.set("accessible", "1");
  if (state.filters.longTerm) p.set("long", "1");
  if (state.filters.maxPricePerHour !== null) p.set("max", String(state.filters.maxPricePerHour));
  return p;
}
