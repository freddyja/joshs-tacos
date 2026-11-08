import { describe, it, expect, vi } from 'vitest';
import { createUpdater, RELOAD_GUARD_KEY } from '../../app/js/updater.js';
import { memoryStorage } from './helpers.js';

class Emitter {
  constructor() { this.h = {}; }
  addEventListener(t, fn) { (this.h[t] ||= []).push(fn); }
  emit(t) { (this.h[t] || []).forEach((fn) => fn()); }
}
class FakeWorker extends Emitter {
  constructor(state = 'installing') { super(); this.state = state; this.messages = []; }
  postMessage(m) { this.messages.push(m); }
  set(state) { this.state = state; this.emit('statechange'); }
}
class FakeReg extends Emitter {
  constructor() { super(); this.waiting = null; this.installing = null; this.next = null; }
  async update() {
    if (this.next) { this.installing = this.next; this.next = null; this.emit('updatefound'); }
  }
}

function setup({ controller = new FakeWorker('activated'), busy = false, version = '2.0.0' } = {}) {
  const container = new Emitter();
  container.controller = controller;
  const session = memoryStorage();
  const reload = vi.fn();
  const saveState = vi.fn();
  const statuses = [];
  const state = { busy };
  const up = createUpdater({
    container, session, reload, saveState,
    isBusy: () => state.busy,
    onStatus: (s) => statuses.push(s),
    getVersion: async () => version,
  });
  return { up, container, session, reload, saveState, statuses, state, reg: new FakeReg() };
}

describe('auto-update', () => {
  it('reports up to date when no new worker exists', async () => {
    const { up, reg } = setup();
    expect(await up.start(reg)).toBe('current');
  });

  it('saves the cart, sends SKIP_WAITING, reloads exactly once on controllerchange', async () => {
    const { up, reg, container, reload, saveState, session } = setup();
    const w = new FakeWorker('installing');
    reg.next = w;
    expect(await up.start(reg)).toBe('updating');
    w.set('installed');
    expect(saveState).toHaveBeenCalled();
    expect(w.messages).toEqual([{ type: 'SKIP_WAITING' }]);
    container.controller = w;
    expect(await up.onControllerChange()).toBe(true);
    expect(reload).toHaveBeenCalledTimes(1);
    expect(session.getItem(RELOAD_GUARD_KEY)).toBe('2.0.0');
  });

  it('loop guard: never reloads twice for the same version', async () => {
    const { up, reg, container, reload, session } = setup();
    session.setItem(RELOAD_GUARD_KEY, '2.0.0');
    await up.start(reg);
    container.controller = new FakeWorker('activated');
    expect(await up.onControllerChange()).toBe(false);
    expect(reload).not.toHaveBeenCalled();
  });

  it('activates a worker already waiting at startup', async () => {
    const { up, reg } = setup();
    const w = new FakeWorker('installed');
    reg.waiting = w;
    await up.start(reg);
    expect(w.messages).toContainEqual({ type: 'SKIP_WAITING' });
  });

  it('does not reload on the very first install (no previous controller)', async () => {
    const { up, reg, container, reload } = setup({ controller: null });
    await up.start(reg);
    container.controller = new FakeWorker('activated');
    expect(await up.onControllerChange()).toBe(false);
    expect(reload).not.toHaveBeenCalled();
  });

  it('waits while the composer/dialog is open, then runs on resume', async () => {
    const { up, reg, state, statuses } = setup({ busy: true });
    const w = new FakeWorker('installed');
    reg.next = w;
    await up.start(reg);
    expect(w.messages).toEqual([]);
    expect(statuses).toContain('deferred');
    expect(up.pending).toBe(true);
    up.resume(); // still busy
    expect(w.messages).toEqual([]);
    state.busy = false;
    up.resume();
    expect(w.messages).toEqual([{ type: 'SKIP_WAITING' }]);
  });

  it('defers a controllerchange reload while busy', async () => {
    const { up, reg, container, reload, state } = setup({ busy: true });
    await up.start(reg);
    container.controller = new FakeWorker('activated');
    await up.onControllerChange();
    expect(reload).not.toHaveBeenCalled();
    state.busy = false;
    up.resume();
    await new Promise((r) => setTimeout(r, 0));
    expect(reload).toHaveBeenCalledTimes(1);
  });

  it('reports errors (e.g. offline) from the manual check', async () => {
    const { up, reg } = setup();
    reg.update = async () => { throw new Error('offline'); };
    expect(await up.start(reg)).toBe('error');
  });

  it('is unsupported before start', async () => {
    const { up } = setup();
    expect(await up.check()).toBe('unsupported');
  });
});
