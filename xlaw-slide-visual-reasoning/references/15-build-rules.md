## 15-build-rules.md

生成端（`build.js`，pptxgenjs）的硬规则。SKILL.md 的阶段 B 只做编排，规则以本文件为准；角色表见 00，schema 见 14 §1，尺度循环见 14 §4c。

### build.js 的结构

- 顶部：`const SKILL = process.env.XLAW_SKILL || '<skill 根目录绝对路径>'`，脚本一律用 `${SKILL}/scripts/...` 调用；公共函数（text / image / rect / tag / icon / layout / pagenum）写在前面
- 每页一个独立函数块：`content(n, s => { ... })`；改一页只改这一个函数，其它页不动。`node build.js` 总是重写整个 `deck.pptx`（几秒钟），不需要按页输出
- 页面失败不中断：`content()` 捕获异常、留空白页占位、最后统一列出失败页并以非 0 退出
- 每页的元素树先写到 `_qa/layout/NN.in.json`，`layout.py` 的输出写到 `_qa/layout/NN.json`，build.js 只从输出里取框；控制台只打印每页一行（g、p、sizes、notes）
- 生成后必须依次跑 `scripts/postfix.py`（英文字体 + bullet），再校验

### 形状与角色

- 每个 `addText / addShape / addImage / addTable / addChart` 调用都带 `objectName`，值只能来自 00 的角色表。没有或不在表内，整页不合格
- 布局由 `scripts/layout.py` 的尺度循环计算，build.js 不手写内容元素坐标。元素树节点：text（可带 `unit`）/ icon / tag / image / chart / table / box / vtimeline / pair（紧贴对）/ row（并列格，`balance`、`stretch`）/ stack / card（可带压角 tag）/ timeline；列加 `region: true`、顶层节点加 `region: "bottom"` 输出贴边区域背景；列加 `edge` 输出满页高边图（配图方式 5 / 6）。写法见 `scripts/layout.py` 顶部说明
  ```bash
  python "$SKILL/scripts/layout.py" _qa/layout/05.in.json --deck deck.manifest.yaml --write-g > _qa/layout/05.json
  ```
  layout.py 返回失败（g 低于下限 = 内容超载；列内居中留下 > 3g 的空；大数字缩到下限仍折行）时改列比、改结构或拆页，不加字、不换文案、不改阈值。有余量时的放大顺序是正文 → 小标题级 → 大数字
- 文本框按墨迹框贴文字：高度用 `scripts/inkbox.py --size <pt> --width <pt> --text "..."` 算（layout.py 已内置），不留多余空高
- 单位：pptxgenjs 用英寸，manifest 与校验器用 pt，`inch = pt / 72`；页面 960×540pt 对应 `LAYOUT_WIDE`

### 文字

- 每个 run 显式给 `fontFace`、`fontSize`、`color`；字号只取 `type_scale` 里的值；颜色只取色板里的值
- 行距用固定 pt：`lineSpacing: 1.2 × fontSize`，不用 `lineSpacingMultiple`（中文字体会渲染成约 1.46 × 字号，与 inkbox 估算对不上）
- 中文大标题字间距：内容页 `title` `charSpacing: 0.075 × fontSize`，封面 / 章节 / 目录 `0.1 × fontSize`；内容页 title 28–40、必须单行，过长则缩一档（layout.py 的 `title` 输出已处理）
- 数字与英文用 `deck.fonts_latin` 的英文字体；放大强调的数字一律粗体；`postfix.py` 把 `a:latin` 统一写成英文字体
- bullet：段首 run 给 `bullet: {code: '25CF'}`（accent）或 `'25CB'`（降噪色），缩进约 1.4 × 字号；要点文本段距 `paraSpaceBefore ≈ 0.4 × 字号`（layout 的 text 节点加 `para_gap: true`）
- 单个段落 ≤ 100 汉字当量且 ≤ 4 行，单个文本框 ≤ 200 字（C-36）；超出拆成多个 body 或改结构，不缩字号
- 页面字数 ≤ 1.1 × 该页 `source_chars`（C-37）：填不满就居中，不加字
- 不造元标签、不复述标题：「结论先行」这类词不做 title / kicker；小标题级以上的文字不把 title 再说一遍（C-11）。只有一句话的页用 `statement` 页类型（06）

### 高亮与层级

- accent 只给本页结论里最重要的数字 / 词；论据数字、释义、单位用深色；饱和高亮色不作背景、不铺大色块（C-14）；暖色 accent 用得更少，此时区域背景取更灰、更冷的浅色
- 先分清结论与论据：结论放大占主区，论据缩小（01）
- 小标题、结论句用 Medium，不用大标题同款 Bold；一组并列小标题里只让一个成分用 accent；页面有重点组件时 accent 全部集中在它身上；高亮已用在小标题上时 icon 用深色
- 数据带名称和单位：每个数据配小标题级名称；单位紧跟数字（text 节点 `unit`）；前后对比标出对比维度；「大数字 → 大数字」全 deck ≤ 3 页，其余用小表格 / 成对条形 / 堆叠条；构成用饼图 / 环形图（07）
- 流程图（03）：上排阶段标题 + icon 用深色线条箭头，下排具体流程用浅色面性箭头；分叉节点进容器；manifest `focus.form: flow`；用两行同 `ratios` 的 row 排，箭头由相邻格的框派生
- 序号（02）：小圆（circle tag 缺省 1.7 × 字号）+ 粗体数字，或目录式细体数字 + 同色细竖线；相邻非系列页的序号样式不同；并列要点之间用 2g

### 图片、遮罩、图表

- 每个 `addImage` 带 `sizing: {type: 'cover', w, h}`，禁止靠 w / h 拉伸（C-35）。`w / h` 按图片自身宽高比给（layout.py 输出 `img_w / img_h`），`sizing.w / h` 才是页面上的框
- 遮罩 `addShape(rect, {fill: {color, transparency}, objectName: 'mask'})`；颜色用 `scripts/mask_color.py <图>` 从图片主色算（浅色遮罩加 `--light`），不用主题色
- 图片来源写进该页备注 `slide.addNotes(...)`，含 source 与 photographer（`fetch_images.py select` 打印应写的那一行）；Unsplash 按其规范署名
- 图表（07、S-07）：`showTitle: false`、`showLegend: false`；标题单独放图表正上方（`heading`，深色、带单位）；序列名在图表外自绘（`legend`：色块 + 文字 ≥ 18）；小型图表（类目 ≤ 8）形状框宽约为版心的 45–55%；论证对象序列用 accent，其余 `data_muted`；讲趋势时加趋势线。校验器看不到图表墨迹，渲染自查时确认

### icon

- 语义 icon（要被认出来的）：开源库，运行时取 SVG，不打包进 skill。线形用 lucide-static / @tabler/icons outline；面性用 `@phosphor-icons/core` fill 或 @tabler/icons filled；同页同组 icon 来自同一库同一风格
  ```bash
  npm i pptxgenjs @phosphor-icons/core        # 在 deck 目录；或 lucide-static / @tabler/icons
  python "$SKILL/scripts/icon.py" node_modules/@phosphor-icons/core/assets/fill/factory-fill.svg _qa/icons/factory-1F4FD8.png --color 1F4FD8
  python "$SKILL/scripts/icon.py" node_modules/@phosphor-icons/core/assets/duotone/factory-duotone.svg _qa/icons/factory-duo.png --color 0B1F3A --secondary 9CC8FF
  ```
  重着色只改 SVG 的 `stroke` / `fill` 为色板色；插入前栅格化为 4× PNG 再 `addImage`，不直接插 SVG
- 几何 / 结构 glyph（箭头、序号圆、勾叉、分隔符、流程节点）：pptxgenjs 形状或自绘，不走库
- 双色扁平语义 icon：Phosphor duotone；或 `fetch_images.py search --type vector`（Pixabay），同样走筛选
- 等距 3D icon 只在用户提供素材或生图 MCP 时可用
- objectName 为 `icon`；风格规则见 11 Icon Style
