// Seed of Pragu Bench: compares a scan result with a fixture's ground truth and
// prints true/false positives and negatives. Exits 1 on any mismatch.
// Usage: node scripts/verify-fixture.mjs <pragu-result.json> <expected.json>
import { readFileSync } from 'node:fs';

const [resultPath, expectedPath] = process.argv.slice(2);
if (resultPath === undefined || expectedPath === undefined) {
  console.error('Usage: node scripts/verify-fixture.mjs <pragu-result.json> <expected.json>');
  process.exit(2);
}
const result = JSON.parse(readFileSync(resultPath, 'utf8'));
const expected = JSON.parse(readFileSync(expectedPath, 'utf8'));

const key = (rule, id) => `${rule} @ ${id}`;
const reported = new Set(result.issues.map((issue) => key(issue.ruleId, issue.resourceId ?? `node ${issue.nodeId}`)));
const barriers = expected.screens.flatMap((screen) => screen.barriers.map((b) => key(b.rule, b.testID)));
const twins = expected.screens.flatMap((screen) => screen.correctTwins.map((t) => key(t.rule, t.testID)));

const truePositives = barriers.filter((b) => reported.has(b));
const falseNegatives = barriers.filter((b) => !reported.has(b));
const falsePositives = [...reported].filter((r) => !barriers.includes(r));
const trueNegatives = twins.filter((t) => !reported.has(t));

const line = (label, items) =>
  console.log(`${label.padEnd(16)} ${String(items.length).padStart(2)}  ${items.join(', ')}`);
line('True positives', truePositives);
line('False negatives', falseNegatives);
line('False positives', falsePositives);
line('True negatives', trueNegatives);
console.log(
  `Precision ${truePositives.length}/${truePositives.length + falsePositives.length} · Recall ${truePositives.length}/${barriers.length}`,
);

process.exit(falseNegatives.length === 0 && falsePositives.length === 0 ? 0 : 1);
