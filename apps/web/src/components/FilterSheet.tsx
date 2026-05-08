import { useState } from "react";
import "./DetailSheet.css"; // reuses overlay/backdrop/sheet styles
import "./FilterSheet.css";
import type { FilterState } from "../lib/url-state.js";

type Props = {
  open: boolean;
  initial: FilterState;
  onApply: (next: FilterState) => void;
  onClose: () => void;
};

const MAX_DEFAULT = 60;
const MAX_MIN = 5;
const MAX_MAX = 200;

export function FilterSheet({ open, initial, onApply, onClose }: Props) {
  const [state, setState] = useState<FilterState>(initial);

  return (
    <div className={`detail-overlay${open ? " open" : ""}`} aria-hidden={!open}>
      <div className="detail-backdrop" onClick={onClose} />
      <div className="detail-sheet" role="dialog" aria-modal="true">
        <div className="detail-handle" />
        <h3 className="detail-name">Filter</h3>

        <div className="filter-row">
          <label htmlFor="f-free">Endast avgiftsfri</label>
          <input
            id="f-free"
            type="checkbox"
            checked={state.free}
            onChange={(e) => setState({ ...state, free: e.currentTarget.checked })}
          />
        </div>

        <div className="filter-row">
          <label htmlFor="f-acc">Handikapp</label>
          <input
            id="f-acc"
            type="checkbox"
            checked={state.accessible}
            onChange={(e) => setState({ ...state, accessible: e.currentTarget.checked })}
          />
        </div>

        <div className="filter-row">
          <label htmlFor="f-long">Endast långtid (≥6 tim)</label>
          <input
            id="f-long"
            type="checkbox"
            checked={state.longTerm}
            onChange={(e) => setState({ ...state, longTerm: e.currentTarget.checked })}
          />
        </div>

        <div className="filter-slider-row">
          <div className="label-row">
            <span>Max pris per timme</span>
            <span className="max-value">
              {state.maxPricePerHour === null ? "Av" : `${state.maxPricePerHour} kr`}
            </span>
          </div>
          <input
            type="range"
            min={MAX_MIN}
            max={MAX_MAX}
            step={5}
            value={state.maxPricePerHour ?? MAX_DEFAULT}
            onChange={(e) => setState({ ...state, maxPricePerHour: Number(e.currentTarget.value) })}
            aria-label="Max pris per timme"
          />
          {state.maxPricePerHour !== null && (
            <button
              style={{
                marginTop: 8,
                background: "transparent",
                border: "none",
                color: "var(--muted)",
                fontSize: 13,
                cursor: "pointer",
              }}
              onClick={() => setState({ ...state, maxPricePerHour: null })}
            >
              Stäng av max-pris
            </button>
          )}
        </div>

        <div className="filter-buttons">
          <button
            className="reset"
            onClick={() => {
              setState({
                free: false,
                accessible: false,
                longTerm: false,
                maxPricePerHour: null,
              });
            }}
          >
            Återställ
          </button>
          <button className="apply" onClick={() => onApply(state)}>
            Visa
          </button>
        </div>
      </div>
    </div>
  );
}
