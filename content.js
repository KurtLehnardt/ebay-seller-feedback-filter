/* eBay Seller Feedback Filter — content script
 * 1. Hides search-result listings whose seller falls below the configured
 *    positive-rating percentage and/or feedback-count thresholds.
 * 2. Optionally finds the "best deal" on the page (product + price + condition
 *    + seller trust), highlights it, and pins it to the top of the results.
 * Everything runs locally — no network, no API keys, no token cost.
 */
(() => {
  "use strict";

  const DEFAULTS = {
    enabled: true,
    minPercent: 98,     // hide sellers below this positive %
    minFeedback: 50,    // hide sellers with fewer than this many feedbacks
    hideUnknown: false, // hide listings where no seller rating is shown
    bestDeal: false,    // highlight best deal & pin it to the top
  };

  const LISTING_SELECTOR = "li.s-card";
  const SELLER_SCOPE = ".su-card-container__attributes__secondary";
  const HIDDEN_CLASS = "esf-hidden";
  const REVEAL_CLASS = "esf-reveal";
  const BEST_CLASS = "esf-best";

  // Best-deal scoring weights (must sum to 1). Price leads, then seller trust,
  // then condition — "not by price alone."
  const W_PRICE = 0.5;
  const W_TRUST = 0.3;
  const W_COND = 0.2;

  const CONDITION_WEIGHT = {
    new: 1.0,
    new_unsealed: 0.9,
    open_box: 0.85,
    refurbished: 0.75,
    unknown: 0.7,
    used: 0.6,
    for_parts: 0.0, // excluded from best-deal entirely; kept for completeness
  };

  // Titles matching these are not the primary product (accessories, PCs, eGPUs).
  const ACCESSORY_RE =
    /\b(box only|holder|bracket|stand|riser|extension cable|adapter|cable|water\s?block|backplate|block for|cooler|power supply|psu|mouse\s?pad|sticker|keychain|anti[-\s]?sag|support stick|card holder|xg mobile|egpu|thunderbolt|gaming pc|prebuilt|pre-built|desktop|full system|complete pc|ryzen|core i[3579])\b/i;

  // "For parts or not working" and equivalents — never a "deal".
  const BROKEN_RE =
    /\b(for parts|not working|non[-\s]?working|spares?\s+or\s+repair|parts only|does\s?n'?t work|does not work|for repair)\b/i;

  let settings = { ...DEFAULTS };
  let observer = null;
  let lastStats = { hidden: 0, total: 0, best: null };

  // Pin state (so we can restore original order when toggled off).
  let pinnedEl = null;
  let pinAnchor = null;

  /* ---------- seller parsing ---------- */

  // "100% positive (697)" | "99.9% positive (1.3K)" | "0% positive (0)" | "(1M)"
  const SELLER_RE =
    /(\d+(?:\.\d+)?)\s*%\s*positive\s*\(\s*([\d.,]+)\s*([KM]?)\s*\)/i;

  function parseSeller(text) {
    if (!text) return null;
    const m = text.match(SELLER_RE);
    if (!m) return null;
    const percent = parseFloat(m[1]);
    let count = parseFloat(m[2].replace(/,/g, ""));
    const suffix = m[3].toUpperCase();
    if (suffix === "K") count *= 1e3;
    else if (suffix === "M") count *= 1e6;
    if (!isFinite(percent) || !isFinite(count)) return null;
    return { percent, count: Math.round(count) };
  }

  function extractSellerInfo(li) {
    const scope = li.querySelector(SELLER_SCOPE);
    return (scope && parseSeller(scope.textContent)) || parseSeller(li.textContent);
  }

  /* ---------- price / condition parsing ---------- */

  function parsePrice(li) {
    const priceEl = li.querySelector(".s-card__price");
    const src = priceEl ? priceEl.textContent : li.textContent;
    // First $ amount = current price (ranges like "$6,300.00$8,400.00" -> 6300).
    const m = src.match(/\$\s*([\d,]+(?:\.\d{1,2})?)/);
    if (!m) return null;
    const base = parseFloat(m[1].replace(/,/g, ""));
    if (!isFinite(base) || base <= 0) return null;
    let shipping = 0;
    const sm = li.textContent.match(
      /\+\s*\$\s*([\d,]+(?:\.\d{1,2})?)\s*(?:delivery|shipping|postage)/i
    );
    if (sm) shipping = parseFloat(sm[1].replace(/,/g, "")) || 0;
    return { base, shipping, total: base + shipping };
  }

  function parseCondition(li) {
    // Scan the whole card — the "for parts" flag can render outside the subtitle.
    if (BROKEN_RE.test(li.textContent)) return "for_parts";
    const sub = li.querySelector(".s-card__subtitle");
    const t = (sub ? sub.textContent : "").toLowerCase();
    if (/open box/.test(t)) return "open_box";
    if (/unsealed/.test(t)) return "new_unsealed";
    if (/refurb/.test(t)) return "refurbished";
    if (/pre-?owned|used/.test(t)) return "used";
    if (/new/.test(t)) return "new";
    return "unknown";
  }

  function getTitle(li) {
    const el = li.querySelector(".s-card__title");
    return el ? el.textContent : "";
  }

  /* ---------- filtering (seller quality) ---------- */

  function shouldHide(info) {
    if (!settings.enabled) return false;
    if (!info) return settings.hideUnknown;
    return info.percent < settings.minPercent || info.count < settings.minFeedback;
  }

  /* ---------- best-deal scoring ---------- */

  function trustFactor(info) {
    if (!info || info.count === 0) return 0.05;
    const volume = Math.min(1, Math.log10(info.count + 1) / 3); // ~1 at 1000+
    return (info.percent / 100) * (0.5 + 0.5 * volume);
  }

  function median(nums) {
    const s = [...nums].sort((a, b) => a - b);
    const n = s.length;
    return n % 2 ? s[(n - 1) / 2] : (s[n / 2 - 1] + s[n / 2]) / 2;
  }

  // candidates: [{ li, info, price:{total}, condition, title }]
  function pickBestDeal(candidates) {
    const priced = candidates.filter((c) => c.price && isFinite(c.price.total));
    // Never eligible: broken ("for parts / not working") or accessory listings.
    const eligible = priced.filter(
      (c) => c.condition !== "for_parts" && !ACCESSORY_RE.test(c.title)
    );
    if (eligible.length === 0) return null;

    // Cohort = the comparable-product band. Median-anchored over *eligible*
    // items so cheap broken/accessory listings can't drag the band down.
    const med = median(eligible.map((c) => c.price.total));
    const lowCut = 0.35 * med;
    const highCut = 4 * med;
    let cohort = eligible.filter(
      (c) => c.price.total >= lowCut && c.price.total <= highCut
    );
    if (cohort.length === 0) cohort = eligible;

    const totals = cohort.map((c) => c.price.total);
    const min = Math.min(...totals);
    const max = Math.max(...totals);

    let best = null;
    for (const c of cohort) {
      const cheap = max === min ? 1 : (max - c.price.total) / (max - min);
      const cond = CONDITION_WEIGHT[c.condition] ?? 0.7;
      const trust = trustFactor(c.info);
      const score = W_PRICE * cheap + W_TRUST * trust + W_COND * cond;
      if (!best || score > best.score ||
          (score === best.score && c.price.total < best.price.total)) {
        best = { ...c, score };
      }
    }
    return best;
  }

  function bestLabel(best) {
    const price = `$${best.price.total.toLocaleString(undefined, {
      maximumFractionDigits: 0,
    })}`;
    const cond = best.condition.replace("_", " ");
    const seller = best.info
      ? `${best.info.percent}% (${best.info.count.toLocaleString()})`
      : "no rating";
    return `Best deal · ${price} · ${cond} · ${seller}`;
  }

  /* ---------- pin to top ---------- */

  function ensureFirst(el) {
    const parent = el.parentNode;
    if (parent && parent.firstElementChild !== el) {
      parent.insertBefore(el, parent.firstElementChild);
    }
  }

  function pin(el) {
    if (pinnedEl === el) {
      ensureFirst(el);
      return;
    }
    unpin();
    pinAnchor = document.createComment("esf-anchor");
    el.parentNode.insertBefore(pinAnchor, el); // mark original slot
    pinnedEl = el;
    ensureFirst(el);
  }

  function unpin() {
    if (pinnedEl) {
      if (pinAnchor && pinAnchor.isConnected && pinnedEl.isConnected) {
        pinAnchor.parentNode.insertBefore(pinnedEl, pinAnchor); // restore slot
      }
      pinnedEl.classList.remove(BEST_CLASS);
    }
    if (pinAnchor && pinAnchor.isConnected) pinAnchor.remove();
    pinnedEl = null;
    pinAnchor = null;
  }

  function applyBest(best) {
    // Clear stale highlights.
    document.querySelectorAll("." + BEST_CLASS).forEach((e) => {
      if (!best || e !== best.li) e.classList.remove(BEST_CLASS);
    });
    if (!settings.bestDeal || !best) {
      unpin();
      return;
    }
    pin(best.li);
    best.li.classList.add(BEST_CLASS);
    best.li.dataset.esfBest = bestLabel(best);
  }

  /* ---------- main pass ---------- */

  function applyFilter() {
    const items = [...document.querySelectorAll(LISTING_SELECTOR)];
    let hidden = 0;
    const candidates = [];

    for (const li of items) {
      const info = extractSellerInfo(li);
      const hide = shouldHide(info);
      li.classList.toggle(HIDDEN_CLASS, hide);
      if (info) li.dataset.esfSeller = `${info.percent}% · ${info.count.toLocaleString()}`;
      if (hide) {
        hidden++;
        continue;
      }
      candidates.push({
        li,
        info,
        price: parsePrice(li),
        condition: parseCondition(li),
        title: getTitle(li),
      });
    }

    const best = settings.bestDeal ? pickBestDeal(candidates) : null;
    applyBest(best);

    lastStats = { hidden, total: items.length, best: best ? bestLabel(best) : null };
    updateBadge();
  }

  /* ---------- injected styles ---------- */

  function injectStyles() {
    if (document.getElementById("esf-style")) return;
    const style = document.createElement("style");
    style.id = "esf-style";
    style.textContent = `
      .${HIDDEN_CLASS} { display: none !important; }
      html.${REVEAL_CLASS} .${HIDDEN_CLASS} {
        display: block !important;
        opacity: 0.5;
        outline: 2px dashed #d93025;
        outline-offset: -2px;
        position: relative;
      }
      html.${REVEAL_CLASS} .${HIDDEN_CLASS}::after {
        content: "filtered: " attr(data-esf-seller);
        position: absolute; top: 4px; right: 4px; z-index: 5;
        background: #d93025; color: #fff; font: 700 11px/1.4 Arial, sans-serif;
        padding: 2px 6px; border-radius: 3px; pointer-events: none;
      }
      .${BEST_CLASS} {
        outline: 3px solid #1a8f2a !important;
        outline-offset: -3px;
        box-shadow: 0 0 0 3px rgba(26,143,42,.22) !important;
        position: relative;
      }
      .${BEST_CLASS}::after {
        content: "⭐ " attr(data-esf-best);
        position: absolute; top: 0; left: 0; z-index: 6;
        background: #1a8f2a; color: #fff; font: 700 12px/1.5 Arial, sans-serif;
        padding: 3px 9px; border-bottom-right-radius: 7px; pointer-events: none;
      }
      #esf-badge {
        position: fixed; left: 16px; bottom: 16px; z-index: 2147483647;
        background: #111; color: #fff; font: 600 12px/1 Arial, sans-serif;
        padding: 8px 12px; border-radius: 20px; cursor: pointer;
        box-shadow: 0 2px 10px rgba(0,0,0,.35); user-select: none;
        display: flex; align-items: center; gap: 6px; opacity: .92;
      }
      #esf-badge:hover { opacity: 1; }
      #esf-badge.esf-active { background: #d93025; }
    `;
    document.documentElement.appendChild(style);
  }

  /* ---------- on-page badge ---------- */

  function updateBadge() {
    let badge = document.getElementById("esf-badge");
    if (lastStats.total === 0) {
      if (badge) badge.remove();
      return;
    }
    if (!badge) {
      badge = document.createElement("div");
      badge.id = "esf-badge";
      badge.title = "Click to peek at hidden listings";
      badge.addEventListener("click", () => {
        const on = document.documentElement.classList.toggle(REVEAL_CLASS);
        badge.classList.toggle("esf-active", on);
      });
      document.body.appendChild(badge);
    }
    let text = `🛡️ ${lastStats.hidden} hidden / ${lastStats.total}`;
    if (lastStats.best) text += "  ·  ⭐ pinned";
    badge.textContent = text;
  }

  /* ---------- observe dynamic result loads ---------- */

  function debounce(fn, ms) {
    let t;
    return () => {
      clearTimeout(t);
      t = setTimeout(fn, ms);
    };
  }

  function run() {
    if (observer) observer.disconnect();
    injectStyles();
    applyFilter();
    if (observer) observer.observe(document.body, { childList: true, subtree: true });
  }

  const scheduleRun = debounce(run, 200);

  /* ---------- wiring ---------- */

  function start() {
    chrome.storage.sync.get(DEFAULTS, (stored) => {
      settings = { ...DEFAULTS, ...stored };
      observer = new MutationObserver(scheduleRun);
      run();
    });

    chrome.storage.onChanged.addListener((changes, area) => {
      if (area !== "sync") return;
      let touched = false;
      for (const key of Object.keys(DEFAULTS)) {
        if (changes[key]) {
          settings[key] = changes[key].newValue;
          touched = true;
        }
      }
      if (touched) run();
    });

    chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
      if (msg && msg.type === "getStats") {
        sendResponse({ hidden: lastStats.hidden, total: lastStats.total, best: lastStats.best });
      }
      return true;
    });
  }

  if (document.body) start();
  else document.addEventListener("DOMContentLoaded", start, { once: true });
})();
