/* =====================================================
   Minikin — script.js
   Patient registry state, local storage, search & filter,
   alignment-line overlay, details modal, and add-case form.
   ===================================================== */

"use strict";

/* ---------- Global constants ---------- */
const STORAGE_KEY = "minikinPatients_v1_en";
const OVERLAY_KEY = "minikinOverlayOn";

/* ---------- Illustrative posture graphics generator (SVG) ----------
   Draws a back-view human figure with a spine line. The curve
   value sets the amount of sideways deviation:
   a large value = "before", a small value = "after". */
function postureSVG(curve, shoulderTilt, accentA, accentB) {
  // Spine line points (top to bottom) with sideways deviation
  const spinePoints = [
    [100, 62],
    [100 + curve * 0.9, 92],
    [100 + curve, 122],
    [100 + curve * 0.7, 152],
    [100 - curve * 0.4, 182],
    [100 - curve * 0.6, 212],
    [100 - curve * 0.3, 242],
    [100, 268],
  ];
  const spinePath = spinePoints
    .map((p, i) => (i === 0 ? `M ${p[0]} ${p[1]}` : `L ${p[0]} ${p[1]}`))
    .join(" ");

  // Shoulder line (slightly tilted in the "before" state)
  const shY1 = 96 - shoulderTilt;
  const shY2 = 96 + shoulderTilt;
  // Hip line
  const hipY1 = 222 + shoulderTilt * 0.6;
  const hipY2 = 222 - shoulderTilt * 0.6;

  const svg = `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 300" width="200" height="300">
  <defs>
    <linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="${accentA}"/>
      <stop offset="1" stop-color="${accentB}"/>
    </linearGradient>
  </defs>
  <rect width="200" height="300" rx="12" fill="#eef6ff"/>
  <!-- Faint central reference line -->
  <line x1="100" y1="20" x2="100" y2="285" stroke="#b3d9ff" stroke-width="1.5" stroke-dasharray="5 5"/>
  <!-- Head -->
  <circle cx="${100 + curve * 0.75}" cy="40" r="20" fill="url(#g)" opacity="0.9"/>
  <!-- Torso -->
  <path d="M ${62 + curve * 0.5} 92 Q 100 78 ${138 + curve * 0.5} 92
           L ${130 - curve * 0.2} 218 Q 100 234 ${70 - curve * 0.2} 218 Z"
        fill="url(#g)" opacity="0.28"/>
  <!-- Limbs -->
  <line x1="${64 + curve * 0.5}" y1="96" x2="${50 + curve * 0.4}" y2="170" stroke="url(#g)" stroke-width="9" stroke-linecap="round" opacity="0.55"/>
  <line x1="${136 + curve * 0.5}" y1="96" x2="${150 + curve * 0.4}" y2="170" stroke="url(#g)" stroke-width="9" stroke-linecap="round" opacity="0.55"/>
  <line x1="86" y1="224" x2="82" y2="282" stroke="url(#g)" stroke-width="10" stroke-linecap="round" opacity="0.55"/>
  <line x1="114" y1="224" x2="118" y2="282" stroke="url(#g)" stroke-width="10" stroke-linecap="round" opacity="0.55"/>
  <!-- Shoulder and hip lines -->
  <line x1="58" y1="${shY1}" x2="142" y2="${shY2}" stroke="#0d4d9e" stroke-width="3" stroke-linecap="round" opacity="0.8"/>
  <line x1="70" y1="${hipY1}" x2="130" y2="${hipY2}" stroke="#0d4d9e" stroke-width="3" stroke-linecap="round" opacity="0.8"/>
  <!-- Spine line -->
  <path d="${spinePath}" fill="none" stroke="url(#g)" stroke-width="6" stroke-linecap="round" stroke-linejoin="round"/>
  ${spinePoints.map((p) => `<circle cx="${p[0]}" cy="${p[1]}" r="3.4" fill="#fff" stroke="${accentB}" stroke-width="2"/>`).join("")}
</svg>`;
  return "data:image/svg+xml;utf8," + encodeURIComponent(svg.trim());
}

/* Default image pair: before (clear deviation) and after (better alignment) */
function defaultBefore() {
  return postureSVG(26, 7, "#38a9f4", "#0d4d9e");
}
function defaultAfter() {
  return postureSVG(5, 1, "#38a9f4", "#1d9e6f");
}

/* ---------- Sample cases (not real patients) ---------- */
function samplePatients() {
  return [
    {
      id: "sample-1",
      name: "Demo Case 1 (A.M.)",
      age: 14,
      type: "Scoliosis",
      status: "Significant improvement",
      weeks: 12,
      improvement: 45,
      notes: "Demo data for illustration: clear improvement in spinal alignment and shoulder balance after 12 weeks of regular use.",
      before: defaultBefore(),
      after: defaultAfter(),
      sample: true,
      createdAt: "2026-09-01",
    },
    {
      id: "sample-2",
      name: "Demo Case 2 (S.K.)",
      age: 17,
      type: "Kyphosis",
      status: "Under follow-up",
      weeks: 6,
      improvement: 20,
      notes: "Demo data for illustration: early improvement in back curvature; follow-up continues alongside specialist guidance.",
      before: defaultBefore(),
      after: defaultAfter(),
      sample: true,
      createdAt: "2026-10-05",
    },
    {
      id: "sample-3",
      name: "Demo Case 3 (M.A.)",
      age: 11,
      type: "Shoulder tilt",
      status: "Significant improvement",
      weeks: 8,
      improvement: 55,
      notes: "Demo data for illustration: noticeable improvement in shoulder level balance within 8 weeks.",
      before: defaultBefore(),
      after: defaultAfter(),
      sample: true,
      createdAt: "2026-10-20",
    },
    {
      id: "sample-4",
      name: "Demo Case 4 (L.H.)",
      age: 22,
      type: "Scoliosis",
      status: "Under follow-up",
      weeks: 4,
      improvement: 10,
      notes: "Demo data for illustration: early follow-up stage with slight change so far.",
      before: defaultBefore(),
      after: defaultAfter(),
      sample: true,
      createdAt: "2026-11-10",
    },
  ];
}

/* ---------- State and local storage ---------- */
let patients = [];
let overlayOn = false;

function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length) {
        patients = parsed;
        return;
      }
    }
  } catch (e) {
    console.warn("Could not read local storage; loading sample cases.", e);
  }
  patients = samplePatients();
  saveState();
}

function saveState() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(patients));
  } catch (e) {
    console.warn("Could not save to local storage.", e);
  }
}

function loadOverlayPref() {
  overlayOn = localStorage.getItem(OVERLAY_KEY) === "1";
  document.body.classList.toggle("overlay-on", overlayOn);
  updateOverlayButton();
}

/* ---------- Page elements ---------- */
const grid = document.getElementById("patientsGrid");
const emptyState = document.getElementById("emptyState");
const searchInput = document.getElementById("searchInput");
const filterSelect = document.getElementById("filterSelect");
const overlayToggle = document.getElementById("overlayToggle");
const overlayState = document.getElementById("overlayState");
const restoreBtn = document.getElementById("restoreSamples");
const form = document.getElementById("patientForm");
const formSuccess = document.getElementById("formSuccess");
const modalBackdrop = document.getElementById("modalBackdrop");
const modalBody = document.getElementById("modalBody");
const modalTitle = document.getElementById("modalTitle");
const modalClose = document.getElementById("modalClose");
const navToggle = document.getElementById("navToggle");
const navLinks = document.getElementById("navLinks");

/* ---------- Helpers ---------- */
function escapeHTML(str) {
  return String(str ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function makeId() {
  if (window.crypto && crypto.randomUUID) return crypto.randomUUID();
  return "id-" + Date.now() + "-" + Math.floor(Math.random() * 1e6);
}

function statusClass(status) {
  return status === "Significant improvement" ? "improved" : "progress";
}

/* ---------- Statistics (computed from registry data) ---------- */
function renderStats() {
  document.getElementById("statCount").textContent = patients.length;

  const withImp = patients.filter((p) => typeof p.improvement === "number");
  const avg = withImp.length
    ? Math.round(withImp.reduce((s, p) => s + p.improvement, 0) / withImp.length)
    : null;
  document.getElementById("statAvg").textContent = avg === null ? "—" : avg + "%";

  const avgWeeks = patients.length
    ? Math.round(patients.reduce((s, p) => s + (Number(p.weeks) || 0), 0) / patients.length)
    : null;
  document.getElementById("statWeeks").textContent = avgWeeks === null ? "—" : avgWeeks;
}

/* ---------- Render patient cards ---------- */
function getFilteredPatients() {
  const q = searchInput.value.trim().toLowerCase();
  const f = filterSelect.value;
  return patients.filter((p) => {
    const matchesQuery =
      !q ||
      p.name.toLowerCase().includes(q) ||
      (p.notes || "").toLowerCase().includes(q) ||
      (p.type || "").toLowerCase().includes(q);
    const matchesFilter = f === "all" || p.type === f || p.status === f;
    return matchesQuery && matchesFilter;
  });
}

function beforeAfterBlock(p) {
  return `
    <div class="ba-wrap">
      <figure class="ba-item">
        <span class="ba-label">Before</span>
        <img src="${p.before || defaultBefore()}" alt="Posture image before using Minikin - ${escapeHTML(p.name)}" loading="lazy" />
        <div class="align-overlay" aria-hidden="true"></div>
      </figure>
      <figure class="ba-item">
        <span class="ba-label">After</span>
        <img src="${p.after || defaultAfter()}" alt="Posture image after using Minikin - ${escapeHTML(p.name)}" loading="lazy" />
        <div class="align-overlay" aria-hidden="true"></div>
      </figure>
    </div>`;
}

function renderPatients() {
  const list = getFilteredPatients();
  grid.innerHTML = "";

  list.forEach((p) => {
    const card = document.createElement("article");
    card.className = "patient-card";
    card.innerHTML = `
      <div class="patient-head">
        <div>
          <div class="patient-name">${escapeHTML(p.name)}</div>
          <div class="patient-meta">Age: ${escapeHTML(p.age)} years · ${escapeHTML(p.type)} · ${escapeHTML(p.weeks)} weeks</div>
          ${p.sample ? '<span class="sample-tag">Demo data</span>' : ""}
        </div>
        <span class="status-pill ${statusClass(p.status)}">${escapeHTML(p.status)}</span>
      </div>
      ${beforeAfterBlock(p)}
      <p class="patient-notes">
        ${typeof p.improvement === "number" ? `<span class="improve">Estimated improvement: ${escapeHTML(p.improvement)}%</span><br/>` : ""}
        ${escapeHTML(p.notes || "")}
      </p>
      <div class="patient-actions">
        <button class="btn btn-outline" data-action="view" data-id="${p.id}">View Details</button>
        <button class="btn btn-danger" data-action="delete" data-id="${p.id}">Delete</button>
      </div>`;
    grid.appendChild(card);
  });

  emptyState.hidden = list.length > 0;
}

/* ---------- Alignment-line overlay ---------- */
function updateOverlayButton() {
  overlayState.textContent = overlayOn ? "On" : "Off";
  overlayToggle.setAttribute("aria-pressed", String(overlayOn));
}

overlayToggle.addEventListener("click", () => {
  overlayOn = !overlayOn;
  document.body.classList.toggle("overlay-on", overlayOn);
  localStorage.setItem(OVERLAY_KEY, overlayOn ? "1" : "0");
  updateOverlayButton();
});

/* ---------- Search and filter ---------- */
searchInput.addEventListener("input", renderPatients);
filterSelect.addEventListener("change", renderPatients);

/* ---------- Restore sample cases ---------- */
restoreBtn.addEventListener("click", () => {
  if (confirm("This will replace the current registry with the default sample cases. Continue?")) {
    patients = samplePatients();
    saveState();
    renderPatients();
    renderStats();
  }
});

/* ---------- Modal ---------- */
function openModal(p) {
  modalTitle.textContent = "Case details: " + p.name;
  modalBody.innerHTML = `
    ${beforeAfterBlock(p)}
    <dl class="detail-rows">
      <div><dt>Name / Code</dt><dd>${escapeHTML(p.name)}</dd></div>
      <div><dt>Age</dt><dd>${escapeHTML(p.age)} years</dd></div>
      <div><dt>Condition type</dt><dd>${escapeHTML(p.type)}</dd></div>
      <div><dt>Status</dt><dd>${escapeHTML(p.status)}</dd></div>
      <div><dt>Duration of use</dt><dd>${escapeHTML(p.weeks)} weeks</dd></div>
      ${typeof p.improvement === "number" ? `<div><dt>Estimated improvement</dt><dd>${escapeHTML(p.improvement)}%</dd></div>` : ""}
      <div><dt>Notes</dt><dd>${escapeHTML(p.notes || "—")}</dd></div>
      ${p.sample ? '<div><dt>Source</dt><dd>Demo data for illustration — not a real patient</dd></div>' : ""}
    </dl>`;
  modalBackdrop.hidden = false;
  document.body.style.overflow = "hidden";
}

function closeModal() {
  modalBackdrop.hidden = true;
  document.body.style.overflow = "";
}

modalClose.addEventListener("click", closeModal);
modalBackdrop.addEventListener("click", (e) => {
  if (e.target === modalBackdrop) closeModal();
});
document.addEventListener("keydown", (e) => {
  if (e.key === "Escape" && !modalBackdrop.hidden) closeModal();
});

/* ---------- Patient card actions (event delegation) ---------- */
grid.addEventListener("click", (e) => {
  const btn = e.target.closest("button[data-action]");
  if (!btn) return;
  const p = patients.find((x) => x.id === btn.dataset.id);
  if (!p) return;

  if (btn.dataset.action === "view") {
    openModal(p);
  } else if (btn.dataset.action === "delete") {
    if (confirm(`Delete "${p.name}" from the registry?`)) {
      patients = patients.filter((x) => x.id !== p.id);
      saveState();
      renderPatients();
      renderStats();
    }
  }
});

/* ---------- Read uploaded images as Base64 ---------- */
function readImage(fileInput) {
  return new Promise((resolve) => {
    const file = fileInput.files && fileInput.files[0];
    if (!file) return resolve(null);
    if (!file.type.startsWith("image/")) return resolve(null);
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => resolve(null);
    reader.readAsDataURL(file);
  });
}

/* ---------- Form validation ---------- */
function setFieldError(id, message) {
  const field = document.getElementById(id);
  const err = document.querySelector(`[data-error-for="${id}"]`);
  if (err) err.textContent = message || "";
  if (field) field.classList.toggle("invalid", Boolean(message));
}

function validateForm(data) {
  let ok = true;
  if (!data.name) { setFieldError("fName", "This field is required."); ok = false; }
  else setFieldError("fName", "");

  const age = Number(data.age);
  if (!data.age || isNaN(age) || age < 3 || age > 100) {
    setFieldError("fAge", "Enter a valid age between 3 and 100."); ok = false;
  } else setFieldError("fAge", "");

  if (!data.type) { setFieldError("fType", "Select a condition type."); ok = false; }
  else setFieldError("fType", "");

  const weeks = Number(data.weeks);
  if (!data.weeks || isNaN(weeks) || weeks < 1 || weeks > 104) {
    setFieldError("fWeeks", "Enter a duration between 1 and 104 weeks."); ok = false;
  } else setFieldError("fWeeks", "");

  if (data.improvement !== "") {
    const imp = Number(data.improvement);
    if (isNaN(imp) || imp < 0 || imp > 100) {
      setFieldError("fImprovement", "Percentage must be between 0 and 100."); ok = false;
    } else setFieldError("fImprovement", "");
  } else setFieldError("fImprovement", "");

  return ok;
}

/* ---------- Form submission ---------- */
form.addEventListener("submit", async (e) => {
  e.preventDefault();
  formSuccess.hidden = true;

  const data = {
    name: document.getElementById("fName").value.trim(),
    age: document.getElementById("fAge").value.trim(),
    type: document.getElementById("fType").value,
    status: document.getElementById("fStatus").value,
    weeks: document.getElementById("fWeeks").value.trim(),
    improvement: document.getElementById("fImprovement").value.trim(),
    notes: document.getElementById("fNotes").value.trim(),
  };

  if (!validateForm(data)) return;

  const [beforeImg, afterImg] = await Promise.all([
    readImage(document.getElementById("fBefore")),
    readImage(document.getElementById("fAfter")),
  ]);

  const patient = {
    id: makeId(),
    name: data.name,
    age: Number(data.age),
    type: data.type,
    status: data.status,
    weeks: Number(data.weeks),
    improvement: data.improvement === "" ? null : Number(data.improvement),
    notes: data.notes,
    before: beforeImg || defaultBefore(),
    after: afterImg || defaultAfter(),
    sample: false,
    createdAt: new Date().toISOString().slice(0, 10),
  };

  patients.unshift(patient);
  saveState();
  renderPatients();
  renderStats();

  form.reset();
  formSuccess.hidden = false;
  document.getElementById("registry").scrollIntoView({ behavior: "smooth" });
  setTimeout(() => { formSuccess.hidden = true; }, 6000);
});

/* ---------- Mobile menu ---------- */
navToggle.addEventListener("click", () => {
  const open = navLinks.classList.toggle("open");
  navToggle.setAttribute("aria-expanded", String(open));
});
navLinks.addEventListener("click", (e) => {
  if (e.target.tagName === "A") {
    navLinks.classList.remove("open");
    navToggle.setAttribute("aria-expanded", "false");
  }
});

/* ---------- Initial run ---------- */
loadState();
loadOverlayPref();
renderPatients();
renderStats();
