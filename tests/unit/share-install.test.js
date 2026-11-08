import { describe, it, expect, vi } from 'vitest';
import { shareApp, copyText } from '../../app/js/share.js';
import { createInstaller, isStandalone, installPlatform, chooserModel } from '../../app/js/install.js';

const args = { url: 'https://computingmadeeasy.org/joshs-tacos/', title: "Josh's Tacos", text: 'Order' };

describe('share', () => {
  it('uses the Web Share API when available', async () => {
    const nav = { share: vi.fn().mockResolvedValue() };
    expect(await shareApp({ nav, ...args })).toBe('shared');
    expect(nav.share).toHaveBeenCalledWith({ title: args.title, text: args.text, url: args.url });
  });

  it('treats a user cancel as cancelled (no fallback)', async () => {
    const nav = { share: vi.fn().mockRejectedValue(Object.assign(new Error(), { name: 'AbortError' })), clipboard: { writeText: vi.fn() } };
    expect(await shareApp({ nav, ...args })).toBe('cancelled');
    expect(nav.clipboard.writeText).not.toHaveBeenCalled();
  });

  it('falls back to copying the link', async () => {
    const nav = { clipboard: { writeText: vi.fn().mockResolvedValue() } };
    expect(await shareApp({ nav, ...args })).toBe('copied');
    expect(nav.clipboard.writeText).toHaveBeenCalledWith(args.url);
  });

  it('falls back to copy when share fails for other reasons', async () => {
    const nav = { share: vi.fn().mockRejectedValue(new TypeError('x')), clipboard: { writeText: vi.fn().mockResolvedValue() } };
    expect(await shareApp({ nav, ...args })).toBe('copied');
  });

  it('falls back to manual when nothing is available', async () => {
    expect(await shareApp({ nav: {}, ...args })).toBe('manual');
    const nav = { clipboard: { writeText: vi.fn().mockRejectedValue(new Error('denied')) } };
    expect(await shareApp({ nav, ...args })).toBe('manual');
    expect(await copyText({}, 'x')).toBe(false);
  });
});

function fakeWindow({ standalone = false } = {}) {
  const handlers = {};
  return {
    navigator: { standalone: false },
    matchMedia: () => ({ matches: standalone }),
    addEventListener: (t, fn) => { handlers[t] = fn; },
    fire: (t, e = {}) => handlers[t](e),
  };
}

describe('install (web-only guidance, no native prompt)', () => {
  it('suppresses beforeinstallprompt and never calls prompt()', () => {
    const win = fakeWindow();
    const inst = createInstaller(win);
    const evt = { preventDefault: vi.fn(), prompt: vi.fn() };
    win.fire('beforeinstallprompt', evt);
    expect(evt.preventDefault).toHaveBeenCalled();
    expect(evt.prompt).not.toHaveBeenCalled();
    expect(inst.state).toBe('manual');
    expect(inst.install).toBeUndefined(); // no programmatic install path exists
  });

  it('shows Installed when running standalone or after the browser reports appinstalled', () => {
    expect(createInstaller(fakeWindow({ standalone: true })).state).toBe('installed');
    const win = fakeWindow();
    const onChange = vi.fn();
    const inst = createInstaller(win, onChange);
    win.fire('appinstalled');
    expect(inst.state).toBe('installed');
    expect(onChange).toHaveBeenCalled();
    expect(isStandalone({ navigator: { standalone: true } })).toBe(true);
  });

  it('picks iOS / Android / other instructions', () => {
    expect(installPlatform({ userAgent: 'iPhone OS 17' })).toBe('ios');
    expect(installPlatform({ userAgent: 'Linux; Android 14' })).toBe('android');
    expect(installPlatform({ userAgent: 'Windows NT 10.0' })).toBe('other');
  });
});

describe('install chooser', () => {
  it('is hidden when running standalone (launched from the home screen)', () => {
    for (const platform of ['ios', 'android', 'other']) {
      expect(chooserModel({ state: 'installed', platform }).show).toBe(false);
    }
  });

  it('auto-highlights and opens iPhone/iPad on iOS', () => {
    expect(chooserModel({ state: 'manual', platform: 'ios' })).toEqual({ show: true, highlight: 'apple', initial: 'apple' });
  });

  it('auto-highlights and opens Android on Android', () => {
    expect(chooserModel({ state: 'manual', platform: 'android' })).toEqual({ show: true, highlight: 'android', initial: 'android' });
  });

  it('unknown/desktop: nothing highlighted or opened', () => {
    expect(chooserModel({ state: 'manual', platform: 'other' })).toEqual({ show: true, highlight: null, initial: null });
  });
});
