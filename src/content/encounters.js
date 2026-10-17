// Same-scale encounters are deliberately short: one opening question, three
// replies, and one closing thought. Every line is original to this project.
export const sameKindEncounters = [
  {
    name: '另一株草',
    source: '原创 · 万物之间',
    start: 'opening',
    nodes: {
      opening: {
        text: '风把我们的叶子吹向同一个方向。你也听见它了吗？',
        choices: [
          {
            text: '听见了。它像有人在很远的地方呼吸。',
            next: 'wind',
          },
          {
            text: '我只听见自己的根在抓紧泥土。',
            next: 'roots',
          },
          {
            text: '风声太吵，我什么也没听清。',
            next: 'silence',
          },
        ],
      },
      wind: {
        text: '也许那就是世界在说话。我们只是碰巧站在它的句子里。',
        end: true,
      },
      roots: {
        text: '那就够了。能抓紧一寸土，也是一件很大的事。',
        end: true,
      },
      silence: {
        text: '不必听清。风本来就不是说给耳朵听的。',
        end: true,
      },
    },
  },
  {
    name: '另一个旅人',
    source: '原创 · 万物之间',
    start: 'opening',
    nodes: {
      opening: {
        text: '你也在找路吗？我已经绕这座山走了很久。',
        choices: [
          {
            text: '我还没有目的地。',
            next: 'wander',
          },
          {
            text: '我在找一条能回去的路。',
            next: 'return',
          },
          {
            text: '也许我们走的是同一条路。',
            next: 'together',
          },
        ],
      },
      wander: {
        text: '那很好。没有目的地的人，才看得见路边的石头。',
        end: true,
      },
      return: {
        text: '路会带你回去。只是回去时，你已经不是出发的那个人。',
        end: true,
      },
      together: {
        text: '那就在下一个岔口之前，一起走一段吧。',
        end: true,
      },
    },
  },
  {
    name: '另一座岛',
    source: '原创 · 万物之间',
    start: 'opening',
    nodes: {
      opening: {
        text: '海一直想把我们分开。你觉得它成功了吗？',
        choices: [
          {
            text: '你们之间还有海底的山脉。',
            next: 'ridge',
          },
          {
            text: '我听见你的浪声。',
            next: 'waves',
          },
          {
            text: '距离让我以为你是孤独的。',
            next: 'distance',
          },
        ],
      },
      ridge: {
        text: '原来你看见了。分开只是水面上的说法。',
        end: true,
      },
      waves: {
        text: '浪声走到我这里，已经变成了我的岸。',
        end: true,
      },
      distance: {
        text: '孤独是站在岸上才有的。海里的我，一直和一切连着。',
        end: true,
      },
    },
  },
  {
    name: '另一颗星球',
    source: '原创 · 万物之间',
    start: 'opening',
    nodes: {
      opening: {
        text: '你也在绕着什么旋转吗？我很久没有看见中心了。',
        choices: [
          {
            text: '我绕着光。',
            next: 'light',
          },
          {
            text: '我不知道，但我不想停下。',
            next: 'motion',
          },
          {
            text: '也许我们正在互相绕着。',
            next: 'orbit',
          },
        ],
      },
      light: {
        text: '那就好。光不会要求你靠近，却一直让你有方向。',
        end: true,
      },
      motion: {
        text: '不必知道。很多轨道，都是在转动之后才被看见的。',
        end: true,
      },
      orbit: {
        text: '那我们的遥远，就只是还没有转过半个周期。',
        end: true,
      },
    },
  },
];
