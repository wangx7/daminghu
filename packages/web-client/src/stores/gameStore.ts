import { defineStore } from 'pinia';
import { ref } from 'vue';
import type { HudSnapshot, KillFeedItem, LandmarkSummary, QuizCategory, SkinId, WeaponId } from '@daminghu/shared';

export type GarageTab = 'skins' | 'weapons' | 'modes' | 'scene' | 'guardian' | 'guide';

export interface ActiveQuizRequest {
  title: string;
  subtitle: string;
  requiredCount: number;
  mandatory: boolean;
  onSuccess: () => void;
}

const STORAGE_KEY = 'daminghu_unlocks_v1';

function loadUnlocks(): { skins: SkinId[]; weapons: WeaponId[]; solved: number } {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      return {
        skins: Array.isArray(parsed.skins) ? parsed.skins : ['summer_lotus'],
        weapons: Array.isArray(parsed.weapons) ? parsed.weapons : [],
        solved: typeof parsed.solved === 'number' ? parsed.solved : 0,
      };
    }
  } catch {
    // ignore storage errors
  }
  return { skins: ['summer_lotus'], weapons: [], solved: 0 };
}

export const useGameStore = defineStore('game', () => {
  const saved = loadUnlocks();

  const hud = ref<HudSnapshot>({
    x: -217,
    y: 2,
    z: 298,
    yaw: Math.PI,
    speedKmh: 0,
    altitude: 2,
    nitroRatio: 1,
    vehicle: 'foot',
    statusText: '🐾 漫步中',
    nearPrompt: '',
    actionLabel: '',
    actionCanAct: false,
    hp: 100,
    maxHp: 100,
    skinId: 'summer_lotus',
    weaponId: null, // 默认空手、无武器、无对战
    weaponCooldownRatio: 0,
    season: 'summer',
    seasonLabel: '荷风盛夏',
    timeLabel: '辰巳 · 清晨',
    chaoranLit: false,
    minghuShowActive: false,
    directorActive: false,
    bgmScene: 'day',
    bgmEnabled: true,
    sfxEnabled: true,
    visitedIds: [],
    totalLandmarks: 21,
    scoreboard: {
      mode: 'roam',
      redScore: 0,
      blueScore: 0,
      playerKills: 0,
      playerHits: 0,
      birdsCaught: 0,
      fishCaught: 0,
      timeRemainingSec: 180,
      activeTargets: 0,
    },
    targets: [],
  });

  const landmarks = ref<LandmarkSummary[]>([]);
  const garageOpen = ref(false);
  const garageTab = ref<GarageTab>('skins');
  const landmarksOpen = ref(false);
  const notice = ref<{ title: string; body: string } | null>(null);
  const killFeed = ref<KillFeedItem[]>([]);
  const postcard = ref<{ dataUrl: string; filename: string } | null>(null);

  // 解锁进度与出题防沉迷设置
  const unlockedSkins = ref<SkinId[]>(saved.skins);
  const unlockedWeapons = ref<WeaponId[]>(saved.weapons);
  const totalQuizSolved = ref(saved.solved);
  const quizCategory = ref<QuizCategory>('mixed');
  const antiAddictionEnabled = ref(true);
  const antiAddictionMinutes = ref(15);
  const activeQuiz = ref<ActiveQuizRequest | null>(null);

  let noticeTimer: number | null = null;

  function persistUnlocks() {
    try {
      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({
          skins: unlockedSkins.value,
          weapons: unlockedWeapons.value,
          solved: totalQuizSolved.value,
        }),
      );
    } catch {
      // ignore
    }
  }

  function unlockSkin(id: SkinId) {
    if (!unlockedSkins.value.includes(id)) {
      unlockedSkins.value.push(id);
      persistUnlocks();
    }
  }

  function unlockWeapon(id: WeaponId) {
    if (!unlockedWeapons.value.includes(id)) {
      unlockedWeapons.value.push(id);
      persistUnlocks();
    }
  }

  function unlockAllForDemo() {
    unlockedSkins.value = ['spring_willow', 'summer_lotus', 'autumn_maple', 'winter_snow'];
    unlockedWeapons.value = ['spring_blaster', 'lotus_mortar', 'quehua_bow'];
    persistUnlocks();
    showNotice('体验解锁', '已解锁全部 4 套四季皮肤与 3 把免费武器！');
  }

  function requestQuiz(req: ActiveQuizRequest) {
    activeQuiz.value = req;
  }

  function updateHud(snapshot: HudSnapshot) {
    hud.value = snapshot;
  }

  function showNotice(title: string, body: string) {
    notice.value = { title, body };
    if (noticeTimer) window.clearTimeout(noticeTimer);
    noticeTimer = window.setTimeout(() => {
      notice.value = null;
    }, 3200);
  }

  function pushKillFeed(item: KillFeedItem) {
    killFeed.value = [item, ...killFeed.value].slice(0, 3);
    window.setTimeout(() => {
      killFeed.value = killFeed.value.filter((k) => k.id !== item.id);
    }, 4200);
  }

  return {
    hud,
    landmarks,
    garageOpen,
    garageTab,
    landmarksOpen,
    notice,
    killFeed,
    postcard,
    unlockedSkins,
    unlockedWeapons,
    totalQuizSolved,
    quizCategory,
    antiAddictionEnabled,
    antiAddictionMinutes,
    activeQuiz,
    updateHud,
    showNotice,
    pushKillFeed,
    unlockSkin,
    unlockWeapon,
    unlockAllForDemo,
    requestQuiz,
    persistUnlocks,
  };
});
