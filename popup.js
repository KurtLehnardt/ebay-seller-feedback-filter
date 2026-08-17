/* Popup UI — reads/writes settings and shows live per-page stats. */
const DEFAULTS = {
  enabled: true,
  minPercent: 98,
  minFeedback: 50,
  hideUnknown: false,
  bestDeal: false,
  condNew: true,
  condUsed: true,
  condParts: true,
};

const el = {
  enabled: document.getElementById("enabled"),
  minPercent: document.getElementById("minPercent"),
  minFeedback: document.getElementById("minFeedback"),
  hideUnknown: document.getElementById("hideUnknown"),
  bestDeal: document.getElementById("bestDeal"),
  condNew: document.getElementById("condNew"),
  condUsed: document.getElementById("condUsed"),
  condParts: document.getElementById("condParts"),
  hidden: document.getElementById("hidden"),
  total: document.getElementById("total"),
  best: document.getElementById("best"),
};

/* Load saved settings into the form. */
chrome.storage.sync.get(DEFAULTS, (s) => {
  el.enabled.checked = s.enabled;
  el.minPercent.value = s.minPercent;
  el.minFeedback.value = s.minFeedback;
  el.hideUnknown.checked = s.hideUnknown;
  el.bestDeal.checked = s.bestDeal;
  el.condNew.checked = s.condNew;
  el.condUsed.checked = s.condUsed;
  el.condParts.checked = s.condParts;
});

/* Persist on any change, then refresh the on-page stats. */
function save() {
  let pct = parseFloat(el.minPercent.value);
  if (!isFinite(pct)) pct = DEFAULTS.minPercent;
  pct = Math.min(100, Math.max(0, pct));

  let cnt = parseInt(el.minFeedback.value, 10);
  if (!isFinite(cnt) || cnt < 0) cnt = DEFAULTS.minFeedback;

  chrome.storage.sync.set(
    {
      enabled: el.enabled.checked,
      minPercent: pct,
      minFeedback: cnt,
      hideUnknown: el.hideUnknown.checked,
      bestDeal: el.bestDeal.checked,
      condNew: el.condNew.checked,
      condUsed: el.condUsed.checked,
      condParts: el.condParts.checked,
    },
    // Give the content script a beat to re-run before re-reading stats.
    () => setTimeout(refreshStats, 350)
  );
}

for (const id of ["enabled", "minPercent", "minFeedback", "hideUnknown", "bestDeal", "condNew", "condUsed", "condParts"]) {
  el[id].addEventListener("change", save);
}

/* Pull live stats from the active tab's content script.
 * We deliberately do NOT read tab.url (that requires the "tabs" permission);
 * instead we just message the content script — if it answers, we're on a
 * supported eBay page. No answer => not injected => show n/a. */
function setNA() {
  el.hidden.textContent = el.total.textContent = "n/a";
  el.best.textContent = "";
}

function refreshStats() {
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    const tab = tabs[0];
    if (!tab) return setNA();
    chrome.tabs.sendMessage(tab.id, { type: "getStats" }, (res) => {
      if (chrome.runtime.lastError || !res) return setNA();
      el.hidden.textContent = res.hidden;
      el.total.textContent = res.total;
      el.best.textContent = res.best ? "⭐ " + res.best : "";
    });
  });
}

refreshStats();
