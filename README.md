# Josh's Tacos — pickup ordering PWA (EN/ES)

A static, installable web app for ordering Josh's Tacos **for pickup** by text message.
Hosted at **https://computingmadeeasy.org/joshs-tacos/** (planned; deployed by the CME Web teammate).

- No backend, no payments, no login, no analytics.
- English and Spanish only (toggle saved in `localStorage`).
- The customer builds an order, the app opens their own SMS app to **(352) 606-8731** with the
  order filled in, and **the customer presses Send**. The app never sends anything itself.
- Pickup only. Cash & electronic payments accepted. The seller confirms final price,
  availability and pickup time. The app shows an *estimated* subtotal only and never says an
  order is accepted.

Specs this build follows: `docs/joshs-tacos-spec-v005.md`, `docs/joshs-tacos-implementation-plan-v004.md`,
`docs/joshs-tacos-acceptance-checklist-v003.md`, and the poster `docs/joshs-tacos-menu-reference-v001.jpg`.

## Layout

```
app/                  <- everything that gets deployed (plain HTML/CSS/JS ES modules, no build step)
  index.html  styles.css  sw.js  manifest.webmanifest  menu.json
  i18n/en.json  i18n/es.json
  js/app.js      UI wiring
  js/cart.js     cart + integer-cent pricing
  js/order.js    order text, sms:/tel: links (iOS "&body=", Android "?body=")
  js/i18n.js     language detect / toggle
  js/share.js    Web Share -> copy link -> manual link
  js/install.js  Install chooser: Android (beforeinstallprompt or Chrome steps) / iPhone-iPad (Safari steps)
  js/updater.js  automatic service-worker updates
  js/version.js  app version (keep in sync with sw.js)
  icons/ img/    crops of the poster (no third-party logos)
tests/unit/       Vitest
tests/e2e/        Playwright (incl. the v1 -> v2 upgrade proof)
scripts/          dev server, version bump, packaging
docs/evidence/    upgrade proof output (JSON + screenshot) and test logs
```

All URLs are relative, the manifest uses `start_url: "./"` and `scope: "./"`, and the
service worker is registered as `sw.js` with scope `./`, so the app works under `/joshs-tacos/`
(or any other folder).

## Develop

```bash
npm install
```

```bash
npm run serve        # http://127.0.0.1:8080/joshs-tacos/ (same sub-path as production)
```

```bash
npm test             # Vitest unit tests
```

```bash
npm run test:e2e     # Playwright (Chromium), desktop + mobile
```

## Menu and prices

`app/menu.json` holds every price as **integer cents** plus `version` and `updated`.
Each pack (for example "3 tacos $8") is its own cart line; there is no automatic re-bundling.
Maria Special is `inquiryOnly` — it has no price and only adds "Ask about Maria Special: yes"
to the order text. Names live in `app/i18n/*.json` (`sku.*`, `item.*`, `desc.*`).
Do not add hours, address, tax, minimums, delivery, or named payment providers: none are on the poster.

## Releasing an update (auto-update)

1. Make the change (menu, text, code).
2. Bump the version — this changes the cache name `jt-v<version>`:
   ```bash
   npm run bump -- 1.0.1
   ```
3. Run the tests, then build the ZIP (top folder `joshs-tacos/`, includes `.htaccess`):
   ```bash
   npm test && npm run test:e2e
   ```
   ```bash
   npm run package -- docs/release/joshs-tacos-cme-v00N.zip
   ```
4. Unzip it in the web root so the files land in `/joshs-tacos/`. The bundled `.htaccess`
   (`AddType application/manifest+json .webmanifest`) serves the manifest with the right type
   on Apache. Serve `sw.js` with `Cache-Control: no-cache` if the host allows it.

How customers get it: every time the app opens, regains focus or becomes visible again it calls
`registration.update()`. When a new worker is installed the app saves the cart to
`localStorage`, sends `SKIP_WAITING` (the worker then calls `skipWaiting()` + `clients.claim()`
and deletes only old `jt-` caches), and reloads **once** on `controllerchange`. A
`sessionStorage` flag (`jt-reloaded-to`) records the version it reloaded to, so it never loops.
If the order composer or another dialog is open, the refresh waits until it is closed.
The footer "Check for updates" button runs the same flow on demand and shows
"Checking… / Up to date / Updating…" in EN/ES.

Proof: `tests/e2e/upgrade.spec.js` serves build v1, fills the cart, deploys v2, then
refocuses (and, separately, reopens) the app, and asserts v2 is active, the cart is unchanged,
exactly one reload happened, the old cache is gone, and a second focus does not reload.
The last run's output is in `docs/evidence/upgrade-proof.json`.

## Install chooser

Josh's Tacos is **web-only**: there is no app-provided Android package (APK/AAB), no app-store
listing and no native wrapper. "Install" means the browser adds the web app to the home screen;
installed launches open standalone (no address bar) from `display: "standalone"` in the manifest.
Normal browser tabs keep their usual controls. `tests/unit/web-only.test.js` and the
"web-only" e2e tests fail if an APK/store link, download link or native package is introduced.

The **Install app** button opens a bottom sheet with two options:

- **Android**: if Chrome fired `beforeinstallprompt`, an **Add to Home screen** button shows the
  browser's own prompt. Otherwise (or after it's dismissed) it shows the steps: Chrome menu ⋮ → *Install app* /
  *Add to Home screen* → *Install*.
- **iPhone / iPad**: four illustrated steps: open in Safari → tap Share → *Add to Home Screen* → *Add*.

The detected platform is highlighted ("Your device") and opened first. When the app already runs
standalone the button reads **Installed** and the chooser is never shown.

## Notes

- The plan (v004) suggested Vite + TypeScript; this build uses plain ES modules with no build
  step, as requested for a static vanilla HTML/CSS/JS app. Tests and behaviour are the same.
- Fonts are system fonts (Impact-style display font where available) so the app works offline.
- The repo is public: it contains no keys or secrets, and none are needed.
