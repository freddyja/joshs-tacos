# Implementation Plan v004: Josh's Tacos PWA (for Claude Bridge)
Scope: spec v005. PUBLIC repo freddyja/joshs-tacos. Target: CME /joshs-tacos/, deployed by the CME Web teammate from a tested ZIP. No app stores, no customer contact.
Stack: Vite + vanilla TypeScript, Vitest, Playwright. No backend.

## Tasks (TDD: write each failing test first, then the code)
1. **Scaffold.** PUBLIC repo, Vite TS, Vitest, Playwright, and a CI workflow.
   Test: the CI smoke test passes.
2. **menu.json.** Prices in integer cents, plus `version` and `updated` fields. Maria Special is `inquiryOnly: true`.
   Test: snapshot test against the poster table. Source: reference/joshs-tacos-menu-reference-v001.jpg.
3. **Cart module.** Exact pack lines, qty +/-, cents subtotal, localStorage persistence.
   Tests: arithmetic, no re-bundling, Maria never priced, survives reload.
4. **i18n (en.json, es.json).**
   Tests: key parity, no missing keys, no third locale file, and the toggle persists.
5. **Order composer.** Builds the EN/ES text, the `sms:+13526068731?body=` URL (encoded), the `tel:` link, and the copy fallback.
   Tests: encoding, "estimated subtotal" wording, and no auto-send (the app only sets href).
6. **Share button.** Web Share, then clipboard, then manual URL.
   Tests: unit tests with mocked navigator, plus Playwright on desktop and mobile.
7. **Install button.** `beforeinstallprompt` capture, "Installed" state, iOS instructions.
   Tests: unit tests plus Playwright, and Lighthouse installable.
8. **Service worker auto-update.** On startup and on focus or visibility change, call `update()`. If a new version is waiting: save the cart, send SKIP_WAITING, reload once on controllerchange. A sessionStorage guard prevents reload loops, and the refresh is deferred while the composer is open. The manual button uses the same flow. Delete only jt- caches. Show the offline stale-price banner.
   Tests: two-build Playwright upgrade (v1 → v2, triggered by reopen and by focus): v2 is active, the cart is preserved, exactly one reload, old cache deleted, no loop on a second focus.
9. **Branding UI.** Poster palette (black, red, gold, cream) sampled from the image. Slogans. WCAG AA contrast.
   Tests: axe + contrast checks, 44px tap targets.
10. **Docs.** README, guide (from user-guide v001), versioned CHANGELOG.

## Self-review gate before telling Freddy it's ready for review
- Acceptance checklist v001 fully green, with evidence logs in docs/.
- No invented hours, address, tax, minimums, or payment providers. No Portuguese. No secrets.
- Review on a private preview or locally only. After the checklist is green: hand the ZIP to CME Web, then do the copies and handoffs.
