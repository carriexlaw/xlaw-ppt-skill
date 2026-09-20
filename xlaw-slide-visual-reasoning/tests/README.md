# tests/

两套测试 deck。`.pptx`、`_qa/`、`*.manifest.yaml` 在 .gitignore 里，需要重新生成；`build.js`、`content.md`、`check_coverage.py` 入库。

## clean/ 干净 deck

15 页中文商务内容（东南亚建厂决策报告），含 400 字页、8 行表格、税率数据图、英文引言、三国系列页。第五轮（层级重写 + 可视化拆解）：每页先写 `focus`（这一页在讲谁），第一层级可以是一组（三个数字并列、三个方案名、时间线本身）；一句话页用 `statement` 页类型；图表半宽 + 自绘序列名 + 趋势线；优劣双框；贴边区域背景；横向时间线。留白模型仍是尺度优先：每页由 `layout.py` 的尺度循环（14 §4c）按密度档定正文起始字号、其余层级相对正文，按剩余空间定 g（14 S-01–S-06）。校准样例是 Carrie 的重排稿（不入库）：学的是为什么这样分层，不是坐标。

```bash
cd tests/clean
npm i pptxgenjs @phosphor-icons/core              # 首次（面性 / 双色 icon 来自 Phosphor，scripts/icon.py 栅格化）
python ../../scripts/fetch_images.py --check      # 需要 PEXELS_API_KEY（根目录 .env）
# 候选与选中图已在 _qa/ 下（若缺失，按 SKILL.md 的选图流程重新 search / mark / select）
node build.js                                     # 每页调用 scripts/layout.py 算框，输入 / 输出在 _qa/layout/NN.in.json、NN.json
python ../../scripts/postfix.py deck.pptx deck.manifest.yaml              # 英文字体（a:latin）+ bullet 135% accent + 清多余 pPr；每次 build 后必跑
python ../../scripts/contact_sheet.py deck.manifest.yaml --qa _qa
python ../../scripts/render_deck.py deck.pptx
python ../../scripts/validate_design.py deck.pptx deck.manifest.yaml     # 期望：M 0（W：C-22 系列页连续同档 ×3、末 2 页无轻页）
python ../../scripts/roles.py deck.pptx deck.manifest.yaml               # 期望：通过
```

## negative/ 违规 deck

每页故意违反若干条 M 检查（含 S-01–S-06 各至少一页；第 14 / 15 页覆盖第五轮的层级规则：hero 不一致、region 未贴边 / 与 card 同页、复述标题、元标签、title 折行、大数字未加粗、focus 不符）；`deck.manifest.bad-schema.yaml` 单独验证 schema 阶段。

```bash
cd tests/negative
ln -s ../clean/node_modules node_modules          # 复用依赖
node build.js
python check_coverage.py                          # 期望：全部 M 检查均已命中
```

`check_coverage.py` 核对每条 M 至少命中一次、C-40 的信息带 declared / actual、校验器无异常。
