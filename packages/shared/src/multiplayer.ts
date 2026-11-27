import type { EquippedWeaponId, SkinId, TeamId, VehicleMode, WeaponId } from './skins';

export type RoomMode = 'coop_roam' | 'ffa' | 'team';
export type TeamSize = 1 | 2 | 3 | 4 | 5;
export type RoomPhase = 'idle' | 'lobby' | 'playing' | 'ended';
export type RoomConnectionStatus = 'disconnected' | 'creating' | 'joining' | 'connected' | 'error';

export interface RoomConfig {
  mode: RoomMode;
  teamSize: TeamSize;
  fillBots: boolean;
  matchDurationSec: number;
}

export interface RoomMember {
  id: string;
  name: string;
  isHost: boolean;
  isBot: boolean;
  team: TeamId;
  skinId: SkinId;
  weaponId: EquippedWeaponId;
  kills: number;
  deaths: number;
  hp: number;
  maxHp: number;
  alive: boolean;
}

export interface NetEntitySnapshot {
  id: string;
  name: string;
  isBot: boolean;
  team: TeamId;
  x: number;
  y: number;
  z: number;
  yaw: number;
  vehicle: VehicleMode;
  passengerOf: string | null;
  seatIndex: number;
  vehicleHp: number;
  vehicleMaxHp: number;
  skinId: SkinId;
  weaponId: EquippedWeaponId;
  hp: number;
  maxHp: number;
  alive: boolean;
  kills: number;
  deaths: number;
}

export interface RoomSnapshot {
  status: RoomConnectionStatus;
  roomCode: string;
  isHost: boolean;
  localPlayerId: string;
  localPlayerName: string;
  phase: RoomPhase;
  config: RoomConfig;
  members: RoomMember[];
  redScore: number;
  blueScore: number;
  timeRemainingSec: number;
  errorMessage: string;
}

export interface ChatBubbleEvent {
  id: number;
  senderId: string;
  senderName: string;
  text: string;
  team: TeamId;
  timestamp: number;
}

export interface MatchRankingEntry {
  id: string;
  name: string;
  isBot: boolean;
  team: TeamId;
  kills: number;
  deaths: number;
}

export interface MatchResultSummary {
  mode: RoomMode;
  winnerTeam: TeamId | 'draw';
  redScore: number;
  blueScore: number;
  mvpName: string;
  rankings: MatchRankingEntry[];
}

export const QUICK_CHAT_PHRASES: readonly string[] = [
  '来超然楼集合！',
  '一起飙敞篷跑车！',
  '起飞看大明湖全景！',
  '湖畔划船走起～',
  '掩护我，冲鸭！',
  '漂亮！再来一局！',
];

export const DEFAULT_ROOM_CONFIG: RoomConfig = {
  mode: 'team',
  teamSize: 4,
  fillBots: true,
  matchDurationSec: 180,
};

// ===== P2P 星型协议消息定义 =====
export type ClientToHostMsg =
  | {
      type: 'join';
      name: string;
      skinId: SkinId;
      weaponId: EquippedWeaponId;
    }
  | {
      type: 'state';
      x: number;
      y: number;
      z: number;
      yaw: number;
      vehicle: VehicleMode;
      skinId: SkinId;
      weaponId: EquippedWeaponId;
    }
  | {
      type: 'fire';
      x: number;
      y: number;
      z: number;
      yaw: number;
      weaponId: WeaponId;
    }
  | {
      type: 'switch_team';
      team: TeamId;
    }
  | {
      type: 'chat';
      text: string;
    }
  | {
      type: 'board_vehicle';
      driverId: string;
    }
  | {
      type: 'leave_vehicle';
      wantParachute?: boolean;
    };

export type HostToClientMsg =
  | {
      type: 'welcome';
      playerId: string;
      roomCode: string;
      phase: RoomPhase;
      config: RoomConfig;
      members: RoomMember[];
    }
  | {
      type: 'room_sync';
      phase: RoomPhase;
      config: RoomConfig;
      members: RoomMember[];
      redScore: number;
      blueScore: number;
      timeRemainingSec: number;
    }
  | {
      type: 'world_snapshot';
      entities: NetEntitySnapshot[];
      redScore: number;
      blueScore: number;
      timeRemainingSec: number;
    }
  | {
      type: 'projectile_fx';
      shooterId: string;
      x: number;
      y: number;
      z: number;
      yaw: number;
      weaponId: WeaponId;
    }
  | {
      type: 'respawn';
      targetId: string;
      x: number;
      z: number;
      yaw: number;
    }
  | {
      type: 'kill_feed';
      text: string;
      team: TeamId;
    }
  | {
      type: 'chat_broadcast';
      senderId: string;
      senderName: string;
      text: string;
      team: TeamId;
    }
  | {
      type: 'match_end';
      result: MatchResultSummary;
    }
  | {
      type: 'room_closed';
      reason: string;
    }
  | {
      type: 'passenger_sync';
      targetId: string;
      driverId: string | null;
      seatIndex: number;
      driverVehicle: VehicleMode | null;
      autoParachute: boolean;
      ejectReason?: string;
    };
