## 13-visual-qa.md

最终强制执行的检查。

- 1-second test：一秒能不能看到主要信息？
- Squint test：眯眼看，视觉重心在哪里？
- Thumbnail test：缩小到 20–25% 后，层级是否成立？
- Grayscale test：去掉颜色后，层级是否仍然成立？
- Removal test：有没有元素删除后完全不影响表达？
- Density test：页面是在“呼吸”还是在“塞满”？
- Consistency test：这一页是否明显属于这套 deck？
- Distance test：投影环境下正文是否仍然可读？
- 对象测试：一秒看到的是不是本页论述对象（focus.object），而不是它的某个属性数字？
- 断层测试：第二大的字是什么？它与最大的字、与正文各差多少？
- 藏字测试：把本页 message 里的关键词逐个找出来，它们在页面上是几号字？
- 每页判定那一行里写明 focus.object 与实际第一眼看到的东西是否一致

### Deck 级测试

- Flip test：快速翻完整套 deck，能否感到轻重节奏，还是每页一样重？
- Silhouette test：只看每页元素的外接矩形轮廓，相邻页是否明显不同？
- Anchor test：大标题是否始终在同一位置，其余是否在动？

### 机器校验清单（validate_design.py）

每项的输入、算法、阈值定义见 14-validation-spec.md；本表只是索引。

上面的感知测试由模型执行。下列项由校验器从形状外接矩形与文本长度算出，聚合类用细栅格光栅化后求最大空矩形。M 直接拦截，W 先 warning，跑 3 套 deck 看误报率后再升级。

| 校验项 | 来源 | 级别 |
|---|---|---|
| 每个形状的 name 都是合法角色；内容页恰有一个 `title`；`hero:*` 0–4 个且同页一致 | 00 形状角色标记 | M |
| manifest 相邻页五项（pattern / focus.form / density / container / columns）至少两项不同；5 页内同 pattern ≤ 2（系列页除外） | 01 一致性 | M |
| 大标题位置全 deck 一致 | 01 一致性 | M |
| 系列页合计 ≤ 40% 内容页 | 01 一致性 | W |
| 层级完整性：有大数字必有 label / heading；最大字号 / 正文 ≤ 3.5；heading ≥ 1.25 × 正文 | 01 Visual Hierarchy | W |
| 小标题级以上文字不复述 title（2-gram Jaccard < 0.6） | 01 Visual Hierarchy | M |
| 密度分档；连续 3 页不得都是重页；重页 ≤ 40%；重页后 2 页内有轻/中页；单页 ≤ 480 字 / 240 words | 01 Information Density | M |
| 连续 3 页同档；首 3 页 / 末 2 页各含轻页 | 01 Information Density | W |
| 副标题页 ≤ 60% 且不连续 4 页；结论行连续 ≤ 2 且 ≤ 50% | 01 Information Density | M |
| 单页中容器样式 ≤ 1；无框页 ≥ 1/3；卡片 2–6 且相邻页数量不同；`panel:region` ≤ 1、三边贴页边、不与 card 同页 | 01 Information Density | M |
| S-01 尺度随密度：正文字号 ≥ 该档起始值、各层级不超上限；表格 / 图片作第一层级时高度 ≥ 80% body 高 | 01 Whitespace | M |
| S-02 间距：0.5 × 正文字号 ≤ g ≤ 1.5 × 正文字号；所有间距 ∈ {g, 2g, 3g} ±20%；分栏 = 2g / 3g | 01 Whitespace | M |
| S-03 内容块：横向填满版心；竖向填满 body 或居中（上下残余相等） | 01 Whitespace | M |
| S-04 容器贴内容：内缩 p 同页统一且 ∈ [g, 3g]；容器内无短边 > 2p 的空矩形 | 01 Whitespace | M |
| S-05 无洞（行带口径：元素横向占满所在列，洞只有行与行之间、列内上下残余）：最大空矩形短边 ≤ 3g | 01 Whitespace | M |
| S-06 对齐线：左沿 / 右沿各 ≤ 3；title 左沿在其中；紧贴对算一个元素，等距并列组只计首项左沿 / 末项右沿 | 01 Whitespace | M |
| C-09 标题下沿到 body 第一个元素 ≥ 3g | 01 Whitespace | M |
| C-37 正文字数 ≤ 1.1 × source_chars，排版不改内容 | 01 Whitespace | M |
| 模板复制感综合：以下命中 ≥ 3 项整套不合格——≥ 80% 页同档；≥ 80% 页同时有副标题和结论行；≥ 80% 页同一容器样式；≥ 50% 页层级完整性失败；≥ 80% 页内容块竖向填满（而非居中）；任一 pattern 占比 ≥ 40% | 12 Template Repetition | M |
| title 字间距 / 字号 ∈ [0.08, 0.12]；含数字 / 拉丁字符的 run 用英文字体；title 单行、28–40 | 11 字体系统 | M |
| 配图方式 5 / 6 满页高并贴上、下与一侧页边 | 11 配图方式 | M |
| 页码：≤ 20 页可无；有则在右下锚点 | 01 一致性 | M |
| 相邻页图表 / 图片左右交替（series 豁免） | 01 一致性 | W |
| 一句话页字号阶梯与文字块尺寸；目录页有图且条目 ≥ 20 | 06 / 09 | W |
| 前置：图库 key 存在且测试请求成功，否则不进入生成 | 00 Step 0 / 10 | M |
| 每张图的 manifest 记录完整：`candidates_viewed` ≥ 8、`reason` 非空、所选图在候选列表内、备注含来源与摄影师 | 10 选图流程 | M |
| contact sheet 已生成；相邻页图片构图不重复 | 10 选图流程 | M |
| 全 deck 摄影图色温、明度一致（contact sheet 上按平均色温与亮度离群检测，仅摄影） | 10 选图流程 | W |

