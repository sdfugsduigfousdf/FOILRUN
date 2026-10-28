export class RaceAudio {
  private ctx: AudioContext | null = null;
  private osc: OscillatorNode | null = null;
  private gain: GainNode | null = null;

  unlock() {
    if (typeof AudioContext === "undefined") return;
    if (!this.ctx) {
      const ctx = new AudioContext();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      const filter = ctx.createBiquadFilter();
      osc.type = "sawtooth";
      osc.frequency.value = 46;
      filter.type = "lowpass";
      filter.frequency.value = 420;
      gain.gain.value = 0.0001;
      osc.connect(filter);
      filter.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      this.ctx = ctx;
      this.osc = osc;
      this.gain = gain;
    }
    if (this.ctx.state === "suspended") void this.ctx.resume();
  }

  setSpeed(speed: number) {
    if (!this.ctx || !this.osc || !this.gain) return;
    const now = this.ctx.currentTime;
    this.osc.frequency.setTargetAtTime(46 + Math.min(320, Math.abs(speed) * 2.2), now, 0.06);
    this.gain.gain.setTargetAtTime(Math.min(0.045, 0.008 + Math.abs(speed) * 0.00045), now, 0.08);
  }

  sting(good: boolean) {
    if (!this.ctx) return;
    const ctx = this.ctx;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = good ? "triangle" : "square";
    osc.frequency.value = good ? 520 : 90;
    gain.gain.value = 0.0001;
    osc.connect(gain);
    gain.connect(ctx.destination);
    const now = ctx.currentTime;
    gain.gain.setValueAtTime(good ? 0.06 : 0.05, now);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + (good ? 0.28 : 0.4));
    if (good) osc.frequency.setValueAtTime(740, now + 0.09);
    osc.start(now);
    osc.stop(now + 0.45);
  }

  stop() {
    try {
      this.osc?.stop();
    } catch {
      /* already stopped */
    }
    void this.ctx?.close();
    this.ctx = null;
    this.osc = null;
    this.gain = null;
  }
}
