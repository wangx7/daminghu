<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref, shallowRef } from 'vue';
import { DamingLakeGame } from '@daminghu/engine-core';
import GameHud from './components/GameHud.vue';
import { useGameStore } from './stores/gameStore';

const stageRef = ref<HTMLElement | null>(null);
const game = shallowRef<DamingLakeGame | null>(null);
const store = useGameStore();

onMounted(() => {
  if (!stageRef.value) return;
  const instance = new DamingLakeGame(stageRef.value, {
    onHudUpdate: (snapshot) => store.updateHud(snapshot),
    onNotice: (title, body) => store.showNotice(title, body),
    onKillFeed: (item) => store.pushKillFeed(item),
    onRoomUpdate: (roomSnap) => store.updateRoom(roomSnap),
    onChatBubble: (evt) => store.pushChatBubble(evt),
    onMatchEnd: (res) => store.setMatchResult(res),
  });
  store.landmarks = instance.getLandmarks();
  game.value = instance;

  // 识别分享链接或扫码 URL 中的 ?room=XXXXXX 参数，自动弹出快捷进房入口
  const params = new URLSearchParams(window.location.search);
  const inviteCode = params.get('room')?.trim().toUpperCase().replace(/[^A-Z0-9]/g, '');
  if (inviteCode && inviteCode.length >= 4) {
    store.pendingInviteCode = inviteCode;
  }
});

onBeforeUnmount(() => {
  game.value?.dispose();
  game.value = null;
});
</script>

<template>
  <div class="game-stage">
    <div ref="stageRef" class="webgl-host" />
    <GameHud :game="game" />
  </div>
</template>
