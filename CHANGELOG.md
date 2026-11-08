# Changelog

## 1.1.1 — 2026-11-08
- Web-only release (owner request): **Install is a plain link plus guidance**, not an app download.
  The sheet (EN/ES) says Josh's Tacos is a website, shows the app link (same URL), and explains
  bookmarking or the browser's Add to Home Screen. The link opens in a normal browser tab.
- The app never calls `beforeinstallprompt.prompt()`; the browser's automatic install prompt is
  suppressed and the "Install now" button is removed. Android steps now say *Add to Home screen*
  (→ *Create shortcut* if asked) instead of *Install app*.
- No claims of a native app or a guaranteed full-screen launch.
- Manifest states `prefer_related_applications: false` (still standalone, same icons and colours).
- Regression tests: no APK/AAB/IPA files or links, no store/intent URLs, no download links, no
  `prompt()` call, no navigation/download/popup from the sheet; manifest and icon sizes verified.
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
