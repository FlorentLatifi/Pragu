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

/** Truncates toward zero, so a published number is never rounded up. */
export function truncate(value: number, decimals: number): number {
  const factor = 10 ** decimals;
  return Math.trunc(value * factor) / factor;
}

export function formatMetric(value: number | null): string {
  return value === null ? 'n/a' : truncate(value, 2).toFixed(2);
}
