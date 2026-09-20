## 07-data-visualization.md

## 数据表达

适用：

- Trend
- Comparison
- Distribution
- Composition
- KPI
- Quantitative evidence

### Patterns

- Bar chart
- Line chart
- Area chart
- Scatter
- Stacked bar
- Big number
- KPI composition

### Rules

- 先确定结论，再决定图表
- Highlight only meaningful data
- Secondary data neutralized
- 单位、时间、source 清楚
- 减少 chart junk
- 柱、条、折线不用 3D；占比饼图可用 3D

图表

- 序列名不随图表出：`showLegend: false`，在图表外侧自绘色块 + 文字（`legend`），文字 ≥ 18。原生 legend 占 plot 空间，放大它图表就缩小，所以不用原生 legend
- 图表标题不随图表出（`showTitle: false`），也不许塞进 source：单独放在图表正上方，小标题级（`heading`），深色 Bold，不用 accent，带单位。source 只留数据来源与时间范围
- 小型图表（类目 ≤ 8）形状框宽约为版心的 45–55%，另一半放序列名和结论；不为了填满版心把图表拉宽，柱子过粗既看不出增长趋势也让画面失衡。`barGapWidthPct` 取 50–100。类目 > 12 才铺满版心
- 标题或结论在讲趋势时加趋势线：组合图的折线序列，或自绘曲线（`arrow`），细线深色
- 着色：manifest 写 `chart.focus_series`。论证对象用 accent，论据 / 参照序列用 `data_muted`，不给每个序列都上饱和色
- 类目轴（年份）与数据标签：英文字体，年份 Bold ≥ 16，数据标签 ≥ 12。优先用原生字号（对位准），设不上去再隐藏原生标签自绘
- 小字副标题里的结论拿出来做 `conclusion`，小标题级；除序列名外，其它要强调的时间 / 数字也可以单独画并放大加粗

占比

- 说「所占比例」时优先用图表：Doughnut / 饼图 / 单条 bar 组成图
- pptxgenjs 默认出 doughnut；要 3D 饼图需后处理 XML，先问用户

表格

- 表头最多 Medium 字重
- 字号按信息密度定，内容很多的表格才用小号（轻 / 中页约 18–20）
- 表格里的数字一律英文字体 Demi Bold
- 密度低时数据区可用 accent；密度越高饱和度越低，重页数据用正文色

### Anti-patterns

- Every series has a saturated color
- Tiny labels
- Excessive grid lines
- Decorative charts
- Chart says nothing
- Fat Chart：小数据量图表被拉满版心，柱子粗壮
- 论据序列用 accent、论证对象用灰（着色反了）
- 图表标题 / 序列名藏在 source 小字或原生 legend 里
