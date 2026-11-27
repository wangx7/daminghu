// 大明湖 5.0 高通透「吉卜力 · 体素活水」Shader 系统：
// - 全湖 2m 精度双向水岸距离场纹理（SHORE_SDF）：近岸薄荷翡翠青清澈透底（可见水底彩石、水草与 3D 锦鲤）→ 中远景宝石蔚蓝渐变
// - 岸石/岛屿拍岸纯白像素泡沫边 + 2~3 圈随波呼吸的细白同心岸波纹
// - 水中双木桩导览牌根部一圈圈纯白同心涟漪环（1:1 复刻参考海报精髓！）
// - 横向舒展波光亮带 + 浅滩阳光焦散光网（Caustics）+ 暖阳碎金闪烁
// - 小木船吃水线翻滚白浪圈 + 双画舫宽阔 V 字尾浪 + 锦鲤跃水/喂鱼实时扩散水波纹阵列
import * as THREE from 'three';
import { SHORE_SDF_INFO } from './map_data.js';
import { hash } from './voxel/vox.js';

const MAX_POSTS = 16;
const MAX_RIPPLES = 8;

export function createLakeWater(scene) {
  // 构建跨平台兼容（WebGL1/WebGL2 通用 RGBAFormat）的全湖水岸距离场纹理
  const { data: sdfRaw, w: sdfW, h: sdfH, minX, maxX, minZ, maxZ } = SHORE_SDF_INFO;
  const rgba = new Uint8Array(sdfW * sdfH * 4);
  for (let i = 0; i < sdfW * sdfH; i++) {
    const sx = i % sdfW, sz = Math.floor(i / sdfW);
    rgba[i * 4 + 0] = sdfRaw[i];
    rgba[i * 4 + 1] = Math.floor(hash(sx * 0.7, sz * 0.7, 13) * 255);
    rgba[i * 4 + 2] = 255;
    rgba[i * 4 + 3] = 255;
  }
  const shoreTex = new THREE.DataTexture(rgba, sdfW, sdfH, THREE.RGBAFormat);
  shoreTex.minFilter = THREE.LinearFilter;
  shoreTex.magFilter = THREE.LinearFilter;
  shoreTex.wrapS = THREE.ClampToEdgeWrapping;
  shoreTex.wrapT = THREE.ClampToEdgeWrapping;
  shoreTex.flipY = false;
  shoreTex.needsUpdate = true;

  const postArr = Array.from({ length: MAX_POSTS }, () => new THREE.Vector2(99999, 99999));
  const rippleArr = Array.from({ length: MAX_RIPPLES }, () => new THREE.Vector4(99999, 99999, 99, 0));
  const cruiseArr = [new THREE.Vector4(99999, 99999, 0, 0), new THREE.Vector4(99999, 99999, 0, 0)];

  const uniforms = {
    uTime: { value: 0 },
    uShallowColor: { value: new THREE.Color(0x24c6be) },
    uDeepColor: { value: new THREE.Color(0x1072a3) },
    uSkyColor: { value: new THREE.Color(0xa6dcff) },
    uSunDir: { value: new THREE.Vector3(0.5, 0.7, 0.3).normalize() },
    uSunColor: { value: new THREE.Color(0xfff6dc) },
    uChaoranPos: { value: new THREE.Vector3(503, 25, -70) },
    uChaoranGlow: { value: 0.0 },
    uBoatPos: { value: new THREE.Vector3(99999, 0, 99999) },
    uBoatDir: { value: new THREE.Vector2(0, 1) },
    uBoatSpeed: { value: 0.0 },
    uBoatActive: { value: 0.0 },
    uIceFactor: { value: 0.0 },
    uShoreTex: { value: shoreTex },
    uSdfBounds: { value: new THREE.Vector4(minX, minZ, maxX - minX, maxZ - minZ) },
    uPosts: { value: postArr },
    uPostCount: { value: 0 },
    uRipples: { value: rippleArr },
    uCruises: { value: cruiseArr },
  };

  const mat = new THREE.ShaderMaterial({
    uniforms,
    transparent: true,
    depthWrite: false,
    vertexShader: /* glsl */`
      uniform float uTime;
      varying vec3 vWorldPos;
      void main() {
        vec4 wp = modelMatrix * vec4(position, 1.0);
        // 灵动双频微风起伏
        float wave = sin(wp.x * 0.21 + uTime * 1.45) * 0.052
                   + cos(wp.z * 0.18 - uTime * 1.15) * 0.042
                   + sin((wp.x + wp.z) * 0.11 + uTime * 0.9) * 0.025;
        wp.y += wave;
        vWorldPos = wp.xyz;
        gl_Position = projectionMatrix * viewMatrix * wp;
      }
    `,
    fragmentShader: /* glsl */`
      uniform float uTime;
      uniform vec3 uShallowColor;
      uniform vec3 uDeepColor;
      uniform vec3 uSkyColor;
      uniform vec3 uSunDir;
      uniform vec3 uSunColor;
      uniform vec3 uChaoranPos;
      uniform float uChaoranGlow;
      uniform vec3 uBoatPos;
      uniform vec2 uBoatDir;
      uniform float uBoatSpeed;
      uniform float uBoatActive;
      uniform float uIceFactor;
      uniform sampler2D uShoreTex;
      uniform vec4 uSdfBounds;
      uniform vec2 uPosts[${MAX_POSTS}];
      uniform int uPostCount;
      uniform vec4 uRipples[${MAX_RIPPLES}];
      uniform vec4 uCruises[2];
      varying vec3 vWorldPos;

      float hash21(vec2 p) {
        p = fract(p * vec2(123.34, 456.21));
        p += dot(p, p + 45.32);
        return fract(p.x * p.y);
      }

      float vnoise(vec2 p) {
        vec2 i = floor(p), f = fract(p);
        f = f * f * (3.0 - 2.0 * f);
        float a = hash21(i);
        float b = hash21(i + vec2(1.0, 0.0));
        float c = hash21(i + vec2(0.0, 1.0));
        float d = hash21(i + vec2(1.0, 1.0));
        return mix(mix(a, b, f.x), mix(c, d, f.x), f.y);
      }

      void main() {
        vec2 xz = vWorldPos.xz;

        // 1. 采样全湖双向水岸距离场（waterDist > 0 表示水内离岸米数，< 0 表示陆地内部）
        vec2 sdfUv = (xz - uSdfBounds.xy) / uSdfBounds.zw;
        float sdfRaw = texture2D(uShoreTex, clamp(sdfUv, 0.0, 1.0)).r;
        float waterDist = (sdfRaw - 0.50196) * 64.0;
        if (waterDist < -0.65) discard;

        // 2. 高通透三阶水色渐变：近岸薄荷翡翠青 → 中景清亮宝石蓝 → 湖心深蔚蓝（饱满通透不发灰！）
        float shallowMask = 1.0 - smoothstep(0.5, 15.0, waterDist);
        float midMask = 1.0 - smoothstep(6.0, 30.0, waterDist);
        vec3 mintShallow = uShallowColor * vec3(1.02, 1.12, 1.06);
        vec3 midAzure = mix(uDeepColor, uShallowColor, 0.48) + vec3(0.0, 0.05, 0.09);
        vec3 baseCol = mix(uDeepColor, mix(midAzure, mintShallow, shallowMask), 0.38 + 0.62 * midMask);

        // 3. 吉卜力 / 参考海报同款「横向舒展波光拉丝亮带」（清晰灵动的亮青白水纹条！）
        vec2 stretchUv = vec2(xz.x * 0.13 + uTime * 0.24, xz.y * 0.52 - uTime * 0.36);
        float w1 = vnoise(stretchUv);
        float w2 = vnoise(vec2(xz.x * 0.24 - uTime * 0.19, xz.y * 0.82 + uTime * 0.30));
        float waveBand = w1 * 0.62 + w2 * 0.38;
        float ribbon = smoothstep(0.58, 0.74, waveBand);
        float thinStreak = smoothstep(0.77, 0.86, waveBand);
        baseCol = mix(baseCol, mix(mintShallow, vec3(0.86, 0.99, 1.0), 0.55), ribbon * 0.34);
        baseCol = mix(baseCol, vec3(0.94, 1.0, 1.0), thinStreak * 0.32);

        // 4. 近岸浅水阳光焦散光网（Caustics：清澈浅滩水底游走的晶莹光斑！）
        if (waterDist > 0.0 && waterDist < 16.0) {
          vec2 cUv1 = floor(xz * 2.0) * 0.35 + vec2(uTime * 0.45, -uTime * 0.32);
          vec2 cUv2 = floor(xz * 2.0) * 0.38 + vec2(-uTime * 0.36, uTime * 0.41);
          float cNet = abs(sin(cUv1.x + sin(cUv1.y * 1.3)) + cos(cUv2.y + cos(cUv2.x * 1.2)));
          float caustic = smoothstep(1.38, 1.88, cNet) * (1.0 - smoothstep(3.0, 16.0, waterDist));
          baseCol += uSunColor * caustic * 0.26;
        }

        // 5. 适度菲涅尔反射（抑制低视角泛白发灰，保留饱满翡翠青与宝石蓝本色！）
        vec3 viewDir = normalize(cameraPosition - vWorldPos);
        vec3 normal = normalize(vec3(
          (w1 - 0.5) * 0.18 + sin(xz.x * 0.42 + uTime * 1.7) * 0.05,
          1.0,
          (w2 - 0.5) * 0.22 + cos(xz.y * 0.42 - uTime * 1.4) * 0.05
        ));
        float fresnel = pow(1.0 - max(dot(viewDir, normal), 0.0), 4.5);
        vec3 skyTint = mix(uSkyColor, vec3(0.22, 0.70, 0.96), 0.42);
        vec3 col = mix(baseCol, skyTint, clamp(fresnel * 0.26, 0.0, 0.30));

        vec3 halfVec = normalize(uSunDir + viewDir);
        float spec = pow(max(dot(normal, halfVec), 0.0), 52.0);
        vec2 glintCell = floor(xz * 1.15);
        float glintSeed = hash21(glintCell + floor(uTime * 3.0) * 0.13);
        float sparkle = step(0.962, glintSeed) * smoothstep(0.48, 0.80, waveBand);
        col += uSunColor * (spec * 0.65 + sparkle * 0.45);

        float foamMask = 0.0;

        // 6. 岸石/湖心岛拍岸纯白水沫边 + 2~3 圈呼吸扩散的细白岸波纹（远近清晰可见！）
        if (waterDist >= -0.35 && waterDist < 4.5) {
          float shoreNoise = (w1 - 0.5) * 0.5 + sin(xz.x * 0.65 + xz.y * 0.55 + uTime * 2.2) * 0.22;
          float dAdj = waterDist + shoreNoise;
          float edgeFoam = 1.0 - smoothstep(0.05, 1.35, max(0.0, dAdj));
          float shoreRing = smoothstep(0.70, 0.93, sin(waterDist * 3.6 - uTime * 2.5 + w1 * 1.6))
                          * smoothstep(0.3, 1.0, waterDist) * (1.0 - smoothstep(2.2, 4.4, waterDist));
          foamMask = max(foamMask, edgeFoam * 0.92 + shoreRing * 0.58);
        }

        // 7. 水中双木桩导览牌根部：2~3 圈晶莹纯白同心涟漪环（1:1 复刻参考海报水中木牌！）
        for (int i = 0; i < ${MAX_POSTS}; i++) {
          if (i >= uPostCount) break;
          float pd = length(xz - uPosts[i]);
          if (pd < 2.35) {
            float postCollar = 1.0 - smoothstep(0.20, 0.46, pd);
            float postRings = smoothstep(0.72, 0.95, sin(pd * 8.2 - uTime * 3.1))
                            * smoothstep(0.24, 0.45, pd) * (1.0 - pd / 2.35);
            foamMask = max(foamMask, postCollar * 0.92 + postRings * 0.78);
          }
        }

        // 8. 团团小木船 / 畅游：船身吃水线翻滚纯白像素浪花 + 船尾 V 字劈波尾迹！
        if (uBoatActive > 0.5) {
          vec2 rel = xz - uBoatPos.xz;
          float bDist = length(rel);
          if (bDist < 14.0) {
            float along = dot(rel, uBoatDir);
            float perp = abs(dot(rel, vec2(-uBoatDir.y, uBoatDir.x)));
            // 椭圆船体吃水线白沫圈（静止泛舟也有灵动水线，划动时翻起白浪！）
            float hullEll = length(vec2(perp / 1.25, along / 2.15));
            float hullFoam = smoothstep(0.68, 0.96, hullEll) * (1.0 - smoothstep(0.98, 1.38 + uBoatSpeed * 0.25, hullEll));
            float churn = 0.72 + 0.28 * step(0.42, hash21(floor(xz * 4.0) + floor(uTime * 8.0)));
            foamMask = max(foamMask, hullFoam * churn * (0.65 + 0.35 * min(1.0, uBoatSpeed)));

            // 船尾扩散 V 字浪迹与同心划桨波纹
            if (along < 0.8 && uBoatSpeed > 0.05) {
              float trailLen = -along;
              float vHalfW = 0.85 + trailLen * 0.34;
              float vEdge = 1.0 - smoothstep(vHalfW * 0.55, vHalfW, perp);
              float vWave = smoothstep(0.55, 0.92, sin(perp * 3.4 - trailLen * 1.3 + uTime * 6.5));
              float trailFade = (1.0 - smoothstep(1.0, 13.5, trailLen)) * min(1.0, uBoatSpeed);
              foamMask = max(foamMask, vEdge * vWave * trailFade * 0.65);
            }
          }
        }

        // 9. 双画舫（主湖明湖画舫 + 小东湖鹊华画舫）巡航船身水线与宽阔船尾白浪！
        for (int ci = 0; ci < 2; ci++) {
          vec4 cr = uCruises[ci];
          vec2 crel = xz - cr.xy;
          float cDist = length(crel);
          if (cDist < 28.0 && cr.w > 0.1) {
            vec2 cDir = vec2(cos(-cr.z), sin(-cr.z));
            float cAlong = dot(crel, cDir);
            float cPerp = abs(dot(crel, vec2(-cDir.y, cDir.x)));
            float cHull = length(vec2(cAlong / (10.5 * cr.w), cPerp / (4.0 * cr.w)));
            float cCollar = smoothstep(0.82, 0.98, cHull) * (1.0 - smoothstep(1.0, 1.24, cHull));
            foamMask = max(foamMask, cCollar * 0.75);
            if (cAlong < -4.0 * cr.w) {
              float tl = -cAlong - 4.0 * cr.w;
              float vw = 3.2 * cr.w + tl * 0.36;
              float inWake = (1.0 - smoothstep(vw * 0.45, vw, cPerp)) * (1.0 - smoothstep(2.0, 22.0, tl));
              float wakeRip = 0.55 + 0.45 * sin(cPerp * 1.8 - tl * 0.9 + uTime * 5.0);
              foamMask = max(foamMask, inWake * wakeRip * 0.52);
            }
          }
        }

        // 10. 实时生态水波纹事件阵列（锦鲤跃水、投喂鱼食、泉眼涌动扩散白圈！）
        for (int ri = 0; ri < ${MAX_RIPPLES}; ri++) {
          vec4 rp = uRipples[ri];
          if (rp.w <= 0.01) continue;
          float rd = length(xz - rp.xy);
          float maxR = 1.2 + rp.z * 3.8;
          if (rd < maxR + 1.2) {
            float ring = 1.0 - smoothstep(0.0, 0.55, abs(rd - maxR));
            float ring2 = (rp.z > 0.35) ? (1.0 - smoothstep(0.0, 0.45, abs(rd - maxR * 0.62))) * 0.65 : 0.0;
            foamMask = max(foamMask, (ring + ring2) * rp.w * 0.82);
          }
        }

        // 混合晶莹纯白水沫
        col = mix(col, vec3(0.95, 0.99, 1.0), clamp(foamMask, 0.0, 0.95));

        // 11. 超然楼亮灯时的湖面流金倒影
        if (uChaoranGlow > 0.01) {
          vec2 d = xz - uChaoranPos.xz;
          float dist = length(d);
          float inFront = smoothstep(20.0, -180.0, d.x);
          float band = exp(-abs(d.y) * 0.032) * exp(-dist * 0.0055);
          float shimmer = 0.65 + 0.35 * sin(xz.y * 0.9 + uTime * 4.5 + sin(xz.x * 0.2));
          col += vec3(1.0, 0.72, 0.24) * band * (0.45 + 0.55 * inFront) * shimmer * uChaoranGlow * 1.35;
        }

        // 12. 冬季冰面霜白晶莹质感
        if (uIceFactor > 0.01) {
          float icePatch = smoothstep(0.25, 0.78, hash21(floor(xz * 0.25)));
          vec3 iceCol = mix(vec3(0.76, 0.88, 0.98), vec3(0.93, 0.97, 1.0), icePatch);
          col = mix(col, iceCol, uIceFactor * (0.58 + 0.24 * icePatch));
        }

        // 13. 远景大气融合雾（推远雾起点，确保主湖中景碧蓝通透不泛白）
        float camDist = length(cameraPosition - vWorldPos);
        float fogFactor = smoothstep(235.0, 500.0, camDist);
        col = mix(col, uSkyColor, fogFactor * 0.82);

        // 近岸翡翠浅滩更清透（alpha 0.64 -> 深水 0.89，白沫处实心清晰），水下锦鲤与彩石一览无余！
        float baseAlpha = mix(0.64, 0.89, smoothstep(0.4, 9.5, max(0.0, waterDist)));
        float finalAlpha = clamp(max(baseAlpha, foamMask * 0.94 + uIceFactor * 0.92), 0.0, 0.96);
        gl_FragColor = vec4(col, finalAlpha);
      }
    `,
  });

  const geo = new THREE.PlaneGeometry(2100, 1000, 128, 72);
  geo.rotateX(-Math.PI / 2);
  const mesh = new THREE.Mesh(geo, mat);
  mesh.position.set(30, 0.05, -50);
  mesh.renderOrder = 2;
  scene.add(mesh);

  return {
    mesh,
    uniforms,
    setWaterPosts(posts) {
      const n = Math.min(MAX_POSTS, posts.length);
      uniforms.uPostCount.value = n;
      for (let i = 0; i < n; i++) {
        uniforms.uPosts.value[i].copy(posts[i]);
      }
    },
    update(t, player, cruises = [], rippleEvents = []) {
      uniforms.uTime.value = t;
      if (player && (player.inBoat || player.swimming)) {
        uniforms.uBoatActive.value = 1.0;
        uniforms.uBoatPos.value.copy(player.pos);
        uniforms.uBoatDir.value.set(Math.sin(player.yaw), Math.cos(player.yaw));
        uniforms.uBoatSpeed.value = player.speed / 10;
      } else {
        uniforms.uBoatActive.value = 0.0;
        uniforms.uBoatSpeed.value = 0.0;
      }

      for (let ci = 0; ci < 2; ci++) {
        const c = cruises[ci];
        if (c) {
          uniforms.uCruises.value[ci].set(c.x, c.z, c.yaw, ci === 0 ? 1.0 : 0.8);
        } else {
          uniforms.uCruises.value[ci].set(99999, 99999, 0, 0);
        }
      }

      for (let ri = 0; ri < MAX_RIPPLES; ri++) {
        const ev = rippleEvents[ri];
        if (ev) {
          const prog = ev.age / ev.life;
          const fade = (1.0 - prog) * (ev.strength || 1.0);
          uniforms.uRipples.value[ri].set(ev.x, ev.z, prog, Math.max(0, fade));
        } else {
          uniforms.uRipples.value[ri].set(99999, 99999, 99, 0);
        }
      }
    },
  };
}
