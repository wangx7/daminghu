// MC 顶级光影包风格天空与光照系统：
// - 6 大传统时辰自动同步当前真实时间
// - 自定义大气渐变天空穹顶 Shader（朝霞/蓝天/晚霞/星夜 + 太阳光晕 + 闪烁繁星）
// - 高空飘动的 45 朵体素立体白云（晨染粉金、午洁白、暮变火烧云，开直升机可穿云而过！）
import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';

export const TIME_ORDER = ['dawn', 'morning', 'noon', 'afternoon', 'sunset', 'night'];

export const TIME_PRESETS = {
  dawn: {
    name: '卯时 · 晨曦',
    skyTop: 0x4b6b9e, skyMid: 0xd9998c, skyHor: 0xffd5b0,
    fog: 0xf0c5b0,
    sunColor: 0xffc699, sunIntensity: 1.2, sunPos: [220, 58, -30],
    hemiSky: 0xffd5c2, hemiGround: 0x5c5b66, hemiIntensity: 0.74,
    waterShallow: 0x5b8f9c, waterDeep: 0x2f536e,
    cloudColor: 0xffdfd1, cloudOpacity: 0.82,
    nightFactor: 0.25, bloomStrength: 0.3,
  },
  morning: {
    name: '辰巳 · 清晨',
    skyTop: 0x2e88e6, skyMid: 0x82cdf9, skyHor: 0xd8f3ff,
    fog: 0xb8e5fc,
    sunColor: 0xfff8e6, sunIntensity: 1.68, sunPos: [180, 145, 65],
    hemiSky: 0xace0ff, hemiGround: 0x5d8556, hemiIntensity: 0.88,
    waterShallow: 0x12d4c2, waterDeep: 0x0b78b8,
    cloudColor: 0xffffff, cloudOpacity: 0.88,
    nightFactor: 0.0, bloomStrength: 0.18,
  },
  noon: {
    name: '午时 · 碧波',
    skyTop: 0x1e74da, skyMid: 0x64bcf7, skyHor: 0xc8ebff,
    fog: 0xa2d8fc,
    sunColor: 0xffffff, sunIntensity: 1.92, sunPos: [60, 245, 70],
    hemiSky: 0x9ed8ff, hemiGround: 0x567d4a, hemiIntensity: 0.9,
    waterShallow: 0x10cfc0, waterDeep: 0x0970b0,
    cloudColor: 0xffffff, cloudOpacity: 0.9,
    nightFactor: 0.0, bloomStrength: 0.16,
  },
  afternoon: {
    name: '申时 · 暖阳',
    skyTop: 0x4282c4, skyMid: 0x9ac6e8, skyHor: 0xfbe3ba,
    fog: 0xdfd6c0,
    sunColor: 0xffe0a8, sunIntensity: 1.64, sunPos: [-175, 118, 95],
    hemiSky: 0xffe2b8, hemiGround: 0x69644c, hemiIntensity: 0.82,
    waterShallow: 0x35b3ae, waterDeep: 0x1c6988,
    cloudColor: 0xfff0d4, cloudOpacity: 0.86,
    nightFactor: 0.12, bloomStrength: 0.24,
  },
  sunset: {
    name: '酉时 · 晚照',
    skyTop: 0x313866, skyMid: 0xc86452, skyHor: 0xffa657,
    fog: 0xd98462,
    sunColor: 0xff9a44, sunIntensity: 1.5, sunPos: [-230, 52, 35],
    hemiSky: 0xffb480, hemiGround: 0x4d3b4a, hemiIntensity: 0.7,
    waterShallow: 0x5e6a7a, waterDeep: 0x2d3c59,
    cloudColor: 0xffb380, cloudOpacity: 0.84,
    nightFactor: 0.58, bloomStrength: 0.4,
  },
  night: {
    name: '亥子 · 夜色',
    skyTop: 0x050b1c, skyMid: 0x0e1b38, skyHor: 0x1b2d52,
    fog: 0x152547,
    sunColor: 0x8fb4f5, sunIntensity: 0.68, sunPos: [-120, 180, -100],
    hemiSky: 0x385696, hemiGround: 0x1a263d, hemiIntensity: 0.72,
    waterShallow: 0x183254, waterDeep: 0x0c1b33,
    cloudColor: 0x2c426e, cloudOpacity: 0.45,
    nightFactor: 1.0, bloomStrength: 0.42,
  },
};

export function detectCurrentTimePeriod() {
  const h = new Date().getHours() + new Date().getMinutes() / 60;
  if (h >= 5.5 && h < 7.5) return 'dawn';
  if (h >= 7.5 && h < 11.0) return 'morning';
  if (h >= 11.0 && h < 14.5) return 'noon';
  if (h >= 14.5 && h < 17.5) return 'afternoon';
  if (h >= 17.5 && h < 19.5) return 'sunset';
  return 'night';
}

export class SkyAndLighting {
  constructor(scene, renderer, camera, waterUniforms, chaoran) {
    this.scene = scene;
    this.waterUniforms = waterUniforms;
    this.chaoran = chaoran;

    scene.background = new THREE.Color(TIME_PRESETS.morning.skyMid);
    scene.fog = new THREE.Fog(TIME_PRESETS.morning.fog, 180, 540);

    // 1. 大气渐变天空穹顶 + 太阳/月亮光晕 + 闪烁繁星 Shader
    this.skyUniforms = {
      uTop: { value: new THREE.Color(0x3b8ce2) },
      uMid: { value: new THREE.Color(0x8cccf7) },
      uHor: { value: new THREE.Color(0xd6f0ff) },
      uSunDir: { value: new THREE.Vector3(0.5, 0.7, 0.3).normalize() },
      uSunColor: { value: new THREE.Color(0xfff8e6) },
      uNight: { value: 0.0 },
      uTime: { value: 0.0 },
    };
    const skyMat = new THREE.ShaderMaterial({
      uniforms: this.skyUniforms,
      side: THREE.BackSide,
      depthWrite: false,
      fog: false,
      vertexShader: /* glsl */`
        varying vec3 vDir;
        void main() {
          vDir = normalize(position);
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: /* glsl */`
        uniform vec3 uTop, uMid, uHor, uSunDir, uSunColor;
        uniform float uNight, uTime;
        varying vec3 vDir;
        float hash31(vec3 p) {
          p = fract(p * 0.1031);
          p += dot(p, p.yzx + 33.33);
          return fract((p.x + p.y) * p.z);
        }
        float vnoise2(vec2 p) {
          vec2 i = floor(p), f = fract(p);
          f = f * f * (3.0 - 2.0 * f);
          float a = fract(sin(dot(i, vec2(127.1, 311.7))) * 43758.5453);
          float b = fract(sin(dot(i + vec2(1.0, 0.0), vec2(127.1, 311.7))) * 43758.5453);
          float c = fract(sin(dot(i + vec2(0.0, 1.0), vec2(127.1, 311.7))) * 43758.5453);
          float d = fract(sin(dot(i + vec2(1.0, 1.0), vec2(127.1, 311.7))) * 43758.5453);
          return mix(mix(a, b, f.x), mix(c, d, f.x), f.y);
        }
        float fbmCloud(vec2 p) {
          float s = 0.0, a = 0.5;
          for (int i = 0; i < 4; i++) {
            s += a * vnoise2(p);
            p = p * 2.05 + vec2(17.1, 31.7);
            a *= 0.5;
          }
          return s;
        }
        void main() {
          vec3 d = normalize(vDir);
          float h = clamp(d.y, 0.0, 1.0);
          vec3 col = mix(uHor, uMid, smoothstep(0.0, 0.28, h));
          col = mix(col, uTop, smoothstep(0.22, 0.85, h));

          // 柔和大气卷云/轻纱薄云（取代硬方块云，随风缓缓流动，自动染朝霞与晚霞！）
          if (h > 0.04) {
            vec2 cuv = (d.xz / (h + 0.18)) * 0.9 + vec2(uTime * 0.008, uTime * 0.003);
            float n = fbmCloud(cuv);
            float cloudMask = smoothstep(0.54, 0.78, n) * smoothstep(0.04, 0.22, h) * (1.0 - smoothstep(0.65, 0.95, h));
            vec3 cloudCol = mix(vec3(1.0, 0.98, 0.96), uHor * 1.15, 0.35);
            cloudCol = mix(cloudCol, vec3(0.18, 0.26, 0.42), uNight * 0.85);
            col = mix(col, cloudCol, cloudMask * (0.58 - uNight * 0.28));
          }

          // 太阳 / 明月光盘与丁达尔柔和光晕
          float sd = max(dot(d, normalize(uSunDir)), 0.0);
          float halo = pow(sd, 10.0) * 0.38 + pow(sd, 90.0) * 0.65;
          float disc = smoothstep(0.9982, 0.9994, sd);
          col += uSunColor * (halo * (1.0 - uNight * 0.55) + disc * 1.15);

          // 夜间满天繁星闪烁
          if (uNight > 0.35 && h > 0.08) {
            vec3 cell = floor(d * 180.0);
            float r = hash31(cell);
            if (r > 0.994) {
              float tw = 0.6 + 0.4 * sin(uTime * 3.0 + r * 900.0);
              col += vec3(0.92, 0.96, 1.0) * tw * smoothstep(0.35, 0.9, uNight) * smoothstep(0.08, 0.25, h);
            }
          }
          gl_FragColor = vec4(col, 1.0);
        }
      `,
    });
    this.skyDome = new THREE.Mesh(new THREE.SphereGeometry(2200, 32, 20), skyMat);
    this.skyDome.renderOrder = -1;
    scene.add(this.skyDome);

    // 2. 主光源与柔和环境光
    this.hemi = new THREE.HemisphereLight(0xa6dcff, 0x5d7d52, 0.84);
    scene.add(this.hemi);

    this.sun = new THREE.DirectionalLight(0xfff8e6, 1.6);
    this.sun.castShadow = true;
    this.sun.shadow.mapSize.set(2048, 2048);
    this.sun.shadow.camera.near = 10;
    this.sun.shadow.camera.far = 420;
    const d = 120;
    this.sun.shadow.camera.left = -d;
    this.sun.shadow.camera.right = d;
    this.sun.shadow.camera.top = d;
    this.sun.shadow.camera.bottom = -d;
    this.sun.shadow.bias = -0.0005;
    scene.add(this.sun);
    scene.add(this.sun.target);

    this.composer = new EffectComposer(renderer);
    this.composer.addPass(new RenderPass(scene, camera));
    this.bloomPass = new UnrealBloomPass(
      new THREE.Vector2(Math.max(1, Math.floor(window.innerWidth / 2)), Math.max(1, Math.floor(window.innerHeight / 2))),
      0.2, 0.55, 0.82,
    );
    this.composer.addPass(this.bloomPass);
    this.composer.addPass(new OutputPass());

    this.mode = detectCurrentTimePeriod();
    this.nightFactor = 0;
    this.chaoranLit = this.mode === 'night';
    this.chaoranGlowVal = this.chaoranLit ? 1.0 : 0.0;

    this.setMode(this.mode);
  }

  resize(w, h) {
    this.composer.setSize(w, h);
    this.bloomPass.setSize(Math.max(1, Math.floor(w / 2)), Math.max(1, Math.floor(h / 2)));
  }

  getModeName() {
    return (TIME_PRESETS[this.mode] || TIME_PRESETS.morning).name;
  }

  setMode(mode) {
    const p = TIME_PRESETS[mode] || TIME_PRESETS.morning;
    this.mode = mode;
    this.nightFactor = p.nightFactor;

    this.scene.background.setHex(p.skyMid);
    this.scene.fog.color.setHex(p.fog);
    this.sun.color.setHex(p.sunColor);
    this.sun.intensity = p.sunIntensity;
    this.sunOffset = new THREE.Vector3(...p.sunPos);
    this.hemi.color.setHex(p.hemiSky);
    this.hemi.groundColor.setHex(p.hemiGround);
    this.hemi.intensity = p.hemiIntensity;

    this.skyUniforms.uTop.value.setHex(p.skyTop);
    this.skyUniforms.uMid.value.setHex(p.skyMid);
    this.skyUniforms.uHor.value.setHex(p.skyHor);
    this.skyUniforms.uSunColor.value.setHex(p.sunColor);
    this.skyUniforms.uSunDir.value.copy(this.sunOffset).normalize();
    this.skyUniforms.uNight.value = p.nightFactor;

    this.waterUniforms.uSkyColor.value.setHex(p.fog);
    this.waterUniforms.uSunColor.value.setHex(p.sunColor);
    this.waterUniforms.uSunDir.value.copy(this.sunOffset).normalize();
    this.waterUniforms.uShallowColor.value.setHex(p.waterShallow);
    this.waterUniforms.uDeepColor.value.setHex(p.waterDeep);

    this.bloomPass.strength = p.bloomStrength;
  }

  cycleMode() {
    const next = TIME_ORDER[(TIME_ORDER.indexOf(this.mode) + 1) % TIME_ORDER.length];
    this.setMode(next);
    return TIME_PRESETS[next].name;
  }

  setChaoranLit(lit) {
    this.chaoranLit = lit;
  }

  update(dt, playerPos) {
    this.skyUniforms.uTime.value += dt;
    this.skyDome.position.copy(playerPos);

    const sx = Math.round(playerPos.x * 0.5) * 2;
    const sy = Math.round(playerPos.y * 0.5) * 2;
    const sz = Math.round(playerPos.z * 0.5) * 2;
    this.sun.target.position.set(sx, sy, sz);
    this.sun.position.set(sx, sy, sz).add(this.sunOffset);

    const targetGlow = this.chaoranLit ? 1.0 : 0.0;
    this.chaoranGlowVal = THREE.MathUtils.lerp(this.chaoranGlowVal, targetGlow, Math.min(1, dt * 6));
    this.chaoran.glowMat.emissiveIntensity = 0.04 + this.chaoranGlowVal * 1.35;
    this.chaoran.light.intensity = this.chaoranGlowVal * 320;
    this.waterUniforms.uChaoranGlow.value = this.chaoranGlowVal;
  }

  render() {
    this.composer.render();
  }
}
