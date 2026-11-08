// Required proof (spec v005 §5): serve build v1, fill the cart, deploy v2, reopen or
// refocus, and assert v2 is active, the cart is unchanged, exactly one reload
// happened, the old cache is gone, and a second focus does not reload again.
import { test, expect } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import { createStaticServer } from '../../scripts/static-server.mjs';
import { setAppVersion } from '../../scripts/version-lib.mjs';

const ROOT = path.resolve(import.meta.dirname, '../..');
const TMP = path.join(ROOT, '.tmp-e2e');
const V1 = '1.0.0';
const V2 = '2.0.0';
const EVIDENCE = path.join(ROOT, 'docs', 'evidence');

function build(version) {
  const dir = path.join(TMP, `v${version}`);
  fs.rmSync(dir, { recursive: true, force: true });
  fs.cpSync(path.join(ROOT, 'app'), dir, { recursive: true });
  setAppVersion(dir, version);
  return dir;
}

let server;
let baseUrl;
let v1Dir;
let v2Dir;
const proof = { spec: 'joshs-tacos-spec-v005 §5 auto-update', from: V1, to: V2, scenarios: {} };

test.beforeAll(async () => {
  v1Dir = build(V1);
  v2Dir = build(V2);
  server = createStaticServer({ root: v1Dir });
  baseUrl = await server.listen();
});

test.afterAll(async () => {
  await server.close();
  fs.mkdirSync(EVIDENCE, { recursive: true });
  proof.ranAt = new Date().toISOString();
  fs.writeFileSync(path.join(EVIDENCE, 'upgrade-proof.json'), JSON.stringify(proof, null, 2) + '\n');
});

function countLoads(page) {
  const loads = { n: 0 };
  page.on('framenavigated', (f) => { if (f === page.mainFrame()) loads.n += 1; });
  return loads;
}

const appState = (page) => page.evaluate(async () => {
  const controller = navigator.serviceWorker.controller;
  const version = await new Promise((resolve) => {
    if (!controller) return resolve(null);
    const ch = new MessageChannel();
    ch.port1.onmessage = (e) => resolve(e.data.version);
    controller.postMessage({ type: 'GET_VERSION' }, [ch.port2]);
  });
  return {
    swVersion: version,
    pageVersion: document.querySelector('#app-version').textContent,
    cart: localStorage.getItem('jt-cart-v1'),
    caches: (await caches.keys()).sort(),
    guard: sessionStorage.getItem('jt-reloaded-to'),
    subtotal: document.querySelector('#subtotal').textContent,
  };
});

async function openV1WithCart(page) {
  server.setRoot(v1Dir);
  await page.goto(baseUrl);
  await page.waitForSelector('body[data-ready=true]');
  await page.waitForFunction(() => navigator.serviceWorker.controller !== null);
  await page.click('[data-sku=combo-taco]');
  await page.click('[data-sku=empanada-2]');
  await page.click('[data-sku=empanada-2]');
  await page.check('#maria-check');
  const before = await appState(page);
  expect(before.swVersion).toBe(V1);
  expect(before.pageVersion).toContain(V1);
  expect(before.caches).toEqual([`jt-v${V1}`]);
  expect(JSON.parse(before.cart)).toEqual({
    lines: [{ sku: 'combo-taco', qty: 1 }, { sku: 'empanada-2', qty: 2 }],
    askMaria: true,
  });
  return before;
}

test('v1 -> v2 on refocus: auto-activates, keeps cart, reloads exactly once, no loop', async ({ browser }) => {
  const context = await browser.newContext();
  const page = await context.newPage();
  const loads = countLoads(page);
  const before = await openV1WithCart(page);
  const loadsBefore = loads.n;

  server.setRoot(v2Dir); // "deploy" v2
  await page.evaluate(() => window.dispatchEvent(new Event('focus')));
  await expect(page.locator('#app-version')).toContainText(V2, { timeout: 20_000 });
  await page.waitForSelector('body[data-ready=true]');
  await page.waitForTimeout(1500);
  const after = await appState(page);
  const reloads = loads.n - loadsBefore;

  expect(after.swVersion).toBe(V2);
  expect(after.cart).toBe(before.cart);
  expect(after.subtotal).toBe('$20.00');
  expect(reloads).toBe(1);
  expect(after.caches).toEqual([`jt-v${V2}`]);
  expect(after.guard).toBe(V2);

  // No loop: focusing / showing again must not reload.
  await page.evaluate(() => {
    window.dispatchEvent(new Event('focus'));
    document.dispatchEvent(new Event('visibilitychange'));
  });
  await page.waitForTimeout(2000);
  expect(loads.n - loadsBefore).toBe(1);

  fs.mkdirSync(EVIDENCE, { recursive: true });
  await page.screenshot({ path: path.join(EVIDENCE, 'upgrade-after-v2.png'), fullPage: false });
  proof.scenarios.refocus = { before, after, reloads, reloadsAfterSecondFocus: loads.n - loadsBefore, pass: true };
  await context.close();
});

test('v1 -> v2 on reopen: auto-activates, keeps cart, reloads exactly once', async ({ browser }) => {
  const context = await browser.newContext();
  const first = await context.newPage();
  const before = await openV1WithCart(first);
  await first.close(); // user closes the app

  server.setRoot(v2Dir); // "deploy" v2
  const page = await context.newPage(); // user reopens the app
  const loads = countLoads(page);
  await page.goto(baseUrl);
  await expect(page.locator('#app-version')).toContainText(V2, { timeout: 20_000 });
  await page.waitForSelector('body[data-ready=true]');
  await page.waitForTimeout(2000);
  const after = await appState(page);
  const reloads = loads.n - 1; // minus the initial open

  expect(after.swVersion).toBe(V2);
  expect(after.cart).toBe(before.cart);
  expect(reloads).toBe(1);
  expect(after.caches).toEqual([`jt-v${V2}`]);
  proof.scenarios.reopen = { before, after, reloads, pass: true };
  await context.close();
});

test('manual "Check for updates" button reports Up to date, then upgrades on demand', async ({ browser }) => {
  const context = await browser.newContext();
  const page = await context.newPage();
  const loads = countLoads(page);
  const before = await openV1WithCart(page);
  await page.click('#update-btn');
  await expect(page.locator('#update-status')).toHaveText('Up to date');

  server.setRoot(v2Dir);
  const loadsBefore = loads.n;
  await page.click('#update-btn');
  await expect(page.locator('#app-version')).toContainText(V2, { timeout: 20_000 });
  await page.waitForTimeout(1500);
  const after = await appState(page);
  expect(after.cart).toBe(before.cart);
  expect(loads.n - loadsBefore).toBe(1);
  proof.scenarios.manualButton = { reloads: loads.n - loadsBefore, after, pass: true };
  await context.close();
});

test('update waits while the order composer is open, then applies on close', async ({ browser }) => {
  const context = await browser.newContext();
  const page = await context.newPage();
  const loads = countLoads(page);
  const before = await openV1WithCart(page);
  await page.click('#review-btn');
  await expect(page.locator('#composer')).toBeVisible();
  await page.fill('#name-input', 'Ana');

  server.setRoot(v2Dir);
  const loadsBefore = loads.n;
  await page.evaluate(() => window.dispatchEvent(new Event('focus')));
  await page.waitForTimeout(2500);
  expect(loads.n - loadsBefore).toBe(0); // composer still open: no refresh
  await expect(page.locator('#composer')).toBeVisible();
  expect(await page.inputValue('#name-input')).toBe('Ana');

  await page.click('#composer button[value=close]');
  await expect(page.locator('#app-version')).toContainText(V2, { timeout: 20_000 });
  await page.waitForTimeout(1500);
  const after = await appState(page);
  expect(after.cart).toBe(before.cart);
  expect(loads.n - loadsBefore).toBe(1);
  proof.scenarios.deferredWhileComposerOpen = { reloads: loads.n - loadsBefore, pass: true };
  await context.close();
});
