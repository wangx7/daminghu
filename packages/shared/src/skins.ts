export type SeasonKey = 'spring' | 'summer' | 'autumn' | 'winter';
export type SkinId = 'spring_willow' | 'summer_lotus' | 'autumn_maple' | 'winter_snow';
export type WeaponId = 'spring_blaster' | 'lotus_mortar' | 'quehua_bow';
export type EquippedWeaponId = WeaponId | null;
export type BgmScene = 'day' | 'night' | 'battle' | 'ceremony';
export type GameMode = 'roam' | 'hunt' | 'practice_solo' | 'practice_team';
export type TeamId = 'none' | 'red' | 'blue';
export type VehicleMode = 'foot' | 'swim' | 'boat' | 'car' | 'heli' | 'parachute' | 'bus' | 'ferris' | 'cruise';

export interface SkinPalette {
  body: number;
  shade: number;
  scarf: number;
  scarfDark: number;
  accent: number;
  hatColor?: number;
  hatRibbon?: number;
  carPrimary: number;
  carStripe: number;
}

export interface SkinConfig {
  id: SkinId;
  name: string;
  season: SeasonKey;
  subtitle: string;
  tag: string;
  priceYuan: number; // 0 = 免费体验，>0 = 后续商业化皮肤定价（纯外观、零数值加成）
  palette: SkinPalette;
  previewGradient: string;
}

export const SEASON_SKINS: readonly SkinConfig[] = [
  {
    id: 'spring_willow',
    name: '春 · 柳岸踏青',
    season: 'spring',
    subtitle: '嫩柳新芽配桃花束带，轻盈漫步明湖春色',
    tag: '春季限定',
    priceYuan: 6,
    previewGradient: 'linear-gradient(135deg, #52b788, #f4a2b8)',
    palette: {
      body: 0xf7fbf3,
      shade: 0xd8ecd6,
      scarf: 0x40916c,
      scarfDark: 0x2d6a4f,
      accent: 0xff8fab,
      hatColor: 0x74c69d,
      hatRibbon: 0xff8fab,
      carPrimary: 0x40916c,
      carStripe: 0xfef9ef,
    },
  },
  {
    id: 'summer_lotus',
    name: '夏 · 荷风映日',
    season: 'summer',
    subtitle: '粉荷碧叶点缀草帽，尽享四面荷花三面柳',
    tag: '盛夏典藏',
    priceYuan: 6,
    previewGradient: 'linear-gradient(135deg, #ff758f, #2ec4b6)',
    palette: {
      body: 0xfff8f2,
      shade: 0xf5e2d8,
      scarf: 0xff5d8f,
      scarfDark: 0xd6336c,
      accent: 0x2ec4b6,
      hatColor: 0xf4d35e,
      hatRibbon: 0xff5d8f,
      carPrimary: 0xff5d8f,
      carStripe: 0xfff8f2,
    },
  },
  {
    id: 'autumn_maple',
    name: '秋 · 汇波金枫',
    season: 'autumn',
    subtitle: '丹枫暖金披风，映照汇波晚照与古城秋意',
    tag: '金秋雅韵',
    priceYuan: 6,
    previewGradient: 'linear-gradient(135deg, #e76f51, #f4a261)',
    palette: {
      body: 0xfdf4e7,
      shade: 0xebd3b5,
      scarf: 0xd9532f,
      scarfDark: 0xa8381b,
      accent: 0xf4a261,
      hatColor: 0xe9c46a,
      hatRibbon: 0xc44524,
      carPrimary: 0xd9532f,
      carStripe: 0xf4d35e,
    },
  },
  {
    id: 'winter_snow',
    name: '冬 · 鹊华飞雪',
    season: 'winter',
    subtitle: '冰蓝雪白绒装，踏雪寻梅赏超然楼灯火',
    tag: '冬日华裳',
    priceYuan: 6,
    previewGradient: 'linear-gradient(135deg, #38bdf8, #e0f2fe)',
    palette: {
      body: 0xf0f8ff,
      shade: 0xcbe4f9,
      scarf: 0x2563eb,
      scarfDark: 0x1d4ed8,
      accent: 0x7dd3fc,
      hatColor: 0x3b82f6,
      hatRibbon: 0xf8fafc,
      carPrimary: 0x2563eb,
      carStripe: 0xe0f2fe,
    },
  },
] as const;

export const SKIN_MAP: Record<SkinId, SkinConfig> = SEASON_SKINS.reduce(
  (acc, item) => {
    acc[item.id] = item;
    return acc;
  },
  {} as Record<SkinId, SkinConfig>,
);
