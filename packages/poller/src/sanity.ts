const MIN_RATIO = 0.9;

export type SanityResult = { ok: true } | { ok: false; reason: string };

export function sanityCheck(args: { newCount: number; lastCount: number }): SanityResult {
  const { newCount, lastCount } = args;
  if (lastCount === 0) return { ok: true };
  const ratio = newCount / lastCount;
  if (ratio < MIN_RATIO) {
    return {
      ok: false,
      reason: `count dropped to ${newCount} from ${lastCount} (ratio ${ratio.toFixed(2)} < ${MIN_RATIO})`,
    };
  }
  return { ok: true };
}
