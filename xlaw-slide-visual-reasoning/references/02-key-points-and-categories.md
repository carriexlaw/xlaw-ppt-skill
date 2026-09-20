## 02-key-points-and-categories.md

## 要点陈述 / 分类

适用：

- 3–6 个核心观点
- Features
- Principles
- Categories
- Summary

### Layout Patterns

- Icon/Image + title + description
- Illustration + key points
- Multi-column
- Hero point + secondary points
- Grouped categories

### Rules

- 小标题可承担高亮色
- 多段文本要点必须提炼核心内容做小标题（≤ 10 字，`heading`）；长文本拆 bullet，不放进一段小字
  - 有空间 → 小标题配语义 icon；没空间 → 小标题放进胶囊容器（`tag`），颜色用主题色深色（secondary），白字
- bullet：大圆点，尺寸 135%，颜色 accent；能用语义 icon 的用 icon 替代圆点
  - 同页圆点大小必须一致：圆点字体与字符固定（macOS：System Font Regular 的 ●，135%；缩进约 1.4 × 字号），不跟随段首文字的字体（否则汉字开头的段落圆点特别大，数字开头的正常）。`scripts/postfix.py` 统一写
  - 要点之间要有段距：约 0.4 × 字号（16pt → 6pt），字号越大段距越大
  - 页面有重点组件时，非重点组件的圆点用降噪色（secondary），不用 accent
  - icon 要贴语义：成本 → money，人力 → worker，时间 → 沙漏 / 时钟，土地 / 区位 → map
  - 要点句尾不加标点
- 并列分类的重点在「类型」时（如客户 A 家电 / B 工具 / C 园艺），类型做小标题级高亮，并按类型配语义图或 icon；并列项同尺寸、同位置关系
- 组成关系用大括号 + 胶囊 items（如 720 万 = 含税年薪 / 住房 / 探亲 / 保险）
- 不重复大标题：页面主体不把 title 再说一遍（14 C-11）
- 说明文字主动弱化
- icon / illustration 是辅助信息，不抢主标题
- 不默认所有内容做成 card
- 分类太多优先分组

### Anti-patterns

- Card grid syndrome
- Everything emphasized
- Icon decoration overload
- Paragraphed Parallel：并列 / 分类内容写成段落或同号小字
- Title Echo：页面主体把大标题复述一遍



