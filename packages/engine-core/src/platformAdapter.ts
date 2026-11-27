/**
 * 平台无关适配器接口：将 engine-core 对浏览器 DOM/BOM 的直接依赖抽象为可注入适配器，
 * 以便未来 Stage 5 微信/抖音小游戏（three-platformize）零侵入复用引擎内核。
 */
export interface PlatformAdapter {
  createCanvas(width: number, height: number): HTMLCanvasElement;
  createAudioContext(): AudioContext | null;
  now(): number;
  setTimeout(fn: () => void, ms: number): number;
  clearTimeout(id: number): void;
  setInterval(fn: () => void, ms: number): number;
  clearInterval(id: number): void;
  requestAnimationFrame(fn: () => void): number;
  cancelAnimationFrame(id: number): void;
  isHidden(): boolean;
  onVisibilityChange(cb: (hidden: boolean) => void): () => void;
  getDevicePixelRatio(): number;
  isMobileViewport(): boolean;
}

export function createBrowserPlatformAdapter(): PlatformAdapter {
  return {
    createCanvas(width: number, height: number): HTMLCanvasElement {
      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      return canvas;
    },
    createAudioContext(): AudioContext | null {
      if (typeof window === 'undefined') return null;
      const AC =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!AC) return null;
      try {
        return new AC();
      } catch {
        return null;
      }
    },
    now(): number {
      return typeof performance !== 'undefined' ? performance.now() : Date.now();
    },
    setTimeout(fn: () => void, ms: number): number {
      return globalThis.setTimeout(fn, ms) as unknown as number;
    },
    clearTimeout(id: number): void {
      globalThis.clearTimeout(id);
    },
    setInterval(fn: () => void, ms: number): number {
      return globalThis.setInterval(fn, ms) as unknown as number;
    },
    clearInterval(id: number): void {
      globalThis.clearInterval(id);
    },
    requestAnimationFrame(fn: () => void): number {
      return globalThis.requestAnimationFrame(fn);
    },
    cancelAnimationFrame(id: number): void {
      globalThis.cancelAnimationFrame(id);
    },
    isHidden(): boolean {
      return typeof document !== 'undefined' ? document.hidden : false;
    },
    onVisibilityChange(cb: (hidden: boolean) => void): () => void {
      if (typeof document === 'undefined') return () => {};
      const handler = () => cb(document.hidden);
      document.addEventListener('visibilitychange', handler);
      return () => document.removeEventListener('visibilitychange', handler);
    },
    getDevicePixelRatio(): number {
      return typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1;
    },
    isMobileViewport(): boolean {
      if (typeof window === 'undefined') return false;
      return (
        window.innerWidth <= 960 ||
        (typeof navigator !== 'undefined' && /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent))
      );
    },
  };
}
