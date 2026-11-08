// "Install" is web-only guidance (owner request): a plain link to the app plus
// bookmark / browser "Add to Home Screen" steps. The app never invokes the
// beforeinstallprompt event's prompt method and never triggers the browser's
// native install prompt; there is no app-provided package or download.
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

/**
 * What the Install guidance sheet should show.
 * - show: false when the app already runs standalone (launched from the home screen).
 * - highlight: the detected platform ('android' | 'apple' | null on desktop/unknown).
 * - initial: the option opened first (the detected platform, else none so the user picks).
 */
export function chooserModel({ state, platform }) {
  if (state === 'installed') return { show: false, highlight: null, initial: null };
  const highlight = platform === 'ios' ? 'apple' : platform === 'android' ? 'android' : null;
  return { show: true, highlight, initial: highlight };
}

/**
 * Tracks whether the app runs standalone. The browser's automatic install prompt
 * (beforeinstallprompt) is suppressed and never shown: the event is not kept and
 * prompt() is never called.
 */
export function createInstaller(win, onChange = () => {}) {
  let installed = isStandalone(win);
  win.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
  });
  win.addEventListener('appinstalled', () => {
    installed = true;
    onChange();
  });
  return {
    /** 'installed' | 'manual' */
    get state() {
      return installed ? 'installed' : 'manual';
    },
  };
}
