import { useMemo, useState } from "react";
import "./ParkingDuration.css";

type Props = {
  initialMinutes: number | null;
  onChoose: (minutes: number | null) => void;
};

const MIN_MINUTES = 15;
const MAX_MINUTES = 480;

function formatDuration(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h === 0) return `${m} min`;
  if (m === 0) return `${h} tim`;
  return `${h} tim ${m} min`;
}

function targetTime(minutes: number, now: Date): string {
  const target = new Date(now.getTime() + minutes * 60_000);
  return target.toLocaleTimeString("sv-SE", { hour: "2-digit", minute: "2-digit" });
}

export function ParkingDuration({ initialMinutes, onChoose }: Props) {
  const [minutes, setMinutes] = useState<number>(initialMinutes ?? 60);
  const now = useMemo(() => new Date(), []);

  return (
    <div className="duration-overlay" role="dialog" aria-modal="true">
      <div className="duration-card">
        <h2>Hur länge ska du parkera?</h2>
        <div className="duration-value">{formatDuration(minutes)}</div>
        <div className="duration-target">till {targetTime(minutes, now)}</div>
        <input
          className="duration-slider"
          type="range"
          min={MIN_MINUTES}
          max={MAX_MINUTES}
          step={15}
          value={minutes}
          onChange={(e) => setMinutes(Number(e.currentTarget.value))}
          aria-label="Parkeringstid i minuter"
        />
        <div className="duration-bounds">
          <span>15 min</span>
          <span>4 tim</span>
          <span>8 tim</span>
        </div>
        <div className="duration-actions">
          <button className="duration-show" onClick={() => onChoose(minutes)}>
            Visa parkeringar
          </button>
          <button className="duration-unknown" onClick={() => onChoose(null)}>
            Vet ej
          </button>
        </div>
      </div>
    </div>
  );
}
