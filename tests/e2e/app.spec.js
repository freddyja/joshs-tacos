import { test, expect } from '@playwright/test';
import path from 'node:path';
import AxeBuilder from '@axe-core/playwright';
import { createStaticServer } from '../../scripts/static-server.mjs';

const ROOT = path.resolve(import.meta.dirname, '../..');
let server;
let baseUrl;

test.beforeAll(async () => {
  server = createStaticServer({ root: path.join(ROOT, 'app') });
  baseUrl = await server.listen();
});
test.afterAll(() => server.close());

async function open(page) {
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto(baseUrl);
  await page.waitForSelector('body[data-ready=true]');
  return errors;
}

test('menu renders from the poster, Maria is not addable', async ({ page }) => {
  const errors = await open(page);
  await expect(page.locator('.btn-add')).toHaveCount(15);
  await expect(page.locator('[data-sku=maria]')).toHaveCount(0);
  await expect(page.locator('.cat-combos')).toContainText('$15.00');
  await expect(page.locator('body')).not.toContainText(/order accepted/i);
  expect(errors).toEqual([]);
});

test('cart: add packs, qty +/-, estimated subtotal, persists across reload', async ({ page }) => {
  await open(page);
  await page.click('[data-sku=taco-3]');
  await page.click('[data-sku=taco-3]');
  await page.click('[data-sku=tea]');
  await expect(page.locator('#subtotal')).toHaveText('$18.00');
  await page.locator('.cart-line[data-sku=taco-3] .qty-btn').first().click();
  await expect(page.locator('#subtotal')).toHaveText('$10.00');
  await expect(page.locator('#cart')).toContainText('Estimated subtotal');
  await page.reload();
  await page.waitForSelector('body[data-ready=true]');
  await expect(page.locator('#subtotal')).toHaveText('$10.00');
});

test('composer builds SMS link to the seller, never navigates on its own', async ({ page }) => {
  await open(page);
  await page.click('#review-btn');
  await expect(page.locator('#cart-error')).toBeVisible(); // empty cart error
  await page.click('[data-sku=combo-taco]');
  await page.click('[data-sku=empanada-2]');
  await page.check('#maria-check');
  const url = page.url();
  await page.click('#review-btn');
  await page.fill('#name-input', 'Ana');
  const href = await page.getAttribute('#sms-link', 'href');
  expect(href).toMatch(/^sms:\+13526068731[?&]body=/);
  const body = decodeURIComponent(href.split('body=')[1]);
  expect(body).toBe("Hi Josh's Tacos! Pickup order: 1× Taco Combo ($10.00); 1× 2 empanadas ($5.00). Estimated subtotal $15.00. Ask about Maria Special: yes. Name: Ana. Please confirm price & pickup time.");
  expect(await page.getAttribute('#call-link', 'href')).toBe('tel:+13526068731');
  await expect(page.locator('#composer')).toContainText('Seller confirms price, pickup time & availability');
  await page.waitForTimeout(500);
  expect(page.url()).toBe(url);
});

test('copy order summary works', async ({ page, context }) => {
  await context.grantPermissions(['clipboard-read', 'clipboard-write']);
  await open(page);
  await page.click('[data-sku=rice]');
  await page.click('#review-btn');
  await page.click('#copy-btn');
  await expect(page.locator('#toast')).toHaveText('Order summary copied');
  const clip = await page.evaluate(() => navigator.clipboard.readText());
  expect(clip).toContain('1× White rice ($3.00)');
});

test('language toggle switches everything to Spanish and persists', async ({ page }) => {
  await open(page);
  await page.click('[data-sku=combo-taco]');
  await page.click('#lang-btn');
  await expect(page.locator('html')).toHaveAttribute('lang', 'es');
  await expect(page.locator('#review-btn')).toHaveText('Revisar y enviar pedido');
  await expect(page.locator('#cart')).toContainText('Subtotal estimado');
  await expect(page.locator('#update-btn')).toHaveText('Buscar actualizaciones');
  await page.reload();
  await page.waitForSelector('body[data-ready=true]');
  await expect(page.locator('#share-btn')).toHaveText('Compartir');
  await page.click('#review-btn');
  const body = decodeURIComponent((await page.getAttribute('#sms-link', 'href')).split('body=')[1]);
  expect(body.startsWith('¡Hola, Josh\'s Tacos! Pedido para recoger: 1× Combo de Tacos ($10.00).')).toBe(true);
  await expect(page.locator('#sms-link')).toHaveText('Enviar pedido por mensaje');
});

test('share: Web Share when available', async ({ page }) => {
  await page.addInitScript(() => {
    window.__shared = null;
    navigator.share = async (d) => { window.__shared = d; };
  });
  await open(page);
  await page.click('#share-btn');
  const shared = await page.evaluate(() => window.__shared);
  expect(shared.url).toBe(baseUrl);
  expect(shared.title).toBe("Josh's Tacos");
});

test('share: copies the link when Web Share is missing', async ({ page, context }) => {
  await context.grantPermissions(['clipboard-read', 'clipboard-write']);
  await page.addInitScript(() => { delete Navigator.prototype.share; });
  await open(page);
  await page.click('#share-btn');
  await expect(page.locator('#toast')).toHaveText('Link copied');
  expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(baseUrl);
});

test('share: manual link when nothing else works', async ({ page }) => {
  await page.addInitScript(() => {
    delete Navigator.prototype.share;
    Object.defineProperty(Navigator.prototype, 'clipboard', { get: () => undefined });
    document.execCommand = () => false;
  });
  await open(page);
  await page.click('#share-btn');
  await expect(page.locator('#share-dialog')).toBeVisible();
  expect(await page.inputValue('#share-url')).toBe(baseUrl);
});

test('install: native prompt when beforeinstallprompt fires', async ({ page }) => {
  await open(page);
  await page.evaluate(() => {
    const e = new Event('beforeinstallprompt', { cancelable: true });
    e.prompt = async () => { window.__prompted = true; };
    e.userChoice = Promise.resolve({ outcome: 'accepted' });
    window.dispatchEvent(e);
  });
  await page.click('#install-btn');
  expect(await page.evaluate(() => window.__prompted)).toBe(true);
  await expect(page.locator('#install-btn')).toHaveText('Installed');
  await expect(page.locator('#install-btn')).toBeDisabled();
});

test('install: manual instructions as fallback', async ({ page }) => {
  await open(page);
  await page.click('#install-btn');
  await expect(page.locator('#install-dialog')).toBeVisible();
  await expect(page.locator('#install-dialog')).toContainText(/Add to Home Screen|Install/);
});

test('install: iPhone gets Share → Add to Home Screen steps', async ({ browser }) => {
  const ctx = await browser.newContext({ userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 Version/17.0 Mobile/15E148 Safari/604.1' });
  const page = await ctx.newPage();
  await open(page);
  await page.click('#install-btn');
  await expect(page.locator('#install-dialog [data-platform=ios]')).toBeVisible();
  await expect(page.locator('#install-dialog [data-platform=android]')).toBeHidden();
  await expect(page.locator('#install-dialog')).toContainText('Add to Home Screen');
  // iOS SMS separator
  await page.click('#install-dialog button[value=close]');
  await page.click('[data-sku=tea]');
  await page.click('#review-btn');
  expect(await page.getAttribute('#sms-link', 'href')).toMatch(/^sms:\+13526068731&body=/);
  await ctx.close();
});

test('offline: app loads from cache, stale-price banner, composer still works', async ({ page, context }) => {
  await open(page);
  await page.waitForFunction(() => navigator.serviceWorker.controller !== null);
  await page.click('[data-sku=cornbread]');
  await context.setOffline(true);
  await page.reload();
  await page.waitForSelector('body[data-ready=true]');
  await expect(page.locator('#offline-banner')).toBeVisible();
  await expect(page.locator('#offline-banner')).toHaveText('Offline — prices may be out of date. Confirm with the seller.');
  await page.click('#review-btn');
  expect(await page.getAttribute('#sms-link', 'href')).toContain('Cornbread');
  await page.click('#composer button[value=close]');
  await page.click('#update-btn');
  await expect(page.locator('#update-status')).toHaveText(/Couldn't check for updates|Up to date/);
  await context.setOffline(false);
});

test('accessibility: no serious axe violations and 44px tap targets', async ({ page }) => {
  await open(page);
  await page.click('[data-sku=taco-1]');
  const results = await new AxeBuilder({ page }).analyze();
  const serious = results.violations.filter((v) => ['serious', 'critical'].includes(v.impact));
  expect(serious.map((v) => `${v.id}: ${v.nodes.map((n) => n.target).join(', ')}`)).toEqual([]);
  const small = await page.evaluate(() =>
    [...document.querySelectorAll('button, a.btn, .cart-bar, .maria-toggle')]
      .filter((el) => el.offsetParent !== null)
      .map((el) => ({ id: el.id || el.className, ...el.getBoundingClientRect().toJSON() }))
      .filter((r) => r.width < 44 || r.height < 44));
  expect(small).toEqual([]);
});

test('manifest and service worker are scoped to /joshs-tacos/', async ({ page }) => {
  await open(page);
  const info = await page.evaluate(async () => {
    const reg = await navigator.serviceWorker.ready;
    const m = await (await fetch(document.querySelector('link[rel=manifest]').href)).json();
    return { scope: reg.scope, script: reg.active.scriptURL, start: new URL(m.start_url, document.querySelector('link[rel=manifest]').href).href };
  });
  expect(info.scope).toBe(baseUrl);
  expect(info.script).toBe(`${baseUrl}sw.js`);
  expect(info.start).toBe(baseUrl);
  expect(baseUrl.endsWith('/joshs-tacos/')).toBe(true);
});
