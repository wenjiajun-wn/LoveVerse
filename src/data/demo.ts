export const couple = { names: '小宇 & 星星', start: '2024-05-20' };
export type Memory = {
  id: string;
  title: string;
  date: string;
  category: string;
  place: string;
  story: string;
  image: string;
  color: string;
};
export const memories: Memory[] = [
  {
    id: 'meet',
    title: '故事开始的地方',
    date: '2024-05-20',
    category: '第一次相遇',
    place: '街角 · 咖啡馆',
    story:
      '那天下了一点小雨，你坐在窗边，手里的咖啡还冒着热气。原来一个再普通不过的下午，也可以成为一切的开始。',
    image: '/demo/cafe.jpg',
    color: 'rose',
  },
  {
    id: 'date',
    title: '把日落分给你一半',
    date: '2024-06-01',
    category: '第一次约会',
    place: '城市 · 天台',
    story: '我们从下午聊到日落，谁也没看时间。你说晚霞像橘子汽水，我想，那就把所有夏天都留给你。',
    image: '/demo/sunset.jpg',
    color: 'peach',
  },
  {
    id: 'trip',
    title: '和你一起，去看海',
    date: '2024-08-17',
    category: '第一次旅行',
    place: '海边 · 蓝色海岸',
    story:
      '海风把头发吹得乱七八糟，我们沿着海岸走了很远。没有特别的目的地，只要身边是你，哪里都是想去的地方。',
    image: '/demo/sea.png',
    color: 'blue',
  },
  {
    id: 'winter',
    title: '冬天也有暖色',
    date: '2024-12-24',
    category: '日常碎片',
    place: '家里 · 窗边',
    story:
      '一起煮了热可可，把小灯一颗颗挂起来。窗外很冷，房间里却是我们喜欢的温度。幸福好像就是这些小事。',
    image: '/demo/winter.jpg',
    color: 'mint',
  },
  {
    id: 'year',
    title: '第一圈，围绕着你',
    date: '2025-05-20',
    category: '重要纪念日',
    place: '公园 · 花园',
    story:
      '一年过去了，我们又拍了一张合照。还有好多没去过的地方，好多没说完的话。下一圈，也请和我一起。',
    image: '/demo/garden.jpg',
    color: 'violet',
  },
  {
    id: 'night',
    title: '今晚的月亮很好看',
    date: '2025-09-06',
    category: '日常碎片',
    place: '山顶 · 观星台',
    story:
      '我们试着找出星座，却总是认错。最后决定给它们起自己的名字。这一片小小的星空，从此有了我们的坐标。',
    image: '/demo/night.jpg',
    color: 'gold',
  },
];
export const preferenceQuestions = [
  {
    text: '如果明天放假，我们去哪里？',
    options: ['去海边看日落', '在家看电影', '山间散步', '探索新餐厅'],
  },
  {
    text: '最喜欢怎样被表达爱？',
    options: ['一个拥抱', '认真听我说话', '一起度过的时间', '一份小惊喜'],
  },
  { text: '我们的旅行必带物品是？', options: ['相机', '零食', '歌单', '彼此就够了'] },
];
export const memoryQuestions = [
  { text: '我们的故事从哪里开始？', options: ['街角咖啡馆', '学校图书馆', '海边'], answer: 0 },
  { text: '第一次旅行，我们去了哪里？', options: ['山里', '海边', '古镇'], answer: 1 },
  { text: '我们的纪念日是哪一天？', options: ['6 月 1 日', '8 月 17 日', '5 月 20 日'], answer: 2 },
];
export const surprises = [
  '一起去看一次日出，把第一缕阳光收藏起来。',
  '给对方写一封手写信，下一次约会时交换。',
  '今晚由你点电影，对方准备最爱的零食。',
  '放下手机，给彼此一个持续 20 秒的拥抱。',
  '一起做一道从没尝试过的菜，失败也算共同作品。',
];
