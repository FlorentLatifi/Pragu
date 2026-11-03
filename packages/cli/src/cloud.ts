import { resolve, sep } from 'node:path';

/** Folder names that sync apps create; a report inside one is uploaded with its screenshots. */
const SYNCED: readonly (readonly [RegExp, string])[] = [
  [/^OneDrive( - .+)?$/i, 'OneDrive'],
  [/^Dropbox( \(.+\))?$/i, 'Dropbox'],
  [/^(iCloud ?Drive|Mobile Documents)$/i, 'iCloud Drive'],
  [/^(Google ?Drive|My Drive)$/i, 'Google Drive'],
];

/** The sync service whose folder holds `dir`, or null. Path segments only: nothing is read from disk. */
export function syncedFolder(dir: string, cwd: string = process.cwd()): string | null {
  const segments = resolve(cwd, dir)
    .split(/[\\/]/)
    .filter((segment) => segment !== '');
  for (const segment of segments) {
    const match = SYNCED.find(([pattern]) => pattern.test(segment));
    if (match !== undefined) return match[1];
  }
  return null;
}

/** The warning a scan prints before it writes screenshots into a synced folder (D-34). */
export function syncedFolderWarning(dir: string, cwd: string = process.cwd()): string | null {
  const service = syncedFolder(dir, cwd);
  if (service === null) return null;
  return `Warning: ${resolve(cwd, dir)}${sep} is inside ${service}, which uploads it. Reports hold screenshots of your app; write them elsewhere with --out.`;
}
