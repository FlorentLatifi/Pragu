import { describe, expect, it } from 'vitest';
import { evaluate } from '../src/evaluate.js';
import { publishInterval, wilson } from '../src/metrics.js';
import { renderMarkdown } from '../src/report.js';

describe('wilson', () => {
  it('is null when there are no trials', () => {
    expect(wilson(0, 0)).toBeNull();
  });

  it('gives a wide interval for 2 out of 2 and a narrow one for 40 out of 40', () => {
    const two = wilson(2, 2);
    const forty = wilson(40, 40);
    expect(two?.low).toBeCloseTo(0.3424, 4);
    expect(forty?.low).toBeCloseTo(0.9124, 4);
    expect((two?.high ?? 0) - (two?.low ?? 0)).toBeGreaterThan(0.6);
  });

  it('stays inside 0 and 1, also for 0 out of n and n out of n', () => {
    for (const [k, n] of [
      [0, 5],
      [5, 5],
      [1, 1],
      [0, 1],
    ]) {
      const interval = wilson(k ?? 0, n ?? 1);
      expect(interval?.low).toBeGreaterThanOrEqual(0);
      expect(interval?.high).toBeLessThanOrEqual(1);
    }
  });

  it('matches a published reference value to four decimals', () => {
    // 81 out of 263 at 95%: 0.2553 to 0.3662 (Newcombe 1998, method 3).
    const interval = wilson(81, 263);
    expect(interval?.low).toBeCloseTo(0.2553, 4);
    expect(interval?.high).toBeCloseTo(0.3662, 4);
  });

  it('appears in results and the published table, widened outward, never narrowed', () => {
    expect(publishInterval({ low: 0.34245, high: 0.98761 })).toEqual({ low: 0.3424, high: 0.9877 });
    const screen = {
      id: 's',
      name: 'S',
      url: '',
      marker: '',
      barriers: [{ rule: 'r', testID: 'a' }],
      correctTwins: [],
    };
    const result = evaluate(
      [{ fixture: 'f', screen, issues: [{ ruleId: 'r', resourceId: 'a', nodeId: '0' } as never] }],
      [{ id: 'r', severity: 'error' }],
    );
    expect(result.rules[0]?.precisionInterval?.low).toBe(0.2065);
    expect(renderMarkdown(result)).toContain('1.00 [0.20, 1.00]');
  });
});
