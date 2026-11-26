import gameService from '../../services/gameService';

/** 游戏目录：_id 即 backend/games 下的目录名 */
export const LOCAL_GAMES = [
  {
    _id: 'snake',
    itemName: '贪吃蛇',
    description: '经典的贪吃蛇游戏，通过方向键控制蛇的移动，吃到食物后会变长',
    image: gameService.coverUrl('snake')
  },
  {
    _id: 'memory',
    itemName: '坦克大战',
    description: '经典的坦克大战游戏，驾驶坦克保卫基地，消灭所有敌方坦克',
    image: gameService.coverUrl('memory')
  },
  {
    _id: 'dino',
    itemName: 'Chrome小恐龙',
    description: '模拟Chrome浏览器离线时的跳跃游戏，按空格键或上箭头跳跃躲避障碍物',
    image: gameService.coverUrl('dino')
  },
  {
    _id: '2048',
    itemName: '2048',
    description: '经典的2048数字合成游戏，使用方向键或WASD移动数字方块，相同数字合并为它们的和',
    image: gameService.coverUrl('2048')
  },
  {
    _id: 'sudoku',
    itemName: '数独',
    description: '经典的逻辑益智游戏，在9x9的网格中填入数字1-9，使每行、每列和每个3x3宫格内的数字都不重复',
    image: gameService.coverUrl('sudoku')
  },
  {
    _id: 'tetris',
    itemName: '俄罗斯方块',
    description: '经典的方块消除游戏，移动和旋转下落的方块，填满一行即可消除得分',
    image: gameService.coverUrl('tetris')
  },
  {
    _id: 'sokoban',
    itemName: '推箱子',
    description: '经典的解谜游戏，玩家需要将所有箱子推到指定位置，考验空间思维能力',
    image: gameService.coverUrl('sokoban')
  },
  {
    _id: 'ztype',
    itemName: '太空打字',
    description: '通过键盘打字消灭来袭的单词，提高打字速度和准确性的射击类游戏',
    image: gameService.coverUrl('ztype')
  },
  {
    _id: 'pixelartmaker',
    itemName: '像素画',
    description: '一个简单的像素画制作工具，可以创建和编辑像素艺术作品',
    image: gameService.coverUrl('pixelartmaker')
  },
  {
    _id: 'breakout',
    itemName: '打砖块',
    description: '经典街机游戏，使用挡板反弹小球消除所有砖块，共5个关卡，关卡越高难度越大',
    image: gameService.coverUrl('breakout')
  },
  {
    _id: 'minesweeper',
    itemName: '扫雷',
    description: '经典逻辑游戏，根据数字推断雷的位置并标记，避开所有地雷。支持快速翻开（双击数字）与最快纪录',
    image: gameService.coverUrl('minesweeper')
  },
  {
    _id: 'gomoku',
    itemName: '五子棋',
    description: '经典的两人对弈棋类游戏，黑白双方轮流落子，先连成五子者获胜。支持人机和双人对战',
    image: gameService.coverUrl('gomoku')
  },
  {
    _id: 'klotski',
    itemName: '华容道',
    description: '中国传统益智游戏，移动方块让曹操从出口逃出。含横刀立马等5个经典布局，卡住时可以看提示',
    image: gameService.coverUrl('klotski')
  },
  {
    _id: 'binary',
    itemName: '二进制挑战',
    description: '翻动二进制位卡片凑出目标数，或把二进制读成十进制。级别越高位数越多、时间越短',
    image: gameService.coverUrl('binary')
  },
  {
    _id: 'linkup',
    itemName: '连连看',
    description: '找出相同的图案，用不超过两次拐弯的线连起来消除。共3关，有提示和重排',
    image: gameService.coverUrl('linkup')
  },
  {
    _id: 'robot',
    itemName: '机器人编程',
    description: '用前进、转向、点灯等指令给机器人编程，点亮所有的灯。8个关卡，学习用「过程」简化程序',
    image: gameService.coverUrl('robot')
  }
];

/** 累计时长显示：不足 1 小时按分钟 */
export const formatPlayTime = (seconds) => {
  if (!seconds) return '还没人玩过';
  if (seconds < 3600) return `${Math.max(1, Math.round(seconds / 60))} 分钟`;
  return `${(seconds / 3600).toFixed(seconds < 36000 ? 1 : 0)} 小时`;
};
