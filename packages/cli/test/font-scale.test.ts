import { EventEmitter } from 'node:events';
import { describe, expect, it } from 'vitest';
import { withFontScale } from '../src/font-scale.js';

function fakeDevice(original: string) {
  const commands: string[] = [];
  return {
    commands,
    shell(args: string[]) {
      commands.push(args.join(' '));
      return Promise.resolve(args[1] === 'get' ? `${original}\n` : '');
    },
  };
}

describe('withFontScale', () => {
  it('sets the scale for the work and puts the person’s own setting back', async () => {
    const device = fakeDevice('1.15');
    const seen = await withFontScale(device, 2, () => Promise.resolve(device.commands.length), new EventEmitter());
    expect(seen).toBe(2);
    expect(device.commands).toEqual([
      'settings get system font_scale',
      'settings put system font_scale 2',
      'settings put system font_scale 1.15',
    ]);
  });

  it('deletes the setting again on a device that never had one', async () => {
    const device = fakeDevice('null');
    await withFontScale(device, 2, () => Promise.resolve(), new EventEmitter());
    expect(device.commands.at(-1)).toBe('settings delete system font_scale');
  });

  it('restores the setting when the work fails', async () => {
    const device = fakeDevice('1.0');
    await expect(
      withFontScale(device, 2, () => Promise.reject(new Error('capture failed')), new EventEmitter()),
    ).rejects.toThrow('capture failed');
    expect(device.commands.at(-1)).toBe('settings put system font_scale 1.0');
  });

  it('restores the setting before exiting on Ctrl+C', async () => {
    const device = fakeDevice('1.3');
    const signals = new EventEmitter();
    let exited = false;
    const pending = withFontScale(
      device,
      2,
      () => {
        signals.emit('SIGINT');
        return new Promise<void>((resolve) => setTimeout(resolve, 10));
      },
      signals,
      () => {
        exited = true;
      },
    );
    await pending;
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(exited).toBe(true);
    expect(device.commands).toContain('settings put system font_scale 1.3');
    expect(signals.listenerCount('SIGINT')).toBe(0);
  });
});
