# Chrome Web Store — Listing Copy & Submission Kit

Everything to paste into the Developer Dashboard. Fields map to the dashboard's
**Store listing**, **Privacy**, and **Package** tabs.

---

## Store listing

**Item name** (≤45 chars)
```
eBay Seller Feedback Filter
```

**Summary / short description** (≤132 chars)
```
Hide eBay listings from low-feedback sellers and highlight the best deal (price, condition & seller trust). No setup, runs locally.
```

**Category:** Shopping
**Language:** English (United States)

**Detailed description** (paste into the big description box)
```
Clean up eBay search results and spot the real deal — instantly, with zero setup.

eBay Seller Feedback Filter runs entirely in your browser. There are no
accounts, no API keys, and no servers: everything happens locally on the page.

HIDE LOW-FEEDBACK SELLERS
• Set a minimum positive-rating % (default 98%).
• Set a minimum feedback count (default 50).
• Optionally hide listings that show no seller rating.
Listings from sellers below your thresholds are hidden from the results.

FILTER BY CONDITION
Independently include or exclude:
• New / Open Box
• Used / Refurbished
• For parts / not working
Uncheck a bucket and those listings disappear.

FILTER BY LISTING TYPE
• Include or exclude auctions (Buy It Now / fixed-price only).

HIGHLIGHT THE BEST DEAL
Turn on the best-deal option and the extension scores the visible listings by
price, condition, and seller trust, then marks the winner and pins it to the
top of the results. It only ever picks real, working, like-for-like products —
never accessories, "for parts / not working" items, or auction current-bids.

RELOAD IN PLACE
Change a setting and click "Reload items" to re-filter and re-rank the page
instantly — no page refresh needed.

PRIVACY
No data collection. No tracking. No network requests. The only stored data is
your own settings, saved via Chrome sync. Privacy policy:
https://github.com/KurtLehnardt/ebay-seller-feedback-filter/blob/main/PRIVACY.md

Not affiliated with or endorsed by eBay Inc.
```

**Screenshots** (required: at least one 1280×800 or 640×400 PNG/JPEG)
Capture real screenshots (Google may reject mockups):
1. An eBay search page with the popup open showing the settings.
2. The same page after filtering — with the green ⭐ "Best deal" card pinned to
   the top, and the 🛡️ badge showing "N hidden".
3. (Optional) The reveal view (click the 🛡️ badge) showing filtered listings
   outlined in red.
macOS capture: Cmd+Shift+4 then Space to grab a window, or Cmd+Shift+5. If a
shot isn't already 1280×800, pad/resize it to those dimensions.

---

## Privacy tab

**Single purpose** (one sentence)
```
Filter eBay search results by seller feedback, condition, and listing type, and highlight the best-value listing.
```

**Permission justifications**
- `storage`
```
Stores the user's filter thresholds and toggle preferences so they persist between sessions and sync across the user's Chrome profile.
```
- Host access to eBay domains (from content_scripts `matches`)
```
The extension's single purpose is to filter and re-rank eBay search results. It needs to read and modify the search-results page on eBay domains to hide listings that don't meet the user's seller/condition/listing-type criteria and to highlight the best-value listing. No page data is transmitted anywhere.
```

**Remote code:** No — the extension executes no remotely hosted code.

**Data usage disclosures:** Certify that the extension does **not** collect or
use user data. (No categories apply.)

**Privacy policy URL**
```
https://github.com/KurtLehnardt/ebay-seller-feedback-filter/blob/main/PRIVACY.md
```

---

## Package tab
Upload `ebay-seller-feedback-filter.zip` (built at the repo root; see README).

---

## Submission steps
1. Go to https://chrome.google.com/webstore/devconsole and sign in.
2. If first time: pay the one-time $5 registration fee and accept the developer
   agreement.
3. Click **Add new item** → upload `ebay-seller-feedback-filter.zip`.
4. Fill **Store listing** (copy above) and add screenshots.
5. Fill **Privacy** (single purpose, permission justifications, data disclosures,
   privacy policy URL).
6. Set visibility (Public / Unlisted) and **Submit for review**.
7. Review typically takes a few days; you'll get an email on approval or if
   changes are requested.
