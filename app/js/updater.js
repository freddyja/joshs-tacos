// Automatic service-worker updates.
//
// On startup and whenever the app regains focus / becomes visible we call
// registration.update(). If a newer worker is installed we:
//   1. save the cart to localStorage (synchronously),
//   2. tell the worker to SKIP_WAITING (it then calls clients.claim()),
//   3. reload exactly once when `controllerchange` fires.
// A sessionStorage flag records the version we reloaded to, so we never reload
// twice for the same version (loop guard). While the order composer or another
// dialog is open, the refresh waits and runs when the user closes it.

export const RELOAD_GUARD_KEY = 'jt-reloaded-to';

export function getWorkerVersion(worker, timeoutMs = 1500) {
  return new Promise((resolve) => {
    if (!worker || typeof MessageChannel === 'undefined') return resolve('unknown');
    const ch = new MessageChannel();
    const timer = setTimeout(() => resolve('unknown'), timeoutMs);
    ch.port1.onmessage = (e) => {
      clearTimeout(timer);
      resolve((e.data && e.data.version) || 'unknown');
    };
    try {
      worker.postMessage({ type: 'GET_VERSION' }, [ch.port2]);
    } catch {
      clearTimeout(timer);
      resolve('unknown');
    }
  });
}

export function createUpdater({
  container,
  session,
  isBusy = () => false,
  saveState = () => {},
  reload = () => location.reload(),
  onStatus = () => {},
  getVersion = getWorkerVersion,
}) {
  let reg = null;
  let knownController = container.controller || null;
  let pendingWorker = null;
  let pendingReload = false;
  let reloading = false;
  let inFlight = null;
  const watched = new WeakSet();

  function activate(worker) {
    if (!worker || reloading) return;
    if (isBusy()) {
      pendingWorker = worker;
      onStatus('deferred');
      return;
    }
    pendingWorker = null;
    saveState();
    onStatus('updating');
    worker.postMessage({ type: 'SKIP_WAITING' });
  }

  function watch(worker) {
    if (!worker) return;
    if (worker.state === 'installed') {
      activate(worker);
      return;
    }
    if (watched.has(worker)) return;
    watched.add(worker);
    worker.addEventListener('statechange', () => {
      if (worker.state === 'installed') activate(worker);
    });
  }

  async function doReload() {
    const version = await getVersion(container.controller);
    if (session.getItem(RELOAD_GUARD_KEY) === version) {
      onStatus('current'); // already reloaded into this version: never loop
      return false;
    }
    session.setItem(RELOAD_GUARD_KEY, version);
    reloading = true;
    saveState();
    reload();
    return true;
  }

  async function onControllerChange() {
    const previous = knownController;
    knownController = container.controller;
    if (!previous) return false; // first install claimed the page; nothing to refresh
    if (reloading) return false;
    if (isBusy()) {
      pendingReload = true;
      onStatus('deferred');
      return false;
    }
    return doReload();
  }

  /** Returns 'current' | 'updating' | 'error' | 'unsupported'. */
  function check() {
    if (!reg) return Promise.resolve('unsupported');
    if (inFlight) return inFlight;
    inFlight = (async () => {
      try {
        await reg.update();
      } catch {
        return 'error';
      }
      const worker = reg.waiting || reg.installing;
      if (worker && container.controller) {
        watch(worker);
        return 'updating';
      }
      return 'current';
    })().finally(() => {
      inFlight = null;
    });
    return inFlight;
  }

  /** Call when the composer / a dialog closes. */
  function resume() {
    if (isBusy()) return;
    if (pendingReload) {
      pendingReload = false;
      doReload();
    } else if (pendingWorker) {
      activate(pendingWorker);
    }
  }

  async function start(registration) {
    reg = registration;
    container.addEventListener('controllerchange', onControllerChange);
    reg.addEventListener('updatefound', () => {
      if (reg.installing && container.controller) watch(reg.installing);
    });
    if (reg.waiting && container.controller) watch(reg.waiting);
    return check();
  }

  return { start, check, resume, onControllerChange, get pending() { return Boolean(pendingWorker || pendingReload); } };
}
