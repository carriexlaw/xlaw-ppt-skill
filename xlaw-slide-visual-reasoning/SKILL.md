---
name: xlaw-slide-visual-reasoning
description: 带图的 PPT 视觉推理 skill：从内容与语境倒推视觉方向，逐页写视觉决策 manifest，用 pptxgenjs 生成 deck，图片来自 Pexels / Unsplash / Pixabay 官方 API 并经过筛选，最后用 validate_design.py 做几何与节奏校验。需要图库 API key（PEXELS_API_KEY / UNSPLASH_ACCESS_KEY / PIXABAY_API_KEY 之一）、可访问图库 API 的网络、LibreOffice（渲染自查）与 Node（pptxgenjs）。只在 Claude Code 这类能出网、能装依赖的本机环境运行；沙箱或无网环境不运行，也不降级为无图。触发：用户要做 PPT / 演示文稿 / slide deck，且允许配图。
---

# xlaw-slide-visual-reasoning

本文件只做编排。所有规则、阈值、字段定义都在 `references/`，这里不复述、不改写；遇到冲突以 references 为准。

| 文件 | 内容 |
|---|---|
| `references/00-reasoning-workflow.md` | 工作流 Step 0–3、page manifest 字段、形状角色表（生成端硬规则） |
| `references/01-visual-foundations.md` | 层级（第一层级 = 论述对象，字号分级）、密度、容器三类、可视化拆解、留白（尺度优先：S-01–S-06）、颜色、一致性的全局规则 |
| `references/02` – `08` | 七类内容（要点 / 流程 / 结构 / 时间线 / 观点 / 数据 / 对比）的 patterns 与规则 |
| `references/09-cover-section-transition.md` | 封面 / 目录 / 章节 / 结束页 |
| `references/10-image-art-direction.md` | 图片来源、授权说明、七步选图流程 |
| `references/11-style-system.md` | 锁定层清单、字体系统、图片风格、七种配图方式、icon 风格 |
| `references/12-anti-patterns.md` | 反模式清单 |
| `references/13-visual-qa.md` | 感知测试（模型做）与机器校验清单（索引） |
| `references/14-validation-spec.md` | validate_design.py 的输入、算法、阈值；manifest schema |
| `thresholds.yaml` | 14 §8 的默认阈值，校验器只从这里读数 |

脚本（`scripts/`，Python 3.9+；依赖 python-pptx、Pillow、numpy、imagehash、PyYAML、requests、pymupdf、lxml；cairosvg 可选）：

| 脚本 | 用途 |
|---|---|
| `fetch_images.py` | `--check` 前置检查；`search / mark / select` 走 10 的选图流程，写 `_qa/candidates/NN.json` |
| `render_deck.py` | `--check` 检测 LibreOffice；渲染 `_qa/render/NN.png` 供 13 的感知测试 |
| `inkbox.py` | 14 §3.3 墨迹框估算；生成端用它算文本框高度 |
| `layout.py` | 14 §4c 尺度循环：由密度档与元素清单算出字号、g、p 与每个元素的框 |
| `contact_sheet.py` | 选中图拼图 → `_qa/contact_sheet.png` |
| `validate_design.py` | 14 的全部 C-xx；`--list` 列出检查项与阈值来源 |
| `roles.py` | 形状角色校验，validate 内部调用，也可单独跑 |
| `icon.py` | 开源 icon 的 SVG → 重着色 → 4× PNG（cairosvg，缺 libcairo 时回退 PyMuPDF）；支持 Phosphor duotone 双色 |
| `mask_color.py` | 由图片主色算遮罩颜色（深 / 浅），遮罩不跟主题色 |
| `postfix.py` | 生成后的 XML 后处理：数字 / 英文写成英文字体（a:latin）、bullet 135% + accent；`node build.js` 之后、渲染与校验之前必跑 |

## 产出文件（14 §0）

```
<deck 目录>/
  deck.pptx
  deck.manifest.yaml        # deck 级 + 逐页 manifest
  build.js                  # pptxgenjs 生成脚本
  _qa/candidates/NN.json    # 第 NN 页的候选记录
  _qa/candidates/NN/*.jpg   # 缩略图
  _qa/selected/NN.jpg       # 选定原图（多图页 NN-1.jpg、NN-2.jpg …），pptx 从这里 addImage
  _qa/contact_sheet.png
  _qa/render/NN.png         # 渲染图
  _qa/validate.json
```

## Step 0 前置检查（不通过不进入 Step 1）

```bash
python scripts/fetch_images.py --check
python scripts/render_deck.py --check
```

- 图库 key 缺失或测试请求失败：停下，把脚本打印的授权说明转述给用户（本 skill 依赖图库图片；key 免费；三家怎么拿，推荐顺序 Pexels → Pixabay → Unsplash）。用户给出 key 后，经用户同意写入 shell 配置或项目 `.env`。不自行猜测、拼凑或翻找 key；key 不出现在 deck、manifest、日志、截图或回复文本里。
- 网络不可达：如实告知需要在能访问图库 API 的环境运行，不降级为无图。
- LibreOffice 缺失：停下，按脚本打印的安装方式提示用户（mac `brew install --cask libreoffice`；Windows 官网安装包；Linux `apt install libreoffice-impress`）。渲染自查是运行前提，不允许跳过。
- 两项都通过 → 记录本次可用的图库来源，进入 Step 1。

## Step 1–2 理解内容与语境 → 决定视觉方向

按 `00` Step 1 回答七个问题，按 Step 2 倒推方向维度，再按 `11` 建立锁定层清单。结果写成 deck 级 manifest（字段与示例见 `14` §1.1）：页面尺寸、版心、标题锚点、页码锚点、字号刻度、字体、色板、形状语言、tone。

- 字号刻度必须包含 `09` 要求的封面 / 章节 / 副标题字号，并且覆盖 `01` 的字号分级：正文起始值（`14` S-01：轻 18 / 中 16 / 重 14）、小标题级（1.4–1.8 × 正文）、数字释义、大数字（2.5–3.2 × 正文，≤ 54）、大标题（28–40）、一句话页阶梯（40–72）。示例：`[10.5, 12, 14, 16, 18, 20, 24, 28, 32, 36, 40, 48, 54, 60, 72]`。
- 字体：macOS 中文首选 Source Han Sans（标题 Bold，小标题 Medium，正文 Light），其次 Noto Sans SC，PingFang 放最后；`deck.fonts_latin` 写英文字体，数字与英文一律用它（`11` 字体系统）。
- 色板除 accent / secondary / tertiary / neutral 外，还要有 `accent_light`（深色背景上的高亮）与 `data_muted`（图表论据序列、目录序号），都与 accent 同色系。
- ≤ 20 页的 deck 不放页码；> 20 页放右下（`pagenum_anchor` 在右下）。
- 色板里的每个颜色都是 hex 大写无 `#`；deck 里出现的任何颜色都必须在色板内（`14` C-14）。
- 没有栅格与间距数值可锁：列宽由每页 `columns` 定，间距由每页剩余空间算出（`14` S-02 / S-06）。
- 锁定后写入 `deck.manifest.yaml` 的 `deck:` 段，之后一个都不改。

## Step 3 逐页生成

对每一页，顺序固定：**先写页级 manifest，再写生成代码**。

1. 按 `00` Step 3 与 `14` §1.2 写该页 manifest（type、message、pattern、focus、density、container、columns、source_chars、contrast、title_pos、subtitle、conclusion、series、visual_side、image）。**先写 `focus.object`（这一页在讲谁），再选 `focus.form`**：第一层级是论述对象，可以是一组；数字只有本身就是论述对象时才放大，有几个重要数字就一起强调几个（≤ 4）。再按 `01` 可视化拆解判断内容能不能拆成并列 / 一对数据 / 图表 / bullet / 时间线 / 逻辑符号，能拆就不写成段落，追加到 `deck.manifest.yaml` 的 `pages:`。`source_chars` = 原稿分配给本页的汉字当量（`inkbox.cjk_equiv`），之后页面字数不得超过它的 1.1 倍（C-37）：填不满就居中，不加字。
2. 有图的页先走下面的「选图」，把 `image` 字段填完整再写代码。
3. 写该页的 pptxgenjs 代码。生成端硬规则：
   - **每个 `addText / addShape / addImage / addTable / addChart` 调用都带 `objectName`**，值只能来自 `00` 的角色表（`title`、`kicker`、`conclusion`、`body`、`heading`、`label`、`legend`、`hero:big-number` …、`card:N`、`panel`、`panel:region`、`tag`、`divider`、`mask`、`image:semantic` …、`icon`、`chart`、`table`、`arrow`、`source`、`pagenum`、`bg`、`deco`）。没有 objectName 或不在表内，整页不合格。
   - **文本框按墨迹框贴文字**：先用 `python scripts/inkbox.py --size <pt> --width <pt> --text "..."` 算出需要的高度，文本框高度取该值，不留多余空高；留白与间距校验用的是墨迹框，空高会让间距失真。
   - **图片来源写进该页备注**：`slide.addNotes(...)` 内包含 source 与 photographer（`fetch_images.py select` 会打印应写的那一行）。Unsplash 必须按其规范署名。
   - **中文大标题加字间距**：内容页 `title` 带 `charSpacing: 0.075 × fontSize`，封面 / 章节 / 目录 `0.1 × fontSize`；算高度 / 判折行时 `inkbox.py --spacing` 带上同样的值。内容页 title 28–40、必须单行；过长（墨迹宽 > 84% 标题宽）就缩一档（layout.py 的 `title` 输出已处理）。
   - **高亮色克制**（`01` Color）：accent 只给本页结论里最重要的数字 / 词；论据数字、释义、单位用深色；饱和高亮色不作背景、不铺大色块（章节页也不行，C-14 [M]）；暖色 accent 用得更少；accent 是暖色时区域背景取更灰、更冷的浅色。先分清本页哪块是结论、哪块是论据：结论放大占主区，论据缩小
   - **数据带名称和单位**：每个数据配小标题级名称；单位紧跟数字（layout 的 text 节点 `unit`），不藏进小字；前后对比标出对比维度（时间）；「大数字 → 大数字」全 deck ≤ 3 页，其余用小表格 / 成对条形 / 堆叠条；构成用饼图 / 环形图，不用柱状图（`07`）
   - **高亮与粗体**：小标题、结论句用 Medium，不用大标题同款 Bold；一组并列小标题里只让一个成分用 accent；页面有重点组件时 accent 全部集中在它身上（其余小标题、圆点、数字降噪）；高亮已用在小标题上时 icon 用深色降噪。
   - **bullet**：段首 run 给 `bullet: {code: '25CF'}`（accent）或 `'25CB'`（降噪色），postfix.py 统一成固定字体的 ● 135%（缺省 System Font Regular，`deck.bullet` 可覆盖），缩进约 1.4 × 字号；要点文本给段距 `paraSpaceBefore ≈ 0.4 × 字号`（layout 的 text 节点加 `para_gap: true`，输出里带 `para_gap`）。
   - **不造元标签、不复述标题**：「结论先行」这类词不做 title / kicker；小标题级以上的文字不把 title 再说一遍（C-11）。只有一句话的页用 `statement` 页类型（`06`）。
   - 每个 run 显式给 `fontFace`、`fontSize`、`color`；字号只取 `type_scale` 里的值；颜色只取色板里的值。行距用固定 pt：`lineSpacing: 1.2 × fontSize`，不用 `lineSpacingMultiple`（倍数相对字体自带行高，中文字体会渲染成约 1.46 × 字号，多行大字压到下一个元素，也和 inkbox 的估算对不上）。
   - pptxgenjs 坐标单位是英寸，manifest 与校验器单位是 pt：`inch = pt / 72`。页面 960×540pt 对应 `LAYOUT_WIDE`（13.333×7.5in）。
   - **每个 `addImage` 必须带 `sizing: {type: 'cover', w, h}`，禁止靠 w / h 直接拉伸**（C-35 会查形状与像素的宽高比）。pptxgenjs 在 Node 里读不到像素尺寸，它把 `w / h` 当作图片自身尺寸来算裁剪，所以 `w / h` 必须按图片自身宽高比给，`sizing.w / h` 才是页面上的框（`layout.py` 的输出里已经给出 `img_w / img_h`）。
   - 遮罩是 `addShape(rect, { fill: { color, transparency } , objectName: 'mask' })`；颜色用 `python scripts/mask_color.py <图>` 从图片自身主色算（浅色遮罩加 `--light`），不用主题色；加了全屏遮罩的图当背景，文字块照常居中。
   - 单个段落 ≤ 100 汉字当量且 ≤ 4 行，单个文本框 ≤ 200 字（C-36）；超出拆成多个 body 或改结构，不是缩字号。
   - 布局由 `scripts/layout.py` 的尺度循环计算（`14` §4c），build.js 不得手写内容元素坐标。元素树的节点：text（可带 `unit`）/ icon / tag / image / chart / table / box / vtimeline / pair（紧贴对：数字 + 释义、icon + 要点、色块 + 序列名、大括号 + items）/ row（并列格，`balance` 让容器宽度随内容、`stretch` 对齐高度）/ stack / card（可带压角的圆形或胶囊 tag）/ timeline（横向时间线，含说明容器）；列加 `region: true`、顶层节点加 `region: "bottom"` 输出贴边区域背景；列加 `edge` 输出满页高边图（配图方式 5 / 6）：字号档由密度档定（S-01），间距 g 由剩余空间算出（S-02），内容块横向填满、竖向填满或居中（S-03），容器贴内容（S-04），无洞（S-05），对齐线 ≤ 3（S-06）。
     ```bash
     python scripts/layout.py page05.json --deck deck.manifest.yaml --write-g > _qa/layout/05.json     # 输入：页级 manifest（page、density、columns）+ 元素清单；输出：g、p、每个元素的框与字号；--write-g 把 g 写回该页 manifest
     ```
     元素清单写法见 `layout.py` 顶部说明。有余量时的放大顺序是正文 → 小标题级 → 大数字，大数字永远最后升。layout.py 返回失败（g 低于下限 = 内容超载；列内居中留下 > 3g 的空；大数字缩到下限仍折行）时改列比、改结构或拆页，不加字、不换文案、不改阈值。
   - 图表（`07`、S-07）：`showTitle: false`、`showLegend: false`；图表标题单独放在图表正上方（`heading`，深色、带单位），序列名在图表外侧自绘（`legend`：色块 + 文字 ≥ 18）；小型图表（类目 ≤ 8）形状框宽约为版心的 45–55%，另一半放序列名和结论；论证对象序列用 accent，其余用 `data_muted`；讲趋势时加趋势线。校验器看不到图表墨迹，渲染自查时确认。
4. 页面的骨架与重量分配由 manifest 决定；尺寸不预设，由密度档与剩余空间算出（`01` Whitespace）。

### 选图（`10` 七步走）

```bash
python scripts/fetch_images.py search --page 05 --query "aerial coastal port cool tones" --query "..." --per 10
# 用 Read 逐张查看 _qa/candidates/05/*.jpg，每看一张就 mark 一张，不看图不打分
python scripts/fetch_images.py mark --page 05 --id 1234567 --score 4 --note "负空间右侧，冷色，无人物"
python scripts/fetch_images.py select --page 05 --id 1234567          # 原图 → _qa/selected/05.jpg
```

- 检索词 2–3 组，英文，含构图与色调，不只写主题名词；每组取前 8–12 张。
- 打分标准、三轮上限、无合格图时的处理见 `10`；不降低标准硬选。
- `candidates_viewed` 填实际 mark 过的张数（≥ 8），`reason` 一句话说明为什么是它而不是其它候选。
- 只看过 1 张就选定、选了候选之外的图、reason 为空，校验器都会拦（C-30）。
- 用户自有图片（截图、自有摄影）：`source: user`，跳过 C-30，但 `role / layout / side / reason` 仍必填，原图放到 `_qa/selected/NN.jpg`，页备注写「用户提供」。

### icon

- **语义 icon**（工厂、船、证书、握手这类要被认出来的）：用开源库，运行时取 SVG，不打包进 skill。线形用 lucide-static / @tabler/icons outline；**面性**（对比页的优 / 劣、替代 bullet 圆点的语义 icon）用 `@phosphor-icons/core` 的 fill 或 @tabler/icons filled（Lucide 只有线形）：
  ```bash
  npm i lucide-static          # 或 @tabler/icons；同页同组 icon 必须来自同一库同一风格
  ```
  重着色只改 SVG 的 `stroke` / `fill` 为色板色；插入前用 `scripts/icon.py` 栅格化为 4× PNG 再 `addImage`（不要直接插 SVG：pptxgenjs 的 SVG 回退 PNG 不是真 PNG，旧版 PowerPoint / WPS 有风险，python-pptx 也读不了 SVG）。
  ```bash
  python scripts/icon.py node_modules/@phosphor-icons/core/assets/fill/factory-fill.svg _qa/icons/factory-1F4FD8.png --color 1F4FD8
  python scripts/icon.py node_modules/@phosphor-icons/core/assets/duotone/factory-duotone.svg _qa/icons/factory-duo.png --color 0B1F3A --secondary 9CC8FF
  ```
- **几何 / 结构 glyph**（箭头、序号圆、勾叉、分隔符、流程节点）：直接用 pptxgenjs 形状或自绘 SVG 生成，不走库。
- **双色 / 多色中尺寸 icon**：Phosphor duotone（`@phosphor-icons/core`），同样栅格化后插入；需要双色扁平语义 icon（时间线节点下方那种）时用 Pixabay vector 检索（`fetch_images.py search --type vector`），同样走筛选流程。
- **等距 3D icon**：只在用户提供素材或生图 MCP 时可用，不是默认路径。
- icon 的 objectName 为 `icon`；风格规则见 `11` Icon Style。

## 交付前

顺序固定，任一环节失败都不交付：

```bash
python scripts/postfix.py deck.pptx deck.manifest.yaml           # 0 英文字体 + bullet（每次 node build.js 之后都要跑）
python scripts/contact_sheet.py deck.manifest.yaml --qa _qa      # 1 拼图，看整体色温 / 明度 / 镜头语言
python scripts/render_deck.py deck.pptx                          # 2 渲染 _qa/render/NN.png
python scripts/validate_design.py deck.pptx deck.manifest.yaml  # 3 机器校验
```

1. **contact sheet**：按 `10` 第 6 步看整体，不统一的图换掉再重跑。
2. **渲染自查**：用 Read 逐页看 `_qa/render/NN.png`，对每页做 `13` 的单页感知测试，对整套做 Flip / Silhouette / Anchor 测试。交付前每页都要看过，并且**每页写一行判定**（一秒测试看到的是不是 focus.object、第二大的字是什么、message 里的关键词各是几号字、有没有元素可删），附在交付报告里；只写"都看过"不算做过。发现问题先改页面再重跑校验，不带着问题交付。
3. **机器校验**：任一 M 失败 → 按 `_qa/validate.json` 里的声明值与反算值改 manifest 或代码，重新生成、重新渲染、重跑校验，直到通过。W 只汇总，不改阈值。
4. 三项都过 → 交付 `deck.pptx`，并把 W 警告与图片致谢一起告知用户。

## 不做的事

- 不从风格库里挑模板往内容里套；方向由 Step 1 的答案倒推。
- 不取搜索结果第一张图；不用生图模型替代图库；不抓网页图。
- 不为了塞内容缩字号、缩间距；超 480 字拆页。也不为了填页面放大间距：g 超上限时放大元素，不放大空隙。
- 不改 `thresholds.yaml` 来让校验通过。
- 不为了凑「主元素」放大一个数字、造一个标题：第一层级是论述对象，内容里没有就不造。
- 商务 deck 的封面 / 目录不用海岛、沙滩风景，不从品牌名字面联想配图：先找行业 / 产品的使用场景图，找不到用高楼 / 城市天际线（`09`、`11`）。
- 不自创配图方式：图片只按 `11` 的 1–7 摆，方式 5 / 6 必须满页高贴边。
