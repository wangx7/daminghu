// 导演运镜巡游 & 浏览器一键录屏模块（自动运镜游览大明湖五大经典机位 + WebM 视频导出）
import * as THREE from 'three';

const TOUR_SHOTS = [
  {
    title: '第一幕 · 大明湖南门牌坊',
    subtitle: '步入泉城明珠，匾额古韵迎宾',
    from: [-218, 22, 346],
    to: [-218, 13, 294],
    lookFrom: [-218, 10, 260],
    lookTo: [-218, 9, 255],
    duration: 7.0,
    timeMode: 'morning',
    chaoranLit: false,
  },
  {
    title: '第二幕 · 历下亭湖心古岛',
    subtitle: '海右此亭古，济南名士多',
    from: [58, 22, 62],
    to: [-42, 16, 48],
    lookFrom: [0, 8, 0],
    lookTo: [0, 8, 0],
    duration: 7.5,
    timeMode: 'noon',
    chaoranLit: false,
  },
  {
    title: '第三幕 · 明湖画舫碧波泛舟',
    subtitle: '四面荷花三面柳，一城山色半城湖',
    from: [-155, 16, 155],
    to: [-260, 14, 118],
    lookFrom: [-218, 5, 135],
    lookTo: [-218, 5, 115],
    duration: 7.0,
    timeMode: 'afternoon',
    chaoranLit: false,
  },
  {
    title: '第四幕 · 超然楼华灯初上',
    subtitle: '江北第一楼，夜色流金溢彩',
    from: [396, 24, -10],
    to: [436, 46, -125],
    lookFrom: [503, 24, -70],
    lookTo: [503, 28, -70],
    duration: 8.5,
    timeMode: 'night',
    chaoranLit: true,
  },
  {
    title: '第五幕 · 铁公祠与摩天轮晚照',
    subtitle: '夕阳熔金映明湖，古今交融泉城夜',
    from: [-485, 28, -145],
    to: [-580, 36, -245],
    lookFrom: [-565, 10, -210],
    lookTo: [-660, 24, -210],
    duration: 8.0,
    timeMode: 'sunset',
    chaoranLit: true,
  },
];

function easeInOut(t) {
  return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
}

export class DirectorMode {
  constructor({ camera, world, sky, onStateChange, onCaptionChange }) {
    this.camera = camera;
    this.world = world;
    this.sky = sky;
    this.onStateChange = onStateChange;
    this.onCaptionChange = onCaptionChange;

    this.active = false;
    this.shotIdx = 0;
    this.shotTime = 0;
    this._appliedShot = -1;

    this.recording = false;
    this.recorder = null;
    this.chunks = [];

    this._vPos = new THREE.Vector3();
    this._vLook = new THREE.Vector3();
  }

  toggleTour() {
    if (this.active) this.stopTour();
    else this.startTour();
    return this.active;
  }

  startTour() {
    this.active = true;
    this.shotIdx = 0;
    this.shotTime = 0;
    this._appliedShot = -1;
    this.onStateChange?.(true);
  }

  stopTour() {
    if (!this.active) return;
    this.active = false;
    if (this.recording) this.stopRecording();
    this.onStateChange?.(false);
  }

  toggleRecording(canvas) {
    if (this.recording) {
      this.stopRecording();
      return false;
    }
    return this.startRecording(canvas);
  }

  startRecording(canvas) {
    if (!canvas || typeof MediaRecorder === 'undefined') {
      this.onCaptionChange?.('录屏提示', '当前浏览器不支持内置录屏');
      return false;
    }
    try {
      const stream = canvas.captureStream(30);
      const mime = MediaRecorder.isTypeSupported('video/webm;codecs=vp9')
        ? 'video/webm;codecs=vp9'
        : 'video/webm';
      this.chunks = [];
      this.recorder = new MediaRecorder(stream, { mimeType: mime, videoBitsPerSecond: 6000000 });
      this.recorder.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) this.chunks.push(e.data);
      };
      this.recorder.onstop = () => {
        const blob = new Blob(this.chunks, { type: mime });
        const url = URL.createObjectURL(blob);
        if (typeof document !== 'undefined') {
          const a = document.createElement('a');
          const ts = new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-');
          a.href = url;
          a.download = `大明湖巡游_${ts}.webm`;
          a.click();
        }
        setTimeout(() => URL.revokeObjectURL(url), 4000);
      };
      this.recorder.start();
      this.recording = true;
      return true;
    } catch (_) {
      return false;
    }
  }

  stopRecording() {
    if (this.recorder && this.recorder.state !== 'inactive') {
      this.recorder.stop();
    }
    this.recording = false;
  }

  update(dt) {
    if (!this.active) return false;
    const shot = TOUR_SHOTS[this.shotIdx];
    if (this._appliedShot !== this.shotIdx) {
      this._appliedShot = this.shotIdx;
      this.sky.setMode(shot.timeMode);
      this.sky.setChaoranLit(shot.chaoranLit);
      this.world.primeAround(shot.from[0], shot.from[2], 3);
      this.onCaptionChange?.(shot.title, shot.subtitle);
    }

    this.shotTime += dt;
    const u = Math.min(1, this.shotTime / shot.duration);
    const e = easeInOut(u);

    this._vPos.set(
      THREE.MathUtils.lerp(shot.from[0], shot.to[0], e),
      THREE.MathUtils.lerp(shot.from[1], shot.to[1], e),
      THREE.MathUtils.lerp(shot.from[2], shot.to[2], e),
    );
    this._vLook.set(
      THREE.MathUtils.lerp(shot.lookFrom[0], shot.lookTo[0], e),
      THREE.MathUtils.lerp(shot.lookFrom[1], shot.lookTo[1], e),
      THREE.MathUtils.lerp(shot.lookFrom[2], shot.lookTo[2], e),
    );

    this.camera.position.copy(this._vPos);
    this.camera.lookAt(this._vLook);
    this.world.update(this._vPos.x, this._vPos.z, 3);

    if (this.shotTime >= shot.duration) {
      this.shotTime = 0;
      this.shotIdx = (this.shotIdx + 1) % TOUR_SHOTS.length;
    }
    return true;
  }
}
