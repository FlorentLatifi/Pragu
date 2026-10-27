// Ground truth lives with each fixture (fixtures/<name>/expected.json). Elements are
// identified by testID, which React Native exposes to accessibility tools as the
// view's resource id, so labels survive layout changes.

export interface LabelledElement {
  rule: string;
  testID: string;
  note?: string;
}

export interface TruthScreen {
  id: string;
  name: string;
  /** Deep link that opens the screen, e.g. rnshop://product. */
  url: string;
  /** testID present only on this screen; proves the recording shows the right one. */
  marker: string;
  barriers: LabelledElement[];
  correctTwins: LabelledElement[];
}

export interface GroundTruth {
  fixture: string;
  appId: string;
  screens: TruthScreen[];
}

export function parseGroundTruth(value: unknown, source: string): GroundTruth {
  const truth = record(value, source);
  const fixture = text(truth, 'fixture', source);
  const appId = text(truth, 'appId', source);
  if (!Array.isArray(truth.screens) || truth.screens.length === 0) {
    throw new Error(`${source}: "screens" must be a non-empty array.`);
  }
  const ids = new Set<string>();
  const screens = truth.screens.map((item: unknown, index) => {
    const path = `${source} screens[${String(index)}]`;
    const screen = record(item, path);
    const id = text(screen, 'id', path);
    if (ids.has(id)) throw new Error(`${path}: duplicate screen id "${id}".`);
    ids.add(id);
    return {
      id,
      name: text(screen, 'name', path),
      url: text(screen, 'url', path),
      marker: text(screen, 'marker', path),
      barriers: elements(screen.barriers, `${path}.barriers`),
      correctTwins: elements(screen.correctTwins, `${path}.correctTwins`),
    };
  });
  return { fixture, appId, screens };
}

function elements(value: unknown, path: string): LabelledElement[] {
  if (!Array.isArray(value)) throw new Error(`${path} must be an array.`);
  return value.map((item: unknown, index) => {
    const itemPath = `${path}[${String(index)}]`;
    const entry = record(item, itemPath);
    const element: LabelledElement = { rule: text(entry, 'rule', itemPath), testID: text(entry, 'testID', itemPath) };
    if (typeof entry.note === 'string') element.note = entry.note;
    return element;
  });
}

function record(value: unknown, path: string): Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value))
    throw new Error(`${path} must be an object.`);
  return value as Record<string, unknown>;
}

function text(object: Record<string, unknown>, key: string, path: string): string {
  const value = object[key];
  if (typeof value !== 'string' || value === '') throw new Error(`${path}: "${key}" must be a non-empty string.`);
  return value;
}
