declare module './legacy/collider.js' {
  export interface RaycastHit {
    hit: true;
    x: number;
    y: number;
    z: number;
    dist: number;
  }

  export class WorldCollider {
    beginScope(scopeId: string): void;
    endScope(): void;
    clearScope(scopeId: string): void;
    addBoxVolume(minX: number, minY: number, minZ: number, maxX: number, maxY: number, maxZ: number): void;
    addPropColumn(ix: number, y0: number, y1: number, iz: number): void;
    removePropColumn(ix: number, iz: number): void;
    isSolid(wx: number, wy: number, wz: number, ignoreProps?: boolean): boolean;
    collidesBox(cx: number, cy: number, cz: number, r: number, h: number): boolean;
    findGroundBelow(wx: number, wz: number, maxY?: number): number;
    raycastSolid(
      x0: number,
      y0: number,
      z0: number,
      x1: number,
      y1: number,
      z1: number,
      step?: number,
    ): RaycastHit | null;
    castCameraDistance(
      tx: number,
      ty: number,
      tz: number,
      dirX: number,
      dirY: number,
      dirZ: number,
      maxDist: number,
      minDist?: number,
    ): number;
  }
}

declare module './legacy/world.js' {
  import type * as THREE from 'three';
  import type { WorldCollider } from './legacy/collider.js';

  export interface SeasonPalette {
    name: string;
    icon: string;
    showLotus: boolean;
    snow: boolean;
  }

  export const SEASON_PALETTES: Record<string, SeasonPalette>;

  export class ChunkWorld {
    viewRadius: number;
    palette: SeasonPalette;
    constructor(scene: THREE.Scene, mat: THREE.Material, collider?: WorldCollider | null);
    setSeason(seasonKey: string, px: number, pz: number): void;
    update(px: number, pz: number, maxBuildPerFrame?: number): void;
    primeAround(px: number, pz: number, radius?: number): void;
    updateHeroLotuses(elapsed: number, dt: number, player: unknown): void;
    setNightFactor(nightFactor: number): void;
  }
}

declare module './legacy/water.js' {
  import type * as THREE from 'three';

  export interface LakeWaterHandle {
    uniforms: Record<string, { value: any }>;
    setWaterPosts(posts: unknown): void;
    update(elapsed: number, player: unknown, cruises: unknown, rippleEvents: unknown): void;
  }

  export function createLakeWater(scene: THREE.Scene): LakeWaterHandle;
}

declare module './legacy/sky.js' {
  import type * as THREE from 'three';

  export class SkyAndLighting {
    mode: string;
    nightFactor: number;
    chaoranLit: boolean;
    constructor(
      scene: THREE.Scene,
      renderer: THREE.WebGLRenderer,
      camera: THREE.Camera,
      waterUniforms: Record<string, { value: any }>,
      chaoran: unknown,
    );
    resize(w: number, h: number): void;
    getModeName(): string;
    setMode(mode: string): void;
    cycleMode(): string;
    setChaoranLit(lit: boolean): void;
    setQuality(level: 'low' | 'medium' | 'high'): void;
    update(dt: number, focusPos: THREE.Vector3): void;
    render(): void;
    dispose(): void;
  }
}

declare module './legacy/audio.js' {
  export class SoundEngine {
    enabled: boolean;
    unlock(sharedCtx?: AudioContext | null): void;
    toggleMute(): boolean;
    playChime(): void;
    playShutter(): void;
    playSplash(): void;
    update(player: unknown): void;
    dispose(): void;
  }
}

declare module './legacy/director.js' {
  import type * as THREE from 'three';

  export interface DirectorOptions {
    camera: THREE.Camera;
    world: unknown;
    sky: unknown;
    onStateChange?: (active: boolean) => void;
    onCaptionChange?: (title: string, subtitle: string) => void;
  }

  export class DirectorMode {
    active: boolean;
    constructor(options: DirectorOptions);
    toggleTour(): boolean;
    stopTour(): void;
    update(dt: number): boolean;
  }
}

declare module './legacy/postcard.js' {
  import type * as THREE from 'three';

  export interface CapturePostcardOptions {
    renderer: THREE.WebGLRenderer;
    renderScene: () => void;
    player: { pos: THREE.Vector3 };
    sky: { getModeName?: () => string };
    sound?: { playShutter?: () => void };
    createCanvas?: (w: number, h: number) => HTMLCanvasElement;
  }

  export function capturePostcard(options: CapturePostcardOptions): string;
}

declare module './legacy/map_data.js' {
  export interface TerrainSample {
    height: number;
    isWater: boolean;
    type: number;
  }

  export interface RawLandmark {
    id: string;
    name: string;
    tag?: string;
    poem?: string;
    x: number;
    z: number;
    spawnX?: number;
    spawnZ?: number;
    spawnYaw?: number;
    built?: boolean;
  }

  export const LANDMARKS: RawLandmark[];
  export const WATER_POLYS: number[][][];
  export const ISLAND_POLYS: number[][][];
  export const ROAD_LINES: number[][][];
  export const WORLD: { MIN_X: number; MAX_X: number; MIN_Z: number; MAX_Z: number; CHUNK_SIZE: number };
  export function sampleTerrain(x: number, z: number): TerrainSample;
}

declare module './legacy/*.js' {
  const mod: any;
  export default mod;
  export const LivingWorld: any;
  export const TuanPlayer: any;
  export const SeasonWeather: any;
  export const MinghuShow: any;
  export const MINGHU_SHOW_VIEW: { x: number; z: number; yaw: number };
}

declare module './legacy/*/*.js' {
  const mod: any;
  export default mod;
  export const DistrictManager: any;
  export const Vox: any;
  export const charMaterial: any;
}
