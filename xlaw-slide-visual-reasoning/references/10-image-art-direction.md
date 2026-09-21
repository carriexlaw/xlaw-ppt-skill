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

1. 由本页 manifest（message、role、image.layout / side、contrast）和上面的 Rules 写 2–3 组检索词，英文关键词，包含构图与色调（如 `aerial coastal port cool tones`），不只写主题名词
2. 每组取前 8–12 张，只下载缩略图到临时目录
3. 逐张看，按以下标准打分，不看图不选图：
   - 负空间的方向与图片上要压的文字位置一致（文字要压在图上时尤其）；边图（方式 5 / 6）的负空间朝向内容一侧
   - 色温、明度与 11 里锁定的 palette 兼容
   - 无人物面孔、无文字、无 logo、无明显品牌物
   - 语义配图必须与本页内容有可说明的关联；氛围图必须与 deck 主题的行业 / 地理 / 尺度一致。关联要来自内容（行业、产品、使用场景），不来自品牌名的字面联想；商务 deck 的封面 / 目录不选海岛、沙滩风景（11 图片风格）
   - 全出血图只从 Pexels / Unsplash 选：Pixabay API 给的原图只有 1280 宽，过不了 C-34
   - 视觉焦点单一，可裁出本页需要的比例
   - 原图尺寸满足用途：全出血 ≥ 页面像素宽度，小图 ≥ 显示尺寸的 2 倍
4. 无一合格 → 改检索词再来，最多 3 轮；仍无 → 调整本页的图片角色（全出血改小图、氛围图改语义图）或本页不用图，不降低标准硬选
5. 选定后填 manifest：`candidates_viewed` 为实际看过的张数，`reason` 一句话说明为什么是它而不是其它候选
6. 全 deck 选完后做一次 contact sheet：把所有选中图拼成一张图看整体，同为摄影的图之间色温、明度、镜头语言不统一的换掉；相邻页的图不得在构图上重复
7. 优先同一摄影师或同一色调族的图，一致性比单张好看更重要

- 只看过 1 张就选定、`candidates_viewed` < 8、或 `reason` 为空，均不合格 [M]
- 选定图片不在本页下载过的候选列表内，不合格 [M]
- contact sheet 未生成即交付，不合格 [M]



