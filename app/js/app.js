// Josh's Tacos: UI wiring. Pure logic lives in the sibling modules (unit-tested).
import { APP_VERSION } from './version.js';
import {
  indexMenu, loadCart, saveCart, addSku, setQty, setAskMaria, emptyCart,
  subtotalCents, lineTotalCents, itemCount, isCartEmpty, formatCents,
} from './cart.js';
import { detectLang, getSavedLang, saveLang, createT } from './i18n.js';
import { buildOrderText, smsHref, telHref, isIOS, SELLER_PHONE_DISPLAY } from './order.js';
import { shareApp, copyText } from './share.js';
import { createInstaller, installPlatform, chooserModel } from './install.js';
import { createUpdater } from './updater.js';

const $ = (sel) => document.querySelector(sel);
const NAME_KEY = 'jt-name';

const state = {
  lang: 'en',
  dicts: {},
  t: (k) => k,
  menu: null,
  index: new Map(),
  cart: emptyCart(),
};

// ---------- storage ----------
const store = safeStorage(() => window.localStorage);
const session = safeStorage(() => window.sessionStorage);

function safeStorage(get) {
  try {
    const s = get();
    const probe = '__jt_probe__';
    s.setItem(probe, '1');
    s.removeItem(probe);
    return s;
  } catch {
    const mem = new Map();
    return {
      unavailable: true,
      getItem: (k) => (mem.has(k) ? mem.get(k) : null),
      setItem: (k, v) => mem.set(k, String(v)),
      removeItem: (k) => mem.delete(k),
    };
  }
}

function persistCart() {
  const ok = saveCart(store, state.cart) && !store.unavailable;
  $('#storage-error').hidden = ok;
}

// ---------- i18n ----------
async function loadDicts() {
  const [en, es] = await Promise.all(
    ['en', 'es'].map((l) => fetch(`i18n/${l}.json`).then((r) => {
      if (!r.ok) throw new Error(`i18n ${l}: ${r.status}`);
      return r.json();
    }))
  );
  state.dicts = { en, es };
}

function setLang(lang) {
  state.lang = lang;
  state.t = createT(state.dicts[lang]);
  document.documentElement.lang = lang;
  applyStaticText();
  renderMenu();
  renderCart();
  renderInstallButton();
  if (composer.open) renderComposer();
}

function applyStaticText() {
  const { t } = state;
  document.title = t('app.title');
  document.querySelectorAll('[data-i18n]').forEach((el) => {
    el.textContent = t(el.dataset.i18n);
  });
  document.querySelectorAll('[data-i18n-aria]').forEach((el) => {
    el.setAttribute('aria-label', t(el.dataset.i18nAria));
  });
  $('#contact-line').textContent = t('contact', { phone: SELLER_PHONE_DISPLAY });
  $('#app-version').textContent = t('update.version', { version: APP_VERSION });
  if (state.menu) {
    $('#menu-version').textContent = t('menu.version', { version: state.menu.version, date: state.menu.updated });
  }
}

// ---------- menu ----------
async function loadMenu() {
  const r = await fetch('menu.json');
  if (!r.ok) throw new Error(`menu: ${r.status}`);
  state.menu = await r.json();
  state.index = indexMenu(state.menu);
}

function el(tag, attrs = {}, ...children) {
  const node = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (k === 'class') node.className = v;
    else if (k === 'text') node.textContent = v;
    else node.setAttribute(k, v);
  }
  for (const c of children) if (c) node.append(c);
  return node;
}

function renderMenu() {
  if (!state.menu) return;
  const { t } = state;
  const root = $('#menu-root');
  root.replaceChildren();
  for (const cat of state.menu.categories) {
    const section = el('section', { class: `panel cat cat-${cat.id}`, 'aria-labelledby': `cat-${cat.id}` });
    section.append(el('h3', { class: 'cat-title', id: `cat-${cat.id}`, text: t(`cat.${cat.id}`) }));
    for (const item of cat.items) {
      if (item.inquiryOnly) {
        section.append(
          el('div', { class: 'maria' },
            el('p', { text: t('maria.text') }),
            mariaToggle())
        );
        continue;
      }
      const wrap = el('div', { class: 'item' });
      const multi = item.packs.length > 1;
      const sameAsCat = t(`item.${item.id}`).toLowerCase() === t(`cat.${cat.id}`).toLowerCase();
      if ((multi && !sameAsCat) || cat.id === 'combos') {
        wrap.append(el('p', { class: 'item-title', text: t(`item.${item.id}`) }));
      }
      if (cat.id === 'combos') wrap.append(el('p', { class: 'item-desc', text: t(`desc.${item.id}`) }));
      if (t(`item.${item.id}.note`) !== `item.${item.id}.note`) {
        wrap.append(el('p', { class: 'item-note', text: t(`item.${item.id}.note`) }));
      }
      const list = el('ul', { class: 'packs' });
      for (const pack of item.packs) {
        const name = t(`sku.${pack.sku}`);
        const price = formatCents(pack.priceCents);
        const btn = el('button', {
          type: 'button', class: 'btn btn-add', 'data-sku': pack.sku,
          'aria-label': t('btn.add.aria', { name, price }),
        }, t('btn.add'));
        btn.addEventListener('click', () => onAdd(pack.sku));
        list.append(el('li', { class: 'pack' },
          el('span', { class: 'pack-name', text: cat.id === 'combos' ? '' : name }),
          el('span', { class: 'leader', 'aria-hidden': 'true' }),
          el('span', { class: 'price', text: price }),
          btn));
      }
      wrap.append(list);
      section.append(wrap);
    }
    root.append(section);
  }
  root.setAttribute('aria-busy', 'false');
}

function mariaToggle() {
  const btn = el('button', { type: 'button', class: 'btn btn-gold', id: 'maria-menu-btn', 'aria-pressed': String(state.cart.askMaria) }, state.t('maria'));
  btn.addEventListener('click', () => updateCart(setAskMaria(state.cart, !state.cart.askMaria)));
  return btn;
}

// ---------- cart ----------
function onAdd(sku) {
  updateCart(addSku(state.cart, sku, state.index));
  toast(state.t('toast.added', { name: state.t(`sku.${sku}`) }));
}

function updateCart(next) {
  state.cart = next;
  persistCart();
  renderCart();
  if (composer.open) renderComposer();
}

function renderCart() {
  const { t, cart, index } = state;
  if (!state.menu) return;
  const ul = $('#cart-lines');
  ul.replaceChildren();
  for (const line of cart.lines) {
    const name = t(`sku.${line.sku}`);
    const dec = el('button', { type: 'button', class: 'qty-btn', 'aria-label': t('cart.dec', { name }) }, '−');
    const inc = el('button', { type: 'button', class: 'qty-btn', 'aria-label': t('cart.inc', { name }) }, '+');
    dec.addEventListener('click', () => updateCart(setQty(state.cart, line.sku, line.qty - 1)));
    inc.addEventListener('click', () => updateCart(setQty(state.cart, line.sku, line.qty + 1)));
    ul.append(el('li', { class: 'cart-line', 'data-sku': line.sku },
      el('span', { class: 'cart-name', text: name }),
      el('span', { class: 'qty' }, dec, el('output', { 'aria-label': t('cart.qty', { name }), text: String(line.qty) }), inc),
      el('span', { class: 'price', text: formatCents(lineTotalCents(line, index)) })));
  }
  if (cart.askMaria) ul.append(el('li', { class: 'cart-line cart-maria', text: t('cart.maria') }));
  $('#cart-empty').hidden = !isCartEmpty(cart);
  $('#maria-check').checked = cart.askMaria;
  const mb = $('#maria-menu-btn');
  if (mb) mb.setAttribute('aria-pressed', String(cart.askMaria));
  const total = formatCents(subtotalCents(cart, index));
  $('#subtotal').textContent = total;
  $('#clear-btn').hidden = isCartEmpty(cart);
  if (!isCartEmpty(cart)) $('#cart-error').hidden = true;
  const bar = $('#cart-bar');
  bar.hidden = isCartEmpty(cart);
  $('#cart-bar-count').textContent = `(${t('cart.count', { count: itemCount(cart) })})`;
  $('#cart-bar-total').textContent = total;
}

// ---------- composer ----------
const composer = $('#composer');
const ios = isIOS(navigator.userAgent, navigator.platform, navigator.maxTouchPoints);

function orderText() {
  return buildOrderText(state.cart, state.index, state.t, { name: $('#name-input').value });
}

function renderComposer() {
  const text = orderText();
  $('#order-preview').value = text;
  // Only an href is set: the user's SMS app opens and THEY press Send.
  $('#sms-link').href = smsHref(text, { ios });
  $('#call-link').href = telHref();
  $('#call-link').textContent = state.t('call', { phone: SELLER_PHONE_DISPLAY });
}

function openComposer() {
  if (isCartEmpty(state.cart)) {
    $('#cart-error').hidden = false;
    $('#cart-error').focus?.();
    return;
  }
  $('#name-input').value = store.getItem(NAME_KEY) || '';
  renderComposer();
  showDialog(composer);
}

function showDialog(d) {
  if (typeof d.showModal === 'function') d.showModal();
  else d.setAttribute('open', '');
}

function anyDialogOpen() {
  return [...document.querySelectorAll('dialog')].some((d) => d.open);
}

// ---------- toast ----------
let toastTimer;
function toast(msg) {
  const tEl = $('#toast');
  // Modal dialogs live in the top layer, so show the toast inside the open one.
  const host = [...document.querySelectorAll('dialog')].find((d) => d.open) || document.body;
  if (tEl.parentElement !== host) host.append(tEl);
  tEl.textContent = msg;
  tEl.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { tEl.hidden = true; }, 2600);
}

// ---------- share ----------
function appUrl() {
  return new URL('./', location.href).href;
}

async function onShare() {
  const { t } = state;
  const url = appUrl();
  const result = await shareApp({ nav: navigator, url, title: t('app.title'), text: t('share.text') });
  if (result === 'copied') toast(t('share.copied'));
  if (result === 'manual') {
    $('#share-url').value = url;
    showDialog($('#share-dialog'));
    $('#share-url').select();
  }
}

// ---------- install ----------
const installer = createInstaller(window, () => {
  renderInstallButton();
  if ($('#install-dialog').open) renderChooser();
});
let chooserSelection = null;

function renderInstallButton() {
  const b = $('#install-btn');
  const installed = installer.state === 'installed';
  b.textContent = state.t(installed ? 'install.installed' : 'install');
  b.disabled = installed;
  b.dataset.state = installer.state;
  // Running standalone (already installed): the chooser is never shown.
  if (installed && $('#install-dialog').open) $('#install-dialog').close();
}

function renderChooser() {
  const model = chooserModel({ state: installer.state, platform: installPlatform(navigator) });
  const sheet = $('#install-dialog');
  sheet.dataset.highlight = model.highlight || '';
  document.querySelectorAll('#install-dialog .choice').forEach((btn) => {
    const choice = btn.dataset.choice;
    const selected = choice === chooserSelection;
    btn.setAttribute('aria-pressed', String(selected));
    btn.classList.toggle('is-detected', choice === model.highlight);
    btn.querySelector('.badge').hidden = choice !== model.highlight;
  });
  document.querySelectorAll('#install-dialog [data-panel]').forEach((panel) => {
    panel.hidden = panel.dataset.panel !== chooserSelection;
  });
  // Plain link to the app (same URL, relative so it works under /joshs-tacos/).
  $('#install-link').textContent = appUrl();
}

function selectChoice(choice) {
  chooserSelection = choice;
  renderChooser();
}

function onInstall() {
  const model = chooserModel({ state: installer.state, platform: installPlatform(navigator) });
  if (!model.show) {
    renderInstallButton();
    return;
  }
  chooserSelection = model.initial;
  renderChooser();
  showDialog($('#install-dialog'));
}

// ---------- updates ----------
let updater = null;

function setUpdateStatus(key) {
  $('#update-status').textContent = key ? state.t(`update.${key}`) : '';
}

async function setupServiceWorker() {
  if (!('serviceWorker' in navigator)) {
    setUpdateStatus('unsupported');
    return;
  }
  updater = createUpdater({
    container: navigator.serviceWorker,
    session,
    isBusy: anyDialogOpen,
    saveState: persistCart,
    reload: () => location.reload(),
    onStatus: (s) => setUpdateStatus(s === 'current' ? '' : s),
  });
  try {
    const reg = await navigator.serviceWorker.register('sw.js', { scope: './' });
    await updater.start(reg);
  } catch {
    /* registration failed (e.g. file://); the app still works online */
  }
  const recheck = () => updater.check();
  window.addEventListener('focus', recheck);
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') recheck();
  });
  window.addEventListener('pageshow', (e) => { if (e.persisted) recheck(); });
}

async function onManualUpdate() {
  const b = $('#update-btn');
  if (!updater) { setUpdateStatus('unsupported'); return; }
  b.disabled = true;
  setUpdateStatus('checking');
  const res = await updater.check();
  setUpdateStatus(res === 'unsupported' ? 'unsupported' : res);
  b.disabled = false;
}

// ---------- offline ----------
function renderOnline() {
  $('#offline-banner').hidden = navigator.onLine !== false;
}

// ---------- boot ----------
function wire() {
  $('#lang-btn').addEventListener('click', () => {
    const next = state.lang === 'en' ? 'es' : 'en';
    saveLang(store, next);
    setLang(next);
  });
  $('#share-btn').addEventListener('click', onShare);
  $('#install-btn').addEventListener('click', onInstall);
  document.querySelectorAll('#install-dialog .choice').forEach((btn) =>
    btn.addEventListener('click', () => selectChoice(btn.dataset.choice)));
  $('#update-btn').addEventListener('click', onManualUpdate);
  $('#review-btn').addEventListener('click', openComposer);
  $('#clear-btn').addEventListener('click', () => {
    if (window.confirm(state.t('cart.clear.confirm'))) updateCart(emptyCart());
  });
  $('#maria-check').addEventListener('change', (e) => updateCart(setAskMaria(state.cart, e.target.checked)));
  $('#name-input').addEventListener('input', (e) => {
    store.setItem(NAME_KEY, e.target.value);
    renderComposer();
  });
  $('#copy-btn').addEventListener('click', async () => {
    const ok = await copyText(navigator, orderText());
    if (ok) toast(state.t('toast.copied'));
    else {
      toast(state.t('error.copy'));
      $('#order-preview').select();
    }
  });
  $('#menu-retry').addEventListener('click', boot);
  document.querySelectorAll('dialog').forEach((d) =>
    d.addEventListener('close', () => updater && updater.resume()));
  window.addEventListener('online', renderOnline);
  window.addEventListener('offline', renderOnline);
  // Keep the cart in sync across tabs.
  window.addEventListener('storage', (e) => {
    if (e.key && e.key.startsWith('jt-cart') && state.menu) {
      state.cart = loadCart(store, state.index);
      renderCart();
    }
  });
}

async function boot() {
  $('#menu-error').hidden = true;
  try {
    await Promise.all([loadDicts(), loadMenu()]);
  } catch {
    $('#menu-error').hidden = false;
    $('#menu-root').setAttribute('aria-busy', 'false');
    return;
  }
  state.cart = loadCart(store, state.index);
  persistCart();
  setLang(getSavedLang(store) || detectLang(navigator.languages || [navigator.language]));
  document.body.dataset.ready = 'true';
}

wire();
renderOnline();
boot().finally(setupServiceWorker);
