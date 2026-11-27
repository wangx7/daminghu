import type { BgmScene } from '@daminghu/shared';
import { createBrowserPlatformAdapter, type PlatformAdapter } from './platformAdapter';

interface NoteStep {
  melody?: number; // Hz
  pluck?: number;  // 古筝/琵琶伴奏 Hz
  drum?: 'low' | 'wood';
  dur?: number;
}

// D 大调五声音阶 (D4, E4, F#4, A4, B4, D5, E5, F#5, A5, B5, D6) —— 经典国风仙侠/梦幻西游明快调式
const N = {
  D3: 146.83, A3: 220.0, B3: 246.94,
  D4: 293.66, E4: 329.63, Fs4: 369.99, A4: 440.0, B4: 493.88,
  D5: 587.33, E5: 659.25, Fs5: 739.99, A5: 880.0, B5: 987.77,
};

const PATTERNS: Record<BgmScene, { bpm: number; steps: NoteStep[] }> = {
  // 白昼漫游：建邺城 / 江南野外同款轻快五声古筝 + 竹笛
  day: {
    bpm: 118,
    steps: [
      { melody: N.A4, pluck: N.D4, drum: 'wood' },
      { pluck: N.A4 },
      { melody: N.B4, pluck: N.D5 },
      { melody: N.D5, pluck: N.A4 },
      { melody: N.E5, pluck: N.Fs4, drum: 'wood' },
      { pluck: N.D5 },
      { melody: N.D5, pluck: N.A4 },
      { melody: N.B4, pluck: N.Fs4 },
      { melody: N.A4, pluck: N.E4, drum: 'wood' },
      { melody: N.Fs4, pluck: N.B4 },
      { melody: N.E4, pluck: N.A4 },
      { melody: N.Fs4, pluck: N.E4 },
      { melody: N.A4, pluck: N.D4, drum: 'low' },
      { pluck: N.Fs4 },
      { melody: N.D4, pluck: N.A4 },
      { pluck: N.D5 },
      { melody: N.Fs5, pluck: N.D4, drum: 'wood' },
      { melody: N.E5, pluck: N.A4 },
      { melody: N.D5, pluck: N.Fs5 },
      { melody: N.B4, pluck: N.D5 },
      { melody: N.A4, pluck: N.B3, drum: 'wood' },
      { melody: N.B4, pluck: N.Fs4 },
      { melody: N.D5, pluck: N.A4 },
      { melody: N.E5, pluck: N.B4 },
      { melody: N.D5, pluck: N.A3, drum: 'low' },
      { melody: N.B4, pluck: N.E4 },
      { melody: N.A4, pluck: N.A4 },
      { melody: N.Fs4, pluck: N.E4 },
      { melody: N.E4, pluck: N.D4, drum: 'wood' },
      { melody: N.Fs4, pluck: N.A4 },
      { melody: N.D4, pluck: N.D5 },
      { pluck: N.A4 },
    ],
  },
  // 超然夜色 / 明湖秀：悠扬雅致古琴 + 箫
  night: {
    bpm: 78,
    steps: [
      { melody: N.A4, pluck: N.D3 },
      { pluck: N.A3 },
      { melody: N.Fs4, pluck: N.D4 },
      { pluck: N.Fs4 },
      { melody: N.E4, pluck: N.B3 },
      { pluck: N.Fs4 },
      { melody: N.D4, pluck: N.A3 },
      {},
      { melody: N.B4, pluck: N.E4 },
      { pluck: N.B4 },
      { melody: N.A4, pluck: N.D4 },
      { melody: N.Fs4 },
      { melody: N.E4, pluck: N.A3 },
      { pluck: N.E4 },
      { melody: N.D4, pluck: N.D3 },
      { pluck: N.A3 },
    ],
  },
  // 局域网 / 练习对战：紧凑堂鼓 + 琵琶 + 高音笛
  battle: {
    bpm: 146,
    steps: [
      { melody: N.D5, pluck: N.D4, drum: 'low' },
      { pluck: N.A4, drum: 'wood' },
      { melody: N.E5, pluck: N.D4, drum: 'low' },
      { melody: N.Fs5, pluck: N.A4 },
      { melody: N.A5, pluck: N.E4, drum: 'low' },
      { melody: N.Fs5, pluck: N.B4, drum: 'wood' },
      { melody: N.E5, pluck: N.A4, drum: 'low' },
      { melody: N.D5, pluck: N.E4 },
      { melody: N.B4, pluck: N.B3, drum: 'low' },
      { melody: N.D5, pluck: N.Fs4, drum: 'wood' },
      { melody: N.E5, pluck: N.A4, drum: 'low' },
      { melody: N.D5, pluck: N.B4 },
      { melody: N.A4, pluck: N.D4, drum: 'low' },
      { melody: N.B4, pluck: N.A4, drum: 'wood' },
      { melody: N.D5, pluck: N.Fs4, drum: 'low' },
      { pluck: N.A4, drum: 'wood' },
    ],
  },
  // 结婚 / 结义仪式：喜庆明亮礼乐
  ceremony: {
    bpm: 128,
    steps: [
      { melody: N.D5, pluck: N.D4, drum: 'low' },
      { melody: N.E5, pluck: N.A4 },
      { melody: N.Fs5, pluck: N.D5, drum: 'wood' },
      { melody: N.A5, pluck: N.Fs5 },
      { melody: N.B5, pluck: N.E4, drum: 'low' },
      { melody: N.A5, pluck: N.B4 },
      { melody: N.Fs5, pluck: N.D5, drum: 'wood' },
      { melody: N.E5, pluck: N.A4 },
    ],
  },
};

/**
 * 梦幻西游风五声音阶动态 BGM + 战斗/UI 音效引擎
 * 支持程序化五声音阶合成（零体积立即可播）与外部 MP3/OGG URL 扩展
 */
export class GuofengBgmEngine {
  private ctx: AudioContext | null = null;
  private bgmGain: GainNode | null = null;
  private sfxGain: GainNode | null = null;
  private timer: number | null = null;
  private stepIdx = 0;

  public scene: BgmScene = 'day';
  public bgmEnabled = true;
  public sfxEnabled = true;
  public bgmVolume = 0.26;
  public sfxVolume = 0.42;

  private unlocked = false;
  private platform: PlatformAdapter;
  private unbindVisibility: () => void;

  constructor(platform: PlatformAdapter = createBrowserPlatformAdapter()) {
    this.platform = platform;
    this.unbindVisibility = this.platform.onVisibilityChange((hidden) => {
      if (!this.ctx) return;
      if (hidden) {
        this.ctx.suspend().catch(() => {});
      } else if (this.bgmEnabled || this.sfxEnabled) {
        this.ctx.resume().catch(() => {});
      }
    });
  }

  getAudioContext(): AudioContext | null {
    return this.ctx;
  }

  unlock(): AudioContext | null {
    if (this.unlocked) {
      if (this.ctx?.state === 'suspended') {
        this.ctx.resume().catch(() => {});
      }
      return this.ctx;
    }
    const ctx = this.platform.createAudioContext();
    if (!ctx) return null;

    this.ctx = ctx;
    this.bgmGain = this.ctx.createGain();
    this.bgmGain.gain.value = this.bgmEnabled ? this.bgmVolume : 0;
    this.bgmGain.connect(this.ctx.destination);

    this.sfxGain = this.ctx.createGain();
    this.sfxGain.gain.value = this.sfxEnabled ? this.sfxVolume : 0;
    this.sfxGain.connect(this.ctx.destination);

    this.unlocked = true;
    this.startLoop();
    return this.ctx;
  }

  setScene(next: BgmScene) {
    if (this.scene === next) return;
    this.scene = next;
    this.stepIdx = 0;
    if (this.unlocked) {
      this.startLoop();
    }
  }

  toggleBgm(): boolean {
    this.bgmEnabled = !this.bgmEnabled;
    if (this.bgmGain && this.ctx) {
      this.bgmGain.gain.setTargetAtTime(this.bgmEnabled ? this.bgmVolume : 0, this.ctx.currentTime, 0.08);
    }
    return this.bgmEnabled;
  }

  toggleSfx(): boolean {
    this.sfxEnabled = !this.sfxEnabled;
    if (this.sfxGain && this.ctx) {
      this.sfxGain.gain.setTargetAtTime(this.sfxEnabled ? this.sfxVolume : 0, this.ctx.currentTime, 0.05);
    }
    return this.sfxEnabled;
  }

  setBgmVolume(vol: number) {
    this.bgmVolume = Math.max(0, Math.min(1, vol));
    if (this.bgmGain && this.ctx && this.bgmEnabled) {
      this.bgmGain.gain.setTargetAtTime(this.bgmVolume, this.ctx.currentTime, 0.05);
    }
  }

  private startLoop() {
    if (this.timer !== null) {
      this.platform.clearInterval(this.timer);
      this.timer = null;
    }
    const pattern = PATTERNS[this.scene];
    const stepMs = Math.round((60 / pattern.bpm) * 500); // 八分音符步进
    this.timer = this.platform.setInterval(() => {
      if (!this.ctx || !this.bgmGain || !this.bgmEnabled || this.platform.isHidden()) return;
      const step = pattern.steps[this.stepIdx % pattern.steps.length];
      this.stepIdx++;
      const now = this.ctx.currentTime;
      if (step.pluck) this.playGuzheng(step.pluck, now);
      if (step.melody) this.playFlute(step.melody, now, stepMs / 1000);
      if (step.drum) this.playDrum(step.drum, now);
    }, stepMs);
  }

  // 古筝/琵琶拨弦音色
  private playGuzheng(freq: number, now: number) {
    if (!this.ctx || !this.bgmGain) return;
    const osc = this.ctx.createOscillator();
    const filter = this.ctx.createBiquadFilter();
    const gain = this.ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(freq, now);
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(2400, now);
    filter.frequency.exponentialRampToValueAtTime(520, now + 0.55);

    gain.gain.setValueAtTime(0.001, now);
    gain.gain.linearRampToValueAtTime(0.24, now + 0.012);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.72);

    osc.connect(filter);
    filter.connect(gain);
    gain.connect(this.bgmGain);
    osc.start(now);
    osc.stop(now + 0.75);
  }

  // 竹笛/箫主旋律音色（柔和正弦 + 轻颤音）
  private playFlute(freq: number, now: number, durSec: number) {
    if (!this.ctx || !this.bgmGain) return;
    const osc = this.ctx.createOscillator();
    const lfo = this.ctx.createOscillator();
    const lfoGain = this.ctx.createGain();
    const gain = this.ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(freq, now);
    lfo.frequency.value = 5.2;
    lfoGain.gain.value = freq * 0.008;
    lfo.connect(lfoGain);
    lfoGain.connect(osc.frequency);

    const len = Math.max(0.22, durSec * 1.45);
    gain.gain.setValueAtTime(0.001, now);
    gain.gain.linearRampToValueAtTime(0.18, now + 0.045);
    gain.gain.exponentialRampToValueAtTime(0.001, now + len);

    osc.connect(gain);
    gain.connect(this.bgmGain);
    osc.start(now);
    lfo.start(now);
    osc.stop(now + len + 0.03);
    lfo.stop(now + len + 0.03);
  }

  // 木鱼 / 堂鼓节奏
  private playDrum(kind: 'low' | 'wood', now: number) {
    if (!this.ctx || !this.bgmGain) return;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = kind === 'low' ? 'sine' : 'triangle';
    if (kind === 'low') {
      osc.frequency.setValueAtTime(125, now);
      osc.frequency.exponentialRampToValueAtTime(48, now + 0.16);
      gain.gain.setValueAtTime(0.22, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.18);
    } else {
      osc.frequency.setValueAtTime(680, now);
      osc.frequency.exponentialRampToValueAtTime(420, now + 0.05);
      gain.gain.setValueAtTime(0.11, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.06);
    }
    osc.connect(gain);
    gain.connect(this.bgmGain);
    osc.start(now);
    osc.stop(now + 0.2);
  }

  playWeaponFire(kind: 'spring_blaster' | 'lotus_mortar' | 'quehua_bow') {
    if (!this.ctx || !this.sfxGain || !this.sfxEnabled) return;
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    if (kind === 'spring_blaster') {
      osc.type = 'sine';
      osc.frequency.setValueAtTime(640, now);
      osc.frequency.exponentialRampToValueAtTime(220, now + 0.09);
      g.gain.setValueAtTime(0.2, now);
      g.gain.exponentialRampToValueAtTime(0.001, now + 0.1);
    } else if (kind === 'lotus_mortar') {
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(210, now);
      osc.frequency.exponentialRampToValueAtTime(75, now + 0.22);
      g.gain.setValueAtTime(0.28, now);
      g.gain.exponentialRampToValueAtTime(0.001, now + 0.24);
    } else {
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(980, now);
      osc.frequency.exponentialRampToValueAtTime(360, now + 0.14);
      g.gain.setValueAtTime(0.16, now);
      g.gain.exponentialRampToValueAtTime(0.001, now + 0.15);
    }
    osc.connect(g);
    g.connect(this.sfxGain);
    osc.start(now);
    osc.stop(now + 0.26);
  }

  playHit(eliminated = false) {
    if (!this.ctx || !this.sfxGain || !this.sfxEnabled) return;
    const now = this.ctx.currentTime;
    const freqs = eliminated ? [587.33, 880, 1174.66] : [520];
    freqs.forEach((f, idx) => {
      if (!this.ctx || !this.sfxGain) return;
      const osc = this.ctx.createOscillator();
      const g = this.ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(f, now + idx * 0.055);
      g.gain.setValueAtTime(0.22, now + idx * 0.055);
      g.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.055 + 0.22);
      osc.connect(g);
      g.connect(this.sfxGain);
      osc.start(now + idx * 0.055);
      osc.stop(now + idx * 0.055 + 0.24);
    });
  }

  playPlayerHurt() {
    if (!this.ctx || !this.sfxGain || !this.sfxEnabled) return;
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(165, now);
    osc.frequency.exponentialRampToValueAtTime(68, now + 0.14);
    g.gain.setValueAtTime(0.2, now);
    g.gain.exponentialRampToValueAtTime(0.001, now + 0.16);
    osc.connect(g);
    g.connect(this.sfxGain);
    osc.start(now);
    osc.stop(now + 0.18);
  }

  playUiClick() {
    if (!this.ctx || !this.sfxGain || !this.sfxEnabled) return;
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(740, now);
    osc.frequency.exponentialRampToValueAtTime(980, now + 0.04);
    g.gain.setValueAtTime(0.09, now);
    g.gain.exponentialRampToValueAtTime(0.001, now + 0.05);
    osc.connect(g);
    g.connect(this.sfxGain);
    osc.start(now);
    osc.stop(now + 0.06);
  }

  dispose() {
    if (this.timer !== null) {
      this.platform.clearInterval(this.timer);
      this.timer = null;
    }
    this.unbindVisibility();
    this.ctx?.close().catch(() => {});
    this.ctx = null;
  }
}
