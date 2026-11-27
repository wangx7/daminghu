<script setup lang="ts">
import { computed } from 'vue';
import type { DamingLakeGame } from '@daminghu/engine-core';
import { useGameStore } from '../stores/gameStore';

const props = defineProps<{
  game: DamingLakeGame | null;
}>();

const store = useGameStore();

const titleText = computed(() => {
  const res = store.matchResult;
  if (!res) return '';
  if (res.mode === 'ffa') return `🏆 个人混战冠军 · ${res.mvpName}`;
  if (res.winnerTeam === 'red') return '🚩 超然红队 获胜！';
  if (res.winnerTeam === 'blue') return '🚩 历下蓝队 获胜！';
  return '🤝 势均力敌 · 平局！';
});

function playAgain() {
  store.setMatchResult(null);
  props.game?.startMultiplayerMatch();
}

function closeModal() {
  store.setMatchResult(null);
}
</script>

<template>
  <div v-if="store.matchResult" class="modal-backdrop" @click.self="closeModal">
    <div class="guofeng-modal match-result-modal">
      <div class="modal-header">
        <h3>{{ titleText }}</h3>
        <button class="close-btn" @click="closeModal">✕</button>
      </div>

      <div v-if="store.matchResult.mode === 'team'" class="result-score-banner">
        <div class="team-score red">
          <span>超然红</span>
          <strong>{{ store.matchResult.redScore }}</strong>
        </div>
        <span class="skin-pill">MVP · {{ store.matchResult.mvpName }}</span>
        <div class="team-score blue">
          <strong>{{ store.matchResult.blueScore }}</strong>
          <span>历下蓝</span>
        </div>
      </div>

      <div class="result-rank-list">
        <div
          v-for="(row, idx) in store.matchResult.rankings"
          :key="row.id"
          class="mp-member-row"
          :class="row.team"
        >
          <div class="mp-member-left">
            <span class="guide-num">#{{ idx + 1 }}</span>
            <strong>{{ row.name }}</strong>
          </div>
          <div class="mp-member-right">
            <span>淘汰 {{ row.kills }}</span>
            <span class="coord-line">倒地 {{ row.deaths }}</span>
          </div>
        </div>
      </div>

      <div class="btn-wrap" style="justify-content: flex-end; margin-top: 14px">
        <button class="guofeng-btn" @click="closeModal">返回大明湖</button>
        <button v-if="store.room.isHost" class="primary-btn" @click="playAgain">再来一局</button>
      </div>
    </div>
  </div>
</template>
