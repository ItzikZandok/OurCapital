const STORAGE_KEY = "capital-portfolio-records-v1";
const SETTINGS_KEY = "capital-portfolio-settings-v1";

const seedData = [
  { date: "29/09/2024", migdal: 368574, fenix: 389721, mor: 400262, total: 1158557 },
  { date: "04/01/2025", migdal: 359254, fenix: 391508, mor: 440000, total: 1190762 },
  { date: "08/06/2025", migdal: 363163, fenix: 398308, mor: 493000, total: 1254471 },
  { date: "30/06/2025", migdal: 359644, fenix: 400138, mor: 492395, total: 1252177 },
  { date: "28/09/2025", migdal: 369872, fenix: 414403, mor: 537170, total: 1321445 },
  { date: "02/12/2025", migdal: 371824, fenix: 420791, mor: 570946, total: 1363561 },
  { date: "14/01/2026", migdal: 128962, fenix: 427745, mor: 590280, total: 1146987 },
  { date: "26/01/2026", migdal: 128416, fenix: 426723, mor: 590281, total: 1145420 },
  { date: "06/03/2026", migdal: 126657, fenix: 426268, mor: 619410, total: 1172335 }
].map((x, i) => ({ id: crypto.randomUUID?.() || String(i + 1), ...x }));

let records = loadRecords();
let settings = loadSettings();
let editingId = null;
let homeTrendChart;
let analyticsTrendChart;
let allocationChart;
let deferredInstallPrompt;

const screenIds = ["home", "history", "add", "analytics", "settings"];

const els = {
  latestTotal: document.getElementById("latestTotal"),
  latestDate: document.getElementById("latestDate"),
  institutionCards: document.getElementById("institutionCards"),
  recentEntries: document.getElementById("recentEntries"),
  historyList: document.getElementById("historyList"),
  detailDialog: document.getElementById("detailDialog"),
  detailBody: document.getElementById("detailBody"),
  closeDetailBtn: document.getElementById("closeDetailBtn"),
  entryForm: document.getElementById("entryForm"),
  formTitle: document.getElementById("formTitle"),
  cancelEditBtn: document.getElementById("cancelEditBtn"),
  inputDate: document.getElementById("inputDate"),
  inputMigdal: document.getElementById("inputMigdal"),
  inputFenix: document.getElementById("inputFenix"),
  inputMor: document.getElementById("inputMor"),
  inputTotal: document.getElementById("inputTotal"),
  autoTotalHint: document.getElementById("autoTotalHint"),
  homeExportBtn: document.getElementById("homeExportBtn"),
  historyExportBtn: document.getElementById("historyExportBtn"),
  settingsExportBtn: document.getElementById("settingsExportBtn"),
  autoCalcToggle: document.getElementById("autoCalcToggle"),
  currencyStyle: document.getElementById("currencyStyle"),
  installBtn: document.getElementById("installBtn")
};

init();

function init() {
  attachEvents();
  applySettingsToUi();
  renderAll();
  registerServiceWorker();
}

function attachEvents() {
  document.querySelectorAll(".nav-btn").forEach((btn) => {
    btn.addEventListener("click", () => switchScreen(btn.dataset.screen));
  });

  els.entryForm.addEventListener("submit", onSubmit);
  els.cancelEditBtn.addEventListener("click", resetForm);
  els.closeDetailBtn.addEventListener("click", () => els.detailDialog.close());

  [els.inputMigdal, els.inputFenix, els.inputMor].forEach((input) => {
    input.addEventListener("input", () => {
      if (settings.autoCalcTotal) {
        els.inputTotal.value = sumFormParts();
      }
    });
  });

  [els.homeExportBtn, els.historyExportBtn, els.settingsExportBtn].forEach((btn) => {
    btn.addEventListener("click", exportXlsx);
  });

  els.autoCalcToggle.addEventListener("change", () => {
    settings.autoCalcTotal = els.autoCalcToggle.checked;
    saveSettings();
    applySettingsToUi();
    if (settings.autoCalcTotal) {
      els.inputTotal.value = sumFormParts();
    }
  });

  els.currencyStyle.addEventListener("change", () => {
    settings.currencyStyle = els.currencyStyle.value;
    saveSettings();
    renderAll();
  });

  window.addEventListener("beforeinstallprompt", (event) => {
    event.preventDefault();
    deferredInstallPrompt = event;
    els.installBtn.hidden = false;
  });

  els.installBtn.addEventListener("click", async () => {
    if (!deferredInstallPrompt) return;
    deferredInstallPrompt.prompt();
    await deferredInstallPrompt.userChoice;
    deferredInstallPrompt = null;
    els.installBtn.hidden = true;
  });
}

function switchScreen(screenName) {
  screenIds.forEach((name) => {
    document.getElementById(`screen-${name}`).classList.toggle("active", name === screenName);
  });
  document.querySelectorAll(".nav-btn").forEach((btn) => {
    btn.classList.toggle("active", btn.dataset.screen === screenName);
  });
}

function onSubmit(event) {
  event.preventDefault();

  const next = {
    id: editingId || crypto.randomUUID?.() || String(Date.now()),
    date: isoToDisplayDate(els.inputDate.value),
    migdal: Number(els.inputMigdal.value),
    fenix: Number(els.inputFenix.value),
    mor: Number(els.inputMor.value),
    total: Number(els.inputTotal.value)
  };

  if (!next.date || Number.isNaN(next.total)) return;

  if (editingId) {
    records = records.map((item) => (item.id === editingId ? next : item));
  } else {
    records.push(next);
  }

  sortRecords();
  saveRecords();
  resetForm();
  renderAll();
  switchScreen("history");
}

function startEdit(id) {
  const item = records.find((entry) => entry.id === id);
  if (!item) return;

  editingId = id;
  els.formTitle.textContent = "Edit Entry";
  els.cancelEditBtn.hidden = false;
  els.inputDate.value = displayDateToIso(item.date);
  els.inputMigdal.value = item.migdal;
  els.inputFenix.value = item.fenix;
  els.inputMor.value = item.mor;
  els.inputTotal.value = item.total;
  switchScreen("add");
}

function removeEntry(id) {
  records = records.filter((entry) => entry.id !== id);
  saveRecords();
  renderAll();
}

function openDetail(id) {
  const item = records.find((entry) => entry.id === id);
  if (!item) return;

  els.detailBody.innerHTML = `
    <div class="detail-grid">
      <div class="row"><span>Date</span><strong>${item.date}</strong></div>
      <div class="row"><span>Migdal</span><strong>${formatValue(item.migdal)}</strong></div>
      <div class="row"><span>Fenix</span><strong>${formatValue(item.fenix)}</strong></div>
      <div class="row"><span>Mor</span><strong>${formatValue(item.mor)}</strong></div>
      <div class="row"><span>Total</span><strong>${formatValue(item.total)}</strong></div>
    </div>
  `;
  els.detailDialog.showModal();
}

function resetForm() {
  editingId = null;
  els.entryForm.reset();
  els.formTitle.textContent = "Add Entry";
  els.cancelEditBtn.hidden = true;
  applySettingsToUi();
}

function renderAll() {
  sortRecords();
  renderHome();
  renderHistory();
  renderCharts();
}

function renderHome() {
  const latest = records[records.length - 1];
  if (!latest) return;

  els.latestTotal.textContent = formatValue(latest.total);
  els.latestDate.textContent = `As of ${latest.date}`;

  const parts = [
    { name: "Migdal", value: latest.migdal },
    { name: "Fenix", value: latest.fenix },
    { name: "Mor", value: latest.mor }
  ];

  els.institutionCards.innerHTML = parts
    .map((part) => {
      const pct = latest.total ? ((part.value / latest.total) * 100).toFixed(1) : "0.0";
      return `
      <article class="card">
        <p class="eyebrow">${part.name}</p>
        <p class="value">${formatValue(part.value)}</p>
        <p class="percent">${pct}%</p>
      </article>`;
    })
    .join("");

  const recent = [...records].slice(-4).reverse();
  els.recentEntries.innerHTML = recent
    .map(
      (item) => `
      <article class="list-item" data-id="${item.id}">
        <div class="row"><strong>${item.date}</strong><span>${formatValue(item.total)}</span></div>
      </article>`
    )
    .join("");

  els.recentEntries.querySelectorAll(".list-item").forEach((node) => {
    node.addEventListener("click", () => openDetail(node.dataset.id));
  });
}

function renderHistory() {
  els.historyList.innerHTML = [...records]
    .reverse()
    .map(
      (item) => `
      <article class="list-item">
        <div class="row">
          <div>
            <strong>${item.date}</strong>
            <p class="subtle">Total: ${formatValue(item.total)}</p>
          </div>
          <button class="ghost-btn detail-btn" data-id="${item.id}">View</button>
        </div>
        <div class="actions">
          <button class="ghost-btn edit-btn" data-id="${item.id}">Edit</button>
          <button class="ghost-btn delete-btn" data-id="${item.id}">Delete</button>
        </div>
      </article>`
    )
    .join("");

  els.historyList.querySelectorAll(".detail-btn").forEach((btn) => {
    btn.addEventListener("click", () => openDetail(btn.dataset.id));
  });
  els.historyList.querySelectorAll(".edit-btn").forEach((btn) => {
    btn.addEventListener("click", () => startEdit(btn.dataset.id));
  });
  els.historyList.querySelectorAll(".delete-btn").forEach((btn) => {
    btn.addEventListener("click", () => removeEntry(btn.dataset.id));
  });
}

function renderCharts() {
  const labels = records.map((entry) => entry.date);
  const totals = records.map((entry) => entry.total);
  const latest = records[records.length - 1];

  homeTrendChart = renderLineChart(homeTrendChart, "homeTrendChart", labels, totals);
  analyticsTrendChart = renderLineChart(analyticsTrendChart, "analyticsTrendChart", labels, totals);

  allocationChart = renderDonutChart(
    allocationChart,
    "allocationChart",
    [latest?.migdal || 0, latest?.fenix || 0, latest?.mor || 0]
  );
}

function renderLineChart(chart, canvasId, labels, values) {
  if (!window.Chart) return chart;
  chart?.destroy();

  return new Chart(document.getElementById(canvasId), {
    type: "line",
    data: {
      labels,
      datasets: [
        {
          label: "Total",
          data: values,
          borderColor: "#6f4dff",
          borderWidth: 3,
          fill: true,
          backgroundColor: "rgba(111, 77, 255, 0.12)",
          pointRadius: 3,
          pointBackgroundColor: "#fff",
          tension: 0.3
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { display: false } },
      scales: {
        y: {
          ticks: {
            callback: (v) => shortNumber(v)
          },
          grid: {
            color: "rgba(120,120,160,0.14)"
          }
        },
        x: {
          grid: {
            display: false
          }
        }
      }
    }
  });
}

function renderDonutChart(chart, canvasId, values) {
  if (!window.Chart) return chart;
  chart?.destroy();
  return new Chart(document.getElementById(canvasId), {
    type: "doughnut",
    data: {
      labels: ["Migdal", "Fenix", "Mor"],
      datasets: [
        {
          data: values,
          backgroundColor: ["#6f4dff", "#9f73ff", "#d4c5ff"],
          borderWidth: 0
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      cutout: "65%",
      plugins: {
        legend: {
          position: "bottom",
          labels: { usePointStyle: true }
        }
      }
    }
  });
}

function exportXlsx() {
  if (!window.XLSX) return;
  const rows = records.map((entry) => ({
    Date: entry.date,
    Migdal: entry.migdal,
    Fenix: entry.fenix,
    Mor: entry.mor,
    Total: entry.total
  }));

  const ws = XLSX.utils.json_to_sheet(rows, {
    header: ["Date", "Migdal", "Fenix", "Mor", "Total"]
  });
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Portfolio");
  XLSX.writeFile(wb, `capital-portfolio-${new Date().toISOString().slice(0, 10)}.xlsx`);
}

function loadRecords() {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) return [...seedData];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) && parsed.length ? parsed : [...seedData];
  } catch {
    return [...seedData];
  }
}

function saveRecords() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(records));
}

function sortRecords() {
  records.sort((a, b) => parseDisplayDate(a.date) - parseDisplayDate(b.date));
}

function loadSettings() {
  const defaults = { autoCalcTotal: true, currencyStyle: "number" };
  try {
    return { ...defaults, ...(JSON.parse(localStorage.getItem(SETTINGS_KEY)) || {}) };
  } catch {
    return defaults;
  }
}

function saveSettings() {
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
}

function applySettingsToUi() {
  els.autoCalcToggle.checked = !!settings.autoCalcTotal;
  els.currencyStyle.value = settings.currencyStyle;
  els.inputTotal.readOnly = !!settings.autoCalcTotal;
  els.autoTotalHint.textContent = settings.autoCalcTotal
    ? "Total updates automatically from Migdal + Fenix + Mor"
    : "Total can be entered manually";
}

function sumFormParts() {
  const m = Number(els.inputMigdal.value) || 0;
  const f = Number(els.inputFenix.value) || 0;
  const mor = Number(els.inputMor.value) || 0;
  return m + f + mor;
}

function parseDisplayDate(dateStr) {
  const [dd, mm, yyyy] = dateStr.split("/").map(Number);
  return new Date(yyyy, mm - 1, dd);
}

function isoToDisplayDate(isoDate) {
  if (!isoDate) return "";
  const [yyyy, mm, dd] = isoDate.split("-");
  return `${dd}/${mm}/${yyyy}`;
}

function displayDateToIso(displayDate) {
  const [dd, mm, yyyy] = displayDate.split("/");
  return `${yyyy}-${mm}-${dd}`;
}

function formatValue(value) {
  if (settings.currencyStyle === "currency") {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "ILS",
      maximumFractionDigits: 0
    }).format(value);
  }
  return new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 }).format(value);
}

function shortNumber(num) {
  if (num >= 1_000_000) return `${(num / 1_000_000).toFixed(1)}M`;
  if (num >= 1_000) return `${(num / 1_000).toFixed(0)}K`;
  return String(num);
}

function registerServiceWorker() {
  if ("serviceWorker" in navigator) {
    navigator.serviceWorker.register("./sw.js").catch(() => {});
  }
}
