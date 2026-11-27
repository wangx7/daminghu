// 「泉城夜宴 · 明湖秀」1:1 真实地理与舞美还原系统
// 真实位置：大明湖北岸 · 济南天然奇石馆前主湖水域（北极阁西侧、汇波楼西南）
// 观演看台：(75, 2, -322) 坐北朝南 | 主演出水面：150m × 60m 中心 (75, 0, -225)
// 组成：北岸观演看台 + 30m 可投影演艺主大船 + 东西 18m 副船 + 5 座荷形升降浮台
//      + 110m 级超高主喷泉与 21 组喷泉矩阵 + 12 道扇形摇摆喷泉 + 84m 雾化水幕 + 激光烟花
import * as THREE from 'three';
import { Vox, Bits } from './voxel/vox.js';
import { createSignboard } from './collider.js';

export const MINGHU_SHOW_VIEW = {
  x: 75,
  z: -324,
  yaw: 0, // 站在北岸观演看台最高排正中，面朝正南 (+Z) 无遮挡俯瞰 150m 宽明湖秀全景
};

const SHOW_CENTER = { x: 75, z: -225 };

export class MinghuShow {
  constructor(scene, sound = null, solidMat = null, collider = null) {
    this.scene = scene;
    this.sound = sound;
    this.solidMat = solidMat || new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.86, metalness: 0.05 });
    this.collider = collider;
    this.active = false;
    this.time = 0;
    this.liftProgress = 0;

    // 常驻实体层（北岸观演看台 + 停泊在湖面的演艺主船与副船，白天夜晚均可见）
    this.permanentGroup = new THREE.Group();
    scene.add(this.permanentGroup);

    // 演出特效层（开启「明湖秀」时启动：水幕、喷泉、荷形升降浮台、激光、烟花）
    this.group = new THREE.Group();
    this.group.position.set(SHOW_CENTER.x, 0, SHOW_CENTER.z);
    this.group.visible = false;
    scene.add(this.group);

    this._buildViewingStand();
    this._buildStageBoats();
    this._buildLotusPlatforms();
    this._buildFountains();
    this._buildSwingFountains();
    this._buildWaterScreen();
    this._buildLasers();
    this._buildFireworks(scene);

    // Web Audio 古风五声音阶合成器（优先复用全局 SoundEngine 静音总控）
    this.audioCtx = null;
    this.nextNoteTime = 0;
    this.noteIdx = 0;
  }

  // 1. 北岸奇石馆前「明湖秀」阶梯观演看台（坐北朝南，可真实走上观演）
  _buildViewingStand() {
    const v = new Vox();
    const STONE = 0xd6d0c4, STONE_D = 0xa8a196, MARBLE = 0xebe6dc, RED = 0x9e2a24, WOOD = 0x6e472b;

    // 3 级阶梯观演台（东西宽 44m，南北纵深 8m）
    v.box(-22, 0, -4, 22, 0, 3, (x, _y, z) => ((x + z) & 1) ? STONE : STONE_D);
    v.box(-20, 1, -4, 20, 1, 0, WOOD);
    v.box(-18, 2, -4, 18, 2, -2, WOOD);

    // 南侧临水汉白玉护栏（中央留出宽口方便上下看台）
    for (let x = -22; x <= 22; x += 2) {
      if (Math.abs(x) <= 4) continue;
      v.set(x, 1, 3, MARBLE);
    }
    // 东西两侧古风灯柱
    for (const sx of [-22, -12, 12, 22]) {
      v.box(sx, 1, 3, sx, 3, 3, RED);
    }

    const standGrp = new THREE.Group();
    const standMesh = v.mesh(this.solidMat, 0.02);
    standMesh.receiveShadow = true;
    standMesh.castShadow = true;
    standGrp.add(standMesh);

    // 荷型岸边景观灯（夜间泛柔和金粉光）
    const lampMat = new THREE.MeshStandardMaterial({
      color: 0xffc6d9,
      emissive: new THREE.Color(0xff8fab),
      emissiveIntensity: 0.9,
      roughness: 0.3,
    });
    const lampGeo = new THREE.OctahedronGeometry(0.55, 0);
    for (const sx of [-22, -12, 12, 22]) {
      const lm = new THREE.Mesh(lampGeo, lampMat);
      lm.position.set(sx + 0.5, 4.4, 3.5);
      standGrp.add(lm);
    }

    // 看台西侧入口指示牌匾（避开中央观众席背后相机轴线，首帧观演 100% 无遮挡！）
    const sign = createSignboard({
      title: '明湖秀观演台',
      subtitle: '泉城夜宴 · 北岸主看台',
      width: 9,
      height: 2.6,
      bgColor: '#1b1d36',
      borderColor: '#f0c24b',
      textColor: '#ffea9f',
      seal: '夜宴',
    });
    sign.position.set(-17, 5.4, -4.2);
    sign.rotation.y = Math.PI;
    standGrp.add(sign);

    standGrp.position.set(SHOW_CENTER.x, 2, -322);
    this.permanentGroup.add(standGrp);
    if (this.collider) {
      this.collider.registerVox(v, SHOW_CENTER.x, 2, -322);
    }
  }

  // 2. 30 米级可投影智能演艺主大船 + 东西两艘 18 米副演艺船（常驻停泊北岸水域）
  _buildStageBoats() {
    const buildHull = (halfLen, halfW, deckH, isMain) => {
      const v = new Vox();
      const HULL = 0x5c341d, HULL_D = 0x3b2012, RED = 0xa82a24, GOLD = 0xf0c24b, ROOF = 0x2d3748, DECK = 0x8f5b32;
      // 船底与船身（东西向横泊，面向正北看台）
      for (let x = -halfLen; x <= halfLen; x++) {
        const taper = Math.max(0, Math.abs(x) - (halfLen - 4));
        const zw = Math.max(1, halfW - taper);
        v.box(x, 0, -zw, x, 1, zw, (Math.abs(x) % 4 === 0) ? HULL_D : HULL);
        v.box(x, 2, -zw, x, 2, zw, DECK);
        // 船舷朱红雕栏
        if (Math.abs(x) % 2 === 0) {
          v.set(x, 3, -zw, RED).set(x, 3, zw, RED);
        }
      }
      // 船艏船艉翘首金饰
      v.box(-halfLen - 1, 2, -1, -halfLen - 1, 3, 1, GOLD);
      v.box(halfLen + 1, 2, -1, halfLen + 1, 3, 1, GOLD);

      // 船上双层仿古楼阁框架（北立面留出平整巨幅投影/LED屏安装面）
      const cabinX = halfLen - 4;
      const cabinZ = Math.max(2, halfW - 1);
      v.box(-cabinX, 3, -cabinZ + 1, cabinX, deckH, cabinZ, RED);
      // 飞檐屋顶与金脊
      v.box(-cabinX - 1, deckH + 1, -cabinZ, cabinX + 1, deckH + 1, cabinZ + 1, ROOF);
      v.box(-cabinX, deckH + 2, -cabinZ + 1, cabinX, deckH + 2, cabinZ, ROOF);
      v.box(-cabinX + 1, deckH + 3, 0, cabinX - 1, deckH + 3, 0, GOLD);
      if (isMain) {
        // 主大船顶层重檐阁楼
        v.box(-8, deckH + 3, -2, 8, deckH + 5, 2, RED);
        v.box(-9, deckH + 6, -3, 9, deckH + 6, 3, ROOF);
        v.box(-7, deckH + 7, 0, 7, deckH + 7, 0, GOLD);
      }
      return v.mesh(this.solidMat, 0.02);
    };

    // 主演艺大船（长 32m，停泊在喷泉阵与水雾的南侧，作为中后景核心水上舞台）
    this.mainBoat = new THREE.Group();
    this.mainBoat.position.set(SHOW_CENTER.x, 0.1, SHOW_CENTER.z - 9);
    this.mainBoat.add(buildHull(15, 4, 9, true));

    // 主船北立面可投影光影幕（26m × 7.6m，自定义边缘羽化投影材质，优先支持 VideoTexture，否则播纯视觉光影画卷）
    this.boatCanvas = document.createElement('canvas');
    this.boatCanvas.width = 512;
    this.boatCanvas.height = 160;
    this.boatCtx = this.boatCanvas.getContext('2d');
    this.boatTex = new THREE.CanvasTexture(this.boatCanvas);
    this.boatTex.colorSpace = THREE.SRGBColorSpace;
    this.boatUniforms = {
      uMap: { value: this.boatTex },
      uTime: { value: 0 },
      uOpacity: { value: 0 },
    };
    this.boatScreenMat = new THREE.ShaderMaterial({
      uniforms: this.boatUniforms,
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      side: THREE.DoubleSide,
      vertexShader: /* glsl */`
        varying vec2 vUv;
        void main() {
          vUv = uv;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: /* glsl */`
        uniform sampler2D uMap;
        uniform float uTime;
        uniform float uOpacity;
        varying vec2 vUv;
        void main() {
          vec4 tex = texture2D(uMap, vUv);
          // 边缘柔和羽化 + 轻微激光扫描质感，让投影光影贴合古船立面
          float edge = smoothstep(0.0, 0.08, vUv.x) * smoothstep(1.0, 0.92, vUv.x)
                     * smoothstep(0.0, 0.12, vUv.y) * smoothstep(1.0, 0.88, vUv.y);
          float scan = 0.92 + 0.08 * sin(vUv.y * 120.0 - uTime * 8.0);
          float luma = dot(tex.rgb, vec3(0.299, 0.587, 0.114));
          float alpha = smoothstep(0.04, 0.28, luma) * edge * uOpacity;
          gl_FragColor = vec4(tex.rgb * scan * 1.25, alpha);
        }
      `,
    });
    const boatScreen = new THREE.Mesh(new THREE.PlaneGeometry(26, 7.6), this.boatScreenMat);
    boatScreen.position.set(0, 6.8, -3.65);
    boatScreen.rotation.y = Math.PI; // 面向正北看台 (-Z)
    this.mainBoat.add(boatScreen);

    // 主船船舷霓虹灯带（演出时亮起流光）
    this.boatTrimMat = new THREE.MeshStandardMaterial({
      color: 0xffd166,
      emissive: new THREE.Color(0xffb703),
      emissiveIntensity: 0.15,
      roughness: 0.3,
    });
    const trim = new THREE.Mesh(new THREE.BoxGeometry(31, 0.4, 0.4), this.boatTrimMat);
    trim.position.set(0, 2.7, -4.2);
    this.mainBoat.add(trim);
    this.permanentGroup.add(this.mainBoat);
    if (this.collider) {
      this.collider.addBoxVolume(SHOW_CENTER.x - 15.8, -1.5, SHOW_CENTER.z - 13.5, SHOW_CENTER.x + 15.8, 12.5, SHOW_CENTER.z - 4.5);
      for (const [dx, dz] of [[-48, -5], [48, -5]]) {
        this.collider.addBoxVolume(SHOW_CENTER.x + dx - 9.8, -1.5, SHOW_CENTER.z + dz - 3.5, SHOW_CENTER.x + dx + 9.8, 9.5, SHOW_CENTER.z + dz + 3.5);
      }
    }

    // 东西两艘 18 米副演艺船（位于主船东西两侧，同样在喷泉阵南侧）
    this.sideBoats = [];
    for (const [dx, dz] of [[-48, -5], [48, -5]]) {
      const sb = new THREE.Group();
      sb.position.set(SHOW_CENTER.x + dx, 0.1, SHOW_CENTER.z + dz);
      sb.add(buildHull(9, 3, 6, false));
      const sTrim = new THREE.Mesh(new THREE.BoxGeometry(19, 0.35, 0.35), this.boatTrimMat);
      sTrim.position.set(0, 2.5, -3.2);
      sb.add(sTrim);
      this.permanentGroup.add(sb);
      this.sideBoats.push(sb);
    }
  }

  // 3. 5 座荷形升降浮台（平时潜藏水下，开启明湖秀后缓缓升出水面绽放发光！）
  _buildLotusPlatforms() {
    this.lotusPlatforms = [];
    const baseGeo = new THREE.CylinderGeometry(3.4, 3.8, 0.7, 8);
    const petalGeo = new THREE.BoxGeometry(1.4, 1.8, 0.45);
    const leafMat = new THREE.MeshStandardMaterial({ color: 0x2f8a3c, roughness: 0.7 });

    const offsets = [[-46, -46], [-24, -50], [0, -52], [24, -50], [46, -46]];
    for (let i = 0; i < offsets.length; i++) {
      const [ox, oz] = offsets[i];
      const grp = new THREE.Group();
      grp.position.set(ox, -2.8, oz);
      grp.add(new THREE.Mesh(baseGeo, leafMat));

      const petalMat = new THREE.MeshStandardMaterial({
        color: 0xff8fab,
        emissive: new THREE.Color(i % 2 === 0 ? 0xff4d88 : 0xffb703),
        emissiveIntensity: 1.4,
        roughness: 0.35,
      });
      const flower = new THREE.Group();
      for (let k = 0; k < 8; k++) {
        const ang = (k / 8) * Math.PI * 2;
        const p = new THREE.Mesh(petalGeo, petalMat);
        p.position.set(Math.cos(ang) * 2.1, 1.1, Math.sin(ang) * 2.1);
        p.rotation.y = -ang + Math.PI / 2;
        p.rotation.x = 0.42;
        flower.add(p);
      }
      const core = new THREE.Mesh(
        new THREE.OctahedronGeometry(0.95, 0),
        new THREE.MeshBasicMaterial({ color: 0xffe566 }),
      );
      core.position.y = 1.4;
      flower.add(core);
      grp.add(flower);

      this.group.add(grp);
      this.lotusPlatforms.push({ grp, flower, i });
    }
  }

  // 4. 21 组动态喷泉矩阵 + 110 米级超高中心主喷泉（位于演艺大船北侧，面向北岸观演台）
  _buildFountains() {
    this.fountains = [];
    const colGeo = new THREE.BoxGeometry(1.7, 1, 1.7);
    colGeo.translate(0, 0.5, 0);

    for (let i = 0; i < 21; i++) {
      const norm = i - 10; // -10 .. +10
      const x = norm * 6.4;
      const z = -32 - Math.cos(norm * 0.16) * 6; // 位于大船北侧（z ≈ -257 ~ -263）
      const isHero = Math.abs(norm) <= 1; // 中央三柱超高主喷（最高可冲上 100m+！）
      const mat = new THREE.MeshStandardMaterial({
        color: 0x8cecff,
        emissive: new THREE.Color().setHSL(i / 21, 0.92, 0.56),
        emissiveIntensity: isHero ? 1.9 : 1.5,
        transparent: true,
        opacity: 0.86,
      });
      const mesh = new THREE.Mesh(colGeo, mat);
      mesh.position.set(x, 0.1, z);
      if (isHero) {
        mesh.scale.x = norm === 0 ? 1.65 : 1.25;
        mesh.scale.z = norm === 0 ? 1.65 : 1.25;
      }
      this.group.add(mesh);
      this.fountains.push({ mesh, mat, i, norm, isHero });
    }
  }

  // 5. 12 道扇形万向摇摆喷泉（在演艺大船左右两侧摇曳起舞）
  _buildSwingFountains() {
    this.swingFountains = [];
    const geo = new THREE.BoxGeometry(0.85, 1, 0.85);
    geo.translate(0, 0.5, 0);
    for (let i = 0; i < 12; i++) {
      const side = i < 6 ? -1 : 1;
      const idx = i % 6;
      const mat = new THREE.MeshStandardMaterial({
        color: 0xb8f3ff,
        emissive: new THREE.Color(side < 0 ? 0x38bdf8 : 0xf472b6),
        emissiveIntensity: 1.5,
        transparent: true,
        opacity: 0.78,
      });
      const mesh = new THREE.Mesh(geo, mat);
      mesh.position.set(side * (20 + idx * 5.2), 0.1, -41); // 位于大船北侧前景
      this.group.add(mesh);
      this.swingFountains.push({ mesh, mat, side, idx });
    }
  }

  // 6. 扇形高压水雾喷泉投影（无矩形边框！光打在向上喷涌的半透明扇形水雾上浮现影像）
  //    同时预留真实视频槽位：若存在 assets/minghushow.mp4 则自动切换 VideoTexture 投射
  _buildWaterScreen() {
    this.screenCanvas = document.createElement('canvas');
    this.screenCanvas.width = 512;
    this.screenCanvas.height = 256;
    this.screenCtx = this.screenCanvas.getContext('2d');
    this.screenTex = new THREE.CanvasTexture(this.screenCanvas);
    this.screenTex.colorSpace = THREE.SRGBColorSpace;

    this.videoEl = null;
    this.videoReady = false;

    this.waterScreenUniforms = {
      uMap: { value: this.screenTex },
      uTime: { value: 0 },
      uOpacity: { value: 0.95 },
    };

    const mat = new THREE.ShaderMaterial({
      uniforms: this.waterScreenUniforms,
      transparent: true,
      blending: THREE.AdditiveBlending,
      side: THREE.DoubleSide,
      depthWrite: false,
      vertexShader: /* glsl */`
        varying vec2 vUv;
        void main() {
          vUv = uv;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: /* glsl */`
        uniform sampler2D uMap;
        uniform float uTime;
        uniform float uOpacity;
        varying vec2 vUv;

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
          // 1. 真实扇形喷泉水雾轮廓（以底部中央为喷口向外喷射成半圆拱形，彻底告别硬矩形巨幕！）
          vec2 p = vec2((vUv.x - 0.5) * 2.0, vUv.y);
          float r = length(vec2(p.x * 0.98, p.y * 1.04));
          float fanMask = (1.0 - smoothstep(0.68, 1.0, r)) * smoothstep(0.0, 0.14, vUv.y);

          // 2. 高压喷泉水雾向上高速喷涌的纤维丝缕纹理
          float ang = atan(p.x, max(0.02, p.y));
          float sprayStreaks = vnoise(vec2(ang * 22.0, r * 14.0 - uTime * 5.2));
          float mistFlow = vnoise(vec2(vUv.x * 9.0, vUv.y * 7.0 - uTime * 2.6));
          float waterCurtain = (0.42 + 0.38 * sprayStreaks + 0.25 * mistFlow) * fanMask;

          // 3. 激光投影影像采样（水雾微扰动 + 暗部自动透明化）
          vec2 distortUv = vUv + vec2((mistFlow - 0.5) * 0.012, (sprayStreaks - 0.5) * 0.01);
          vec3 proj = texture2D(uMap, clamp(distortUv, 0.0, 1.0)).rgb;

          // 底部喷口高压水雾微光 + 激光打在水雾上的立体影像
          float baseMistGlow = exp(-vUv.y * 4.2) * fanMask * (0.24 + 0.14 * sprayStreaks);
          vec3 mistCol = vec3(0.32, 0.72, 1.0) * baseMistGlow;

          float luma = dot(proj, vec3(0.299, 0.587, 0.114));
          vec3 col = mistCol + proj * (0.65 + 0.65 * waterCurtain);
          float alpha = clamp((smoothstep(0.03, 0.25, luma) * 0.92 + baseMistGlow * 0.85) * fanMask * uOpacity, 0.0, 1.0);

          if (alpha < 0.01) discard;
          gl_FragColor = vec4(col, alpha);
        }
      `,
    });

    const plane = new THREE.Mesh(new THREE.PlaneGeometry(92, 40), mat);
    plane.position.set(0, 19.5, -26); // 紧贴大船北侧的喷泉水雾幕
    plane.rotation.y = Math.PI; // 面向正北观演看台 (-Z)
    this.group.add(plane);
    this.screenMesh = plane;
  }

  // 预留真实视频直投接口：传入任意 MP4/WebM 地址即可实时投射到扇形水雾与演艺大船
  attachVideo(url) {
    const vid = document.createElement('video');
    vid.src = url;
    vid.loop = true;
    vid.muted = true;
    vid.playsInline = true;
    vid.crossOrigin = 'anonymous';
    vid.addEventListener('canplay', () => {
      const vTex = new THREE.VideoTexture(vid);
      vTex.colorSpace = THREE.SRGBColorSpace;
      this.waterScreenUniforms.uMap.value = vTex;
      this.boatUniforms.uMap.value = vTex;
      this.videoReady = true;
    }, { once: true });
    this.videoEl = vid;
    if (this.active) vid.play().catch(() => {});
  }

  // 7. 8 道三基色夜空激光束（覆盖 150 米演出面宽）
  _buildLasers() {
    this.lasers = [];
    const geo = new THREE.CylinderGeometry(0.22, 0.9, 130, 6, 1, true);
    geo.translate(0, 65, 0);
    const colors = [0x00f5ff, 0xff4dff, 0xffd700, 0x00ff99, 0xff5577, 0x66aaff, 0xffb703, 0x38bdf8];
    for (let i = 0; i < 8; i++) {
      const mat = new THREE.MeshBasicMaterial({
        color: colors[i],
        transparent: true,
        opacity: 0.28,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        side: THREE.DoubleSide,
      });
      const beam = new THREE.Mesh(geo, mat);
      beam.position.set((i - 3.5) * 18, 0.5, 10);
      this.group.add(beam);
      this.lasers.push({ beam, i });
    }
  }

  // 8. 空中体素烟花系统（覆盖北岸 150m 主水域上空）
  _buildFireworks(scene) {
    this.fwBits = new Bits(420);
    scene.add(this.fwBits.mesh);
    this.bursts = [];
    this.nextBurst = 0;
  }

  _spawnFirework() {
    const cx = SHOW_CENTER.x + (Math.random() - 0.5) * 130;
    const cy = 58 + Math.random() * 32;
    const cz = SHOW_CENTER.z + 10 + (Math.random() - 0.5) * 50;
    const palette = [0xff4b6e, 0xffd166, 0x4ef2ff, 0xa86eff, 0x5eff96];
    const color = palette[Math.floor(Math.random() * palette.length)];
    const sparks = [];
    for (let i = 0; i < 42; i++) {
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(2 * Math.random() - 1);
      const spd = 10 + Math.random() * 16;
      sparks.push({
        vx: Math.sin(phi) * Math.cos(theta) * spd,
        vy: Math.cos(phi) * spd,
        vz: Math.sin(phi) * Math.sin(theta) * spd,
      });
    }
    this.bursts.push({ cx, cy, cz, color, age: 0, life: 2.3, sparks });
  }

  // 古风五声音阶合成乐（宫商角徵羽：C D E G A，统一接入全局 SoundEngine 静音控制）
  _playPentatonicStep() {
    try {
      let ctx = null;
      let dest = null;
      if (this.sound) {
        if (!this.sound.enabled) return;
        this.sound.unlock();
        ctx = this.sound.ctx;
        dest = this.sound.master;
      } else {
        if (!this.audioCtx) {
          const AC = window.AudioContext || window.webkitAudioContext;
          if (!AC) return;
          this.audioCtx = new AC();
        }
        ctx = this.audioCtx;
        dest = this.audioCtx.destination;
      }
      if (!ctx || !dest) return;
      if (ctx.state === 'suspended') ctx.resume();
      const melody = [523.25, 587.33, 659.25, 783.99, 880.0, 783.99, 659.25, 587.33,
                      659.25, 783.99, 1046.5, 880.0, 783.99, 659.25, 587.33, 523.25];
      const freq = melody[this.noteIdx % melody.length];
      this.noteIdx++;
      const now = ctx.currentTime;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(freq, now);
      gain.gain.setValueAtTime(0.001, now);
      gain.gain.exponentialRampToValueAtTime(0.11, now + 0.04);
      gain.gain.exponentialRampToValueAtTime(0.0008, now + 0.55);
      osc.connect(gain);
      gain.connect(dest);
      osc.start(now);
      osc.stop(now + 0.6);
    } catch (_) {
      // 浏览器未授权自动播放时静默跳过
    }
  }

  // 实时绘制 4 幕纯视觉光影画卷（无硬边框与大块文字！纯光影投射到扇形水雾喷泉与演艺大船）
  _drawScreens(t) {
    if (this.videoReady) return;
    const actIdx = Math.floor(t / 7) % 4;
    const localT = t % 7;

    // ====== A. 扇形喷泉水雾激光投影（512×256，纯黑底 -> Shader 自动透明化暗部）======
    const ctx = this.screenCtx;
    const W = 512, H = 256;
    ctx.fillStyle = '#000000';
    ctx.fillRect(0, 0, W, H);

    if (actIdx === 0) {
      // 第一幕：百泉竞涌（三股青金泉眼喷涌 + 荧光水波环 + 飞溅光粒）
      const springs = [W * 0.34, W * 0.5, W * 0.66];
      springs.forEach((sx, i) => {
        const amp = i === 1 ? 1.0 : 0.72;
        const topY = 58 + (1 - amp) * 44 + Math.sin(t * 4.5 + i) * 14;
        const g = ctx.createLinearGradient(sx, H, sx, topY);
        g.addColorStop(0, 'rgba(30, 190, 255, 0.95)');
        g.addColorStop(0.55, 'rgba(130, 240, 255, 0.85)');
        g.addColorStop(1, 'rgba(255, 232, 150, 0.95)');
        ctx.strokeStyle = g;
        ctx.lineWidth = i === 1 ? 18 : 12;
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo(sx, H - 6);
        ctx.quadraticCurveTo(sx + Math.sin(t * 3 + i) * 10, (H + topY) * 0.5, sx, topY);
        ctx.stroke();

        // 泉顶散落水花弧线
        for (let k = -3; k <= 3; k++) {
          if (k === 0) continue;
          ctx.strokeStyle = `rgba(140, 245, 255, ${0.55 - Math.abs(k) * 0.1})`;
          ctx.lineWidth = 3;
          ctx.beginPath();
          ctx.moveTo(sx, topY + 6);
          ctx.quadraticCurveTo(sx + k * 14, topY - 18, sx + k * 24, topY + 56 + Math.sin(t * 5 + k) * 10);
          ctx.stroke();
        }
      });
      // 层层扩散荧光水波纹
      for (let r = 0; r < 4; r++) {
        const phase = (t * 0.7 + r * 0.25) % 1;
        ctx.strokeStyle = `rgba(80, 225, 255, ${(1 - phase) * 0.75})`;
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.ellipse(W * 0.5, H - 24, 40 + phase * 190, 10 + phase * 34, 0, 0, Math.PI * 2);
        ctx.stroke();
      }
    } else if (actIdx === 1) {
      // 第二幕：荷韵明湖（巨型粉金光影莲花层叠绽放 + 游动发光锦鲤群）
      const cx = W * 0.5, cy = H * 0.62;
      const bloom = 0.75 + 0.25 * Math.sin(localT * 1.1);
      // 柔和金粉光晕底
      const glow = ctx.createRadialGradient(cx, cy - 10, 8, cx, cy - 10, 145);
      glow.addColorStop(0, 'rgba(255, 220, 120, 0.85)');
      glow.addColorStop(0.45, 'rgba(255, 95, 165, 0.45)');
      glow.addColorStop(1, 'rgba(0, 0, 0, 0)');
      ctx.fillStyle = glow;
      ctx.fillRect(0, 0, W, H);

      // 外层与内层发光莲花瓣
      for (let layer = 0; layer < 2; layer++) {
        const n = layer === 0 ? 9 : 7;
        for (let k = 0; k < n; k++) {
          const ang = -Math.PI + (k + 0.5) * (Math.PI / n) + Math.sin(t * 1.6 + k) * 0.04;
          const dist = (layer === 0 ? 58 : 34) * bloom;
          const rx = layer === 0 ? 22 : 16;
          const ry = (layer === 0 ? 54 : 38) * bloom;
          ctx.fillStyle = layer === 0 ? 'rgba(255, 110, 175, 0.82)' : 'rgba(255, 215, 130, 0.9)';
          ctx.beginPath();
          ctx.ellipse(cx + Math.cos(ang) * dist, cy + Math.sin(ang) * dist * 0.72, rx, ry, ang + Math.PI / 2, 0, Math.PI * 2);
          ctx.fill();
        }
      }
      // 4 条发光流光锦鲤绕莲游动
      for (let f = 0; f < 4; f++) {
        const a = t * (0.9 + f * 0.15) + f * 1.57;
        const fx = cx + Math.cos(a) * (125 + f * 12);
        const fy = cy + Math.sin(a) * 48 - 18;
        ctx.save();
        ctx.translate(fx, fy);
        ctx.rotate(a + Math.PI / 2);
        ctx.fillStyle = f % 2 === 0 ? '#ff6b35' : '#ffd166';
        ctx.beginPath();
        ctx.ellipse(0, 0, 18, 6, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.beginPath();
        ctx.moveTo(-16, 0);
        ctx.lineTo(-28, -9 + Math.sin(t * 10 + f) * 4);
        ctx.lineTo(-28, 9 + Math.sin(t * 10 + f) * 4);
        ctx.closePath();
        ctx.fill();
        ctx.restore();
      }
    } else if (actIdx === 2) {
      // 第三幕：鹊华烟雨（青绿鎏金光影山峦 + 升起明月 + 鸥鹭齐飞）
      // 鎏金明月
      const mx = W * 0.5, my = 86 + Math.sin(t * 0.8) * 6;
      const mGlow = ctx.createRadialGradient(mx, my, 12, mx, my, 92);
      mGlow.addColorStop(0, 'rgba(255, 248, 210, 1.0)');
      mGlow.addColorStop(0.38, 'rgba(255, 200, 95, 0.65)');
      mGlow.addColorStop(1, 'rgba(0, 0, 0, 0)');
      ctx.fillStyle = mGlow;
      ctx.fillRect(0, 0, W, H);
      ctx.fillStyle = '#fff6cc';
      ctx.beginPath();
      ctx.arc(mx, my, 26, 0, Math.PI * 2);
      ctx.fill();

      // 两层青绿流光山峦（鹊山、华山双峰意象）
      const drawMountain = (color, stroke, yBase, peaks) => {
        ctx.fillStyle = color;
        ctx.strokeStyle = stroke;
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(40, yBase);
        for (const [px, py] of peaks) ctx.lineTo(px, py);
        ctx.lineTo(W - 40, yBase);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
      };
      drawMountain('rgba(32, 130, 145, 0.45)', 'rgba(110, 240, 230, 0.9)', H - 28, [[145, 132], [220, 168], [330, 108], [415, 166]]);
      drawMountain('rgba(20, 95, 125, 0.55)', 'rgba(255, 214, 110, 0.85)', H - 18, [[110, 164], [195, 142], [275, 178], [365, 138], [435, 175]]);

      // 6 只发光鸥鹭展翅飞过
      ctx.strokeStyle = '#fff5d6';
      ctx.lineWidth = 2.8;
      for (let b = 0; b < 6; b++) {
        const bx = ((t * 42 + b * 76) % (W - 120)) + 60;
        const by = 68 + (b % 3) * 24 + Math.sin(t * 4 + b) * 6;
        const flap = Math.sin(t * 9 + b * 1.4) * 7;
        ctx.beginPath();
        ctx.moveTo(bx - 12, by + flap);
        ctx.quadraticCurveTo(bx - 5, by - 6, bx, by);
        ctx.quadraticCurveTo(bx + 5, by - 6, bx + 12, by + flap);
        ctx.stroke();
      }
    } else {
      // 第四幕：流金泉城（超然楼激光金色重檐剪影 + 礼花光环）
      const cx = W * 0.5;
      // 背后绽放的礼花光束
      for (let k = 0; k < 24; k++) {
        const ang = (k / 24) * Math.PI * 2 + t * 0.25;
        const len = 85 + Math.sin(t * 4 + k) * 28;
        ctx.strokeStyle = k % 2 === 0 ? 'rgba(255, 210, 90, 0.72)' : 'rgba(90, 230, 255, 0.62)';
        ctx.lineWidth = 2.5;
        ctx.beginPath();
        ctx.moveTo(cx, 132);
        ctx.lineTo(cx + Math.cos(ang) * len, 132 + Math.sin(ang) * len * 0.72);
        ctx.stroke();
      }
      // 激光金色勾勒七层超然楼剪影
      ctx.strokeStyle = '#ffdf73';
      ctx.fillStyle = 'rgba(255, 180, 45, 0.28)';
      ctx.lineWidth = 3;
      for (let f = 0; f < 6; f++) {
        const w = 136 - f * 16;
        const y = H - 36 - f * 24;
        ctx.fillRect(cx - w * 0.38, y - 16, w * 0.76, 16);
        ctx.strokeRect(cx - w * 0.38, y - 16, w * 0.76, 16);
        // 飞檐翘角
        ctx.beginPath();
        ctx.moveTo(cx - w * 0.54, y - 14);
        ctx.lineTo(cx - w * 0.35, y - 22);
        ctx.lineTo(cx + w * 0.35, y - 22);
        ctx.lineTo(cx + w * 0.54, y - 14);
        ctx.stroke();
      }
      // 宝顶
      ctx.beginPath();
      ctx.moveTo(cx - 28, H - 178);
      ctx.lineTo(cx, H - 208);
      ctx.lineTo(cx + 28, H - 178);
      ctx.stroke();
    }

    // 通用上升光影粒子点缀（增强光打在水雾上的灵动感）
    for (let i = 0; i < 28; i++) {
      const px = ((i * 73.7 + Math.sin(t + i) * 24) % (W - 80)) + 40;
      const py = H - ((t * 36 + i * 29) % (H - 30));
      ctx.fillStyle = i % 2 === 0 ? 'rgba(255, 232, 145, 0.85)' : 'rgba(120, 240, 255, 0.85)';
      ctx.beginPath();
      ctx.arc(px, py, 2 + (i % 3), 0, Math.PI * 2);
      ctx.fill();
    }
    this.screenTex.needsUpdate = true;

    // ====== B. 演艺主大船船身纯视觉投影光影（波浪金光 + 荷影 + 流光线条）======
    const bctx = this.boatCtx;
    const BW = 512, BH = 160;
    bctx.fillStyle = '#000000';
    bctx.fillRect(0, 0, BW, BH);

    const palettes = [
      ['#0ea5e9', '#67e8f9', '#fde047'],
      ['#ec4899', '#fb7185', '#fde047'],
      ['#14b8a6', '#38bdf8', '#fcd34d'],
      ['#f59e0b', '#fb923c', '#fef08a'],
    ];
    const [c1, c2, c3] = palettes[actIdx];

    // 船身流动光影波浪
    for (let row = 0; row < 5; row++) {
      bctx.strokeStyle = row % 2 === 0 ? c1 : c2;
      bctx.lineWidth = 4 - row * 0.4;
      bctx.beginPath();
      for (let x = 0; x <= BW; x += 12) {
        const y = 34 + row * 24 + Math.sin(x * 0.025 + t * (3.2 + row * 0.4) + row) * 14;
        if (x === 0) bctx.moveTo(x, y);
        else bctx.lineTo(x, y);
      }
      bctx.stroke();
    }
    // 船身中央发光荷花 / 泉纹图腾
    const bcx = BW * 0.5, bcy = BH * 0.52;
    for (let k = 0; k < 8; k++) {
      const a = (k / 8) * Math.PI * 2 + t * 0.6;
      bctx.fillStyle = k % 2 === 0 ? c3 : c2;
      bctx.beginPath();
      bctx.ellipse(bcx + Math.cos(a) * 28, bcy + Math.sin(a) * 20, 14, 7, a, 0, Math.PI * 2);
      bctx.fill();
    }
    // 船身两侧对称流光粒子
    for (let i = 0; i < 18; i++) {
      const lx = ((t * 95 + i * 31) % BW);
      const ly = 24 + ((i * 47) % (BH - 48));
      bctx.fillStyle = c3;
      bctx.beginPath();
      bctx.arc(lx, ly, 2.5, 0, Math.PI * 2);
      bctx.fill();
    }
    this.boatTex.needsUpdate = true;
  }

  toggle(forceState) {
    this.active = typeof forceState === 'boolean' ? forceState : !this.active;
    this.group.visible = this.active;
    if (!this.active) {
      this.bursts = [];
      this.fwBits.begin();
      this.fwBits.end();
      this.boatUniforms.uOpacity.value = 0;
      this.boatTrimMat.emissiveIntensity = 0.15;
      if (this.videoEl) this.videoEl.pause();
    } else {
      if (this.videoEl) this.videoEl.play().catch(() => {});
      this._drawScreens(this.time);
    }
    return this.active;
  }

  update(dt, t) {
    // 演艺主船与副船常驻湖面，随水波轻柔起伏
    const bob = Math.sin(t * 1.4) * 0.14;
    this.mainBoat.position.y = 0.1 + bob;
    this.sideBoats.forEach((sb, idx) => {
      sb.position.y = 0.1 + Math.sin(t * 1.6 + idx * 1.8) * 0.12;
    });

    if (!this.active) return;
    this.time += dt;
    this.liftProgress = Math.min(1, this.liftProgress + dt * 0.45);
    this.waterScreenUniforms.uTime.value = this.time;
    this.boatUniforms.uTime.value = this.time;

    // 1. 演艺大船投影幕渐亮与流光灯带
    this.boatUniforms.uOpacity.value = THREE.MathUtils.lerp(this.boatUniforms.uOpacity.value, 0.96, Math.min(1, dt * 4));
    this.boatTrimMat.emissiveIntensity = 1.1 + 0.5 * Math.sin(this.time * 4.0);

    // 2. 荷形升降浮台升出水面并缓缓旋转
    for (const lp of this.lotusPlatforms) {
      const targetY = -2.8 + this.liftProgress * 3.05 + Math.sin(this.time * 2.2 + lp.i) * 0.12;
      lp.grp.position.y = targetY;
      lp.flower.rotation.y = this.time * (0.45 + lp.i * 0.05);
    }

    // 3. 21 组喷泉矩阵 + 110 米级超高中心主喷泉（4 种节奏交替）
    const mode = Math.floor(this.time / 5.5) % 3;
    for (const f of this.fountains) {
      let h;
      if (f.isHero) {
        const surge = 0.55 + 0.45 * Math.sin(this.time * 1.8 - Math.abs(f.norm) * 0.4);
        h = f.norm === 0 ? (38 + surge * 74) : (26 + surge * 46); // 中央主喷最高冲上 ~112m！
      } else if (mode === 0) {
        h = 6 + (0.5 + 0.5 * Math.sin(this.time * 4.2 + f.i * 0.5)) * 28;
      } else if (mode === 1) {
        const arch = 1 - Math.abs(f.norm) / 11;
        h = 8 + Math.abs(Math.sin(this.time * 2.8)) * arch * 36;
      } else {
        h = 5 + (0.5 + 0.5 * Math.cos(this.time * 3.6 - Math.abs(f.norm) * 0.65)) * 30;
      }
      f.mesh.scale.y = h;
      f.mat.emissive.setHSL((f.i / 21 + this.time * 0.12) % 1, 0.92, 0.56);
    }

    // 4. 扇形万向摇摆喷泉
    for (const sf of this.swingFountains) {
      sf.mesh.scale.y = 10 + (0.5 + 0.5 * Math.sin(this.time * 3.5 + sf.idx * 0.7)) * 12;
      sf.mesh.rotation.z = sf.side * (0.18 + Math.sin(this.time * 2.4 + sf.idx * 0.45) * 0.34);
      sf.mesh.rotation.x = Math.cos(this.time * 2.0 + sf.idx * 0.5) * 0.18;
    }

    // 5. 8 道激光摇曳
    for (const l of this.lasers) {
      l.beam.rotation.z = Math.sin(this.time * 1.4 + l.i * 0.95) * 0.52;
      l.beam.rotation.x = Math.cos(this.time * 1.1 + l.i * 0.8) * 0.34;
    }

    // 6. 水幕与大船投影屏实时绘制（15fps 兼顾丝滑与低开销）
    if (Math.floor(this.time * 15) !== Math.floor((this.time - dt) * 15)) {
      this._drawScreens(this.time);
    }

    // 7. 古风伴奏节拍
    if (this.time >= this.nextNoteTime) {
      this._playPentatonicStep();
      this.nextNoteTime = this.time + 0.42;
    }

    // 8. 空中体素烟花
    if (this.time >= this.nextBurst) {
      this._spawnFirework();
      this.nextBurst = this.time + 1.25;
    }

    this.fwBits.begin();
    for (let i = this.bursts.length - 1; i >= 0; i--) {
      const b = this.bursts[i];
      b.age += dt;
      if (b.age >= b.life) {
        this.bursts.splice(i, 1);
        continue;
      }
      const p = b.age / b.life;
      const size = (1 - p) * 1.05;
      for (const sp of b.sparks) {
        const sx = b.cx + sp.vx * b.age;
        const sy = b.cy + sp.vy * b.age - 4.8 * b.age * b.age;
        const sz = b.cz + sp.vz * b.age;
        this.fwBits.add(sx, sy, sz, size, b.color, 2.3 * (1 - p * 0.5), b.age * 3);
      }
    }
    this.fwBits.end();
  }
}
