<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import {
  SEASON_SKINS,
  SKIN_MAP,
  WEAPON_CATALOG,
  WEAPON_MAP,
  type BgmScene,
  type EquippedWeaponId,
  type GameMode,
  type QuizCategory,
  type SkinId,
  type WeaponId,
} from '@daminghu/shared';
import type { DamingLakeGame } from '@daminghu/engine-core';
import { useGameStore, type GarageTab } from '../stores/gameStore';
import Showcase3D from './Showcase3D.vue';
import QuizModal from './QuizModal.vue';
import MobileControls from './MobileControls.vue';

const props = defineProps<{
  game: DamingLakeGame | null;
}>();

const store = useGameStore();
const minimapCanvas = ref<HTMLCanvasElement | null>(null);
const bgmVol = ref(26);

// QQ 飞车车库左侧 3D 展台预览状态（可先 3D 预览再决定解锁/穿戴）
const previewSkinId = ref<SkinId>(store.hud.skinId);
const previewWeaponId = ref<EquippedWeaponId>(store.hud.weaponId);

const currentSkin = computed(() => SKIN_MAP[store.hud.skinId]);
const previewSkin = computed(() => SKIN_MAP[previewSkinId.value]);
const previewWeapon = computed(() => (previewWeaponId.value ? WEAPON_MAP[previewWeaponId.value] : null));
const equippedWeapon = computed(() => (store.hud.weaponId ? WEAPON_MAP[store.hud.weaponId] : null));

const matchTimerText = computed(() => {
  const s = Math.ceil(store.hud.scoreboard.timeRemainingSec);
  const mm = String(Math.floor(s / 60)).padStart(2, '0');
  const ss = String(s % 60).padStart(2, '0');
  return `${mm}:${ss}`;
});

// 儿童护眼防沉迷计时器
let playSeconds = 0;
let guardianTimer: number | null = null;

onMounted(() => {
  guardianTimer = window.setInterval(() => {
    if (!store.antiAddictionEnabled || store.activeQuiz) return;
    playSeconds++;
    if (playSeconds >= store.antiAddictionMinutes * 60) {
      playSeconds = 0;
      store.requestQuiz({
        title: '明湖书院 · 护眼防沉迷小测验',
        subtitle: `已畅游 ${store.antiAddictionMinutes} 分钟，活动一下眼睛并答对 2 题继续玩吧`,
        requiredCount: 2,
        mandatory: true,
        onSuccess: () => store.showNotice('护眼通关', '太棒啦！继续畅游大明湖吧～'),
      });
    }
  }, 1000);
});

onBeforeUnmount(() => {
  if (guardianTimer !== null) window.clearInterval(guardianTimer);
});

watch(
  () => [store.hud.x, store.hud.z, store.hud.yaw, store.hud.targets.length, store.hud.visitedIds.length],
  () => {
    if (minimapCanvas.value && props.game) {
      props.game.renderMinimap(minimapCanvas.value);
    }
  },
);

function openGarage(tab: GarageTab = 'skins') {
  previewSkinId.value = store.hud.skinId;
  previewWeaponId.value = store.hud.weaponId;
  store.garageTab = tab;
  store.garageOpen = true;
}

function handleSkinAction(id: SkinId) {
  previewSkinId.value = id;
  if (store.unlockedSkins.includes(id)) {
    props.game?.setSkin(id);
    return;
  }
  const skin = SKIN_MAP[id];
  store.requestQuiz({
    title: `解锁皮肤 · ${skin.name}`,
    subtitle: '答对 1 道趣味古诗/数学题即可免费穿戴',
    requiredCount: 1,
    mandatory: false,
    onSuccess: () => {
      store.unlockSkin(id);
      props.game?.setSkin(id);
    },
  });
}

function handleWeaponAction(id: EquippedWeaponId) {
  previewWeaponId.value = id;
  if (id === null) {
    props.game?.setWeapon(null);
    store.showNotice('已收起武器', '空手轻松漫游大明湖');
    return;
  }
  if (store.unlockedWeapons.includes(id)) {
    props.game?.setWeapon(id);
    return;
  }
  const w = WEAPON_MAP[id];
  store.requestQuiz({
    title: `解锁免费武器 · ${w.name}`,
    subtitle: '答对 1 道趣味古诗/数学题即可立即上手（可打鸟抓鱼/对战）',
    requiredCount: 1,
    mandatory: false,
    onSuccess: () => {
      store.unlockWeapon(id);
      props.game?.setWeapon(id);
      store.showNotice('武器解锁', `已装备「${w.name}」，去湖畔试试打鸟抓鱼吧！`);
    },
  });
}

function selectMode(mode: GameMode) {
  if (mode !== 'roam' && store.unlockedWeapons.length === 0) {
    store.unlockWeapon('spring_blaster');
  }
  props.game?.setGameMode(mode);
  store.garageOpen = false;
}

function triggerSampleQuiz() {
  store.requestQuiz({
    title: '明湖书院 · 状元趣味闯关',
    subtitle: '体验古诗与数学趣味出题',
    requiredCount: 1,
    mandatory: false,
    onSuccess: () => store.showNotice('状元闯关', '答对啦！大明湖小状元真厉害！'),
  });
}

function setQuizCategory(cat: QuizCategory) {
  store.quizCategory = cat;
}

function selectBgmScene(scene: BgmScene) {
  props.game?.setBgmScene(scene);
}

function onVolumeChange() {
  props.game?.setBgmVolume(bgmVol.value / 100);
}

function takePostcard() {
  if (!props.game) return;
  store.garageOpen = false;
  store.postcard = props.game.capturePostcardImage();
}

function downloadPostcard() {
  if (!store.postcard) return;
  const a = document.createElement('a');
  a.href = store.postcard.dataUrl;
  a.download = store.postcard.filename;
  a.click();
}
</script>

<template>
  <div class="hud-layer">
    <!-- 左上角：极简不挡视野的团团徽章胶囊 -->
    <div class="hud-tl interactive" @click="openGarage('skins')">
      <div class="avatar-seal">团</div>
      <div class="player-meta">
        <div class="player-name-row">
          <span>团团</span>
          <span class="skin-pill">{{ currentSkin.name }}</span>
        </div>
        <div class="coord-line">
          {{ store.hud.seasonLabel }} · 印章 {{ store.hud.visitedIds.length }}/{{ store.hud.totalLandmarks }}
        </div>
      </div>
    </div>

    <!-- 顶部中央：自由漫游时完全留空！仅在打鸟抓鱼或对战时显示轻量化计分条 -->
    <div class="hud-tc">
      <div v-if="store.hud.scoreboard.mode === 'hunt'" class="hunt-bar">
        <span>🕊️ 惊鸟 {{ store.hud.scoreboard.birdsCaught }}</span>
        <span>🐟 锦鲤 {{ store.hud.scoreboard.fishCaught }}</span>
      </div>

      <div
        v-else-if="store.hud.scoreboard.mode === 'practice_solo' || store.hud.scoreboard.mode === 'practice_team'"
        class="scoreboard-bar"
      >
        <div class="team-score red">
          <span>超然红</span>
          <strong>{{ store.hud.scoreboard.redScore }}</strong>
        </div>
        <div class="match-timer">{{ matchTimerText }}</div>
        <div class="team-score blue">
          <strong>{{ store.hud.scoreboard.blueScore }}</strong>
          <span>历下蓝</span>
        </div>
      </div>

      <div v-if="store.killFeed.length" class="kill-feed">
        <div v-for="item in store.killFeed" :key="item.id" class="kill-item" :class="item.team">
          {{ item.text }}
        </div>
      </div>
    </div>

    <!-- 中心提示 Toast -->
    <div v-if="store.notice" class="notice-toast">
      <strong>{{ store.notice.title }}</strong>
      <span>{{ store.notice.body }}</span>
    </div>

    <!-- 右上角：紧凑小地图 + 唯一统一「车库·设置」入口 -->
    <div class="hud-tr">
      <div class="minimap-card interactive">
        <canvas ref="minimapCanvas" class="minimap-canvas" width="220" height="118" @click="store.landmarksOpen = true" />
      </div>
      <button class="garage-entry-btn" @click="openGarage('skins')">
        <span class="gear-dot">⚙</span>
        <span>车库 · 设置</span>
      </button>
    </div>

    <!-- 左下角（手机端自动移至左上角下方避开摇杆）：乘坐载具时显示速度/海拔/氮气仪表 -->
    <div v-if="store.hud.vehicle !== 'foot'" class="hud-bl">
      <div class="vehicle-badge">
        <span class="speed-num">{{ store.hud.speedKmh }}</span>
        <div class="vehicle-meta">
          <span>KM/H · {{ store.hud.altitude }}m</span>
          <div v-if="store.hud.vehicle === 'car'" class="nitro-mini-bar">
            <i :style="{ width: `${Math.round(Math.max(0, Math.min(1, store.hud.nitroRatio)) * 100)}%` }" />
          </div>
        </div>
      </div>
    </div>

    <!-- 底部中央：靠近互动点时显示提示（可点击直接触发互动；手机端隐藏纯键盘快捷键提示） -->
    <div v-if="store.hud.nearPrompt" class="hud-bc" :class="{ 'desktop-only-hint': !store.hud.actionCanAct }">
      <button
        type="button"
        class="context-prompt"
        :class="{ clickable: store.hud.actionCanAct }"
        @click="store.hud.actionCanAct && game?.triggerEAction()"
      >
        {{ store.hud.nearPrompt }}
      </button>
    </div>

    <!-- 右下角：桌面端默认空手只留跳跃键，拿起武器后浮现开火与收枪；手机端动作键交由 MobileControls 接管 -->
    <div class="hud-br">
      <div v-if="equippedWeapon" class="armed-pill interactive">
        <span>{{ equippedWeapon.name }}</span>
        <button class="unequip-btn" @click="handleWeaponAction(null)">收起</button>
      </div>
      <div class="action-cluster desktop-only-actions">
        <button class="circle-btn jump" @click="game?.triggerJump()">跳跃</button>
        <button v-if="equippedWeapon" class="circle-btn fire" @click="game?.fireWeapon()">开火</button>
      </div>
    </div>

    <!-- 手机端 / 触控设备专属多点触控系统（摇杆 / 跑车双区驾驶 / 飞机爬升下降跳伞 / 划船互动） -->
    <MobileControls :game="game" />

    <!-- ===== QQ 飞车风格 3D 展示配置大厅（统一设置入口） ===== -->
    <div v-if="store.garageOpen" class="modal-backdrop" @click.self="store.garageOpen = false">
      <div class="qq-garage">
        <!-- 左侧：3D 旋转展示台 -->
        <div class="garage-left">
          <div class="garage-brand">
            <span class="brand-tag">明湖车库 · 3D 试衣与军械台</span>
            <h3>{{ previewSkin.name }}</h3>
            <p>{{ previewWeapon ? `手持：${previewWeapon.name}（${previewWeapon.role}）` : '当前状态：空手悠闲漫游' }}</p>
          </div>

          <Showcase3D :skin-id="previewSkinId" :weapon-id="previewWeaponId" />

          <div class="garage-left-footer">
            <span class="skin-pill">🕊️ 惊鸟 {{ store.hud.scoreboard.birdsCaught }}</span>
            <span class="skin-pill">🐟 锦鲤 {{ store.hud.scoreboard.fishCaught }}</span>
            <span class="skin-pill">📖 已答题 {{ store.totalQuizSolved }}</span>
          </div>
        </div>

        <!-- 右侧：功能标签与配置列表 -->
        <div class="garage-right">
          <div class="garage-tabs-bar">
            <div class="garage-tabs">
              <button :class="{ active: store.garageTab === 'skins' }" @click="store.garageTab = 'skins'">皮肤库</button>
              <button :class="{ active: store.garageTab === 'weapons' }" @click="store.garageTab = 'weapons'">武器库</button>
              <button :class="{ active: store.garageTab === 'modes' }" @click="store.garageTab = 'modes'">玩法载具</button>
              <button :class="{ active: store.garageTab === 'scene' }" @click="store.garageTab = 'scene'">景致丝竹</button>
              <button :class="{ active: store.garageTab === 'guardian' }" @click="store.garageTab = 'guardian'">出题护眼</button>
              <button :class="{ active: store.garageTab === 'guide' }" @click="store.garageTab = 'guide'">游玩教程</button>
            </div>
            <button class="close-btn" @click="store.garageOpen = false">✕</button>
          </div>

          <!-- Tab 1: 皮肤库 -->
          <div v-if="store.garageTab === 'skins'" class="garage-body">
            <div class="card-grid">
              <div
                v-for="skin in SEASON_SKINS"
                :key="skin.id"
                class="item-card"
                :class="{ equipped: previewSkinId === skin.id }"
                @click="previewSkinId = skin.id"
              >
                <div class="skin-swatch" :style="{ background: skin.previewGradient }">
                  <span>{{ skin.tag }}</span>
                  <span>{{ store.unlockedSkins.includes(skin.id) ? '已拥有' : '答题解锁' }}</span>
                </div>
                <strong>{{ skin.name }}</strong>
                <span class="card-desc">{{ skin.subtitle }}</span>
                <button class="primary-btn" @click.stop="handleSkinAction(skin.id)">
                  {{
                    store.hud.skinId === skin.id
                      ? '已穿戴'
                      : store.unlockedSkins.includes(skin.id)
                        ? '立即穿戴'
                        : '📖 答题免费解锁'
                  }}
                </button>
              </div>
            </div>
          </div>

          <!-- Tab 2: 武器库 -->
          <div v-else-if="store.garageTab === 'weapons'" class="garage-body">
            <div class="card-grid">
              <div
                class="item-card"
                :class="{ equipped: previewWeaponId === null }"
                @click="previewWeaponId = null"
              >
                <div class="weapon-head">
                  <strong>空手漫游</strong>
                  <span class="skin-pill">默认无对战</span>
                </div>
                <span class="card-desc">收起武器，纯享大明湖 1:1 实景风光、喂鱼划船与宣纸留影。</span>
                <button class="guofeng-btn" @click.stop="handleWeaponAction(null)">
                  {{ store.hud.weaponId === null ? '当前状态' : '收起武器' }}
                </button>
              </div>

              <div
                v-for="w in WEAPON_CATALOG"
                :key="w.id"
                class="item-card"
                :class="{ equipped: previewWeaponId === w.id }"
                @click="previewWeaponId = w.id"
              >
                <div class="weapon-head">
                  <strong>{{ w.name }}</strong>
                  <span class="skin-pill">{{ w.role }}</span>
                </div>
                <span class="card-desc">{{ w.description }}</span>
                <div class="stat-row">
                  <span>伤害</span>
                  <div class="stat-bar"><i :style="{ width: `${Math.min(100, w.damage * 2)}%` }" /></div>
                  <span>{{ w.damage }}</span>
                </div>
                <div class="stat-row">
                  <span>射速</span>
                  <div class="stat-bar"><i :style="{ width: `${Math.min(100, (1 / w.cooldownSec) * 20)}%` }" /></div>
                  <span>{{ (1 / w.cooldownSec).toFixed(1) }}/s</span>
                </div>
                <div class="stat-row">
                  <span>射程</span>
                  <div class="stat-bar"><i :style="{ width: `${Math.min(100, (w.maxRange / 220) * 100)}%` }" /></div>
                  <span>{{ w.maxRange }}m</span>
                </div>
                <button class="primary-btn" @click.stop="handleWeaponAction(w.id)">
                  {{
                    store.hud.weaponId === w.id
                      ? '已上手'
                      : store.unlockedWeapons.includes(w.id)
                        ? '立即上手'
                        : '📖 答题免费解锁'
                  }}
                </button>
              </div>
            </div>
          </div>

          <!-- Tab 3: 玩法与载具 -->
          <div v-else-if="store.garageTab === 'modes'" class="garage-body">
            <div class="section-label">玩法模式</div>
            <div class="card-grid">
              <div class="item-card" :class="{ equipped: store.hud.scoreboard.mode === 'roam' }">
                <strong>自由漫游（默认）</strong>
                <span class="card-desc">无对战、空手赏景、21 景点印章打卡。</span>
                <button class="guofeng-btn" @click="selectMode('roam')">切换自由漫游</button>
              </div>
              <div class="item-card" :class="{ equipped: store.hud.scoreboard.mode === 'hunt' }">
                <strong>🕊️ 打鸟抓鱼趣味挑战</strong>
                <span class="card-desc">拿起武器在湖畔惊飞白鹭翠鸟、用水炮捕获大明湖锦鲤！</span>
                <button class="primary-btn" @click="selectMode('hunt')">开始打鸟抓鱼</button>
              </div>
              <div class="item-card" :class="{ equipped: store.hud.scoreboard.mode === 'practice_solo' }">
                <strong>单排试炼（AI 靶场）</strong>
                <span class="card-desc">6 名移动游侠靶练习枪法，备战 Stage 2 局域网单排。</span>
                <button class="guofeng-btn" @click="selectMode('practice_solo')">进入单排试炼</button>
              </div>
              <div class="item-card" :class="{ equipped: store.hud.scoreboard.mode === 'practice_team' }">
                <strong>红蓝对抗练习（4v4）</strong>
                <span class="card-desc">超然红 vs 历下蓝 AI 阵营对抗演练。</span>
                <button class="guofeng-btn" @click="selectMode('practice_team')">进入红蓝练习</button>
              </div>
            </div>

            <div class="section-label" style="margin-top: 14px">快捷载具与留影</div>
            <div class="btn-wrap">
              <button class="guofeng-btn" :class="{ active: store.hud.vehicle === 'car' }" @click="game?.toggleCar(); store.garageOpen = false">
                敞篷跑车 (R)
              </button>
              <button class="guofeng-btn" :class="{ active: store.hud.vehicle === 'heli' }" @click="game?.toggleHeli(); store.garageOpen = false">
                直升机 / 跳伞 (G)
              </button>
              <button class="guofeng-btn" :class="{ active: store.hud.vehicle === 'bus' }" @click="game?.toggleBus(); store.garageOpen = false">
                环湖观光车 (F)
              </button>
              <button class="guofeng-btn" @click="game?.feedFish(); store.garageOpen = false">湖畔喂鱼 (H)</button>
              <button class="primary-btn" @click="takePostcard">📷 拍宣纸明信片</button>
            </div>
          </div>

          <!-- Tab 4: 景致与梦幻西游风丝竹 BGM -->
          <div v-else-if="store.garageTab === 'scene'" class="garage-body">
            <div class="section-label">大明湖景致与演出</div>
            <div class="btn-wrap">
              <button class="guofeng-btn" @click="game?.cycleSeason()">四季：{{ store.hud.seasonLabel }}</button>
              <button class="guofeng-btn" @click="game?.cycleTime()">时辰：{{ store.hud.timeLabel }}</button>
              <button class="guofeng-btn" :class="{ active: store.hud.chaoranLit }" @click="game?.toggleChaoranLight()">
                超然楼亮灯
              </button>
              <button class="guofeng-btn" :class="{ active: store.hud.minghuShowActive }" @click="game?.toggleMinghuShow(); store.garageOpen = false">
                明湖秀水幕烟花
              </button>
              <button class="guofeng-btn" :class="{ active: store.hud.directorActive }" @click="game?.toggleDirector(); store.garageOpen = false">
                导演巡游
              </button>
            </div>

            <div class="section-label" style="margin-top: 16px">丝竹国风背景音乐（梦幻西游同款五声音阶）</div>
            <div class="btn-wrap">
              <button class="guofeng-btn" :class="{ active: store.hud.bgmEnabled }" @click="game?.toggleBgm()">
                BGM：{{ store.hud.bgmEnabled ? '开启' : '关闭' }}
              </button>
              <button class="guofeng-btn" :class="{ active: store.hud.sfxEnabled }" @click="game?.toggleSfx()">
                音效：{{ store.hud.sfxEnabled ? '开启' : '关闭' }}
              </button>
            </div>
            <label class="stat-row" style="margin: 12px 0">
              <span>音乐音量</span>
              <input v-model.number="bgmVol" type="range" min="0" max="100" @input="onVolumeChange" />
              <span>{{ bgmVol }}%</span>
            </label>
            <div class="btn-wrap">
              <button class="guofeng-btn" :class="{ active: store.hud.bgmScene === 'day' }" @click="selectBgmScene('day')">白昼古筝竹笛</button>
              <button class="guofeng-btn" :class="{ active: store.hud.bgmScene === 'night' }" @click="selectBgmScene('night')">夜色古琴箫声</button>
              <button class="guofeng-btn" :class="{ active: store.hud.bgmScene === 'battle' }" @click="selectBgmScene('battle')">对战堂鼓琵琶</button>
              <button class="guofeng-btn" :class="{ active: store.hud.bgmScene === 'ceremony' }" @click="selectBgmScene('ceremony')">婚礼结义喜乐</button>
            </div>
          </div>

          <!-- Tab 5: 明湖书院出题与儿童防沉迷护眼 -->
          <div v-else-if="store.garageTab === 'guardian'" class="garage-body">
            <div class="section-label">题库类型（用于解锁装备 & 护眼防沉迷）</div>
            <div class="btn-wrap">
              <button class="guofeng-btn" :class="{ active: store.quizCategory === 'mixed' }" @click="setQuizCategory('mixed')">
                古诗 + 数学混合
              </button>
              <button class="guofeng-btn" :class="{ active: store.quizCategory === 'poetry' }" @click="setQuizCategory('poetry')">
                仅大明湖 / 小学古诗
              </button>
              <button class="guofeng-btn" :class="{ active: store.quizCategory === 'math' }" @click="setQuizCategory('math')">
                仅趣味数学口算
              </button>
            </div>

            <div class="section-label" style="margin-top: 16px">儿童防沉迷护眼定时出题</div>
            <div class="btn-wrap">
              <button
                class="guofeng-btn"
                :class="{ active: store.antiAddictionEnabled }"
                @click="store.antiAddictionEnabled = !store.antiAddictionEnabled"
              >
                定时护眼出题：{{ store.antiAddictionEnabled ? '已开启' : '已关闭' }}
              </button>
              <button
                v-for="min in [10, 15, 20, 30]"
                :key="min"
                class="guofeng-btn"
                :class="{ active: store.antiAddictionMinutes === min }"
                @click="store.antiAddictionMinutes = min"
              >
                每 {{ min }} 分钟
              </button>
            </div>

            <div class="section-label" style="margin-top: 16px">趣味互动与体验</div>
            <div class="btn-wrap">
              <button class="primary-btn" @click="triggerSampleQuiz">📖 立即来一道状元题</button>
              <button class="guofeng-btn" @click="store.unlockAllForDemo()">家长一键解锁全部体验</button>
            </div>
          </div>

          <!-- Tab 6: 新手教程与功能总览 -->
          <div v-else-if="store.garageTab === 'guide'" class="garage-body">
            <div class="guide-grid">
              <div class="guide-card">
                <div class="guide-head">
                  <span class="guide-num">01</span>
                  <strong>基础移动与视角</strong>
                </div>
                <ul class="guide-list">
                  <li><b>移动</b>：电脑端 <kbd>W A S D</kbd> + <kbd>Space</kbd> 三段跳；手机端使用左下角 360° 虚拟摇杆与右下角跳跃键。</li>
                  <li><b>视角</b>：单指/鼠标拖动旋转视角，手机双指捏合或鼠标滚轮缩放远近。</li>
                  <li><b>快速传送</b>：点击右上角<b>导览小地图</b>，一键飞往 21 处大明湖实景地标并集齐印章。</li>
                </ul>
              </div>

              <div class="guide-card">
                <div class="guide-head">
                  <span class="guide-num">02</span>
                  <strong>水陆空全载具漫游（已适配手机触控）</strong>
                </div>
                <ul class="guide-list">
                  <li><b>敞篷跑车</b>：按 <kbd>R</kbd> 或点「跑车」上车；手机端自动切换左右转向 + 前进/加速/漂移/后退/复位专属驾驶按键！</li>
                  <li><b>体素直升机 & 跳伞</b>：按 <kbd>G</kbd> 或点「飞机」起飞，按住「爬升/下降」调高度，高空点「跳伞」开伞空降！</li>
                  <li><b>划船 / 画舫 / 观光车</b>：靠近岸边、码头、画舫或摩天轮时，点击绿色互动键（或按 <kbd>E</kbd>）一键划船/登船！</li>
                </ul>
              </div>

              <div class="guide-card">
                <div class="guide-head">
                  <span class="guide-num">03</span>
                  <strong>3D 车库 · 四季皮肤与免费武器</strong>
                </div>
                <ul class="guide-list">
                  <li><b>四季皮肤</b>：春/夏/秋/冬 4 套主题装扮（同步跑车涂装），左侧 3D 展台可 360° 试穿。</li>
                  <li><b>3 把免费武器</b>：泉水连发枪（均衡）、荷花水炮（范围溅射）、鹊华长弓（远射高伤）。</li>
                  <li><b>开火与收枪</b>：默认空手无对战；装备武器后按 <kbd>J</kbd> 或右下角「开火」，按 <kbd>0</kbd> 收枪。</li>
                </ul>
                <div class="btn-wrap" style="margin-top: 4px">
                  <button class="guofeng-btn" @click="store.garageTab = 'skins'">去试穿皮肤</button>
                  <button class="guofeng-btn" @click="store.garageTab = 'weapons'">去挑武器</button>
                </div>
              </div>

              <div class="guide-card">
                <div class="guide-head">
                  <span class="guide-num">04</span>
                  <strong>打鸟抓鱼 · 对战练习 · 明湖书院</strong>
                </div>
                <ul class="guide-list">
                  <li><b>打鸟抓鱼</b>：持武器在湖畔射击盘旋白鹭/翠鸟与水中大锦鲤，触发水花特效并累计战绩。</li>
                  <li><b>对战练习</b>：支持单排 AI 靶场与 4v4 红蓝对抗演练（Stage 2 将开放局域网扫码联机）。</li>
                  <li><b>古诗/数学出题</b>：答对 1 题免费解锁皮肤与武器，并可开启定时护眼防沉迷测验。</li>
                </ul>
                <div class="btn-wrap" style="margin-top: 4px">
                  <button class="primary-btn" @click="selectMode('hunt')">试试打鸟抓鱼</button>
                  <button class="guofeng-btn" @click="triggerSampleQuiz">来一道状元题</button>
                </div>
              </div>

              <div class="guide-card">
                <div class="guide-head">
                  <span class="guide-num">05</span>
                  <strong>四季景致 · 明湖秀 · 丝竹配乐</strong>
                </div>
                <ul class="guide-list">
                  <li><b>四季与时辰</b>：<kbd>Q</kbd> 切换春夏秋冬（含冬日冰湖积雪），<kbd>T</kbd> 切换清晨/正午/晚照/夜景。</li>
                  <li><b>标志演出</b>：<kbd>L</kbd> 点亮超然楼，<kbd>M</kbd> 观赏明湖秀水幕烟花，<kbd>H</kbd> 湖畔喂鱼，<kbd>V</kbd> 导演运镜巡游。</li>
                  <li><b>宣纸明信片 & BGM</b>：一键生成带诗词朱砂印章的高清明信片；内置梦幻西游风五声音阶动态配乐。</li>
                </ul>
                <div class="btn-wrap" style="margin-top: 4px">
                  <button class="guofeng-btn" @click="store.garageTab = 'scene'">切换景致与丝竹</button>
                  <button class="guofeng-btn" @click="takePostcard">拍一张明信片</button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- 21 景点快速传送弹窗（点击右上小地图打开） -->
    <div v-if="store.landmarksOpen" class="modal-backdrop" @click.self="store.landmarksOpen = false">
      <div class="guofeng-modal">
        <div class="modal-header">
          <h3>大明湖景点导览与传送（已集印章 {{ store.hud.visitedIds.length }}/{{ store.hud.totalLandmarks }}）</h3>
          <button class="close-btn" @click="store.landmarksOpen = false">✕</button>
        </div>
        <div class="landmark-grid">
          <button
            v-for="lm in store.landmarks"
            :key="lm.id"
            class="landmark-chip"
            :class="{ visited: store.hud.visitedIds.includes(lm.id) }"
            @click="game?.teleportTo(lm.id); store.landmarksOpen = false"
          >
            {{ store.hud.visitedIds.includes(lm.id) ? '★ ' : '' }}{{ lm.name }}
          </button>
        </div>
      </div>
    </div>

    <!-- 宣纸明信片预览与下载弹窗 -->
    <div v-if="store.postcard" class="modal-backdrop" @click.self="store.postcard = null">
      <div class="guofeng-modal">
        <div class="modal-header">
          <h3>大明湖宣纸游记明信片</h3>
          <button class="close-btn" @click="store.postcard = null">✕</button>
        </div>
        <img :src="store.postcard.dataUrl" alt="大明湖明信片" class="postcard-img" />
        <div style="display: flex; justify-content: flex-end; gap: 10px; margin-top: 12px">
          <button class="guofeng-btn" @click="store.postcard = null">关闭</button>
          <button class="primary-btn" @click="downloadPostcard">保存高清 PNG</button>
        </div>
      </div>
    </div>

    <!-- 明湖书院趣味出题弹窗（解锁皮肤/武器 & 防沉迷） -->
    <QuizModal />
  </div>
</template>
