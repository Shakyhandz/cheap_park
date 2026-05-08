import type { Parking, Tariff } from "@cheap-park/tariff";
import { priceLabel, totalLabel, hourlyRate } from "../lib/prices.js";
import { tariffFor } from "../lib/data.js";
import { tierForViewport } from "../lib/colors.js";
import "./ListView.css";

type Props = {
  visible: Parking[];
  dimmed: Parking[];
  tariffs: Map<string, Tariff>;
  durationMinutes: number | null;
  onSelect: (parking: Parking) => void;
};

export function ListView({ visible, dimmed, tariffs, durationMinutes, onSelect }: Props) {
  const now = new Date();

  // Sort visible by hourly rate, ascending. null/n/a goes last.
  const sortedVisible = [...visible].sort((a, b) => {
    const ra = hourlyRate(tariffFor(a, tariffs), now);
    const rb = hourlyRate(tariffFor(b, tariffs), now);
    if (ra === null && rb === null) return 0;
    if (ra === null) return 1;
    if (rb === null) return -1;
    return ra - rb;
  });
  const sortedDimmed = [...dimmed].sort((a, b) => {
    const ra = hourlyRate(tariffFor(a, tariffs), now) ?? Infinity;
    const rb = hourlyRate(tariffFor(b, tariffs), now) ?? Infinity;
    return ra - rb;
  });

  const all = [...sortedVisible, ...sortedDimmed];
  const allRates = all.map((p) => hourlyRate(tariffFor(p, tariffs), now));

  return (
    <div className="list-view">
      {all.map((parking, i) => {
        const tariff = tariffFor(parking, tariffs);
        const rate = allRates[i] ?? null;
        const tier = tierForViewport(allRates, rate);
        const dim = sortedDimmed.includes(parking);
        return (
          <div
            key={parking.id}
            className={`list-row${dim ? " dimmed" : ""}`}
            onClick={() => onSelect(parking)}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => {
              if (e.key === "Enter") onSelect(parking);
            }}
          >
            <div>
              <div className="name">{parking.name || parking.id}</div>
              <div className="meta">{parking.owner}</div>
            </div>
            <div className={`price ${tier}`}>
              {durationMinutes !== null
                ? totalLabel(tariff, now, durationMinutes)
                : priceLabel(tariff, now)}
            </div>
          </div>
        );
      })}
      {all.length === 0 && (
        <div style={{ padding: 32, textAlign: "center", color: "var(--muted)" }}>
          Inga parkeringar matchar dina filter.
        </div>
      )}
    </div>
  );
}
