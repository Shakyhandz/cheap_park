export type TariffRule = {
  daysOfWeek: number[];      // 0=Sun..6=Sat. Empty = all days.
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

export type Parking = {
  id: string;
  name: string;
  owner: string;
  lat: number;
  lng: number;
  spaces: number;
  tariffId: string | null;
  maxParkingMinutes: number | null;
  raw: Record<string, string>;
};

export type ParkingsSnapshot = {
  generatedAt: string;
  source: string;
  parkings: Parking[];
};

export type TariffsSnapshot = {
  tariffs: Tariff[];
};
