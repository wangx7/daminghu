<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import QRCode from 'qrcode';
import type { RoomMode, TeamId, TeamSize } from '@daminghu/shared';
import type { DamingLakeGame } from '@daminghu/engine-core';
import { useGameStore } from '../stores/gameStore';

const props = defineProps<{
  game: DamingLakeGame | null;
}>();

const store = useGameStore();
const nicknameInput = ref(store.playerNickname);
const joinCodeInput = ref(store.pendingInviteCode || '');
const qrDataUrl = ref('');
const copiedTip = ref(false);

const TEAM_SIZES: TeamSize[] = [1, 2, 3, 4, 5];

const isConnected = computed(() => store.room.status === 'connected');
const isBusy = computed(() => store.room.status === 'creating' || store.room.status === 'joining');
const isHost = computed(() => store.room.isHost);

const inviteUrl = computed(() => {
  if (!store.room.roomCode) return '';
  const url = new URL(window.location.href);
  url.searchParams.set('room', store.room.roomCode);
  return url.toString();
});

const localMember = computed(() => store.room.members.find((m) => m.id === store.room.localPlayerId) || null);

watch(
  inviteUrl,
  async (url) => {
    if (!url) {
      qrDataUrl.value = '';
      return;
    }
    try {
      qrDataUrl.value = await QRCode.toDataURL(url, {
        width: 164,
        margin: 1,
        color: { dark: '#101c29', light: '#fff9ee' },
      });
    } catch {
      qrDataUrl.value = '';
    }
  },
  { immediate: true },
);

watch(
  () => store.pendingInviteCode,
  (code) => {
    if (code) joinCodeInput.value = code;
  },
);

function handleCreateRoom() {
  store.setPlayerNickname(nicknameInput.value);
  props.game?.createMultiplayerRoom(store.playerNickname);
}

function handleJoinRoom() {
  store.setPlayerNickname(nicknameInput.value);
  store.pendingInviteCode = '';
  props.game?.joinMultiplayerRoom(joinCodeInput.value, store.playerNickname);
}

function handleLeaveRoom() {
  props.game?.leaveMultiplayerRoom();
}

function setMode(mode: RoomMode) {
  props.game?.updateRoomConfig({ mode });
}

function setTeamSize(teamSize: TeamSize) {
  props.game?.updateRoomConfig({ teamSize });
}

function toggleFillBots() {
  props.game?.updateRoomConfig({ fillBots: !store.room.config.fillBots });
}

function switchTeam(team: TeamId) {
  props.game?.switchRoomTeam(team);
}

function handleStartMatch() {
  store.matchResult = null;
  props.game?.startMultiplayerMatch();
  store.garageOpen = false;
}

async function copyInviteLink() {
  if (!inviteUrl.value) return;
  try {
    await navigator.clipboard.writeText(inviteUrl.value);
    copiedTip.value = true;
    store.showNotice('已复制邀请链接', '直接发给微信好友，点开就能秒进房间！');
    window.setTimeout(() => {
      copiedTip.value = false;
    }, 2000);
  } catch {
    store.showNotice('请手动复制', inviteUrl.value);
  }
}

function teleportToFriend(id: string) {
  props.game?.teleportToPlayer(id);
  store.garageOpen = false;
}
</script>

<template>
  <div class="mp-panel">
    <!-- 未进房状态：建房 / 输码加入 -->
    <template v-if="!isConnected">
      <div class="mp-hero">
        <strong>🌐 WebRTC P2P 跨网络直连开黑（零服务器 · 扫码即玩）</strong>
        <p>支持自由同游、个人混战（FFA）及 1v1 ~ 5v5 红蓝对抗，好友不在同一 Wi-Fi 也能点链接直连！</p>
      </div>

      <div class="mp-field">
        <label>我的江湖昵称</label>
        <input
          v-model="nicknameInput"
          class="mp-input"
          type="text"
          maxlength="12"
          placeholder="输入昵称（如：大明湖团团）"
        />
      </div>

      <div class="mp-entry-grid">
        <div class="item-card mp-box">
          <strong>🏠 我当房主 · 一键建房</strong>
          <span class="card-desc">生成 6 位房间码与面对面二维码，发链接邀请最多 9 位好友同屏畅玩。</span>
          <button class="primary-btn" :disabled="isBusy" @click="handleCreateRoom">
            {{ store.room.status === 'creating' ? '正在创建房间...' : '✨ 创建联机房间' }}
          </button>
        </div>

        <div class="item-card mp-box">
          <strong>🔗 加入好友房间</strong>
          <span class="card-desc">输入房主的 6 位房间码，或直接扫描房主屏幕上的二维码。</span>
          <div class="mp-join-row">
            <input
              v-model="joinCodeInput"
              class="mp-input code"
              type="text"
              maxlength="6"
              placeholder="6位房间码"
              @keyup.enter="handleJoinRoom"
            />
            <button class="guofeng-btn active" :disabled="isBusy || joinCodeInput.trim().length < 4" @click="handleJoinRoom">
              {{ store.room.status === 'joining' ? '连接中...' : '加入' }}
            </button>
          </div>
        </div>
      </div>

      <div v-if="store.room.errorMessage" class="mp-error">
        ⚠️ {{ store.room.errorMessage }}
      </div>
    </template>

    <!-- 已进房状态：房间码、二维码、玩法配置、队员列表 -->
    <template v-else>
      <div class="mp-room-head">
        <div class="mp-code-info">
          <div class="mp-code-row">
            <span class="skin-pill">{{ isHost ? '房主' : '成员' }}</span>
            <strong class="mp-code-text">{{ store.room.roomCode }}</strong>
            <span class="skin-pill">在线 {{ store.room.members.filter((m) => !m.isBot).length }} 人</span>
          </div>
          <div class="btn-wrap" style="margin-top: 8px">
            <button v-if="isHost" class="primary-btn mp-start-btn" @click="handleStartMatch">
              {{ store.room.phase === 'playing' ? '🔄 重新开局' : '🚀 开始联机游玩' }}
            </button>
            <button class="guofeng-btn active" @click="copyInviteLink">
              {{ copiedTip ? '✓ 已复制链接' : '📋 复制邀请链接' }}
            </button>
            <button class="guofeng-btn" @click="handleLeaveRoom">
              {{ isHost ? '解散房间' : '退出房间' }}
            </button>
          </div>
        </div>

        <div v-if="qrDataUrl" class="mp-qr-box">
          <img :src="qrDataUrl" alt="面对面扫码进房" />
          <span>面对面扫码秒进</span>
        </div>
      </div>

      <!-- 玩法配置区（房主可调，成员实时同步预览） -->
      <div class="section-label" style="margin-top: 12px">
        联机玩法模式 {{ isHost ? '（房主可随时切换）' : '（由房主配置）' }}
      </div>
      <div class="btn-wrap">
        <button
          class="guofeng-btn"
          :class="{ active: store.room.config.mode === 'coop_roam' }"
          :disabled="!isHost"
          @click="setMode('coop_roam')"
        >
          🌸 自由同游
        </button>
        <button
          class="guofeng-btn"
          :class="{ active: store.room.config.mode === 'ffa' }"
          :disabled="!isHost"
          @click="setMode('ffa')"
        >
          ⚔️ 个人混战 (FFA)
        </button>
        <button
          class="guofeng-btn"
          :class="{ active: store.room.config.mode === 'team' }"
          :disabled="!isHost"
          @click="setMode('team')"
        >
          🚩 团队对抗
        </button>
      </div>

      <div v-if="store.room.config.mode === 'team'" class="btn-wrap" style="margin-top: 8px">
        <button
          v-for="sz in TEAM_SIZES"
          :key="sz"
          class="guofeng-btn"
          :class="{ active: store.room.config.teamSize === sz }"
          :disabled="!isHost"
          @click="setTeamSize(sz)"
        >
          {{ sz }}v{{ sz }}
        </button>
      </div>

      <div v-if="store.room.config.mode !== 'coop_roam'" class="btn-wrap" style="margin-top: 8px">
        <button
          class="guofeng-btn"
          :class="{ active: store.room.config.fillBots }"
          :disabled="!isHost"
          @click="toggleFillBots"
        >
          空位自动补 AI：{{ store.room.config.fillBots ? '已开启' : '关闭（纯真人）' }}
        </button>
      </div>

      <!-- 团队模式下支持自由切换红/蓝队 -->
      <div v-if="store.room.config.mode === 'team'" class="btn-wrap" style="margin-top: 10px">
        <button
          class="guofeng-btn"
          :class="{ active: localMember?.team === 'red' }"
          @click="switchTeam('red')"
        >
          加入超然红
        </button>
        <button
          class="guofeng-btn"
          :class="{ active: localMember?.team === 'blue' }"
          @click="switchTeam('blue')"
        >
          加入历下蓝
        </button>
      </div>

      <!-- 房间成员列表 -->
      <div class="section-label" style="margin-top: 12px">
        房间成员（{{ store.room.members.length }}）
      </div>
      <div class="mp-member-list">
        <div
          v-for="m in store.room.members"
          :key="m.id"
          class="mp-member-row"
          :class="m.team"
        >
          <div class="mp-member-left">
            <span class="mp-team-dot" :class="m.team" />
            <strong>{{ m.name }}</strong>
            <span v-if="m.isHost" class="skin-pill">房主</span>
            <span v-if="m.id === store.room.localPlayerId" class="skin-pill">我</span>
          </div>
          <div class="mp-member-right">
            <span v-if="store.room.phase === 'playing'" class="coord-line">{{ m.kills }}杀 / {{ m.deaths }}倒</span>
            <button
              v-if="m.id !== store.room.localPlayerId && !m.isBot"
              class="unequip-btn"
              @click="teleportToFriend(m.id)"
            >
              传送
            </button>
          </div>
        </div>
      </div>

      <!-- 底部返回按钮 -->
      <div v-if="!isHost" class="mp-footer-actions">
        <button class="guofeng-btn" @click="store.garageOpen = false">
          返回大明湖场景
        </button>
      </div>
    </template>
  </div>
</template>
