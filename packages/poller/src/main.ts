import { writeFile, readFile, mkdir } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import type { Parking, ParkingsSnapshot, TariffsSnapshot } from "@cheap-park/tariff";
import { fetchAllParkings, type RawParking } from "./fetch.js";
import { normalize } from "./normalize.js";
import { sanityCheck } from "./sanity.js";
import { KNOWN_TARIFFS } from "./tariff-templates.js";

// Resolve data paths from this file's location, not from process.cwd().
// `npm run poll --workspace @cheap-park/poller` runs from the workspace dir,
// so a relative path would land under packages/poller/ instead of repo root.
const REPO_ROOT = resolve(fileURLToPath(import.meta.url), "../../../..");
const PARKINGS_PATH = resolve(REPO_ROOT, "apps/web/public/data/parkings.json");
const TARIFFS_PATH = resolve(REPO_ROOT, "apps/web/public/data/tariffs.json");
const SOURCE = "data.goteborg.se ParkingService v2.1";

export type RunOptions = {
  appId: string;
  readPrevious: () => Promise<{ parkings: { id: string }[] }>;
  writeJson: (path: string, data: unknown) => Promise<void>;
  fetcher: (appId: string) => Promise<{ toll: RawParking[]; time: RawParking[] }>;
};

export type RunResult =
  | { committed: true; count: number }
  | { committed: false; reason: string };

export async function runPoll(opts: RunOptions): Promise<RunResult> {
  const raw = await opts.fetcher(opts.appId);
  const parkings: Parking[] = normalize(raw);

  const previous = await opts.readPrevious();
  const sanity = sanityCheck({ newCount: parkings.length, lastCount: previous.parkings.length });
  if (!sanity.ok) return { committed: false, reason: sanity.reason };

  const usedTariffIds = new Set(parkings.map((p) => p.tariffId).filter((x): x is string => x !== null));
  const usedTariffs = KNOWN_TARIFFS.filter((t) => usedTariffIds.has(t.id));

  const snapshot: ParkingsSnapshot = {
    generatedAt: new Date().toISOString(),
    source: SOURCE,
    parkings,
  };
  const tariffs: TariffsSnapshot = { tariffs: usedTariffs };

  await opts.writeJson(PARKINGS_PATH, snapshot);
  await opts.writeJson(TARIFFS_PATH, tariffs);

  return { committed: true, count: parkings.length };
}

async function readPreviousFromDisk(): Promise<{ parkings: { id: string }[] }> {
  try {
    const text = await readFile(PARKINGS_PATH, "utf8");
    return JSON.parse(text) as { parkings: { id: string }[] };
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === "ENOENT") {
      return { parkings: [] };
    }
    // Corrupt JSON or any other read error should abort, not bypass the sanity gate.
    throw err;
  }
}

async function writeJsonToDisk(path: string, data: unknown): Promise<void> {
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, JSON.stringify(data, null, 2) + "\n", "utf8");
}

const isMain =
  typeof process.argv[1] === "string" && fileURLToPath(import.meta.url) === process.argv[1];

if (isMain) {
  const appId = process.env["GBG_APPID"];
  if (!appId) {
    console.error("GBG_APPID env var is required");
    process.exit(1);
  }

  runPoll({
    appId,
    readPrevious: readPreviousFromDisk,
    writeJson: writeJsonToDisk,
    fetcher: fetchAllParkings,
  })
    .then((result) => {
      if (result.committed) {
        console.log(`OK: wrote ${result.count} parkings`);
      } else {
        console.error(`ABORT: ${result.reason}`);
        process.exit(2);
      }
    })
    .catch((err) => {
      console.error("FAIL:", err);
      process.exit(1);
    });
}
