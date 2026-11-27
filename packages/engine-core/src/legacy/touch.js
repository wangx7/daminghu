// 手机横屏原生手游级多点触控系统：
// - 左下角 360° 虚拟摇杆（同步支持步行、跑车、直升机、降落伞、划船、游泳）
// - 右半屏空白处滑动旋转镜头 + 双指捏合缩放视距
// - 右下角手游动作按钮组（跳/爬升、动态互动 E、直升机/跳伞、跑车、观光车、飞行下降键）
import * as THREE from 'three';

export class TouchControls {
  constructor(domElement, player, keys, actions) {
    this.dom = domElement;
    this.player = player;
    this.keys = keys;
    this.actions = actions;

    // 摇杆输出 (-1 ~ 1)：x 右正左负，y 前正后负
    this.joyX = 0;
    this.joyY = 0;
    this.joyPointerId = null;
    this.joyCenter = { x: 0, y: 0 };

    // 视角单指拖拽 & 双指捏合缩放
    this.lookPointers = new Map();
    this.lastPinchDist = null;

    this.walkLayer = document.getElementById('mobile-controls');
    this.driveLayer = document.getElementById('drive-controls');
    this.joyBase = document.getElementById('joy-base');
    this.joyKnob = document.getElementById('joy-knob');
    this.btnJump = document.getElementById('m-jump');
    this.btnDown = document.getElementById('m-down');
    this.btnAct = document.getElementById('m-act');
    this.btnHeli = document.getElementById('m-heli');
    this.btnCar = document.getElementById('m-car');
    this.btnBus = document.getElementById('m-bus');

    // 刺激战场风格驾驶按键
    this.btnLeft = document.getElementById('d-left');
    this.btnRight = document.getElementById('d-right');
    this.btnGas = document.getElementById('d-gas');
    this.btnBoost = document.getElementById('d-boost');
    this.btnBrake = document.getElementById('d-brake');
    this.btnResetCar = document.getElementById('d-reset');
    this.btnExitCar = document.getElementById('d-exit');

    this._initJoystick();
    this._initButtons();
    this._initLookAndPinch();
  }

  _initJoystick() {
    if (!this.joyBase) return;
    const maxR = 44;

    const updateKnob = (clientX, clientY) => {
      const dx = clientX - this.joyCenter.x;
      const dy = clientY - this.joyCenter.y;
      const dist = Math.hypot(dx, dy);
      const clamped = Math.min(maxR, dist);
      const ang = Math.atan2(dy, dx);
      const kx = Math.cos(ang) * clamped;
      const ky = Math.sin(ang) * clamped;
      this.joyKnob.style.transform = `translate(${kx}px, ${ky}px)`;
      this.joyX = clamped > 6 ? (kx / maxR) : 0;
      this.joyY = clamped > 6 ? (-ky / maxR) : 0; // 向上推为正（前进）
    };

    this.joyBase.addEventListener('pointerdown', (e) => {
      e.stopPropagation();
      e.preventDefault();
      this.joyBase.setPointerCapture(e.pointerId);
      this.joyPointerId = e.pointerId;
      const rect = this.joyBase.getBoundingClientRect();
      this.joyCenter = { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
      updateKnob(e.clientX, e.clientY);
    });

    this.joyBase.addEventListener('pointermove', (e) => {
      if (e.pointerId !== this.joyPointerId) return;
      e.stopPropagation();
      e.preventDefault();
      updateKnob(e.clientX, e.clientY);
    });

    const resetJoy = (e) => {
      if (e.pointerId !== this.joyPointerId) return;
      this.joyPointerId = null;
      this.joyX = 0;
      this.joyY = 0;
      this.joyKnob.style.transform = 'translate(0px, 0px)';
    };
    this.joyBase.addEventListener('pointerup', resetJoy);
    this.joyBase.addEventListener('pointercancel', resetJoy);
  }

  _bindHold(el, keyCode) {
    if (!el) return;
    const on = (e) => { e.stopPropagation(); e.preventDefault(); this.keys[keyCode] = true; el.classList.add('active'); };
    const off = (e) => { e.stopPropagation(); this.keys[keyCode] = false; el.classList.remove('active'); };
    el.addEventListener('pointerdown', on);
    el.addEventListener('pointerup', off);
    el.addEventListener('pointercancel', off);
    el.addEventListener('pointerleave', off);
  }

  _bindTap(el, fn) {
    if (!el) return;
    el.addEventListener('pointerdown', (e) => {
      e.stopPropagation();
      e.preventDefault();
      fn();
    });
  }

  _initButtons() {
    // 跳跃键：按下瞬间触发精准三段跳 / 水中跃出岸；同时保持 Space 按住供直升机爬升！
    if (this.btnJump) {
      const on = (e) => {
        e.stopPropagation();
        e.preventDefault();
        this.keys['Space'] = true;
        this.btnJump.classList.add('active');
        this.player.triggerJump();
      };
      const off = (e) => {
        e.stopPropagation();
        this.keys['Space'] = false;
        this.btnJump.classList.remove('active');
      };
      this.btnJump.addEventListener('pointerdown', on);
      this.btnJump.addEventListener('pointerup', off);
      this.btnJump.addEventListener('pointercancel', off);
      this.btnJump.addEventListener('pointerleave', off);
    }
    this._bindHold(this.btnDown, 'KeyC');
    this._bindTap(this.btnAct, () => this.actions.onAction());
    this._bindTap(this.btnHeli, () => this.actions.onHeli());
    this._bindTap(this.btnCar, () => this.actions.onCar());
    this._bindTap(this.btnBus, () => this.actions.onBus());

    // 刺激战场风格驾驶按键绑定（前进油门 / 后退倒车 / 加速 / 左右转 / 复位 / 下车）
    this._bindHold(this.btnLeft, 'CarLeft');
    this._bindHold(this.btnRight, 'CarRight');
    this._bindHold(this.btnGas, 'CarGas');
    this._bindHold(this.btnBoost, 'CarBoost');
    this._bindHold(this.btnBrake, 'CarBrake');
    this._bindTap(this.btnResetCar, () => this.player.resetCarPosition());
    this._bindTap(this.btnExitCar, () => this.actions.onCar());
  }

  _initLookAndPinch() {
    this.dom.addEventListener('pointerdown', (e) => {
      this.lookPointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (this.lookPointers.size === 2) {
        const pts = [...this.lookPointers.values()];
        this.lastPinchDist = Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y);
      }
    });

    this.dom.addEventListener('pointermove', (e) => {
      if (!this.lookPointers.has(e.pointerId)) return;
      const prev = this.lookPointers.get(e.pointerId);
      const dx = e.clientX - prev.x;
      const dy = e.clientY - prev.y;
      this.lookPointers.set(e.pointerId, { x: e.clientX, y: e.clientY });

      if (this.lookPointers.size === 2) {
        const pts = [...this.lookPointers.values()];
        const dist = Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y);
        if (this.lastPinchDist !== null) {
          this.player.camDist = THREE.MathUtils.clamp(this.player.camDist - (dist - this.lastPinchDist) * 0.06, 5, 85);
        }
        this.lastPinchDist = dist;
      } else if (this.lookPointers.size === 1) {
        this.player.camYaw -= dx * 0.0065;
        this.player.camPitch = THREE.MathUtils.clamp(this.player.camPitch + dy * 0.0055, -0.35, 1.35);
        this.player.manualLookCooldown = 1.6; // 玩家主动看风景时绝不抢镜头
      }
    });

    const endPtr = (e) => {
      this.lookPointers.delete(e.pointerId);
      if (this.lookPointers.size < 2) this.lastPinchDist = null;
    };
    window.addEventListener('pointerup', endPtr);
    window.addEventListener('pointercancel', endPtr);
  }

  syncUI(player, living) {
    if (!this.btnJump) return;
    // 开车时自动切换为刺激战场经典驾驶按键层！
    if (this.walkLayer && this.driveLayer) {
      this.walkLayer.classList.toggle('hidden-for-drive', player.inCar);
      this.driveLayer.classList.toggle('show-drive', player.inCar);
    }

    const jLabel = this.btnJump.querySelector('.m-lbl');
    if (jLabel) jLabel.textContent = player.inHeli ? '爬升' : (player.swimming ? '上岸' : '跳跃');
    if (this.btnDown) this.btnDown.style.display = player.inHeli ? 'flex' : 'none';
    if (this.btnHeli) this.btnHeli.classList.toggle('active', player.inHeli || player.parachuting);
    if (this.btnCar) this.btnCar.classList.toggle('active', player.inCar);
    if (this.btnBus) this.btnBus.classList.toggle('active', !!player.ridingBus);

    if (this.btnAct) {
      const hint = player.getActionHint();
      const nearBus = !player.ridingBus && living && living.findNearbyBus(player.pos.x, player.pos.z, 15);
      if (nearBus) {
        this.btnAct.textContent = '上车';
        this.btnAct.style.display = 'flex';
      } else if (hint.canAct && hint.type === 'cruise_enter') {
        this.btnAct.textContent = '登画舫';
        this.btnAct.style.display = 'flex';
      } else if (hint.canAct && hint.type === 'cruise_exit') {
        this.btnAct.textContent = '下画舫';
        this.btnAct.style.display = 'flex';
      } else if (hint.canAct && hint.type === 'ferris_enter') {
        this.btnAct.textContent = '坐摩天轮';
        this.btnAct.style.display = 'flex';
      } else if (hint.canAct && hint.type === 'ferris_exit') {
        this.btnAct.textContent = '下摩天轮';
        this.btnAct.style.display = 'flex';
      } else if (hint.canAct && hint.type === 'elevator_up') {
        this.btnAct.textContent = '登7楼';
        this.btnAct.style.display = 'flex';
      } else if (hint.canAct && hint.type === 'elevator_down') {
        this.btnAct.textContent = '回1楼';
        this.btnAct.style.display = 'flex';
      } else if (hint.canAct && hint.type === 'boat') {
        this.btnAct.textContent = player.inBoat ? '上岸' : '划船';
        this.btnAct.style.display = 'flex';
      } else {
        this.btnAct.style.display = 'none';
      }
    }
  }
}
