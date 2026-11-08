# Josh's Tacos Ordering App — Specification v005
Status: APPROVED, BUILD AUTHORIZED. Freddy approved in chat at 2:32 PM EST and by voice at 2:34 PM EST on Nov 8 2026. Authorized: coding, the PUBLIC freddyja/joshs-tacos (Freddy confirmed by voice at 2:35 PM EST) repo via Claude Bridge, hosting at computingmadeeasy.org/joshs-tacos/ (planned, not live yet), the App Center link, versioned copies to the Docu Cabinet and the FreddyWorkPC OneDrive App Designer folder (never overwriting), and the five GGL handoffs from the original brief. Prohibited: app stores and customer contact. The CME Web teammate deploys, coordinated through Claude Bridge.

## 1. Source facts
- Source: Josh's Tacos poster (222251.jpg). Phone (352) 606-8731 was supplied separately by Freddy; it does not appear on the poster.
- Reference copy: /workspace/joshs-tacos/reference/joshs-tacos-menu-reference-v001.jpg. The spec author viewed it on Nov 8 2026 and the parent checked it separately; the menu facts below match it. The poster says "CALL OR TEXT to place your order!" and "Cash & electronic payments accepted".
- Pickup only. The poster says cash and electronic payments are accepted, but it doesn't name providers.
- Slogans: "Simple ingredients. Big flavor." / "Good food. Made with love." / "Fresh filling. Homemade."
- Not on the poster, so do not invent: hours, address, tax, minimum order, named payment methods, stock.

## 2. Menu (prices in integer cents)
| Item | Packs |
|---|---|
| Ground beef tacos | 1 = $3.00, 3 = $8.00, 5 = $12.00 |
| Beef empanadas | 1 = $3.00, 2 = $5.00, 3 = $7.00 |
| White rice | $3.00 |
| Juicy beans | $3.00 |
| Mini bag chips (assorted) | $1.00 |
| Cornbread | $1.00 |
| Sweet tea | $2.00 |
| Taco Combo | $10.00: 3 tacos, rice, sweet tea |
| Big Taco Combo | $13.00: 5 tacos, rice, sweet tea |
| Taco & Sides | $12.00: 3 tacos, rice, beans, mini bag chips, sweet tea |
| Full Plate | $15.00: 5 tacos, rice, beans, mini bag chips, sweet tea |
| Maria Special | "Ask about it." Inquiry only. No price, not added to the cart as a priced item. |

Cart rules:
- Customers add an exact pack (for example, "3 tacos $8") as its own line.
- No automatic re-bundling and no price optimization.
- All math uses integer cents.
- The cart shows an "Estimated subtotal". It never shows a final total. Tax, availability, pickup time, and final price are confirmed by the seller.
- Maria Special has an "Ask about Maria Special" toggle that adds a question line to the order text.

## 3. Version 1 scope
In scope: a static PWA with the menu, cart, and order composer.
- **Order by text:** opens the phone's own SMS app with `sms:+13526068731?body=…` and the order prefilled. The customer reviews it and presses Send. The app never sends automatically.
- **Fallbacks:** a `tel:` call link, and "Copy order summary".
- **Out of scope:** backend, checkout, payments, login, analytics, and auto-SMS.

## 4. Languages
English and Spanish only. Language is picked from the browser and can be changed with a toggle that is saved locally. Both languages cover every UI string, menu item name, error, install instruction, update message, and the order text. CI fails if any key is missing in either language.

Sample strings:
| key | EN | ES |
|---|---|---|
| order.cta | Text my order | Enviar pedido por mensaje |
| cart.subtotal | Estimated subtotal | Subtotal estimado |
| cart.note | Seller confirms price, pickup time & availability | El vendedor confirma precio, hora de recogida y disponibilidad |
| share | Share | Compartir |
| install | Install app | Instalar app |
| update | Check for updates | Buscar actualizaciones |
| update.ready | Update ready — tap to refresh | Actualización lista — toca para recargar |
| maria | Ask about the Maria Special | Preguntar por el Especial de María |
| pickup | Pickup only | Solo para recoger |
| offline | Offline — prices may be out of date. Confirm with the seller. | Sin conexión — los precios pueden no estar actualizados. Confirma con el vendedor. |

Order text template (EN):
"Hi Josh's Tacos! Pickup order: 1× Taco Combo ($10.00); 1× 2 empanadas ($5.00). Estimated subtotal $15.00. Ask about Maria Special: yes. Name: ___. Please confirm price & pickup time."
The ES template has the same structure.

## 5. The three required buttons (all must work before any demo)
1. **Share:** uses `navigator.share` (title, text, URL). If that isn't available, copies the URL to the clipboard and confirms with a toast. If the clipboard is also unavailable, shows the URL to select by hand.
2. **Install:** captures `beforeinstallprompt` and calls `prompt()`. If the app is already installed (standalone), the button shows "Installed". On iOS or unsupported browsers, it shows step-by-step EN/ES instructions (Share → Add to Home Screen).
3. **Auto-update (hard requirement):** a versioned service worker (`CACHE = jt-v<semver>`).
   - Every time the app opens (startup) and whenever it regains focus or becomes visible again, it calls `registration.update()`.
   - If a newer worker is found, the app activates it AUTOMATICALLY. Sequence: save the cart to localStorage synchronously, send `SKIP_WAITING` to the worker, then reload once when `controllerchange` fires.
   - Loop guard: a sessionStorage flag records the version it reloaded to, so the app never reloads twice for the same version.
   - The automatic refresh waits while the order composer or a dialog is open, then runs when the user leaves it.
   - The manual "Check for updates" button runs the same flow on demand and shows "Up to date" or "Updating…" in EN/ES.
   - The worker deletes only caches with the `jt-` prefix.
   - The menu JSON has a version and date. Offline, a banner says prices may be stale and the app never claims they are current.
   - Required proof: a Playwright test that serves build v1, puts items in the cart, deploys v2, reopens or refocuses the app, and asserts that v2 is active, the cart is unchanged, exactly one reload happened, and the old cache is gone.

## 6. Branding
- Palette sampled from the poster: black background, red accents and CTAs, gold headings and prices, cream body panels.
- Pull exact hex values from the poster at build time. Starting values: #111111, #C8102E, #E0A526, #F5ECD7. Check contrast against WCAG AA.
- Slogans go in the header and footer.
- Poster crops and imagery are authorized. Leave out third-party marks such as the Lay's logo on the chips bag. No new paid image generation.

## 7. Hosting and delivery (authorized)
1. Claude Bridge builds in the PUBLIC repo freddyja/joshs-tacos and hands a tested ZIP to the CME Web teammate.
2. The teammate deploys it to computingmadeeasy.org/joshs-tacos/ (never github.io) and adds an App Center entry without changing other apps.
3. Versioned copies go to /home/box/shared/docu-cabinet/ and the FreddyWorkPC OneDrive App Designer folder, never overwriting.
4. GGL handoffs: SEO gets the details, Pricing the scope, Central Hub and Docu Cabinet the deliverables, Closer the demo.
5. No app stores and no customer contact.

## 8. Accessibility and quality
Mobile-first, keyboard and screen-reader labels, tap targets of 44px or more, Lighthouse PWA installable.
