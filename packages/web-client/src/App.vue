<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref, shallowRef, watch } from 'vue';
import { DamingLakeGame } from '@daminghu/engine-core';
import { WEAPON_CATALOG } from '@daminghu/shared';
import GameHud from './components/GameHud.vue';
import { useGameStore } from './stores/gameStore';

const stageRef = ref<HTMLElement | null>(null);
const game = shallowRef<DamingLakeGame | null>(null);
const initState = ref<'loading' | 'ready' | 'error'>('loading');
const initError = ref('');
const store = useGameStore();

function mountGame() {
  if (!stageRef.value) return;
  game.value?.dispose();
  game.value = null;
  initState.value = 'loading';
  initError.value = '';

  try {
    const instance = new DamingLakeGame(
      stageRef.value,
      {
        onHudUpdate: (snapshot) => store.updateHud(snapshot),
        onNotice: (title, body) => store.showNotice(title, body),
        onKillFeed: (item) => store.pushKillFeed(item),
        onHitFeedback: (evt) => store.triggerHitFeedback(evt),
        onPlayerDamaged: () => store.triggerPlayerHurt(),
        onWeaponSlotHotkey: (slot) => {
          const w = WEAPON_CATALOG.find((item) => item.slot === slot);
          if (!w) return;
          if (store.unlockedWeapons.includes(w.id)) {
            game.value?.setWeapon(w.id);
            return;
          }
          store.requestQuiz({
            title: `解锁免费武器 · ${w.name}`,
            subtitle: '答对 1 道趣味古诗/数学题即可立即上手（快捷键 1/2/3 随时切换）',
            requiredCount: 1,
            mandatory: false,
            onSuccess: () => {
              store.unlockWeapon(w.id);
              game.value?.setWeapon(w.id);
              store.showNotice('武器解锁', `已装备「${w.name}」，可随时按 1/2/3 切换！`);
            },
          });
        },
        onRoomUpdate: (roomSnap) => store.updateRoom(roomSnap),
        onChatBubble: (evt) => store.pushChatBubble(evt),
        onMatchEnd: (res) => store.setMatchResult(res),
      },
      {
        playerName: store.playerNickname,
        initialVisitedIds: store.visitedLandmarks,
      },
    );
    store.landmarks = instance.getLandmarks();
    game.value = instance;
    initState.value = 'ready';

    // 识别分享链接或扫码 URL 中的 ?room=XXXXXX 参数，自动弹出快捷进房入口
    const params = new URLSearchParams(window.location.search);
    const inviteCode = params.get('room')?.trim().toUpperCase().replace(/[^A-Z0-9]/g, '');
    if (inviteCode && inviteCode.length >= 4) {
      store.pendingInviteCode = inviteCode;
    }
  } catch (err) {
    initState.value = 'error';
    initError.value =
      err instanceof Error && err.message
        ? err.message
        : '当前浏览器未能启动 3D WebGL 渲染，请开启硬件加速或更换支持 WebGL 的浏览器后重试。';
  }
}

onMounted(() => {
  mountGame();
});

watch(
  () => store.playerNickname,
  (name) => {
    game.value?.setPlayerName(name);
  },
);

// 打开弹窗/车库时拦截快捷键，打开 3D 展台时暂停主场景渲染避免双 WebGL 争抢帧率
watch(
  () => ({
    garageOpen: store.garageOpen,
    garageTab: store.garageTab,
    landmarksOpen: store.landmarksOpen,
    hasQuiz: !!store.activeQuiz,
    hasPostcard: !!store.postcard,
    hasResult: !!store.matchResult,
  }),
  (state) => {
    const anyModal = state.garageOpen || state.landmarksOpen || state.hasQuiz || state.hasPostcard || state.hasResult;
    const showcaseActive = state.garageOpen && (state.garageTab === 'skins' || state.garageTab === 'weapons');
    game.value?.setInputBlocked(anyModal);
    game.value?.setRenderPaused(showcaseActive);
  },
);

onBeforeUnmount(() => {
  game.value?.dispose();
  game.value = null;
});
</script>

<template>
  <div class="game-stage">
    <div ref="stageRef" class="webgl-host" />
    <GameHud v-if="initState === 'ready'" :game="game" />
    <div v-else-if="initState === 'error'" class="modal-backdrop" role="alertdialog" aria-modal="true">
      <div class="quiz-card" style="max-width: 440px; text-align: center;">
        <h3>3D 场景初始化失败</h3>
        <p style="margin: 12px 0 18px; line-height: 1.6; opacity: 0.9;">
          {{ initError }}
        </p>
        <button class="primary-btn" @click="mountGame">重新初始化</button>
      </div>
    </div>
  </div>
</template>
