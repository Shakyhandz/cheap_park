import { useEffect, useMemo, useRef, useState } from "react";
import Map, { Marker, type MapRef } from "react-map-gl/maplibre";
import type { StyleSpecification } from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import type { Parking, Tariff } from "@cheap-park/tariff";
import { tariffFor } from "../lib/data.js";
import { hourlyRate, priceLabel, totalLabel } from "../lib/prices.js";
import { tierForViewport, type Tier } from "../lib/colors.js";
import { BRUNNSPARKEN, useGeolocation } from "../lib/geo.js";
import "./MapView.css";

type Props = {
  visible: Parking[];
  dimmed: Parking[];
  tariffs: Map<string, Tariff>;
  durationMinutes: number | null;
  onSelect: (parking: Parking) => void;
  onChangeDuration: () => void;
  onOpenFilters: () => void;
  onOpenList: () => void;
};

const OSM_STYLE: StyleSpecification = {
  version: 8,
  sources: {
    osm: {
      type: "raster",
      tiles: ["https://tile.openstreetmap.org/{z}/{x}/{y}.png"],
      tileSize: 256,
      attribution: "&copy; <a href='https://www.openstreetmap.org/copyright'>OpenStreetMap contributors</a>",
    },
  },
  layers: [{ id: "osm", type: "raster", source: "osm" }],
};

function tierClassFor(tier: Tier): string {
  return tier;
}

export function MapView({
  visible,
  dimmed,
  tariffs,
  durationMinutes,
  onSelect,
  onChangeDuration,
  onOpenFilters,
  onOpenList,
}: Props) {
  const mapRef = useRef<MapRef>(null);
  const { state: geo, request: requestGeo } = useGeolocation();
  const [hasRequestedGeo, setHasRequestedGeo] = useState(false);
  const now = useMemo(() => new Date(), []);

  useEffect(() => {
    if (!hasRequestedGeo) {
      requestGeo();
      setHasRequestedGeo(true);
    }
  }, [hasRequestedGeo, requestGeo]);

  useEffect(() => {
    if (geo.status === "granted" && mapRef.current) {
      mapRef.current.flyTo({ center: [geo.lng, geo.lat], zoom: 15 });
    }
  }, [geo]);

  const all = [...visible, ...dimmed];
  const dimmedIds = new Set(dimmed.map((p) => p.id));
  const allRates = all.map((p) => hourlyRate(tariffFor(p, tariffs), now));

  return (
    <div className="map-container">
      <Map
        ref={mapRef}
        initialViewState={{
          longitude: BRUNNSPARKEN.lng,
          latitude: BRUNNSPARKEN.lat,
          zoom: 14,
        }}
        mapStyle={OSM_STYLE}
        attributionControl={true}
      >
        {all.map((parking, i) => {
          const tariff = tariffFor(parking, tariffs);
          const rate = allRates[i] ?? null;
          const tier = tierForViewport(allRates, rate);
          const isDim = dimmedIds.has(parking.id);
          const label =
            durationMinutes !== null
              ? totalLabel(tariff, now, durationMinutes)
              : priceLabel(tariff, now);
          return (
            <Marker key={parking.id} latitude={parking.lat} longitude={parking.lng} anchor="center">
              <button
                className={`parking-pin ${tierClassFor(tier)}${isDim ? " dimmed" : ""}`}
                onClick={(e) => {
                  e.stopPropagation();
                  onSelect(parking);
                }}
                aria-label={`${parking.name} — ${label}`}
              >
                {label}
              </button>
            </Marker>
          );
        })}
        {geo.status === "granted" && (
          <Marker latitude={geo.lat} longitude={geo.lng} anchor="center">
            <div
              style={{
                width: 14,
                height: 14,
                borderRadius: "50%",
                background: "#1f6feb",
                border: "3px solid #fff",
                boxShadow: "0 0 0 4px rgba(31,111,235,0.25)",
              }}
            />
          </Marker>
        )}
      </Map>
      <div className="map-toolbar">
        <button className="map-chip" onClick={onChangeDuration}>
          {durationMinutes === null
            ? "Vet ej tid"
            : `Tid: ${Math.floor(durationMinutes / 60)} tim ${durationMinutes % 60} min`}
        </button>
        <button className="map-chip" onClick={onOpenFilters}>
          Filter
        </button>
      </div>
      <div className="map-fab-row">
        <button className="map-fab" onClick={onOpenList} aria-label="Lista">
          ≡
        </button>
        <button className="map-fab" onClick={requestGeo} aria-label="Min position">
          ◎
        </button>
      </div>
    </div>
  );
}
