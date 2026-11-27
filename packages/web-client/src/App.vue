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
  });
  store.landmarks = instance.getLandmarks();
  game.value = instance;
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
