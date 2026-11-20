export class TarotController {
  constructor({ spreadContainer, hintEl, sound, onPick }) {
    this.spreadContainer = spreadContainer;
    this.hintEl = hintEl;
    this.sound = sound;
    this.onPick = onPick;
    this.currentOptions = [];
    this.isLocked = false;
  }

  shuffleArray(arr) {
    const copy = [...arr];
    for (let i = copy.length - 1; i > 0; i -= 1) {
      const j = Math.floor(Math.random() * (i + 1));
      [copy[i], copy[j]] = [copy[j], copy[i]];
    }
    return copy;
  }

  deal(options) {
    if (!this.spreadContainer) return;

    this.currentOptions = Array.isArray(options) ? [...options] : [];
    this.isLocked = false;
    this.spreadContainer.innerHTML = "";

    if (this.currentOptions.length < 2) {
      this.spreadContainer.innerHTML = `
        <p class="font-mono text-xs opacity-70 self-center">
          Butuh minimal 2 opsi untuk menyebar kartu tarot.
        </p>
      `;
      return;
    }

    this.sound?.playShuffle();

    const shuffled = this.shuffleArray(this.currentOptions);
    const maxCards = Math.min(shuffled.length, 8);
    const dealt = shuffled.slice(0, maxCards);

    dealt.forEach((optionText, idx) => {
      const slot = document.createElement("button");
      slot.type = "button";
      slot.className = "tarot-card-slot";
      slot.setAttribute("aria-label", `Kartu tarot ke-${idx + 1}, klik untuk membuka`);

      slot.innerHTML = `
        <div class="tarot-card-inner">
          <div class="tarot-face tarot-back">
            <span class="font-mono text-xs opacity-75">CARD #${idx + 1}</span>
            <span class="font-display text-2xl my-1">✦</span>
            <span class="font-mono text-[10px] tracking-wider uppercase">Tap to Flip</span>
          </div>
          <div class="tarot-face tarot-front">
            <span class="font-mono text-[10px] opacity-65 mb-1">REVEALED</span>
            <span class="font-display text-sm font-bold leading-snug line-clamp-4">${this.escapeHtml(optionText)}</span>
          </div>
        </div>
      `;

      slot.addEventListener("click", () => {
        if (this.isLocked || slot.classList.contains("is-flipped")) return;
        this.isLocked = true;

        slot.classList.add("is-flipped");
        this.sound?.playCardFlip();

        // Nonaktifkan kartu lain setelah satu kartu terpilih
        const allSlots = this.spreadContainer.querySelectorAll(".tarot-card-slot");
        allSlots.forEach((other) => {
          if (other !== slot) {
            other.style.opacity = "0.45";
            other.style.pointerEvents = "none";
          }
        });

        if (this.hintEl) {
          this.hintEl.textContent = "Kartu terpilih sudah terbuka! Klik 'Kocok & Sebar Kartu' untuk sesi baru.";
        }

        if (typeof this.onPick === "function") {
          this.onPick(optionText, idx);
        }
      });

      this.spreadContainer.appendChild(slot);
    });

    if (typeof anime !== "undefined") {
      anime({
        targets: this.spreadContainer.querySelectorAll(".tarot-card-slot"),
        scale: [0.85, 1],
        opacity: [0, 1],
        translateY: [14, 0],
        delay: anime.stagger(55),
        duration: 380,
        easing: "easeOutBack"
      });
    }
  }

  escapeHtml(str) {
    return String(str)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }
}