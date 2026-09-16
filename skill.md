# xlaw-slide-visual-reasoning

A content-to-visual reasoning skill for AI-generated presentations.

## references/

## 00-reasoning-workflow.md

工作流：先理解内容与语境 → 决定视觉方向 → 用统一的底层排版逻辑执行。不是选一套风格再往里套内容。

本 skill 是带图 skill：图片和 icon 的风格承担视觉的很大一部分，没有图片来源时 skill 不运行（无图的 ppt agent 自己就能做，不需要本 skill）。图片来源的前置检查见 10-image-art-direction。

### Step 0 前置检查

- 检查环境变量里是否有 `PEXELS_API_KEY` / `UNSPLASH_ACCESS_KEY` / `PIXABAY_API_KEY` 之一，并向该 API 发一次测试请求确认网络可达
- 任一缺失 → 停下来，按 10 的说明请用户授权安装 key，不进入 Step 1
- 通过 → 记录本次可用的图库来源，进入 Step 1

### Step 1 理解内容与语境

每套 deck 开始前先回答，答案是后面所有视觉决策的依据：

- 内容类型分布：各页分别属于 02–08 中哪一类（要点 / 流程 / 结构 / 时间线 / 观点 / 数据 / 对比）
- 场合：现场讲（投影 / 会议室屏幕）/ 发送自读。场合只影响字号下限和图片尺寸，不影响视觉语言的强弱：内部汇报也是宣讲，同样需要视觉化的排版语言，这是用 ppt 而不是发文档的意义
- 受众：内部管理层 / 外部客户 / 投资人 / 大众
- 语气：论证型（结论先行、证据密集）/ 陈述型（要点陈列）/ 愿景型（少字大图）
- 语义强度：各页内容是尖锐结论、冲突、转折，还是铺陈、说明、并列。这是对比强度的依据
- 可用的非图库素材：产品截图、数据、用户自有图片；有则优先于图库图
- 整体信息量：按字数与元素数粗估各页密度，得到全 deck 的密度分布

### Step 2 决定视觉方向

方向不是从 Editorial / Minimal Corporate / Bold Tech 里挑一个，而是由 Step 1 的答案倒推出以下维度的取值，组合起来就是这套 deck 的方向：

- 密度基线：由信息量和语气决定，论证型偏重、愿景型偏轻；决定各页留白档的默认取值
- 留白基线：body 区留白比例的默认范围（见 01 Whitespace）
- 图片角色分布：语义配图为主 / 氛围图为主 / 全出血与小图的比例（见 10、11）
- 形状语言：直角 / 小圆角 / 胶囊；默认容器是无、分隔线还是填充
- 对比强度：由内容语义决定，不由使用场景决定。结论尖锐、冲突性强、要制造转折的内容用强对比（深浅反差大、大字、大图）；铺陈、说明、并列性的内容用克制对比。同一套 deck 内按页面语义变化，deck 级只定基线
- 大标题位置：全 deck 固定的那一个位置

以上取值写入 11-style-system 并锁定。同样的内容换一个语境，方向应该不同，这是本 skill 与模板的根本区别。

### Step 3 底层排版逻辑执行

每页生成前先做视觉决策记录（page manifest），校验器读它而不是猜：

```yaml
page: 5
message: 一句话，本页唯一的 dominant message
pattern: mapping          # 来自 02–08 对应类型的 patterns
hero: big-label           # 主元素类型，见 01 Visual Hierarchy
density: medium           # 轻 / 中 / 重，见 01 Information Density
container: none           # 无 / 分隔线 / 填充块 / 描边框
void: right               # 留白块位置，见 01 Whitespace
contrast: strong          # 强 / 克制，由本页语义决定，见 Step 2
title_pos: base           # base / mask-edge / below-image / right-of-image / image-center，见 01 一致性
series: null              # 同一大标题下的系列页标记，见 01 一致性
image:                    # 本页用图时必填，见 10 选图流程
  role: semantic          # semantic / atmosphere / full-bleed / small
  layout: 6               # 11 配图方式编号 1–7
  side: left              # 图片所在边：left / right / top / bottom / full
  source: pexels
  id: 1234567
  photographer: ...
  url: ...
  query: "aerial coastal port cool tones"
  candidates_viewed: 12
  reason: 一句话，为什么选它而不是其它候选
```

manifest 决定的是骨架和重量分配。具体尺寸与间距由本页密度档和留白档倒推（见 01 Whitespace），不预设。

### 形状角色标记（生成端硬规则）

校验器不识别形状内容，只认形状名。pptxgenjs 每个 `addText / addShape / addImage / addTable / addChart` 调用都必须带 `objectName`，值只能来自下表；python-pptx 读到的 `shape.name` 就是它。没有 `objectName` 或不在表内的形状，整页不合格 [M]。

格式：`role` 或 `role:qualifier`。

| objectName | 是什么 | 校验器拿它做什么 |
|---|---|---|
| `title` | 大标题，内容页有且仅有一个 | 位置一致；字号 27–30；body 区从它下沿起算 |
| `kicker` | 灰色小字副标题 | 副标题占比与连续页数 |
| `conclusion` | 结论行 | 结论行占比与连续页数 |
| `body` | 普通文本框（要点、说明、列表项） | 字数、元素数、留白、间距分层 |
| `hero:big-number` `hero:big-label` `hero:chart` `hero:table` `hero:image` | 主元素，内容页有且仅有一个 | 主元素唯一、类型、相邻页不同；与 manifest.hero 核对 |
| `card:N` | 卡片容器（描边或填充，N 从 1 起） | 卡片数 3–6；相邻页数量不同；容器样式判定 |
| `panel` | 大面积纯色块（如配图方式 5 的色块） | 容器样式判定（填充块） |
| `tag` | 小型填充标签 / 胶囊（状态、选中项） | 计元素数；不计入容器样式 |
| `divider` | 分隔线 | 容器样式判定（分隔线） |
| `mask` | 图片上的透明遮罩矩形 | 排除出容器与留白计算；文字对比度采样用 |
| `image:full-bleed` `image:atmosphere` `image:semantic` `image:small` | 图片按角色 | 全出血 / 氛围图不计入留白与主元素；与 manifest.image.role 核对 |
| `icon` | 图标 | 计元素数；不作主元素 |
| `chart` `table` | 非主元素的图表、表格 | 计元素数（表格 1 + 行数 / 4） |
| `arrow` | 流程箭头、连接线 | 计元素数；不计入留白 |
| `source` | 数据来源、脚注小字 | 不计入密度字数；字号 ≥ 10.5 |
| `pagenum` | 页码 | 位置一致；排除一切计算 |
| `bg` | 全页纯色背景矩形 | 排除一切计算 |
| `deco` | 明确的装饰形状 | 计数，用于 Excessive Decoration 检查 [W] |

- 封面 / 目录 / 章节 / 结束页同样用 `title`，页类型由 manifest 的 `type` 字段给出，不靠形状名判断
- 一个形状只有一个角色；卡片里的文字单独标 `body`，不并入 `card`
- 角色名是校验依据，不是样式指令：`card:N` 是描边还是填充由形状本身的 fill / line 判定

```python
ROLES = {'title','kicker','conclusion','body','hero','card','panel','tag','divider',
         'mask','image','icon','chart','table','arrow','source','pagenum','bg','deco'}
for sh in slide.shapes:
    role, _, qual = sh.name.partition(':')
    if role not in ROLES: fail(slide_no, f'未标记形状 {sh.name!r}')
```

## 01-visual-foundations.md

全局视觉规则

### Visual Hierarchy

- 每页只能有一个核心的dominant message
  - 即要表达的核心观点只能有一个
  - 但这个核心观点可以有多个分论点
  - 分论点太多则分成两页/多页
  - 不允许所有元素同时强调
- 大小、明度、颜色、位置共同决定视觉权重

- 主元素（hero）：dominant message 必须落在一个可见的主元素上
  - 每个内容页有且仅有一个主元素 [M]
  - 定义：单个元素字号 ≥ 正文 3 倍，或面积 ≥ body 区（版心减标题区）的 30% [M]
  - 类型：大数字 / 大标签或短句 / 图表 / 表格 / 语义图（仅 image:semantic；全出血与氛围图不作主元素）/ 留白本身
    - 留白作为主元素时，页面文字总量 ≤ 80 字（英文 ≤ 40 words）且聚成一块
  - 相邻页主元素类型不同 [M]；全 deck 主元素类型 ≥ 3 种 [W]
  - 主元素承载本页结论，不是装饰：大数字必须是标题那个判断的证据，图表必须支撑标题 [J]

- Primary / Secondary / Tertiary 信息层级
  - Primary: 大标题、小标题/要点/结论句
    - 大标题黑色加粗，字号27-30
    - 小标题/要点/结论句加粗，accent color
    - 句子超过20个字不要用 accent color
  - Secondary: 语义配图 / icon
  - Tertiary: 小字，最小字号10.5或者11
    - 小字颜色用带灰度的黑色
    - 个别需要强调的小字数字/字符可以用accent color并加粗，但一个模块最多一个强调内容

### Information Density

- 内容过多：删 → 合并 → 拆页 → 最后才考虑缩小
- 不通过压缩字号解决信息过载；单页上限 480 个汉字（英文 240 words），超出必须拆页 [M]
- 密度分档（初始阈值，按误报率调；英文按 words 计，阈值减半）
  - 轻：body ≤ 120 字（英文 ≤ 60 words），元素 ≤ 8
  - 中：121–300 字（61–150 words），或 9–20 元素
  - 重：301–480 字（151–240 words），或 > 20 元素
  - 元素 = 独立文本框、形状、图表、图片；表格计 1 + 行数 / 4
  - 密度档决定本页的留白档和间距基线（见 Whitespace），是页面所有尺寸决策的起点
- 全 deck 密度节奏，按字数和元素数算
  - 连续三页不得都是高密度 [M]；连续三页同档（含轻、中）[W]
  - 重页 ≤ 内容页总数的 40% [M]
  - 每个重页之后 2 页内必须出现轻页或中页 [M]
  - 前 3 页内至少 1 个轻页，末 2 页内至少 1 个轻页 [W]
  - 封面、目录、章节页、结束页不计入节奏计算，否则节奏靠章节页蒙混
- 副标题和结论行降为可选项，不是必须
  - 带副标题的内容页 ≤ 60%，且不得连续 4 页都有 [M]
  - 结论行允许出现在 body 内任意位置，不钉在底部；连续带结论行 ≤ 2 页，全 deck ≤ 50% [M]
  - 标题已是结论式时，结论行不得复述标题 [J]
- 控制页面视觉元素数量
- 文本容器
  - 默认容器 = 无；分组靠留白（见 Whitespace）和对齐，不靠框
  - 方框不是默认容器：单页容器样式 ≤ 1 种（描边框 / 填充块 / 分隔线三选一，或无）[M]
  - 整套 deck 内容页中，无任何描边框与填充块的页面 ≥ 1/3 [M]
  - 描边框只在两种情况允许：≥ 3 个多行组且靠间距无法区分；或表达「选中 / 推荐」状态，此时仅选中项带填充，其余无框 [W]
  - 同页卡片数 3–6；相邻两页都用卡片时数量必须不同 [M]
  - 填充块用来标记状态或做主元素，不用来「装」正文 [J]

### Whitespace

- 留白承担分组和强调功能，以及整个ppt的呼吸节奏
- 留白是元素，不是剩余。本 skill 不规定间距数值：先由密度档定本页留白档，再由留白档倒推各级间距，规则只约束比例关系

- 留白量
  - void_ratio = 1 − 元素并集面积 / body 区面积；元素面积取外接矩形并集，含元素自身 padding，不含元素之间的间距
  - 角色为 bg、mask、image:full-bleed、image:atmosphere 的形状不计入元素并集，留白只算前景元素；图片自身的负空间在 10 选图流程里管
  - 轻页 ≥ 45%，中页 25–45%，重页 ≥ 15%；任何内容页 < 15% 不合格 [M]
  - 留白基线由 00 Step 2 的视觉方向决定：愿景型 deck 整体取各档上限，论证型取下限；场合不参与

- 间距分层：距离要能被读成关系
  - 四级：元素间距（同组内行与行）< 组间距 < 区间距（标题区与 body、body 内大区块之间）< 页级留白块
  - 相邻两级 ≥ 2 倍；同一页内每一级只用一个值 [M]
  - 不同关系用相同间距即不合格，读者无法从距离读出层级
  - 分栏之间的距离至少是组间距，不能是元素间距
  - 数值倒推顺序：密度档 → 留白档 → 页级留白块尺寸 → 剩余空间按 ≥ 2 倍级差分配给区 / 组 / 元素三级

- 留白聚合
  - 最大连续空白矩形 ≥ 总留白的 50%（重页 40%）[M]
  - 留白必须聚成块；均匀散在每个元素周围的边距不算留白，算「元素漂浮」
  - 留白块位置在 manifest 声明：右 / 下 / 上带（标题与 body 之间）/ 环绕（仅观点页）/ 无（仅重页）；相邻页留白块位置不同，除非都为「无」[M]

- 留白方向
  - 留白块紧邻主元素，给主元素让出重量：大数字在左则留白在右，图表在上则留白在下 [J]
  - 留白不出现在次要元素旁边

- 残余留白
  - body 内容右边缘到版心右缘、底边缘到版心底缘的距离，要么 ≤ 元素间距（视为填满），要么 ≥ 区间距（视为有意留白）；落在两者之间 = 没填满也没留白，不合格 [M]
  - 同一规则适用于分栏之间的剩余空间

- 不填满
  - 版心是安全区，不是填充目标；右对齐到版心边缘不是目标 [J]
  - 同一 deck 内各页内容右边缘位置不必一致，一致的是栅格列线

- 标题区下方
  - 标题（含可选副标题）与 body 之间 ≥ 区间距；留白块声明为「上带」时 ≥ 页级留白块尺寸 [M]

  

### Color

- Accent Color：饱和度高的蓝色系、绿色系、紫色系
  - 用于大数字、短小标题、重点短结论
  - 每页的重点色要严格控制数量
- Secondary Color: 与accent color同色系的低明度低饱和度的深色，视情况可以有多级深色
  - 用于长小标题、重点长句结论
  - 深色矩形方框容器、胶囊容器
- Tertiary Color: 与accent color同色系的高明度低饱和度的浅色，接近白色
  - 浅色矩形方框容器、胶囊容器
- 同层级信息避免无理由多色
- 灰度测试仍应保持层级



### 一致性

- 一致性通过accent color、字体、视觉元素风格来体现，不通过相同的模板 / 排版
- 分两层
  - 锁定层（全 deck 不变）：色板、字体与字号刻度、形状语言、描边、圆角、栅格、图片处理、icon 风格、页码位置、大标题位置。在 11-style-system 阶段决定，之后一个都不改
  - 变化层（相邻页必须不同）：body 模式、主元素、密度档、容器样式、留白块位置，即 manifest 里的五项
- 大标题位置是页面层唯一固定位置的元素；具体位置由视觉方向决定，一旦决定全 deck 不变 [M]
  - 例外只有配图方式 3 / 4 / 5 / 6（见 11 配图方式）：标题位置由配图方式与图片所在边决定，同一方式同一位置，manifest 用 `title_pos` 声明，校验器按 14 的规则核对；无图页和配图方式 1 / 2 / 7 一律用基准锚点

- 相邻页禁止相同body模式，除非是同一大标题下相同结构的内容（比如几个类别的目标用户分析，团队成员介绍....）

  - 同一大标题下相同结构的内容应该用相同的layout，否则会产生不必要的理解成本
  - 这类系列页在 manifest 标 series，不受下面两条变化规则约束；系列页合计 ≤ 内容页的 40%，超过先考虑合并为总览页 + 分页 [W]

- 相邻两页 manifest 五项（pattern / hero / density / container / void）中至少两项不同 [M]；contrast、image 不参与比较
- 任意连续 5 页内，同一 body 模式出现 ≤ 2 次 [M]
- 同一内容类型（02–08）在不同密度档下必须有不同实现：至少一个有框版 / 无框版，一个紧凑版 / 留白版。选哪种由本页密度档和留白档决定，不由上一页决定
- 变化必须由内容逻辑驱动：结构由内容类型决定，尺度和密度由密度档与留白档决定；无理由的变化是随机，不是设计 [J]

  

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
- 说明文字主动弱化
- icon / illustration 是辅助信息，不抢主标题
- 不默认所有内容做成 card
- 分类太多优先分组

### Anti-patterns

- Card grid syndrome
- Everything emphasized
- Icon decoration overload



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

- 起点终点清晰
- 阅读方向唯一
- 箭头只用于表达真实关系
- 节点信息量尽量均衡
- 重点节点用高亮色强调区分，不要打乱layout
- 超过合理复杂度则拆页

### Anti-patterns

- Arrow spaghetti
- Decorative flowcharts
- Too many directions



## 04-structure-and-architecture.md

## 组织架构 / 系统架构 / 层级关系

适用：

- Organization chart
- Product architecture
- Department structure
- Role relationships
- System layers

### Layout Patterns

- Tree
- Layered architecture
- Hub-and-spoke
- Matrix
- Nested groups

### Visual Strategies

- 矩形 / 胶囊承载节点
- 深色背景 + 亮色层级，半透明矩形叠加体现层次
- 色彩表达类别或层级

### Rules

- 结构关系 > 装饰
- 同等级节点保持统一
- 父子层级建立明确视觉差异
- 连线尽可能短、简单
- 复杂组织结构拆分展示

### Anti-patterns

- Too many boxes
- Excessive connector lines
- Transparency reducing readability
- Color without semantic meaning



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

信息少：
→ Timeline

信息多：
→ Table / Roadmap / Swimlane

### Rules

- 时间方向一眼可读
- milestone 应有视觉重点
- 阶段之间明显分隔
- 不要使用大量表格边框，无边框或者最多只有上中下边框
- 时间信息过多时分阶段



## 06-point-of-view.md

## 观点 / 核心结论表达

适用：

- Strategic statement
- Key insight
- Quote
- Big idea
- Core conclusion

### Layout Patterns

- Full-image statement
- Large typography
- Big number
- Image + statement
- Minimal composition

### Rules

- 一页只讲一个观点
- 强观点允许大量留白
- 图片必须强化观点
- Supporting text 必须主动退后
- 不因为内容少而增加装饰

### Anti-patterns

- Decorative stock imagery
- Weak statement + excessive visual
- Too many supporting arguments
- Fake minimalism

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
- 不默认使用 legend
- 不使用无意义 3D

### Anti-patterns

- Every series has a saturated color
- Tiny labels
- Excessive grid lines
- Decorative charts
- Chart says nothing

## 08-comparison.md

## 对比表达

适用：

- A vs B
- Before / After
- Old / New
- Options
- Competitors
- Feature comparison

### Layout Patterns

- Two-column
- Comparison table
- Before / After
- Hero winner + alternatives
- Spectrum

### Rules

- 对比维度一致
- 差异必须快速识别
- 如果存在明确优劣，需要视觉体现
- 避免左右信息量严重失衡



## 09-cover-section-transition.md

### 封面/目录/章节页/过渡页

- Cover, Agenda, Section divider, Closing, Qutoe page

### Rules

- 封面：
  1. 大标题：
     - 字号中文50左右，英文45左右，中文需要加10%左右字距增加呼吸感，行距中文70pt/英文50pt左右
     - 字数少于中文10个字/英文20个字符，则加大字号/字距/行距
     - 颜色纯黑/纯白，注意要与背景颜色有强对比度
     - 居中显示
  2. 小标题：
     - 在大标题下方，字号20左右
  3. 其它信息：字号同小标题，细体
  4. 图片：用大图铺满+深色遮罩模式，或者抽象流体渐变图
- 目录页：
  - 目录页要与封面有明显区分，不要用同样的背景
- 章节页：
  - 字号同封面大标题，或者小一点
  - 章节页不是必须的，但在页数过多且内容有明显章节节奏时需要加章节页
- 不增加无意义装饰填满页面
- 与正文视觉系统保持一致
- Section page 可以提高视觉张力，但不能像换了一套模板

## 10. `10-image-art-direction.md`

### 图片使用规则

包含：

- Photography
- Illustration
- 3D visual
- Product screenshot
- Background image

### Rules

- 图片首先承担 communication function
- Crop 要有明确视觉焦点
- 避免图片与正文视觉竞争
- Background image 必须检查文字对比度
- 摄影、3D、扁平插画、产品截图等不同视觉语言可以在同一套 deck 内共存，按页面角色分配
- 同一视觉语言内部保持一致：摄影同一色调族与视角，icon 同一透视与线宽
- 同一页内不并置两种强视觉语言（见 11 Icon Style）

### 图片来源（必需，缺失则 skill 不运行）

图片来源只接受三家图库的官方 API：Pexels、Unsplash、Pixabay。不抓取网页，不用匿名的低质量聚合源，不用生图模型替代（等距 3D 与定制插画只在用户自己提供生图 MCP 时可用，且不作为默认路径）。

- 前置检查（00 Step 0）：环境变量里存在 `PEXELS_API_KEY` / `UNSPLASH_ACCESS_KEY` / `PIXABAY_API_KEY` 之一，且一次测试请求返回成功
- 缺失时 agent 必须停下来请用户授权，说明三点：本 skill 依赖图库图片；key 免费；怎么拿。推荐顺序：
  1. Pexels：注册即发 key，额度够用，优先
  2. Pixabay：注册即发 key
  3. Unsplash：需创建应用，默认 demo 额度较低，且按其 API 规范必须署名
- 安装方式：用户提供 key 后，经用户同意写入 shell 配置或项目 `.env`；agent 不得自行猜测、拼凑或从其它文件里翻找 key
- key 只用于请求，不得出现在 deck、manifest、日志、截图或回复文本中
- 网络不可达（沙箱环境）时如实告知：本 skill 需要在能访问图库 API 的环境（如本机 Claude Code）运行，不降级为无图
- 每张图记录来源、摄影师、原始链接，写入该页备注；Unsplash 来源必须署名，其余两家建议在尾页统一致谢

### 选图流程（必须筛选，禁止取第一张）

搜索结果第一张不是选图。每一张进入 deck 的图片都要经过下面的流程，manifest 的 `image` 字段是流程留下的记录，校验器据此判定：

1. 由本页 manifest（message、role、void 位置、contrast）和上面的 Rules 写 2–3 组检索词，英文关键词，包含构图与色调（如 `aerial coastal port cool tones`），不只写主题名词
2. 每组取前 8–12 张，只下载缩略图到临时目录
3. 逐张看，按以下标准打分，不看图不选图：
   - 负空间的方向与本页 manifest 声明的 void 位置一致（文字要压在图上时尤其）
   - 色温、明度与 11 里锁定的 palette 兼容
   - 无人物面孔、无文字、无 logo、无明显品牌物
   - 语义配图必须与本页内容有可说明的关联；氛围图必须与 deck 主题的行业 / 地理 / 尺度一致
   - 视觉焦点单一，可裁出本页需要的比例
   - 原图尺寸满足用途：全出血 ≥ 页面像素宽度，小图 ≥ 显示尺寸的 2 倍
4. 无一合格 → 改检索词再来，最多 3 轮；仍无 → 调整本页的图片角色（全出血改小图、氛围图改语义图）或本页不用图，不降低标准硬选
5. 选定后填 manifest：`candidates_viewed` 为实际看过的张数，`reason` 一句话说明为什么是它而不是其它候选
6. 全 deck 选完后做一次 contact sheet：把所有选中图拼成一张图看整体，同为摄影的图之间色温、明度、镜头语言不统一的换掉；相邻页的图不得在构图上重复
7. 优先同一摄影师或同一色调族的图，一致性比单张好看更重要

- 只看过 1 张就选定、`candidates_viewed` < 8、或 `reason` 为空，均不合格 [M]
- 选定图片不在本页下载过的候选列表内，不合格 [M]
- contact sheet 未生成即交付，不合格 [M]



## 11. `11-style-system.md`

### 整套 Deck 的风格一致性

每次制作 deck 前建立：

```text
Typography
Palette
Grid
Spacing rhythm
Shape language
Corner radius
Stroke
Shadow
Image treatment
Chart treatment
Icon style
```

- 这份清单是 00 Step 2 视觉方向的落地，每一项的取值从内容与语境倒推，不从风格库里挑
- 建立后即锁定，全 deck 不变；页面层的变化（结构、主元素、密度、容器、留白）在锁定层之内发生
- Grid：只定列数与列距，元素边缘落列线；用哪几列、用几列每页自定
- Spacing rhythm：不预设数值，只定四级间距的级差关系（见 01 Whitespace）；具体值由每页密度档与留白档倒推
- 大标题位置在这里定，定了不改

### 风格举例

- Editorial：大字体、大留白、非对称图片优先、少 card

- Minimal Corporate：Neutral palette、Strong grid、Restrained accent、Clean charts

- Bold Tech：Dark/light contrast、Large numbers、Strong accen、Layered shapes

- 以上是方向维度组合后的结果举例，不是可选菜单；同一内容换场合，落到的组合应该不同

重点：

> Visual style = repeated design decisions.

不是给每一页加相同渐变。

### 字体系统

| 层级                     | Windows                                    | macOS                                                      |
| ------------------------ | ------------------------------------------ | ---------------------------------------------------------- |
| **中文 Hero / 页面标题** | Microsoft YaHei Bold                       | MiSans Semibold / Noto Sans SC Bold / PingFang SC Semibold |
| **中文小标题**           | Source Han Sans / Noto Sans CJK SC Medium  | Noto Sans SC Bold / PingFang SC Medium                     |
| **中文正文 / 小字**      | Source Han Sans / Noto Sans CJK SC Regular | Source Han Sans / Noto Sans CJK SC Regular                 |
| **英文 Hero / 页面标题** | Segoe UI Bold                              | Avenir Next Bold                                           |
| **英文小标题**           | Segoe UI Semibold                          | Avenir Next Demi Bold                                      |
| **英文正文**             | Segoe UI Regular                           | Avenir Next Regular                                        |
| **英文辅助 / 大号细字**  | Segoe UI Light                             | Avenir Next Regular                                        |

### 图片风格

- 总体规则：
  - 图片内容与页面主题对应--“语义配图”：
    - 能语义配图的则尽量语义配图
    - 比如市场机会页→类似纽约时代广场的高楼大厦图/高级超商货架图/特定行业的消费端场景图
    - 环保---航拍绿色森林；科技---未来感空间；健康---人物身着运动服在早晨阳光下的城市公园街道跑步；
  - 不能语义配图的才用装饰配图，装饰配图原则：
    - 题材：建筑、城市天际线、航拍自然（森林、河流、田野、大海、山脉）、抽象科技（粒子网络、光线、数据流、星球）
    - 没有人物
    - 视角：宏观、远景、俯瞰。大量航拍/鸟瞰、广角、长焦远景，几乎没有近景特写和微距。视角一致地"从高处看整体"。
  
  - 背景图原则：
    - 图片是文字的底，不是主角
    - 图片留有明显负空间，文字落在暗部或空区
    - 无圆角、无阴影、无描边等修饰。
  
- 配图方式：
  1. 全屏铺满 + 冷色透明矩形全屏遮罩 
     - 遮罩透明度在30-60%之间，对于深色/夜晚图片，透明度可以到80%
     - 对于颜色过多过亮的图片，先降低整体明度
     - 要让亮色文字/形状在遮罩上可见
  2. 全屏铺满 + 白色透明矩形全屏遮罩
     - 遮罩透明度在30-60%之间，对于浅色/白天图片，透明度可以到80%
     - 要让深色文字/形状在遮罩上可见
  3. 全屏铺满 + 宽度占74% 冷色透明矩形遮罩（标题位置：`mask-edge`，水平中心落在遮罩边缘，垂直居中）
     - 多用于一半或以上留白的图片
     - 遮罩居中位置加一条亮色竖线纵向贯穿，宽度0.5pt，竖线上加同色亮色小圆点
     - 内容可以是纵向时间线或者单纯的要点列举
     - 标题位于遮罩与无遮罩图片的明暗交界处
  4. 高度占67%，宽度铺满，对齐页面底部或者顶部（标题位置：图在上则 `below-image`，图在下则基准锚点）
     - 可在图片左侧/右侧加同色系透明遮罩，遮罩上加文案
  5. 宽度占22%，高度铺满，对齐页面左缘或者右缘（标题位置：图在左则 `right-of-image`，图在右则基准锚点）
     - 多为装饰/氛围配图，图片上不要再放文字或其它元素
     - 也可以做纯色色块，色块上放大标题和小字
  6. 宽度占50%，高度铺满，对齐页面左缘或者右缘（标题位置：图在左则 `right-of-image` 或 `image-center`，图在右则基准锚点或 `image-center`）
     - 尽量用语义配图，即内容相关的图片
     - 如果是氛围配图，图片中心可以放大标题
  7. 高语义配图 --- 多张图片在同一页面出现
     - 跟随小标题出现，以要点的方式横向铺陈，加圆角，小标题在图片上方或者下方出现，如有说明性小字则放在图片下方
     - 不能分类的，则以三张窄长图片横向排列的方式放在页面右侧，左侧放大标题和小字内容，右侧三张图片横向铺陈。

- 图片出现时机：
  - 当页面内容可以进行语义配图或者氛围配图时

- 图片风格：

  - 构图：

    - **大面积留白**，尤其是天空、水面、森林等纯净区域。
    - 主体往往只占画面的 **1/3～1/2**，不会塞满画面。
    - **低地平线 / 高天空占比**，例如建筑、云层。
    - 利用 **斜线、延伸线、透视线**：
    - 航拍图采用 **俯视 + 大尺度纹理**，弱化单个物体，强调系统性。
    - 很少有杂乱前景，主体轮廓都比较明确。
    - **常见非对称平衡**
      - 主体不一定居中
      - 可把主体压在一边，另一边留出天空 / 空地 / 水面 / 建筑界面

  - 色彩特点：

    - **冷色系**：天蓝、青蓝、深蓝、墨绿 / 森林绿、白色 / 浅灰
    - 暖色只作为少量点缀，比如城市夜景中的橙黄色灯光。
      - 主色统一 + 小范围暖色对比
    - 即使绿色很多，也往往略偏冷，而不是黄绿色农业宣传片那种暖调。
    - 饱和度总体是 **中等到偏高，但色相比较纯净**，没有复杂的综合色偏。
    - 白色通常非常干净，比如云、建筑板材、浪花等。

  - 明度和光线：

    - 大部分属于 **高明度、空气通透型**画面。
    - 日间图普遍是晴朗自然光，阴影不重。
    - 夜间图以蓝色环境光为主。
    - 高光干净，尤其强调：蓝天的通透感；水面的反射；金属 / 玻璃 / 白色设备的洁净感。

  - 画面质感：

    - 整体偏 **纪实摄影 / 企业图库摄影**，而不是艺术摄影。
    - 画面锐度比较高，主体识别清楚。

    - 没有：强烈胶片颗粒、怀旧色偏、复杂后期调色、戏剧化光影、强人物叙事。

    - 所以视觉感受更偏 **客观、专业、可信、现代**。

  - 空间感：

    - 普遍强调 **开阔感**。
    - 天空、水面、森林、城市全景等都会制造大尺度空间。
    - 很多主体被放在一个比它更大的环境里，形成：
       **“基础设施属于整个生态 / 城市系统的一部分”**
       而不是单纯展示一台设备。

  - 视觉情绪：干净、冷静、理性、秩序感、开放、科技、有一定未来感但不是科幻感





### Icon Style

- 信息可视化的重要元素
- 所有icon都必须有semantic meaning
- 一个页面不要同时出现强配图和强icon/illustration
  - 除非是背景大图铺满+遮罩的模式，小icon可以变成单色线形/面性
- 在文字内容较多时，优先选择配icon
- icon分类
  - 小尺寸：线形/面形，单色极简风格
    - 用途：小标题、items、logic flow
  - 中尺寸：双色极简；多色/渐变/立体/ isometric/ 插画风
    - 用途：小标题、要点陈列、logic flow
- icon风格
  - 扁平极简：色块分面表达前后关系，而不是复杂光影
  - 线描科技 icon 风格
    - **线性图标** 为主，不靠大色块建模
    - 轮廓线清楚，线宽较统一
    - 图形高度简化、符号化
    - 细节通过：描边、小圆点、小装饰线、少量填充
    - 基本没有复杂透视
    - 非常适合小尺寸使用
    - 配色对比干净，辨识度强
    - 气质极简，科技 / 金融 / 数据产品感
  - 等距科技 3D 图标风格
    - 科技类 isometric / pseudo-3D icon
    - 比人物场景更像 **对象图标**，不是叙事插画
    - 大量使用：透视底板、几何模块、立方体、平台 / 面板 / 卡片悬浮
    - 体积感更强，渐变更明显
    - 很多对象带 **发光 / 透明 / 浮层** 效果
    - 结构偏模块化、系统化，适合表示数字产品/平台能力
    - 配色：**蓝、青、紫、白** 为主，高光偏 cyan / mint，阴影偏蓝紫，有明显“科技视觉模板”特征
- 色彩：
  - 冷色主导：蓝 / 紫 / 青 / 白 / 灰
  - 少量暖色点缀
  - 对比清晰但不过分浓艳
- 空间
  - 扁平或轻等距
  - 体积感来自色块分面与轻渐变
  - 少量柔和投影

- 不要在同一组icon里混用不同透视体系
- 复杂度根据使用尺寸控制：小图标必须高度简化，大型章节插画可增加场景关系
- 输出气质：professional / premium / restrained



## 12-anti-patterns.md

- 每个问题都有：Anti-pattern、Symptoms、Why it fails、How to fix、Exceptions
- 比如：
  - Everything Is Emphasized：所有内容都有颜色、粗体、icon。
  - Card Grid Syndrome：所有内容都被放入圆角 card
  - Rainbow Slide：颜色很多但没有语义。
  - No Focal Point：页面没有第一视觉中心。
  - Wall of Text：内容直接复制到 PPT。
  - Fake Minimalism：字少，但视觉上没有构图。
  - Template Repetition：每页只是相同 layout 换内容。综合判定见 13 机器校验清单末项。
  - Excessive Decoration：线、渐变、图标、形状没有信息作用。
  - Over-compression：为了塞内容缩字号、缩间距。
  - Over-designed Diagram：结构简单却使用复杂图形。
  - Filled-but-not-Full：内容既没填到版心边缘，留出的空又不够读成有意留白（见 01 残余留白）。
  - Floating Elements：每个元素周围一圈等量边距，留白被打碎，页面没有一块能呼吸的空。
  - Uniform Rhythm：整套 deck 每页密度相同、每页都有副标题和结论行、每页内容都填到同一条右边线。
  - First-result Image：图片是搜索结果第一张，没有对着选图标准筛过。
  - Image Drift：同为摄影的各页图片单看都行，拼在一起色温、镜头语言、年代感各不相同。



## 13-visual-qa.md

最终强制执行的检查。

- 1-second test：一秒能不能看到主要信息？
- Squint test：眯眼看，视觉重心在哪里？
- Thumbnail test：缩小到 20–25% 后，层级是否成立？
- Grayscale test：去掉颜色后，层级是否仍然成立？
- Removal test：有没有元素删除后完全不影响表达？
- Density test：页面是在“呼吸”还是在“塞满”？
- Consistency test：这一页是否明显属于这套 deck？
- Distance test：投影环境下正文是否仍然可读？

### Deck 级测试

- Flip test：快速翻完整套 deck，能否感到轻重节奏，还是每页一样重？
- Silhouette test：只看每页元素的外接矩形轮廓，相邻页是否明显不同？
- Anchor test：大标题是否始终在同一位置，其余是否在动？

### 机器校验清单（validate_design.py）

每项的输入、算法、阈值定义见 14-validation-spec.md；本表只是索引。

上面的感知测试由模型执行。下列项由校验器从形状外接矩形与文本长度算出，聚合类用细栅格光栅化后求最大空矩形。M 直接拦截，W 先 warning，跑 3 套 deck 看误报率后再升级。

| 校验项 | 来源 | 级别 |
|---|---|---|
| 每个形状的 name 都是合法角色；内容页恰有一个 `title`、一个 `hero:*` | 00 形状角色标记 | M |
| manifest 相邻页至少两项不同；5 页内同 pattern ≤ 2（系列页除外） | 01 一致性 | M |
| 大标题位置全 deck 一致 | 01 一致性 | M |
| 系列页合计 ≤ 40% 内容页 | 01 一致性 | W |
| 每页有且仅有一个主元素；相邻页主元素类型不同 | 01 Visual Hierarchy | M |
| 全 deck 主元素类型 ≥ 3 种 | 01 Visual Hierarchy | W |
| 密度分档；连续 3 页不得都是重页；重页 ≤ 40%；重页后 2 页内有轻/中页；单页 ≤ 480 字 / 240 words | 01 Information Density | M |
| 连续 3 页同档；首 3 页 / 末 2 页各含轻页 | 01 Information Density | W |
| 副标题页 ≤ 60% 且不连续 4 页；结论行连续 ≤ 2 且 ≤ 50% | 01 Information Density | M |
| 单页容器样式 ≤ 1；无框页 ≥ 1/3；卡片 3–6 且相邻页数量不同 | 01 Information Density | M |
| void_ratio 分档阈值 | 01 Whitespace | M |
| 最大空白矩形 ≥ 总留白 50%（重页 40%）；相邻页留白块位置不同 | 01 Whitespace | M |
| 四级间距级差 ≥ 2 倍，同页每级单值 | 01 Whitespace | M |
| 残余留白：内容边缘距离 ≤ 元素间距 或 ≥ 区间距 | 01 Whitespace | M |
| 标题与 body 距离 ≥ 区间距 | 01 Whitespace | M |
| 模板复制感综合：以下命中 ≥ 3 项整套不合格——≥ 80% 页同档；≥ 80% 页同时有副标题和结论行；≥ 80% 页同一容器样式；≥ 50% 页无主元素；≥ 80% 页右缘与底缘都在「填满」区间；任一 pattern 占比 ≥ 40% | 12 Template Repetition | M |
| 前置：图库 key 存在且测试请求成功，否则不进入生成 | 00 Step 0 / 10 | M |
| 每张图的 manifest 记录完整：`candidates_viewed` ≥ 8、`reason` 非空、所选图在候选列表内、备注含来源与摄影师 | 10 选图流程 | M |
| contact sheet 已生成；相邻页图片构图不重复 | 10 选图流程 | M |
| 全 deck 摄影图色温、明度一致（contact sheet 上按平均色温与亮度离群检测，仅摄影） | 10 选图流程 | W |

