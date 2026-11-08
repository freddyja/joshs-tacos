// Install: beforeinstallprompt when available, otherwise manual instructions.
import { isIOS } from './order.js';

export function isStandalone(win) {
  try {
    return (
      Boolean(win.matchMedia && win.matchMedia('(display-mode: standalone)').matches) ||
      win.navigator.standalone === true
    );
  } catch {
    return false;
  }
}

export function installPlatform(nav) {
  const ua = (nav && nav.userAgent) || '';
  if (isIOS(ua, nav && nav.platform, nav && nav.maxTouchPoints)) return 'ios';
  if (/Android/i.test(ua)) return 'android';
  return 'other';
}

export function createInstaller(win, onChange = () => {}) {
  let deferred = null;
  let installed = isStandalone(win);
  win.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferred = e;
    onChange();
  });
  win.addEventListener('appinstalled', () => {
    installed = true;
    deferred = null;
    onChange();
  });
  return {
    /** 'installed' | 'prompt' | 'manual' */
    get state() {
      if (installed) return 'installed';
      return deferred ? 'prompt' : 'manual';
    },
    /** Returns 'accepted' | 'dismissed' | 'manual' | 'installed'. */
    async install() {
      if (installed) return 'installed';
      if (!deferred) return 'manual';
      const evt = deferred;
      deferred = null;
      await evt.prompt();
      const choice = await Promise.resolve(evt.userChoice).catch(() => ({ outcome: 'dismissed' }));
      const accepted = Boolean(choice && choice.outcome === 'accepted');
      if (accepted) installed = true;
      onChange();
      return accepted ? 'accepted' : 'dismissed';
    },
  };
}
