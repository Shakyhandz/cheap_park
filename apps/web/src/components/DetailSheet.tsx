import { useEffect } from "react";
import type { Tariff } from "@cheap-park/tariff";
import type { ClientParking } from "../lib/client-model.js";
import { priceLabel, totalLabel } from "../lib/prices.js";
import "./DetailSheet.css";

type Props = {
  parking: ClientParking | null;
  tariff: Tariff | null;
  durationMinutes: number | null;
  onClose: () => void;
};

function directionsUrl(parking: ClientParking): string {
  // Cross-platform "open in maps" — Apple/Google Maps both accept this query.
  return `https://www.google.com/maps/dir/?api=1&destination=${parking.displayPoint.lat},${parking.displayPoint.lng}`;
}

function maxParkingLabel(parking: ClientParking): string {
  if (parking.maxParkingMinutes === null) return "Ingen begränsning";
  const h = Math.floor(parking.maxParkingMinutes / 60);
  const m = parking.maxParkingMinutes % 60;
  if (h === 0) return `Max ${m} min`;
  if (m === 0) return `Max ${h} tim`;
  return `Max ${h} tim ${m} min`;
}

export function DetailSheet({ parking, tariff, durationMinutes, onClose }: Props) {
  useEffect(() => {
    if (!parking) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [parking, onClose]);

  const open = parking !== null;
  const now = new Date();

  return (
    <div className={`detail-overlay${open ? " open" : ""}`} aria-hidden={!open}>
      <div className="detail-backdrop" onClick={onClose} />
      <div className="detail-sheet" role="dialog" aria-modal="true">
        <div className="detail-handle" />
        {parking && (
          <>
            <h3 className="detail-name">{parking.name || parking.id}</h3>
            <div className="detail-owner">{parking.provider}</div>

            <div className="detail-prices">
              <div className="detail-price-block">
                <div className="label">Just nu</div>
                <div className="value">{priceLabel(tariff, now, parking.ctx)}</div>
              </div>
              {durationMinutes !== null && (
                <div className="detail-price-block">
                  <div className="label">Total</div>
                  <div className="value">{totalLabel(tariff, now, durationMinutes, parking.ctx)}</div>
                </div>
              )}
            </div>

            <div className="detail-rules">
              <strong>{maxParkingLabel(parking)}</strong>
              {"\n"}
              {parking.rulesText}
            </div>

            <div className="detail-actions">
              <button className="secondary" onClick={onClose}>
                Stäng
              </button>
              <a className="primary" href={directionsUrl(parking)} target="_blank" rel="noopener">
                Vägbeskrivning
              </a>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
