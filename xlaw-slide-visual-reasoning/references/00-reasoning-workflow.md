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

- 密度基线：由信息量和语气决定，论证型偏重、愿景型偏轻；决定各页密度档的默认取值，密度档定本页正文起始字号，其余层级相对正文取值（见 01 Visual Hierarchy、14 S-01）；留白不是输入，是尺度放大到位后的剩余
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
focus:                    # 第一层级，见 01 Visual Hierarchy：先写 object（这一页在讲谁），再选 form
  object: 三个方案
  form: headings          # numbers / headings / chart / table / timeline / image / statement
  count: 3                # 第一层级元素个数（0–4；chart / table / timeline / image 填 1）
density: medium           # 轻 / 中 / 重，见 01 Information Density
container: none           # 无 / 分隔线 / 填充块 / 描边框
columns: "1:2"           # 列数与列比，从左到右（见 14 §1.2）；列宽合计 = 版心宽
contrast: strong          # strong（强）/ restrained（克制），由本页语义决定，见 Step 2
title_pos: base           # base / mask-edge / below-image / right-of-image / image-center，见 01 一致性
series: null              # 同一大标题下的系列页标记，见 01 一致性
visual_side: right        # 无图页的图表 / 表格 / 区域背景所在侧：left / right / full / none；有图页读 image.side（01 一致性：相邻页左右交替）
image:                    # 本页用图时必填，见 10 选图流程
  role: semantic          # semantic / atmosphere / full-bleed / small
  layout: 6               # 11 配图方式编号 1–7
  side: left              # 图片所在边：left / right / top / bottom / full
  source: pexels          # pexels / unsplash / pixabay / user（用户自有图片）
  id: 1234567
  photographer: ...
  url: ...
  query: "aerial coastal port cool tones"
  candidates_viewed: 12
  reason: 一句话，为什么选它而不是其它候选
```

manifest 决定的是骨架和重量分配。正文起始字号由密度档定、其余层级相对正文（14 S-01），间距 g 由剩余空间算出并受正文字号约束（14 S-02），坐标由 `scripts/layout.py` 的尺度循环给出（14 §4c），不预设。

### 形状角色标记（生成端硬规则）

校验器不识别形状内容，只认形状名。pptxgenjs 每个 `addText / addShape / addImage / addTable / addChart` 调用都必须带 `objectName`，值只能来自下表；python-pptx 读到的 `shape.name` 就是它。没有 `objectName` 或不在表内的形状，整页不合格 [M]。

格式：`role` 或 `role:qualifier`。

| objectName | 是什么 | 校验器拿它做什么 |
|---|---|---|
| `title` | 大标题，内容页有且仅有一个 | 位置一致；字号 28–40、单行、字间距 10%；body 区从它下沿起算 |
| `kicker` | 灰色小字副标题，只放范围 / 日期 / 口径 | 副标题占比与连续页数 |
| `conclusion` | 结论行（小标题级） | 结论行占比与连续页数；不得复述 title |
| `body` | 普通文本框（要点、说明、列表项） | 字数、元素数、间距分层；正文字号的众数从它算 |
| `heading` | 小标题级文字：论述对象名、方案名、分类名、图表标题 | 字号 ≥ 1.25 × 正文；不得复述 title |
| `label` | 大数字的释义文字，紧贴数字右侧 | 层级完整性（有大数字必有 label 或 heading） |
| `legend` | 自绘序列名（色块 + 文字各一个形状，都叫 `legend`） | 计元素数；文字 ≥ 18 |
| `hero:big-number` `hero:big-label` `hero:chart` `hero:table` `hero:image` | 第一层级元素，每页 0–4 个；同页多个时限定词、字号、字重、颜色必须一致 | 个数与 manifest.focus 核对；层级完整性 |
| `card:N` | 卡片容器（描边或填充，N 从 1 起） | 卡片数 2–6；相邻页数量不同；容器样式判定 |
| `panel` | 大面积纯色块（如配图方式 5 的色块） | 容器样式判定（填充块） |
| `panel:region` | 贴边的区域背景（直角，三边贴页面边缘），每页 ≤ 1 | 贴边判定；像 bg 一样排除出内容块 / 贴合 / 对齐线 |
| `tag` | 小容器：圆形 / 胶囊（小标题、items、属性、时间线节点圆点） | 计元素数；不计入容器样式 |
| `divider` | 分隔线 | 容器样式判定（分隔线） |
| `mask` | 图片上的透明遮罩矩形 | 排除出容器与留白计算；文字对比度采样用 |
| `image:full-bleed` `image:atmosphere` `image:semantic` `image:small` | 图片按角色 | 全出血 / 氛围图不计入留白与第一层级；与 manifest.image.role 核对 |
| `icon` | 图标 | 计元素数；不作第一层级 |
| `chart` `table` | 非第一层级的图表、表格 | 计元素数（表格 1 + 行数 / 4） |
| `arrow` | 流程箭头、连接线、时间线轴线、趋势线、大括号 | 计元素数；不计入留白 |
| `source` | 数据来源、脚注小字 | 不计入密度字数；字号 ≥ 10.5 |
| `pagenum` | 页码（≤ 20 页的 deck 不放） | 有则在右下锚点；排除一切计算 |
| `bg` | 全页纯色背景矩形 | 排除一切计算 |
| `deco` | 明确的装饰形状 | 计数，用于 Excessive Decoration 检查 [W] |

- 封面 / 目录 / 章节 / 结束页同样用 `title`，页类型由 manifest 的 `type` 字段给出，不靠形状名判断
- 一个形状只有一个角色；卡片里的文字单独标 `body`，不并入 `card`
- 角色名是校验依据，不是样式指令：`card:N` 是描边还是填充由形状本身的 fill / line 判定

```python
ROLES = {'title','kicker','conclusion','body','heading','label','legend','hero','card','panel','tag','divider',
         'mask','image','icon','chart','table','arrow','source','pagenum','bg','deco'}
for sh in slide.shapes:
    role, _, qual = sh.name.partition(':')
    if role not in ROLES: fail(slide_no, f'未标记形状 {sh.name!r}')
```

