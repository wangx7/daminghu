import type { BgmScene, EquippedWeaponId, GameMode, SeasonKey, SkinId, TeamId, VehicleMode } from './skins';

export type GraphicsQuality = 'low' | 'medium' | 'high';

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

export interface HitFeedbackEvent {
  id: number;
  damage: number;
  eliminated: boolean;
  kind: 'bot' | 'player' | 'wildlife' | 'vehicle';
  timestamp: number;
}

export interface MinimapTargetDot {
  x: number;
  z: number;
  team: TeamId;
  alive: boolean;
}

export interface AimTargetInfo {
  kind: 'enemy' | 'wildlife';
  name: string;
  distance: number;
  hpRatio?: number;
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
  isPassenger: boolean;
  passengerVehicle: VehicleMode | null;
  vehicleHp: number;
  vehicleMaxHp: number;
  statusText: string;
  nearPrompt: string;
  actionLabel: string;
  actionCanAct: boolean;
  hp: number;
  maxHp: number;
  skinId: SkinId;
  weaponId: EquippedWeaponId;
  weaponCooldownRatio: number;
  aimTarget: AimTargetInfo | null;
  season: SeasonKey;
  seasonLabel: string;
  timeLabel: string;
  chaoranLit: boolean;
  minghuShowActive: boolean;
  directorActive: boolean;
  bgmScene: BgmScene;
  bgmEnabled: boolean;
  sfxEnabled: boolean;
  quality: GraphicsQuality;
  visitedIds: string[];
  totalLandmarks: number;
  scoreboard: CombatScoreboard;
  targets: MinimapTargetDot[];
}
