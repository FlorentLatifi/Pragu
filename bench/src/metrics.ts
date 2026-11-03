/** Confusion counts for one rule. True negatives count only labelled correct twins. */
export interface Counts {
  tp: number;
  fp: number;
  fn: number;
  tn: number;
}

export function precision({ tp, fp }: Counts): number | null {
  return tp + fp === 0 ? null : tp / (tp + fp);
}

export function recall({ tp, fn }: Counts): number | null {
  return tp + fn === 0 ? null : tp / (tp + fn);
}

export function f1(counts: Counts): number | null {
  const p = precision(counts);
  const r = recall(counts);
  if (p === null || r === null || p + r === 0) return null;
  return (2 * p * r) / (p + r);
}

/**
 * Matthews correlation coefficient: from -1 (always wrong) through 0 (no better than
 * chance) to 1 (perfect). Unlike accuracy it stays honest when barriers are rare.
 * Undefined (null) when any margin is empty.
 */
export function mcc({ tp, fp, fn, tn }: Counts): number | null {
  const denominator = (tp + fp) * (tp + fn) * (tn + fp) * (tn + fn);
  return denominator === 0 ? null : (tp * tn - fp * fn) / Math.sqrt(denominator);
}

export interface Interval {
  low: number;
  high: number;
}

/**
 * Wilson score interval (E. B. Wilson, 1927) for a proportion of `successes` out of `trials`,
 * 95% by default (z = 1.96):
 *
 *   centre = (p + z²/2n) / (1 + z²/n),   half = z·√(p(1−p)/n + z²/4n²) / (1 + z²/n)
 *
 * Unlike the textbook p ± z·√(p(1−p)/n), it stays inside 0–1 and does not collapse to a
 * zero-width interval at 2 out of 2: it says honestly that two cases prove little.
 */
export function wilson(successes: number, trials: number, z = 1.96): Interval | null {
  if (trials === 0) return null;
  const p = successes / trials;
  const z2 = z * z;
  const denominator = 1 + z2 / trials;
  const centre = (p + z2 / (2 * trials)) / denominator;
  const half = (z * Math.sqrt((p * (1 - p)) / trials + z2 / (4 * trials * trials))) / denominator;
  return { low: Math.max(0, centre - half), high: Math.min(1, centre + half) };
}

/** Published intervals widen, never narrow: the low end is cut down, the high end raised, to 4 decimals. */
export function publishInterval(interval: Interval | null): Interval | null {
  if (interval === null) return null;
  return { low: Math.floor(interval.low * 10_000) / 10_000, high: Math.ceil(interval.high * 10_000) / 10_000 };
}

/** Truncates toward zero, so a published number is never rounded up. */
export function truncate(value: number, decimals: number): number {
  const factor = 10 ** decimals;
  return Math.trunc(value * factor) / factor;
}

export function formatMetric(value: number | null): string {
  return value === null ? 'n/a' : truncate(value, 2).toFixed(2);
}
