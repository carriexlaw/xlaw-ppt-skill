## 05-timeline-and-roadmap.md

## 时间表 / 时间线 / Roadmap

适用：

- Project plan
- History
- Milestones
- Release roadmap
- Phased strategy

### Patterns

- Horizontal timeline
- Vertical timeline
- Table timeline
- Milestone roadmap
- Multi-phase roadmap
- Swimlane

### Decision Rules

识别：内容里有 ≥ 3 个带时间的节点 → 必须用时间线，不允许写成列表，也不允许挑一个时间做大数字（manifest `focus.form: timeline`）

信息少：
→ Timeline

信息多：
→ Table / Roadmap / Swimlane

### Rules

- 时间方向一眼可读
- 横向时间线
  - 一条细线加右端箭头，横置于页面中部，两端留页边距
  - 线上均匀分布节点圆点；时间在线上方，内容在线下方
  - 能语义化的，在线与内容之间加语义 icon
- 竖向时间线
  - 一条细线纵向贯穿页面，位置偏右
  - 线上均匀分布节点圆点；线左是时间，线右是内容
- 时间节点与内容同色；重点节点的时间和内容都用 accent
- 时间数字用英文字体；重复的年份只在该年第一个节点出现（年份 Bold，季度细体）
- 刻度等距；没有事件的刻度保留为浅色节点
- 关键节点的说明（如「客户验厂必须在 2027 Q3 完成…」）用浅色圆角容器 + 箭头指向该节点
- 角色：轴线 `arrow`，节点圆点 `tag`，时间 `heading`，内容 `body`
- milestone 应有视觉重点
- 阶段之间明显分隔
- 不要使用大量表格边框，无边框或者最多只有上中下边框
- 时间信息过多时分阶段

### Anti-patterns

- Timeline as List：时间节点写成列表
- 挑一个时间节点做大数字，其余节点缩成小字
