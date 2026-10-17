// 人层的动物，包括跟着牧人的家畜。文字为原创，自然知识为常见科普事实的转述，
// 尚有争议的说法写明“有研究认为”。
// temperament 由 src/core/wildlife.js 读取；notes 按人物的 focus 选取，
// 没有对应视角时使用 common。stateNotes 在动物处于该状态时追加；
// reactionNotes 替换通用的反应描述（见 src/fieldwork.js 的 REACTIONS）。
// affinity 是对这种动物最在行的视角：观察距离更远，算作专长记录。
// trackless 的动物不留可循的足迹；temperament.perch 是栖在灌木上的高度（米）。
export const species = {
  hare: {
    name: '野兔',
    affinity: ['track', 'plant'],
    kind: '哺乳动物',
    temperament: {
      reaction: 'flee',
      alertRadius: 11,
      walkSpeed: 0.8,
      fleeSpeed: 7.5,
      homeRadius: 14,
      calmAfter: 7,
      scent: true,
      herbivore: true,
      social: false,
    },
    observeRange: 10,
    notes: {
      common: '一只褐色的野兔，长耳朵不时转动，把四面八方的声音都收进来。',
      insect:
        '它耳廓边缘停着两只小蝇，野兔每抖一下耳朵，它们就换个位置再落下。',
      bird: '野兔的眼睛长在头两侧，几乎能看见身后。难怪天上的猛禽总要从高处俯冲才有机会。',
      weather:
        '它的大耳朵里布满细血管，天热时靠耳朵散热。今天它耳朵竖得笔直，看来太阳已经晒起来了。',
      track:
        '野兔不挖洞，只在草里压出一个浅窝休息。它后脚的印子落在前脚印前面——这是跳着走的证据。',
      plant: '它只啃嫩草尖，留下整齐的斜切口，老硬的草茎碰都不碰。',
    },
    stateNotes: {
      flee: '它已经弹了出去，在草里拐出一道之字形。',
      alert: '它停下来，一动不动，只有耳朵还朝着你。',
      curious: '草药的气味让它犹豫了，鼻子一抽一抽地往你这边探。',
    },
  },
  tortoise: {
    name: '豹纹陆龟',
    affinity: ['plant'],
    kind: '爬行动物',
    temperament: {
      reaction: 'withdraw',
      alertRadius: 2.2,
      walkSpeed: 0.12,
      fleeSpeed: 0,
      homeRadius: 0.8,
      calmAfter: 5,
      scent: false,
      herbivore: true,
      social: false,
    },
    observeRange: 7,
    notes: {
      common: '一只慢吞吞的陆龟，背甲上有深浅交错的斑纹，像晒过的豹皮。',
      insect: '背甲边缘的缝里藏着一只小甲虫，它把这里当作会走路的屋檐。',
      bird: '这么慢的动物，天上的鸟却很少打它的主意——那身甲壳对大多数喙来说太硬了。',
      weather: '它把四肢摊开晒着背甲。清晨的陆龟要先晒暖身体，才走得动。',
      track:
        '它身后留着两排短短的爪印，中间是一道浅浅的拖痕——那是腹甲蹭过的地方。',
      plant: '它嘴边还沾着一小截多汁的叶子。陆龟能从植物里得到大部分需要的水。',
    },
    stateNotes: {
      withdrawn:
        '它把头和四肢都缩进了甲壳，只露出一圈花纹。等你离开，它会慢慢探出来。',
    },
  },
  hedgehog: {
    name: '四趾刺猬',
    affinity: ['insect', 'track'],
    kind: '哺乳动物',
    temperament: {
      reaction: 'curl',
      alertRadius: 3,
      walkSpeed: 0.35,
      fleeSpeed: 0,
      homeRadius: 5,
      calmAfter: 6,
      scent: true,
      herbivore: false,
      social: false,
    },
    observeRange: 6,
    notes: {
      common: '一只小刺猬沿着草根嗅来嗅去，背上的刺在晨光里发白。',
      insect: '它刚从土里拱出一只甲虫，嚼得咔嚓响。刺猬一晚能吃掉很多昆虫。',
      bird: '附近的鸟对它毫不在意——刺猬只在地上找吃的，和它们抢不到一处。',
      weather:
        '天亮了它还在外面，大概是想趁露水未干多找些虫子；再热一点它就会回窝。',
      track: '它的脚印很小，后脚只有四个趾印。旁边的土被鼻子拱开了一道道浅沟。',
      plant: '它钻过的那丛草被压出一条小隧道，草叶上还挂着它掉下的几根短刺。',
    },
    stateNotes: {
      curled: '它团成了一颗带刺的栗子。刺只是变硬的毛发，等你走远，它会松开。',
    },
  },
  meerkat: {
    name: '狐獴',
    affinity: ['track'],
    kind: '哺乳动物',
    temperament: {
      reaction: 'burrow',
      alertRadius: 7,
      watchRadius: 17,
      walkSpeed: 0.7,
      fleeSpeed: 6,
      homeRadius: 5,
      calmAfter: 9,
      scent: true,
      herbivore: false,
      social: true,
    },
    observeRange: 12,
    notes: {
      common: '一小群狐獴在洞口附近刨土，总有一只站得笔直，替大家盯着四周。',
      insect: '它从土里挖出一条甲虫幼虫，三两口吞下。狐獴连蝎子都敢吃。',
      bird: '站岗的那只一直在看天。据观察，狐獴对天上的鹰和地上的胡狼会发出不同的警报声。',
      weather:
        '它们背对太阳站着，露出毛发稀薄、颜色较深的肚皮——这是在晒太阳取暖。',
      track: '洞群有好几个出口，土堆上布满新鲜的爪痕，说明它们今早刚扩建过。',
      plant: '它们的洞口选在一丛矮灌木下，根系让洞顶更结实，也能遮住一些日晒。',
    },
    stateNotes: {
      sentinel: '它直立起来，盯着你，尾巴撑在地上当作第三条腿。',
      flee: '一声尖叫，它们一齐冲回了洞里。',
    },
  },
  guineafowl: {
    name: '珠鸡',
    affinity: ['bird'],
    kind: '鸟类',
    temperament: {
      reaction: 'flee',
      alertRadius: 8,
      walkSpeed: 0.55,
      fleeSpeed: 3.4,
      homeRadius: 12,
      calmAfter: 6,
      scent: false,
      herbivore: true,
      social: true,
    },
    observeRange: 10,
    notes: {
      common: '一群深灰色的珠鸡，身上缀满白点，边走边啄，偶尔咯咯地叫几声。',
      insect: '它们在翻草根下的虫子和蜱。有珠鸡经过的草地，蜱会少很多。',
      bird: '头顶那块角质的“盔”和蓝红色的肉垂，说明这是盔珠鸡。它们宁可跑，也不太愿意飞。',
      weather:
        '它们正把羽毛蓬开晒太阳，晒干了夜里的露水。傍晚它们会飞上树过夜。',
      track:
        '地上一串三趾的爪印，几只鸡的脚印交叠成一条宽带——它们总是成群走同一条路。',
      plant: '它们刨开了地面的落叶，啄食草籽，也顺带把种子踩进了土里。',
    },
    stateNotes: {
      flee: '它们一边叫嚷一边小跑，像一群急着赶路的人。',
      alert: '整群都停了下来，伸长脖子朝你这边看。',
      curious: '草籽的味道让它们一点点凑了过来。',
    },
  },
  agama: {
    name: '彩虹鬣蜥',
    affinity: ['weather'],
    kind: '爬行动物',
    temperament: {
      reaction: 'freeze',
      alertRadius: 5,
      walkSpeed: 0.4,
      fleeSpeed: 4.5,
      homeRadius: 3,
      calmAfter: 5,
      scent: false,
      herbivore: false,
      social: false,
    },
    observeRange: 7,
    notes: {
      common:
        '一只橙色脑袋、蓝色身体的蜥蜴趴在石头边，不时上下点头，像在做俯卧撑。',
      insect: '它舌头一弹，叼走了一只路过的蚂蚁。蚂蚁是它最常吃的食物。',
      bird: '它点头时总是先瞄一眼天空。对一只蜥蜴来说，伯劳和犀鸟都很危险。',
      weather: '身体冷的时候它的颜色是灰暗的，晒暖之后才会亮出这身蓝和橙。',
      track: '石头周围的沙上有它拖着尾巴爬过的细线，两侧是小小的五趾爪印。',
      plant: '它从不吃这些草，但会躲在草丛的阴影里，等石头太烫时降温。',
    },
    stateNotes: {
      freeze: '它僵住了，只剩眼珠在转。它在赌你没看见它。',
      flee: '它“嗖”地窜进了石缝。',
    },
  },
  beetle: {
    name: '屎壳郎',
    affinity: ['insect'],
    kind: '昆虫',
    temperament: {
      reaction: 'ignore',
      alertRadius: 0,
      walkSpeed: 0.09,
      fleeSpeed: 0,
      homeRadius: 3,
      calmAfter: 0,
      scent: false,
      herbivore: false,
      social: false,
    },
    observeRange: 2.6,
    trackless: true,
    notes: {
      common: '一只黑亮的甲虫倒立着，用后腿推着一个比自己还大的粪球。',
      insect:
        '它不时爬到球顶转一圈——研究发现它们在借太阳、偏振光，甚至夜里的银河来确定直线方向。',
      bird: '珠鸡正在不远处，可它们好像对这只推球的家伙不感兴趣。',
      weather: '地面越来越热，它推得更快了。有的屎壳郎会爬到粪球上给脚降温。',
      track: '它身后留下一道细细的、笔直的压痕，几乎没有绕弯。',
      plant: '它会把粪球埋进土里。被翻动、施过肥的土，明年这里的草会长得更密。',
    },
    stateNotes: {},
  },
  butterfly: {
    name: '橙粉蝶',
    affinity: ['insect', 'plant'],
    kind: '昆虫',
    temperament: {
      reaction: 'flutter',
      alertRadius: 1.8,
      walkSpeed: 1.1,
      fleeSpeed: 2.6,
      homeRadius: 5,
      calmAfter: 3,
      scent: false,
      herbivore: false,
      social: false,
    },
    observeRange: 4,
    trackless: true,
    notes: {
      common: '一只橙色的蝴蝶在花丛间停停飞飞，翅膀开合得很慢。',
      insect: '它停在花上时，用脚“尝”了尝花瓣——蝴蝶的味觉感受器长在脚上。',
      bird: '翅膀背面的颜色像枯叶。合上翅膀时，连眼尖的鸟也容易错过它。',
      weather: '早上它会张开翅膀晒太阳，飞行肌暖和之前飞不起来。',
      track: '花瓣上留着一点被碰落的鳞粉，像极细的橙色灰尘。',
      plant:
        '它偏爱这片花里颜色最浅的几朵。这几朵的花蜜，也许正好开在它的口器够得着的深度。',
    },
    stateNotes: {
      flee: '它被惊起，在你头顶绕了一圈，落到了更远的花上。',
    },
  },
  zebra: {
    name: '斑马',
    affinity: ['track', 'plant'],
    kind: '哺乳动物',
    temperament: {
      reaction: 'flee',
      alertRadius: 13,
      watchRadius: 26,
      walkSpeed: 0.9,
      fleeSpeed: 8,
      homeRadius: 9,
      calmAfter: 8,
      scent: true,
      herbivore: true,
      social: true,
    },
    observeRange: 16,
    notes: {
      common:
        '一群斑马在低处的草地上吃草，吃几口就抬头看看四周。每一匹身上的条纹都不一样，像指纹。',
      insect:
        '研究发现，条纹会让马蝇看不准落点，落到斑马身上的蝇比落到纯色皮毛上的少得多。它甩尾巴甩得很悠闲。',
      bird: '一只红嘴牛椋鸟沿着它的脖子爬上爬下，啄食皮毛里的蜱虫。斑马由着它，连耳朵都没动一下。',
      weather:
        '斑马每天都离不开水，所以总在水塘附近活动。天越热，它们往塘边去得越勤。',
      track:
        '它的蹄印是完整的一个圆，和马的很像——斑马每只脚只有一个蹄，不像羚羊那样分成两瓣。',
      plant:
        '它啃的是又高又硬的老草茎。斑马先把粗草吃掉，后来的角马和羚羊才够得着底下的嫩草。',
    },
    stateNotes: {
      alert: '整群斑马都抬起了头，耳朵齐刷刷地朝向你。',
      flee: '它们扬起尘土跑开，条纹在奔跑中晃成一片，让人数不清到底有几匹。',
      rest: '它站着打起了盹，一条后腿微微弯起，只用蹄尖点着地。',
    },
  },
  giraffe: {
    name: '长颈鹿',
    affinity: ['plant'],
    kind: '哺乳动物',
    temperament: {
      reaction: 'flee',
      alertRadius: 10,
      watchRadius: 30,
      walkSpeed: 0.6,
      fleeSpeed: 3.2,
      homeRadius: 7,
      calmAfter: 10,
      scent: false,
      herbivore: true,
      social: false,
    },
    observeRange: 22,
    notes: {
      common: '一头长颈鹿正在够金合欢树冠上的嫩叶。它站直的时候，头比树还高。',
      insect:
        '有些金合欢的刺基部住着蚂蚁，叶子被啃时会冲出来咬。长颈鹿照吃不误，只是吃几口就换一棵树。',
      bird: '一对牛椋鸟在它脖子上啄食。长颈鹿站得高、看得远，别的动物会留意它望向哪里——它盯着的方向，常常就有危险。',
      weather:
        '它身上每一块斑纹底下都有一圈血管。有研究认为这些斑块能帮它散热，像一扇扇小窗户。',
      track:
        '它的蹄印有餐盘那么大，前蹄印比后蹄印更大。它慢走时同一侧的两条腿一起迈，叫作“溜蹄”。',
      plant:
        '它的舌头又长又灵活，能绕开尖刺卷住叶子。舌头是深紫色的，也许能防止被太阳晒伤。',
    },
    stateNotes: {
      alert: '它从高处低头看着你，嘴里还在慢慢嚼着叶子。',
      flee: '它不慌不忙地迈开长腿走开，脖子随着步子一前一后地摆。',
      forage: '它把头伸进树冠，舌头一卷，就捋下一把叶子。',
    },
  },
  elephant: {
    name: '非洲象',
    affinity: ['track', 'plant'],
    kind: '哺乳动物',
    temperament: {
      reaction: 'warn',
      alertRadius: 15,
      walkSpeed: 0.45,
      fleeSpeed: 1.3,
      homeRadius: 9,
      calmAfter: 9,
      scent: true,
      herbivore: true,
      social: false,
    },
    observeRange: 24,
    notes: {
      common:
        '一头母象带着小象在坡上吃草。小象寸步不离地跟在妈妈腿边，时不时把鼻子搭在妈妈的鼻子上。',
      insect:
        '它刚往背上扬了一鼻子土。尘土裹在皮肤上，能挡太阳，也让蚊蝇难以下口。身后那堆象粪上，已经落了好几只屎壳郎。',
      bird: '母象卷起一把草，抖掉根上的泥再送进嘴里。几只小鸟立刻落到它抖过的地方，啄食被翻出来的虫子。',
      weather:
        '它的大耳朵一扇一扇。耳背上布满血管，扇动时热量就被风带走。太阳越晒，它扇得越勤。',
      track:
        '它的脚印是一个大圆盘，脚底的皮肤纹路像干裂的泥地，每头象都不一样。前脚印圆，后脚印偏椭圆。',
      plant:
        '大象一天要吃掉一两百公斤植物，会推倒小树、剥下树皮。它们走过的地方林子变得稀疏，草原就这样被“修剪”出来。',
    },
    stateNotes: {
      warn: '她张开两只大耳朵，抬起鼻子朝着你，身形一下子大了一圈——这是在警告：别再靠近。',
      flee: '她转过身，领着小象不慌不忙地走开了，边走边回头看你。',
      rest: '小象钻到妈妈肚子底下的阴影里，母象站着一动不动，只有尾巴在甩。',
    },
  },
  warthog: {
    name: '疣猪',
    affinity: ['track'],
    kind: '哺乳动物',
    temperament: {
      reaction: 'flee',
      alertRadius: 9,
      walkSpeed: 0.5,
      fleeSpeed: 5.5,
      homeRadius: 7,
      calmAfter: 7,
      scent: true,
      herbivore: true,
      social: true,
    },
    observeRange: 12,
    notes: {
      common:
        '一家疣猪在草地上埋头吃草，大的两只脸上长着鼓起的“疣”，两只小猪跟在后面。',
      insect:
        '它身上糊着一层干泥。在泥坑里打滚既能防晒，也能闷死皮肤上的寄生虫。',
      bird: '它干脆躺了下来，几只小鸟跳到它身上啄食蜱虫，它就一动不动地任它们啄。',
      weather:
        '疣猪几乎不会出汗，天一热就去泥坑打滚降温。它们早晚出来吃草，正午躲进洞里。',
      track:
        '它常钻进土豚挖剩的旧洞过夜，而且总是倒退着进去，好让獠牙对着洞口。',
      plant:
        '它用鼻子拱出草根和地下茎来吃。被它拱过的地面，像被小锄头翻过一遍。',
    },
    stateNotes: {
      forage: '它跪着两条前腿啃草，膝盖上磨出了厚厚的茧。',
      alert: '它停下来，抬起长着獠牙的脸，鼻子一抽一抽。',
      flee: '它们竖起细细的尾巴一路小跑，像几根移动的天线。',
    },
  },
  ostrich: {
    name: '鸵鸟',
    affinity: ['bird'],
    kind: '鸟类',
    temperament: {
      reaction: 'flee',
      alertRadius: 14,
      watchRadius: 28,
      walkSpeed: 0.8,
      fleeSpeed: 9.5,
      homeRadius: 10,
      calmAfter: 9,
      scent: false,
      herbivore: true,
      social: true,
    },
    observeRange: 18,
    notes: {
      common:
        '两只鸵鸟在坡上踱步。黑白羽毛的是雄鸟，灰褐色的是雌鸟，站直了比人还高。',
      insect: '它低头在草里啄来啄去，蚱蜢、甲虫和草籽都吃。',
      bird: '鸵鸟是现存最大的鸟，飞不起来，却跑得极快。它的眼睛比它的脑子还大。',
      weather:
        '天热时它会张开翅膀，露出腿根光秃秃的皮肤散热；天冷时又用翅膀把腿盖住。',
      track:
        '它的脚印只有两个脚趾：一个又粗又长，一个小小地偏在外侧。鸵鸟是唯一只有两个脚趾的鸟。',
      plant: '它没有牙齿，会吞下小石子存在砂囊里，帮着磨碎吃下去的植物。',
    },
    stateNotes: {
      alert: '它把长脖子伸得笔直，一双大眼睛盯着你。',
      flee: '它甩开两条长腿跑起来，几步就到了远处，翅膀半张着保持平衡。',
    },
  },
  crane: {
    name: '灰冠鹤',
    affinity: ['bird'],
    kind: '鸟类',
    temperament: {
      reaction: 'flee',
      alertRadius: 8,
      watchRadius: 15,
      walkSpeed: 0.4,
      fleeSpeed: 2.4,
      homeRadius: 4,
      calmAfter: 7,
      scent: false,
      herbivore: false,
      social: true,
    },
    observeRange: 13,
    notes: {
      common: '一对灰冠鹤在水塘边踱步，头顶的金色羽冠像一把散开的稻草。',
      insect: '它边走边用脚跺地，把藏在草里的虫子惊出来，再一口啄住。',
      bird: '灰冠鹤是少数能栖在树上的鹤。它的后趾特别长，能抓住树枝。',
      weather: '它们离不开湿地。雨季一来，鹤就开始成对跳舞、在水边筑巢。',
      track:
        '泥地上的脚印是三个长长的前趾，后面还有一个小点——那是它能抓握的后趾。',
      plant: '它会用嘴把草籽从穗上捋下来吃，也啄水边嫩草的尖。',
    },
    stateNotes: {
      rest: '两只鹤面对面跳起舞来：鞠躬、张开翅膀、跳起来，又轻轻落下。',
      alert: '它们停下脚步，伸长脖子看着你。',
      flee: '它们张开翅膀，一路小跑着拉开了距离。',
    },
  },
  egret: {
    name: '牛背鹭',
    affinity: ['bird', 'insect'],
    kind: '鸟类',
    temperament: {
      reaction: 'fly',
      alertRadius: 6,
      walkSpeed: 0.5,
      fleeSpeed: 3.5,
      homeRadius: 5,
      calmAfter: 4,
      scent: false,
      herbivore: false,
      social: true,
    },
    observeRange: 11,
    notes: {
      common: '几只白色的小鹭跟在羊群旁边，头和背上有几缕橙黄色的饰羽。',
      insect:
        '羊蹄每踩一步，草里就蹦出几只蚱蜢，它一伸脖子就叼走了——跟着吃草的动物捉虫，省力得多。',
      bird: '牛背鹭原本生活在非洲和南亚，后来自己飞越大洋，在美洲也安了家。',
      weather: '草原起火的时候，牛背鹭会聚到火线边上，捉被烟熏出来的虫子。',
      track: '泥地上的鸟爪印细细的，三趾朝前、一趾朝后，紧挨着羊蹄印走。',
      plant: '它不吃草，却离不开草地：草越高，藏在里面的虫子越多。',
    },
    stateNotes: {
      forage: '它歪着头盯着地面，脖子一缩一伸。',
      flee: '它扑扇着翅膀飞起来，在羊群另一边落下。',
    },
  },
  weaver: {
    name: '织布鸟',
    affinity: ['bird'],
    kind: '鸟类',
    temperament: {
      reaction: 'fly',
      alertRadius: 5,
      walkSpeed: 0.6,
      fleeSpeed: 4,
      homeRadius: 3.2,
      calmAfter: 5,
      scent: false,
      herbivore: false,
      social: true,
    },
    observeRange: 8,
    notes: {
      common:
        '一群黄色的小鸟在挂满巢的树下跳来跳去，雄鸟脸上有一块黑色的“面罩”。',
      insect: '它们平时多吃草籽，喂雏鸟的时候也捉虫子。',
      bird: '雄鸟用草叶一圈圈地编巢，打结、穿梭；编好了就挂在巢下扑扇翅膀，请雌鸟来看。雌鸟不满意，它就拆了重编。',
      weather:
        '巢都挂在细枝的最末端，入口朝下，蛇不容易爬进去，雨水也灌不进来。',
      track: '树下的土上落满了碎草屑和鸟粪，还有一串串细小的爪印。',
      plant: '它们用嘴把新鲜的草叶撕成长条，趁着柔软来编织。',
    },
    stateNotes: {
      forage: '它在地上蹦了两下，啄起一粒草籽。',
      flee: '一群织布鸟呼地飞起，叽叽喳喳地钻进了树冠。',
    },
  },
  hyrax: {
    name: '岩蹄兔',
    affinity: ['weather'],
    kind: '哺乳动物',
    temperament: {
      reaction: 'burrow',
      alertRadius: 6,
      watchRadius: 13,
      walkSpeed: 0.35,
      fleeSpeed: 4,
      homeRadius: 2.4,
      calmAfter: 8,
      scent: false,
      herbivore: true,
      social: true,
    },
    observeRange: 11,
    notes: {
      common: '几只岩蹄兔趴在岩石上晒太阳，圆滚滚的，像一块块褐色的面包。',
      insect:
        '有一只在不停地挠痒——蹄兔后脚的内趾上长着一个专门用来梳毛的长爪。',
      bird: '岩丘上空要是出现黑鹰的影子，站岗的蹄兔会马上尖叫报警——黑鹰最爱捉的就是蹄兔。',
      weather:
        '它们调节体温的本事不太好，早上要先挤在一起晒太阳，把身子晒暖了才开始活动。',
      track:
        '岩石上有一道道白色的痕迹，那是蹄兔世世代代在同一个地方排泄留下的结晶。',
      plant:
        '它们吃草，也啃岩缝里灌木的叶子。说来奇怪，这种小东西现存最近的亲戚是大象和海牛。',
    },
    stateNotes: {
      rest: '它们挤成一团晒太阳，眼睛半眯着。',
      sentinel: '一只蹄兔蹲在最高的石头上，警惕地望着你。',
      flee: '一声尖叫，蹄兔们全都钻进了石缝。',
    },
  },
  chameleon: {
    name: '变色龙',
    affinity: ['weather', 'insect'],
    kind: '爬行动物',
    temperament: {
      reaction: 'freeze',
      alertRadius: 3,
      walkSpeed: 0.02,
      fleeSpeed: 0.08,
      homeRadius: 0.25,
      calmAfter: 6,
      scent: false,
      herbivore: false,
      social: false,
      perch: 1.02,
    },
    observeRange: 4,
    trackless: true,
    notes: {
      common: '灌木枝上趴着一只绿色的变色龙，尾巴卷成一个小圈，一动不动。',
      insect: '它的舌头能在眨眼间弹出比身体还长的距离，舌尖黏住虫子再卷回来。',
      bird: '它的两只眼睛可以各转各的：一只盯着前面的虫子，一只留意天上的鸟。',
      weather: '清晨它的颜色偏深，好多吸一点阳光；等身子暖和了，又会慢慢变浅。',
      track:
        '它在枝上走路一步三晃，前后摇摆，好让自己看起来像一片被风吹动的叶子。',
      plant:
        '它挑的这丛灌木和它几乎一个颜色。不过变色龙变色更多是为了表达情绪和调节体温，不只是为了躲藏。',
    },
    stateNotes: {
      freeze: '它僵住了，身体却开始轻轻前后摇晃，像被风吹动的叶子。',
      flee: '它慢吞吞地绕到树枝的另一边，只露出一只转动的眼睛。',
    },
    reactionNotes: {
      display:
        '它慢慢转过身，把身体侧着鼓起来，颜色一下子暗了——这是在吓唬你：它比看上去更大。',
    },
  },
  frog: {
    name: '河蛙',
    affinity: ['weather'],
    kind: '两栖动物',
    temperament: {
      reaction: 'burrow',
      alertRadius: 3.5,
      watchRadius: 5,
      walkSpeed: 0.3,
      fleeSpeed: 2.2,
      homeRadius: 1.2,
      calmAfter: 7,
      scent: false,
      herbivore: false,
      social: false,
    },
    observeRange: 5,
    notes: {
      common: '水塘边蹲着一只褐绿色的青蛙，喉咙一鼓一鼓的。',
      insect:
        '它吞虫子的时候眨了一下眼——青蛙会把眼球往下压，帮着把食物推进喉咙。',
      bird: '它总蹲在离水一跳远的地方。鹤和鹭都爱吃蛙，一有动静，它就先跳进水里再说。',
      weather:
        '青蛙的皮肤得保持湿润，它还能通过皮肤吸水和呼吸。太阳越晒，它越往水边靠。',
      track: '泥地上有它的爪印：前脚四个趾，后脚五个长长的趾，中间连着蹼。',
      plant: '塘边的莎草丛是它的藏身处，它的蝌蚪则在水里啃食藻类。',
    },
    stateNotes: {
      flee: '“扑通”一声，它跳进了水里。',
    },
    reactionNotes: {
      sentinel: '它蹲在原地，喉咙一鼓一鼓的，金色的眼睛一眨不眨地看着你。',
    },
  },
  jackal: {
    name: '黑背胡狼',
    affinity: ['track'],
    kind: '哺乳动物',
    temperament: {
      reaction: 'flee',
      alertRadius: 14,
      watchRadius: 30,
      walkSpeed: 0.9,
      fleeSpeed: 6,
      homeRadius: 10,
      calmAfter: 6,
      scent: true,
      herbivore: false,
      social: true,
    },
    observeRange: 16,
    notes: {
      common: '一对黑背胡狼在远处小跑，背上一块银黑色的“鞍”，耳朵又大又尖。',
      insect: '它在草里一扑一扑的，是在捉蚱蜢。胡狼什么都吃，虫子也不放过。',
      bird: '它们跑一阵就抬头看看天——秃鹫往哪儿聚，哪儿多半就有能吃的东西。',
      weather:
        '胡狼多在清晨和黄昏活动。天一热，它们就找块阴凉趴下，等太阳偏西。',
      track:
        '它的脚印像小狗的：四个趾印带着爪痕，前脚印比后脚印大。一对胡狼的脚印总是并排着走。',
      plant:
        '它们也吃野果。吞下去的种子被带到很远的地方再排出来，就在那里发芽。',
    },
    stateNotes: {
      alert: '它停下来回头看你，一只前脚还悬在半空。',
      flee: '它们一溜小跑拉开距离，跑远了又回头张望。',
      rest: '两只胡狼挨着趴在一起，互相舔着脖子上的毛。',
    },
  },
  dikdik: {
    name: '犬羚',
    affinity: ['plant'],
    kind: '哺乳动物',
    temperament: {
      reaction: 'freeze',
      alertRadius: 7,
      walkSpeed: 0.4,
      fleeSpeed: 6,
      homeRadius: 4,
      calmAfter: 6,
      scent: true,
      herbivore: true,
      social: false,
    },
    observeRange: 9,
    notes: {
      common: '灌木边站着一对小小的羚羊，还没有膝盖高，大眼睛周围有一圈白。',
      insect:
        '它的眼角下方有一块深色的腺体，它把这里的气味抹在草茎上，告诉别的犬羚：这是我们的地方。',
      bird: '附近的鸟一叫警报，它就竖起耳朵——犬羚会听别的动物发出的警报声。',
      weather:
        '犬羚几乎不用喝水，嫩叶里的水分就够了。天热时，它就躲进灌木的阴影里。',
      track:
        '它的蹄印只有指甲盖大，尖尖的两瓣。领地边上有一小堆粪粒——犬羚总回到同一个地方排便，当作界碑。',
      plant: '它挑着吃灌木的嫩叶、花和果子，用细长的嘴一片一片地捏下来。',
    },
    stateNotes: {
      freeze: '它一动不动地站着，只有一对大耳朵在转。',
      flee: '它一蹦一跳地钻进了灌木丛，边跑边发出尖细的叫声。',
    },
    reactionNotes: {
      display:
        '它用后腿跺了跺地，发出一声尖细的“滋克——滋克”。犬羚的名字，据说就来自这种叫声。',
    },
  },
  goat: {
    name: '山羊',
    affinity: ['plant', 'track'],
    kind: '哺乳动物',
    temperament: {
      reaction: 'tame',
      alertRadius: 8,
      curiosity: 0.15,
      bold: false,
      walkSpeed: 0.55,
      fleeSpeed: 0,
      homeRadius: 4,
      calmAfter: 4,
      scent: false,
      herbivore: true,
      social: false,
    },
    observeRange: 9,
    notes: {
      common:
        '几只山羊跟着老伯，有白的、有棕的，还有一只黑脸的小羊总落在后面。',
      insect: '它不时甩甩耳朵、抖抖皮毛，把围着它飞的小蝇赶开。',
      bird: '一只牛背鹭干脆跳到了它背上，站在那儿东张西望，山羊也懒得理它。',
      weather: '山羊很耐旱，能从带着露水的嫩叶里得到不少水分。',
      track: '它的蹄印分成两瓣，尖尖的，一串挨着一串，跟在老伯的脚印后面。',
      plant: '山羊不光吃草，还爱啃灌木的叶子和嫩枝，连带刺的金合欢也不放过。',
    },
    stateNotes: {
      forage: '它踮起后腿，去够灌木高处的叶子。',
      curious: '它抬头盯着你，下巴上的胡子一抖一抖。',
    },
    reactionNotes: {
      curious:
        '它凑过来，用湿漉漉的鼻子碰了碰你的手——确认里面没有吃的，又低头啃草去了。',
    },
  },
  dog: {
    name: '牧羊犬',
    affinity: ['track'],
    kind: '哺乳动物',
    temperament: {
      reaction: 'tame',
      alertRadius: 12,
      curiosity: 0.6,
      bold: true,
      walkSpeed: 1,
      fleeSpeed: 0,
      homeRadius: 3,
      calmAfter: 4,
      scent: true,
      herbivore: false,
      social: false,
    },
    observeRange: 12,
    notes: {
      common:
        '一条黄褐色的牧羊犬跟在羊群边上，耳朵竖着，时不时跑到掉队的羊后面。',
      insect:
        '它扭头咬了咬自己的后腿，又在地上蹭了蹭，大概是被草里的蜱虫叮了。',
      bird: '一只牛背鹭在它身边落下，它只看了一眼，又转回去盯着羊。',
      weather:
        '它张着嘴喘气，舌头耷拉在外面——狗只有脚垫上有少量汗腺，主要靠喘气散热。',
      track:
        '它的脚印是四个趾加一个大肉垫，趾尖前面还有爪痕——猫走路会收起爪子，狗不会。',
      plant:
        '它在一丛草边嗅了很久，又抬腿留了个记号：那里有别的狗的气味，它要“回个信”。',
    },
    stateNotes: {
      rest: '它趴在地上，下巴搁在前爪上，眼睛却还睁着。',
      curious: '它冲你摇着尾巴，鼻子一刻不停地抽动。',
    },
    reactionNotes: {
      curious: '它摇着尾巴小跑过来，绕着你闻了一圈，最后用脑袋蹭了蹭你的腿。',
    },
  },
};

// 栖息地决定动物的数量与家园位置（场景坐标，米）。
export const habitats = [
  { species: 'tortoise', count: 1, center: [-1.2, -5.6], radius: 0.3 },
  { species: 'tortoise', count: 1, center: [18, 22], radius: 2 },
  { species: 'hare', count: 4, center: [22, 6], radius: 12 },
  { species: 'guineafowl', count: 6, center: [-24, -6], radius: 6 },
  { species: 'meerkat', count: 4, center: [-18, 16], radius: 2 },
  { species: 'hedgehog', count: 1, center: [6, 18], radius: 3 },
  { species: 'hedgehog', count: 1, center: [-30, -32], radius: 3 },
  { species: 'agama', count: 2, center: [10, -9.8], radius: 1 },
  { species: 'beetle', count: 1, center: [4, -9], radius: 1 },
  { species: 'beetle', count: 1, center: [-9, 2], radius: 1 },
  { species: 'beetle', count: 1, center: [16, -3], radius: 1 },
  { species: 'butterfly', count: 5, center: [-7, 7], radius: 3 },
  // 水塘与西边的低地。
  { species: 'zebra', count: 6, center: [-50, 4], radius: 6 },
  { species: 'crane', count: 2, center: [-61.5, 21.5], radius: 1.5 },
  { species: 'frog', count: 1, center: [-59, 15], radius: 0.3 },
  { species: 'frog', count: 1, center: [-65.5, 22.4], radius: 0.3 },
  { species: 'frog', count: 1, center: [-72.6, 12.6], radius: 0.3 },
  // 跟着放羊老伯的羊、狗和牛背鹭；follow 指向一位居民或另一处栖息地的 id。
  {
    species: 'goat',
    count: 5,
    center: [-33, 43],
    radius: 2.5,
    follow: 'herder',
  },
  {
    species: 'dog',
    count: 1,
    center: [-28.8, 42.8],
    radius: 0.5,
    follow: 'herder',
  },
  {
    species: 'egret',
    count: 3,
    center: [-31, 44],
    radius: 2,
    follow: 'herder',
  },
  // 东边的坡地与北边的树林。scale 是个体大小（幼崽）。
  {
    id: 'matriarch',
    species: 'elephant',
    count: 1,
    center: [38, 42],
    radius: 1,
  },
  {
    species: 'elephant',
    count: 1,
    center: [40, 44],
    radius: 1,
    scale: 0.45,
    follow: 'matriarch',
  },
  { species: 'giraffe', count: 2, center: [-44, -42], radius: 4 },
  { id: 'sounder', species: 'warthog', count: 2, center: [30, -30], radius: 2 },
  {
    species: 'warthog',
    count: 2,
    center: [31, -31],
    radius: 1.5,
    scale: 0.55,
    follow: 'sounder',
  },
  { species: 'ostrich', count: 2, center: [46, 16], radius: 4 },
  { species: 'hyrax', count: 5, center: [46, -12], radius: 1.8 },
  { species: 'weaver', count: 8, center: [-26, -20], radius: 2.5 },
  { species: 'chameleon', count: 1, center: [-9, -19], radius: 0 },
  { species: 'jackal', count: 2, center: [36, -48], radius: 3 },
  { species: 'dikdik', count: 2, center: [20, -45], radius: 1.5 },
];
