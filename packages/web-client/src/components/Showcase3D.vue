<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref, watch } from 'vue';
import * as THREE from 'three';
import { SKIN_MAP, WEAPON_MAP, type EquippedWeaponId, type SkinId } from '@daminghu/shared';
import { buildSeasonalTuanMesh, buildWeaponMesh, disposeObject3D } from '@daminghu/engine-core';

const props = defineProps<{
  skinId: SkinId;
  weaponId: EquippedWeaponId;
}>();

const hostRef = ref<HTMLElement | null>(null);

let renderer: THREE.WebGLRenderer | null = null;
let scene: THREE.Scene | null = null;
let camera: THREE.PerspectiveCamera | null = null;
let avatarGroup: THREE.Group | null = null;
let ringMesh: THREE.Mesh | null = null;
let rafId = 0;
let rotY = 0.45;
let dragging = false;
let lastX = 0;

function rebuildAvatar() {
  if (!avatarGroup) return;
  while (avatarGroup.children.length > 0) {
    const child = avatarGroup.children[0];
    avatarGroup.remove(child);
    disposeObject3D(child);
  }
  const tuan = buildSeasonalTuanMesh(SKIN_MAP[props.skinId]);
  tuan.position.y = 0.12;
  avatarGroup.add(tuan);

  if (props.weaponId !== null) {
    const weapon = buildWeaponMesh(WEAPON_MAP[props.weaponId]);
    weapon.position.set(0.92, 0.98, 0.36);
    weapon.rotation.y = 0.18;
    avatarGroup.add(weapon);
  }
}

function resize() {
  if (!hostRef.value || !renderer || !camera) return;
  const w = Math.max(120, hostRef.value.clientWidth);
  const h = Math.max(96, hostRef.value.clientHeight);
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
  renderer.setSize(w, h);
}

onMounted(() => {
  if (!hostRef.value) return;
  scene = new THREE.Scene();

  camera = new THREE.PerspectiveCamera(36, 1, 0.1, 40);
  camera.position.set(0, 1.85, 5.2);
  camera.lookAt(0, 1.05, 0);

  renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.15;
  hostRef.value.appendChild(renderer.domElement);

  // QQ 飞车车库展台三点打光
  scene.add(new THREE.AmbientLight(0xdbeafe, 0.95));
  const keyLight = new THREE.DirectionalLight(0xfff4d6, 1.65);
  keyLight.position.set(3.5, 6, 4.5);
  scene.add(keyLight);
  const rimLight = new THREE.DirectionalLight(0x38bdf8, 1.15);
  rimLight.position.set(-4, 3.5, -3.5);
  scene.add(rimLight);

  // 霓虹鎏金旋转展台底座
  const podium = new THREE.Mesh(
    new THREE.CylinderGeometry(1.45, 1.68, 0.24, 32),
    new THREE.MeshStandardMaterial({ color: 0x162636, roughness: 0.35, metalness: 0.55 }),
  );
  podium.position.y = -0.14;
  scene.add(podium);

  ringMesh = new THREE.Mesh(
    new THREE.RingGeometry(1.36, 1.5, 48),
    new THREE.MeshBasicMaterial({ color: 0xd9b468, side: THREE.DoubleSide, transparent: true, opacity: 0.85 }),
  );
  ringMesh.rotation.x = -Math.PI / 2;
  ringMesh.position.y = 0.0;
  scene.add(ringMesh);

  avatarGroup = new THREE.Group();
  scene.add(avatarGroup);
  rebuildAvatar();
  resize();

  const dom = renderer.domElement;
  dom.addEventListener('pointerdown', onDown);
  window.addEventListener('pointermove', onMove);
  window.addEventListener('pointerup', onUp);
  window.addEventListener('pointercancel', onUp);
  window.addEventListener('resize', resize);

  const start = performance.now();
  const tick = () => {
    rafId = requestAnimationFrame(tick);
    const t = (performance.now() - start) * 0.001;
    if (!dragging) rotY += 0.009;
    if (avatarGroup) {
      avatarGroup.rotation.y = rotY;
      avatarGroup.position.y = Math.sin(t * 2.4) * 0.05;
    }
    if (ringMesh) {
      ringMesh.rotation.z = t * 0.4;
    }
    renderer?.render(scene!, camera!);
  };
  tick();
});

function onDown(e: PointerEvent) {
  dragging = true;
  lastX = e.clientX;
}
function onMove(e: PointerEvent) {
  if (!dragging) return;
  rotY += (e.clientX - lastX) * 0.015;
  lastX = e.clientX;
}
function onUp() {
  dragging = false;
}

watch(() => [props.skinId, props.weaponId], rebuildAvatar);

onBeforeUnmount(() => {
  cancelAnimationFrame(rafId);
  renderer?.domElement.removeEventListener('pointerdown', onDown);
  window.removeEventListener('pointermove', onMove);
  window.removeEventListener('pointerup', onUp);
  window.removeEventListener('pointercancel', onUp);
  window.removeEventListener('resize', resize);
  if (scene) disposeObject3D(scene, { disposeTextures: true });
  renderer?.dispose();
  renderer?.domElement.remove();
});
</script>

<template>
  <div class="showcase-wrap">
    <div ref="hostRef" class="showcase-canvas" />
    <div class="showcase-tip">左右拖动 360° 赏析上手效果</div>
  </div>
</template>
