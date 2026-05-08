import { useEffect, useState, useCallback } from "react";
import type { Parking } from "@cheap-park/tariff";
import { loadSnapshot, tariffFor, type Snapshot } from "./lib/data.js";
import { readState, writeState, defaultState, type AppState } from "./lib/url-state.js";
import { applyFilters, type FilterResult } from "./lib/filter.js";
import { ParkingDuration } from "./components/ParkingDuration.js";
import { MapView } from "./components/MapView.js";
import { DetailSheet } from "./components/DetailSheet.js";
import { FilterSheet } from "./components/FilterSheet.js";
import { ListView } from "./components/ListView.js";

const DATA_BASE = `${import.meta.env.BASE_URL}data`;
const STALE_DAYS = 7;

function isStale(generatedAt: Date): boolean {
  const ageDays = (Date.now() - generatedAt.getTime()) / (24 * 3600 * 1000);
  return ageDays > STALE_DAYS;
}

function pushUrlState(state: AppState) {
  const params = writeState(state);
  const queryString = params.toString();
  const url = queryString ? `?${queryString}` : window.location.pathname;
  window.history.replaceState(null, "", url);
}

export function App() {
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [state, setState] = useState<AppState>(() =>
    readState(new URLSearchParams(window.location.search)),
  );

  // Show duration popup on first open if not already in URL
  const [durationOpen, setDurationOpen] = useState(() => {
    const initial = readState(new URLSearchParams(window.location.search));
    return initial.durationMinutes === null && !window.location.search.includes("duration");
  });

  const [filterOpen, setFilterOpen] = useState(false);
  const [listOpen, setListOpen] = useState(false);
  const [selected, setSelected] = useState<Parking | null>(null);

  useEffect(() => {
    loadSnapshot({ basePath: DATA_BASE })
      .then(setSnapshot)
      .catch((err: Error) => setError(err.message));
  }, []);

  useEffect(() => {
    pushUrlState(state);
  }, [state]);

  const onChooseDuration = useCallback((minutes: number | null) => {
    setState((s) => ({ ...s, durationMinutes: minutes }));
    setDurationOpen(false);
  }, []);

  const onApplyFilters = useCallback((filters: AppState["filters"]) => {
    setState((s) => ({ ...s, filters }));
    setFilterOpen(false);
  }, []);

  if (error) {
    return (
      <div className="app-shell">
        <div className="app-error">
          <h2>Kunde inte ladda data</h2>
          <p>{error}</p>
          <button onClick={() => window.location.reload()}>Försök igen</button>
        </div>
      </div>
    );
  }

  if (!snapshot) {
    return (
      <div className="app-shell">
        <div className="app-loading">Laddar parkeringar…</div>
      </div>
    );
  }

  const filtered: FilterResult = applyFilters(snapshot.parkings, snapshot.tariffs, state, new Date());

  return (
    <div className="app-shell">
      {isStale(snapshot.generatedAt) && (
        <div className="stale-banner">
          Data senast uppdaterad {snapshot.generatedAt.toLocaleDateString("sv-SE")} — kan vara inaktuell.
        </div>
      )}
      {listOpen ? (
        <ListView
          visible={filtered.visible}
          dimmed={filtered.dimmed}
          tariffs={snapshot.tariffs}
          durationMinutes={state.durationMinutes}
          onSelect={(p) => {
            setSelected(p);
            setListOpen(false);
          }}
        />
      ) : (
        <MapView
          visible={filtered.visible}
          dimmed={filtered.dimmed}
          tariffs={snapshot.tariffs}
          durationMinutes={state.durationMinutes}
          onSelect={setSelected}
          onChangeDuration={() => setDurationOpen(true)}
          onOpenFilters={() => setFilterOpen(true)}
          onOpenList={() => setListOpen(true)}
        />
      )}

      {durationOpen && (
        <ParkingDuration initialMinutes={state.durationMinutes} onChoose={onChooseDuration} />
      )}

      <FilterSheet
        open={filterOpen}
        initial={state.filters}
        onApply={onApplyFilters}
        onClose={() => setFilterOpen(false)}
      />

      <DetailSheet
        parking={selected}
        tariff={selected ? tariffFor(selected, snapshot.tariffs) : null}
        durationMinutes={state.durationMinutes}
        onClose={() => setSelected(null)}
      />

      {listOpen && (
        <button
          onClick={() => setListOpen(false)}
          style={{
            position: "fixed",
            top: 12,
            right: 12,
            zIndex: 50,
            padding: "8px 14px",
            borderRadius: 20,
            background: "var(--surface)",
            border: "none",
            fontSize: 14,
            fontWeight: 600,
            boxShadow: "0 2px 6px rgba(0,0,0,0.15)",
            cursor: "pointer",
          }}
        >
          Karta
        </button>
      )}
    </div>
  );
}
