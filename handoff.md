# 交接说明：把 xlaw-slide-visual-reasoning 做成完整 skill

输入文件：`skill.md`（references 00–13 合并稿）、`14-validation-spec.md`、`roles.py`。
这三份是规格，不是草稿：规则、阈值、字段名不要改，有疑问先问我，不要自行补规则。

## 目标目录

```
xlaw-slide-visual-reasoning/
  SKILL.md
  references/00-reasoning-workflow.md … 14-validation-spec.md
  scripts/
    roles.py            # 已给
    validate_design.py  # 按 14 实现，全部 C-xx
    fetch_images.py     # 三家图库 API → 候选缩略图 + _qa/candidates/NN.json
    contact_sheet.py    # 选中图拼图 → _qa/contact_sheet.png
    inkbox.py           # 14 §3.3 墨迹框估算，validate 与生成端共用
  assets/               # 空；icon 运行时从 npm 取（见待定项 1）
  thresholds.yaml       # 14 §8 默认值原样落盘
```

## 构建顺序

1. 把 `skill.md` 按 `## NN-xxx.md` 标题拆成 references/，内容逐字保留；`14-validation-spec.md` 直接放入。
2. 写 SKILL.md 正文。frontmatter 的 description 要写明：带图 skill，需要图库 API key 与网络，只在 Claude Code 这类能出网的环境运行。正文只做编排，规则全部指向 references：
   - Step 0：跑 `fetch_images.py --check`，key 缺失或网络不通即停下按 10 的说明请用户授权
   - Step 1–2：按 00 输出 deck 级 manifest（14 §1.1），锁定后写入 `deck.manifest.yaml`
   - Step 3：每页先写页级 manifest（14 §1.2），再写 pptxgenjs 代码；生成端硬规则：每个 add* 调用带 `objectName`（00 角色表）、文本框按 inkbox 贴文字、图片来源写进该页备注、manifest 先于代码
   - 选图：按 10 的七步走，用 `fetch_images.py` 取候选，用 Read 逐张看缩略图，填 candidates.json 与 manifest.image
   - 交付前：`contact_sheet.py` → `validate_design.py deck.pptx deck.manifest.yaml`，任一 M 失败不交付，修改后重跑；13 的感知测试在渲染图上自查
3. scripts/。`validate_design.py` 每个 C-xx 一个函数，签名统一 `(ctx, page) -> list[Finding]`，阈值全部从 thresholds.yaml 读，输出 JSON + 控制台摘要，exit code 按 14 §2。
4. 用一份真实内容做一套完整 deck 跑通全流程。
5. 负向测试：另做一套故意违规的 deck，覆盖每一条 M 检查至少一次，确认每条都能被抓到并且信息里带声明值与反算值。
6. 校准：再做两套不同语气的 deck，统计每条 W 的触发率，只汇报，不改阈值。

## 待定项（做之前先问我）

1. icon 来源。默认方案：语义 icon（工厂、船、证书、握手这类要被认出来的）用开源线形库，运行时 `npm i lucide-static`（或 tabler-icons）取 SVG，不打包进 skill；重着色只改 stroke / fill 为 palette 色；插入前用 cairosvg 栅格化成 4× PNG 再 addImage（pptxgenjs 的 SVG 回退 PNG 不是真 PNG，旧版 PowerPoint / WPS 有风险，python-pptx 也读不了 SVG）。几何 / 结构 glyph（箭头、序号圆、勾叉、分隔符、流程节点）由 agent 直接用 pptxgenjs 形状或自绘 SVG 生成，不走库。同页同组 icon 必须来自同一库同一风格。双色 / 多色中尺寸 icon 用 Phosphor duotone；等距 3D 只在用户提供素材或生图 MCP 时可用。SKILL.md 里要写清。
2. 现有 SKILL.md 正文若已有工作流，与 00 合并成一处，不要两处各写一遍。
3. 测试用的真实内容我来给。

## 验收

- 三份规格文件内容未被改写
- 干净 deck：validate 通过，roles 通过，contact sheet 存在
- 违规 deck：每条 M 检查至少命中一次
- `python scripts/validate_design.py --list` 能列出全部 C-xx 与其级别、阈值来源
