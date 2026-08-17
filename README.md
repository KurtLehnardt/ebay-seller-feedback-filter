# eBay Seller Feedback Filter

Chrome extension (Manifest V3) that cleans up eBay search results. **No setup,
no account, no API key — install and it just works, 100% on-device.**

## Features

### Hide low-feedback sellers
- **Min positive rating %** — default **98%**, changeable.
- **Min feedback count** — default **50**, changeable.
- **Hide listings with no seller rating** — optional (off by default).

### Highlight the best deal (optional toggle)
Ranks the *visible* listings and marks the winner with a green ⭐ badge, then
**pins it to the top of the results**. The score combines:
- **Price** (price + shipping) — weighted highest.
- **Seller trust** — positive % scaled by feedback volume.
- **Condition** — New > New (unsealed) > Open Box > Used.

"Best deal, not by price alone." Comparability is handled without an LLM: a
median-anchored price band plus accessory keywords drop the noise (cables,
holders, boxes, eGPUs, whole PCs, and troll/typo prices) so the winner is a
real, like-for-like product. Toggling it off restores the original order.

### Also
- On-page **🛡️ badge** showing `hidden / total`; click to peek at what was
  filtered (red dashed outline + the seller's stats).
- Works across dynamic loads / pagination via a `MutationObserver`.
- Settings sync via `chrome.storage.sync`.

## Privacy
Collects nothing, sends nothing. The only permission is `storage` (to save your
thresholds). All parsing and ranking happen in the page.

## How it parses a listing
Each result is a `li.s-card`. Seller string lives in
`.su-card-container__attributes__secondary` (e.g. `newegg 99.6% positive (1M)`);
`K`/`M` suffixes are expanded to real counts. Price comes from `.s-card__price`
and condition from `.s-card__subtitle`.

## Install (unpacked, for development)
1. Open `chrome://extensions`.
2. Toggle **Developer mode** on (top-right).
3. Click **Load unpacked** and select this folder.

## Publishing to the Chrome Web Store
The code is store-ready (icons, MV3, minimal permissions). To publish:
1. Zip the extension: `zip -r ebay-seller-feedback-filter.zip . -x '.git/*'`.
2. Register a Chrome Web Store developer account (one-time $5 fee).
3. At the [Developer Dashboard](https://chrome.google.com/webstore/devconsole),
   upload the zip, add screenshots + a description, and complete the privacy
   form: **no data collected**, permission `storage` justified as "saving user
   settings."
4. Submit for review (typically a few days).

## Files
- `manifest.json` — MV3 config, icons, content-script matches.
- `content.js` — parsing, filtering, best-deal scoring, pin-to-top, badge.
- `popup.html` / `popup.js` — settings UI + live per-page stats.
- `icons/` — 16/32/48/128 px store icons.

## Notes / decisions
- Best-deal picks only from **visible** (non-hidden) listings, so a low-trust
  seller can never win even if it's cheapest.
- Listings marked **For parts / not working** (and accessories) are never
  eligible to be the best deal, no matter how cheap.
- Unparseable-seller listings are **shown** by default (so a layout change never
  silently drops legit results); flip *Hide listings with no seller rating* to
  be stricter.
- Selectors track eBay's current `s-card` markup; a redesign would need updates.
