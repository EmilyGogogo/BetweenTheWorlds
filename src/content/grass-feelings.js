// What grass feels, grouped by the sensation that prompts it. Every line is
// [text, source]. Placeholders: {temp} 气温, {mm} 已长高的毫米数, {cm} 当前高度.
const ORIGINAL = '原创 · 万物之间';

export const feelingTopics = {
  sun: [
    ['阳光落在叶尖上，是暖的。我没有手，却好像被谁轻轻握住了。', ORIGINAL],
    ['太阳离我很远很远，可它的温度，每天都准时到达。', ORIGINAL],
    ['我向着光长，不是因为光在召唤我，是因为我本来就是这样。', ORIGINAL],
    ['光照在我身上，也照在远处的山上。我们得到的，是同一份。', ORIGINAL],
    ['此刻是 {temp} 度。我不懂“度”，只觉得叶脉在一点点舒展。', ORIGINAL],
  ],
  shade: [
    ['一朵云经过，世界暗了一下。我不着急，云总会走的。', ORIGINAL],
    ['阴影不是光的缺席，只是光去别处停留了一会儿。', ORIGINAL],
    ['云遮住太阳的时候，我才发现，原来我一直在等它。', ORIGINAL],
  ],
  wind: [
    [
      '风推了我一下。我弯下去，又站回来。这不是认输，是我和风说话的方式。',
      ORIGINAL,
    ],
    ['风从很远的地方来，它不认识我，却带着整片原野的消息。', ORIGINAL],
    ['我扎根不动，风四处游荡。也许我们羡慕的，是同一种自由。', ORIGINAL],
    ['所有叶子都在动。原来被风吹过，也是一种被记得。', ORIGINAL],
  ],
  rain: [
    ['下雨了。每一滴落下来，都像在问：你还在吗？我在。', ORIGINAL],
    ['雨打在叶子上，有一点疼，也有一点像回家。', ORIGINAL],
    ['天空把自己一点点交给大地，而我正好站在中间。', ORIGINAL],
    ['雨声这么大，原野却这么安静。', ORIGINAL],
  ],
  roots: [
    ['根在泥土里喝水，凉凉的，像在很深的地方戏水。', ORIGINAL],
    ['我看不见自己的根，可此刻，我感觉它们在黑暗里笑。', ORIGINAL],
    ['地下还有一个世界。我的另一半，一直住在那里。', ORIGINAL],
    ['雨停了，水还在往下走。我的根追着它，一寸，一寸。', ORIGINAL],
    ['泥土变软了。我的根，伸了一个很长的懒腰。', ORIGINAL],
  ],
  photosynthesis: [
    ['我把阳光、水和空气，慢慢做成了自己。每天都在做，从不觉得累。', ORIGINAL],
    ['叶子里有一间很小的厨房，灶火是太阳点着的。', ORIGINAL],
    [
      '我吸进你呼出的，再呼出你需要的。我们一直在交换，只是你没注意。',
      ORIGINAL,
    ],
    ['心情变好了。也许，光合作用就是草的快乐。', ORIGINAL],
    ['什么也不做，只是站着晒太阳——这已经是我能做的最好的事。', ORIGINAL],
  ],
  growth: [
    ['我比刚来时高了 {mm} 毫米。没有人看见，但我知道。', ORIGINAL],
    ['长大很慢，慢到连我自己，都要停下来才感觉得到。', ORIGINAL],
    ['我不是在变成别的什么，只是在变成更多的自己。', ORIGINAL],
    ['今天的我，是昨天的我，加上一点点阳光。现在是 {cm} 厘米。', ORIGINAL],
  ],
  thirst: [
    ['土有点干了。我把叶子收紧一点，学着等待。', ORIGINAL],
    ['渴的时候，我会想起上一场雨。回忆，也能解一点点渴。', ORIGINAL],
  ],
  being: [
    ['你们叫我“小草”。可对一只蚂蚁来说，我是一整片森林。', ORIGINAL],
    ['我一生都站在同一个地方，却见过无数个不一样的早晨。', ORIGINAL],
    [
      '没有人想拿我做什么。这份无用，让我安安稳稳长到了今天。',
      '受《庄子·人间世》“无用之用”启发 · 原创改写',
    ],
    [
      '被踩过的地方，我还会长回来。不是因为倔强，只是因为季节还没有结束。',
      ORIGINAL,
    ],
    ['世界上有那么多草，却没有一株和我一模一样。', ORIGINAL],
    [
      '此刻的叶子，已经不是昨天的叶子。我也不必是。',
      '受《沉思录》关于变化的思考启发 · 原创改写',
    ],
    ['一只蚂蚁从我脚下经过。它的路，比我的一生还要长。', ORIGINAL],
  ],
  companions: [
    ['有同伴在身边，风好像就没那么大了。', ORIGINAL],
    ['我们的根，也许早就在地下碰到了，只是谁都没有说。', ORIGINAL],
    ['跟着你走，我才知道原来原野这么大。', ORIGINAL],
  ],
};

// Spoken once when the weather turns, so the change is felt rather than told.
export const weatherArrivals = {
  sunny: [['云散了。光又回来了，像什么也没有发生过。', ORIGINAL]],
  cloudy: [['光一下子变轻了。有一片云，正从我头顶慢慢走过。', ORIGINAL]],
  breeze: [['起风了。整片原野，都在同一个方向上弯下腰。', ORIGINAL]],
  rain: [['第一滴雨落在我的叶子上。凉的，圆的，很小心。', ORIGINAL]],
  'after-rain': [['雨停了。每一片叶子上，都挂着一个小小的天空。', ORIGINAL]],
};

// Species the player can meet and invite. `form` selects the shape built in
// the grass layer; `lines` are that plant's own voice.
export const grassSpecies = [
  {
    id: 'poa',
    name: '早熟禾',
    form: 'tuft',
    lines: [
      ['我是这片原野上最普通的一株。普通，也是一种很大的自由。', ORIGINAL],
      ['春天我总是第一个醒。不是赶时间，是太想看看光。', ORIGINAL],
    ],
  },
  {
    id: 'foxtail',
    name: '狗尾草',
    form: 'foxtail',
    lines: [
      ['我的穗子总低着头。不是害羞，是太饱满了。', ORIGINAL],
      ['孩子们喜欢摘我去逗猫。我不介意，那也是一种被需要。', ORIGINAL],
    ],
  },
  {
    id: 'clover',
    name: '三叶草',
    form: 'clover',
    lines: [
      ['大家都在找四片叶子的我。可三片叶子，也已经很完整了。', ORIGINAL],
      ['我把空气里的氮悄悄还给泥土。没有谁道谢，土会记得。', ORIGINAL],
    ],
  },
  {
    id: 'dandelion',
    name: '蒲公英',
    form: 'dandelion',
    lines: [
      ['我准备好了。等风一来，我就把自己分成一百个远方。', ORIGINAL],
      ['离开不是失去，是换一种方式活着。', ORIGINAL],
    ],
  },
  {
    id: 'plantain',
    name: '车前草',
    form: 'plantain',
    lines: [
      ['我总长在路边。被踩得多了，就学会了把叶子贴着地面。', ORIGINAL],
      ['路是人走出来的，我是在路上长出来的。', ORIGINAL],
    ],
  },
  {
    id: 'bermuda',
    name: '狗牙根',
    form: 'tuft',
    lines: [
      ['我的茎在地面下走得很远。你看见的我，只是我的一小部分。', ORIGINAL],
      ['我从不急着长高，我更想长宽一点，把更多泥土抱在怀里。', ORIGINAL],
    ],
  },
  {
    id: 'crabgrass',
    name: '马唐',
    form: 'tuft',
    lines: [
      ['夏天最热的时候，我长得最快。热，对我来说是一种邀请。', ORIGINAL],
      ['人们总想把我拔掉。可我只是，比别人更想活着。', ORIGINAL],
    ],
  },
  {
    id: 'goosegrass',
    name: '牛筋草',
    form: 'tuft',
    lines: [
      ['人们说我很难拔。其实我只是很认真地，抓住了这片土。', ORIGINAL],
      ['我不高，也不好看。可每一场雨后，我都在。', ORIGINAL],
    ],
  },
];
