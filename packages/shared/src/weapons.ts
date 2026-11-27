import type { WeaponId } from './skins';

export interface WeaponConfig {
  id: WeaponId;
  slot: 1 | 2 | 3;
  name: string;
  role: string;
  description: string;
  freeUnlockHint: string;
  damage: number;
  cooldownSec: number;
  projectileSpeed: number;
  gravity: number;
  splashRadius: number;
  knockback: number;
  maxRange: number;
  color: number;
  accentColor: number;
  projectileRadius: number;
}

/**
 * 首发 3 把免费武器（严控数量、三角定位保平衡）：
 * 1. 泉水连发枪：均衡泛用、无下坠、稳定连发
 * 2. 荷花水炮：抛物线范围溅射 + 击退，适合控场/守据点
 * 3. 鹊华长弓：高单发伤害、远射程、考验预判走位
 */
export const WEAPON_CATALOG: readonly WeaponConfig[] = [
  {
    id: 'spring_blaster',
    slot: 1,
    name: '泉水连发枪',
    role: '均衡泛用',
    description: '稳定连发泉水弹，零弹道下坠，中距离对枪首选。',
    freeUnlockHint: '初始免费解锁',
    damage: 18,
    cooldownSec: 0.22,
    projectileSpeed: 96,
    gravity: 0,
    splashRadius: 0,
    knockback: 3,
    maxRange: 135,
    color: 0x38bdf8,
    accentColor: 0xe0f2fe,
    projectileRadius: 0.34,
  },
  {
    id: 'lotus_mortar',
    slot: 2,
    name: '荷花水炮',
    role: '范围控场',
    description: '抛物线发射荷花水球，落地爆裂造成范围溅射与轻度击退。',
    freeUnlockHint: '初始免费解锁（后续可绑定打卡成就）',
    damage: 34,
    cooldownSec: 0.88,
    projectileSpeed: 54,
    gravity: 28,
    splashRadius: 7.5,
    knockback: 11,
    maxRange: 115,
    color: 0xff5d8f,
    accentColor: 0x52b788,
    projectileRadius: 0.62,
  },
  {
    id: 'quehua_bow',
    slot: 3,
    name: '鹊华长弓',
    role: '精准点射',
    description: '高速竹箭超远点射，单发高伤，考验走位与预判。',
    freeUnlockHint: '初始免费解锁（后续可绑定对局成就）',
    damage: 48,
    cooldownSec: 1.05,
    projectileSpeed: 155,
    gravity: 4.5,
    splashRadius: 0,
    knockback: 6,
    maxRange: 210,
    color: 0xf59e0b,
    accentColor: 0xfef3c7,
    projectileRadius: 0.26,
  },
] as const;

export const WEAPON_MAP: Record<WeaponId, WeaponConfig> = WEAPON_CATALOG.reduce(
  (acc, item) => {
    acc[item.id] = item;
    return acc;
  },
  {} as Record<WeaponId, WeaponConfig>,
);
