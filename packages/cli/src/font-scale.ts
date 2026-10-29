import type { EventEmitter } from 'node:events';

/** WCAG 1.4.4 asks that text still works when it is resized to 200%. */
export const LARGE_TEXT_SCALE = 2;

/** What the font-scale switch needs from adb. */
export interface DeviceShell {
  shell(args: string[]): Promise<string>;
}

/**
 * Runs `work` with the device's font scale set to `scale`, and always puts the person's
 * own setting back: after success, after an error, and on Ctrl+C. A device that never had
 * the setting gets it deleted again rather than pinned to 1.0.
 */
export async function withFontScale<T>(
  device: DeviceShell,
  scale: number,
  work: () => Promise<T>,
  signals: EventEmitter = process,
  onInterrupted: () => void = () => process.exit(130),
): Promise<T> {
  const original = (await device.shell(['settings', 'get', 'system', 'font_scale'])).trim();
  const restore = () =>
    original === '' || original === 'null'
      ? device.shell(['settings', 'delete', 'system', 'font_scale'])
      : device.shell(['settings', 'put', 'system', 'font_scale', original]);
  const interrupted = () => {
    void restore().finally(onInterrupted);
  };
  signals.once('SIGINT', interrupted);
  try {
    await device.shell(['settings', 'put', 'system', 'font_scale', String(scale)]);
    return await work();
  } finally {
    signals.off('SIGINT', interrupted);
    await restore();
  }
}
