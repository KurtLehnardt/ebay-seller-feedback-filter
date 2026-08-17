/* eBay Seller Feedback Filter — content script
 * Hides search-result listings whose seller falls below the configured
 * positive-rating percentage and/or feedback-count thresholds.
 */
(() => {
  "use strict";

  const DEFAULTS = {
    enabled: true,
    minPercent: 98,     // hide sellers below this positive %
    minFeedback: 50,    // hide sellers with fewer than this many feedbacks
    hideUnknown: false, // hide listings where no seller rating is shown
  };

  const LISTING_SELECTOR = "li.s-card";
  const SELLER_SCOPE = ".su-card-container__attributes__secondary";
  const HIDDEN_CLASS = "esf-hidden";
  const REVEAL_CLASS = "esf-reveal";

  let settings = { ...DEFAULTS };
  let observer = null;
  let lastStats = { hidden: 0, total: 0 };

  /* ---------- parsing ---------- */

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

  /* ---------- filtering ---------- */

  function shouldHide(info) {
    if (!settings.enabled) return false;
    if (!info) return settings.hideUnknown;
    return info.percent < settings.minPercent || info.count < settings.minFeedback;
  }

  function applyFilter() {
    const items = document.querySelectorAll(LISTING_SELECTOR);
    let hidden = 0;
    items.forEach((li) => {
      const info = extractSellerInfo(li);
      const hide = shouldHide(info);
      li.classList.toggle(HIDDEN_CLASS, hide);
      if (info) li.dataset.esfSeller = `${info.percent}% · ${info.count.toLocaleString()}`;
      if (hide) hidden++;
    });
    lastStats = { hidden, total: items.length };
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
      html.${REVEAL_CLASS} .${HIDDEN_CLASS}::before {
        content: "filtered: " attr(data-esf-seller);
        position: absolute; top: 4px; right: 4px; z-index: 5;
        background: #d93025; color: #fff; font: 700 11px/1.4 Arial, sans-serif;
        padding: 2px 6px; border-radius: 3px; pointer-events: none;
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
    badge.textContent = `🛡️ ${lastStats.hidden} hidden / ${lastStats.total}`;
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
        sendResponse(lastStats);
      }
      return true;
    });
  }

  if (document.body) start();
  else document.addEventListener("DOMContentLoaded", start, { once: true });
})();
