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
  includeAuctions: true,
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
  includeAuctions: document.getElementById("includeAuctions"),
  reload: document.getElementById("reload"),
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
  el.includeAuctions.checked = s.includeAuctions;
});

/* Read + validate the form into a settings object (and reflect clamped
 * numbers back into the fields). */
function collect() {
  let pct = parseFloat(el.minPercent.value);
  if (!isFinite(pct)) pct = DEFAULTS.minPercent;
  pct = Math.min(100, Math.max(0, pct));

  let cnt = parseInt(el.minFeedback.value, 10);
  if (!isFinite(cnt) || cnt < 0) cnt = DEFAULTS.minFeedback;

  el.minPercent.value = pct;
  el.minFeedback.value = cnt;

  return {
    enabled: el.enabled.checked,
    minPercent: pct,
    minFeedback: cnt,
    hideUnknown: el.hideUnknown.checked,
    bestDeal: el.bestDeal.checked,
    condNew: el.condNew.checked,
    condUsed: el.condUsed.checked,
    condParts: el.condParts.checked,
    includeAuctions: el.includeAuctions.checked,
  };
}

function persist(cb) {
  chrome.storage.sync.set(collect(), cb);
}

function showStats(res) {
  el.hidden.textContent = res.hidden;
  el.total.textContent = res.total;
  el.best.textContent = res.best ? "⭐ " + res.best : "";
}

function setNA() {
  el.hidden.textContent = el.total.textContent = "n/a";
  el.best.textContent = "";
}

/* Message the active tab's content script. type "rescan" forces an immediate
 * re-filter/re-rank; "getStats" just reads. We don't inspect tab.url (that
 * needs the "tabs" permission) — a reply means we're on a supported page. */
function message(type, cb) {
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    const tab = tabs[0];
    if (!tab) return setNA();
    chrome.tabs.sendMessage(tab.id, { type }, (res) => {
      if (chrome.runtime.lastError || !res) return setNA();
      showStats(res);
      if (cb) cb(res);
    });
  });
}

/* Auto-apply on any change (checkboxes apply instantly; number fields on blur
 * or Enter). The Reload button covers value edits that haven't blurred yet and
 * forces a re-scan even when nothing changed. */
function save() {
  persist(() => setTimeout(() => message("getStats"), 200));
}

for (const id of ["enabled", "minPercent", "minFeedback", "hideUnknown", "bestDeal", "condNew", "condUsed", "condParts", "includeAuctions"]) {
  el[id].addEventListener("change", save);
}

el.reload.addEventListener("click", () => {
  const b = el.reload;
  const orig = b.textContent;
  persist(() =>
    message("rescan", () => {
      b.textContent = "⟳ Reloaded ✓";
      setTimeout(() => (b.textContent = orig), 1000);
    })
  );
});

message("getStats");
