// HUD 交互系统：1:1 真实 OpenStreetMap 轮廓小地图（含水体、14 座岛屿、63 栋真实建筑轮廓、全部主路与观光车）
import { WORLD, WATER_POLYS, ISLAND_POLYS, ROAD_LINES, BUILDING_POLYS, LANDMARKS, onLandmarksChanged } from './map_data.js';
import { DISTRICTS } from './districts/index.js';

export class GameHUD {
  constructor({
    onTeleport, onCycleTime, onCycleSeason, onToggleShow,
    onTriggerChaoranLight, isChaoranLit, onToggleHeli, onToggleCar, onToggleBus, onTriggerEAction,
    onPhoto, onDirector, onFeedFish, onToggleAudio, onVisitLandmark,
  }) {
    this.onTeleport = onTeleport;
    this.onCycleTime = onCycleTime;
    this.onCycleSeason = onCycleSeason;
    this.onToggleShow = onToggleShow;
    this.onTriggerChaoranLight = onTriggerChaoranLight;
    this.isChaoranLit = isChaoranLit;
    this.onToggleHeli = onToggleHeli;
    this.onToggleCar = onToggleCar;
    this.onToggleBus = onToggleBus;
    this.onTriggerEAction = onTriggerEAction;
    this.onPhoto = onPhoto;
    this.onDirector = onDirector;
    this.onFeedFish = onFeedFish;
    this.onToggleAudio = onToggleAudio;
    this.onVisitLandmark = onVisitLandmark;
    this._nearBus = false;
    this._miniBg = null;
    this._miniBgVisitedCount = -1;

    this.miniCanvas = document.getElementById('minimap');
    this.miniCtx = this.miniCanvas.getContext('2d');
    this.coordEl = document.getElementById('coord-text');
    this.stampEl = document.getElementById('stamp-count');
    this.timeBtn = document.getElementById('btn-time');
    this.seasonBtn = document.getElementById('btn-season');
    this.showBtn = document.getElementById('btn-show');
    this.lightBtn = document.getElementById('btn-light');
    this.heliBtn = document.getElementById('btn-heli');
    this.carBtn = document.getElementById('btn-car');
    this.busBtn = document.getElementById('btn-bus');
    this.photoBtn = document.getElementById('btn-photo');
    this.directorBtn = document.getElementById('btn-director');
    this.feedBtn = document.getElementById('btn-feed');
    this.audioBtn = document.getElementById('btn-audio');
    this.boatBanner = document.getElementById('boat-banner');
    this.toastEl = document.getElementById('landmark-toast');
    this.countdownEl = document.getElementById('countdown-overlay');
    this.tpListEl = document.getElementById('tp-list');
    this.gaugeEl = document.getElementById('speed-gauge');
    this.gaugeArcEl = document.getElementById('gauge-arc');
    this.gaugeSpeedEl = document.getElementById('gauge-speed');
    this.gaugeAltEl = document.getElementById('gauge-alt');
    this.nitroWrapEl = document.getElementById('nitro-wrap');
    this.nitroFillEl = document.getElementById('nitro-fill');

    this.visited = new Set();
    this._celebratedAll = false;
    this.tpBtns = new Map();
    this.activeLandmarkId = null;
    this.toastTimer = 0;

    this._initButtons();
    this._initMinimapClick();
  }

  _renderTeleportList() {
    this.tpListEl.innerHTML = '';
    this.tpBtns.clear();

    const groups = [];
    const gates = LANDMARKS.filter((lm) => lm.isGate);
    const damingCore = LANDMARKS.filter((lm) => !lm.isGate && (!lm.district || lm.district === 'daming'));
    if (gates.length) groups.push({ title: '入口大门', items: gates });
    if (damingCore.length) groups.push({ title: '大明湖景区', items: damingCore });

    // 动态注册的扩展片区地标自动分组
    const extraByDist = new Map();
    for (const lm of LANDMARKS) {
      if (lm.district && lm.district !== 'daming') {
        const key = lm.districtName || lm.district;
        if (!extraByDist.has(key)) extraByDist.set(key, []);
        extraByDist.get(key).push(lm);
      }
    }
    for (const [title, items] of extraByDist) {
      groups.push({ title, items });
    }

    for (const grp of groups) {
      const hdr = document.createElement('div');
      hdr.className = 'tp-group-title';
      hdr.textContent = `${grp.title} (${grp.items.length})`;
      this.tpListEl.appendChild(hdr);
      for (const lm of grp.items) {
        const btn = document.createElement('button');
        btn.className = 'tp-btn' + (this.visited.has(lm.id) ? ' visited' : '');
        btn.innerHTML = `<span>${lm.name}</span><small>${lm.tag}</small>`;
        btn.onclick = () => {
          this.onTeleport(lm.spawnX, lm.spawnZ, lm.spawnYaw, lm);
          this.markVisited(lm);
        };
        this.tpListEl.appendChild(btn);
        this.tpBtns.set(lm.id, btn);
      }
    }

    // 后续泉城扩展片区预告（待片区 status === 'ready' 后自动转为上方真实可传送分组）
    const planned = DISTRICTS.filter((d) => d.status !== 'ready');
    if (planned.length) {
      const hdr = document.createElement('div');
      hdr.className = 'tp-group-title';
      hdr.textContent = '泉城扩展片区（规划中）';
      this.tpListEl.appendChild(hdr);
      for (const d of planned) {
        const chip = document.createElement('div');
        chip.className = 'tp-btn tp-planned';
        chip.innerHTML = `<span>${d.name}</span><small>${d.tag}</small>`;
        this.tpListEl.appendChild(chip);
      }
    }
  }

  _initButtons() {
    this._renderTeleportList();
    onLandmarksChanged(() => {
      this._renderTeleportList();
      this._miniBgVisitedCount = -1;
    });

    const setBtnLabel = (btn, text) => {
      const lbl = btn?.querySelector('.lbl');
      if (lbl) lbl.textContent = text;
    };

    this.timeBtn.onclick = () => {
      const label = this.onCycleTime().replace(/^[^\u4e00-\u9fa5]+/, '');
      setBtnLabel(this.timeBtn, label);
    };
    this.seasonBtn.onclick = () => {
      const label = this.onCycleSeason().replace(/^[^\u4e00-\u9fa5]+/, '');
      setBtnLabel(this.seasonBtn, label);
    };
    this.showBtn.onclick = () => {
      const active = this.onToggleShow();
      this.showBtn.classList.toggle('active', active);
      setBtnLabel(this.showBtn, active ? '演艺中' : '明湖秀');
    };
    this.heliBtn.onclick = () => this.onToggleHeli();
    this.carBtn.onclick = () => this.onToggleCar();
    this.busBtn.onclick = () => this.onToggleBus();
    this.lightBtn.onclick = () => {
      if (this.isChaoranLit?.()) {
        this.onTriggerChaoranLight(false);
        this.lightBtn.classList.remove('active');
        setBtnLabel(this.lightBtn, '超然亮灯');
      } else {
        this.triggerLightCeremony();
      }
    };
    this.boatBanner.onclick = () => {
      if (this._nearBus) this.onToggleBus();
      else this.onTriggerEAction();
    };
    if (this.photoBtn) this.photoBtn.onclick = () => this.onPhoto?.();
    if (this.directorBtn) this.directorBtn.onclick = () => this.onDirector?.();
    if (this.feedBtn) this.feedBtn.onclick = () => this.onFeedFish?.();
    if (this.audioBtn) {
      this.audioBtn.onclick = () => {
        const enabled = this.onToggleAudio?.();
        this.audioBtn.classList.toggle('muted', enabled === false);
        setBtnLabel(this.audioBtn, enabled === false ? '已静音' : '音效');
      };
    }
  }

  markVisited(lm) {
    const isNew = !this.visited.has(lm.id);
    this.visited.add(lm.id);
    const btn = this.tpBtns.get(lm.id);
    if (btn) btn.classList.add('visited');
    if (this.stampEl) this.stampEl.textContent = `印章 ${this.visited.size}/${LANDMARKS.length}`;
    this.onVisitLandmark?.(lm, isNew);

    if (isNew && this.visited.size === LANDMARKS.length && !this._celebratedAll) {
      this._celebratedAll = true;
      this.showNotice('荣膺「济南名士」', '恭喜集齐大明湖全部 21 处名胜印章！海右此亭古，济南名士多。', 8.0);
      if (this.countdownEl) {
        this.countdownEl.textContent = '济南名士 · 印章全集齐！';
        this.countdownEl.classList.add('show');
        setTimeout(() => this.countdownEl.classList.remove('show'), 2800);
      }
      return;
    }
    this.showLandmarkCard(lm);
  }

  showNotice(title, text, duration = 3.8) {
    this.toastEl.innerHTML = `
      <div class="toast-title">${title} <span>游记</span></div>
      <div class="toast-poem">${text}</div>
    `;
    this.toastEl.classList.add('show');
    this.toastTimer = duration;
  }

  _initMinimapClick() {
    this.miniCanvas.addEventListener('click', (e) => {
      const rect = this.miniCanvas.getBoundingClientRect();
      const u = (e.clientX - rect.left) / rect.width;
      const v = (e.clientY - rect.top) / rect.height;
      const wx = WORLD.MIN_X + u * (WORLD.MAX_X - WORLD.MIN_X);
      const wz = WORLD.MIN_Z + v * (WORLD.MAX_Z - WORLD.MIN_Z);
      this.onTeleport(wx, wz, 0, null);
    });
  }

  // 3-2-1 超然楼亮灯倒计时演出
  triggerLightCeremony() {
    if (this._counting) return;
    this._counting = true;
    const seq = ['3', '2', '1', '✨ 超然楼亮灯！'];
    let i = 0;
    const step = () => {
      this.countdownEl.textContent = seq[i];
      this.countdownEl.classList.add('show');
      if (i === 3) {
        this.onTriggerChaoranLight(true);
        this.lightBtn.classList.add('active');
        const lbl = this.lightBtn.querySelector('.lbl');
        if (lbl) lbl.textContent = '已亮灯';
      }
      i++;
      if (i < seq.length) {
        setTimeout(step, 850);
      } else {
        setTimeout(() => {
          this.countdownEl.classList.remove('show');
          this._counting = false;
        }, 1600);
      }
    };
    step();
  }

  showLandmarkCard(lm) {
    this.toastEl.innerHTML = `
      <div class="toast-title">${lm.name} <span>${lm.tag}</span></div>
      <div class="toast-poem">${lm.poem}</div>
    `;
    this.toastEl.classList.add('show');
    this.toastTimer = 5.5;
  }

  update(dt, player, living) {
    // 实时状态 + 高度 + 坐标
    const hText = player.pos.y > 4 ? ` · 高 ${Math.round(player.pos.y)}m` : '';
    this.coordEl.textContent = `${player.getStatusText()} · 东 ${Math.round(player.pos.x)}m, 南 ${Math.round(player.pos.z)}m${hText}`;

    // 动态交互提示（附近观光车 / 超然楼观光电梯 / 上下船 / 游泳）
    const nearBus = !player.ridingBus && living ? living.findNearbyBus(player.pos.x, player.pos.z, 15) : null;
    this._nearBus = !!nearBus;
    const hint = player.getActionHint();
    if (nearBus) {
      this.boatBanner.textContent = '🚌 观光游览车在身旁！按 F 键上车环游大明湖';
      this.boatBanner.classList.add('ready', 'show');
    } else if (hint.label) {
      this.boatBanner.textContent = hint.label;
      this.boatBanner.classList.toggle('ready', hint.canAct);
      this.boatBanner.classList.add('show');
    } else {
      this.boatBanner.classList.remove('show');
    }

    // 同步载具 Dock 按钮状态与左下角 SVG 弧形速度/海拔仪表盘
    const setLbl = (btn, text) => { const el = btn?.querySelector('.lbl'); if (el) el.textContent = text; };
    this.heliBtn.classList.toggle('active', player.inHeli || player.parachuting);
    setLbl(this.heliBtn, player.inHeli ? '跳伞' : (player.parachuting ? '滑翔中' : '直升机'));
    this.carBtn.classList.toggle('active', player.inCar);
    setLbl(this.carBtn, player.inCar ? '下车' : '敞篷车');
    this.busBtn.classList.toggle('active', !!player.ridingBus);
    setLbl(this.busBtn, player.ridingBus ? '下车' : '观光车');

    const showGauge = player.inHeli || player.parachuting || player.inCar || player.ridingBus;
    this.gaugeEl.classList.toggle('show', showGauge);
    if (showGauge) {
      const kmh = Math.round(player.speed * 3.6);
      this.gaugeSpeedEl.textContent = kmh;
      this.gaugeAltEl.textContent = `ALT ${Math.max(0, Math.round(player.pos.y))}m`;
      if (this.gaugeArcEl) {
        const maxKmh = player.inHeli ? 235 : 140;
        const ratio = Math.min(1, kmh / maxKmh);
        this.gaugeArcEl.style.strokeDashoffset = (144.5 * (1 - ratio)).toFixed(1);
      }
      if (this.nitroWrapEl && this.nitroFillEl) {
        this.nitroWrapEl.classList.toggle('show', player.inCar);
        if (player.inCar) this.nitroFillEl.style.width = `${Math.round(player.nitro)}%`;
      }
    }

    // 自动检测接近景点触发诗词打卡与印章收集
    for (const lm of LANDMARKS) {
      const d = Math.hypot(player.pos.x - lm.x, player.pos.z - lm.z);
      if (d < 48 && this.activeLandmarkId !== lm.id) {
        this.activeLandmarkId = lm.id;
        this.markVisited(lm);
      } else if (d > 68 && this.activeLandmarkId === lm.id) {
        this.activeLandmarkId = null;
      }
    }

    if (this.toastTimer > 0) {
      this.toastTimer -= dt;
      if (this.toastTimer <= 0) this.toastEl.classList.remove('show');
    }

    this._drawMinimap(player, living);
  }

  _ensureMinimapBg() {
    const W = this.miniCanvas.width, H = this.miniCanvas.height;
    if (this._miniBg && this._miniBg.width === W && this._miniBg.height === H && this._miniBgVisitedCount === this.visited.size) {
      return;
    }
    if (!this._miniBg) this._miniBg = document.createElement('canvas');
    this._miniBg.width = W;
    this._miniBg.height = H;
    this._miniBgVisitedCount = this.visited.size;

    const ctx = this._miniBg.getContext('2d');
    const toX = (wx) => ((wx - WORLD.MIN_X) / (WORLD.MAX_X - WORLD.MIN_X)) * W;
    const toY = (wz) => ((wz - WORLD.MIN_Z) / (WORLD.MAX_Z - WORLD.MIN_Z)) * H;

    // 陆地底色
    ctx.fillStyle = '#2d4739';
    ctx.fillRect(0, 0, W, H);

    // 真实 OSM 水体（大明湖主湖 + 小东湖 + 西南水域）
    ctx.fillStyle = '#2a7b9b';
    ctx.strokeStyle = '#c8c0ad';
    ctx.lineWidth = 1;
    for (const poly of WATER_POLYS) {
      ctx.beginPath();
      poly.forEach(([x, z], i) => {
        if (i === 0) ctx.moveTo(toX(x), toY(z));
        else ctx.lineTo(toX(x), toY(z));
      });
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
    }

    // 真实 14 座湖心岛
    ctx.fillStyle = '#4e8a4e';
    for (const poly of ISLAND_POLYS) {
      ctx.beginPath();
      poly.forEach(([x, z], i) => {
        if (i === 0) ctx.moveTo(toX(x), toY(z));
        else ctx.lineTo(toX(x), toY(z));
      });
      ctx.closePath();
      ctx.fill();
    }

    // 真实 OSM 125 栋建筑与庭院基底轮廓
    ctx.fillStyle = 'rgba(229, 193, 123, 0.34)';
    for (const poly of BUILDING_POLYS) {
      ctx.beginPath();
      poly.forEach(([x, z], i) => {
        if (i === 0) ctx.moveTo(toX(x), toY(z));
        else ctx.lineTo(toX(x), toY(z));
      });
      ctx.closePath();
      ctx.fill();
    }

    // 真实园内主干道（曾堤、鹊华路、环湖路、广场）
    ctx.strokeStyle = 'rgba(245, 232, 198, 0.55)';
    ctx.lineWidth = 1.2;
    for (const line of ROAD_LINES) {
      ctx.beginPath();
      line.forEach(([x, z], i) => {
        if (i === 0) ctx.moveTo(toX(x), toY(z));
        else ctx.lineTo(toX(x), toY(z));
      });
      ctx.stroke();
    }

    // 精简地标文字（仅标注 6 个核心方位锚点短名防重叠，其余显示清晰金点！）
    const CORE_LABELS = {
      chaoran: '超然楼',
      lixia: '历下亭',
      southgate: '南门',
      beijige: '北极阁',
      tiegongci: '铁公祠',
      ferris: '摩天轮',
    };
    ctx.font = '10px WK, sans-serif';
    ctx.textAlign = 'center';
    for (const lm of LANDMARKS) {
      const mx = toX(lm.x), my = toY(lm.z);
      if (lm.isGate) {
        // 入口大门使用朱红金框方标，一眼识别全园全部出入口
        ctx.fillStyle = '#c0392b';
        ctx.strokeStyle = '#ffd166';
        ctx.lineWidth = 1.2;
        ctx.fillRect(mx - 3, my - 3, 6, 6);
        ctx.strokeRect(mx - 3, my - 3, 6, 6);
      } else {
        ctx.fillStyle = this.visited.has(lm.id) ? '#34d399' : '#ffd166';
        ctx.beginPath();
        ctx.arc(mx, my, CORE_LABELS[lm.id] ? 3.2 : 2.2, 0, Math.PI * 2);
        ctx.fill();
      }
      if (CORE_LABELS[lm.id]) {
        ctx.fillStyle = '#fff8e7';
        ctx.fillText(CORE_LABELS[lm.id], Math.max(20, Math.min(W - 20, mx)), Math.max(12, my - 6));
      }
    }
  }

  _drawMinimap(player, living) {
    this._ensureMinimapBg();
    const ctx = this.miniCtx;
    const W = this.miniCanvas.width, H = this.miniCanvas.height;
    const toX = (wx) => ((wx - WORLD.MIN_X) / (WORLD.MAX_X - WORLD.MIN_X)) * W;
    const toY = (wz) => ((wz - WORLD.MIN_Z) / (WORLD.MAX_Z - WORLD.MIN_Z)) * H;

    ctx.drawImage(this._miniBg, 0, 0);

    // 实时绘制环湖观光车位置（小蓝方点）与湖中巡航双画舫（明黄游船标）
    if (living) {
      ctx.fillStyle = '#38bdf8';
      for (const b of living.buses) {
        ctx.fillRect(toX(b.x) - 2.5, toY(b.z) - 2.5, 5, 5);
      }
    }
    if (player.cruisesRef) {
      ctx.fillStyle = '#fbbf24';
      for (const c of player.cruisesRef) {
        ctx.beginPath();
        ctx.arc(toX(c.x), toY(c.z), 2.8, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    // 团团当前位置与朝向
    const px = toX(player.pos.x), py = toY(player.pos.z);
    ctx.save();
    ctx.translate(px, py);
    ctx.rotate(-player.yaw + Math.PI);
    ctx.fillStyle = '#ff4b4b';
    ctx.beginPath();
    ctx.moveTo(0, -6);
    ctx.lineTo(4, 5);
    ctx.lineTo(0, 3);
    ctx.lineTo(-4, 5);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 1.2;
    ctx.stroke();
    ctx.restore();
  }
}
