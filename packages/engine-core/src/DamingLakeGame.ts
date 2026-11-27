import * as THREE from 'three';
import {
  SKIN_MAP,
  WEAPON_MAP,
  type AimTargetInfo,
  type BgmScene,
  type ChatBubbleEvent,
  type EquippedWeaponId,
  type GameMode,
  type GraphicsQuality,
  type HitFeedbackEvent,
  type HudSnapshot,
  type KillFeedItem,
  type LandmarkSummary,
  type MatchResultSummary,
  type P2PNetworkOptions,
  type RoomConfig,
  type RoomSnapshot,
  type SeasonKey,
  type SkinId,
  type TeamId,
  type VehicleMode,
} from '@daminghu/shared';
import { GuofengBgmEngine } from './bgmEngine';
import { selectBestAimTarget, type AimCandidate } from './combatBallistics';
import { CombatSystem } from './combatSystem';
import { renderDamingMinimap } from './minimapRenderer';
import { P2PRoomClient, type LocalPlayerNetState } from './p2pRoomClient';
import { createBrowserPlatformAdapter, type PlatformAdapter } from './platformAdapter';
import { RemotePlayerManager } from './remotePlayerManager';
import { applySkinToPlayer } from './skinRenderer';
import { disposeObject3D } from './threeDispose';

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
  onHitFeedback?: (event: HitFeedbackEvent) => void;
  onPlayerDamaged?: (damage: number, remainingHp: number) => void;
  onWeaponSlotHotkey?: (slot: 1 | 2 | 3) => void;
  onRoomUpdate?: (snapshot: RoomSnapshot) => void;
  onChatBubble?: (event: ChatBubbleEvent) => void;
  onMatchEnd?: (result: MatchResultSummary) => void;
}

export interface DamingLakeGameOptions {
  platform?: PlatformAdapter;
  network?: P2PNetworkOptions;
  initialQuality?: GraphicsQuality;
  playerName?: string;
  initialVisitedIds?: string[];
}

const SEASONS: SeasonKey[] = ['spring', 'summer', 'autumn', 'winter'];

export class DamingLakeGame {
  private container: HTMLElement;
  private callbacks: GameCallbacks;
  private platform: PlatformAdapter;

  private renderer: THREE.WebGLRenderer;
  private scene: THREE.Scene;
  private camera: THREE.PerspectiveCamera;
  private collider: WorldCollider;
  private snowMeshes: THREE.Object3D[] = [];
  private world: ChunkWorld;
  private water: ReturnType<typeof createLakeWater>;
  private districts: any;
  private coreRefs: any;
  private living: any;
  private player: any;
  private sky: SkyAndLighting;
  private weather: any;
  private sound: SoundEngine;
  private bgm: GuofengBgmEngine;
  private minghuShow: any;
  private director: DirectorMode;
  private combat: CombatSystem;
  private remotePlayers: RemotePlayerManager;
  private room: P2PRoomClient;

  private keys: Record<string, boolean> = {};
  private virtualInput = { moveX: 0, moveZ: 0 };
  private seasonIdx = 1; // summer
  private skinId: SkinId = 'summer_lotus';
  private quality: GraphicsQuality = 'high';
  private renderPaused = false;
  private inputBlocked = false;
  private visitedIds = new Set<string>();
  private rafId = 0;
  private clock = new THREE.Clock();
  private elapsed = 0;
  private hudEmitAcc = 0;
  private lastDriverFireTipAt = 0;
  private lastSpaceDown = 0;
  private lookPointers = new Map<number, { x: number; y: number }>();
  private lastPinchDist: number | null = null;
  private mouseAutoFire = false;
  private virtualFire = false;
  private lastPointerType = 'mouse';
  private lastAimTargetId: string | null = null;
  private camShake = 0;
  private netHitSeq = 1;
  private _tmpCamDir = new THREE.Vector3();
  private _tmpAimTarget = new THREE.Vector3();
  private _tmpMuzzle = new THREE.Vector3();
  private _tmpAimDir = new THREE.Vector3();

  private boundKeyDown: (e: KeyboardEvent) => void;
  private boundKeyUp: (e: KeyboardEvent) => void;
  private boundResize: () => void;
  private boundWheel: (e: WheelEvent) => void;
  private boundPointerDown: (e: PointerEvent) => void;
  private boundPointerMove: (e: PointerEvent) => void;
  private boundPointerUp: (e: PointerEvent) => void;
  private boundContextMenu: (e: MouseEvent) => void;
  private boundBlur: () => void;
  private boundUnlockAudio: () => void;

  constructor(container: HTMLElement, callbacks: GameCallbacks = {}, options: DamingLakeGameOptions = {}) {
    this.container = container;
    this.callbacks = callbacks;
    this.platform = options.platform ?? createBrowserPlatformAdapter();
    this.quality = options.initialQuality ?? (this.platform.isMobileViewport() ? 'medium' : 'high');
    if (options.initialVisitedIds?.length) {
      for (const id of options.initialVisitedIds) {
        this.visitedIds.add(id);
      }
    }

    this.renderer = new THREE.WebGLRenderer({
      antialias: this.quality !== 'low',
      powerPreference: 'high-performance',
    });
    this.renderer.setPixelRatio(Math.min(this.platform.getDevicePixelRatio(), this.quality === 'high' ? 2 : 1.5));
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
    this.bgm = new GuofengBgmEngine(this.platform);
    this.minghuShow = new (MinghuShow as any)(this.scene, this.sound, voxelMat, this.collider);
    this.director = new DirectorMode({
      camera: this.camera,
      world: this.world,
      sky: this.sky,
      onStateChange: () => this.emitHud(),
      onCaptionChange: (title: string, subtitle: string) => this.callbacks.onNotice?.(title, subtitle),
    });

    // 挂载武器与默认皮肤（传入全局 3D 碰撞器，确保子弹与 AI 绝不穿墙/穿模）
    this.combat = new CombatSystem(this.scene, this.bgm, this.collider);
    if (options.playerName) this.combat.setPlayerName(options.playerName);
    this.combat.onKillFeed = (item) => this.callbacks.onKillFeed?.(item);
    this.combat.onHitFeedback = (evt) => {
      this.platform.vibrate?.(evt.eliminated ? [16, 22, 26] : 12);
      this.callbacks.onHitFeedback?.(evt);
    };
    this.combat.onPlayerDamaged = (dmg, hp) => this.callbacks.onPlayerDamaged?.(dmg, hp);
    applySkinToPlayer(this.player, SKIN_MAP[this.skinId]);
    this.combat.mountWeaponToPlayer(this.player.root);

    // 挂载 WebRTC P2P 多人联机系统与 3D 远端角色管理器（传入碰撞器防子弹/角色穿模）
    this.remotePlayers = new RemotePlayerManager(this.scene, this.collider, this.platform);
    this.room = new P2PRoomClient({
      onRoomUpdate: (snap) => {
        if (snap.phase === 'playing') {
          if (this.combat.mode !== 'roam') {
            this.combat.setMode('roam', this.player.pos.x, this.player.pos.z);
          }
          if (snap.config.mode !== 'coop_roam' && this.combat.weaponId === null) {
            this.combat.setWeapon('spring_blaster');
            this.syncArmedCameraState();
          }
        }
        this.syncBgmScene();
        this.callbacks.onRoomUpdate?.(snap);
        this.emitHud();
      },
      onWorldSnapshot: (entities, localPlayerId) => {
        this.remotePlayers.syncEntities(entities, localPlayerId);
      },
      onProjectileFx: (_shooterId, x, y, z, yaw, weaponId, pitch) => {
        this.remotePlayers.spawnProjectileFx(x, y, z, yaw, weaponId, pitch ?? 0);
      },
      onLocalRespawn: (x, z, yaw) => {
        this.player.teleport(x, z, yaw);
        this.world.primeAround(x, z, 2);
      },
      onPassengerSync: (info) => {
        if (info.driverId) {
          this.player._clearVehicles();
          this.player.swimming = false;
          const vLabel = info.driverVehicle === 'car' ? '敞篷跑车副驾' : info.driverVehicle === 'heli' ? '直升机舱位' : '小木船船头';
          this.callbacks.onNotice?.('同乘成功', `已坐上${vLabel}，可 360° 自由开火赏景！`);
        } else {
          this.player._clearVehicles();
          if (info.autoParachute && this.player.pos.y > 4.5) {
            this.player.parachuting = true;
            this.player.parachute.visible = true;
            this.player.velY = -4.0;
          }
        }
        this.emitHud();
      },
      onForceExitVehicle: (autoParachute, reason) => {
        this.player._clearVehicles();
        if (autoParachute && this.player.pos.y > 4.5) {
          this.player.parachuting = true;
          this.player.parachute.visible = true;
          this.player.velY = -4.0;
        }
        this.callbacks.onNotice?.('载具击毁', reason);
        this.emitHud();
      },
      onKillFeed: (item) => this.callbacks.onKillFeed?.(item),
      onChatBubble: (evt) => {
        this.remotePlayers.showChatBubble(evt.senderId, evt.text);
        this.callbacks.onChatBubble?.(evt);
      },
      onMatchEnd: (result) => this.callbacks.onMatchEnd?.(result),
      onNotice: (title, body) => this.callbacks.onNotice?.(title, body),
      onLocalHit: (damage, eliminated, kind) => {
        this.bgm.playHit(eliminated);
        this.callbacks.onHitFeedback?.({
          id: 100000 + this.netHitSeq++,
          damage,
          eliminated,
          kind,
          timestamp: Date.now(),
        });
      },
      onLocalDamaged: (damage, remainingHp) => {
        this.bgm.playPlayerHurt();
        this.callbacks.onPlayerDamaged?.(damage, remainingHp);
      },
    }, this.collider, this.platform, options.network);

    this.applyQualitySettings(this.quality);
    this.world.primeAround(this.player.pos.x, this.player.pos.z, this.quality === 'low' ? 2 : 3);

    // 音频解锁（共享单一 AudioContext，降低移动端功耗并规避 iOS 多实例限制）
    this.boundUnlockAudio = () => {
      const sharedCtx = this.bgm.unlock();
      this.sound.unlock(sharedCtx);
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

    // 鼠标视角控制（持枪左键按下即开火/连发+指针锁定跟枪，空手游览拖拽视角）+ 手机多点触控与捏合缩放
    const canvas = this.renderer.domElement;
    canvas.style.touchAction = 'none';
    this.lastPointerType = this.platform.isMobileViewport() ? 'touch' : 'mouse';
    this.boundContextMenu = (e: MouseEvent) => {
      if (this.combat.weaponId !== null) e.preventDefault();
    };
    this.boundPointerDown = (e: PointerEvent) => {
      if (this.inputBlocked) return;
      this.lastPointerType = e.pointerType || 'mouse';
      if (e.pointerType !== 'touch') {
        const isArmed = this.combat.weaponId !== null;
        if (isArmed) {
          if (e.button === 0) {
            this.mouseAutoFire = true;
            this.fireWeapon();
            if (typeof document !== 'undefined' && document.pointerLockElement !== canvas) {
              try {
                canvas.requestPointerLock?.();
              } catch {
                // ignore if pointer lock is unavailable
              }
            }
            this.lookPointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
            return;
          }
          if (e.button === 2) {
            this.lookPointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
            return;
          }
          return;
        }
        if (e.button !== 0) return;
      }
      this.lookPointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (this.lookPointers.size === 2) {
        const pts = Array.from(this.lookPointers.values());
        this.lastPinchDist = Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y);
      }
    };
    this.boundPointerMove = (e: PointerEvent) => {
      if (this.inputBlocked) return;
      if (
        e.pointerType !== 'touch' &&
        this.combat.weaponId !== null &&
        typeof document !== 'undefined' &&
        document.pointerLockElement === canvas
      ) {
        if (e.movementX !== 0 || e.movementY !== 0) {
          this.rotateCamera(e.movementX, e.movementY);
          this.player.manualLookCooldown = 1.6;
        }
        return;
      }
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
      if (e.pointerType !== 'touch' && e.button === 0) {
        this.mouseAutoFire = false;
      }
      this.lookPointers.delete(e.pointerId);
      if (this.lookPointers.size < 2) this.lastPinchDist = null;
    };
    this.boundBlur = () => {
      this.clearVirtualInputs();
      this.mouseAutoFire = false;
      this.lookPointers.clear();
      this.lastPinchDist = null;
    };
    this.boundWheel = (e: WheelEvent) => {
      this.zoomCamera(e.deltaY * 0.02);
    };
    canvas.addEventListener('pointerdown', this.boundPointerDown);
    canvas.addEventListener('contextmenu', this.boundContextMenu);
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
    return LANDMARKS.map((lm) => ({
      id: lm.id,
      name: lm.name,
      poem: lm.poem || '',
      x: lm.x,
      z: lm.z,
      yaw: lm.spawnYaw,
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
    this.player.camPitch = THREE.MathUtils.clamp((this.player.camPitch ?? 0.14) + dy * 0.004, -0.55, 1.08);
  }

  zoomCamera(delta: number) {
    this.player.camDist = THREE.MathUtils.clamp((this.player.camDist ?? 14) + delta, 6, 62);
  }

  setVirtualFire(active: boolean) {
    this.virtualFire = active;
    if (active && !this.inputBlocked) {
      this.fireWeapon();
    }
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
    this.virtualFire = false;
    for (const k of Object.keys(this.keys)) {
      this.keys[k] = false;
    }
  }

  setPlayerName(name: string) {
    this.combat.setPlayerName(name);
  }

  setRenderPaused(paused: boolean) {
    this.renderPaused = paused;
  }

  private releasePointerLock() {
    if (typeof document !== 'undefined' && document.pointerLockElement === this.renderer.domElement) {
      try {
        document.exitPointerLock?.();
      } catch {
        // ignore
      }
    }
  }

  setInputBlocked(blocked: boolean) {
    this.inputBlocked = blocked;
    if (blocked) {
      this.mouseAutoFire = false;
      this.lookPointers.clear();
      this.clearVirtualInputs();
      this.releasePointerLock();
    }
  }

  setQuality(level: GraphicsQuality) {
    this.quality = level;
    this.applyQualitySettings(level);
    this.bgm.playUiClick();
    const label = level === 'low' ? '流畅省电' : level === 'medium' ? '均衡推荐' : '极致光影';
    this.callbacks.onNotice?.('画质切换', `已切换至「${label}」画质`);
    this.emitHud();
  }

  private applyQualitySettings(level: GraphicsQuality) {
    const maxDpr = level === 'low' ? 1.0 : level === 'medium' ? 1.5 : 2.0;
    this.renderer.setPixelRatio(Math.min(this.platform.getDevicePixelRatio(), maxDpr));
    this.world.viewRadius = level === 'low' ? 3 : level === 'medium' ? 4 : 5;
    this.sky.setQuality?.(level);
    this.resize();
  }

  setSkin(skinId: SkinId) {
    this.skinId = skinId;
    applySkinToPlayer(this.player, SKIN_MAP[skinId]);
    this.bgm.playUiClick();
    this.callbacks.onNotice?.('换装成功', `已穿戴「${SKIN_MAP[skinId].name}」`);
    this.emitHud();
  }

  private syncArmedCameraState() {
    const isArmed = this.combat.weaponId !== null;
    const wasArmed = !!this.player.armed;
    this.player.armed = isArmed;
    // 刚拔枪时若镜头俯角过大，自动回正到舒适平视角度，方便直接瞄准远处敌人
    if (isArmed && !wasArmed && (this.player.camPitch ?? 0) > 0.14) {
      this.player.camPitch = 0.05;
    }
  }

  setWeapon(weaponId: EquippedWeaponId) {
    this.combat.setWeapon(weaponId);
    if (weaponId === null) {
      this.mouseAutoFire = false;
      this.lastAimTargetId = null;
      this.releasePointerLock();
    }
    this.syncArmedCameraState();
    this.bgm.playUiClick();
    this.emitHud();
  }

  /** 计算屏幕正中央准星射线落点及实时锁定的目标信息（供开火与 HUD 动态准星共用） */
  private resolveAimRaycast(): { point: THREE.Vector3; target: AimTargetInfo | null } | null {
    if (this.combat.weaponId === null) return null;
    const weapon = WEAPON_MAP[this.combat.weaponId];
    this.camera.getWorldDirection(this._tmpCamDir);
    const camPos = this.camera.position;
    let aimDist = weapon.maxRange;
    const endX = camPos.x + this._tmpCamDir.x * aimDist;
    const endY = camPos.y + this._tmpCamDir.y * aimDist;
    const endZ = camPos.z + this._tmpCamDir.z * aimDist;

    const wallHit = this.collider.raycastSolid(camPos.x, camPos.y, camPos.z, endX, endY, endZ, 0.55);
    if (wallHit && wallHit.dist > 4) {
      aimDist = Math.min(aimDist, wallHit.dist);
    }
    this._tmpAimTarget.copy(camPos).addScaledVector(this._tmpCamDir, aimDist);

    const candidates: AimCandidate[] = this.combat.getAimCandidates();
    if (this.room.active) {
      const netCandidates = this.remotePlayers.getAimCandidates(this.room.localTeam, this.room.currentRoomMode);
      for (let i = 0; i < netCandidates.length; i++) {
        candidates.push(netCandidates[i]);
      }
    }

    const locked = selectBestAimTarget({
      rayOrigin: camPos,
      rayDir: this._tmpCamDir,
      maxRange: aimDist,
      candidates,
      mode: this.combat.mode,
      isMultiplayerCombat: this.room.isCombatMatch,
      isTouch: this.lastPointerType === 'touch' || this.platform.isMobileViewport(),
      previousTargetId: this.lastAimTargetId,
    });
    this.lastAimTargetId = locked?.id ?? null;

    if (locked) {
      this._tmpAimTarget.set(locked.x, locked.y, locked.z);
      return {
        point: this._tmpAimTarget,
        target: {
          kind: locked.kind,
          name: locked.name,
          distance: Math.round(this.player.pos.distanceTo(this._tmpAimTarget)),
          hpRatio: locked.hpRatio,
        },
      };
    }
    return { point: this._tmpAimTarget, target: null };
  }

  fireWeapon() {
    if (this.combat.weaponId === null) return;
    if (this.room.isCombatMatch && !this.room.currentAlive) return;
    // 对战模式下主驾专心驾驶不可开枪；副驾/舱门乘客可 360° 自由开火！
    const isDriver = !this.room.currentPassengerOf && (this.player.inCar || this.player.inHeli || this.player.inBoat);
    if (this.room.isCombatMatch && isDriver) {
      const now = performance.now();
      if (now - this.lastDriverFireTipAt > 2500) {
        this.lastDriverFireTipAt = now;
        this.callbacks.onNotice?.('载具分工', '对战中主驾需专心驾驶，副驾/乘客可 360° 自由开火！');
      }
      return;
    }
    this.boundUnlockAudio();

    const weapon = WEAPON_MAP[this.combat.weaponId];
    const aimResult = this.resolveAimRaycast();
    if (!aimResult) return;

    // 2. 由枪口指向准星落点，并对抛物线重力武器按实际射距精确补偿弹道下坠
    this._tmpMuzzle.set(this.player.pos.x, this.player.pos.y + 1.45, this.player.pos.z);
    if (weapon.gravity > 0) {
      const dist = this._tmpMuzzle.distanceTo(this._tmpAimTarget);
      const flightTime = Math.min(2.2, dist / weapon.projectileSpeed);
      this._tmpAimTarget.y += 0.5 * weapon.gravity * flightTime * flightTime;
    }
    this._tmpAimDir.copy(this._tmpAimTarget).sub(this._tmpMuzzle);
    if (this._tmpAimDir.lengthSq() < 1e-4) {
      this._tmpAimDir.copy(this._tmpCamDir);
    } else {
      this._tmpAimDir.normalize();
    }
    const fireYaw = Math.atan2(this._tmpAimDir.x, this._tmpAimDir.z);
    const firePitch = Math.asin(THREE.MathUtils.clamp(this._tmpAimDir.y, -0.92, 0.92));

    // 步行/游泳/划船/跳伞开火时自动面向准星方向（不再往侧面盲射）
    if (!this.player.inCar && !this.player.inHeli && !this.player.ridingBus && !this.player.ridingCruise) {
      this.player.yaw = fireYaw;
      this.player.root.rotation.y = fireYaw;
    }

    const fired = this.combat.firePlayer(this.player.pos, fireYaw, firePitch, this._tmpAimDir);
    if (fired) {
      this.camShake = Math.max(
        this.camShake,
        weapon.id === 'lotus_mortar' ? 0.14 : weapon.id === 'quehua_bow' ? 0.08 : 0.04,
      );
      this.platform.vibrate?.(weapon.id === 'lotus_mortar' ? 16 : 8);
      if (this.room.active && this.combat.weaponId) {
        this.room.sendFire(this.player.pos.x, this.player.pos.y, this.player.pos.z, fireYaw, this.combat.weaponId, firePitch);
      }
    }
  }

  private getLocalNetState(): LocalPlayerNetState {
    return {
      x: this.player.pos.x,
      y: this.player.pos.y,
      z: this.player.pos.z,
      yaw: this.player.yaw,
      vehicle: this.getVehicleMode(),
      skinId: this.skinId,
      weaponId: this.combat.weaponId,
    };
  }

  createMultiplayerRoom(hostName: string) {
    this.boundUnlockAudio();
    this.room.createRoom(hostName, this.getLocalNetState());
  }

  joinMultiplayerRoom(roomCode: string, playerName: string) {
    this.boundUnlockAudio();
    this.room.joinRoom(roomCode, playerName, this.getLocalNetState());
  }

  leaveMultiplayerRoom() {
    this.room.leaveRoom(true);
    this.remotePlayers.clear();
    this.syncBgmScene();
    this.emitHud();
  }

  updateRoomConfig(patch: Partial<RoomConfig>) {
    this.room.updateConfig(patch);
  }

  switchRoomTeam(team: TeamId) {
    this.room.switchTeam(team);
  }

  startMultiplayerMatch() {
    this.boundUnlockAudio();
    this.room.startMatch();
  }

  sendQuickChat(text: string) {
    this.room.sendQuickChat(text);
  }

  teleportToPlayer(playerId: string) {
    const pos = this.remotePlayers.getPlayerPosition(playerId);
    if (!pos) return;
    this.director.stopTour();
    this.player.teleport(pos.x + 3.2, pos.z + 3.2, this.player.yaw);
    this.world.primeAround(pos.x, pos.z, 2);
    this.bgm.playUiClick();
    this.callbacks.onNotice?.('好友传送', '已瞬间闪现到好友身边！');
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
    this.syncArmedCameraState();
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
      createCanvas: (w: number, h: number) => this.platform.createCanvas(w, h),
    });
    const now = new Date();
    const dateStr = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}`;
    return { dataUrl, filename: `大明湖明信片_${dateStr}.png` };
  }

  toggleCar() {
    if (this.room.currentPassengerOf) {
      this.room.requestLeaveVehicle(false);
      return;
    }
    this.player.toggleCar();
    this.emitHud();
  }

  toggleHeli() {
    if (this.room.currentPassengerOf) {
      this.room.requestLeaveVehicle(true);
      return;
    }
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
    // 1. 乘客状态：按 E / 点互动键下车或高空跳伞
    if (this.room.currentPassengerOf) {
      this.room.requestLeaveVehicle(this.room.currentPassengerVehicle === 'heli');
      this.emitHud();
      return;
    }
    // 2. 联机靠近好友/队友载具：一键上副驾 / 登飞机 / 同乘船
    if (this.room.active && !this.player.inCar && !this.player.inHeli && !this.player.inBoat) {
      const boardable = this.remotePlayers.findNearbyBoardableVehicle(
        this.player.pos.x,
        this.player.pos.y,
        this.player.pos.z,
        this.room.localTeam,
        this.room.currentRoomMode,
        this.room.inPlayingMatch,
      );
      if (boardable) {
        this.room.requestBoardVehicle(boardable.driverId);
        this.emitHud();
        return;
      }
    }
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
    const lm = LANDMARKS.find((item) => item.id === landmarkId);
    if (!lm) return;
    this.director.stopTour();
    const targetX = lm.spawnX ?? lm.x;
    const targetZ = lm.spawnZ ?? lm.z;
    this.player.teleport(targetX, targetZ, lm.spawnYaw ?? 0);
    this.world.primeAround(targetX, targetZ, 2);
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
    const mergedTargets = [...this.combat.getMinimapTargets(), ...this.remotePlayers.getMinimapDots()];
    renderDamingMinimap(
      canvas,
      this.player.pos.x,
      this.player.pos.z,
      this.player.yaw,
      this.visitedIds,
      mergedTargets,
    );
  }

  private syncBgmScene() {
    if (this.room.isCombatMatch || this.combat.mode === 'practice_solo' || this.combat.mode === 'practice_team') {
      this.bgm.setScene('battle');
    } else if (this.sky.mode === 'night' || this.minghuShow.active) {
      this.bgm.setScene('night');
    } else {
      this.bgm.setScene('day');
    }
  }

  private handleKeyDown(e: KeyboardEvent) {
    // 弹窗/车库打开或输入框打字时拦截游戏快捷键
    if (this.inputBlocked) return;
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
    if (e.code === 'Digit1') this.callbacks.onWeaponSlotHotkey?.(1);
    if (e.code === 'Digit2') this.callbacks.onWeaponSlotHotkey?.(2);
    if (e.code === 'Digit3') this.callbacks.onWeaponSlotHotkey?.(3);
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
    for (const lm of LANDMARKS) {
      if (this.visitedIds.has(lm.id)) continue;
      if (Math.hypot(this.player.pos.x - lm.x, this.player.pos.z - lm.z) < 28) {
        this.visitedIds.add(lm.id);
        this.sound.playChime();
        this.callbacks.onNotice?.(`打卡印章 · ${lm.name}`, lm.poem || '四面荷花三面柳，一城山色半城湖。');
      }
    }
  }

  private resolveActionInfo(): { nearPrompt: string; actionLabel: string; actionCanAct: boolean } {
    if (this.room.currentPassengerOf) {
      const isHeliHigh = this.room.currentPassengerVehicle === 'heli' && this.player.pos.y > 5.5;
      return {
        nearPrompt: isHeliHigh
          ? '正在搭乘直升机（可 360° 开火）· 按 E / G 或点「跳伞」高空空降！'
          : '正在同乘好友载具（可 360° 自由开火）· 按 E 或点「下车」离开',
        actionLabel: isHeliHigh ? '跳伞' : '下车',
        actionCanAct: true,
      };
    }
    if (this.room.active && !this.player.inCar && !this.player.inHeli && !this.player.inBoat) {
      const boardable = this.remotePlayers.findNearbyBoardableVehicle(
        this.player.pos.x,
        this.player.pos.y,
        this.player.pos.z,
        this.room.localTeam,
        this.room.currentRoomMode,
        this.room.inPlayingMatch,
      );
      if (boardable) {
        return {
          nearPrompt: boardable.promptLabel,
          actionLabel: boardable.actionLabel,
          actionCanAct: true,
        };
      }
    }
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
    const mergedTargets = [...this.combat.getMinimapTargets(), ...this.remotePlayers.getMinimapDots()];
    const aimTarget = !this.director.active ? (this.resolveAimRaycast()?.target ?? null) : null;

    this.callbacks.onHudUpdate?.({
      x: Math.round(this.player.pos.x),
      y: Math.round(this.player.pos.y),
      z: Math.round(this.player.pos.z),
      yaw: this.player.yaw,
      speedKmh: Math.round((this.player.speed || 0) * 3.6),
      altitude: Math.max(0, Math.round(this.player.pos.y)),
      nitroRatio: (this.player.nitro ?? 75) / 100,
      vehicle: this.getVehicleMode(),
      isPassenger: !!this.room.currentPassengerOf,
      passengerVehicle: this.room.currentPassengerVehicle,
      vehicleHp: this.room.currentVehicleHp,
      vehicleMaxHp: this.room.currentVehicleMaxHp,
      statusText: this.room.currentPassengerOf ? '🤝 同乘好友载具中' : this.player.getStatusText?.() || '🐾 漫步中',
      nearPrompt: actionInfo.nearPrompt,
      actionLabel: actionInfo.actionLabel,
      actionCanAct: actionInfo.actionCanAct,
      hp: this.room.isCombatMatch ? Math.round(this.room.currentHp) : Math.round(this.combat.playerHp),
      maxHp: this.combat.playerMaxHp,
      skinId: this.skinId,
      weaponId: this.combat.weaponId,
      weaponCooldownRatio: this.combat.getCooldownRatio(),
      aimTarget,
      season: seasonKey,
      seasonLabel: palette?.name || '荷风盛夏',
      timeLabel: this.sky.getModeName?.() || '辰巳 · 清晨',
      chaoranLit: !!this.sky.chaoranLit,
      minghuShowActive: !!this.minghuShow.active,
      directorActive: !!this.director.active,
      bgmScene: this.bgm.scene,
      bgmEnabled: this.bgm.bgmEnabled,
      sfxEnabled: this.bgm.sfxEnabled,
      quality: this.quality,
      visitedIds: Array.from(this.visitedIds),
      totalLandmarks: LANDMARKS.length,
      scoreboard: { ...this.combat.scoreboard },
      targets: mergedTargets,
    });
  }

  private loop = () => {
    this.rafId = this.platform.requestAnimationFrame(this.loop);
    const dt = Math.min(0.05, this.clock.getDelta());
    this.elapsed += dt;

    // 3D 车库展台开启时暂停主场景重渲染（但保持联机房间心跳与同步不断线）
    if (this.renderPaused) {
      this.room.update(dt, this.getLocalNetState());
      return;
    }

    this.living.update(dt, this.elapsed, this.player, !!this.world.palette.showLotus);
    const inDirector = this.director.update(dt);
    if (!inDirector) {
      const passengerDriverId = this.room.currentPassengerOf;
      if (passengerDriverId) {
        const seat = this.remotePlayers.getDriverSeatWorldPos(passengerDriverId, this.room.currentSeatIndex);
        if (seat) {
          this.player.pos.set(seat.x, seat.y, seat.z);
          this.player.yaw = this.player.camYaw + Math.PI;
          this.player.root.position.copy(this.player.pos);
          this.player.root.rotation.set(0, this.player.yaw, 0);
        }
        this.player.updateCamera(this.camera, dt);
        this.world.update(this.player.pos.x, this.player.pos.z, 3);
      } else {
        this.player.update(dt, this.keys, this.elapsed, this.camera, this.sky.nightFactor, {
          joyX: this.virtualInput.moveX,
          joyY: this.virtualInput.moveZ,
        });

        // 人与人 / 人与 AI 实体防穿模推离（步行/跑车/划船均生效，自动忽略同车乘客/司机）
        if (!this.player.ridingBus && !this.player.ridingCruise && this.player.ridingFerrisCabin < 0 && !this.player.inHeli) {
          const minSep = this.player.inCar ? 2.1 : 1.35;
          const p1 = this.combat.resolvePlayerPushOut(this.player.pos.x, this.player.pos.y, this.player.pos.z, minSep);
          const p2 = this.remotePlayers.resolvePlayerPushOut(
            this.player.pos.x,
            this.player.pos.y,
            this.player.pos.z,
            minSep,
            this.room.currentPassengerOf,
            this.room.getSnapshot().localPlayerId,
          );
          const totalDx = p1.dx + p2.dx;
          const totalDz = p1.dz + p2.dz;
          const colR = this.player.inCar ? 0.72 : 0.38;
          if (Math.abs(totalDx) > 1e-4 && !this.collider.collidesBox(this.player.pos.x + totalDx, this.player.pos.y, this.player.pos.z, colR, 1.4)) {
            this.player.pos.x += totalDx;
          }
          if (Math.abs(totalDz) > 1e-4 && !this.collider.collidesBox(this.player.pos.x, this.player.pos.y, this.player.pos.z + totalDz, colR, 1.4)) {
            this.player.pos.z += totalDz;
          }
          if (Math.abs(totalDx) > 1e-4 || Math.abs(totalDz) > 1e-4) {
            this.player.root.position.copy(this.player.pos);
          }
        }

        this.player.updateCamera(this.camera, dt);
        this.world.update(this.player.pos.x, this.player.pos.z, 3);
      }
      // 轻微开火震屏衰减
      if (this.camShake > 0.002) {
        this.camera.position.x += (Math.random() - 0.5) * this.camShake;
        this.camera.position.y += (Math.random() - 0.5) * this.camShake;
        this.camShake = Math.max(0, this.camShake - dt * 1.4);
      } else {
        this.camShake = 0;
      }
      // PC 端长按 J 键/左键 或 移动端长按开火键：冷却一好即刻连发
      if (!this.inputBlocked && this.combat.weaponId !== null && (this.keys['KeyJ'] || this.mouseAutoFire || this.virtualFire)) {
        this.fireWeapon();
      }
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
    this.room.update(dt, this.getLocalNetState());
    this.remotePlayers.update(dt, this.elapsed);
    this.checkLandmarkDiscovery();

    this.hudEmitAcc += dt;
    if (this.hudEmitAcc >= 0.066) {
      this.hudEmitAcc = 0;
      this.emitHud();
    }

    this.sky.render();
  };

  dispose() {
    this.platform.cancelAnimationFrame(this.rafId);
    window.removeEventListener('pointerdown', this.boundUnlockAudio);
    window.removeEventListener('keydown', this.boundUnlockAudio);
    window.removeEventListener('keydown', this.boundKeyDown);
    window.removeEventListener('keyup', this.boundKeyUp);
    window.removeEventListener('resize', this.boundResize);
    window.removeEventListener('pointermove', this.boundPointerMove);
    window.removeEventListener('pointerup', this.boundPointerUp);
    window.removeEventListener('pointercancel', this.boundPointerUp);
    window.removeEventListener('blur', this.boundBlur);
    this.renderer.domElement.removeEventListener('pointerdown', this.boundPointerDown);
    this.renderer.domElement.removeEventListener('contextmenu', this.boundContextMenu);
    this.renderer.domElement.removeEventListener('wheel', this.boundWheel);
    this.room.dispose();
    this.remotePlayers.dispose();
    this.combat.dispose();
    this.sound.dispose?.();
    this.bgm.dispose();
    this.sky.dispose?.();
    disposeObject3D(this.scene, { disposeTextures: true });
    this.renderer.dispose();
    this.renderer.domElement.remove();
  }
}
