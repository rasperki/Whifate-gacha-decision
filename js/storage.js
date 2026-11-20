const STORAGE_KEYS = {
  SAVED_DECKS: "whimsy_fate_saved_decks_v1",
  PREFS: "whimsy_fate_prefs_v1",
  ACTIVE_DECK: "whimsy_fate_active_deck_v1",
  CUSTOM_TOPICS: "whimsy_fate_custom_topics_v1"
};

function toBase64Url(jsonString) {
  const utf8Bytes = new TextEncoder().encode(jsonString);
  let binary = "";
  for (let i = 0; i < utf8Bytes.length; i += 1) {
    binary += String.fromCharCode(utf8Bytes[i]);
  }
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function fromBase64Url(base64UrlString) {
  let base64 = base64UrlString.replace(/-/g, "+").replace(/_/g, "/");
  while (base64.length % 4) {
    base64 += "=";
  }
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i);
  }
  return new TextDecoder().decode(bytes);
}

export function savePrefs(prefs) {
  try {
    localStorage.setItem(STORAGE_KEYS.PREFS, JSON.stringify(prefs));
  } catch {
    // Abaikan jika storage penuh atau diblokir
  }
}

export function loadActiveDeck() {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.ACTIVE_DECK);
    if (!raw) return null;
    const deck = JSON.parse(raw);
    const options = Array.isArray(deck?.options)
      ? deck.options.map((item) => String(item).trim()).filter(Boolean).slice(0, 30)
      : [];
    if (options.length < 2) return null;
    return {
      id: String(deck.id || "active-custom-deck"),
      title: String(deck.title || "Deck Tanpa Judul").trim(),
      question: String(deck.question || "").trim(),
      options
    };
  } catch {
    return null;
  }
}

export function saveActiveDeck(deck) {
  const cleanDeck = {
    id: deck.id || "active-custom-deck",
    title: String(deck.title || "Deck Tanpa Judul").trim() || "Deck Tanpa Judul",
    question: String(deck.question || "").trim(),
    options: (deck.options || []).map((item) => String(item).trim()).filter(Boolean).slice(0, 30)
  };

  if (cleanDeck.options.length < 2) {
    return { ok: false, message: "Minimal harus ada 2 opsi." };
  }

  try {
    localStorage.setItem(STORAGE_KEYS.ACTIVE_DECK, JSON.stringify(cleanDeck));
    return { ok: true, deck: cleanDeck, message: "Daftar pilihan sudah dipasang ke halaman utama!" };
  } catch {
    return { ok: false, message: "Gagal menyimpan pengaturan." };
  }
}

export function loadCustomTopics() {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.CUSTOM_TOPICS);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function saveCustomTopics(topics) {
  try {
    localStorage.setItem(STORAGE_KEYS.CUSTOM_TOPICS, JSON.stringify(topics.slice(0, 30)));
    return { ok: true, message: "Topik berhasil disimpan." };
  } catch {
    return { ok: false, message: "Gagal menyimpan topik." };
  }
}

export function loadSavedDecks() {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.SAVED_DECKS);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function saveCustomDeck(deck) {
  const cleanOptions = (deck.options || [])
    .map((item) => String(item).trim())
    .filter(Boolean);

  if (cleanOptions.length < 2) {
    return { ok: false, message: "Minimal harus ada 2 opsi buat disimpan." };
  }

  const decks = loadSavedDecks();
  const title = (deck.title || "").trim() || "Deck Tanpa Judul";
  const id = `custom-${title.toLowerCase().replace(/[^a-z0-9]+/g, "-")}-${Date.now().toString(36)}`;

  const newDeck = {
    id,
    title,
    question: (deck.question || "Deck custom tersimpan di browsermu.").trim(),
    options: cleanOptions.slice(0, 30)
  };

  const updated = [newDeck, ...decks.filter((item) => item.title !== title)].slice(0, 20);
  try {
    localStorage.setItem(STORAGE_KEYS.SAVED_DECKS, JSON.stringify(updated));
    return { ok: true, deck: newDeck, message: `Deck "${title}" tersimpan!` };
  } catch {
    return { ok: false, message: "Gagal menyimpan ke localStorage." };
  }
}

export function buildShareUrl(deck) {
  const payload = {
    t: (deck.title || "Pilihan Acak").trim().slice(0, 80),
    q: (deck.question || "").trim().slice(0, 140),
    o: (deck.options || []).map((opt) => String(opt).trim()).filter(Boolean).slice(0, 25)
  };

  const encoded = toBase64Url(JSON.stringify(payload));
  const url = new URL(window.location.href);
  url.searchParams.set("d", encoded);
  return url.toString();
}

export function parseDeckFromUrl() {
  try {
    const params = new URLSearchParams(window.location.search);
    const rawParam = params.get("d");
    if (!rawParam) return null;

    const decoded = JSON.parse(fromBase64Url(rawParam));
    if (!decoded || !Array.isArray(decoded.o)) return null;

    const options = decoded.o.map((opt) => String(opt).trim()).filter(Boolean).slice(0, 25);
    if (options.length < 2) return null;

    return {
      id: "shared-url-deck",
      title: String(decoded.t || "Deck Hasil Share").trim().slice(0, 80),
      question: String(decoded.q || "Deck dibagikan lewat tautan.").trim().slice(0, 140),
      options
    };
  } catch {
    return null;
  }
}

export function loadPrefs() {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.PREFS);
    if (!raw) {
      return { theme: "light", soundEnabled: true, mode: "gacha", crazyMode: false };
    }
    const parsed = JSON.parse(raw);
    return {
      theme: parsed.theme === "dark" ? "dark" : "light",
      soundEnabled: parsed.soundEnabled !== false,
      mode: parsed.mode === "tarot" ? "tarot" : "gacha",
      crazyMode: Boolean(parsed.crazyMode)
    };
  } catch {
    return { theme: "light", soundEnabled: true, mode: "gacha", crazyMode: false };
  }
}