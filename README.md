# eBay Seller Feedback Filter

Chrome extension (Manifest V3) that hides eBay search-result listings from
low-reputation sellers.

## Features
- **Min positive rating %** — default **98%**, changeable.
- **Min feedback count** — default **50**, changeable.
- **Hide listings with no seller rating** — optional (off by default).
- On-page **🛡️ badge** showing `hidden / total`; click it to peek at what was
  filtered (revealed with a red dashed outline and the seller's stats).
- Works across dynamic loads / pagination via a `MutationObserver`.
- Settings sync via `chrome.storage.sync`.

## How it parses a listing
Each result is a `li.s-card`. The seller string lives in
`.su-card-container__attributes__secondary`, e.g. `mashr4 0% positive (0)` or
`newegg 99.6% positive (1M)`. The parser extracts the percentage and expands
`K`/`M` suffixes to real counts (`1.3K` → 1300, `1M` → 1000000).

## Install (unpacked)
1. Open `chrome://extensions`.
2. Toggle **Developer mode** on (top-right).
3. Click **Load unpacked** and select this folder.
4. Pin the extension and open the popup to adjust thresholds.

## Files
- `manifest.json` — MV3 config, content script matches for major eBay domains.
- `content.js` — parsing, filtering, badge, observer.
- `popup.html` / `popup.js` — settings UI + live per-page stats.

## Notes / decisions
- Listings whose seller rating can't be read are **shown** by default (so you
  never lose legit results to a layout change); flip *Hide listings with no
  seller rating* to be stricter.
- Hiding uses a CSS class (`display:none`), so nothing is deleted — toggling
  settings or the badge restores listings instantly.
- No icons are bundled; Chrome uses a default action icon. Drop 16/48/128px
  PNGs and add an `"icons"` block to `manifest.json` if you want custom art.
