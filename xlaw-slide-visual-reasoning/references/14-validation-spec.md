## 14-validation-spec.md

validate_design.py 的实现规格。13 的机器清单是索引，这里是每一项的输入、算法、阈值。所有数值阈值集中在 `thresholds.yaml`，代码不写死。

层级模型（2026-09-20 第五轮）：不再有「每页恰一个主元素、≥ 3 × 正文」。第一层级 = 本页论述对象，可以是一组（0–4 个 `hero:*`，或一组 `heading`、一张图表 / 表格、一条时间线）；manifest 用 `focus` 声明。校验的是层级完整性（C-03，[W]）与同组一致（C-01，[M]），不是「最大的那个够不够大」。

留白模型（2026-09-17 第三轮，尺度优先）：留白不是输入，是内容按密度档放大到位之后的剩余。页面不再声明留白位置与比例；校验的是尺度（S-01）、间距（S-02）、内容块位置（S-03）、容器贴内容（S-04）、无洞（S-05）、对齐线（S-06）。生成端由 `scripts/layout.py` 的尺度循环算出全部坐标（§4c）。

## 0. 文件约定

生成一套 deck 产出以下文件，校验器全部读取：

```
deck.pptx
deck.manifest.yaml        # deck 级 + 逐页 manifest（§1）
_qa/candidates/NN.json    # 第 NN 页的图片候选记录（§6）
_qa/candidates/NN/*.jpg   # 该页下载过的缩略图
_qa/contact_sheet.png     # 全部选中图拼图
_qa/layout/NN.json        # layout.py 的输出（生成端产物，校验器不读）
thresholds.yaml           # 阈值，缺省用本文件 §8 的默认值
```

单位：pt。python-pptx 的 EMU / 12700 = pt。页面尺寸从 pptx 读，不假设。

## 1. manifest schema

### 1.1 deck 级（锁定层）

```yaml
deck:
  page: {w: 960, h: 540}                 # 从 pptx 读出后回填，校验时比对
  margins: {l: 48, r: 48, t: 40, b: 40}  # 版心
  title_anchor: {x: 48, y: 40, tol: 2}   # 基准锚点，内容页 title 左上角
  pagenum_anchor: {x: 880, y: 508, tol: 2}   # 右下；≤ 20 页的 deck 不放页码（C-16）
  type_scale: [10.5, 12, 14, 16, 18, 20, 24, 28, 32, 36, 40, 48, 54, 60, 72]   # 允许出现的字号集合（tol 0.5），必须含 09 的封面 / 章节 / 副标题字号，且每个密度档（S-01）的正文起始值与各层级（01 字号分级）在其中都有可取的值
  title_size: {min: 28, max: 40}         # 内容页 title；必须单行（C-13）
  min_size: 10.5
  fonts: [Source Han Sans CN, Noto Sans SC, Avenir Next]   # 允许出现的全部 typeface（中文 + 英文）；macOS 中文首选 Source Han Sans，PingFang 放最后（11 字体系统）
  fonts_latin: [Avenir Next]             # 英文字体：含数字或拉丁字符的 run，latin typeface 必须在此列（C-13）
  palette:                               # 允许出现的颜色（hex，大写，无 #）
    accent: [1F4FD8]
    secondary: [0B1F3A, 16305C]
    tertiary: [EEF2F7, F6F8FB]
    accent_light: [9CC2FF]               # 与 accent 同色系的浅亮色，深色背景上的高亮
    data_muted: [8A9AB5]                 # 与 accent 同色系的低饱和灰度色，图表论据序列 / 目录序号
    neutral: [000000, FFFFFF, 333333, 7A7A7A]
  accent_max_chars: 20
  shape_language: {corner: {small: full, medium: 12, large: 0}, stroke: 0.75}   # 记录用；小 = 圆形 / 胶囊，中 = 圆角矩形，大 = 直角
  tone: argument            # argument / statement / vision
```

不再有 `grid`（12 列栅格已删，列宽自由，见 S-06）与 `spacing_floor`（区级间距 = 3g，见 S-02）。

### 1.2 页级

```yaml
pages:
  - page: 1
    type: cover                          # cover / agenda / section / content / closing / statement（quote 为旧名，等价）
  - page: 5
    type: content
    message: 真正出得去的是极少数
    pattern: mapping
    focus:                               # 第一层级：先写 object（这一页在讲谁），再选 form
      object: 三个方案
      form: headings                     # numbers / headings / chart / table / timeline / image / statement
      count: 3                           # 第一层级元素个数 0–4；chart / table / timeline / image 填 1
    density: medium                      # light / medium / heavy；决定本页正文起始字号（S-01）
    container: none                      # none / divider / fill / stroke
    columns: "1:2"                       # 列数与列比，从左到右，如 "1"、"2:1"、"1:1:1"；C-20 变化层五项之一
    g: 18                                # 本页间距单位，由 layout.py 算出并写入（--write-g），校验器读它不猜
    source_chars: 240                    # 原稿分配给本页的汉字当量（C-04 口径），C-37 用
    contrast: strong                     # strong / restrained
    title_pos: base                      # base / mask-edge / below-image / right-of-image / image-center
    subtitle: true                       # 有无 kicker
    conclusion: false                    # 有无结论行
    series: null                         # 系列 id，同一系列填同一字符串
    visual_side: right                   # left / right / full / none：无图页的图表 / 表格 / 区域背景所在侧；有图页以 image.side 为准（C-27）
    chart: {focus_series: 越南}          # 有图表时：论证对象序列（accent），其余序列用 data_muted（07，渲染自查）
    image:                               # 有图时必填，多图用列表
      role: semantic                     # semantic / atmosphere / full-bleed / small
      layout: 6                          # 11 配图方式 1–7
      side: left                         # left / right / top / bottom / full
      source: pexels                     # pexels / unsplash / pixabay / user；user = 用户自有图片，跳过 C-30，其余字段仍必填，备注写「用户提供」
      id: "1234567"
      photographer: Jane Doe
      url: https://...
      query: aerial coastal port cool tones
      candidates_viewed: 12
      reason: 负空间在右侧；冷色，无人物
```

`columns` 是声明值（与 pattern 一样只参与 C-20），格式 `\d+(:\d+)*`，不做几何反算。`g` 是 layout.py 的输出，不是人写的；`source_chars` 在写页级 manifest 时按原稿分页统计。字段缺失、枚举值非法 → 整套不合格，不进入几何校验。

`statement` 页（旧名 `quote`）：只有一句话的页（含引言），不带内容页标题，按 §3.5 作特殊页处理；那句话标 `hero:big-label`，原稿里有实义的标题降为辅助行（`kicker`），出处行 `body`。`focus.form` 对 statement 页不必填。

`agenda` 页的 `image` 字段与内容页同格式（配图方式 5 或 6）。

## 2. 校验流程

```
1  schema        manifest 结构与枚举               失败即停
2  roles         形状角色（roles.py）               失败即停（本页）
3  geometry      逐页几何（§4）
4  deck          deck 级节奏与变化（§5）
5  images        图片记录与一致性（§6）
6  crosscheck    manifest 声明 vs 几何反算（§7）
7  composite     模板复制感综合（§5.6）
```

每项输出 `{page, check, level, message, values}`。任一 M 失败 → exit 1。W 只汇总。
生成端：布局由 `scripts/layout.py` 的尺度循环（§4c）算出，`build.js` 不手写内容元素坐标（见 SKILL.md Step 3）。

## 3. 几何基础定义

### 3.1 形状集合

用 roles.py 的 `classify_slide` 得到角色字典。定义三个集合：

- **excluded**：bg、panel:region、mask、image:full-bleed、pagenum。不参与间距、元素数、内容块、对齐线（image:atmosphere 在 foreground 内，但不计元素数）
- **foreground**：其余全部
- **countable**：foreground 减 title、kicker、conclusion、source、arrow、deco。用于元素数
- **正文文本**：countable 里角色为 body 的文本（以及 card 内的 body）。正文字号 = 其 run 按字符数加权的众数；hero / heading / label / legend / tag / conclusion 不参与众数
- **content**：foreground 减 title、kicker（pagenum 已在 excluded）。内容块 = content 的墨迹框并集框（S-03 / S-05）
- **容器**：card:N、panel（不含 panel:region）。形状框被某容器完全包含（tol 2pt）的形状是该容器的**子项**；不被任何容器包含的 foreground 形状（含容器本身）是**顶层形状**

### 3.2 区域

- 版心 = 页面减 margins
- 标题区 = 从版心顶到 max(title.bottom, kicker.bottom)（墨迹框）
- body 区 B = 版心减标题区再减 3g（title 下沿到 B.top 恰为 3g，见 C-09；g 见 S-02）；页面无 title（特殊页）时 B = 版心

### 3.3 文字墨迹框（ink box）

pptx 文本框的外接矩形通常大于文字。间距、内容块、容器、洞的计算用墨迹框；锚点与对齐线（C-02 / C-16 / S-06）用形状框。

```
for 每个文本形状:
  inner_w = shape.w − 左右内边距（默认 7.2pt×2，从 bodyPr 读到则用实际值）
  对每个段落:
    行宽估算 = Σ 字宽；字宽 = CJK: size×1.0；拉丁字母数字: size×0.55；空格: size×0.3；run 有字间距（rPr spc，百分之一 pt）时每字再加 spc / 100
    行数 = ceil(行宽 / inner_w)，空段落算 1 行
    行高 = size × 行距倍数（段落 lnSpc，缺省 1.2）
  ink_h = Σ 行高 + 段前段后
  ink_w = min(inner_w, 最长行宽)
  水平锚定：按段落对齐（left / center / right）在 inner 区内摆放
  垂直锚定：按 bodyPr anchor（缺省 top）
```

非文本形状墨迹框 = 形状框。表格墨迹框 = 表格框。

### 3.4 相邻间距与 g

```
对每个 foreground 形状 a，在与 a 同一层（同一容器的子项之间；顶层形状之间）的形状 b 里找：
  正下方最近邻：水平投影重叠 ≥ 30%（以较窄者计）且 b.top ≥ a.bottom，取 b.top − a.bottom 最小者 → 竖向间距
  正右方最近邻：竖向投影重叠 ≥ 30%（墨迹框）且 b.box.left ≥ a.box.right，取 b.box.left − a.box.right 最小者 → 横向间距（用形状框：文本框宽即列宽，墨迹右沿随对齐与行长变化，不是分栏的边；a 与 b 之间若隔着同层的另一个形状，不算相邻）
  丢弃一方形状框完全包含另一方的对
  以元素为单位（§3.4b）。上下相邻按形状框的水平投影判（文本框宽即列宽），距离按墨迹框量
  行到行：a 所在的行（同层、同一区域背景范围内、横向不重叠，且顶沿 / 垂直中心对齐 ±2pt 或竖向墨迹重叠 ≥ 30% 的元素）的最低下沿 → b 所在行的最高上沿；算出来为负（偶然对齐的独立列）时退回两两距离；S-02 里两两距离与行到行距离只要有一个落在档上就算合格（并排格子里各自叠放的内容按两两距离，整行对齐的按行到行）
  从 panel:region 外走到区域内：量到区域内全部元素的最高上沿
  横向：两者之间隔着同层的另一个形状、或隔着一整列（本行在那一列是空位）时不算相邻；只含 tag 或只含 icon 的元素不参与横向判定（小容器按文字收宽、icon 按自身尺寸，都比所在的格子窄）；
        n ≥ 3 的并列组里隔着空位的两项，间距扣掉整数个节距再判
竖向间距用墨迹框。间距集合 = 所有最近邻间距。g 不由集合反算：它是 layout.py 算出并写进页级 manifest 的值，校验器读 manifest.g。
title / kicker 到 body 元素的间距不参与 S-02 的 {g, 2g, 3g} 判定：它由 C-09（≥ 3g − e）单独判定。title 与 kicker 之间的间距照常参与。
```

### 3.4b 紧贴对与并列组

- **紧贴对**：以下角色对在同一层、竖向投影重叠 ≥ 30% 且墨迹横向间距 ≤ 0.8g（`tag` 与 `card` 为形状框相交，`tag` 与 `arrow` 为上下紧贴）时，合并成一个**元素**：数字 + 释义（hero, label）、数字 + 箭头（hero, arrow）、icon + 要点（icon, body \| heading）、色块 + 序列名（legend, legend）、胶囊 / 圆形标题 + 框或文字（tag, card \| body \| heading）、说明容器 + 指示箭头（tag, arrow）。§3.4 的间距、S-05 的洞、S-06 的对齐线都以元素为单位：元素墨迹框 = 成员墨迹框并集，元素内部的间距不进 S-02
- **并列组**：同层、成员角色相同、顶沿或垂直中心对齐（±2pt）的横排元素，n ≥ 3 且等距（相邻左沿差是最小差的整数倍 ±4pt，允许空位）或 n = 2 且等宽 → 整组在 S-06 里只按首项左沿、末项右沿各计一条对齐线
- `panel:region` 内的元素在 S-06 里以该区域为一个独立范围另算 ≤ 3

### 3.5 页类型豁免

| 页类型 | 参与的检查 |
|---|---|
| content | 全部（含 C-37） |
| cover / agenda / section / closing / statement | 仅 roles、字体、颜色、字号下限、title 字间距；statement / section 另按 light 计入 C-22 的节奏序列；title 按 09 规则（cover / section 居中：\|center_x − page_cx\| ≤ 4pt，字号 45–64）；不计入节奏、变化、尺度、间距、容器、层级 |

- C-29 agenda [W]：manifest 有 `image` 且 layout ∈ {5, 6}（形状按 §7 反算）；条目文字（body / heading）最大字号 ≥ 20
- C-28 statement [W]：`hero:big-label` 的字号按句子长度（汉字当量，标点不计）落在阶梯内：≤ 7 → 72；8–14 → 60；15–24 → 48–54；25–40 → 40；> 40 → 改要点页。兜底：hero 墨迹框宽 ∈ [45%, 60%] 页宽、高 ∈ [20%, 35%] 页高，中心与页面中心差 ≤ 5% 页宽 / 页高
- statement 页不得有 `title` 为元标签；有实义的原标题用 `kicker`

## 4. 逐页几何检查

### C-01 角色标记 [M]
roles.py。内容页恰一个 title；`hero:*` 0–4 个。同页多个 `hero:*` 时限定词必须相同，且各自最大 run 的字号、字重（bold）、颜色必须一致。`panel:region` 每页 ≤ 1，且不与 `card:N` 同页（中 + 大容器不同页）。

manifest.focus 与形状核对（§7）：form = numbers → `hero:big-number` 数 = count；headings → `heading` 数 ≥ count；chart / table / image → 恰一个对应的 `hero:chart` / `hero:table` / `hero:image`；timeline → 无 `hero:big-number`，有 ≥ 1 个 `arrow` 与 ≥ 3 个 `tag`；statement 只用于 statement 页。

### C-02 标题锚点 [M]
基准：`deck.title_anchor`。按 `title_pos` 求期望位置，比 title 形状框：

| title_pos | 期望 | 判定 |
|---|---|---|
| base | 左上角 = anchor | \|dx\|,\|dy\| ≤ tol |
| below-image | y = image.bottom + 3g；x = anchor.x | 同上 |
| right-of-image | x = image.right + 3g；y = anchor.y | 同上 |
| mask-edge | title 水平中心 = mask.right（遮罩靠左）或 mask.left（遮罩靠右）；垂直中心 = mask 垂直中心（遮罩满高时即页面垂直中心） | \|dcx\| ≤ 5% 页宽；\|dcy\| ≤ 4pt |
| image-center | title 中心 = image 中心 | \|dcx\|,\|dcy\| ≤ 10% 图宽 / 图高 |

`title_pos` 与 `image.layout / side` 的合法组合：1 / 2 / 7 → base；3 → mask-edge；4 top → below-image，4 bottom → base；5 left → right-of-image，5 right → base；6 left → right-of-image \| image-center，6 right → base \| image-center。不合法组合 → 失败。

### C-03 层级完整性 [W]
- 正文字号 = 本页正文文本（§3.1）run 按字符数加权的众数；本页无正文文本时取 deck 级正文字号
- 有 `hero:big-number` 必有 `label` 或 `heading`（Lonely Giant Number）
- 最大字号（title 除外）/ 正文字号 ≤ 3.5
- 存在 `heading` 时，每个 heading 的最大 run 字号 ≥ 1.25 × 正文字号
- `hero:big-number` 的最大 run 为粗体，字号 ≤ 54（内容页上限）
- hero:chart / table / image：形状框面积 ≥ 30% body 区面积的要求只保留给 table / image；hero:image 的形状角色必须是 image:semantic [M]

已删除：「hero 字号 ≥ 3 × 正文」「隐性第二主元素」「hero = void」。

### C-04 密度分档 [M]
- 汉字当量 = CJK 字符数 + 2 × 英文词数（`[A-Za-z0-9][A-Za-z0-9'\-]*`），标点与空白不计。计数范围：foreground 文本减 title、pagenum、source；表格单元格计入
- 元素数 = 含 countable 形状的元素数（§3.4b：紧贴对合并成一个元素），其中 table 计 1 + 行数 / 4
  - 并列组（§3.4b 的几何判定：同层、同角色、同上沿 / 中线、等间距，n ≥ 3）按 1 + n / 4 计，与 table 一致
  - 作为要点符号或某个条目配图的 icon 与该条目合计 1 个，不单独计数：紧贴对已合并；单独成元素的 icon 只要与某个非 icon 的计数元素同行或同列（形状框投影重叠 ≥ 30%）就归它
- 字数档：≤ 120 轻，121–300 中，301–480 重，> 480 失败（拆页）
- 元素档：≤ 8 轻，9–20 中，> 20 重
- 本页档 = 两者中较重者。与 manifest.density 不符 → 失败（§7）

### C-05（已删除）
留白比例目标删除：留白是尺度放大到位后的剩余，不设目标值。

### C-06（已删除）

### C-07（已删除）
四级间距簇删除，由 S-02 取代。

### C-08（已删除）

### C-09 标题区下方 [M]
title / kicker 下沿（墨迹）到 body 第一个元素（content 墨迹框并集的上沿）≥ 3g − e（e = 1.2g）。只有下限：内容块居中时上方残余可以任意大。

### C-10 容器样式 [M]
- 分类：card 有 line 且 fill 为空或等于页面底色 → stroke；card 或 panel 有 fill ≠ 底色 → fill；divider → divider；tag 不计
- 选中态：恰一张 card 为 fill 且 ≥ 2 张为 stroke 时，本页容器样式判为 stroke（选中态是描边风格的一个状态，不是第二种样式），manifest.container 填 stroke；多于一张 fill 则按原规则算两种样式
- 本页容器样式集合大小 ≤ 1
- 卡片数 = card:N 数量；出现时 2 ≤ n ≤ 6（2 只用于对比 / 优劣）
- 全部 card 都是 fill（方案 / 选项卡：推荐项 tertiary，其余中性浅灰）记为 fill，一种样式
- `panel:region` 与 `tag` 不计入容器样式
- 描边框允许条件 [W]：card 数 ≥ 3 且每张 card 内 body 文本 ≥ 2 行；或恰一张 card 为 fill、其余为 stroke（选中态）；或恰两张 stroke 且描边颜色不同（对比双框）

### C-10b 区域背景 [M]
`panel:region`：形状框四边中至少三边贴住页面边缘（±1pt）；每页 ≤ 1；fill ∈ palette.tertiary ∪ palette.secondary；不与 `card:N` 同页。

### C-11 副标题 / 结论行 [M]
kicker、conclusion 的存在与 manifest.subtitle / conclusion 一致。不重复大标题：conclusion、heading、hero:big-label 任一文本与 title 文本 Jaccard（按字符 2-gram）≥ 0.6 → 失败（Title Echo）。

元标签 [M]：title / kicker 去掉标点后恰为元标签词表中的词（结论先行、核心观点、核心结论、背景、小结、总结、概述）→ 失败。

### C-12（已删除）
12 列栅格删除，由 S-06 对齐线取代；列宽自由。

### C-13 字体与字号 [M]
- 所有 run 字体 ∈ deck.fonts（按前缀匹配：`Source Han Sans CN Medium` 属于 `Source Han Sans CN`）；字号 ∈ type_scale（tol 0.5）；min ≥ min_size
- 内容页 title 最大 run 字号 ∈ [title_size.min, title_size.max]（28–40），且按 §3.3 估算为单行
- 本页不同字号数 ≤ 5，不计 title / source / pagenum
- title 字间距：所有页类型的 title，含 CJK 的 run 的 spc / 100 / 字号 ∈ [0.06, 0.12]（生成端：内容页 7.5%，封面 / 章节 / 目录 10%）
- 小标题级不用大标题同款粗体 [W]：`heading` / `conclusion` 的含 CJK run 为 bold 或字体名以 Bold / Heavy 结尾 → 警告（正文里除数字与个别关键词外不用 Bold；一句话页除外）
- 英文字体：含数字或拉丁字母的 run，`a:latin` typeface 必须属于 deck.fonts_latin（pptxgenjs 会把 latin 写成中文字体，生成后必须跑 `scripts/postfix.py`）
- `hero:big-number` 的最大 run 必须是粗体

### C-14 颜色 [M]
所有文字色、fill、line 的 hex ∈ palette 全集（mask 的颜色也须在 palette 内，透明度不限）。accent 色的连续 run 汉字当量 > accent_max_chars → 失败。

### C-15 图上文字对比度 [M]
对每个文本形状 T，若其形状框与任一 image 形状框相交：
```
region = 该 image 的像素中对应 T 形状框的裁剪（按 image 形状框到像素的线性映射；pptxgenjs 用 sizing 时先按 cover 映射）
若存在 mask 覆盖该区域：像素 = mask_color × α + 像素 × (1 − α)
bg_L = region 相对亮度的第 80 百分位（文字为浅色）或第 20 百分位（文字为深色）
contrast = (L1 + 0.05) / (L2 + 0.05)
阈值：run 字号 < 18pt（或 < 14pt bold）→ ≥ 4.5；否则 ≥ 3.0
```

### C-16 页码锚点 [M]
pagenum 可无（≤ 20 页的 deck 不放页码）；有则形状左上角与 `pagenum_anchor` 差 ≤ tol，且锚点在页面右下象限。全 deck > 20 页而内容页无页码 → [W]。

### C-17（已删除）

### C-18（已删除）
第一层级不再固定压在左上。

### C-19（已删除）

## 4b. 尺度检查

### S-01 尺度随密度 [M]
密度档只定正文起始值，只取 type_scale 里的值：

| 档 | 正文字号 ≥ | 大数字 ≤ | title |
|---|---|---|---|
| 轻 | 18 | 54 | 36–40 |
| 中 | 16 | 54 | 36–40 |
| 重 | 14 | 54 | 28–32 |

- 正文字号按 C-03 的定义取；本页无正文文本时不查
- title 字号按档 [W]；title 总区间 28–40 由 C-13 [M] 管
- hero 为 table / image 时形状框高度 ≥ 80% body 高；图表不查（小型图表只占半个版心，07）

已删除：hero_min（72 / 48）、body_max（14 / 12）、「图表作主元素时高度 ≥ 80% body 高」。

### S-02 间距按剩余空间算，有上下限 [M]
g = 本页的间距单位，由 layout.py 按剩余空间算出并写进 manifest.g（§3.4）。要求 0.5 × 正文字号 ≤ g ≤ 1.5 × 正文字号（本页无正文文本时，正文字号取该密度档的下限）。页内所有间距（§3.4 的间距集合；title / kicker 到 body 的那一段由 C-09 判定，不在此列）必须落在 {g, 2g, 3g} 的 ±20% 内：元素 / 组 / 区三级只保留比例，不保留数值。所有横向间距（分栏间距、同行卡片之间）= 2g 或 3g。g 超上限说明内容太小、在撑开，应该放大元素而不是放大间距；g 低于下限说明内容超载，拆页或降密度档。

### S-03 内容块位置 [M]
content bbox = content 集合（foreground 减 title / kicker / pagenum）的墨迹框并集框，e = 1.2g。

- 横向：左沿 = 版心左 ± e，右沿 = 版心右 ± e。宽度必须填满，任何页都不例外
- `panel:region` 不进内容块；它里面的内容照常属于内容块，在贴边一侧仍守版心边距。区域背景贴住左 / 右页边时，那一侧视为已填满（窄长区域里的文字与图要收窄居中，不必撑到版心边）
- 竖向：上沿 = body.top ± e 且下沿 = body.bottom ± e（填满），或上下残余相等（\|d_top − d_bottom\| ≤ e，居中；残余大小不限）。顶对齐留底、底对齐留顶都不合格
- 引言页若要底部对齐，页类型改 `quote`，不带内容页标题，走 09 与 §3.5 的规则

信息里给四边差值与中心差。C-26 第 5 项的「填满」= 右沿差与下沿差都 ≤ e。

### S-04 容器贴内容 [M]
对每个 card / panel：内部内容框 = 其子项墨迹框并集框；要求内部内容框 = 容器框内缩 p ± e，四边都要满足。p 由该容器四边内缩的最小值反算；同页所有容器的 p 相同（±e），且 p ∈ [g, 3g]。容器高度由内容决定（= 内容 + 2p），或内容撑满容器；容器框内栅格化（行带口径：每个子项置 1 的范围 = 容器框的 x 范围 × 子项墨迹框的 y 范围），最大空矩形短边 ≤ 2p。没有子项的容器 → 失败。

### S-05 无洞 [M]
行带口径（2026-09-20 裁决）：洞只有两种——行与行之间的空、列内上下的残余；左对齐短元素右侧的参差、居中小容器两侧的空不算洞。

在 content bbox 内按 4pt 网格栅格化：顶层形状按形状框 x 投影重叠 ≥ 30%（以较窄者计）传递聚类成列；每个顶层元素（§3.4b）置 1 的范围 = 它所在列的 x 范围 × 它自己墨迹框的 y 范围；相邻列之间的整条竖带（分栏间距区域）置 1；容器框整体置 1（容器内部由 S-04 管）；n ≥ 3 的并列组并集框整体置 1（时间线上没有事件的刻度是空位，不是洞）；顶沿或垂直中心对齐的横排元素（行，如「小标题 | icon | 要点」）的并集框整体置 1（行高由最高的那格决定）。最大空矩形短边 ≤ 3g。比内容块矮的列在列内居中留下的上下残余仍受此约束。

### S-06 对齐线 [M]
用形状框，以元素为单位（§3.4b：紧贴对合并，并列组只计首项左沿 / 末项右沿）。顶层元素（减 arrow / divider / tag）的左沿聚类成 ≤ 3 个 x 值（±2pt），右沿 ≤ 3 个；title 左沿必须是左沿值之一。每个容器的子项、每个 `panel:region` 内的元素各自另算，左沿 ≤ 3、右沿 ≤ 3。居中叠放的一组（同一条中轴线 ±2pt、宽度不一）只按其中最宽者计一条对齐线。列宽自由，不再落 12 列。

### S-07 图表填满形状框（生成端，无校验）
pptxgenjs 图表设最小内边距：`plotArea` 铺满、legend 放图内右上或紧贴横轴、不留标题区（`showTitle: false`）；图表形状框高度按 S-01 给足（≥ 80% body 高）。校验器看不到图表墨迹，这条靠渲染自查（13）。

## 4c. layout.py 尺度循环（生成端）

输入：页级 manifest（density、columns、source_chars）、元素树（每列一个竖向栈；节点 text / icon / tag / image / chart / table / pair / row / stack / card / timeline，见 `scripts/layout.py` 顶部说明）。输出：每个元素的框与字号（正文 / 小标题级 / 数字释义 / 大数字 / title 五个字号）、g、p，以及派生形状的框（card、压角 tag、时间线轴线与节点、说明容器、区域背景）。

- title 字号由 layout 定：该档区间（S-01）内墨迹宽 ≤ 84% 标题宽的最大值（含 7.5% 字间距）；标题过长（占了大半页宽）就继续往下缩，可低于该档区间，不低于 title_size.min。S-01 的 title 按档 [W] 对这种长标题豁免
- 正文放大上限按字数档取（`scale.bands.*.body_cap`）：元素多但字少的页（如时间线）按元素数落在重档，正文仍可放大
- 紧贴对（pair）：左项取自身墨迹宽，间距 0.35 × 正文（< 0.8 g_min，校验器一定合并成一个元素）
- row：格间距 2g / 3g；`balance` 调各格宽度让自然高度相等（容器大小由内容决定，横排只对齐高度）
- 配图方式 5 / 6 的边图列满页高贴边，不再随内容块高

1. 列由 `columns` 定，列宽合计 + 分栏间距（2g 或 3g）= 版心宽（S-03 横向必然满足）
2. 元素以 S-01 该档的正文起始值算墨迹高（inkbox）；heading / label 起始 = 1.4 × 正文、大数字起始 = 2.5 × 正文，取 type_scale 里最近的值，每列 leftover = body.h − Σ 墨迹高 − 容器内缩
3. g = leftover / 间距权重和（元素 1、组 2、区 3）；多列时取无伸缩元素的列里最小的 g；整页只有伸缩列（一张表 / 一张图）时没有内容在约束 g，取 g = 1 × 正文字号，把高度让给伸缩元素
4. g > 1.5 × 正文字号 → 放大，顺序：正文升一档（不违反 C-36 的 4 行）→ 小标题级（heading / label，不超过 1.8 × 正文）→ 大数字（不超过 3.2 × 正文与 54）→ 可伸缩元素（图表 / 表格行高 / 图片）加高吸收 → 回到 2。大数字永远最后升
5. g < 0.5 × 正文字号 → 内容超载：拆页或降密度档，不缩字号；layout.py 返回失败
6. 内容块高 = 最高的无伸缩列（全是伸缩列时 = body 高），伸缩列（图 / 表 / 图表）撑到内容块高；到字号上限仍有剩余 → 整个内容块在 body 内垂直居中，残余大小不限，不加字。比内容块矮的列在列内居中，这段残余在内容块内、受 S-05（≤ 3g）约束，超出即 layout.py 失败：调列比或改结构，不加字
7. 容器高度 = 内部内容 + 2p，p 同页统一（默认 2g）
8. hero:big-number 折行 → 缩一档（不低于 2.5 × 正文），仍折行则加宽列（改 columns），不换内容；数字宽度按安全系数（`scale.nowrap_safety`）估，渲染字体的数字比估算宽
9. 算出的 g 用 `--write-g` 写进 deck.manifest.yaml 该页条目，校验器读它
10. 行距写成固定 pt（1.2 × 字号，pptxgenjs `lineSpacing`），不用倍数：倍数是相对字体自带行高（PingFang ≈ 1.22em）的，渲染出来约 1.46 × 字号，多行大字会压到下一个元素，墨迹估算也对不上

## 5. deck 级检查（仅 content 页序列，序列按页码，跳过特殊页后相邻即视为相邻）

### C-20 变化层 [M]
- 相邻页 pattern / focus.form / density / container / columns 五项至少两项不同；两页同属一个 series 时豁免
- 任意连续 5 页同 pattern ≤ 2（series 豁免）
- 相邻页都有 card 时数量不同

已删除：「相邻页 hero 类型不同」。

### C-21 系列页 [W]
series 非空的页合计 ≤ 40% 内容页。

### C-22 密度节奏 [M/W]
节奏序列：content 页按 manifest.density；statement / section 页按 light 计入（它们的其它豁免不变）；cover / agenda / closing 不计。滑动窗口类检查里，一组连续的 series 页算 1 页（取其中最重的档）；占比按逐页序列算，series 不合并。

- 连续 3 页都为 heavy → M（窗口）
- 连续 3 页同档（任意档）→ W（窗口）
- heavy 占比 ≤ 40% → M（逐页）
- 每个 heavy 页之后 2 页内出现 light 或 medium → M（窗口）
- 前 3 页含 light、末 2 页含 light → W（窗口）

### C-23 副标题 / 结论行占比 [M]
subtitle=true 的页 ≤ 60% 且不连续 4 页；conclusion=true 连续 ≤ 2 且 ≤ 50%。

### C-24 容器占比 [M]
容器样式集合为空的页 ≥ 1/3。

### C-25（已删除）

### C-27 左右交替 [W]
相邻内容页（series 豁免）的视觉元素所在侧：有图页取 image.side，无图页取 manifest.visual_side；两页都 ∈ {left, right} 且相同 → 警告。

### 5.6 C-26 模板复制感综合 [M]
以下六项命中 ≥ 3 → 整套失败：
1. ≥ 80% 页密度同档
2. ≥ 80% 页 subtitle 与 conclusion 同时为 true
3. ≥ 80% 页容器样式相同（含"都为空"）
4. ≥ 50% 页层级完整性（C-03）失败
5. ≥ 80% 页内容块右沿差与下沿差都 ≤ e（S-03：竖向填满而非居中）
6. 任一 pattern 占比 ≥ 40%

## 6. 图片检查

### 6.1 候选记录格式 `_qa/candidates/NN.json`
```json
{"page": 5, "queries": ["aerial coastal port cool tones", "..."],
 "candidates": [
   {"source": "pexels", "id": "1234567", "url": "...", "thumb": "_qa/candidates/05/1234567.jpg",
    "viewed": true, "score": 4, "note": "负空间右侧，冷色"} ]}
```

### C-30 选图记录 [M]
每个有 image 的内容页：
- 候选文件存在；`viewed: true` 的条目数 ≥ 8，且等于 manifest.candidates_viewed
- manifest.image.id ∈ 候选 id 集合
- reason 长度 ≥ 8 字
- 该页备注（notes_slide）文本包含 source 与 photographer
- 缩略图文件存在且尺寸 ≤ 640px 长边（证明是缩略图而非原图）

### C-31 contact sheet [M]
`_qa/contact_sheet.png` 存在，修改时间 ≥ 所有选中图文件的修改时间，尺寸能容纳全部选中图（≥ n 格）。

### C-32 相邻页构图 [M]
相邻内容页的 image（同角色）：id 不同，且 pHash（64 位）汉明距离 ≥ 12。

### C-33 摄影一致性 [W]
仅 source 为图库的摄影图：每图算 mean(R − B)（色温代理）与 Lab L 均值；任一指标 z-score 绝对值 > 1.5 → 警告并点名该页。

### C-37 字数锁定 [M]
本页正文汉字当量（C-04 口径：foreground 文本减 title / pagenum / source，表格计入）≤ 1.1 × manifest.source_chars。排版不得改内容：填不满就居中，不加字；hero 文字折行时缩一档或加宽列，不换文案。

### C-34 分辨率 [M]
image:full-bleed 原图宽 ≥ 1920px；其它角色原图宽 ≥ 2 × 形状框宽（pt）× 96 / 72。

### C-35 图片不变形 [M]
每个 picture：无 crop（srcRect 全零）时 |形状宽高比 − 像素宽高比| / 像素宽高比 ≤ 2%；有 crop 时像素框先按 srcRect 裁剪再算。生成端硬规则：每个 addImage 必须带 `sizing: {type: 'cover', w, h}`，禁止靠 w / h 直接拉伸；pptxgenjs 把 `w / h` 当作图片自身尺寸来算裁剪，`w / h` 须按像素宽高比给，`sizing.w / h` 才是框。

### C-36 段落上限 [M]
foreground 文本形状（title、pagenum、source、表格除外）：单个段落 ≤ 100 汉字当量且 ≤ 4 行（行数按 §3.3 估算）；单个文本框 ≤ 200 汉字当量。超出必须拆成多个 body 或改结构。

## 7. manifest 与几何交叉核对 [M]

| manifest 字段 | 反算来源 |
|---|---|
| type | 页码 1 = cover 允许；其余以 manifest 为准，但 section 页不得有 hero、body ≥ 3 |
| density | C-04 |
| focus.form / count | C-01 的 focus 核对 |
| container | C-10 集合（空 → none） |
| subtitle / conclusion | kicker / conclusion 形状存在性 |
| title_pos | C-02 合法组合 |
| image.role / layout / side | image 形状角色；layout 由形状框比例判定（full ≈ 页面；67% 高 → 4；22–30% 宽 → 5；50% 宽 → 6，5 / 6 必须满页高（≥ 页高 − 1pt）并贴住页面上、下和一侧边缘，否则不匹配任何配图方式（Floating Image）；image:small（一张或多张）→ 7；full + 74% 宽 mask → 3；full + 全页 mask → 1 / 2 按 mask 明度）；side 由形状框贴边判定 |

任一不符 → 失败，信息里同时给出声明值与反算值。`columns` 与 `pattern` 一样是声明值，不反算。

## 8. thresholds.yaml 默认值

```yaml
raster_cell: 4
ink: {cjk: 1.0, latin: 0.55, space: 0.3, line_spacing: 1.2, inset: 7.2}   # run 有字间距（spc）时每字再加 spc/100 pt
density: {light_chars: 120, medium_chars: 300, max_chars: 480,
          light_elems: 8, medium_elems: 20, void_hero_chars: 80}
hero: {area_frac: 0.30}                          # 只对 hero:table / hero:image 生效（font_mult 3.0 已删，第五轮）
# ---- 层级（01 Visual Hierarchy / 14 C-01、C-03；第五轮，数值类先记 W）
hierarchy:
  max_heroes: 4                                   # 每页 hero:* 0–4 个
  max_ratio: 3.5                                  # 最大字号（title 除外）/ 正文 ≤ 3.5
  heading_min_mult: 1.25                          # heading 字号 ≥ 1.25 × 正文
  heading_mult: [1.4, 1.8]                        # 生成端：小标题级 1.4–1.8 b
  label_mult: [1.1, 1.8]                          # 生成端：数字释义 1.1–1.8 b
  number_mult: [2.5, 3.2]                         # 生成端：大数字 2.5–3.2 b
  number_max: 54                                  # 内容页大数字上限
  echo_jaccard: 0.6                               # C-11：小标题级以上文字与 title 的 2-gram Jaccard
  para_gap_mult: 0.4                              # 02：bullet 段距 ≈ 0.4 × 字号（16pt → 6pt），字号越大段距越大
  heading_free_chars: 10                          # C-37：提炼的小标题（heading / tag，≤ 10 字）不计入字数
  meta_labels: [结论先行, 核心观点, 核心结论, 背景, 小结, 总结, 概述]
title: {spacing_frac: [0.06, 0.12], heavy_size: [28, 32], other_size: [36, 40],   # C-13 字间距 / 字号 [M]；S-01 按档字号 [W]
        content_spacing: 0.075, special_spacing: 0.10,                            # 生成端：内容页 title 字间距 7.5%（36–40pt ≈ 3pt），封面 / 章节 / 目录 10%
        max_width_frac: 0.84}                                                      # 生成端：title 墨迹宽 > 84% 标题宽 → 缩一档（长标题适当缩号，可低于该档区间，不低于 title_size.min）
cover_title_size: [45, 64]                        # §3.5
statement:                                        # 06 / 14 §3.5 [W]
  ladder: [[7, 72, 72], [14, 60, 60], [24, 48, 54], [40, 40, 40]]   # [最大汉字当量, 字号下限, 字号上限]
  block_w: [0.45, 0.60]
  block_h: [0.20, 0.35]
  center_frac: 0.05
agenda: {item_min_size: 20, layouts: [5, 6]}      # 09 / 14 §3.5 [W]
region: {edge_tol: 1, edges_min: 3}               # C-10b [M]
legend_min_size: 18                               # 07 [W]
pagenum_required_over: 20                         # C-16：> 20 页才要求页码
anchor: {title_tol: 2, mask_edge_frac: 0.05, mask_edge_vtol: 4, image_center_frac: 0.10, cover_center_tol: 4}
type_scale_tol: 0.5
max_sizes_per_page: 5                             # 不计 title / source / pagenum
accent_max_chars: 20
contrast: {body: 4.5, large: 3.0, large_pt: 18, large_bold_pt: 14, percentile: 80}
deck: {series_max: 0.40, heavy_max: 0.40, subtitle_max: 0.60, subtitle_run: 4,
       conclusion_run: 2, conclusion_max: 0.50, noframe_min: 0.333}
composite: {same_density: 0.80, both_lines: 0.80, same_container: 0.80,
            hierarchy_fail: 0.50, filled_edges: 0.80, pattern_share: 0.40, hits: 3}
images: {viewed_min: 8, reason_min: 8, thumb_max_px: 640, phash_min: 12,
         fullbleed_min_px: 1920, small_mult: 2, temp_z: 1.5}
cards: {min: 2, max: 6}                           # C-10
image_aspect_tol: 0.02
text: {para_max_chars: 100, para_max_lines: 4, box_max_chars: 200, source_mult: 1.1}   # source_mult：C-37 正文字数 ≤ 1.1 × source_chars
# ---- 尺度优先（14 §4 S-01–S-06；2026-09-17 第三轮；bands 2026-09-20 第五轮改）
scale:
  bands:                                          # S-01：按密度档定字号档（只取 type_scale 里的值）
    light:  {body_min: 18, body_cap: 20}          # 第五轮：密度档只定正文起始值；body_cap 是生成端放大上限，不是校验上限
    medium: {body_min: 16, body_cap: 16}
    heavy:  {body_min: 14, body_cap: 14}
  hero_block_h: 0.80                              # S-01：hero:table / hero:image 高度 ≥ 0.8 × body 高（图表不查）
  overlap: 0.30                                   # 相邻判定：投影重叠 ≥ 30%（以较窄者计）
  tight_max_mult: 0.8                             # §3.4b 紧贴对：墨迹横向间距 ≤ 0.8g（或相交）的指定角色对合并成一个元素
  g_min_mult: 0.5                                 # S-02：0.5 × 正文字号 ≤ g（g 由 layout.py 算出并写进页级 manifest）
  g_max_mult: 1.5                                 # S-02：g ≤ 1.5 × 正文字号
  steps: [1, 2, 3]                                # S-02：所有间距 ∈ {g, 2g, 3g}
  step_tol: 0.20                                  # S-02：±20%
  column_gap_steps: [2, 3]                        # S-02：分栏间距 = 2g 或 3g
  e_mult: 1.2                                     # S-03 / S-04 / C-09：e = 1.2g
  nowrap_safety: 1.25                             # 生成端：大数字 / 释义不折行的宽度安全系数（Avenir Next Bold 数字约 0.65em，估算 0.55）
  title_gap_step: 3                               # C-09：title 下沿到 body 第一个元素 = 3g
  inset_min_mult: 1                               # S-04：p ∈ [g, 3g]
  inset_max_mult: 3
  container_empty_mult: 2                         # S-04：容器内空矩形短边 ≤ 2p
  hole_mult: 3                                    # S-05：content bbox 内最大空矩形短边 ≤ 3g
  align_max: 3                                    # S-06：左沿 / 右沿各 ≤ 3 个值
  align_tol: 2                                    # S-06：±2pt
```

第五轮的变化：删 `hero.font_mult`、`layout.hero_top_frac`、`deck.hero_types_min`、`scale.bands.*.hero_min / hero_max / body_max`；增 `hierarchy`、`title`、`statement`、`agenda`、`region`；`composite.no_hero` 改名 `hierarchy_fail`；`hero_block_h` 只对 table / image 生效。

已删除的阈值：`void_ratio`（C-05）、`spacing`（C-07）、`grid_tol`（C-12）、`spacing_floor`、`fill`（F-01–F-05）、`void_size`（manifest.void）。

## 9. 依赖

python-pptx、Pillow、numpy、imagehash（pHash）、PyYAML。字体度量用 §3.3 的经验系数，不依赖字体文件。
