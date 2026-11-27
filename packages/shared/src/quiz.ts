export type QuizCategory = 'poetry' | 'math' | 'mixed';

export interface QuizQuestion {
  id: string;
  category: 'poetry' | 'math';
  badge: string;
  prompt: string;
  hint: string;
  options: string[];
  answerIndex: number;
  explanation: string;
}

const POETRY_BANK: readonly QuizQuestion[] = [
  {
    id: 'p1',
    category: 'poetry',
    badge: '大明湖名联',
    prompt: '“四面荷花三面柳”的下一句是？',
    hint: '清代刘凤诰题济南大明湖铁公祠名联',
    options: ['一城山色半城湖', '泉城处处是荷花', '半城烟柳半城花', '一湖秋水半城风'],
    answerIndex: 0,
    explanation: '“四面荷花三面柳，一城山色半城湖”正是济南大明湖最著名的楹联！',
  },
  {
    id: 'p2',
    category: 'poetry',
    badge: '小学必背 · 咏柳',
    prompt: '“碧玉妆成一树高”的下一句是？',
    hint: '唐 · 贺知章《咏柳》',
    options: ['万条垂下绿丝绦', '二月春风似剪刀', '春风吹又生', '映日荷花别样红'],
    answerIndex: 0,
    explanation: '碧玉妆成一树高，万条垂下绿丝绦。大明湖畔最美的正是垂柳！',
  },
  {
    id: 'p3',
    category: 'poetry',
    badge: '盛夏赏荷',
    prompt: '“接天莲叶无穷碧”的下一句是？',
    hint: '宋 · 杨万里《晓出净慈寺送林子方》',
    options: ['小荷才露尖尖角', '映日荷花别样红', '出淤泥而不染', '荷尽已无擎雨盖'],
    answerIndex: 1,
    explanation: '接天莲叶无穷碧，映日荷花别样红。',
  },
  {
    id: 'p4',
    category: 'poetry',
    badge: '夏日小诗',
    prompt: '“小荷才露尖尖角”的下一句是？',
    hint: '宋 · 杨万里《小池》',
    options: ['早有蜻蜓立上头', '不解藏踪迹', '浮萍一道开', '泉眼无声惜细流'],
    answerIndex: 0,
    explanation: '小荷才露尖尖角，早有蜻蜓立上头。',
  },
  {
    id: 'p5',
    category: 'poetry',
    badge: '团团最爱 · 池上',
    prompt: '“小娃撑小艇，偷采白莲回”下一句是？',
    hint: '唐 · 白居易《池上》',
    options: ['不解藏踪迹，浮萍一道开', '童孙未解供耕织', '牧童骑黄牛，歌声振林樾', '儿童散学归来早'],
    answerIndex: 0,
    explanation: '不解藏踪迹，浮萍一道开——在大明湖划小木船就像这首诗一样！',
  },
  {
    id: 'p6',
    category: 'poetry',
    badge: '名句接龙',
    prompt: '“欲穷千里目”的下一句是？',
    hint: '唐 · 王之涣《登鹳雀楼》',
    options: ['更上一层楼', '黄河入海流', '一览众山小', '白日依山尽'],
    answerIndex: 0,
    explanation: '欲穷千里目，更上一层楼。登上大明湖超然楼也能俯瞰全城！',
  },
  {
    id: 'p7',
    category: 'poetry',
    badge: '唐诗经典',
    prompt: '“春眠不觉晓，处处闻啼鸟”下一句是？',
    hint: '唐 · 孟浩然《春晓》',
    options: ['夜来风雨声，花落知多少', '野火烧不尽，春风吹又生', '春色满园关不住', '两个黄鹂鸣翠柳'],
    answerIndex: 0,
    explanation: '夜来风雨声，花落知多少。',
  },
  {
    id: 'p8',
    category: 'poetry',
    badge: '冬日名篇',
    prompt: '“孤舟蓑笠翁”的下一句是？',
    hint: '唐 · 柳宗元《江雪》',
    options: ['独钓寒江雪', '千山鸟飞绝', '万径人踪灭', '白雪却嫌春色晚'],
    answerIndex: 0,
    explanation: '孤舟蓑笠翁，独钓寒江雪。切换冬日大明湖就能看到雪景！',
  },
  {
    id: 'p9',
    category: 'poetry',
    badge: '济南名士 · 辛弃疾',
    prompt: '“稻花香里说丰年”的下一句是？',
    hint: '宋 · 辛弃疾（济南籍词人）《西江月》',
    options: ['听取蛙声一片', '明月别枝惊鹊', '清风半夜鸣蝉', '旧时茅店社林边'],
    answerIndex: 0,
    explanation: '济南词人辛弃疾名句：稻花香里说丰年，听取蛙声一片。',
  },
  {
    id: 'p10',
    category: 'poetry',
    badge: '济南名士 · 李清照',
    prompt: '“争渡，争渡”的下一句是？',
    hint: '宋 · 李清照（济南籍词人）《如梦令》',
    options: ['惊起一滩鸥鹭', '误入藕花深处', '沉醉不知归路', '兴尽晚回舟'],
    answerIndex: 0,
    explanation: '大明湖畔藕神祠纪念的正是李清照：争渡，争渡，惊起一滩鸥鹭！',
  },
  {
    id: 'p11',
    category: 'poetry',
    badge: '秋日佳句',
    prompt: '“停车坐爱枫林晚”的下一句是？',
    hint: '唐 · 杜牧《山行》',
    options: ['霜叶红于二月花', '远上寒山石径斜', '白云生处有人家', '湖光秋月两相和'],
    answerIndex: 0,
    explanation: '停车坐爱枫林晚，霜叶红于二月花。',
  },
  {
    id: 'p12',
    category: 'poetry',
    badge: '友情名句',
    prompt: '“桃花潭水深千尺”的下一句是？',
    hint: '唐 · 李白《赠汪伦》',
    options: ['不及汪伦送我情', '天下谁人不识君', '西出阳关无故人', '海内存知己'],
    answerIndex: 0,
    explanation: '桃花潭水深千尺，不及汪伦送我情。',
  },
];

function shuffle<T>(arr: T[]): T[] {
  const copy = [...arr];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

/**
 * 动态生成趣味数学题（加减乘除 + 小学应用口算，永不重样）
 */
export function generateMathQuestion(): QuizQuestion {
  const kind = Math.floor(Math.random() * 4);
  let prompt = '';
  let answer = 0;
  let hint = '仔细心算一下哦！';
  let explanation = '';

  if (kind === 0) {
    // 乘法口诀
    const a = 3 + Math.floor(Math.random() * 7);
    const b = 3 + Math.floor(Math.random() * 7);
    answer = a * b;
    prompt = `大明湖每条画舫坐 ${a} 人，${b} 条画舫一共能坐多少人？`;
    hint = `试试用乘法：${a} × ${b}`;
    explanation = `${a} × ${b} = ${answer} 人！`;
  } else if (kind === 1) {
    // 加法
    const a = 12 + Math.floor(Math.random() * 38);
    const b = 11 + Math.floor(Math.random() * 35);
    answer = a + b;
    prompt = `湖东盛开 ${a} 朵荷花，湖西盛开 ${b} 朵荷花，一共多少朵？`;
    hint = `把两个数加起来：${a} + ${b}`;
    explanation = `${a} + ${b} = ${answer} 朵荷花！`;
  } else if (kind === 2) {
    // 减法
    const total = 35 + Math.floor(Math.random() * 50);
    const fly = 9 + Math.floor(Math.random() * 22);
    answer = total - fly;
    prompt = `柳树上有 ${total} 只小鸟，飞走了 ${fly} 只，还剩多少只？`;
    hint = `用减法算一算：${total} - ${fly}`;
    explanation = `${total} - ${fly} = ${answer} 只小鸟！`;
  } else {
    // 整除
    const b = 2 + Math.floor(Math.random() * 7);
    const res = 3 + Math.floor(Math.random() * 8);
    const a = b * res;
    answer = res;
    prompt = `把 ${a} 颗鱼食平均分给 ${b} 条大锦鲤，每条锦鲤分到几颗？`;
    hint = `用除法：${a} ÷ ${b}`;
    explanation = `${a} ÷ ${b} = ${answer} 颗！`;
  }

  const wrongSet = new Set<number>();
  while (wrongSet.size < 3) {
    const delta = (Math.floor(Math.random() * 7) - 3) || 2;
    const cand = Math.max(1, answer + delta * (Math.random() < 0.35 ? 2 : 1));
    if (cand !== answer) wrongSet.add(cand);
  }
  const rawOptions = shuffle([answer, ...Array.from(wrongSet)]);
  const answerIndex = rawOptions.indexOf(answer);

  return {
    id: `m-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    category: 'math',
    badge: '趣味算术',
    prompt,
    hint,
    options: rawOptions.map(String),
    answerIndex,
    explanation,
  };
}

export function pickQuizQuestion(category: QuizCategory = 'mixed'): QuizQuestion {
  const actual: 'poetry' | 'math' =
    category === 'mixed' ? (Math.random() < 0.55 ? 'poetry' : 'math') : category;
  if (actual === 'math') return generateMathQuestion();
  const base = POETRY_BANK[Math.floor(Math.random() * POETRY_BANK.length)];
  const correctText = base.options[base.answerIndex];
  const shuffled = shuffle(base.options);
  return {
    ...base,
    options: shuffled,
    answerIndex: shuffled.indexOf(correctText),
  };
}
