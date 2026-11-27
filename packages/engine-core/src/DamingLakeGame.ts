import * as THREE from 'three';
import {
  SKIN_MAP,
  type BgmScene,
  type EquippedWeaponId,
  type GameMode,
  type HudSnapshot,
  type KillFeedItem,
  type LandmarkSummary,
  type SeasonKey,
  type SkinId,
  type VehicleMode,
} from '@daminghu/shared';
import { GuofengBgmEngine } from './bgmEngine';
import { CombatSystem } from './combatSystem';
import { renderDamingMinimap } from './minimapRenderer';
import { applySkinToPlayer } from './skinRenderer';

import { WorldCollider } from './legacy/collider.js';
import { ChunkWorld, SEASON_PALETTES } from './legacy/world.js';
import { createLakeWater } from './legacy/water.js';
import { DistrictManager } from './legacy/districts/index.js';
import { LivingWorld } from './legacy/living.js';
import { TuanPlayer } from './legacy/player.js';
import { SkyAndLighting } from './legacy/sky.js';
import { SeasonWeather } from './legacy/seasons.js';
import { MinghuShow, MINGHU_SHOW_VIEW } from './legacy/show.js';
import { SoundEngine } from './legacy/audio.js';
import { DirectorMode } from './legacy/director.js';
import { capturePostcard } from './legacy/postcard.js';
import { LANDMARKS } from './legacy/map_data.js';

export interface GameCallbacks {
  onHudUpdate?: (snapshot: HudSnapshot) => void;
  onNotice?: (title: string, body: string) => void;
  onKillFeed?: (item: KillFeedItem) => void;
}

const SEASONS: SeasonKey[] = ['spring', 'summer', 'autumn', 'winter'];

export class DamingLakeGame {
  private container: HTMLElement;
  private callbacks: GameCallbacks;

  private renderer: THREE.WebGLRenderer;
  private scene: THREE.Scene;
  private camera: THREE.PerspectiveCamera;
  private collider: any;
  private snowMeshes: THREE.Object3D[] = [];
  private world: any;
  private water: any;
  private districts: any;
  private coreRefs: any;
  private living: any;
  private player: any;
  private sky: any;
  private weather: any;
  private sound: any;
  private bgm: GuofengBgmEngine;
  private minghuShow: any;
  private director: any;
  private combat: CombatSystem;

  private keys: Record<string, boolean> = {};
  private virtualInput = { moveX: 0, moveZ: 0 };
  private seasonIdx = 1; // summer
  private skinId: SkinId = 'summer_lotus';
  private visitedIds = new Set<string>();
  private rafId = 0;
  private clock = new THREE.Clock();
  private elapsed = 0;
  private hudEmitAcc = 0;
  private lastSpaceDown = 0;
  private lookPointers = new Map<number, { x: number; y: number }>();
  private lastPinchDist: number | null = null;

  private boundKeyDown: (e: KeyboardEvent) => void;
  private boundKeyUp: (e: KeyboardEvent) => void;
  private boundResize: () => void;
  private boundWheel: (e: WheelEvent) => void;
  private boundPointerDown: (e: PointerEvent) => void;
  private boundPointerMove: (e: PointerEvent) => void;
  private boundPointerUp: (e: PointerEvent) => void;
  private boundBlur: () => void;
  private boundUnlockAudio: () => void;

  constructor(container: HTMLElement, callbacks: GameCallbacks = {}) {
    this.container = container;
    this.callbacks = callbacks;

    this.renderer = new THREE.WebGLRenderer({
      antialias: true,
      powerPreference: 'high-performance',
      preserveDrawingBuffer: true,
    });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.05;
    this.container.appendChild(this.renderer.domElement);

    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(56, 1, 0.5, 2600);

    const voxelMat = new THREE.MeshStandardMaterial({
      vertexColors: true,
      roughness: 0.88,
      metalness: 0.04,
    });

    this.collider = new WorldCollider();
    this.world = new ChunkWorld(this.scene, voxelMat, this.collider);
    this.water = createLakeWater(this.scene);
    this.districts = new DistrictManager({
      scene: this.scene,
      voxelMat,
      collider: this.collider,
      snowMeshes: this.snowMeshes,
    });
    this.coreRefs = this.districts.mountCore();
    this.water.setWaterPosts(this.coreRefs.waterPosts);
    this.living = new LivingWorld(this.scene, voxelMat, this.collider);
    this.player = new TuanPlayer(this.scene, voxelMat, this.collider);
    this.player.ferrisRef = this.coreRefs.ferris;
    this.player.cruiseRef = this.coreRefs.cruise;
    this.player.cruisesRef = this.coreRefs.cruises;

    this.sky = new SkyAndLighting(this.scene, this.renderer, this.camera, this.water.uniforms, this.coreRefs.chaoran);
    this.weather = new SeasonWeather(this.scene);
    this.sound = new SoundEngine();
    this.bgm = new GuofengBgmEngine();
    this.minghuShow = new (MinghuShow as any)(this.scene, this.sound, voxelMat, this.collider);
    this.director = new DirectorMode({
      camera: this.camera,
      world: this.world,
      sky: this.sky,
      onStateChange: () => this.emitHud(),
    });

    // 挂载武器与默认皮肤
    this.combat = new CombatSystem(this.scene, this.bgm);
    this.combat.onKillFeed = (item) => this.callbacks.onKillFeed?.(item);
    applySkinToPlayer(this.player, SKIN_MAP[this.skinId]);
    this.combat.mountWeaponToPlayer(this.player.root);

    this.world.primeAround(this.player.pos.x, this.player.pos.z, 3);

    // 音频解锁
    this.boundUnlockAudio = () => {
      this.sound.unlock();
      this.bgm.unlock();
    };
    window.addEventListener('pointerdown', this.boundUnlockAudio, { once: true });
    window.addEventListener('keydown', this.boundUnlockAudio, { once: true });

    // 键盘事件
    this.boundKeyDown = (e: KeyboardEvent) => this.handleKeyDown(e);
    this.boundKeyUp = (e: KeyboardEvent) => {
      this.keys[e.code] = false;
    };
    window.addEventListener('keydown', this.boundKeyDown);
    window.addEventListener('keyup', this.boundKeyUp);

    // 鼠标拖拽视角 + 手机多点触控旋转视角与双指捏合缩放
    const canvas = this.renderer.domElement;
    canvas.style.touchAction = 'none';
    this.boundPointerDown = (e: PointerEvent) => {
      if (e.pointerType !== 'touch' && e.button !== 0) return;
      this.lookPointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (this.lookPointers.size === 2) {
        const pts = Array.from(this.lookPointers.values());
        this.lastPinchDist = Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y);
      }
    };
    this.boundPointerMove = (e: PointerEvent) => {
      if (!this.lookPointers.has(e.pointerId)) return;
      const prev = this.lookPointers.get(e.pointerId)!;
      const dx = e.clientX - prev.x;
      const dy = e.clientY - prev.y;
      this.lookPointers.set(e.pointerId, { x: e.clientX, y: e.clientY });

      if (this.lookPointers.size === 2) {
        const pts = Array.from(this.lookPointers.values());
        const dist = Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y);
        if (this.lastPinchDist !== null) {
          this.zoomCamera(-(dist - this.lastPinchDist) * 0.06);
        }
        this.lastPinchDist = dist;
      } else if (this.lookPointers.size === 1) {
        this.rotateCamera(dx, dy);
        this.player.manualLookCooldown = 1.6;
      }
    };
    this.boundPointerUp = (e: PointerEvent) => {
      this.lookPointers.delete(e.pointerId);
      if (this.lookPointers.size < 2) this.lastPinchDist = null;
    };
    this.boundBlur = () => {
      this.clearVirtualInputs();
      this.lookPointers.clear();
      this.lastPinchDist = null;
    };
    this.boundWheel = (e: WheelEvent) => {
      this.zoomCamera(e.deltaY * 0.02);
    };
    canvas.addEventListener('pointerdown', this.boundPointerDown);
    window.addEventListener('pointermove', this.boundPointerMove);
    window.addEventListener('pointerup', this.boundPointerUp);
    window.addEventListener('pointercancel', this.boundPointerUp);
    window.addEventListener('blur', this.boundBlur);
    canvas.addEventListener('wheel', this.boundWheel, { passive: true });

    this.boundResize = () => this.resize();
    window.addEventListener('resize', this.boundResize);
    this.resize();
    this.syncBgmScene();
    this.emitHud();
    this.loop();
  }

  getLandmarks(): LandmarkSummary[] {
    return (LANDMARKS as any[]).map((lm) => ({
      id: lm.id,
      name: lm.name,
      poem: lm.poem || '',
      x: lm.x,
      z: lm.z,
      yaw: lm.yaw,
      district: lm.district,
    }));
  }

  resize() {
    const w = this.container.clientWidth || window.innerWidth;
    const h = this.container.clientHeight || window.innerHeight;
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(w, h);
    this.sky.resize(w, h);
  }

  rotateCamera(dx: number, dy: number) {
    this.player.camYaw = (this.player.camYaw ?? this.player.yaw) - dx * 0.0055;
    this.player.camPitch = THREE.MathUtils.clamp((this.player.camPitch ?? 0.28) + dy * 0.004, -0.15, 1.15);
  }

  zoomCamera(delta: number) {
    this.player.camDist = THREE.MathUtils.clamp((this.player.camDist ?? 14) + delta, 6, 62);
  }

  setVirtualJoystick(moveX: number, moveZ: number) {
    this.virtualInput.moveX = moveX;
    this.virtualInput.moveZ = moveZ;
    if (this.director.active && (Math.abs(moveX) > 0.15 || Math.abs(moveZ) > 0.15)) {
      this.director.stopTour();
    }
  }

  setVirtualKey(code: string, pressed: boolean) {
    this.keys[code] = pressed;
  }

  clearVirtualInputs() {
    this.virtualInput.moveX = 0;
    this.virtualInput.moveZ = 0;
    for (const k of Object.keys(this.keys)) {
      this.keys[k] = false;
    }
  }

  setSkin(skinId: SkinId) {
    this.skinId = skinId;
    applySkinToPlayer(this.player, SKIN_MAP[skinId]);
    this.bgm.playUiClick();
    this.callbacks.onNotice?.('换装成功', `已穿戴「${SKIN_MAP[skinId].name}」`);
    this.emitHud();
  }

  setWeapon(weaponId: EquippedWeaponId) {
    this.combat.setWeapon(weaponId);
    this.bgm.playUiClick();
    this.emitHud();
  }

  fireWeapon() {
    if (this.combat.weaponId === null) return;
    this.boundUnlockAudio();
    const fireYaw = this.player.yaw;
    this.combat.firePlayer(this.player.pos, fireYaw);
  }

  setGameMode(mode: GameMode) {
    this.boundUnlockAudio();
    this.combat.setMode(mode, this.player.pos.x, this.player.pos.z);
    if (mode !== 'roam' && this.combat.weaponId === null) {
      this.combat.setWeapon('spring_blaster');
    }
    if (mode === 'roam') {
      this.combat.setWeapon(null);
    }
    this.syncBgmScene();
    const modeName =
      mode === 'roam'
        ? '自由漫游（空手赏景）'
        : mode === 'hunt'
          ? '趣味打鸟抓鱼'
          : mode === 'practice_solo'
            ? '单排试炼（6名移动靶）'
            : '红蓝对抗练习（4v4）';
    this.callbacks.onNotice?.('模式切换', `当前模式：${modeName}`);
    this.emitHud();
  }

  cycleSeason(): SeasonKey {
    this.seasonIdx = (this.seasonIdx + 1) % SEASONS.length;
    const key = SEASONS[this.seasonIdx];
    this.world.setSeason(key, this.player.pos.x, this.player.pos.z);
    this.weather.setSeason(key);
    const isWinter = key === 'winter';
    this.water.uniforms.uIceFactor.value = isWinter ? 0.88 : 0.0;
    for (const sm of this.snowMeshes) sm.visible = isWinter;
    this.bgm.playUiClick();
    this.emitHud();
    return key;
  }

  cycleTime(): string {
    const label = this.sky.cycleMode();
    this.syncBgmScene();
    this.bgm.playUiClick();
    this.emitHud();
    return label;
  }

  toggleChaoranLight(): boolean {
    const next = !this.sky.chaoranLit;
    if (next && this.sky.mode !== 'night') {
      this.sky.setMode('night');
    }
    this.sky.setChaoranLit(next);
    this.syncBgmScene();
    this.bgm.playUiClick();
    this.callbacks.onNotice?.('超然楼', next ? '华灯初上，超然楼已点亮！' : '已关闭超然楼夜景灯光');
    this.emitHud();
    return next;
  }

  toggleMinghuShow(): boolean {
    const active = this.minghuShow.toggle();
    if (active) {
      this.sky.setMode('night');
      this.sky.setChaoranLit(true);
      if (Math.hypot(this.player.pos.x - MINGHU_SHOW_VIEW.x, this.player.pos.z - MINGHU_SHOW_VIEW.z) > 160) {
        this.player.teleport(MINGHU_SHOW_VIEW.x, MINGHU_SHOW_VIEW.z, MINGHU_SHOW_VIEW.yaw);
        this.world.primeAround(MINGHU_SHOW_VIEW.x, MINGHU_SHOW_VIEW.z + 50, 3);
      }
    }
    this.syncBgmScene();
    this.emitHud();
    return active;
  }

  toggleDirector(): boolean {
    const active = this.director.toggleTour();
    this.emitHud();
    return active;
  }

  feedFish() {
    this.boundUnlockAudio();
    const res = this.living.dropFood(this.player.pos.x, this.player.pos.z, this.player.yaw);
    if (res.ok) this.sound.playSplash();
    this.callbacks.onNotice?.(res.ok ? '湖畔投喂' : '提示', res.msg);
  }

  capturePostcardImage(): { dataUrl: string; filename: string } {
    this.boundUnlockAudio();
    const dataUrl = capturePostcard({
      renderer: this.renderer,
      renderScene: () => this.sky.render(),
      player: this.player,
      sky: this.sky,
      sound: this.sound,
    });
    const now = new Date();
    const dateStr = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}`;
    return { dataUrl, filename: `大明湖明信片_${dateStr}.png` };
  }

  toggleCar() {
    this.player.toggleCar();
    this.emitHud();
  }

  toggleHeli() {
    this.player.toggleHelicopter();
    this.emitHud();
  }

  toggleBus() {
    if (this.player.ridingBus) {
      const b = this.player.ridingBus;
      this.player.ridingBus = null;
      this.player.pos.set(b.x + 4.5, Math.max(2.2, this.player.pos.y - 1), b.z + 4.5);
      this.emitHud();
      return;
    }
    let target = this.living.findNearbyBus(this.player.pos.x, this.player.pos.z, 22);
    if (!target) {
      let bestD = Infinity;
      for (const b of this.living.buses) {
        const d = Math.hypot(this.player.pos.x - b.x, this.player.pos.z - b.z);
        if (d < bestD) {
          bestD = d;
          target = b;
        }
      }
    }
    if (!target) return;
    this.player._clearVehicles();
    this.player.swimming = false;
    this.player.ridingBus = target;
    this.world.primeAround(target.x, target.z, 2);
    this.emitHud();
  }

  triggerEAction() {
    this.boundUnlockAudio();
    if (this.player.ridingBus) {
      this.toggleBus();
      return;
    }
    const nearBus = !this.player.ridingBus && this.living.findNearbyBus(this.player.pos.x, this.player.pos.z, 15);
    if (nearBus) this.toggleBus();
    else this.player.triggerEAction();
    this.emitHud();
  }

  triggerJump() {
    this.boundUnlockAudio();
    if (!this.player.inCar && !this.player.inHeli && !this.player.parachuting) {
      this.player.triggerJump();
    }
  }

  resetCar() {
    if (this.player.inCar) this.player.resetCarPosition();
  }

  async teleportTo(landmarkId: string) {
    const lm = (LANDMARKS as any[]).find((item) => item.id === landmarkId);
    if (!lm) return;
    this.director.stopTour();
    if (lm.district) await this.districts.ensureLoaded(lm.district);
    this.player.teleport(lm.x, lm.z, lm.yaw ?? 0);
    this.world.primeAround(lm.x, lm.z, 2);
    this.bgm.playUiClick();
    this.callbacks.onNotice?.(`传送至 · ${lm.name}`, lm.poem || '四面荷花三面柳，一城山色半城湖。');
    this.emitHud();
  }

  toggleBgm(): boolean {
    this.boundUnlockAudio();
    const enabled = this.bgm.toggleBgm();
    this.emitHud();
    return enabled;
  }

  toggleSfx(): boolean {
    this.boundUnlockAudio();
    const enabled = this.bgm.toggleSfx();
    if (this.sound.enabled !== enabled) this.sound.toggleMute();
    this.emitHud();
    return enabled;
  }

  setBgmScene(scene: BgmScene) {
    this.boundUnlockAudio();
    this.bgm.setScene(scene);
    this.emitHud();
  }

  setBgmVolume(vol: number) {
    this.bgm.setBgmVolume(vol);
  }

  renderMinimap(canvas: HTMLCanvasElement) {
    renderDamingMinimap(
      canvas,
      this.player.pos.x,
      this.player.pos.z,
      this.player.yaw,
      this.visitedIds,
      this.combat.getMinimapTargets(),
    );
  }

  private syncBgmScene() {
    if (this.combat.mode === 'practice_solo' || this.combat.mode === 'practice_team') {
      this.bgm.setScene('battle');
    } else if (this.sky.mode === 'night' || this.minghuShow.active) {
      this.bgm.setScene('night');
    } else {
      this.bgm.setScene('day');
    }
  }

  private handleKeyDown(e: KeyboardEvent) {
    // 避免在输入框打字时触发快捷键
    const tag = (e.target as HTMLElement | null)?.tagName;
    if (tag === 'INPUT' || tag === 'TEXTAREA') return;

    if (!e.repeat && e.code === 'Space') {
      const now = performance.now();
      if (now - this.lastSpaceDown < 260 && (this.player.inHeli || this.player.parachuting)) {
        this.player.toggleHelicopter();
        this.lastSpaceDown = 0;
      } else {
        this.lastSpaceDown = now;
        this.triggerJump();
      }
    }

    this.keys[e.code] = true;
    if (e.repeat) return;

    if (e.code === 'KeyJ') this.fireWeapon();
    if (e.code === 'Digit0') this.setWeapon(null);
    if (e.code === 'KeyE') this.triggerEAction();
    if (e.code === 'KeyG') this.toggleHeli();
    if (e.code === 'KeyR') this.toggleCar();
    if (e.code === 'KeyF') this.toggleBus();
    if (e.code === 'KeyX') this.resetCar();
    if (e.code === 'KeyT') this.cycleTime();
    if (e.code === 'KeyQ') this.cycleSeason();
    if (e.code === 'KeyM') this.toggleMinghuShow();
    if (e.code === 'KeyL') this.toggleChaoranLight();
    if (e.code === 'KeyH') this.feedFish();
    if (e.code === 'KeyV') this.toggleDirector();
    if (e.code === 'Escape') this.director.stopTour();
    if (this.director.active && ['KeyW', 'KeyA', 'KeyS', 'KeyD'].includes(e.code)) {
      this.director.stopTour();
    }
  }

  private getVehicleMode(): VehicleMode {
    if (this.player.inCar) return 'car';
    if (this.player.inHeli) return 'heli';
    if (this.player.parachuting) return 'parachute';
    if (this.player.inBoat) return 'boat';
    if (this.player.ridingBus) return 'bus';
    if (this.player.ridingFerrisCabin >= 0) return 'ferris';
    if (this.player.ridingCruise) return 'cruise';
    if (this.player.swimming) return 'swim';
    return 'foot';
  }

  private checkLandmarkDiscovery() {
    for (const lm of LANDMARKS as any[]) {
      if (this.visitedIds.has(lm.id)) continue;
      if (Math.hypot(this.player.pos.x - lm.x, this.player.pos.z - lm.z) < 28) {
        this.visitedIds.add(lm.id);
        this.sound.playChime();
        this.callbacks.onNotice?.(`打卡印章 · ${lm.name}`, lm.poem || '四面荷花三面柳，一城山色半城湖。');
      }
    }
  }

  private resolveActionInfo(): { nearPrompt: string; actionLabel: string; actionCanAct: boolean } {
    const nearBus = !this.player.ridingBus && this.living.findNearbyBus(this.player.pos.x, this.player.pos.z, 15);
    if (nearBus) {
      return { nearPrompt: '靠近环湖观光车 · 按 E 或点击上车', actionLabel: '上车', actionCanAct: true };
    }
    const hint = this.player.getActionHint?.() || { type: null, canAct: false, label: '' };
    let actionLabel = '';
    if (hint.canAct) {
      switch (hint.type) {
        case 'bus':
          actionLabel = '下车';
          break;
        case 'cruise_enter':
          actionLabel = '登画舫';
          break;
        case 'cruise_exit':
          actionLabel = '下画舫';
          break;
        case 'ferris_enter':
          actionLabel = '坐摩天轮';
          break;
        case 'ferris_exit':
          actionLabel = '下摩天轮';
          break;
        case 'elevator_up':
          actionLabel = '登7楼';
          break;
        case 'elevator_down':
          actionLabel = '回1楼';
          break;
        case 'seat_enter':
          actionLabel = hint.seat?.type === 'lotus' ? '坐荷花' : '坐下';
          break;
        case 'seat_exit':
          actionLabel = '起身';
          break;
        case 'boat':
          actionLabel = this.player.inBoat ? '上岸' : '划船';
          break;
        default:
          actionLabel = '互动';
      }
    }
    return {
      nearPrompt: hint.label || '',
      actionLabel,
      actionCanAct: !!hint.canAct,
    };
  }

  private emitHud() {
    const seasonKey = SEASONS[this.seasonIdx];
    const palette = SEASON_PALETTES[seasonKey];
    const actionInfo = this.resolveActionInfo();

    this.callbacks.onHudUpdate?.({
      x: Math.round(this.player.pos.x),
      y: Math.round(this.player.pos.y),
      z: Math.round(this.player.pos.z),
      yaw: this.player.yaw,
      speedKmh: Math.round((this.player.speed || 0) * 3.6),
      altitude: Math.max(0, Math.round(this.player.pos.y)),
      nitroRatio: (this.player.nitro ?? 75) / 100,
      vehicle: this.getVehicleMode(),
      statusText: this.player.getStatusText?.() || '🐾 漫步中',
      nearPrompt: actionInfo.nearPrompt,
      actionLabel: actionInfo.actionLabel,
      actionCanAct: actionInfo.actionCanAct,
      hp: Math.round(this.combat.playerHp),
      maxHp: this.combat.playerMaxHp,
      skinId: this.skinId,
      weaponId: this.combat.weaponId,
      weaponCooldownRatio: this.combat.getCooldownRatio(),
      season: seasonKey,
      seasonLabel: palette?.name || '荷风盛夏',
      timeLabel: this.sky.getModeName?.() || '辰巳 · 清晨',
      chaoranLit: !!this.sky.chaoranLit,
      minghuShowActive: !!this.minghuShow.active,
      directorActive: !!this.director.active,
      bgmScene: this.bgm.scene,
      bgmEnabled: this.bgm.bgmEnabled,
      sfxEnabled: this.bgm.sfxEnabled,
      visitedIds: Array.from(this.visitedIds),
      totalLandmarks: (LANDMARKS as any[]).length,
      scoreboard: { ...this.combat.scoreboard },
      targets: this.combat.getMinimapTargets(),
    });
  }

  private loop = () => {
    this.rafId = requestAnimationFrame(this.loop);
    const dt = Math.min(0.05, this.clock.getDelta());
    this.elapsed += dt;

    this.living.update(dt, this.elapsed, this.player, !!this.world.palette.showLotus);
    const inDirector = this.director.update(dt);
    if (!inDirector) {
      this.player.update(dt, this.keys, this.elapsed, this.camera, this.sky.nightFactor, {
        joyX: this.virtualInput.moveX,
        joyY: this.virtualInput.moveZ,
      });
      this.player.updateCamera(this.camera);
      this.world.update(this.player.pos.x, this.player.pos.z, 3);
    }
    this.world.updateHeroLotuses(this.elapsed, dt, this.player);
    this.world.setNightFactor(this.sky.nightFactor);
    this.water.update(this.elapsed, this.player, this.coreRefs.cruises, this.living.rippleEvents);
    this.districts.update(dt, this.elapsed, this.sky.nightFactor, this.player.pos);
    const focusPos = inDirector ? this.camera.position : this.player.pos;
    this.weather.update(this.elapsed, focusPos, this.sky.nightFactor);
    this.minghuShow.update(dt, this.elapsed);
    this.sky.update(dt, focusPos);
    this.sound.update(this.player);
    this.combat.update(dt, this.elapsed, this.player.pos, this.camera);
    this.checkLandmarkDiscovery();

    this.hudEmitAcc += dt;
    if (this.hudEmitAcc >= 0.066) {
      this.hudEmitAcc = 0;
      this.emitHud();
    }

    this.sky.render();
  };

  dispose() {
    cancelAnimationFrame(this.rafId);
    window.removeEventListener('keydown', this.boundKeyDown);
    window.removeEventListener('keyup', this.boundKeyUp);
    window.removeEventListener('resize', this.boundResize);
    window.removeEventListener('pointermove', this.boundPointerMove);
    window.removeEventListener('pointerup', this.boundPointerUp);
    window.removeEventListener('pointercancel', this.boundPointerUp);
    window.removeEventListener('blur', this.boundBlur);
    this.renderer.domElement.removeEventListener('pointerdown', this.boundPointerDown);
    this.renderer.domElement.removeEventListener('wheel', this.boundWheel);
    this.bgm.dispose();
    this.renderer.dispose();
    this.renderer.domElement.remove();
  }
}
