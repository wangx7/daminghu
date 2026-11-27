// 「我的世界风格 · 大明湖 3.0」主入口
// 整合：向东扩建 500m 覆盖 2.1km 全域（16大景点）、16m 宽人车分流路网与智能避让、
// 直升机(加速至65m/s)+可控降落伞(G/双击空格)、敞篷跑车(R，加速至48m/s)、观光车(F)、四季积雪与明湖秀
import * as THREE from 'three';
import { WorldCollider } from './collider.js';
import { ChunkWorld, SEASON_PALETTES } from './world.js';
import { createLakeWater } from './water.js';
import { DistrictManager } from './districts/index.js';
import { LivingWorld } from './living.js';
import { TuanPlayer } from './player.js';
import { SkyAndLighting } from './sky.js';
import { SeasonWeather } from './seasons.js';
import { MinghuShow, MINGHU_SHOW_VIEW } from './show.js';
import { GameHUD } from './hud.js';
import { TouchControls } from './touch.js';
import { SoundEngine } from './audio.js';
import { capturePostcard } from './postcard.js';
import { DirectorMode } from './director.js';

const stageEl = document.getElementById('stage');

const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.05;
stageEl.appendChild(renderer.domElement);

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(56, 1, 0.5, 2600);

const voxelMat = new THREE.MeshStandardMaterial({
  vertexColors: true,
  roughness: 0.88,
  metalness: 0.04,
});

const collider = new WorldCollider();
const snowMeshes = [];

const world = new ChunkWorld(scene, voxelMat, collider);
const water = createLakeWater(scene);
const districts = new DistrictManager({ scene, voxelMat, collider, snowMeshes });
const coreRefs = districts.mountCore();
water.setWaterPosts(coreRefs.waterPosts);
const living = new LivingWorld(scene, voxelMat, collider);
const player = new TuanPlayer(scene, voxelMat, collider);
player.ferrisRef = coreRefs.ferris;
player.cruiseRef = coreRefs.cruise;
player.cruisesRef = coreRefs.cruises;
const sky = new SkyAndLighting(scene, renderer, camera, water.uniforms, coreRefs.chaoran);
const weather = new SeasonWeather(scene);
const sound = new SoundEngine();
const minghuShow = new MinghuShow(scene, sound, voxelMat, collider);

// 首次交互解锁程序化音效引擎
const unlockAudio = () => sound.unlock();
window.addEventListener('pointerdown', unlockAudio, { once: true });
window.addEventListener('keydown', unlockAudio, { once: true });

world.primeAround(player.pos.x, player.pos.z, 3);

// 四季切换
const SEASONS = ['spring', 'summer', 'autumn', 'winter'];
let seasonIdx = 1;
function cycleSeason() {
  seasonIdx = (seasonIdx + 1) % SEASONS.length;
  const key = SEASONS[seasonIdx];
  world.setSeason(key, player.pos.x, player.pos.z);
  weather.setSeason(key);
  const isWinter = key === 'winter';
  water.uniforms.uIceFactor.value = isWinter ? 0.88 : 0.0;
  for (const sm of snowMeshes) sm.visible = isWinter;
  const info = SEASON_PALETTES[key];
  return `${info.icon} ${info.name}`;
}

// 乘坐 / 离开环湖观光车
function toggleSightseeingBus() {
  if (player.ridingBus) {
    const b = player.ridingBus;
    player.ridingBus = null;
    player.pos.set(b.x + 4.5, Math.max(2.2, player.pos.y - 1), b.z + 4.5);
    return false;
  }
  let target = living.findNearbyBus(player.pos.x, player.pos.z, 22);
  if (!target) {
    let bestD = Infinity;
    for (const b of living.buses) {
      const d = Math.hypot(player.pos.x - b.x, player.pos.z - b.z);
      if (d < bestD) { bestD = d; target = b; }
    }
  }
  if (!target) return false;
  player._clearVehicles();
  player.swimming = false;
  player.ridingBus = target;
  world.primeAround(target.x, target.z, 2);
  return true;
}

// 辅助更新 Dock 按钮纯中文标签（保留精绘 SVG 图标不被覆盖）
function setDockLabel(id, text, active = null) {
  const btn = document.getElementById(id);
  if (!btn) return;
  const lbl = btn.querySelector('.lbl');
  if (lbl) lbl.textContent = text;
  if (active !== null) btn.classList.toggle('active', active);
}

// 明湖秀开关（1:1 真实北岸奇石馆前主水域：自动移步北岸观演看台面朝正南全景欣赏！）
function toggleMinghuShow() {
  const active = minghuShow.toggle();
  if (active) {
    sky.setMode('night');
    sky.setChaoranLit(true);
    setDockLabel('btn-time', sky.getModeName());
    setDockLabel('btn-light', '已亮灯', true);
    if (Math.hypot(player.pos.x - MINGHU_SHOW_VIEW.x, player.pos.z - MINGHU_SHOW_VIEW.z) > 160) {
      player.teleport(MINGHU_SHOW_VIEW.x, MINGHU_SHOW_VIEW.z, MINGHU_SHOW_VIEW.yaw);
      world.primeAround(MINGHU_SHOW_VIEW.x, MINGHU_SHOW_VIEW.z + 50, 3);
    }
  }
  return active;
}

// 始终保持全屏横屏渲染
function updateSize() {
  const w = window.innerWidth, h = window.innerHeight;
  stageEl.style.width = `${w}px`;
  stageEl.style.height = `${h}px`;
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
  renderer.setSize(w, h);
  sky.resize(w, h);
}
updateSize();
window.addEventListener('resize', updateSize);

const director = new DirectorMode({
  camera,
  world,
  sky,
  onStateChange: (active) => {
    setDockLabel('btn-director', active ? '巡游中' : '巡游', active);
    if (!active) setDockLabel('btn-time', sky.getModeName());
  },
});

document.getElementById('btn-director-rec')?.addEventListener('click', () => {
  director.toggleRecording(renderer.domElement);
});

function doFeedFish() {
  sound.unlock();
  const res = living.dropFood(player.pos.x, player.pos.z, player.yaw);
  if (res.ok) sound.playSplash();
  hud.showNotice(res.ok ? '湖畔投喂' : '提示', res.msg, 3.4);
}

function doPhoto() {
  sound.unlock();
  capturePostcard({
    renderer,
    renderScene: () => sky.render(),
    player,
    sky,
    sound,
  });
}

const hud = new GameHUD({
  onTeleport: async (x, z, yaw, lm) => {
    director.stopTour();
    if (lm?.district) await districts.ensureLoaded(lm.district);
    player.teleport(x, z, yaw);
    world.primeAround(x, z, 2);
  },
  onCycleTime: () => sky.cycleMode(),
  onCycleSeason: cycleSeason,
  onToggleShow: toggleMinghuShow,
  onToggleHeli: () => player.toggleHelicopter(),
  onToggleCar: () => player.toggleCar(),
  onToggleBus: toggleSightseeingBus,
  onTriggerEAction: () => player.triggerEAction(),
  onPhoto: doPhoto,
  onDirector: () => director.toggleTour(),
  onFeedFish: doFeedFish,
  onToggleAudio: () => {
    sound.unlock();
    return sound.toggleMute();
  },
  onVisitLandmark: (_lm, isNew) => {
    if (isNew) sound.playChime();
  },
  isChaoranLit: () => sky.chaoranLit,
  onTriggerChaoranLight: (lit) => {
    if (lit && sky.mode !== 'night') {
      sky.setMode('night');
      setDockLabel('btn-time', sky.getModeName());
    }
    sky.setChaoranLit(lit);
    setDockLabel('btn-light', lit ? '已亮灯' : '超然亮灯', lit);
  },
});

// 初始化时辰按钮为当前真实时间匹配的时辰
setDockLabel('btn-time', sky.getModeName());
if (sky.chaoranLit) setDockLabel('btn-light', '已亮灯', true);

// 键盘与鼠标控制（支持三段跳 + 水里轻松跃出 + 双击 Space 开直升机 / 空中跳伞 + Shift 跑车氮气！）
const keys = {};
let lastSpaceDown = 0;
window.addEventListener('keydown', (e) => {
  if (!e.repeat && e.code === 'Space') {
    const now = performance.now();
    if (now - lastSpaceDown < 260 && (player.inHeli || player.parachuting)) {
      player.toggleHelicopter();
      lastSpaceDown = 0;
    } else {
      lastSpaceDown = now;
      if (!player.inCar && !player.inHeli && !player.parachuting) {
        player.triggerJump();
      }
    }
  }
  if (!e.repeat && e.code === 'KeyX' && player.inCar) {
    player.resetCarPosition();
  }
  keys[e.code] = true;
  if (e.repeat) return;

  if (e.code === 'KeyE') player.triggerEAction();
  if (e.code === 'KeyG') player.toggleHelicopter();
  if (e.code === 'KeyR') player.toggleCar();
  if (e.code === 'KeyF') toggleSightseeingBus();
  if (e.code === 'KeyB') living.toggleBusSpeed();
  if (e.code === 'KeyT') {
    setDockLabel('btn-time', sky.cycleMode().replace(/^[^\u4e00-\u9fa5]+/, ''));
  }
  if (e.code === 'KeyQ') {
    setDockLabel('btn-season', cycleSeason().replace(/^[^\u4e00-\u9fa5]+/, ''));
  }
  if (e.code === 'KeyM') {
    const active = toggleMinghuShow();
    setDockLabel('btn-show', active ? '演艺中' : '明湖秀', active);
  }
  if (e.code === 'KeyL') {
    if (sky.chaoranLit) {
      sky.setChaoranLit(false);
      setDockLabel('btn-light', '超然亮灯', false);
    } else {
      hud.triggerLightCeremony();
    }
  }
  if (e.code === 'KeyP') doPhoto();
  if (e.code === 'KeyV') director.toggleTour();
  if (e.code === 'KeyH') doFeedFish();
  if (e.code === 'KeyN') {
    sound.unlock();
    const enabled = sound.toggleMute();
    document.getElementById('btn-audio')?.classList.toggle('muted', !enabled);
    setDockLabel('btn-audio', enabled ? '音效' : '已静音');
  }
  if (e.code === 'Escape') {
    document.getElementById('postcard-modal')?.classList.remove('show');
    director.stopTour();
  }
  if (director.active && ['KeyW', 'KeyA', 'KeyS', 'KeyD'].includes(e.code)) {
    director.stopTour();
  }
});
window.addEventListener('keyup', (e) => { keys[e.code] = false; });

// 多点触控（手机横屏虚拟摇杆 + 单指转视角 + 双指捏合缩放 + 桌面鼠标拖拽通用）
const touchControls = new TouchControls(renderer.domElement, player, keys, {
  onAction: () => {
    const nearBus = !player.ridingBus && living.findNearbyBus(player.pos.x, player.pos.z, 15);
    if (nearBus) toggleSightseeingBus();
    else player.triggerEAction();
  },
  onHeli: () => player.toggleHelicopter(),
  onCar: () => player.toggleCar(),
  onBus: () => toggleSightseeingBus(),
});

renderer.domElement.addEventListener('wheel', (e) => {
  player.camDist = THREE.MathUtils.clamp(player.camDist + e.deltaY * 0.02, 6, 62);
}, { passive: true });

// 手机横屏折叠抽屉、小地图切换与一键全屏
const hudRightEl = document.getElementById('hud-right');
const hudBottomEl = document.getElementById('hud-bottom');
document.getElementById('btn-map-toggle')?.addEventListener('click', () => {
  if (window.innerWidth <= 920) hudRightEl.classList.toggle('open');
  else hudRightEl.classList.toggle('collapsed');
});
document.getElementById('btn-scene-drawer')?.addEventListener('click', () => hudBottomEl.classList.toggle('open'));
document.getElementById('btn-fullscreen')?.addEventListener('click', () => {
  if (!document.fullscreenElement) {
    document.documentElement.requestFullscreen?.().then(() => {
      screen.orientation?.lock?.('landscape').catch(() => {});
    }).catch(() => {});
  } else {
    document.exitFullscreen?.().catch(() => {});
  }
});

// 主循环
const clock = new THREE.Clock();
let elapsed = 0;

function animate() {
  requestAnimationFrame(animate);
  const dt = Math.min(0.05, clock.getDelta());
  elapsed += dt;

  living.update(dt, elapsed, player, !!world.palette.showLotus);
  const inDirector = director.update(dt);
  if (!inDirector) {
    player.update(dt, keys, elapsed, camera, sky.nightFactor, touchControls);
    player.updateCamera(camera);
    world.update(player.pos.x, player.pos.z, 3);
  }
  world.updateHeroLotuses(elapsed, dt, player);
  world.setNightFactor(sky.nightFactor);
  water.update(elapsed, player, coreRefs.cruises, living.rippleEvents);
  districts.update(dt, elapsed, sky.nightFactor, player.pos);
  const focusPos = inDirector ? camera.position : player.pos;
  weather.update(elapsed, focusPos, sky.nightFactor);
  minghuShow.update(dt, elapsed);
  sky.update(dt, focusPos);
  sound.update(player);
  hud.update(dt, player, living);
  touchControls.syncUI(player, living);

  sky.render();
}
animate();
