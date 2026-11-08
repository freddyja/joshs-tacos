# Changelog

## 1.0.0 — 2026-11-08
- First release: static EN/ES PWA for Josh's Tacos pickup orders (spec v005).
- Menu from the poster in integer cents; Maria Special inquiry-only.
- Cart with exact pack lines, estimated subtotal, saved in localStorage.
- Order by SMS to (352) 606-8731 (customer presses Send), plus Call and Copy fallbacks.
- Share (Web Share → copy → manual), Install (prompt → iOS/Android steps → Installed).
- Automatic service-worker updates on open/focus with cart preserved, single reload and loop guard; manual "Check for updates".
- Offline stale-price banner. Vitest + Playwright suites, including the v1 → v2 upgrade proof.
