import { loadSections } from "./sections-loader.js";
import {
  PRESETS,
  CRAZY_PRESETS,
  REROLL_LABELS,
  GACHA_CAPTIONS,
  TAROT_ARCANA_TAGS,
  TAROT_CAPTIONS,
  CRAZY_GACHA_TAGS,
  CRAZY_GACHA_CAPTIONS,
  CRAZY_TAROT_TAGS,
  CRAZY_TAROT_CAPTIONS
} from "./presets.js";
import {
  loadPrefs,
  savePrefs,
  loadSavedDecks,
  loadActiveDeck,
  loadCustomTopics,
  saveCustomDeck,
  buildShareUrl,
  parseDeckFromUrl
} from "./storage.js";
import { SoundEngine } from "./sound.js";
import { GachaController } from "./gacha.js";
import { TarotController } from "./tarot.js";
import { LofiEngine } from "./sound.js";

const state = {
  prefs: loadPrefs(),
  activeDeck: {
    id: PRESETS[0].id,
    title: PRESETS[0].title,
    question: PRESETS[0].question,
    options: [...PRESETS[0].options]
  },
  lastChoice: null
};

let soundEngine = null;
let gachaCtrl = null;
let tarotCtrl = null;
let lofiEngine = null;
let activeAdminRiddle = null;

const ADMIN_RIDDLES = [
  {
    question: "Aku punya wajah dan banyak mata, tapi tidak bisa melihat. Siapakah aku?",
    answers: ["dadu", "buah dadu"]
  },
  {
    question: "Semakin banyak aku diambil, semakin besar aku. Apakah aku?",
    answers: ["lubang"]
  },
  {
    question: "Aku punya kunci tapi tidak punya pintu. Aku punya ruang tapi tidak punya rumah. Apakah aku?",
    answers: ["keyboard", "papan ketik"]
  },
  {
    question: "Makin dikeringkan, makin basah. Apakah aku?",
    answers: ["handuk", "towel"]
  },
  {
    question: "Aku selalu ada di depanmu, tapi tidak pernah bisa kamu lihat. Apakah aku?",
    answers: ["masa depan", "masa depanmu", "hari esok"]
  }
];

function normalizeAnswer(value) {
  return String(value)
    .toLowerCase()
    .trim()
    .replace(/[^\w\s]/g, "")
    .replace(/\s+/g, " ");
}

function openAdminGate() {
  const modal = document.getElementById("adminGateModal");
  const questionEl = document.getElementById("adminRiddleText");
  const statusEl = document.getElementById("adminRiddleStatus");
  const answerInput = document.getElementById("adminRiddleAnswer");

  activeAdminRiddle = ADMIN_RIDDLES[Math.floor(Math.random() * ADMIN_RIDDLES.length)];
  if (questionEl) questionEl.textContent = activeAdminRiddle.question;
  if (statusEl) statusEl.textContent = "";
  if (answerInput) answerInput.value = "";
  modal?.classList.remove("hidden");
  answerInput?.focus();
}

function closeAdminGate() {
  document.getElementById("adminGateModal")?.classList.add("hidden");
  document.getElementById("adminRiddleStatus").textContent = "";
}

function pickRandom(list) {
  if (!Array.isArray(list) || list.length === 0) return "";
  return list[Math.floor(Math.random() * list.length)];
}

function getModeDeck(presetId, baseDeck, crazyMode) {
  const presetIndex = PRESETS.findIndex((preset) => preset.id === presetId);
  if (presetIndex < 0) return baseDeck;

  const preset = crazyMode ? CRAZY_PRESETS[presetIndex] : PRESETS[presetIndex];
  if (!preset) return baseDeck;

  return {
    id: preset.id,
    title: preset.title,
    question: preset.question,
    options: [...preset.options]
  };
}

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function applyTheme(theme) {
  const isDark = theme === "dark";
  document.documentElement.setAttribute("data-theme", isDark ? "dark" : "light");
  document.documentElement.classList.toggle("dark", isDark);

  const btn = document.getElementById("themeToggleBtn");
  if (btn) {
    btn.textContent = isDark ? "☀️" : "🌙";
    btn.title = isDark ? "Mode Terang" : "Mode Gelap";
  }
}

function updateSoundButton() {
  const btn = document.getElementById("soundToggleBtn");
  if (!btn) return;
  btn.textContent = state.prefs.soundEnabled ? "🔊" : "🔇";
  btn.title = state.prefs.soundEnabled ? "Suara Aktif" : "Suara Mati";
}

function applyCrazyMode(enabled) {
  state.prefs.crazyMode = Boolean(enabled);
  savePrefs(state.prefs);

  document.body.classList.toggle("is-crazy", state.prefs.crazyMode);
  gachaCtrl?.setCrazyMode(state.prefs.crazyMode);
  lofiEngine?.setCrazyMode(state.prefs.crazyMode);
  const lofiTitle = document.getElementById("lofiTitle");
  if (lofiTitle) lofiTitle.textContent = state.prefs.crazyMode ? "Neon Rush" : "Lofi Orbit";
  const lofiStatus = document.getElementById("lofiStatus");
  if (lofiStatus && lofiEngine?.isPlaying) {
    lofiStatus.textContent = state.prefs.crazyMode ? "🔥 Crazy mix • Sedang diputar" : "Sedang diputar";
  }

  const btn = document.getElementById("crazyModeBtn");
  if (btn) {
    btn.textContent = state.prefs.crazyMode ? "🔥 Crazy: ON" : "🔥 Crazy: OFF";
    btn.setAttribute("aria-pressed", String(state.prefs.crazyMode));
    btn.classList.toggle("is-crazy-active", state.prefs.crazyMode);
  }

  const presetIndex = PRESETS.findIndex((preset) => preset.id === state.activeDeck.id);
  if (presetIndex >= 0) {
    state.activeDeck = getModeDeck(state.activeDeck.id, state.activeDeck, state.prefs.crazyMode);
  } else if (state.activeDeck.id?.startsWith("custom-")) {
    const topic = loadCustomTopics().find((item) => item.id === state.activeDeck.id);
    const variant = topic ? (state.prefs.crazyMode ? topic.crazy : topic.normal) : null;
    if (variant) {
      state.activeDeck = {
        id: topic.id,
        title: variant.title,
        question: variant.question,
        options: [...variant.options]
      };
    }
  }
  populatePresetDropdown();
  renderDeckUI();
}

function setMode(mode) {
  state.prefs.mode = mode === "tarot" ? "tarot" : "gacha";
  savePrefs(state.prefs);

  const gachaBtn = document.getElementById("modeGachaBtn");
  const tarotBtn = document.getElementById("modeTarotBtn");
  const gachaStage = document.getElementById("gachaStage");
  const tarotStage = document.getElementById("tarotStage");
  const modeLabel = document.getElementById("stageModeLabel");

  const isTarot = state.prefs.mode === "tarot";

  gachaBtn?.classList.toggle("is-active", !isTarot);
  gachaBtn?.setAttribute("aria-selected", String(!isTarot));

  tarotBtn?.classList.toggle("is-active", isTarot);
  tarotBtn?.setAttribute("aria-selected", String(isTarot));

  gachaStage?.classList.toggle("hidden", isTarot);
  gachaStage?.classList.toggle("flex", !isTarot);

  tarotStage?.classList.toggle("hidden", !isTarot);
  tarotStage?.classList.toggle("flex", isTarot);

  if (modeLabel) {
    modeLabel.textContent = isTarot ? "MODE: TAROT CARDS" : "MODE: GACHA CAPSULE";
  }

  if (isTarot && tarotCtrl) {
    tarotCtrl.deal(state.activeDeck.options);
  }
}

function populatePresetDropdown() {
  const select = document.getElementById("presetSelect");
  if (!select) return;

  let html = `<option value="">-- Pilih Preset --</option>`;

  html += `<optgroup label="Preset Bawaan">`;
  PRESETS.forEach((preset, idx) => {
    const label = state.prefs.crazyMode ? CRAZY_PRESETS[idx]?.title || preset.title : preset.title;
    html += `<option value="preset:${idx}">${escapeHtml(label)}</option>`;
  });
  html += `</optgroup>`;

  const customTopics = loadCustomTopics();
  if (customTopics.length) {
    html += `<optgroup label="Topik Buatan Admin">`;
    customTopics.forEach((topic) => {
      const variant = state.prefs.crazyMode ? topic.crazy : topic.normal;
      html += `<option value="custom:${topic.id}">${escapeHtml(variant?.title || topic.normal?.title || "Topik Tanpa Judul")}</option>`;
    });
    html += `</optgroup>`;
  }

  select.innerHTML = html;

  const presetIndex = PRESETS.findIndex((preset) => preset.id === state.activeDeck.id);
  if (presetIndex >= 0) {
    select.value = `preset:${presetIndex}`;
  } else if (state.activeDeck.id?.startsWith("custom-")) {
    select.value = `custom:${state.activeDeck.id}`;
  }
}

function renderDeckUI() {
  const titleInput = document.getElementById("deckTitleInput");
  const questionInput = document.getElementById("deckQuestionInput");
  const activeTitle = document.getElementById("activeDeckTitle");
  const questionEl = document.getElementById("deckQuestion");
  const countBadge = document.getElementById("optionCountBadge");
  const optionsList = document.getElementById("optionsList");
  const hiddenDeckTitle = document.getElementById("hiddenDeckTitle");
  const hiddenDeckQuestion = document.getElementById("hiddenDeckQuestion");

  if (titleInput && document.activeElement !== titleInput) {
    titleInput.value = state.activeDeck.title;
  }
  if (questionInput && document.activeElement !== questionInput) {
    questionInput.value = state.activeDeck.question;
  }
  if (activeTitle) {
    activeTitle.textContent = state.activeDeck.title || "Deck Tanpa Judul";
  }
  if (questionEl) {
    questionEl.textContent =
      state.activeDeck.question || "Masukkan minimal 2 opsi biar semesta bisa memilih.";
  }
  if (countBadge) {
    countBadge.textContent = `${state.activeDeck.options.length} opsi`;
  }
  if (hiddenDeckTitle) {
    hiddenDeckTitle.textContent = state.activeDeck.title || "Deck Tanpa Judul";
  }
  if (hiddenDeckQuestion) {
    hiddenDeckQuestion.textContent = state.activeDeck.question || "Daftar pilihan disembunyikan dari pemain.";
  }

  if (optionsList) {
    if (state.activeDeck.options.length === 0) {
      optionsList.innerHTML = `
        <li class="text-xs opacity-65 font-mono py-3 text-center border border-dashed border-current/20 rounded-xl">
          Belum ada pilihan. Tambah opsi di atas ya!
        </li>
      `;
    } else {
      optionsList.innerHTML = state.activeDeck.options
        .map(
          (opt, index) => `
            <li class="flex items-center justify-between gap-2 px-3 py-2 rounded-xl border-2 border-current/15 bg-[var(--bg-elevated)]">
              <span class="text-sm font-medium break-words">${escapeHtml(opt)}</span>
              <button
                type="button"
                data-remove-index="${index}"
                class="text-xs font-mono px-2 py-0.5 rounded-lg hover:bg-rose-500/20 text-rose-600 dark:text-rose-400 cursor-pointer"
                title="Hapus opsi"
                aria-label="Hapus ${escapeHtml(opt)}"
              >
                ✕
              </button>
            </li>
          `
        )
        .join("");
    }
  }

  gachaCtrl?.renderBalls(state.activeDeck.options.length);
  if (state.prefs.mode === "tarot") {
    tarotCtrl?.deal(state.activeDeck.options);
  }
}

function showResult(choiceText, sourceMode) {
  state.lastChoice = choiceText;

  const resultSection = document.getElementById("resultSection");
  const arcanaTag = document.getElementById("resultArcanaTag");
  const timestampEl = document.getElementById("resultTimestamp");
  const choiceEl = document.getElementById("resultChoiceText");
  const captionEl = document.getElementById("resultCaptionText");
  const rerollBtn = document.getElementById("rerollBtn");

  if (!resultSection || !choiceEl) return;

  const isTarot = sourceMode === "tarot";
  const isCrazy = Boolean(state.prefs.crazyMode);

  if (arcanaTag) {
    if (isCrazy) {
      arcanaTag.textContent = isTarot
        ? pickRandom(CRAZY_TAROT_TAGS)
        : pickRandom(CRAZY_GACHA_TAGS);
    } else {
      arcanaTag.textContent = isTarot ? pickRandom(TAROT_ARCANA_TAGS) : "✦ CAPSULE REVEALED";
    }
  }

  if (timestampEl) {
    const now = new Date();
    timestampEl.textContent = now.toLocaleTimeString("id-ID", {
      hour: "2-digit",
      minute: "2-digit"
    });
  }

  choiceEl.textContent = choiceText;

  if (captionEl) {
    if (isCrazy) {
      captionEl.textContent = isTarot
        ? pickRandom(CRAZY_TAROT_CAPTIONS)
        : pickRandom(CRAZY_GACHA_CAPTIONS);
    } else {
      captionEl.textContent = isTarot ? pickRandom(TAROT_CAPTIONS) : pickRandom(GACHA_CAPTIONS);
    }
  }

  if (rerollBtn) {
    rerollBtn.textContent = pickRandom(REROLL_LABELS);
  }

  resultSection.classList.remove("hidden");

  if (typeof anime !== "undefined") {
    anime({
      targets: "#resultExportCard",
      scale: isCrazy ? [0.88, 1.04, 1] : [0.95, 1],
      rotate: isCrazy ? [-3, 2, 0] : [0, 0, 0],
      opacity: [0, 1],
      duration: isCrazy ? 420 : 320,
      easing: "easeOutCubic"
    });
  }
}

function setShareStatus(message, isError = false) {
  const el = document.getElementById("shareStatus");
  if (!el) return;
  el.textContent = message;
  el.className = `font-mono text-xs min-h-4 ${
    isError ? "text-rose-600 dark:text-rose-400" : "text-emerald-600 dark:text-emerald-400"
  }`;
}

function spinGachaWithMode() {
  gachaCtrl?.spin(
    state.activeDeck.options,
    (chosenOption) => {
      showResult(chosenOption, "gacha");
    },
    state.prefs.crazyMode
  );
}

function bindEvents() {
  // Admin riddle gate
  document.getElementById("adminPanelBtn")?.addEventListener("click", openAdminGate);
  document.getElementById("closeAdminGateBtn")?.addEventListener("click", closeAdminGate);

  document.getElementById("adminGateModal")?.addEventListener("click", (event) => {
    if (event.target.id === "adminGateModal") closeAdminGate();
  });

  document.getElementById("adminRiddleForm")?.addEventListener("submit", (event) => {
    event.preventDefault();
    const input = document.getElementById("adminRiddleAnswer");
    const statusEl = document.getElementById("adminRiddleStatus");
    const answer = normalizeAnswer(input?.value || "");

    if (!activeAdminRiddle) {
      openAdminGate();
      return;
    }

    const isCorrect = activeAdminRiddle.answers.some(
      (acceptedAnswer) => normalizeAnswer(acceptedAnswer) === answer
    );

    if (!isCorrect) {
      if (statusEl) {
        statusEl.textContent = "Belum tepat. Semesta bilang coba lagi...";
        statusEl.className = "font-mono text-xs min-h-4 mt-3 text-rose-600";
      }
      return;
    }

    sessionStorage.setItem("whimsy_admin_unlock", "true");
    window.location.href = "setup.html";
  });

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") closeAdminGate();
  });

  // Mode switcher
  document.getElementById("modeGachaBtn")?.addEventListener("click", () => setMode("gacha"));
  document.getElementById("modeTarotBtn")?.addEventListener("click", () => setMode("tarot"));

  // Crazy mode toggle
  document.getElementById("crazyModeBtn")?.addEventListener("click", () => {
    applyCrazyMode(!state.prefs.crazyMode);
    if (state.prefs.crazyMode) {
      soundEngine?.playCrazy();
    }
  });

  // Sound toggle
  document.getElementById("soundToggleBtn")?.addEventListener("click", () => {
    state.prefs.soundEnabled = !state.prefs.soundEnabled;
    soundEngine?.setEnabled(state.prefs.soundEnabled);
    savePrefs(state.prefs);
    updateSoundButton();
  });

  // Theme toggle
  document.getElementById("themeToggleBtn")?.addEventListener("click", () => {
    state.prefs.theme = state.prefs.theme === "dark" ? "light" : "dark";
    applyTheme(state.prefs.theme);
    savePrefs(state.prefs);
  });

  // Preset select
  document.getElementById("presetSelect")?.addEventListener("change", (e) => {
    const val = e.target.value;
    if (!val) return;

    const [kind, idxStr] = val.split(":");
    const idx = Number(idxStr);

    if (kind === "preset" && PRESETS[idx]) {
      const p = state.prefs.crazyMode ? CRAZY_PRESETS[idx] : PRESETS[idx];
      state.activeDeck = {
        id: p.id,
        title: p.title,
        question: p.question,
        options: [...p.options]
      };
      renderDeckUI();
      setShareStatus(`Memuat preset "${p.title}".`);
    } else if (kind === "custom") {
      const topic = loadCustomTopics().find((item) => item.id === idxStr);
      if (topic) {
        const variant = state.prefs.crazyMode ? topic.crazy : topic.normal;
        if (variant) {
          state.activeDeck = {
            id: topic.id,
            title: variant.title,
            question: variant.question,
            options: [...variant.options]
          };
          renderDeckUI();
          setShareStatus(`Memuat topik "${variant.title}".`);
        }
      }
    }
  });

  // Save deck to localStorage
  document.getElementById("saveDeckBtn")?.addEventListener("click", () => {
    const titleInput = document.getElementById("deckTitleInput");
    state.activeDeck.title = titleInput?.value.trim() || state.activeDeck.title;

    const res = saveCustomDeck(state.activeDeck);
    if (res.ok) {
      populatePresetDropdown();
      renderDeckUI();
      setShareStatus(res.message, false);
    } else {
      setShareStatus(res.message, true);
    }
  });

  // Title live sync
  document.getElementById("deckTitleInput")?.addEventListener("input", (e) => {
    state.activeDeck.title = e.target.value;
    const activeTitle = document.getElementById("activeDeckTitle");
    if (activeTitle) {
      activeTitle.textContent = state.activeDeck.title.trim() || "Deck Tanpa Judul";
    }
  });

  // Question live sync
  document.getElementById("deckQuestionInput")?.addEventListener("input", (e) => {
    state.activeDeck.question = e.target.value;
    const questionEl = document.getElementById("deckQuestion");
    if (questionEl) {
      questionEl.textContent =
        state.activeDeck.question.trim() || "Masukkan minimal 2 opsi biar semesta bisa memilih.";
    }
  });

  // Add option
  document.getElementById("addOptionForm")?.addEventListener("submit", (e) => {
    e.preventDefault();
    const input = document.getElementById("optionInput");
    if (!input) return;

    const value = input.value.trim();
    if (!value) return;

    state.activeDeck.options.push(value);
    input.value = "";
    input.focus();
    renderDeckUI();
  });

  // Remove option (event delegation)
  document.getElementById("optionsList")?.addEventListener("click", (e) => {
    const btn = e.target.closest("[data-remove-index]");
    if (!btn) return;
    const idx = Number(btn.getAttribute("data-remove-index"));
    if (Number.isInteger(idx) && idx >= 0 && idx < state.activeDeck.options.length) {
      state.activeDeck.options.splice(idx, 1);
      renderDeckUI();
    }
  });

  // Clear options
  document.getElementById("clearOptionsBtn")?.addEventListener("click", () => {
    state.activeDeck.options = [];
    document.getElementById("resultSection")?.classList.add("hidden");
    renderDeckUI();
    setShareStatus("Semua opsi dibersihkan.");
  });

  // Shareable URL
  document.getElementById("shareLinkBtn")?.addEventListener("click", async () => {
    if (state.activeDeck.options.length < 2) {
      setShareStatus("Minimal 2 opsi dulu sebelum bikin share link.", true);
      return;
    }

    const shareUrl = buildShareUrl(state.activeDeck);
    try {
      await navigator.clipboard.writeText(shareUrl);
      setShareStatus("Link disalin ke clipboard! Siap dikirim ke teman.");
    } catch {
      window.prompt("Salin tautan ini:", shareUrl);
      setShareStatus("Tautan siap disalin.");
    }
  });

  // Gacha spin button
  document.getElementById("gachaSpinBtn")?.addEventListener("click", spinGachaWithMode);

  // Tarot shuffle button
  document.getElementById("tarotShuffleBtn")?.addEventListener("click", () => {
    tarotCtrl?.deal(state.activeDeck.options);
  });

  // Reroll button
  document.getElementById("rerollBtn")?.addEventListener("click", () => {
    if (state.prefs.mode === "tarot") {
      tarotCtrl?.deal(state.activeDeck.options);
    } else {
      spinGachaWithMode();
    }
  });

  // Download result PNG via html2canvas
  document.getElementById("downloadResultBtn")?.addEventListener("click", async () => {
    const cardEl = document.getElementById("resultExportCard");
    if (!cardEl) return;
    if (typeof html2canvas === "undefined") {
      setShareStatus("Library ekspor belum siap. Muat ulang halaman lalu coba lagi.", true);
      return;
    }

    try {
      const canvas = await html2canvas(cardEl, {
        backgroundColor: null,
        scale: 2
      });
      const link = document.createElement("a");
      const slug = (state.activeDeck.title || "whimsy-fate")
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-|-$/g, "");
      link.download = `${slug || "whimsy-fate"}-hasil.png`;
      link.href = canvas.toDataURL("image/png");
      link.click();
      setShareStatus("Hasil berhasil diekspor sebagai PNG.");
    } catch {
      setShareStatus("Gagal mengekspor gambar PNG.", true);
    }
  });
}

async function init() {
  applyTheme(state.prefs.theme);
  updateSoundButton();

  await loadSections({
    "#slot-header": "sections/header.html",
    "#slot-options": "sections/options-panel.html",
    "#slot-stage": "sections/stage-panel.html",
    "#slot-result": "sections/result-section.html"
  });

  const sharedDeck = parseDeckFromUrl();
  const activeDeck = loadActiveDeck();
  if (sharedDeck) {
    state.activeDeck = sharedDeck;
  } else if (activeDeck) {
    state.activeDeck = activeDeck;
  }

  soundEngine = new SoundEngine(state.prefs.soundEnabled);

  gachaCtrl = new GachaController({
    ballsContainer: document.getElementById("gachaBallsContainer"),
    spinBtn: document.getElementById("gachaSpinBtn"),
    knobEl: document.getElementById("gachaSpinBtn"),
    droppedCapsuleEl: document.getElementById("droppedCapsule"),
    hintEl: document.getElementById("gachaHint"),
    sound: soundEngine,
    machineEl: document.querySelector(".gacha-machine")
  });

  tarotCtrl = new TarotController({
    spreadContainer: document.getElementById("tarotSpreadContainer"),
    hintEl: document.getElementById("tarotHint"),
    sound: soundEngine,
    onPick: (chosenOption) => {
      showResult(chosenOption, "tarot");
    }
  });

  populatePresetDropdown();
  bindEvents();
  renderDeckUI();
  applyCrazyMode(state.prefs.crazyMode);
  setMode(state.prefs.mode);

  lofiEngine = new LofiEngine();
  lofiEngine.setCrazyMode(state.prefs.crazyMode);
  const lofiPlayBtn = document.getElementById("lofiPlayBtn");
  const lofiStatus = document.getElementById("lofiStatus");
  const lofiTitle = document.getElementById("lofiTitle");
  if (lofiTitle) lofiTitle.textContent = state.prefs.crazyMode ? "Neon Rush" : "Lofi Orbit";
  lofiPlayBtn?.addEventListener("click", async () => {
    if (lofiEngine.isPlaying) {
      lofiEngine.stop();
      lofiPlayBtn.classList.remove("is-playing");
      lofiPlayBtn.setAttribute("aria-pressed", "false");
      lofiPlayBtn.setAttribute("aria-label", "Putar lagu lofi");
      if (lofiStatus) lofiStatus.textContent = "Lofi dijeda";
      return;
    }

    try {
      const started = await lofiEngine.start();
      if (!started) {
        if (lofiStatus) lofiStatus.textContent = "Browser ini tidak mendukung Web Audio";
        return;
      }
      lofiPlayBtn.classList.add("is-playing");
      lofiPlayBtn.setAttribute("aria-pressed", "true");
      lofiPlayBtn.setAttribute("aria-label", "Jeda lagu lofi");
      if (lofiStatus) {
        lofiStatus.textContent = state.prefs.crazyMode
          ? "🔥 Crazy mix • Sedang diputar"
          : "Sedang diputar";
      }
    } catch (error) {
      console.error("Gagal memulai radio lofi:", error);
      if (lofiStatus) lofiStatus.textContent = "Audio gagal dimulai; coba tekan play lagi";
    }
  });

  if (sharedDeck) {
    setShareStatus(`Memuat deck dari tautan: "${sharedDeck.title}".`);
  }
}

init().catch((err) => {
  console.error("Gagal menginisialisasi aplikasi:", err);
});