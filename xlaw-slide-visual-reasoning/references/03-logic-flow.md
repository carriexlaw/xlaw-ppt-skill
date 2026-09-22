## 03-logic-flow.md

## 逻辑链条 / 流程 / 因果关系

#### Low text density

优先：

- 大图
- 大面积背景
- 遮罩
- 少量大字
- 强叙事路径

#### Medium / High text density

优先：

- Flow diagram
- Rectangles
- Arrows
- Layered blocks
- Numbered steps

### Rules

- 流程图只用三样东西：箭头、icon、文字 / 带容器的文字
  - 两层结构：上排 = 阶段小标题 + icon，只起总结 / 分类作用；下排 = 具体流程，才是重点，最需要可视化
  - 箭头分两种，可以同页并用：线条箭头（细线，颜色可以深）连接上排的 icon 与小标题；面性箭头（块状）连接下排的具体流程，颜色一定要浅（tertiary 一档），否则抢视觉重点
  - 分叉节点（判断条件、可选路径、所用模型）能分类的条目都放进容器（`tag`）：胶囊、圆角矩形、线框均可；同一组用同一种
  - 后文方案的基础、全 deck 的重点对象（如「端侧小模型」）用高亮色色系：浅色容器 + accent 文字，通向它的分支说明同色；其余分支用深色
  - 分支说明写在面性箭头的上方 / 下方，折行点选在语义断点
  - 不把分叉写进一段节点文字里；时间线原语（05）只给真正带时间的内容用
  - manifest `focus.form: flow`；校验见 14 C-01 / S-02 / S-05 / S-06 的流程页口径

- 起点终点清晰
- 阅读方向唯一
- 箭头只用于表达真实关系
- 节点信息量尽量均衡
- 重点节点用高亮色强调区分，不要打乱layout
- 超过合理复杂度则拆页

### Anti-patterns

- Flow as Timeline：带分叉的流程借时间线画，分支埋在节点文字里
- Heavy Block Arrows：面性箭头用深色 / 高亮色，比节点还抢眼

- Arrow spaghetti
- Decorative flowcharts
- Too many directions



