<script setup lang="ts">
import { computed, onBeforeUnmount, reactive, ref, watch } from 'vue';
import type { DamingLakeGame } from '@daminghu/engine-core';
import { useGameStore } from '../stores/gameStore';

const props = defineProps<{
  game: DamingLakeGame | null;
}>();

const store = useGameStore();

const isCar = computed(() => store.hud.vehicle === 'car');
const isHeli = computed(() => store.hud.vehicle === 'heli');
const isParachute = computed(() => store.hud.vehicle === 'parachute');
const isBoat = computed(() => store.hud.vehicle === 'boat');
const isSwim = computed(() => store.hud.vehicle === 'swim');
const isBus = computed(() => store.hud.vehicle === 'bus');
const isPassiveRide = computed(
  () =>
    store.hud.isPassenger ||
    store.hud.vehicle === 'bus' ||
    store.hud.vehicle === 'ferris' ||
    store.hud.vehicle === 'cruise',
);
const hasWeapon = computed(() => store.hud.weaponId !== null);

const primaryLabel = computed(() => {
  if (isHeli.value) return '爬升';
  if (isParachute.value) return '呼飞机';
  if (isBoat.value) return '疾划';
  if (isSwim.value) return '上岸';
  return '跳跃';
});

const heliBtnLabel = computed(() => {
  if (isHeli.value) return store.hud.altitude > 5 ? '跳伞' : '降落';
  if (isParachute.value) return '呼飞机';
  return '飞机';
});

// ===== 虚拟摇杆状态 =====
const joyBaseRef = ref<HTMLElement | null>(null);
const knobX = ref(0);
const knobY = ref(0);
let joyPointerId: number | null = null;
let joyCenter = { x: 0, y: 0 };
const MAX_JOY_R = 42;

function updateJoyKnob(clientX: number, clientY: number) {
  const dx = clientX - joyCenter.x;
  const dy = clientY - joyCenter.y;
  const dist = Math.hypot(dx, dy);
  const clamped = Math.min(MAX_JOY_R, dist);
  const ang = Math.atan2(dy, dx);
  const kx = Math.cos(ang) * clamped;
  const ky = Math.sin(ang) * clamped;
  knobX.value = kx;
  knobY.value = ky;
  const moveX = clamped > 6 ? kx / MAX_JOY_R : 0;
  const moveZ = clamped > 6 ? -ky / MAX_JOY_R : 0;
  props.game?.setVirtualJoystick(moveX, moveZ);
}

function onJoyDown(e: PointerEvent) {
  e.stopPropagation();
  e.preventDefault();
  const el = joyBaseRef.value;
  if (!el) return;
  el.setPointerCapture(e.pointerId);
  joyPointerId = e.pointerId;
  const rect = el.getBoundingClientRect();
  joyCenter = { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
  updateJoyKnob(e.clientX, e.clientY);
}

function onJoyMove(e: PointerEvent) {
  if (e.pointerId !== joyPointerId) return;
  e.stopPropagation();
  e.preventDefault();
  updateJoyKnob(e.clientX, e.clientY);
}

function resetJoy(e?: PointerEvent) {
  if (e && e.pointerId !== joyPointerId) return;
  joyPointerId = null;
  knobX.value = 0;
  knobY.value = 0;
  props.game?.setVirtualJoystick(0, 0);
}

// ===== 长按虚拟按键状态 =====
const held = reactive<Record<string, boolean>>({});
let fireInterval: number | null = null;

function setHold(code: string, down: boolean, e?: PointerEvent) {
  if (e) {
    e.stopPropagation();
    e.preventDefault();
  }
  held[code] = down;
  props.game?.setVirtualKey(code, down);
}

function onPrimaryDown(e: PointerEvent) {
  e.stopPropagation();
  e.preventDefault();
  if (isParachute.value) {
    props.game?.toggleHeli();
    return;
  }
  if (isBoat.value) {
    setHold('ShiftLeft', true);
    return;
  }
  held.Space = true;
  props.game?.setVirtualKey('Space', true);
  if (!isHeli.value) {
    props.game?.triggerJump();
  }
}

function onPrimaryUp(e: PointerEvent) {
  e.stopPropagation();
  if (held.Space) {
    held.Space = false;
    props.game?.setVirtualKey('Space', false);
  }
  if (held.ShiftLeft) {
    held.ShiftLeft = false;
    props.game?.setVirtualKey('ShiftLeft', false);
  }
}

function onFireDown(e: PointerEvent) {
  e.stopPropagation();
  e.preventDefault();
  held.Fire = true;
  props.game?.fireWeapon();
  if (fireInterval !== null) window.clearInterval(fireInterval);
  fireInterval = window.setInterval(() => {
    if (held.Fire) props.game?.fireWeapon();
  }, 180);
}

function onFireUp(e?: PointerEvent) {
  if (e) e.stopPropagation();
  held.Fire = false;
  if (fireInterval !== null) {
    window.clearInterval(fireInterval);
    fireInterval = null;
  }
}

function onTap(fn: () => void, e: PointerEvent) {
  e.stopPropagation();
  e.preventDefault();
  fn();
}

function releaseAllInputs() {
  resetJoy();
  onFireUp();
  for (const key of Object.keys(held)) {
    if (held[key]) {
      held[key] = false;
      props.game?.setVirtualKey(key, false);
    }
  }
}

// 切换载具模式时清理残留按住状态，防止换载具后卡键
watch(
  () => store.hud.vehicle,
  () => {
    releaseAllInputs();
  },
);

onBeforeUnmount(() => {
  releaseAllInputs();
});
</script>

<template>
  <div class="mobile-controls-root">
    <!-- 模式 A：步行 / 游泳 / 划船 / 直升机 / 跳伞 / 观光车 / 摩天轮 / 画舫 -->
    <template v-if="!isCar">
      <!-- 左下角：360° 双环磨砂虚拟摇杆（乘坐被动观光载具时隐藏，视野更纯净） -->
      <div
        v-if="!isPassiveRide"
        ref="joyBaseRef"
        class="m-joy-base interactive"
        @pointerdown="onJoyDown"
        @pointermove="onJoyMove"
        @pointerup="resetJoy"
        @pointercancel="resetJoy"
      >
        <div class="m-joy-ring" />
        <div
          class="m-joy-knob"
          :style="{ transform: `translate3d(${knobX}px, ${knobY}px, 0)` }"
        />
      </div>

      <!-- 右下角：手游多点触控动作区 -->
      <div class="m-action-zone">
        <!-- 快捷载具栏（飞机/跳伞、跑车、观光车） -->
        <div class="m-vehicle-strip">
          <button
            class="m-chip-btn"
            :class="{ active: isHeli || isParachute }"
            aria-label="直升机与跳伞"
            @pointerdown="(e) => onTap(() => game?.toggleHeli(), e)"
          >
            <svg class="m-ico" viewBox="0 0 24 24">
              <path d="M3 6h18M12 6v4m-5 0h9l3 3v3H7v-6zm-4 3h4m-1 6h12" />
            </svg>
            <span>{{ heliBtnLabel }}</span>
          </button>

          <button
            class="m-chip-btn"
            aria-label="敞篷跑车"
            @pointerdown="(e) => onTap(() => game?.toggleCar(), e)"
          >
            <svg class="m-ico" viewBox="0 0 24 24">
              <path d="M3 14l2-5h14l2 5v4h-2a2 2 0 1 1-4 0H9a2 2 0 1 1-4 0H3v-4z" />
            </svg>
            <span>跑车</span>
          </button>

          <button
            class="m-chip-btn"
            :class="{ active: isBus }"
            aria-label="环湖观光车"
            @pointerdown="(e) => onTap(() => game?.toggleBus(), e)"
          >
            <svg class="m-ico" viewBox="0 0 24 24">
              <rect x="4" y="5" width="16" height="12" rx="2" />
              <path d="M4 11h16M7 17v2m10-2v2" />
            </svg>
            <span>观光车</span>
          </button>
        </div>

        <!-- 主动作圆键组（动态互动 / 飞行下降 / 跳跃或爬升或疾划 / 开火） -->
        <div class="m-main-pad">
          <button
            v-if="store.hud.actionCanAct && store.hud.actionLabel"
            class="m-circle-btn m-act-btn"
            @pointerdown="(e) => onTap(() => game?.triggerEAction(), e)"
          >
            {{ store.hud.actionLabel }}
          </button>

          <button
            v-if="isHeli"
            class="m-circle-btn m-descend-btn"
            :class="{ active: held.KeyC }"
            aria-label="下降"
            @pointerdown="(e) => setHold('KeyC', true, e)"
            @pointerup="(e) => setHold('KeyC', false, e)"
            @pointercancel="(e) => setHold('KeyC', false, e)"
            @pointerleave="(e) => setHold('KeyC', false, e)"
          >
            <svg class="m-ico" viewBox="0 0 24 24">
              <path d="M12 5v14m-5-5l5 5 5-5" />
            </svg>
            <span>下降</span>
          </button>

          <button
            v-if="!isPassiveRide"
            class="m-circle-btn m-primary-btn"
            :class="{ active: held.Space || held.ShiftLeft, heli: isHeli, boat: isBoat }"
            @pointerdown="onPrimaryDown"
            @pointerup="onPrimaryUp"
            @pointercancel="onPrimaryUp"
            @pointerleave="onPrimaryUp"
          >
            <span>{{ primaryLabel }}</span>
          </button>

          <button
            v-if="hasWeapon"
            class="m-circle-btn m-fire-btn"
            :class="{ active: held.Fire }"
            @pointerdown="onFireDown"
            @pointerup="onFireUp"
            @pointercancel="onFireUp"
            @pointerleave="onFireUp"
          >
            <span>开火</span>
          </button>
        </div>
      </div>
    </template>

    <!-- 模式 B：敞篷跑车专属《和平精英 / QQ 飞车》双区驾驶按键层 -->
    <template v-else>
      <!-- 左下角：左右转向键 -->
      <div class="m-drive-steer">
        <button
          class="m-drive-btn m-steer-btn"
          :class="{ active: held.CarLeft }"
          aria-label="左转"
          @pointerdown="(e) => setHold('CarLeft', true, e)"
          @pointerup="(e) => setHold('CarLeft', false, e)"
          @pointercancel="(e) => setHold('CarLeft', false, e)"
          @pointerleave="(e) => setHold('CarLeft', false, e)"
        >
          <svg class="m-ico-lg" viewBox="0 0 24 24"><path d="M15 6l-6 6 6 6" /></svg>
        </button>
        <button
          class="m-drive-btn m-steer-btn"
          :class="{ active: held.CarRight }"
          aria-label="右转"
          @pointerdown="(e) => setHold('CarRight', true, e)"
          @pointerup="(e) => setHold('CarRight', false, e)"
          @pointercancel="(e) => setHold('CarRight', false, e)"
          @pointerleave="(e) => setHold('CarRight', false, e)"
        >
          <svg class="m-ico-lg" viewBox="0 0 24 24"><path d="M9 6l6 6-6 6" /></svg>
        </button>
      </div>

      <!-- 右下角：油门 / 加速 / 漂移 / 后退 / 复位 / 下车 -->
      <div class="m-drive-pedals">
        <div class="m-drive-top-row">
          <button
            class="m-drive-btn m-util-btn"
            @pointerdown="(e) => onTap(() => game?.resetCar(), e)"
          >
            复位
          </button>
          <button
            class="m-drive-btn m-util-btn m-drift-btn"
            :class="{ active: held.CarDrift }"
            @pointerdown="(e) => setHold('CarDrift', true, e)"
            @pointerup="(e) => setHold('CarDrift', false, e)"
            @pointercancel="(e) => setHold('CarDrift', false, e)"
            @pointerleave="(e) => setHold('CarDrift', false, e)"
          >
            漂移
          </button>
          <button
            class="m-drive-btn m-util-btn m-exit-btn"
            @pointerdown="(e) => onTap(() => game?.toggleCar(), e)"
          >
            下车
          </button>
        </div>

        <div class="m-drive-main-row">
          <button
            class="m-drive-btn m-brake-btn"
            :class="{ active: held.CarBrake }"
            @pointerdown="(e) => setHold('CarBrake', true, e)"
            @pointerup="(e) => setHold('CarBrake', false, e)"
            @pointercancel="(e) => setHold('CarBrake', false, e)"
            @pointerleave="(e) => setHold('CarBrake', false, e)"
          >
            后退
          </button>
          <button
            class="m-drive-btn m-boost-btn"
            :class="{ active: held.CarBoost }"
            @pointerdown="(e) => setHold('CarBoost', true, e)"
            @pointerup="(e) => setHold('CarBoost', false, e)"
            @pointercancel="(e) => setHold('CarBoost', false, e)"
            @pointerleave="(e) => setHold('CarBoost', false, e)"
          >
            加速
          </button>
          <button
            class="m-drive-btn m-gas-btn"
            :class="{ active: held.CarGas }"
            @pointerdown="(e) => setHold('CarGas', true, e)"
            @pointerup="(e) => setHold('CarGas', false, e)"
            @pointercancel="(e) => setHold('CarGas', false, e)"
            @pointerleave="(e) => setHold('CarGas', false, e)"
          >
            前进
          </button>
        </div>
      </div>
    </template>
  </div>
</template>
