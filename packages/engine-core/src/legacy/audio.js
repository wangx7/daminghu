// 沉浸式程序化环境与载具音效引擎（纯 Web Audio API，零外部音频体积！）
// 包含：柔和湖畔微风波声、跑车实时引擎声、直升机旋翼声、古筝打卡琶音、拍照快门、喂鱼水花声
export class SoundEngine {
  constructor() {
    this.ctx = null;
    this.enabled = true;
    this.started = false;
    this.master = null;
    this.engineOsc = null;
    this.engineGain = null;
    this.heliOsc = null;
    this.heliLfo = null;
    this.heliGain = null;
    this.windGain = null;
  }

  // 首次用户点击或按键时解锁音频上下文
  unlock() {
    if (this.started) {
      if (this.ctx && this.ctx.state === 'suspended') this.ctx.resume();
      return;
    }
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      this.ctx = new AC();
      this.master = this.ctx.createGain();
      this.master.gain.value = this.enabled ? 0.45 : 0;
      this.master.connect(this.ctx.destination);

      // 1. 柔和湖风微浪白噪（低通滤波）
      const bufLen = this.ctx.sampleRate * 2;
      const buf = this.ctx.createBuffer(1, bufLen, this.ctx.sampleRate);
      const data = buf.getChannelData(0);
      let last = 0;
      for (let i = 0; i < bufLen; i++) {
        const white = Math.random() * 2 - 1;
        data[i] = (last + 0.03 * white) / 1.03;
        last = data[i];
      }
      const noise = this.ctx.createBufferSource();
      noise.buffer = buf;
      noise.loop = true;
      const lp = this.ctx.createBiquadFilter();
      lp.type = 'lowpass';
      lp.frequency.value = 380;
      this.windGain = this.ctx.createGain();
      this.windGain.gain.value = 0.09;
      noise.connect(lp);
      lp.connect(this.windGain);
      this.windGain.connect(this.master);
      noise.start();

      // 2. 跑车引擎声（低通锯齿波，音调随速度实时变化）
      this.engineOsc = this.ctx.createOscillator();
      this.engineOsc.type = 'sawtooth';
      this.engineOsc.frequency.value = 55;
      const engFilter = this.ctx.createBiquadFilter();
      engFilter.type = 'lowpass';
      engFilter.frequency.value = 260;
      this.engineGain = this.ctx.createGain();
      this.engineGain.gain.value = 0;
      this.engineOsc.connect(engFilter);
      engFilter.connect(this.engineGain);
      this.engineGain.connect(this.master);
      this.engineOsc.start();

      // 3. 直升机旋翼呼呼声（低频振荡 + LFO 脉冲调制 + 独立输出门控防止待机底噪泄露）
      this.heliOsc = this.ctx.createOscillator();
      this.heliOsc.type = 'triangle';
      this.heliOsc.frequency.value = 46;
      this.heliGain = this.ctx.createGain();
      this.heliGain.gain.value = 0.5;
      this.heliLfo = this.ctx.createOscillator();
      this.heliLfo.frequency.value = 11;
      const lfoGain = this.ctx.createGain();
      lfoGain.gain.value = 0.35;
      this.heliLfo.connect(lfoGain);
      lfoGain.connect(this.heliGain.gain);
      this.heliOutGain = this.ctx.createGain();
      this.heliOutGain.gain.value = 0;
      this.heliOsc.connect(this.heliGain);
      this.heliGain.connect(this.heliOutGain);
      this.heliOutGain.connect(this.master);
      this.heliOsc.start();
      this.heliLfo.start();

      this.started = true;
    } catch (_) {}
  }

  toggleMute() {
    this.enabled = !this.enabled;
    if (this.master && this.ctx) {
      this.master.gain.setTargetAtTime(this.enabled ? 0.45 : 0, this.ctx.currentTime, 0.06);
    }
    return this.enabled;
  }

  // 景点打卡清脆古筝五声琶音
  playChime() {
    if (!this.enabled || !this.ctx) return;
    const notes = [523.25, 659.25, 783.99, 1046.5];
    const now = this.ctx.currentTime;
    notes.forEach((f, idx) => {
      const osc = this.ctx.createOscillator();
      const g = this.ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(f, now + idx * 0.08);
      g.gain.setValueAtTime(0.001, now + idx * 0.08);
      g.gain.exponentialRampToValueAtTime(0.14, now + idx * 0.08 + 0.02);
      g.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.08 + 0.65);
      osc.connect(g);
      g.connect(this.master);
      osc.start(now + idx * 0.08);
      osc.stop(now + idx * 0.08 + 0.7);
    });
  }

  // 拍照快门清脆声
  playShutter() {
    if (!this.enabled || !this.ctx) return;
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    osc.type = 'square';
    osc.frequency.setValueAtTime(920, now);
    osc.frequency.exponentialRampToValueAtTime(180, now + 0.06);
    g.gain.setValueAtTime(0.16, now);
    g.gain.exponentialRampToValueAtTime(0.001, now + 0.08);
    osc.connect(g);
    g.connect(this.master);
    osc.start(now);
    osc.stop(now + 0.09);
  }

  // 撒鱼食落水叮咚声
  playSplash() {
    if (!this.enabled || !this.ctx) return;
    const now = this.ctx.currentTime;
    [340, 480].forEach((f, i) => {
      const osc = this.ctx.createOscillator();
      const g = this.ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(f, now + i * 0.09);
      osc.frequency.exponentialRampToValueAtTime(f * 1.45, now + i * 0.09 + 0.12);
      g.gain.setValueAtTime(0.12, now + i * 0.09);
      g.gain.exponentialRampToValueAtTime(0.001, now + i * 0.09 + 0.16);
      osc.connect(g);
      g.connect(this.master);
      osc.start(now + i * 0.09);
      osc.stop(now + i * 0.09 + 0.18);
    });
  }

  update(player) {
    if (!this.started || !this.ctx || !this.enabled) return;
    const now = this.ctx.currentTime;
    // 跑车引擎随速度变调
    if (player.inCar) {
      const freq = 52 + player.speed * 3.6;
      this.engineOsc.frequency.setTargetAtTime(freq, now, 0.06);
      this.engineGain.gain.setTargetAtTime(0.11 + Math.min(0.12, player.speed * 0.004), now, 0.08);
    } else {
      this.engineGain.gain.setTargetAtTime(0, now, 0.08);
    }
    // 直升机旋翼随速度加快频率（通过独立门控节点彻底静音待机状态）
    if (player.inHeli) {
      this.heliLfo.frequency.setTargetAtTime(10 + player.speed * 0.14, now, 0.08);
      this.heliOutGain.gain.setTargetAtTime(0.28, now, 0.1);
    } else {
      this.heliOutGain.gain.setTargetAtTime(0, now, 0.1);
    }
    // 湖风底噪在高空微增
    const windVol = player.pos.y > 20 ? 0.16 : 0.08;
    this.windGain.gain.setTargetAtTime(windVol, now, 0.2);
  }
}
