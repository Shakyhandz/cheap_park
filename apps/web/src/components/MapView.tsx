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
  const now = useMemo(() => new Date(), []);

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

  useEffect(() => {
    if (!hasRequestedGeo) { requestGeo(); setHasRequestedGeo(true); }
  }, [hasRequestedGeo, requestGeo]);

  useEffect(() => {
    if (geo.status === "granted" && mapRef.current) {
      const c = nearestCityCenter({ lat: geo.lat, lng: geo.lng }, centers);
      mapRef.current.flyTo({ center: c, zoom: 13 });
    }
  }, [geo, centers]);

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
        <button className="map-fab" onClick={requestGeo} aria-label="Min position">◎</button>
      </div>
    </div>
  );
}
