import type { Calendar, DayClass } from "./holidays.js";

export type { DayClass } from "./holidays.js";

export type TariffRule = {
  daysOfWeek: number[];      // 0=Sun..6=Sat. Empty = all days.
  dayClasses?: DayClass[];   // Absent/empty = no day-class restriction.
  hourStart: number;          // 0..24, decimal allowed
  hourEnd: number;            // 0..24, exclusive. 24 = end of day.
  pricePerHour: number;       // SEK per hour. 0 = free.
  maxPerDay?: number | null;  // SEK cap per calendar day, if any.
};

export type Tariff = {
  id: string;
  name: string;
  rules: TariffRule[];
};

export type TariffsSnapshot = {
  tariffs: Tariff[];
};

export type CityId = "goteborg" | "stockholm";
export type Vehicle = "bilar";

export type CityMeta = {
  source: string;
  timeZone: string;        // IANA, e.g. "Europe/Stockholm"
  holidayCalendar: Calendar;
  center: [number, number]; // [lng, lat]
};

export type ParkingProperties = {
  id: string;              // "gbg:…" / "sthlm:…"
  city: CityId;
  vehicle: Vehicle;
  name: string;
  provider: string;
  tariffId: string | null;
  rulesText: string;
  accessible: boolean;
  spaces: number | null;
  maxParkingMinutes: number | null;
};

export type PointGeometry = { type: "Point"; coordinates: [number, number] };
export type LineGeometry = { type: "LineString"; coordinates: [number, number][] };
export type MultiLineGeometry = { type: "MultiLineString"; coordinates: [number, number][][] };
export type ParkingGeometry = PointGeometry | LineGeometry | MultiLineGeometry;

export type ParkingFeature = {
  type: "Feature";
  geometry: ParkingGeometry;
  properties: ParkingProperties;
};

export type ParkingFeatureCollection = {
  type: "FeatureCollection";
  generatedAt: string;
  cities: Record<CityId, CityMeta>;
  features: ParkingFeature[];
};
