// 人层里的其他人：住在附近或路过的人，各有自己的一天。文字为原创。
// routine / follow / reactions 的含义见 src/core/residents.js；
// age 决定体态（toddler、child、elder 由 src/worlds/residents.js 调整比例与姿势），
// wear 是附加在身上的衣物与随身物件，props 是摆在原地的东西。
// notes 与动物一样按玩家人物的 focus 选取；stateNotes 在对方处于该状态时追加；
// lines 是对方对你说的话或做出的反应，按出现次数轮换。

// 观察提示里显示的状态。labels 可以按人覆盖。
export const stateLabels = {
  walk: '在走路',
  run: '在跑',
  stand: '站着',
  sit: '坐着歇脚',
  sleep: '睡着了',
  doze: '在打盹',
  tend: '在看羊',
  call: '在唤羊',
  play: '在玩',
  squat: '蹲着看什么',
  paint: '在画画',
  look: '在看光',
  stretch: '伸懒腰',
  drink: '在喝水',
  scan: '在看望远镜',
  note: '在记笔记',
  draw: '在打水',
  carry: '在搬东西',
  gather: '在拾柴',
  greet: '在跟你打招呼',
  nod: '冲你点头',
  hush: '示意你安静',
  curious: '好奇地看着你',
  shy: '躲起来了',
  stir: '翻了个身',
};

// 牧人小屋前的院子、羊圈（门朝东）、水塘与东岸的打水处，
// 供日程和场景布置共用（场景坐标，米）。
export const HOMESTEAD = { x: -38, z: 38 };
export const PEN = { x: -31, z: 44, radius: 3.4 };
export const POND = { x: -66, z: 15 };
const SHORE = [-57.8, 15.4];
const GATE = [PEN.x + PEN.radius + 1.1, PEN.z + 0.2],
  INSIDE = [PEN.x + 1, PEN.z];

export const residents = [
  {
    id: 'herder',
    name: '放羊的老伯',
    age: 'elder',
    at: INSIDE,
    heading: 1.57,
    speed: 0.7,
    notice: 7,
    look: {
      height: 0.97,
      skin: '#9c7350',
      hair: '#d8d2c4',
      coat: '#8a6f4e',
      pants: '#4a4238',
      hat: 'straw',
      accent: '#c9b27a',
      gear: 'satchel',
      prop: 'staff',
    },
    // 羊圈的门朝东：出圈、回圈都从门口走。
    routine: [
      {
        walk: [GATE, [-20, 47], [-13, 49]],
      },
      { stay: 'tend', seconds: [14, 20], face: [-8, 53] },
      { stay: 'call', seconds: [3, 4] },
      { walk: [[-4.2, 46.8]], speed: 0.6 },
      { stay: 'sit', seconds: [16, 24], face: [-1.8, 44.7] },
      { stay: 'doze', seconds: [14, 20], face: [-1.8, 44.7] },
      { stay: 'tend', seconds: [8, 12], face: [-8, 53] },
      {
        walk: [[-13, 49], [-20, 47], GATE, INSIDE],
      },
      { stay: 'tend', seconds: [10, 14], face: [PEN.x - 2, PEN.z] },
    ],
    reactions: {
      walk: 'greet',
      tend: 'greet',
      sit: 'greet',
      call: 'nod',
      doze: 'stir',
    },
    affinity: [],
    observeRange: 13,
    notes: {
      common:
        '一位拄着木杖的老人，赶着几只山羊慢慢地走。帽檐磨出了毛边，脸被太阳晒成了深褐色。',
      insect:
        '羊群走过的地方蹦起一片小蚱蜢。有一只落在老伯的裤脚上，他也不赶，让它搭一段顺路车。',
      bird: '几只牛背鹭跟在羊群后面，羊蹄惊起蚱蜢，它们就伸长脖子去啄。老伯说这些白鸟是他的“跟班”，天天准时到。',
      weather:
        '他看天的方式和你不一样：不看云，看羊。他说羊要是挤成一团不肯散开，风就要转了。',
      track:
        '他的木杖每走两步就在土里戳出一个小圆坑，旁边是一串鞋底花纹早已磨平的脚印——这条路他走了很多年。',
      plant:
        '他把羊往坡上嫩的那片草赶，绕开了开着小紫花的一丛。好牧人认得哪些草羊吃了会闹肚子。',
    },
    stateNotes: {
      walk: '他走得不快，羊群跟在后面，像一片慢慢挪动的云。',
      tend: '他拄着木杖站着，嘴里默默数着羊。',
      call: '他把手拢在嘴边喊了一声，调子拖得很长，山羊们纷纷抬起头。',
      sit: '他背靠着石头歇脚，木杖横放在膝盖上。',
      doze: '他靠着石头打起了盹，帽檐压得低低的。',
      greet: '他朝你扬了扬手里的木杖。',
      nod: '他正唤着羊，只来得及冲你点点头。',
      stir: '他咂了咂嘴，换了个姿势，又睡过去了。',
    },
    lines: {
      greet: [
        '“早啊！看见一只黑脸的小羊没有？它总爱掉队。”',
        '“太阳一晒，羊就往树荫底下钻。你也找个阴凉歇歇脚吧。”',
      ],
      nod: ['他正唤着羊，冲你点了点头。'],
      stir: ['他嘟囔了一句听不清的话，翻了个身。'],
    },
  },
  {
    id: 'sister',
    name: '扎辫子的姐姐',
    age: 'child',
    at: [-33, 31],
    speed: 1.3,
    notice: 9,
    look: {
      height: 0.66,
      skin: '#8d6446',
      hair: '#1c1714',
      coat: '#d0644a',
      pants: '#3f4a5a',
      hat: 'band',
      accent: '#f0d27a',
    },
    routine: [
      {
        roam: 'play',
        around: [-33, 31],
        radius: 5,
        seconds: [14, 20],
        speed: 2.6,
      },
      { stay: 'squat', seconds: [6, 9] },
      {
        roam: 'play',
        around: [-33, 31],
        radius: 5,
        seconds: [10, 16],
        speed: 2.6,
      },
      { stay: 'sit', seconds: [8, 12] },
    ],
    reactions: { play: 'curious', squat: 'curious', sit: 'greet' },
    affinity: [],
    observeRange: 11,
    notes: {
      common:
        '一个十岁上下的女孩，辫子跑散了一半，裙角沾着草籽。她跑起来像一阵风。',
      insect:
        '她手心里攥着什么——摊开来，是一片亮绿色的甲虫翅鞘。她说是在白蚁丘旁边捡到的，要留着当宝贝。',
      bird: '她学珠鸡叫，“咯咯——咯咯”，学得惟妙惟肖，弟弟笑得直不起腰。',
      weather:
        '她的影子比她本人还长。太阳刚出来不久，等影子缩短了，她就该回家帮妈妈干活了。',
      track:
        '她光着脚跑，脚印前深后浅，一步跨得比你想的还远。她的脚印旁边，总跟着一串更小的。',
      plant: '她耳朵后面别着一朵黄色的小野花，跑了一路也没掉。',
    },
    stateNotes: {
      play: '她在和弟弟玩追人的游戏，一边跑一边回头笑。',
      squat: '她蹲在地上，盯着草根底下的什么东西看。',
      sit: '她跑累了，坐在地上喘气，脸颊红扑扑的。',
      curious: '她停下来，歪着头打量你，好像你是一只没见过的鸟。',
      greet: '她冲你使劲挥了挥手。',
    },
    lines: {
      curious: [
        '“你从哪里来？你也是来看狐獴的吗？”',
        '“我知道哪里有鸟窝！不过不能告诉你。”',
      ],
      greet: ['“你好呀！”'],
    },
  },
  {
    id: 'brother',
    name: '追着姐姐跑的弟弟',
    age: 'child',
    at: [-32, 30],
    follow: 'sister',
    gap: 1.5,
    side: 2.6,
    speed: 1.1,
    runSpeed: 2.4,
    distracted: 0.05,
    notice: 8,
    look: {
      height: 0.56,
      skin: '#8a6143',
      hair: '#16120f',
      coat: '#e2c25a',
      pants: '#5a6b4a',
      hat: 'none',
      accent: '#a34a32',
    },
    reactions: { stand: 'curious', walk: 'curious', squat: 'curious' },
    affinity: [],
    observeRange: 10,
    notes: {
      common:
        '一个六七岁的男孩，一直追在姐姐身后，跑得太急，时不时被自己的脚绊一下。',
      insect: '他袖口上爬着一只红色的瓢虫，他把胳膊举得高高的，生怕它飞走。',
      bird: '他一路学鸟叫，可惜学得不像，树上的织布鸟理都不理他。',
      weather: '他额头上已经出了一层细汗。早上的风还凉，他却跑得热乎乎的。',
      track:
        '他的脚印小小的，歪歪扭扭，一会儿并在姐姐的脚印旁边，一会儿又跑到前头去。',
      plant: '他手里攥着一根长长的草茎当马鞭，一边跑一边甩。',
    },
    stateNotes: {
      run: '他追着姐姐跑，跑着跑着就落下了一截。',
      walk: '他小跑着跟上姐姐。',
      stand: '他站在姐姐身边，学她的样子东张西望。',
      squat: '他蹲下来看地上的蚂蚁，完全忘了刚才在追谁。',
      curious: '他躲在姐姐身后半步的地方，好奇地偷看你。',
    },
    lines: {
      curious: [
        '他小声问姐姐：“这是谁呀？”',
        '他举起手里的草茎给你看，又飞快地藏到背后。',
      ],
    },
  },
  {
    id: 'painter',
    name: '写生的画家',
    age: 'adult',
    at: [12, -40],
    heading: -1.14,
    notice: 4,
    look: {
      height: 0.98,
      skin: '#d8b08c',
      hair: '#3b2a20',
      coat: '#5d7a8c',
      pants: '#c8bca4',
      hat: 'none',
      accent: '#b8573f',
      gear: 'scarf',
    },
    wear: ['brush'],
    props: [
      { kind: 'easel', at: [11, -39.55], face: [12, -40] },
      { kind: 'stool', at: [12, -40] },
    ],
    routine: [
      { stay: 'paint', seconds: [24, 34], face: [-14, -28] },
      { stay: 'look', seconds: [5, 8], face: [-14, -28] },
      { stay: 'paint', seconds: [18, 26], face: [-14, -28] },
      { stay: 'stretch', seconds: [3, 4], face: [-14, -28] },
    ],
    reactions: { look: 'nod', stretch: 'greet' },
    affinity: [],
    observeRange: 12,
    notes: {
      common:
        '一个年轻的画家坐在小凳上，面前支着画架。画布上的老树已经有了轮廓，天空还空着。',
      insect:
        '一只小蜂停在她的调色板上，在一团黄颜料边上来回打转——大概把它当成了花粉。',
      bird: '画布的角落里有几个小黑点，是刚才飞过老树的鸟。她画鸟只用一笔。',
      weather:
        '她一直在等光。清晨的光一会儿一个样，她每隔几分钟就要重新调一次天空的颜色。',
      track:
        '画架的三条腿在土里压出三个小坑，凳子周围的草被踩得平平的——她在这里已经坐了很久。',
      plant:
        '她用的绿不止一种：近处的草偏黄，远处的金合欢偏灰。她说植物的颜色有一半是光给的。',
    },
    stateNotes: {
      paint: '她专心地画着，没有抬头。',
      look: '她放下画笔，眯起眼睛望着远处，像在等什么。',
      stretch: '她站起来伸了个懒腰，活动着僵硬的肩膀。',
      nod: '她冲你笑了笑，又转回画布。',
      greet: '她转过身，朝你挥了挥沾着颜料的手。',
    },
    lines: {
      nod: ['“再等一会儿，等那片云走开，光就对了。”'],
      greet: [
        '“要看看吗？还没画完呢。天亮得太快，我总追不上。”',
        '“你也是一大早出来的？这个时候的原野最好看。”',
      ],
    },
  },
  {
    id: 'traveler',
    name: '打盹的旅人',
    age: 'adult',
    at: [-40.5, -13],
    heading: 0.79,
    notice: 6,
    look: {
      height: 1.02,
      skin: '#c99e7a',
      hair: '#4a3a2c',
      coat: '#7b6a4c',
      pants: '#3e4b52',
      hat: 'none',
      accent: '#5b4a36',
    },
    wear: ['feltHat'],
    props: [{ kind: 'backpack', at: [-39.6, -14.2], face: [-37, -9.5] }],
    routine: [
      { stay: 'sleep', seconds: [40, 60], face: [-37, -9.5] },
      { stay: 'sit', seconds: [8, 12], face: [-37, -9.5] },
      { stay: 'drink', seconds: [3, 4], face: [-37, -9.5] },
      { stay: 'sit', seconds: [10, 16], face: [-37, -9.5] },
    ],
    reactions: { sleep: 'stir', sit: 'nod', drink: 'nod' },
    affinity: [],
    observeRange: 11,
    notes: {
      common:
        '一个背包客在树荫下睡着了，帽子盖在脸上。他的靴子糊满干泥，看得出走了很远的路。',
      insect: '一队蚂蚁正沿着他的背包带往上爬，目标是包口露出来的半块饼干。',
      bird: '一只小鸟落在他的背包上，啄了啄挂着的绳结，又飞走了。他毫无察觉。',
      weather:
        '他挑的这片树荫正好挡住了上午的太阳。再过一个钟头影子挪开，他就会被晒醒。',
      track:
        '他的脚印从东边来，步子越来越短、越拖越重，到这棵树下就断了——他是累得走不动了才躺下的。',
      plant: '金合欢落下的细碎小叶子，在他的帽子上积了薄薄一层。',
    },
    stateNotes: {
      sleep: '他睡得很沉，胸口一起一伏。',
      sit: '他坐起来，揉了揉眼睛，望着远处发呆。',
      drink: '他拧开水壶喝了一大口，长长地出了口气。',
      stir: '你的脚步声惊动了他，他翻了个身，帽子差点滑下来。',
      nod: '他眯着眼睛冲你点了点头，还没完全醒过来。',
    },
    lines: {
      stir: ['他含糊地嘟囔了一声，又睡了过去。'],
      nod: ['“走了一整夜……这里真安静。”', '“前面有水塘吗？我的水快喝完了。”'],
    },
  },
  {
    id: 'ranger',
    name: '巡护员',
    age: 'adult',
    at: [20, -22],
    speed: 1.05,
    notice: 7,
    look: {
      height: 1,
      skin: '#7a5236',
      hair: '#18130f',
      coat: '#5f6b48',
      pants: '#4a4f3c',
      hat: 'cap',
      accent: '#3f4a33',
      prop: 'notebook',
    },
    wear: ['binoculars'],
    routine: [
      { walk: [[34, -2]] },
      { stay: 'scan', seconds: [6, 9], face: [46, -12] },
      { walk: [[24, 24]] },
      { stay: 'note', seconds: [6, 8] },
      {
        walk: [
          [-4, 32],
          [-28, 26],
        ],
      },
      { stay: 'scan', seconds: [6, 9], face: [POND.x, POND.z] },
      {
        walk: [
          [-36, -6],
          [-26, -34],
        ],
      },
      { stay: 'scan', seconds: [5, 8], face: [-44, -42] },
      {
        walk: [
          [0, -36],
          [20, -22],
        ],
      },
      { stay: 'note', seconds: [5, 7] },
    ],
    reactions: { walk: 'greet', note: 'nod', scan: 'hush' },
    affinity: [],
    observeRange: 13,
    notes: {
      common:
        '一位穿橄榄绿制服的巡护员，帽檐压得很低，望远镜挂在胸前。她走路几乎没有声音。',
      insect: '她把裤腿扎进了靴筒，袜口还喷了驱虫水——这片草里的蜱虫可不少。',
      bird: '她的本子上画满了“正”字和小鸟的简笔画。她说每天早上都要数一遍织布鸟的巢。',
      weather:
        '她看了一眼东北方的云塔，在本子上记下时间。下午要是下雨，水塘边的脚印就会被冲掉。',
      track:
        '她专挑硬地和石头走，尽量不在泥地上留下脚印——她不想让自己的气味和痕迹打扰动物。',
      plant:
        '她顺手拔掉路边一株外来的杂草，装进袋子带走。她说这种草长得太快，会挤掉本地的草。',
    },
    stateNotes: {
      walk: '她沿着自己的巡护路线，不紧不慢地走着。',
      scan: '她举着望远镜，一动不动地看着远处。',
      note: '她低头在本子上飞快地记着什么。',
      greet: '她冲你点了点头，抬手碰了一下帽檐。',
      nod: '她头也没抬，只举了举笔算作招呼。',
      hush: '她把手指竖在嘴边，示意你别出声，又指了指望远镜对着的方向。',
    },
    lines: {
      greet: [
        '“水塘那边早上最热闹，斑马和鹤都在。”',
        '“岩丘上的蹄兔这会儿正晒太阳，慢慢走过去，别让它们看见你的影子。”',
        '“大象一家在东南坡上。母象要是张开耳朵，就别再往前走了。”',
      ],
      nod: ['她正在记录，抬手示意了一下。'],
      hush: ['她压低声音：“嘘——别惊动它们。”'],
    },
  },
  {
    id: 'mother',
    name: '打水的母亲',
    age: 'adult',
    at: [-39, 37],
    speed: 0.9,
    notice: 6,
    look: {
      height: 0.96,
      skin: '#6f4a32',
      hair: '#16110d',
      coat: '#c4553a',
      pants: '#e0b44c',
      hat: 'none',
      accent: '#2f6f7a',
    },
    wear: ['headwrap', 'skirt', 'jar'],
    labels: { carry: '顶着水罐' },
    routine: [
      {
        walk: [[-46, 30], [-53, 22], SHORE],
      },
      { stay: 'draw', seconds: [6, 9], face: [POND.x, POND.z] },
      {
        walk: [
          [-53, 22],
          [-46, 30],
          [-39, 37],
        ],
        as: 'carry',
        speed: 0.7,
      },
      { stay: 'sit', seconds: [25, 40], face: [-33, 31] },
    ],
    reactions: { walk: 'greet', sit: 'greet', carry: 'nod', draw: 'nod' },
    affinity: [],
    observeRange: 12,
    notes: {
      common:
        '一位母亲提着陶罐去水塘打水，小女儿摇摇晃晃地跟在后面。她走得不快，好让孩子跟得上。',
      insect: '罐沿上停着两只喝水的蜜蜂，她走动时也没有飞走。',
      bird: '她经过水塘时，灰冠鹤只抬头看了她一眼，又低头找吃的——它们大概早就看惯了每天来打水的人。',
      weather:
        '她说今年雨季来得晚，水塘比往年小了一圈。塘边那圈干裂的泥，就是去年的水线。',
      track:
        '从家到水塘有一条被踩得发白的小路，一大一小两串脚印，每天来回好几趟。',
      plant: '她在塘边掐了一把嫩苋菜，揣进围裙兜里，说中午拿来煮汤。',
    },
    stateNotes: {
      walk: '她提着空水罐，往水塘走去。',
      draw: '她弯下腰，把水罐慢慢沉进水里。',
      carry: '她把盛满水的陶罐顶在头上，一只手扶着，腰板挺得笔直。',
      sit: '她坐在屋前歇一会儿，看着孩子们玩。',
      greet: '她冲你笑了笑。',
      nod: '她手上不得空，只用眼神和你打了个招呼。',
    },
    lines: {
      greet: [
        '“早上好。往下走就是水塘，水还算干净。”',
        '“孩子们要是吵到你，别介意。”',
      ],
      nod: ['她扶着水罐，冲你点了点头。'],
    },
  },
  {
    id: 'toddler',
    name: '学步的小女儿',
    age: 'toddler',
    at: [-39.5, 38],
    follow: 'mother',
    gap: 0.8,
    side: 2,
    speed: 0.75,
    runSpeed: 1.4,
    distracted: 0.07,
    notice: 5,
    look: {
      height: 0.42,
      skin: '#73503a',
      hair: '#15110e',
      coat: '#e9b8c0',
      pants: '#e9b8c0',
      hat: 'none',
      accent: '#f4efe4',
    },
    reactions: { stand: 'shy', walk: 'shy', squat: 'shy' },
    affinity: [],
    observeRange: 9,
    notes: {
      common:
        '一个刚会走路的小女孩，紧紧跟着妈妈，走几步就要停下来看看地上的东西。',
      insect:
        '她蹲下来想抓一只蚂蚁，蚂蚁一拐弯钻进了草里。她愣了一下，又去找下一只。',
      bird: '一只鸟从头顶飞过，她仰着头追着看，差点一屁股坐到地上。',
      weather: '妈妈给她裹了一件小斗篷——清晨的风，对这么小的孩子来说还是凉的。',
      track:
        '她的小脚印东一个西一个，有一处还印着两个小手印——那是摔了一跤，又自己爬了起来。',
      plant: '她手里捏着一朵揉皱了的小花，大概是要送给妈妈的。',
    },
    stateNotes: {
      walk: '她迈着小步子跟在妈妈身边。',
      run: '妈妈走远了，她张着手小跑着追上去。',
      stand: '她拽着妈妈的衣角站着。',
      squat: '她蹲在地上，专心地看着什么。',
      shy: '她躲到了妈妈身后，只露出半张脸偷偷看你。',
    },
    lines: {
      shy: [
        '她把脸埋进妈妈的衣服里。',
        '她从妈妈身后探出头，又飞快地缩了回去。',
      ],
    },
  },
  {
    id: 'granny',
    name: '拾柴的奶奶',
    age: 'elder',
    at: [-48, 46],
    speed: 0.45,
    notice: 6,
    look: {
      height: 0.9,
      skin: '#7d5a40',
      hair: '#e2ddd2',
      coat: '#6a4e6e',
      pants: '#8e6f50',
      hat: 'none',
      accent: '#4d5878',
    },
    wear: ['headscarf', 'skirt', 'bundle'],
    labels: { carry: '背着柴' },
    routine: [
      {
        roam: 'gather',
        around: [-48, 46],
        radius: 6,
        seconds: [24, 32],
        speed: 0.45,
        pause: [3, 5],
      },
      { stay: 'sit', seconds: [10, 14] },
      { walk: [[-38.6, 35.4]], as: 'carry' },
      { stay: 'sit', seconds: [20, 30], face: [-37, 36.5] },
      { walk: [[-48, 46]] },
    ],
    reactions: { gather: 'greet', sit: 'greet', walk: 'nod', carry: 'nod' },
    affinity: [],
    observeRange: 12,
    notes: {
      common:
        '一位老奶奶弯着腰在树下拾枯枝，背上已经捆了一小捆。她动作很慢，却一直没停。',
      insect:
        '她捡起一根枯枝，看见底下藏着一窝白蚁，又轻轻放了回去，换了一根。',
      bird: '她指给你看树干上的一个洞：“戴胜在里面孵蛋呢，别去吵它。”她每天经过都要看一眼。',
      weather: '她说她的膝盖比天气预报还准——今早膝盖有点酸，傍晚八成要下雨。',
      track:
        '她只捡自己掉下来的枯枝，从不折活树枝。她走过的地上，只有她的脚印和拖柴留下的一道浅痕。',
      plant:
        '她认得每一种树的柴：金合欢的木头硬，烧起来火旺、烟又少，她挑得最仔细。',
    },
    stateNotes: {
      gather: '她弯下腰，一根一根地捡起枯枝。',
      walk: '她一步一步，慢慢地走。',
      carry: '她把柴捆背在身后，腰弯得更低了。',
      sit: '她坐下来歇歇脚，捶了捶膝盖。',
      greet: '她直起腰，朝你招了招手。',
      nod: '她背着柴走不快，冲你点了点头。',
    },
    lines: {
      greet: [
        '“走累了就到屋前坐坐，火上煮着茶呢。”',
        '“起这么早，是来看动物的吧？往水塘那边去，它们都在那儿喝水。”',
      ],
      nod: ['她慢慢走着，笑着冲你点了点头。'],
    },
  },
];

export const residentById = Object.fromEntries(residents.map((r) => [r.id, r]));
