# Implementation Plan v001: Josh's Tacos PWA (for Claude Bridge)
Approval update (v002): coding, private repo, CME demo hosting and app-center update authorized 2:34 PM EST; no app stores/customer contact. Self-review gate now ends before public deploy only after checklist is green.
Scope: spec v002 (approved). Private repo freddyja/joshs-tacos. No publishing.
Stack: Vite + vanilla TypeScript, Vitest, Playwright. No backend.

## Tasks (TDD: write each failing test first, then the code)
1. **Scaffold.** Private repo, Vite TS, Vitest, Playwright, and a CI workflow.
   Test: the CI smoke test passes.
2. **menu.json.** Prices in integer cents, plus `version` and `updated` fields. Maria Special is `inquiryOnly: true`.
   Test: snapshot test against the poster table. Re-verify the image first; the attachment wasn't on the box when the spec was drafted.
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
8. **Service worker updates.** `jt-v<semver>` cache. Update check on start, on focus, and on button press. Waiting worker plus a "Refresh" prompt, or refresh when idle with the cart saved. Deletes only `jt-` caches. Offline stale-price banner.
   Tests: Playwright with two builds (v1 → v2): update detected, cart preserved, old cache removed, banner shown offline.
9. **Branding UI.** Poster palette (black, red, gold, cream) sampled from the image. Slogans. WCAG AA contrast.
   Tests: axe + contrast checks, 44px tap targets.
10. **Docs.** README, guide (from user-guide v001), versioned CHANGELOG.

## Self-review gate before telling Freddy it's ready for review
- Acceptance checklist v001 fully green, with evidence logs in docs/.
- No invented hours, address, tax, minimums, or payment providers. No Portuguese. No secrets.
- Review on a private preview or locally only. Stop before any public deploy, app-center edit, handoff, or file copy.
