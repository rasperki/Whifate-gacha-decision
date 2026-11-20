const CAPSULE_COLORS = [
  "#ff7eb6",
  "#7be0ad",
  "#ffd166",
  "#b8a9ff",
  "#7bdff2",
  "#ff9f68"
];

const CRAZY_CAPSULE_COLORS = [
  "#ff3d8d",
  "#00e5ff",
  "#ffe600",
  "#a855f7",
  "#39ff14",
  "#ff6b35"
];

export class GachaController {
  constructor({ ballsContainer, spinBtn, knobEl, droppedCapsuleEl, hintEl, sound, machineEl }) {
    this.ballsContainer = ballsContainer;
    this.spinBtn = spinBtn;
    this.knobEl = knobEl;
    this.droppedCapsuleEl = droppedCapsuleEl;
    this.hintEl = hintEl;
    this.sound = sound;
    this.machineEl = machineEl;
    this.isSpinning = false;
    this.crazyMode = false;
  }

  setCrazyMode(enabled) {
    this.crazyMode = Boolean(enabled);
    this.renderBalls(this.lastCount || 6);
  }

  renderBalls(count = 14) {
    if (!this.ballsContainer) return;
    this.lastCount = count;
    this.ballsContainer.innerHTML = "";
    const colors = this.crazyMode ? CRAZY_CAPSULE_COLORS : CAPSULE_COLORS;

    const total = Math.max(8, Math.min(20, count * 2));
    for (let i = 0; i < total; i += 1) {
      const ball = document.createElement("span");
      ball.className = "gacha-ball";
      const color = colors[i % colors.length];
      ball.style.backgroundColor = color;

      const leftPct = 10 + ((i * 23) % 72);
      const topPct = 35 + ((i * 19) % 52);
      const rot = ((i * 37) % 80) - 40;

      ball.style.left = `${leftPct}%`;
      ball.style.top = `${topPct}%`;
      ball.style.transform = `rotate(${rot}deg)`;

      this.ballsContainer.appendChild(ball);
    }
  }

  shakeDome(crazy = false) {
    if (!this.ballsContainer || typeof anime === "undefined") return;
    const balls = this.ballsContainer.querySelectorAll(".gacha-ball");

    if (crazy) {
      anime({
        targets: balls,
        translateX: [0, -36, 32, -28, 38, -22, 0],
        translateY: [0, -28, 18, -34, 24, -18, 0],
        rotate: [0, -65, 55, -80, 48, -30, 0],
        scale: [1, 1.2, 0.9, 1.15, 0.92, 1.08, 1],
        delay: (_, index) => (index % 8) * 18,
        duration: 1750,
        easing: "easeInOutSine"
      });
      return;
    }

    anime({
      targets: balls,
      translateX: () => anime.random(-24, 24),
      translateY: () => anime.random(-28, 16),
      rotate: () => anime.random(-45, 45),
      duration: 520,
      easing: "easeInOutQuad",
      direction: "alternate"
    });
  }

  burstSparks() {
    if (!this.machineEl) return;
    const symbols = ["✦", "✧", "★", "●"];
    const colors = ["#ff3d8d", "#00e5ff", "#ffe600", "#39ff14", "#a855f7"];
    const sparks = Array.from({ length: 12 }, (_, index) => {
      const spark = document.createElement("span");
      spark.className = "gacha-crazy-spark";
      spark.textContent = symbols[index % symbols.length];
      spark.style.left = `${35 + Math.random() * 30}%`;
      spark.style.top = `${25 + Math.random() * 45}%`;
      spark.style.color = colors[index % colors.length];
      this.machineEl.appendChild(spark);
      return spark;
    });

    if (typeof anime === "undefined") {
      window.setTimeout(() => sparks.forEach((spark) => spark.remove()), 700);
      return;
    }

    anime({
      targets: sparks,
      translateX: () => anime.random(-100, 100),
      translateY: () => anime.random(-85, 65),
      scale: [0, 1.35, 0],
      rotate: () => anime.random(-160, 160),
      opacity: [0, 1, 0],
      delay: anime.stagger(18),
      duration: 720,
      easing: "easeOutCubic",
      complete: () => sparks.forEach((spark) => spark.remove())
    });
  }

  spin(options, onComplete, crazy = false) {
    if (this.isSpinning) return;

    if (!Array.isArray(options) || options.length < 2) {
      if (this.hintEl) {
        this.hintEl.textContent = "Tambahkan minimal 2 pilihan dulu biar mesin gachanya bisa jalan!";
      }
      return;
    }

    this.isSpinning = true;
    if (this.spinBtn) this.spinBtn.disabled = true;
    if (this.hintEl) {
      this.hintEl.textContent = crazy
        ? "🔥 CRAZY MODE! Kapsul sedang diguncang habis-habisan!"
        : "Memutar tuas... kapsul sedang dipilih!";
    }

    const chosenIndex = Math.floor(Math.random() * options.length);
    const chosenOption = options[chosenIndex];
    const colors = crazy ? CRAZY_CAPSULE_COLORS : CAPSULE_COLORS;
    const capsuleColor = colors[chosenIndex % colors.length];

    this.sound?.playCrank();
    if (crazy) {
      this.sound?.playCrazy();
    }
    this.shakeDome(crazy);
    if (crazy) {
      this.machineEl?.classList.add("is-crazy-spinning");
      this.burstSparks();
    }

    if (this.droppedCapsuleEl) {
      this.droppedCapsuleEl.classList.add("hidden");
      this.droppedCapsuleEl.style.background = `linear-gradient(180deg, ${capsuleColor} 50%, var(--bg-card) 50%)`;
    }

    const finishSpin = () => {
      if (this.droppedCapsuleEl) {
        this.droppedCapsuleEl.classList.remove("hidden");
        if (typeof anime !== "undefined") {
          anime({
            targets: this.droppedCapsuleEl,
            translateY: [-34, 0],
            scale: crazy ? [0.5, 1.35, 1] : [0.6, 1.12, 1],
            rotate: crazy ? [-25, 25, 0] : [0, 0, 0],
            duration: crazy ? 460 : 360,
            easing: "easeOutBounce"
          });
        }
      }

      this.sound?.playPop();
      if (crazy) {
        this.machineEl?.classList.remove("is-crazy-spinning");
        this.burstSparks();
      }
      if (this.hintEl) {
        this.hintEl.textContent = crazy
          ? "🔥 Kapsul crazy mendarat! Lihat plot twist-nya di bawah!"
          : "Kapsul jatuh! Cek hasil pilihanmu di bawah.";
      }

      this.isSpinning = false;
      if (this.spinBtn) this.spinBtn.disabled = false;

      if (typeof onComplete === "function") {
        onComplete(chosenOption, chosenIndex, crazy);
      }
    };

    if (this.knobEl && typeof anime !== "undefined") {
      anime({
        targets: this.knobEl,
        rotate: crazy ? 1800 : 360,
        scale: crazy ? [1, 1.28, 0.92, 1.16, 1] : [1, 1, 1],
        duration: crazy ? 1850 : 580,
        easing: crazy ? "easeInOutExpo" : "easeInOutCubic",
        complete: () => {
          this.knobEl.style.transform = "rotate(0deg)";
          finishSpin();
        }
      });
    } else {
      setTimeout(finishSpin, crazy ? 1850 : 550);
    }
  }
}