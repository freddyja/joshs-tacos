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

describe('install', () => {
  it('shows manual instructions until beforeinstallprompt fires', async () => {
    const win = fakeWindow();
    const inst = createInstaller(win);
    expect(inst.state).toBe('manual');
    expect(await inst.install()).toBe('manual');
  });

  it('captures beforeinstallprompt and calls prompt()', async () => {
    const win = fakeWindow();
    const onChange = vi.fn();
    const inst = createInstaller(win, onChange);
    const evt = { preventDefault: vi.fn(), prompt: vi.fn().mockResolvedValue(), userChoice: Promise.resolve({ outcome: 'accepted' }) };
    win.fire('beforeinstallprompt', evt);
    expect(evt.preventDefault).toHaveBeenCalled();
    expect(inst.state).toBe('prompt');
    expect(await inst.install()).toBe('accepted');
    expect(evt.prompt).toHaveBeenCalledOnce();
    expect(inst.state).toBe('installed');
    expect(onChange).toHaveBeenCalled();
  });

  it('handles a dismissed prompt', async () => {
    const win = fakeWindow();
    const inst = createInstaller(win);
    win.fire('beforeinstallprompt', { preventDefault() {}, prompt: async () => {}, userChoice: Promise.resolve({ outcome: 'dismissed' }) });
    expect(await inst.install()).toBe('dismissed');
    expect(inst.state).toBe('manual');
  });

  it('shows Installed when running standalone or after appinstalled', () => {
    expect(createInstaller(fakeWindow({ standalone: true })).state).toBe('installed');
    const win = fakeWindow();
    const inst = createInstaller(win);
    win.fire('appinstalled');
    expect(inst.state).toBe('installed');
    expect(isStandalone({ navigator: { standalone: true } })).toBe(true);
  });

  it('picks iOS / Android / other instructions', () => {
    expect(installPlatform({ userAgent: 'iPhone OS 17' })).toBe('ios');
    expect(installPlatform({ userAgent: 'Linux; Android 14' })).toBe('android');
    expect(installPlatform({ userAgent: 'Windows NT 10.0' })).toBe('other');
  });
});

describe('install chooser', () => {
  it('is hidden when running standalone (already installed)', () => {
    for (const platform of ['ios', 'android', 'other']) {
      expect(chooserModel({ state: 'installed', platform }).show).toBe(false);
    }
  });

  it('auto-highlights and opens iPhone/iPad on iOS', () => {
    expect(chooserModel({ state: 'manual', platform: 'ios' })).toEqual({ show: true, highlight: 'apple', initial: 'apple', androidPrompt: false });
  });

  it('auto-highlights Android and uses the captured prompt when available', () => {
    expect(chooserModel({ state: 'prompt', platform: 'android' })).toEqual({ show: true, highlight: 'android', initial: 'android', androidPrompt: true });
  });

  it('Android without a captured prompt falls back to the Chrome menu steps', () => {
    expect(chooserModel({ state: 'manual', platform: 'android' })).toEqual({ show: true, highlight: 'android', initial: 'android', androidPrompt: false });
  });

  it('unknown/desktop: nothing highlighted; opens Android only if a prompt exists', () => {
    expect(chooserModel({ state: 'manual', platform: 'other' })).toEqual({ show: true, highlight: null, initial: null, androidPrompt: false });
    expect(chooserModel({ state: 'prompt', platform: 'other' }).initial).toBe('android');
  });
});
