import { PRESETS, CRAZY_PRESETS } from "./presets.js";
import { loadActiveDeck, saveActiveDeck, loadPrefs, loadCustomTopics, saveCustomTopics } from "./storage.js";

if (sessionStorage.getItem("whimsy_admin_unlock") !== "true") {
  window.location.replace("index.html");
}

const prefs = loadPrefs();
document.documentElement.setAttribute("data-theme", prefs.theme === "dark" ? "dark" : "light");

const fallback = PRESETS[0];
const activeDeck = loadActiveDeck();
const deck = activeDeck || {
  id: fallback.id,
  title: fallback.title,
  question: fallback.question,
  options: [...fallback.options]
};

const titleInput = document.getElementById("deckTitleInput");
const questionInput = document.getElementById("deckQuestionInput");
const optionInput = document.getElementById("optionInput");
const optionsList = document.getElementById("optionsList");
const optionCountBadge = document.getElementById("optionCountBadge");
const presetSelect = document.getElementById("presetSelect");
const status = document.getElementById("setupStatus");
let setupMode = prefs.crazyMode ? "crazy" : "normal";
let customTopics = loadCustomTopics();
let isNewTopic = false;

function buildTopicFromDeck(sourceDeck) {
  return {
    id: sourceDeck.id?.startsWith("custom-") ? sourceDeck.id : `custom-${Date.now().toString(36)}`,
    normal: {
      title: sourceDeck.title,
      question: sourceDeck.question,
      options: [...sourceDeck.options]
    },
    crazy: {
      title: sourceDeck.title,
      question: sourceDeck.question,
      options: [...sourceDeck.options]
    }
  };
}

let topic = activeDeck?.id?.startsWith("custom-")
  ? customTopics.find((item) => item.id === activeDeck.id) || buildTopicFromDeck(activeDeck)
  : buildTopicFromDeck(activeDeck || deck);

function getVariant() {
  if (!topic[setupMode]) {
    topic[setupMode] = setupMode === "crazy"
      ? { title: topic.normal.title, question: topic.normal.question, options: [...topic.normal.options] }
      : { title: topic.crazy.title, question: topic.crazy.question, options: [...topic.crazy.options] };
  }
  return topic[setupMode];
}

function populatePresetDropdown() {
  presetSelect.innerHTML = `<option value="">-- Pilih Preset / Topik --</option>`;
  const builtIn = document.createElement("optgroup");
  builtIn.label = "Preset Bawaan";
  PRESETS.forEach((preset, index) => {
    const option = document.createElement("option");
    option.value = `preset:${index}`;
    const crazyPreset = CRAZY_PRESETS[index];
    option.textContent = setupMode === "crazy" ? crazyPreset?.title || preset.title : preset.title;
    builtIn.appendChild(option);
  });
  presetSelect.appendChild(builtIn);

  if (customTopics.length) {
    const custom = document.createElement("optgroup");
    custom.label = "Topik Buatan Admin";
    customTopics.forEach((item) => {
      const option = document.createElement("option");
      option.value = `custom:${item.id}`;
      option.textContent = item[setupMode]?.title || item.normal?.title || "Topik Tanpa Judul";
      custom.appendChild(option);
    });
    presetSelect.appendChild(custom);
  }
}

function applySetupMode(mode) {
  setupMode = mode;
  document.getElementById("setupNormalBtn").classList.toggle("is-active", mode === "normal");
  document.getElementById("setupCrazyBtn").classList.toggle("is-active", mode === "crazy");
  document.getElementById("setupNormalBtn").setAttribute("aria-selected", String(mode === "normal"));
  document.getElementById("setupCrazyBtn").setAttribute("aria-selected", String(mode === "crazy"));
  populatePresetDropdown();
  loadVariantToInputs();
}

function loadVariantToInputs() {
  const variant = getVariant();
  titleInput.value = variant.title || "";
  questionInput.value = variant.question || "";
  renderOptions();
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function renderOptions() {
  const variant = getVariant();
  variant.options = (variant.options || []).filter(Boolean);
  optionCountBadge.textContent = `${variant.options.length} opsi`;
  optionsList.innerHTML = variant.options.length
    ? variant.options.map((item, index) => `
      <li class="flex items-center justify-between gap-2 px-3 py-2 rounded-xl border-2 border-current/15 bg-[var(--bg-elevated)]">
        <span class="text-sm font-medium break-words">${escapeHtml(item)}</span>
        <button type="button" data-remove-index="${index}" class="text-xs font-mono px-2 py-1 rounded-lg text-rose-600 cursor-pointer" aria-label="Hapus ${escapeHtml(item)}">✕</button>
      </li>
    `).join("")
    : `<li class="text-xs opacity-65 font-mono py-3 text-center border border-dashed border-current/20 rounded-xl">Belum ada pilihan.</li>`;
}

presetSelect.addEventListener("change", (event) => {
  const value = event.target.value;
  if (!value) return;
  const [kind, key] = value.split(":");
  if (kind === "preset") {
    const index = Number(key);
    const preset = setupMode === "crazy" ? CRAZY_PRESETS[index] : PRESETS[index];
    if (!preset) return;
    topic = {
      id: `custom-${preset.id}-${Date.now().toString(36)}`,
      normal: {
        title: PRESETS[index].title,
        question: PRESETS[index].question,
        options: [...PRESETS[index].options]
      },
      crazy: {
        title: CRAZY_PRESETS[index].title,
        question: CRAZY_PRESETS[index].question,
        options: [...CRAZY_PRESETS[index].options]
      }
    };
  } else if (kind === "custom") {
    const found = customTopics.find((item) => item.id === key);
    if (found) topic = found;
  }
  isNewTopic = false;
  loadVariantToInputs();
});

titleInput.addEventListener("input", () => {
  getVariant().title = titleInput.value;
});

questionInput.addEventListener("input", () => {
  getVariant().question = questionInput.value;
});

document.getElementById("addOptionForm").addEventListener("submit", (event) => {
  event.preventDefault();
  const value = optionInput.value.trim();
  if (!value) return;
  getVariant().options.push(value);
  optionInput.value = "";
  optionInput.focus();
  renderOptions();
});

optionsList.addEventListener("click", (event) => {
  const button = event.target.closest("[data-remove-index]");
  if (!button) return;
  const index = Number(button.dataset.removeIndex);
  if (Number.isInteger(index)) {
    getVariant().options.splice(index, 1);
    renderOptions();
  }
});

document.getElementById("saveDeckBtn").addEventListener("click", () => {
  const variant = getVariant();
  variant.title = titleInput.value.trim();
  variant.question = questionInput.value.trim();
  if (!variant.title) variant.title = "Topik Tanpa Judul";

  if (!topic.normal?.title && topic.normal) topic.normal.title = variant.title;
  if (!topic.crazy?.title && topic.crazy) topic.crazy.title = variant.title;

  if (!topic.normal.options) topic.normal.options = [];
  if (!topic.crazy.options) topic.crazy.options = [];

  const existingIndex = customTopics.findIndex((item) => item.id === topic.id);
  if (existingIndex >= 0) customTopics[existingIndex] = topic;
  else customTopics.unshift(topic);

  const topicResult = saveCustomTopics(customTopics);
  if (!topicResult.ok) {
    status.textContent = topicResult.message;
    status.className = "font-mono text-xs min-h-4 text-rose-600";
    return;
  }

  const activeVariant = topic[setupMode] || variant;
  const result = saveActiveDeck({
    id: topic.id,
    title: activeVariant.title,
    question: activeVariant.question,
    options: activeVariant.options
  });
  status.textContent = result.message;
  status.className = `font-mono text-xs min-h-4 ${
    result.ok
      ? "text-emerald-600 dark:text-emerald-400"
      : "text-rose-600 dark:text-rose-400"
  }`;
});

document.getElementById("setupNormalBtn").addEventListener("click", () => applySetupMode("normal"));
document.getElementById("setupCrazyBtn").addEventListener("click", () => applySetupMode("crazy"));

document.getElementById("newTopicBtn").addEventListener("click", () => {
  isNewTopic = true;
  topic = {
    id: `custom-topic-${Date.now().toString(36)}`,
    normal: { title: "Topik Baru", question: "", options: [] },
    crazy: { title: "Topik Baru — Crazy", question: "", options: [] }
  };
  presetSelect.value = "";
  loadVariantToInputs();
  titleInput.focus();
  status.textContent = "Topik baru siap dibuat.";
  status.className = "font-mono text-xs min-h-4 text-emerald-600";
});

populatePresetDropdown();
applySetupMode(setupMode);
