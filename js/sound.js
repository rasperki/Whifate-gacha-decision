export class SoundEngine {
  constructor(enabled = true) {
    this.enabled = Boolean(enabled);
    this.ctx = null;
  }

  setEnabled(enabled) {
    this.enabled = Boolean(enabled);
  }

  ensureContext() {
    if (!this.enabled) return null;
    if (!this.ctx) {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (!AudioCtx) return null;
      this.ctx = new AudioCtx();
    }
    if (this.ctx.state === "suspended") {
      this.ctx.resume().catch(() => {});
    }
    return this.ctx;
  }

  playTone(freq, duration = 0.08, type = "triangle", gainPeak = 0.12, delay = 0) {
    const ctx = this.ensureContext();
    if (!ctx) return;

    const now = ctx.currentTime + delay;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = type;
    osc.frequency.setValueAtTime(freq, now);

    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(gainPeak, now + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start(now);
    osc.stop(now + duration + 0.02);
  }

  playCrank() {
    [240, 290, 340, 390].forEach((freq, idx) => {
      this.playTone(freq, 0.06, "square", 0.06, idx * 0.085);
    });
  }

  playPop() {
    this.playTone(320, 0.07, "sine", 0.14, 0);
    this.playTone(580, 0.14, "triangle", 0.14, 0.065);
  }

  playShuffle() {
    [0, 0.06, 0.12, 0.18].forEach((offset, idx) => {
      this.playTone(210 + idx * 35, 0.045, "triangle", 0.08, offset);
    });
  }

  playCardFlip() {
    this.playTone(440, 0.09, "sine", 0.11, 0);
    this.playTone(660, 0.12, "sine", 0.09, 0.05);
  }

  playCrazy() {
    [320, 480, 640, 820, 980].forEach((freq, idx) => {
      this.playTone(freq, 0.055, "sawtooth", 0.065, idx * 0.055);
    });
  }
}

export class LofiEngine {
  constructor() {
    this.ctx = null;
    this.master = null;
    this.timer = null;
    this.step = 0;
    this.isPlaying = false;
    this.crazyMode = false;
  }

  setCrazyMode(enabled) {
    this.crazyMode = Boolean(enabled);
    if (this.isPlaying) {
      window.clearInterval(this.timer);
      this.timer = window.setInterval(() => this.playStep(), this.crazyMode ? 285 : 500);
    }
  }

  async start() {
    if (this.isPlaying) return;
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtx) return false;

    if (!this.ctx) {
      this.ctx = new AudioCtx();
      this.master = this.ctx.createGain();
      this.master.gain.value = 0.65;
      this.master.connect(this.ctx.destination);
    }

    await this.ctx.resume();
    this.isPlaying = true;
    this.step = 0;
    this.playStep();
    this.timer = window.setInterval(() => this.playStep(), this.crazyMode ? 285 : 500);
    return true;
  }

  stop() {
    this.isPlaying = false;
    if (this.timer) {
      window.clearInterval(this.timer);
      this.timer = null;
    }
  }

  playStep() {
    if (!this.ctx || !this.master) return;
    const now = this.ctx.currentTime;
    const normalChords = [
      [261.63, 311.13, 392.00, 466.16],
      [220.00, 261.63, 329.63, 392.00],
      [174.61, 220.00, 261.63, 349.23],
      [196.00, 246.94, 293.66, 392.00]
    ];
    const crazyChords = [
      [293.66, 369.99, 440.00, 554.37],
      [246.94, 311.13, 392.00, 493.88],
      [329.63, 415.30, 493.88, 622.25],
      [220.00, 277.18, 349.23, 440.00]
    ];
    const chords = this.crazyMode ? crazyChords : normalChords;
    const chord = chords[Math.floor(this.step / (this.crazyMode ? 4 : 8)) % chords.length];

    if (this.step % 2 === 0) {
      const bass = chord[0] / 2;
      this.playTone(bass, this.crazyMode ? 0.32 : 0.55, "sine", this.crazyMode ? 0.16 : 0.13, now);
    }

    if (this.step % (this.crazyMode ? 2 : 4) === 0) {
      this.playSoftChord(chord, now);
    }

    if (this.step % (this.crazyMode ? 2 : 4) === (this.crazyMode ? 1 : 2)) {
      const noteIndex = Math.floor(this.step / (this.crazyMode ? 2 : 2)) % chord.length;
      this.playTone(chord[noteIndex] * (this.crazyMode && this.step % 4 === 3 ? 2 : 1), 0.28, this.crazyMode ? "sawtooth" : "triangle", this.crazyMode ? 0.06 : 0.075, now);
    }

    if (this.crazyMode ? this.step % 4 === 0 || this.step % 4 === 3 : this.step % 8 === 0 || this.step % 8 === 5) {
      this.playKick(now, this.crazyMode);
    }

    this.playNoise(now, this.step % 8 === 2 || this.step % 8 === 6 ? 0.022 : 0.012);
    this.step += 1;
  }

  playTone(freq, duration, type, peak, startTime) {
    const oscillator = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    const filter = this.ctx.createBiquadFilter();

    oscillator.type = type;
    oscillator.frequency.setValueAtTime(freq, startTime);
    filter.type = "lowpass";
    filter.frequency.value = 1800;

    gain.gain.setValueAtTime(0.0001, startTime);
    gain.gain.exponentialRampToValueAtTime(peak, startTime + 0.025);
    gain.gain.exponentialRampToValueAtTime(0.0001, startTime + duration);

    oscillator.connect(filter);
    filter.connect(gain);
    gain.connect(this.master);
    oscillator.start(startTime);
    oscillator.stop(startTime + duration + 0.03);
  }

  playSoftChord(frequencies, startTime) {
    frequencies.forEach((freq, index) => {
      this.playTone(freq, 1.15, index % 2 ? "triangle" : "sine", 0.055, startTime + index * 0.012);
    });
  }

  playKick(startTime, crazy = false) {
    const oscillator = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    oscillator.type = "sine";
    oscillator.frequency.setValueAtTime(crazy ? 170 : 120, startTime);
    oscillator.frequency.exponentialRampToValueAtTime(crazy ? 65 : 48, startTime + 0.12);
    gain.gain.setValueAtTime(crazy ? 0.2 : 0.16, startTime);
    gain.gain.exponentialRampToValueAtTime(0.0001, startTime + 0.14);
    oscillator.connect(gain);
    gain.connect(this.master);
    oscillator.start(startTime);
    oscillator.stop(startTime + 0.15);
  }

  playNoise(startTime, peak) {
    const bufferSize = Math.floor(this.ctx.sampleRate * 0.025);
    const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i += 1) data[i] = Math.random() * 2 - 1;

    const source = this.ctx.createBufferSource();
    const filter = this.ctx.createBiquadFilter();
    const gain = this.ctx.createGain();
    source.buffer = buffer;
    filter.type = "highpass";
    filter.frequency.value = 3800;
    gain.gain.setValueAtTime(peak, startTime);
    gain.gain.exponentialRampToValueAtTime(0.0001, startTime + 0.025);
    source.connect(filter);
    filter.connect(gain);
    gain.connect(this.master);
    source.start(startTime);
  }
}