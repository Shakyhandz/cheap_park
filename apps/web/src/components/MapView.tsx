import { useEffect, useMemo, useRef, useState } from "react";
import MapGL, { Source, Layer, Marker, type MapRef, type MapLayerMouseEvent } from "react-map-gl/maplibre";
import type { StyleSpecification, ExpressionSpecification } from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import type { Tariff } from "@cheap-park/tariff";
import type { ClientParking } from "../lib/client-model.js";
import { buildMapSource } from "../lib/map-source.js";
import { useGeolocation, nearestCityCenter } from "../lib/geo.js";
import "./MapView.css";

type Props = {
  visible: ClientParking[];
  dimmed: ClientParking[];
  tariffs: Map<string, Tariff>;
  durationMinutes: number | null;
  centers: Record<string, [number, number]>;
  onSelect: (parking: ClientParking) => void;
  onChangeDuration: () => void;
  onOpenFilters: () => void;
  onOpenList: () => void;
};

const OSM_STYLE: StyleSpecification = {
  version: 8,
  // Glyph endpoint is required for the symbol price-label layer to render text.
  glyphs: "https://demotiles.maplibre.org/font/{fontstack}/{range}.pbf",
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

const TIER_COLOR: ExpressionSpecification = [
  "match", ["get", "tier"],
  "green", "#1a7f37",
  "yellow", "#bf8700",
  "red", "#cf222e",
  "#8c959f",
];

export function MapView({
  visible, dimmed, tariffs, durationMinutes, centers,
  onSelect, onChangeDuration, onOpenFilters, onOpenList,
}: Props) {
  const mapRef = useRef<MapRef>(null);
  const { state: geo, request: requestGeo } = useGeolocation();
  const [hasRequestedGeo, setHasRequestedGeo] = useState(false);

  // Tick "now" once a minute so map prices/tiers stay current as time crosses
  // a tariff boundary (e.g. day→evening rate), matching the always-fresh
  // new Date() used by ListView/DetailSheet/filtering.
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 60_000);
    return () => clearInterval(id);
  }, []);

  const byId = useMemo(() => {
    const m = new Map<string, ClientParking>();
    for (const p of [...visible, ...dimmed]) m.set(p.id, p);
    return m;
  }, [visible, dimmed]);

  const source = useMemo(
    () => buildMapSource(visible, dimmed, tariffs, durationMinutes, now),
    [visible, dimmed, tariffs, durationMinutes, now],
  );

  const initialCenter = useMemo(() => nearestCityCenter(null, centers), [centers]);

  // Distinguishes the two ways geolocation gets used:
  //  - initial auto-request on mount → center on the nearest city (startup viewport),
  //  - explicit "Min position" (◎) tap → fly to the user's actual coordinates.
  const wantUserCenter = useRef(false);

  useEffect(() => {
    if (!hasRequestedGeo) { requestGeo(); setHasRequestedGeo(true); }
  }, [hasRequestedGeo, requestGeo]);

  useEffect(() => {
    if (geo.status !== "granted" || !mapRef.current) return;
    if (wantUserCenter.current) {
      wantUserCenter.current = false;
      mapRef.current.flyTo({ center: [geo.lng, geo.lat], zoom: 15 });
    } else {
      mapRef.current.flyTo({ center: nearestCityCenter({ lat: geo.lat, lng: geo.lng }, centers), zoom: 13 });
    }
  }, [geo, centers]);

  const onLocate = () => {
    wantUserCenter.current = true;
    // If geolocation is already granted, geo won't change, so the effect won't
    // re-fire — recenter directly. Otherwise request and let the effect handle it.
    if (geo.status === "granted" && mapRef.current) {
      wantUserCenter.current = false;
      mapRef.current.flyTo({ center: [geo.lng, geo.lat], zoom: 15 });
    } else {
      requestGeo();
    }
  };

  const onMapClick = (e: MapLayerMouseEvent) => {
    const f = e.features?.[0];
    if (!f) return;
    const id = f.properties?.["id"] as string | undefined;
    if (id && byId.has(id)) onSelect(byId.get(id)!);
  };

  return (
    <div className="map-container">
      <MapGL
        ref={mapRef}
        initialViewState={{ longitude: initialCenter[0], latitude: initialCenter[1], zoom: 12 }}
        mapStyle={OSM_STYLE}
        attributionControl={true}
        interactiveLayerIds={["parking-points", "parking-lines"]}
        onClick={onMapClick}
      >
        <Source id="parkings" type="geojson" data={source}>
          <Layer
            id="parking-lines"
            type="line"
            filter={["match", ["geometry-type"], ["LineString", "MultiLineString"], true, false]}
            paint={{
              "line-color": TIER_COLOR,
              "line-width": 4,
              "line-opacity": ["case", ["get", "dimmed"], 0.3, 0.9],
            }}
          />
          <Layer
            id="parking-points"
            type="circle"
            filter={["==", ["geometry-type"], "Point"]}
            paint={{
              "circle-color": TIER_COLOR,
              "circle-radius": 6,
              "circle-stroke-color": "#fff",
              "circle-stroke-width": 1.5,
              "circle-opacity": ["case", ["get", "dimmed"], 0.35, 1],
            }}
          />
          <Layer
            id="parking-labels"
            type="symbol"
            minzoom={14}
            layout={{
              "text-field": ["get", "label"],
              "text-size": 12,
              "text-font": ["Noto Sans Regular"],
              "text-anchor": "top",
              "text-offset": [0, 0.6],
              "text-allow-overlap": false,
              "symbol-sort-key": ["case", ["get", "dimmed"], 1, 0],
            }}
            paint={{
              "text-color": "#1f2328",
              "text-halo-color": "#fff",
              "text-halo-width": 1.5,
              "text-opacity": ["case", ["get", "dimmed"], 0.5, 1],
            }}
          />
        </Source>
        {geo.status === "granted" && (
          <Marker latitude={geo.lat} longitude={geo.lng} anchor="center">
            <div style={{ width: 14, height: 14, borderRadius: "50%", background: "#1f6feb", border: "3px solid #fff", boxShadow: "0 0 0 4px rgba(31,111,235,0.25)" }} />
          </Marker>
        )}
      </MapGL>
      <div className="map-toolbar">
        <button className="map-chip" onClick={onChangeDuration}>
          {durationMinutes === null ? "Vet ej tid" : `Tid: ${Math.floor(durationMinutes / 60)} tim ${durationMinutes % 60} min`}
        </button>
        <button className="map-chip" onClick={onOpenFilters}>Filter</button>
      </div>
      <div className="map-fab-row">
        <button className="map-fab" onClick={onOpenList} aria-label="Lista">≡</button>
        <button className="map-fab" onClick={onLocate} aria-label="Min position">◎</button>
      </div>
    </div>
  );
}
