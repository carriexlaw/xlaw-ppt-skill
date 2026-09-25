# xlaw-slide-visual-reasoning

一个让 AI 从内容稿生成商务 PPT 的 Claude Skill：先做逐页视觉决策（论述对象、版式、配图理由），再生成 .pptx，并用机器校验与渲染自查保证质量。

A Claude Skill that turns a content brief into a designed business deck (.pptx) — with per-slide visual reasoning, stock-image art direction, and automated design validation.

> 🚧 持续迭代中，完整文档与示例即将补充。Work in progress — full docs and examples coming soon.

## 结构 / Layout

- `xlaw-slide-visual-reasoning/SKILL.md` — 流程编排（视觉决策 → 生成与校验 → 渲染自查）/ Orchestration: visual decisions → build & validate → render & review
- `references/` — 设计规则：视觉基础、七类内容 pattern、配图、风格系统、反模式、QA / Design rules: visual foundations, patterns for seven content types, imagery, style system, anti-patterns, QA
- `scripts/` — 布局计算、图库检索、设计校验、渲染等工具 / Layout solver, stock-image search, design validator, renderer
- `thresholds.yaml` — 校验阈值 / Validation thresholds
- `tests/` — 测试 deck（内容均为虚构）/ Test decks (all content fictional)

## 前置条件 / Prerequisites

Python 3.9+、Node 18+、LibreOffice，以及至少一个图库 API key（Pexels / Pixabay / Unsplash）。一条命令查完：

Python 3.9+, Node 18+, LibreOffice, and at least one stock-image API key (Pexels / Pixabay / Unsplash). Check everything at once:

```bash
python xlaw-slide-visual-reasoning/scripts/check_env.py --node-dir <deck-dir>
```

详见 `SKILL.md` 的前置条件表。/ See the prerequisites table in `SKILL.md`.

## 协议 / License

MIT
