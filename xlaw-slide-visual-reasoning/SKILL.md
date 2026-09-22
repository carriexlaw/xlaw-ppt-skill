---
name: xlaw-slide-visual-reasoning
description: 从内容稿或大纲生成带配图的 PPT（.pptx）。触发：用户要做 PPT / slide deck / 演示文稿 / 汇报材料，并给了内容稿、大纲或主题（哪怕只是一段话）；用户说「做成 PPT」「出一套 slides」「配图的演示文稿」。不触发：只改现有 pptx 里的几个字、换一张图、调一页排版；只读取 / 总结 pptx 的内容；用户明确不要配图；沙箱或无网环境（本 skill 依赖图库 API、LibreOffice 与本机字体，不降级为无图）。产物是 deck.pptx + 逐页视觉决策 manifest + 机器校验报告。
---

# xlaw-slide-visual-reasoning

本文件只做编排。所有设计规则、阈值、字段定义都在 `references/`，这里不复述；冲突以 references 为准。路径一律相对于 skill 根目录，下文用 `$SKILL` 代表它的绝对路径；deck 的全部文件放在用户指定的 deck 目录（下文 `<deck>/`），命令都在 `<deck>/` 下执行。

## 前置条件

跑一条命令查完全部前置项，任一必需项缺失即 exit 1 并打印缺什么、怎么装：

```bash
python "$SKILL/scripts/check_env.py" --node-dir .
```

| 项 | 缺失时的表现 | 用户该做什么 |
|---|---|---|
| Python 3.9+ 与 python-pptx、Pillow、numpy、imagehash、PyYAML、requests、pymupdf、lxml | 脚本 `ImportError`；check_env 列出缺的包名 | `python3 -m pip install --user <包名>`。cairosvg 可选，缺了 icon.py 自动回退 |
| Node 18+ 与 pptxgenjs（在 `<deck>/node_modules`） | `node build.js` 报 `Cannot find module 'pptxgenjs'` | 在 `<deck>/` 下 `npm i pptxgenjs @phosphor-icons/core` |
| LibreOffice（soffice）与可渲染中文的字体 | `render_deck.py` exit 1，打印各平台安装命令；中文渲染成方框时打印字体链接提示 | macOS `brew install --cask libreoffice`；Windows 官网安装包；Linux `apt install libreoffice-impress` |
| 至少一个图库 key：`PEXELS_API_KEY` / `PIXABAY_API_KEY` / `UNSPLASH_ACCESS_KEY` | `fetch_images.py` exit 1，打印三家注册地址与推荐顺序 | 注册拿 key（免费），放进环境变量，或放进 `<deck>/` 或其任一上级目录的 `.env`。模型不猜、不翻找 key；key 不出现在任何产物或回复里 |
| 机器上的字体：一套中文黑体（Source Han Sans → Noto Sans CJK → PingFang / Microsoft YaHei）与一套英文字体（Avenir Next / Segoe UI） | check_env 列出缺的字体族；deck 里写了机器上没有的字体会在渲染时回退成别的字体 | macOS `brew install --cask font-source-han-sans`；`deck.fonts` / `fonts_latin` 只写机器上确实有的字体（`11` 字体系统） |

网络不可达时如实告知需要能访问图库 API 的环境，不降级为无图。

## 文件索引

| 文件 | 内容 |
|---|---|
| `references/00-reasoning-workflow.md` | Step 1–3、page manifest 字段、形状角色表 |
| `references/01-visual-foundations.md` | 层级、密度、容器、可视化拆解、留白（尺度优先 S-01–S-06）、颜色、一致性 |
| `references/02` – `08` | 七类内容（要点 / 流程 / 结构 / 时间线 / 观点 / 数据 / 对比）的 patterns |
| `references/09-cover-section-transition.md` | 封面 / 目录 / 章节 / 结束页 |
| `references/10-image-art-direction.md` | 图片来源、授权、七步选图流程与打分标准 |
| `references/11-style-system.md` | 锁定层清单、字体系统、图片风格、七种配图方式、icon 风格 |
| `references/12-anti-patterns.md` | 反模式 |
| `references/13-visual-qa.md` | 感知测试清单、`_qa/review.md` 格式、机器校验索引 |
| `references/14-validation-spec.md` | manifest schema（§1）、校验流程（§2）、每条 C-xx / S-xx 的算法 |
| `references/15-build-rules.md` | build.js 结构与 pptxgenjs 生成端硬规则 |
| `thresholds.yaml` | 阈值；模型不读，校验器与 layout.py 自己读；不改它来让校验通过 |
| `scripts/` | check_env、fetch_images、layout、inkbox、icon、mask_color、postfix、contact_sheet、render_deck、validate_design、roles；每个脚本顶部有用法 |

产出文件（`14` §0）：

```
<deck>/deck.pptx  deck.manifest.yaml  build.js
<deck>/_qa/candidates/NN.json + NN/*.jpg + NN-sheet.png   候选记录、缩略图、候选拼图
<deck>/_qa/selected/NN.jpg      选定原图（多图页 NN-1.jpg …）
<deck>/_qa/contact_sheet.png    全部选中图拼图
<deck>/_qa/layout/NN.in.json + NN.json   layout.py 输入 / 输出
<deck>/_qa/build-notes.md       B 段的决定与未解决的 W
<deck>/_qa/validate.json        校验全量结果
<deck>/_qa/render/NN.png + grid-NN.png   渲染图、整套拼图
<deck>/_qa/review.md            渲染自查结论
```

## 流程总览：三段，三个会话

一次会话只做一段、只做一套 deck。段与段之间不靠对话记忆，全部状态在文件里；新会话从 B 或 C 接手时只读本段列出的文件。段内上下文接近 150k 时先压缩再继续。

| 段 | 做什么 | 只读这些文件 | 输入 | 产出 | 结束条件 |
|---|---|---|---|---|---|
| A 视觉决策 | Step 1–3 manifest、选图 | `00` `01` `09` `10` `11` + 本 deck 出现的内容类型对应的 `02`–`08` | 内容稿 | `deck.manifest.yaml`、`_qa/selected/`、`_qa/candidates/`、`_qa/contact_sheet.png` | 每页有 manifest；每个图片页 `image` 字段填完整、原图在 `_qa/selected/` |
| B 生成与校验 | build.js、生成、机器校验到 M = 0 | `00` 角色表、`14` §1–§2、`15`；某条检查失败时再读 `14` 里对应小节 | A 的产出 | `build.js`、`deck.pptx`、`_qa/validate.json`、`_qa/build-notes.md` | `validate_design.py` M = 0 |
| C 渲染与自查 | 渲染、感知测试（子代理）、改页、交付 | `13` `12`、`_qa/build-notes.md` | B 的产出 | `_qa/review.md`、改后的 `deck.pptx`、交付报告 | review 里没有「不通过」，重校验 M = 0 |

主会话在任何一段都不 Read 图片。看图的工作交给子代理（独立上下文），子代理把结果写进文件，主会话读文件。

## A 段：视觉决策

入口：内容稿 + 前置检查通过。

1. **Step 1–2**：按 `00` Step 1 回答七个问题，Step 2 倒推方向，按 `11` 建立锁定层。写成 `deck.manifest.yaml` 的 `deck:` 段（字段与示例见 `14` §1.1）。必须满足：`type_scale` 覆盖 `09` 与 `01` 的全部字号层级；字体按 `11` 且只写机器上有的；色板含 accent / secondary / tertiary / neutral / `accent_light` / `data_muted`，hex 大写无 `#`；≤ 20 页不放页码。锁定后不改。
2. **Step 3 逐页 manifest**：按 `00` Step 3 与 `14` §1.2 逐页写 `pages:`。先写 `focus.object`（这一页在讲谁）再选 `focus.form`；按 `01` 可视化拆解决定能否拆成并列 / 一对数据 / 图表 / 时间线；`source_chars` = 原稿分给本页的汉字当量。
3. **选图**（有图的页）。主会话只跑 `search`，看图与打分交给子代理：
   ```bash
   python "$SKILL/scripts/fetch_images.py" search --page 05 --query "aerial coastal port cool tones" --query "..."   # 2–3 组英文检索词，含构图与色调；生成 _qa/candidates/05-sheet.png
   ```
   每 3–4 个图片页起一个**选图子代理**，prompt 里给：页号；`_qa/candidates/NN.json` 与 `NN-sheet.png` 的路径；`$SKILL/references/10-image-art-direction.md` 的路径（打分标准、三轮上限）；本页 manifest 的 message / role / layout / side。子代理要做的：看拼图给每张打分，只对前 2–3 名放大看单张缩略图，然后跑
   ```bash
   python "$SKILL/scripts/fetch_images.py" mark --page 05 --scores "1234567:4:负空间右侧,2345678:2:人物正面,..."   # 全部看过的都要 mark，≥ 8 张
   python "$SKILL/scripts/fetch_images.py" select --page 05 --id 1234567     # 原图 → _qa/selected/05.jpg；打印 manifest.image 字段与页备注那一行
   ```
   无合格图时按 `10` 换词重搜（最多 3 轮），仍无则回报，不硬选。子代理回给主会话每页一行：页号、选中 id、`candidates_viewed`、一句 `reason`、select 打印的备注行；主会话据此填 manifest 的 `image` 字段。用户自有图片：`source: user`，原图放 `_qa/selected/NN.jpg`，`role / layout / side / reason` 仍必填。
4. **contact sheet**：全部选完后生成，并由一个子代理按 `10` 第 6 步看一次整体（色温、明度、镜头语言、相邻页构图），不统一的页回到第 3 步换图。
   ```bash
   python "$SKILL/scripts/contact_sheet.py" deck.manifest.yaml --qa _qa
   ```

结束条件：`deck.manifest.yaml` 里每页都有 manifest，每个图片页 `image` 字段完整（含 `candidates_viewed ≥ 8`、`reason`），`_qa/selected/` 与 `_qa/contact_sheet.png` 齐全。

## B 段：生成与校验

入口：读 `deck.manifest.yaml`、`00` 的角色表、`14` §1–§2、`15`。不读 A 段对话。

1. **写 build.js**，结构与硬规则全部按 `15`：顶部 `SKILL` 路径常量；每页一个 `content(n, fn)` 函数块；每页先把元素树写到 `_qa/layout/NN.in.json`，调 `layout.py` 拿框，再画；每个形状带 `objectName`；图片用 `sizing: cover`；来源写进页备注。
2. **生成与后处理**（每次改 build.js 之后都要重跑这两条）：
   ```bash
   node build.js > _qa/build.log 2>&1; grep -E "失败|Error|notes" _qa/build.log    # 只看失败页与 layout notes，不整读日志
   python "$SKILL/scripts/postfix.py" deck.pptx deck.manifest.yaml
   ```
   layout.py 失败的页按 `15` 改列比 / 结构 / 拆页，不加字、不改阈值。
3. **机器校验**（纯文本，便宜；渲染放到 C 段）：
   ```bash
   python "$SKILL/scripts/validate_design.py" deck.pptx deck.manifest.yaml     # 默认只打印 M / W 项；--full 才打逐页全量
   ```
   只读打印出的 M / W 与 `_qa/validate.json` 的 `summary`、`findings`，不整读 json。任一 M → 按 finding 里的声明值与反算值改 manifest 或那一页的函数，回到第 2 步；只在某条检查失败时读 `14` 里对应的 C-xx 小节。W 不改阈值，记入 build-notes。
4. **写 `_qa/build-notes.md`**：本段做过的结构决定（拆页、改列比、换 pattern）、每条未解决的 W 及原因、C 段需要特别看的页。

结束条件：`validate_design.py` 输出 `M 失败 0`。

## C 段：渲染与自查

入口：读 `_qa/build-notes.md`、`13`、`12`。不读 A / B 段对话，不 Read 图片。

1. **渲染**：
   ```bash
   python "$SKILL/scripts/render_deck.py" deck.pptx --grid 3x2     # _qa/render/NN.png（宽 1280）+ grid-NN.png（每张 6 页）
   ```
2. **自查子代理**（整套一个，> 20 页时每 10 页一个）。prompt 里给：`_qa/render/` 路径；`$SKILL/references/13-visual-qa.md` 的路径；`deck.manifest.yaml` 里每页的 `focus` 与 `message`；`_qa/build-notes.md` 里点名的页。子代理先看 `grid-NN.png` 做 Flip / Silhouette / Anchor，再逐页看 `NN.png` 做单页感知测试，按 `13` 的格式写 `_qa/review.md`：每页一行判定 + 末尾 fixes 列表。主会话只读 `_qa/review.md`。
3. **改页**：按 review 的 fixes 改 build.js 里那几页的函数（或 manifest），然后只重跑受影响的部分：
   ```bash
   node build.js > _qa/build.log 2>&1; grep -E "失败|Error" _qa/build.log
   python "$SKILL/scripts/postfix.py" deck.pptx deck.manifest.yaml
   python "$SKILL/scripts/validate_design.py" deck.pptx deck.manifest.yaml     # 校验必须整套跑（有 deck 级检查），要求 M = 0
   python "$SKILL/scripts/render_deck.py" deck.pptx --pages 5,12               # 只重渲染改过的页
   ```
   再起一个子代理只复核这几页，把 review.md 里对应行改成通过。发现问题不带着交付。
4. **交付**：`deck.pptx`，附交付报告：`_qa/review.md` 的每页判定行、`validate.json` 的 W 汇总、图片致谢（各页备注里的来源与摄影师；Unsplash 必须署名）。

结束条件：review.md 无「不通过」，最后一次校验 M = 0。

## 最短完整示例

用户：「把 `brief.md` 做成一套给投资人看的 PPT。」

```bash
# 会话 1（A 段）：在 <deck>/ 下
python "$SKILL/scripts/check_env.py" --node-dir .            # 不通过就按打印的提示让用户补齐，停在这里
#   读 00 / 01 / 09 / 10 / 11 与用到的 02–08 → 写 deck.manifest.yaml（deck 段 + pages 段）
python "$SKILL/scripts/fetch_images.py" search --page 01 --query "city skyline dusk blue tones" --query "office tower glass facade low angle"
#   … 每个图片页各一次 search；每 3–4 页起一个选图子代理跑 mark --scores / select，回报后填 manifest.image
python "$SKILL/scripts/contact_sheet.py" deck.manifest.yaml --qa _qa   # 子代理看一次整体

# 会话 2（B 段）
npm i pptxgenjs @phosphor-icons/core                          # 首次
#   读 00 角色表 / 14 §1–§2 / 15 → 写 build.js
node build.js > _qa/build.log 2>&1; grep -E "失败|Error|notes" _qa/build.log
python "$SKILL/scripts/postfix.py" deck.pptx deck.manifest.yaml
python "$SKILL/scripts/validate_design.py" deck.pptx deck.manifest.yaml   # 有 M 就改那一页，重跑上两条，直到 M 失败 0
#   写 _qa/build-notes.md

# 会话 3（C 段）
python "$SKILL/scripts/render_deck.py" deck.pptx --grid 3x2
#   自查子代理写 _qa/review.md → 按 fixes 改页 → node build.js、postfix、validate（M = 0）、render --pages <改过的页> → 子代理复核
```

交付：`deck.pptx` + 报告（每页判定行、W 汇总、图片致谢）。

## 不做的事

- 不从风格库里挑模板往内容里套；方向由 Step 1 的答案倒推
- 不取搜索结果第一张图；不用生图模型替代图库；不抓网页图
- 不为了塞内容缩字号、缩间距；超 480 字拆页。不为了填页面放大间距：g 超上限时放大元素
- 不改 `thresholds.yaml` 来让校验通过
- 不为了凑「主元素」放大一个数字、造一个标题：第一层级是论述对象，内容里没有就不造
- 商务 deck 的封面 / 目录不用海岛、沙滩风景，不从品牌名字面联想配图（`09`、`11`）
- 不自创配图方式：图片只按 `11` 的 1–7 摆，方式 5 / 6 必须满页高贴边
- 主会话不 Read 图片、不整读 `validate.json`、不整读 `14`
