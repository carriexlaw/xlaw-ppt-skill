## 14-validation-spec.md

validate_design.py 的实现规格。13 的机器清单是索引，这里是每一项的输入、算法、阈值。所有数值阈值集中在 `thresholds.yaml`，代码不写死。

## 0. 文件约定

生成一套 deck 产出以下文件，校验器全部读取：

```
deck.pptx
deck.manifest.yaml        # deck 级 + 逐页 manifest（§1）
_qa/candidates/NN.json    # 第 NN 页的图片候选记录（§6）
_qa/candidates/NN/*.jpg   # 该页下载过的缩略图
_qa/contact_sheet.png     # 全部选中图拼图
thresholds.yaml           # 阈值，缺省用本文件 §8 的默认值
```

单位：pt。python-pptx 的 EMU / 12700 = pt。页面尺寸从 pptx 读，不假设。

## 1. manifest schema

### 1.1 deck 级（锁定层）

```yaml
deck:
  page: {w: 960, h: 540}                 # 从 pptx 读出后回填，校验时比对
  margins: {l: 48, r: 48, t: 40, b: 40}  # 版心
  grid: {columns: 12, gutter: 16}        # 列线由 margins + columns + gutter 算出
  title_anchor: {x: 48, y: 40, tol: 2}   # 基准锚点，内容页 title 左上角
  pagenum_anchor: {x: 912, y: 508, tol: 2}
  type_scale: [10.5, 12, 16, 20, 28, 50, 72]   # 允许出现的字号集合（tol 0.5），必须含 09 的封面 / 章节 / 副标题字号
  title_size: {min: 27, max: 30}
  min_size: 10.5
  fonts: [Microsoft YaHei, Noto Sans SC, PingFang SC, Segoe UI, Avenir Next]
  palette:                               # 允许出现的颜色（hex，大写，无 #）
    accent: [1F4FD8]
    secondary: [0B1F3A, 16305C]
    tertiary: [EEF2F7, F6F8FB]
    neutral: [000000, FFFFFF, 333333, 7A7A7A]
  accent_max_chars: 20
  shape_language: {corner: 4, stroke: 0.75}   # 记录用，校验只查 corner 与 stroke 是否单值
  tone: argument            # argument / statement / vision，决定留白基线
```

### 1.2 页级

```yaml
pages:
  - page: 1
    type: cover                          # cover / agenda / section / content / closing / quote
  - page: 5
    type: content
    message: 真正出得去的是极少数
    pattern: mapping
    hero: big-label                      # big-number / big-label / chart / table / image / void
    density: medium                      # light / medium / heavy
    container: none                      # none / divider / fill / stroke
    void: right                          # right / bottom / top-band / around / none
    contrast: strong
    title_pos: base                      # base / mask-edge / below-image / right-of-image / image-center
    subtitle: true                       # 有无 kicker
    conclusion: false                    # 有无结论行
    series: null                         # 系列 id，同一系列填同一字符串
    image:                               # 有图时必填，多图用列表
      role: semantic                     # semantic / atmosphere / full-bleed / small
      layout: 6                          # 11 配图方式 1–7
      side: left                         # left / right / top / bottom / full
      source: pexels
      id: "1234567"
      photographer: Jane Doe
      url: https://...
      query: aerial coastal port cool tones
      candidates_viewed: 12
      reason: 负空间在右侧，与 void 一致；冷色，无人物
```

字段缺失、枚举值非法 → 整套不合格，不进入几何校验。

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

## 3. 几何基础定义

### 3.1 形状集合

用 roles.py 的 `classify_slide` 得到角色字典。定义三个集合：

- **excluded**：bg、mask、image:full-bleed、image:atmosphere、pagenum。不参与留白、间距、元素数、栅格
- **foreground**：其余全部
- **countable**：foreground 减 title、kicker、conclusion、source、arrow、deco。用于元素数与主元素竞争检测

### 3.2 区域

- 版心 = 页面减 margins
- 标题区 = 从版心顶到 max(title.bottom, kicker.bottom)
- body 区 = 版心减标题区；页面无 title（特殊页）时 body 区 = 版心

### 3.3 文字墨迹框（ink box）

pptx 文本框的外接矩形通常大于文字。所有留白与间距计算用墨迹框，栅格与锚点检查用形状框。

```
for 每个文本形状:
  inner_w = shape.w − 左右内边距（默认 7.2pt×2，从 bodyPr 读到则用实际值）
  对每个段落:
    行宽估算 = Σ 字宽；字宽 = CJK: size×1.0；拉丁字母数字: size×0.55；空格: size×0.3
    行数 = ceil(行宽 / inner_w)，空段落算 1 行
    行高 = size × 行距倍数（段落 lnSpc，缺省 1.2）
  ink_h = Σ 行高 + 段前段后
  ink_w = min(inner_w, 最长行宽)
  水平锚定：按段落对齐（left / center / right）在 inner 区内摆放
  垂直锚定：按 bodyPr anchor（缺省 top）
```

非文本形状墨迹框 = 形状框。表格墨迹框 = 表格框。

### 3.4 光栅化

body 区按 4pt 网格栅格化为布尔矩阵；foreground 的墨迹框（含 padding，padding = 元素级间距的一半，见 §4.3 求出后回填，首轮用 4pt）置 1。

- `union_area` = 置 1 格数 × 16
- `void_ratio` = 1 − union_area / body 区面积
- 最大空矩形：对 0 格用直方图法求最大面积矩形（O(rows×cols)）

### 3.5 页类型豁免

| 页类型 | 参与的检查 |
|---|---|
| content | 全部 |
| cover / agenda / section / closing / quote | 仅 roles、字体、颜色、字号下限、栅格；title 按 09 规则（cover / section 居中：\|center_x − page_cx\| ≤ 4pt，字号 45–55）；不计入节奏、变化、留白、容器、主元素 |

## 4. 逐页几何检查

### C-01 角色标记 [M]
roles.py。内容页恰一个 title；manifest.hero ≠ void 时恰一个 hero:*，= void 时不得有 hero:*。

### C-02 标题锚点 [M]
基准：`deck.title_anchor`。按 `title_pos` 求期望位置，比 title 形状框：

| title_pos | 期望 | 判定 |
|---|---|---|
| base | 左上角 = anchor | \|dx\|,\|dy\| ≤ tol |
| below-image | y = image.bottom + 区间距；x = anchor.x | 同上 |
| right-of-image | x = image.right + 区间距；y = anchor.y | 同上 |
| mask-edge | title 水平中心 = mask.right（遮罩靠左）或 mask.left（遮罩靠右）；垂直中心 = mask 垂直中心（遮罩满高时即页面垂直中心） | \|dcx\| ≤ 5% 页宽；\|dcy\| ≤ 4pt |
| image-center | title 中心 = image 中心 | \|dcx\|,\|dcy\| ≤ 10% 图宽 / 图高 |

`title_pos` 与 `image.layout / side` 的合法组合：1 / 2 / 7 → base；3 → mask-edge；4 top → below-image，4 bottom → base；5 left → right-of-image，5 right → base；6 left → right-of-image \| image-center，6 right → base \| image-center。不合法组合 → 失败。区间距取 §4.3 的第 3 簇均值，簇不足时取 64。

### C-03 主元素 [M]
- hero 形状按限定词验定义：big-number / big-label：最大 run 字号 ≥ 3 × 正文字号；chart / table / image：形状框面积 ≥ 30% body 区面积；void：页面 countable 文字总汉字当量 ≤ 80 且所有文字形状墨迹框并集是单一连通块
- 正文字号 = countable 文本 run 中按字符数加权的众数字号
- 隐性第二主元素：任一非 hero 的 countable 形状满足上述定义 → 失败
- hero:image 的形状角色必须是 image:semantic

### C-04 密度分档 [M]
- 汉字当量 = CJK 字符数 + 2 × 英文词数（`[A-Za-z0-9][A-Za-z0-9'\-]*`），标点与空白不计。计数范围：foreground 文本减 title、pagenum、source；表格单元格计入
- 元素数 = countable 形状数，其中 table 计 1 + 行数 / 4
- 字数档：≤ 120 轻，121–300 中，301–480 重，> 480 失败（拆页）
- 元素档：≤ 8 轻，9–20 中，> 20 重
- 本页档 = 两者中较重者。与 manifest.density 不符 → 失败（§7）

### C-05 留白量 [M]
`void_ratio` 阈值：轻 ≥ 0.45，中 0.25–0.45，重 ≥ 0.15；任何内容页 < 0.15 失败。`tone: vision` 时各档下限 +0.10 [W]。

### C-06 留白聚合与位置 [M]
- 最大空矩形面积 ≥ void 面积 × 0.50（重页 0.40）
- 位置分类（对最大空矩形 R，body 区 B）：
  - top-band：R.top ≤ B.top + 4 且 R.w ≥ 0.6 × B.w
  - right：R.left ≥ B.left + 0.55 × B.w
  - bottom：R.top ≥ B.top + 0.55 × B.h
  - around：countable 文本墨迹框并集为单块，其中心落在 B 中央 40% 区域，且四边到 B 边的空隙均 ≥ 区间距（至少三边）
  - 否则 none；none 仅重页允许
- 与 manifest.void 不符 → 失败（§7）

### C-07 间距分层 [M]
```
收集间距：
  对 foreground 中任意两形状 a,b（用墨迹框）：
    若水平投影重叠 ≥ 30%（以较窄者计）且 b 在 a 下方：竖向间距 = b.top − a.bottom
    若竖向投影重叠 ≥ 30% 且 b 在 a 右方：横向间距 = b.left − a.right
  只保留最近邻（a 与其正下 / 正右最近的 b），丢弃 < 2pt（贴合）与 > 0.5 × body 高（跨区）的值
  丢弃包含关系的形状对（一方形状框完全包含另一方，如 card 与其内部 body）
聚类：排序，贪心合并，新值与簇均值差 ≤ 10% 则并入
判定：
  簇数 ≤ 4
  相邻簇均值比 ≥ 2.0（W 档 1.8）
  簇内极差 ≤ 10%
命名：由小到大 = 元素级 / 组级 / 区级 / 页级；只有两簇时视为 元素级 / 区级
```
分栏间距（两列 body 的横向最近邻）必须 ≥ 组级簇均值。

### C-08 残余留白 [M]
- right_gap = 版心右缘 − max(foreground 墨迹框.right)
- bottom_gap = 版心下缘 − max(foreground 墨迹框.bottom)
- 合格：gap ≤ 元素级均值 × 1.2，或 gap ≥ 区级均值；否则失败
- 分栏之间的剩余空间同规则

### C-09 标题区下方 [M]
title（或 kicker）下沿到第一个 foreground 元素上沿 ≥ 区级均值；`void: top-band` 时 ≥ 页级簇均值（无页级簇时 ≥ 2 × 区级）。

### C-10 容器样式 [M]
- 分类：card 有 line 且 fill 为空或等于页面底色 → stroke；card 或 panel 有 fill ≠ 底色 → fill；divider → divider；tag 不计
- 本页容器样式集合大小 ≤ 1
- 卡片数 = card:N 数量；出现时 3 ≤ n ≤ 6
- 描边框允许条件 [W]：card 数 ≥ 3 且每张 card 内 body 文本 ≥ 2 行；或恰一张 card 为 fill、其余为 stroke（选中态）

### C-11 副标题 / 结论行 [M]
kicker、conclusion 的存在与 manifest.subtitle / conclusion 一致；结论行文本与 title 文本 Jaccard（按字符 2-gram）≥ 0.6 → 失败（复述标题）。

### C-12 栅格 [M]
列线：`x_i = margins.l + i × (col_w + gutter)`，`col_w = (版心宽 − (columns−1) × gutter) / columns`。foreground 减 arrow、divider、tag 的每个形状：left 距某列起点 ≤ 2pt 且 right 距某列终点 ≤ 2pt。
形状框被 card / panel 完全包含的形状豁免列线，改查：其左右边到所在 card 内缘的距离相等，且同页所有 card 的该内边距为同一值（tol 2pt）。

### C-13 字体与字号 [M]
- 所有 run 字体 ∈ deck.fonts；字号 ∈ type_scale（tol 0.5）；min ≥ min_size
- 内容页 title 最大 run 字号 ∈ [title_size.min, title_size.max]
- 本页不同字号数 ≤ 5

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
pagenum 形状左上角与 `pagenum_anchor` 差 ≤ tol；特殊页可无页码。

## 5. deck 级检查（仅 content 页序列，序列按页码，跳过特殊页后相邻即视为相邻）

### C-20 变化层 [M]
- 相邻页 pattern / hero / density / container / void 五项至少两项不同；两页同属一个 series 时豁免
- 任意连续 5 页同 pattern ≤ 2（series 豁免）
- 相邻页 hero 类型不同；相邻页 void 位置不同（都为 none 除外）
- 相邻页都有 card 时数量不同

### C-21 系列页 [W]
series 非空的页合计 ≤ 40% 内容页。

### C-22 密度节奏 [M/W]
- 连续 3 页都为 heavy → M
- 连续 3 页同档（任意档）→ W
- heavy 占比 ≤ 40% → M
- 每个 heavy 页之后 2 页内出现 light 或 medium → M
- 前 3 页含 light、末 2 页含 light → W

### C-23 副标题 / 结论行占比 [M]
subtitle=true 的页 ≤ 60% 且不连续 4 页；conclusion=true 连续 ≤ 2 且 ≤ 50%。

### C-24 容器占比 [M]
容器样式集合为空的页 ≥ 1/3。

### C-25 主元素多样性 [W]
hero 类型种数 ≥ 3。

### 5.6 C-26 模板复制感综合 [M]
以下六项命中 ≥ 3 → 整套失败：
1. ≥ 80% 页密度同档
2. ≥ 80% 页 subtitle 与 conclusion 同时为 true
3. ≥ 80% 页容器样式相同（含"都为空"）
4. ≥ 50% 页 C-03 失败
5. ≥ 80% 页 right_gap 与 bottom_gap 都 ≤ 元素级 × 1.2
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

### C-34 分辨率 [M]
image:full-bleed 原图宽 ≥ 1920px；其它角色原图宽 ≥ 2 × 形状框宽（pt）× 96 / 72。

## 7. manifest 与几何交叉核对 [M]

| manifest 字段 | 反算来源 |
|---|---|
| type | 页码 1 = cover 允许；其余以 manifest 为准，但 section 页不得有 hero、body ≥ 3 |
| density | C-04 |
| hero | C-03 的 hero 限定词 |
| container | C-10 集合（空 → none） |
| void | C-06 分类 |
| subtitle / conclusion | kicker / conclusion 形状存在性 |
| title_pos | C-02 合法组合 |
| image.role / layout / side | image 形状角色；layout 由形状框比例判定（full ≈ 页面；67% 高 → 4；22% 宽 → 5；50% 宽 → 6；多张小图 → 7；full + 74% 宽 mask → 3；full + 全页 mask → 1 / 2 按 mask 明度）；side 由形状框贴边判定 |

任一不符 → 失败，信息里同时给出声明值与反算值。

## 8. thresholds.yaml 默认值

```yaml
raster_cell: 4
ink: {cjk: 1.0, latin: 0.55, space: 0.3, line_spacing: 1.2, inset: 7.2}
density: {light_chars: 120, medium_chars: 300, max_chars: 480,
          light_elems: 8, medium_elems: 20, void_hero_chars: 80}
void_ratio: {light: 0.45, medium_lo: 0.25, medium_hi: 0.45, heavy: 0.15, vision_bonus: 0.10}
void_cluster: {light: 0.50, heavy: 0.40}
void_pos: {band_w: 0.60, right_x: 0.55, bottom_y: 0.55, around_core: 0.40}
spacing: {overlap: 0.30, min_gap: 2, max_gap_frac: 0.5, cluster_tol: 0.10, max_clusters: 4,
          ratio_m: 2.0, ratio_w: 1.8}
residual: {fill_mult: 1.2}
hero: {font_mult: 3.0, area_frac: 0.30}
grid_tol: 2
anchor: {title_tol: 2, mask_edge_frac: 0.05, mask_edge_vtol: 4, image_center_frac: 0.10, cover_center_tol: 4}
type_scale_tol: 0.5
max_sizes_per_page: 5
accent_max_chars: 20
contrast: {body: 4.5, large: 3.0, large_pt: 18, large_bold_pt: 14, percentile: 80}
deck: {series_max: 0.40, heavy_max: 0.40, subtitle_max: 0.60, subtitle_run: 4,
       conclusion_run: 2, conclusion_max: 0.50, noframe_min: 0.333, hero_types_min: 3}
composite: {same_density: 0.80, both_lines: 0.80, same_container: 0.80,
            no_hero: 0.50, filled_edges: 0.80, pattern_share: 0.40, hits: 3}
images: {viewed_min: 8, reason_min: 8, thumb_max_px: 640, phash_min: 12,
         fullbleed_min_px: 1920, small_mult: 2, temp_z: 1.5}
```

## 9. 依赖

python-pptx、Pillow、numpy、imagehash（pHash）、PyYAML。字体度量用 §3.3 的经验系数，不依赖字体文件。
