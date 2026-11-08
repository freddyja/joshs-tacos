# Changelog

## 1.1.1 — 2026-11-08
- Web-only release (owner request): the Install chooser now says, in EN/ES, that this is a
  web app the browser adds to the home screen, with no app store and no app file to download,
  and that it opens without the browser's address bar from the home screen. Android's button
  reads "Add to Home screen" and only triggers the browser's own `beforeinstallprompt`.
- Manifest states `prefer_related_applications: false`; no native packages or store links anywhere.
- Regression tests: no APK/AAB/IPA files or links, no download links, no store/intent URLs,
  no navigation/download/popup from the chooser; manifest standalone + icon sizes verified.
- Packaging uses a private temp staging folder per run (parallel runs no longer collide).
- Service-worker cache bumped to `jt-v1.1.1`. Release ZIP: `docs/release/joshs-tacos-cme-v003.zip`.

## 1.1.0 — 2026-11-08
- Install chooser sheet (EN/ES, poster colours): **Android** uses the captured
  `beforeinstallprompt` ("Install now") or shows Chrome-menu steps; **iPhone/iPad** shows
  4 illustrated Safari steps (open in Safari → Share → Add to Home Screen → Add).
  The detected platform is highlighted and opened; the chooser is hidden when running standalone.
- Fix: the `hidden` attribute now always wins over button display styles (the
  "Clear order" button no longer shows on an empty cart).
- Service-worker cache bumped to `jt-v1.1.0` (auto-update keeps the cart).
- Release ZIP adds `.htaccess` (`AddType application/manifest+json .webmanifest`);
  committed as `docs/release/joshs-tacos-cme-v002.zip`.

## 1.0.0 — 2026-11-08
- First release: static EN/ES PWA for Josh's Tacos pickup orders (spec v005).
- Menu from the poster in integer cents; Maria Special inquiry-only.
- Cart with exact pack lines, estimated subtotal, saved in localStorage.
- Order by SMS to (352) 606-8731 (customer presses Send), plus Call and Copy fallbacks.
- Share (Web Share → copy → manual), Install (prompt → iOS/Android steps → Installed).
- Automatic service-worker updates on open/focus with cart preserved, single reload and loop guard; manual "Check for updates".
- Offline stale-price banner. Vitest + Playwright suites, including the v1 → v2 upgrade proof.
