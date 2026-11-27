// 体素角色库：每个函数返回一个 Vox 模型，脸朝 +z，脚底在 y = -1 或 0
import { Vox, hash } from './vox.js';

const EYE = 0x2a1e2e, PINK = 0xff9db0, WHITE = 0xffffff;
const blob = (v, x0, x1, y0, y1, z0, z1, rx, ry, rz, cy, p, c) => {
  for (let x = x0; x <= x1; x++) for (let y = y0; y <= y1; y++) for (let z = z0; z <= z1; z++)
    if (Math.pow(Math.abs(x) / rx, p) + Math.pow(Math.abs(y - cy) / ry, p) + Math.pow(Math.abs(z) / rz, p) <= 1) v.set(x, y, z, typeof c === 'function' ? c(x, y, z) : c);
};

// 团团：圆角方块小团子，红围巾。mood: happy / scared
export function tuan(mood = 'happy') {
  const v = new Vox(), BODY = 0xfdf8f0, SHADE = 0xf0e4d6, RED = 0xe8312f;
  blob(v, -6, 6, 0, 11, -5, 5, 6.7, 6.1, 5.7, 5.5, 2.8, (x, y) => y <= 1 ? SHADE : BODY);
  v.box(-1, 12, -1, 1, 12, 1, BODY); v.set(0, 13, 0, BODY).set(1, 14, 0, BODY);        // 头顶的小尖
  if (mood === 'scared') { for (const sx of [-1, 1]) { v.box(sx * 2 - (sx > 0 ? 0 : 1), 6, 5, sx * 2 + (sx > 0 ? 1 : 0), 7, 5, WHITE); v.set(sx * 2, 6, 5, EYE); } v.set(-1, 4, 5, 0xd9506e).set(0, 4, 5, 0xd9506e).set(1, 4, 5, 0xd9506e); }
  else if (mood === 'cheeky') { for (const sx of [-1, 1]) { v.set(sx * 2, 7, 5, EYE).set(sx * 3, 6, 5, EYE).set(sx * 1, 6, 5, EYE); } v.box(-1, 4, 5, 1, 4, 5, 0xd9506e); }
  else { v.box(-2, 6, 5, -2, 7, 5, EYE); v.box(2, 6, 5, 2, 7, 5, EYE); v.set(0, 5, 5, 0xd9506e); }
  for (const x of [-4, -3, 3, 4]) v.set(x, 5, 5, PINK);                                // 腮红
  const ring = []; v.each((x, y, z) => { if (y === 2 && !(v.has(x + 1, y, z) && v.has(x - 1, y, z) && v.has(x, y, z + 1) && v.has(x, y, z - 1))) ring.push([x, z]); });
  for (const [x, z] of ring) v.set(x, 2, z, RED);                                      // 红围巾
  v.set(3, 2, 5, RED).set(4, 2, 5, RED).set(3, 1, 5, 0xd42a28).set(3, 0, 5, RED);
  v.box(-7, 5, 0, -7, 6, 1, BODY); v.box(7, 7, 0, 7, 8, 1, BODY).set(8, 9, 0, BODY).set(8, 9, 1, BODY);   // 左手垂着，右手举起来
  v.box(-3, -1, 1, -2, -1, 3, SHADE); v.box(2, -1, 1, 3, -1, 3, SHADE);                // 脚
  return v;
}

// 小鸟啾啾：黄色小胖鸟、橘色尖嘴、三根呆毛。mood: hop（翅膀收着）/ fly（翅膀张着扇）
export function bird(mood = 'hop') {
  const v = new Vox(), Y = 0xffcf4a, YD = 0xe8b43a, OR = 0xff8a2a, CREAM = 0xfff2d2, EYE = 0x2a1e2e;
  blob(v, -4, 4, 2, 10, -4, 4, 4.8, 4.4, 4.2, 6.5, 2.6, (x, y) => y <= 3 ? YD : Y);      // 身子
  blob(v, -5, 5, 9, 16, -4, 5, 5.2, 4.2, 4.4, 12.5, 2.6, Y);                              // 脑袋
  for (const sx of [-1, 1]) { const x0 = sx > 0 ? 2 : -3; v.box(x0, 12, 5, x0 + 1, 13, 5, EYE); v.set(x0, 13, 5, 0xffffff); }   // 眼睛（带高光）
  v.set(0, 11, 5, PINK).set(-3, 11, 5, PINK).set(3, 11, 5, PINK);                          // 腮红
  v.box(-1, 10, 5, 1, 11, 5, OR); v.set(0, 10, 6, OR).set(0, 11, 6, OR);                   // 橘色尖嘴
  v.set(-1, 17, 1, OR).set(0, 17, 1, OR).set(1, 17, 1, OR).set(0, 18, 1, OR).set(0, 18, 3, OR);   // 呆毛
  for (let y = 6; y <= 8; y++) { v.set(0, y, -6, CREAM); v.set(0, y, -7, YD); }             // 尾巴
  v.set(1, 7, -6, OR).set(-1, 7, -6, OR).set(0, 9, -6, YD);
  for (const sx of [-1, 1]) { v.set(sx, 0, 2, OR).set(sx, 1, 2, OR).set(sx, 0, 3, OR); }     // 小脚
  if (mood === 'fly') {                                                                    // 翅膀张开：往上往外扇
    for (const sx of [-1, 1]) for (let k = 0; k < 3; k++) v.box(sx * (5 + k), 8 + k * 2, -1 + k, sx * (5 + k), 9 + k * 2, k + 1, k ? YD : Y);
  } else {                                                                                 // 翅膀收着
    for (const sx of [-1, 1]) v.box(sx * 5, 5, -2, sx * 5, 8, 1, YD);
  }
  return v;
}

// 小年兽：青绿色的身子、橘黄色的鬃毛、两只小金角、两颗小虎牙。mood: happy / scared；fu: 肚子上贴红福
export function nian(mood = 'happy', fu = false) {
  const v = new Vox(), T = 0x2fb0a2, TD = 0x239085, CREAM = 0xfff1d8, ORA = 0xff7f1f, ORL = 0xffa23a, GOLD = 0xffe066;
  // 鬃毛（先放，后面的头会盖住中间）
  for (let x = -10; x <= 10; x++) for (let y = 7; y <= 21; y++) {
    const r = Math.hypot(x / 6.7, (y - 12) / 5.6), sec = Math.floor((Math.atan2(y - 12, x) + Math.PI) / (Math.PI * 2) * 14);
    for (const z of [-2, -1, 0, 1]) if (r > .9 && (r <= (z === -2 ? 1.05 : 1.2) || (r <= 1.42 && sec % 2 === 0 && z >= 0))) v.set(x, y, z, hash(x, y, 51 + z) < .5 ? ORA : ORL);
  }
  blob(v, -4, 4, 1, 6, -3, 3, 4.7, 3.4, 3.7, 3.5, 3, (x, y) => y <= 1 ? TD : T);       // 身子
  v.each((x, y, z) => { if (z === 3 && Math.abs(x) <= 2 && y >= 2 && y <= 5) v.set(x, y, z, CREAM); });   // 奶油色肚皮
  for (const sx of [-1, 1]) {                                                           // 四只小爪子
    v.box(sx > 0 ? 2 : -4, 0, 1, sx > 0 ? 4 : -2, 1, 4, T); v.box(sx > 0 ? 2 : -4, 0, 4, sx > 0 ? 4 : -2, 0, 4, CREAM);
    v.box(sx > 0 ? 2 : -4, 0, -4, sx > 0 ? 4 : -2, 1, -2, TD);
  }
  blob(v, -6, 6, 7, 17, -5, 5, 6.7, 5.4, 5.7, 12, 3, T);                                // 大脑袋
  v.box(-2, 8, 5, 2, 10, 6, CREAM); v.set(0, 10, 6, 0x7a3b3b);                          // 嘴巴一圈和鼻子
  v.set(-2, 7, 6, WHITE).set(2, 7, 6, WHITE);                                           // 小虎牙
  for (const sx of [-1, 1]) {
    const x0 = sx > 0 ? 3 : -4;
    if (mood === 'scared') { v.box(x0, 12, 5, x0 + 1, 13, 5, WHITE); v.set(sx > 0 ? 3 : -3, 12, 5, EYE); }
    else { v.box(x0, 12, 5, x0 + 1, 13, 5, EYE); v.set(x0, 13, 5, WHITE); }             // 大眼睛带高光
    v.set(sx * 4, 11, 5, PINK);
    v.box(sx * 3, 17, 2, sx * 3, 19, 3, GOLD); v.set(sx * 4, 20, 2, 0xfff2b0).set(sx * 4, 20, 3, 0xfff2b0);   // 小金角
  }
  if (mood === 'scared') {
    v.box(-1, 8, 6, 1, 8, 6, 0x5a2a3a);                                                 // 张大的嘴
    for (const sx of [-1, 1]) v.set(sx * 4, 14, 5, 0x1a6e66).set(sx * 3, 15, 5, 0x1a6e66);   // 八字眉
    v.set(5, 17, 5, 0xd6f0ff).box(5, 15, 5, 5, 16, 5, 0x6ec6ff); v.set(6, 15, 5, 0x6ec6ff).set(6, 16, 4, 0x6ec6ff);   // 大汗珠
  } else v.box(-1, 8, 6, 1, 8, 6, 0xd9506e);                                            // 笑着的嘴
  v.set(0, 3, -4, T).set(0, 4, -5, T).set(0, 5, -6, T).set(0, 6, -6, T);                // 尾巴
  v.set(0, 7, -6, ORA).set(0, 8, -6, ORL).set(1, 7, -6, ORL).set(-1, 7, -6, ORA).set(0, 7, -7, ORA);
  if (fu) { v.box(-1, 3, 4, 1, 5, 4, 0xe8312f); v.set(0, 4, 4, 0xffd24a); }
  return v;
}

// 夏日小草帽：戴在团团头顶（y=11 左右）
export function strawHat() {
  const v = new Vox(), S1 = 0xf2cb6e, S2 = 0xe5b852, RED = 0xe8312f;
  for (let x = -8; x <= 8; x++) for (let z = -7; z <= 7; z++) {
    const r = Math.hypot(x / 8.2, z / 7.2);
    if (r <= 1.0 && r >= 0.52) v.set(x, 0, z, (Math.abs(x) + Math.abs(z)) % 2 ? S1 : S2);
  }
  for (let y = 1; y <= 3; y++) for (let x = -5; x <= 5; x++) for (let z = -4; z <= 4; z++) {
    const r = Math.hypot(x / (5.4 - y * .45), z / (4.5 - y * .4));
    if (r <= 1.0) v.set(x, y, z, y === 1 && r > .75 ? RED : (x + y + z) % 2 ? S1 : S2);
  }
  v.set(5, 1, 2, RED).set(6, 0, 3, 0xd42a28).set(6, 0, 4, RED);  // 飘带小尾巴
  return v;
}

// 荷塘小青蛙「呱呱」：翠绿胖身子、奶油肚皮、头顶鼓鼓大眼睛。mood: happy / surprised / laugh
export function frog(mood = 'happy') {
  const v = new Vox(), G1 = 0x57c44b, G2 = 0x42a83a, GD = 0x318c2e, BELLY = 0xf6f0c8;
  blob(v, -5, 5, 1, 8, -4, 4, 5.2, 4.1, 4.4, 4.5, 2.6, (x, y) => y <= 2 ? G2 : G1);           // 圆滚滚身子
  for (let x = -3; x <= 3; x++) for (let y = 2; y <= 5; y++) if (Math.abs(x) + Math.abs(y - 3.5) < 4.5) v.set(x, y, 4, BELLY);  // 奶油肚皮
  // 头顶两只鼓眼睛
  for (const sx of [-1, 1]) {
    v.box(sx * 3 - (sx > 0 ? 1 : 0), 8, 0, sx * 3 + (sx > 0 ? 0 : 1), 10, 2, G1);
    const ex = sx > 0 ? 2 : -3;
    if (mood === 'laugh') {
      v.set(ex, 9, 3, EYE).set(ex + 1, 10, 3, EYE);
      v.box(ex, 8, 3, ex + 1, 8, 3, G1);
    } else if (mood === 'surprised') {
      v.box(ex, 8, 3, ex + 1, 10, 3, WHITE); v.set(sx > 0 ? 2 : -2, 9, 3, EYE);
    } else {
      v.box(ex, 8, 3, ex + 1, 10, 3, WHITE); v.box(ex, 8, 3, ex + 1, 9, 3, EYE); v.set(ex, 10, 3, WHITE);
    }
    v.set(sx * 4, 6, 4, PINK);                                                               // 腮红
  }
  // 嘴巴
  if (mood === 'laugh') { v.box(-2, 5, 5, 2, 6, 5, 0xe85874); v.box(-1, 5, 5, 1, 5, 5, 0xff9db0); }
  else if (mood === 'surprised') { v.box(-1, 5, 5, 1, 6, 5, 0x5a2a3a); }
  else { v.box(-2, 6, 5, 2, 6, 5, 0x2a5a26); v.set(0, 5, 5, 0xd9506e); }
  // 折叠后腿与前爪
  for (const sx of [-1, 1]) {
    v.box(sx * 5, 1, -2, sx * 6, 3, 1, GD);                                                  // 后大腿
    v.box(sx * 5, 0, 0, sx * 6, 0, 3, G2);                                                   // 后脚蹼
    v.box(sx * 2, 0, 3, sx * 3, 1, 4, G2);                                                   // 前小手
  }
  return v;
}
