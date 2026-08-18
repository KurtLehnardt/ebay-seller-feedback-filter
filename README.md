# eBay Seller Feedback Filter

Chrome extension (Manifest V3) that cleans up eBay search results. **No setup,
no account, no API key — install and it just works, 100% on-device.**

## Features

### Hide low-feedback sellers
- **Min positive rating %** — default **98%**, changeable.
- **Min feedback count** — default **50**, changeable.
- **Hide listings with no seller rating** — optional (off by default).

### Filter by condition
Independently include or exclude each condition bucket (all included by
default). Excluded conditions are hidden from the page:
- **New / Open Box** — `new`, `new (unsealed)`, `open box`.
- **Used / Refurbished** — `used`, `refurbished`.
- **For parts / not working** — `for parts`, `not working`, `spares or repair`, etc.

Listings whose condition can't be read are left visible (never hidden by this
filter).

### Filter by listing type
**Include auctions** (default on) — uncheck to hide auction listings and show
only Buy It Now / fixed-price. Auctions are detected by their countdown timer
(`6d 4h 22m`) or bid count. An auction's price is a moving *current bid*, so
auctions are **always excluded from best-deal ranking** regardless of this toggle.

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
- **Reload items** button re-applies filters/ranking to the current page
  instantly — no page refresh (toggles also apply live).
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
The code is store-ready (MV3, icons, minimal permissions, no remote code).
See **[STORE_LISTING.md](STORE_LISTING.md)** for the full listing copy,
permission justifications, and step-by-step submission, and
**[PRIVACY.md](PRIVACY.md)** for the privacy policy.

Build the upload package (runtime files only):

```bash
zip -rq ebay-seller-feedback-filter.zip manifest.json content.js popup.html popup.js icons -x '*.DS_Store'
```

Then upload `ebay-seller-feedback-filter.zip` at the
[Developer Dashboard](https://chrome.google.com/webstore/devconsole) — a
one-time $5 developer registration is required.

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
- When a listing's **title and condition field disagree** (e.g. title says
  "Used" but the field says "Brand New"), the more pessimistic condition is
  used — so a mislabeled item can't win on an undeserved "new" bonus.
- Unparseable-seller listings are **shown** by default (so a layout change never
  silently drops legit results); flip *Hide listings with no seller rating* to
  be stricter.
- Selectors track eBay's current `s-card` markup; a redesign would need updates.
