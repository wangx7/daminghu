import type { BgmScene, EquippedWeaponId, GameMode, SeasonKey, SkinId, TeamId, VehicleMode } from './skins';

export interface LandmarkSummary {
  id: string;
  name: string;
  poem: string;
  x: number;
  z: number;
  yaw?: number;
  district?: string;
}

export interface CombatScoreboard {
  mode: GameMode;
  redScore: number;
  blueScore: number;
  playerKills: number;
  playerHits: number;
  birdsCaught: number;
  fishCaught: number;
  timeRemainingSec: number;
  activeTargets: number;
}

export interface KillFeedItem {
  id: number;
  text: string;
  team: TeamId;
  timestamp: number;
}

export interface MinimapTargetDot {
  x: number;
  z: number;
  team: TeamId;
  alive: boolean;
}

export interface HudSnapshot {
  x: number;
  y: number;
  z: number;
  yaw: number;
  speedKmh: number;
  altitude: number;
  nitroRatio: number;
  vehicle: VehicleMode;
  statusText: string;
  nearPrompt: string;
  actionLabel: string;
  actionCanAct: boolean;
  hp: number;
  maxHp: number;
  skinId: SkinId;
  weaponId: EquippedWeaponId;
  weaponCooldownRatio: number;
  season: SeasonKey;
  seasonLabel: string;
  timeLabel: string;
  chaoranLit: boolean;
  minghuShowActive: boolean;
  directorActive: boolean;
  bgmScene: BgmScene;
  bgmEnabled: boolean;
  sfxEnabled: boolean;
  visitedIds: string[];
  totalLandmarks: number;
  scoreboard: CombatScoreboard;
  targets: MinimapTargetDot[];
}
