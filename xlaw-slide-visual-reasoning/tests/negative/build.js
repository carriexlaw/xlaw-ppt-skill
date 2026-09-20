// 负向测试 deck：每页故意违反若干条 M 检查（对应 deck.manifest.yaml 的页注释）。尺度优先模型：S-01–S-06 各至少一页。
const pptxgen = require('pptxgenjs');
const pres = new pptxgen();
pres.layout = 'LAYOUT_WIDE';
const P = v => v / 72;
const FONT = 'PingFang SC';
const C = { accent: '1F4FD8', navy: '0B1F3A', t1: 'EEF2F7', t2: 'F6F8FB', black: '000000', white: 'FFFFFF', body: '333333', gray: '7A7A7A' };
const MX = 48, MW = 864;
const col = i => 48 + i * (57.3333 + 16);      // 只是取几个 x 值，不再是栅格
const colW = n => n * 57.3333 + (n - 1) * 16;
const LH = 1.2;
const TITLE_BOTTOM = 40 + 28 * LH;
const isCJK = ch => /[⺀-鿿豈-﫿︰-﹏＀-￯]/.test(ch);
const cw = (ch, s) => (ch === ' ' ? 0.3 * s : isCJK(ch) ? s : 0.55 * s);
const lineW = (t, s) => [...t].reduce((a, ch) => a + cw(ch, s), 0);
function lines(text, size, w) { let n = 0; for (const p of text.split('\n')) n += Math.max(1, Math.ceil(lineW(p, size) / w)); return n; }
function T(s, text, o) {
  const size = o.size, w = o.w;
  const h = o.h || lines(text, size, w) * size * LH;
  const opt = { x: P(o.x), y: P(o.y), w: P(w), h: P(h), margin: 0, valign: o.valign || 'top', align: o.align || 'left', lineSpacingMultiple: LH, fontFace: o.font || FONT, fontSize: size, color: o.color || C.body, bold: !!o.bold };
  if (o.name) opt.objectName = o.name;
  if (o.fill) opt.fill = { color: o.fill };
  s.addText(text, opt);
  return { x: o.x, y: o.y, w, h, bottom: o.y + h };
}
const title = (s, text, o = {}) => T(s, text, Object.assign({ x: MX, y: 40, w: MW, size: 28, bold: true, color: C.black, name: 'title' }, o));
const pagenum = (s, n, o = {}) => T(s, String(n), Object.assign({ x: MX, y: 508, w: 32, size: 10.5, color: C.gray, name: 'pagenum', h: 12.6 }, o));
const divider = (s, y) => s.addShape(pres.shapes.LINE, { x: P(MX), y: P(y), w: P(MW), h: 0, line: { color: C.gray, width: 0.75 }, objectName: 'divider' });
function rect(s, o) { const opt = { x: P(o.x), y: P(o.y), w: P(o.w), h: P(o.h), fill: o.fill ? { color: o.fill } : { type: 'none' }, line: o.line ? { color: o.line, width: 0.75 } : { type: 'none' } }; if (o.name) opt.objectName = o.name; s.addShape(pres.shapes.RECTANGLE, opt); }
function img(s, path, o) { s.addImage({ path, x: P(o.x), y: P(o.y), w: P(o.w), h: P(o.h), sizing: { type: 'cover', w: P(o.w), h: P(o.h) }, objectName: o.name }); }
const LONG = '海外工厂的失败案例里，八成不是选错地方，而是派错人和管错事。我们调研了十一家同行业中资企业在越南和泰国的运营情况，得到四条共性结论。第一，总经理必须由集团派驻、直接向首席执行官汇报，且任期不少于三年。所有在两年内换过总经理的工厂，产能爬坡都推迟了半年以上。第二，财务、采购、质量三个岗位的负责人必须是集团外派，本地化的是生产、人事和行政。有两家企业把采购交给本地团队，一年内出现供应商回扣问题。第三，本地人事负责人必须在开工前六个月到岗，负责建立符合当地劳工法的制度。越南和泰国的工会与加班规定与国内差异很大，三家企业因加班安排被罚款或停工。第四，集团要设立海外运营委员会，每月审议海外工厂的现金流、良率和客户投诉，前十八个月不得下放审批权限。外派成本测算：核心团队六人，含税年薪、住房、探亲与保险，合计每年约七百二十万元，占一期投资的百分之六。这笔钱不能省。建议同步在国内建立海外后备干部池，从现有厂长、车间主任中选拔十二人进行为期一年的轮训，覆盖语言、当地法规与跨文化管理，避免第二期布局时再次无人可派。';

let s, y;

// 1 封面（合规）
s = pres.addSlide();
rect(s, { x: 0, y: 0, w: 960, h: 540, fill: C.navy, name: 'bg' });
T(s, '负向测试', { x: 194, y: 220, w: 571, size: 50, bold: true, color: C.white, align: 'center', name: 'title' });

// 2 C-01：一个没有 objectName 的形状 + 一个非法角色名
s = pres.addSlide();
title(s, '未标记形状');
T(s, '42', { x: MX, y: TITLE_BOTTOM + 54, w: 300, size: 72, bold: true, color: C.accent, name: 'hero:big-number' });
rect(s, { x: col(6), y: 200, w: colW(4), h: 80, fill: C.t1 });                       // 无 objectName
T(s, '角色名不在表内', { x: col(6), y: 300, w: colW(4), size: 12, name: 'sidebar' });   // 非法角色
divider(s, 480);
pagenum(s, 2);

// 3 C-02 标题偏移；C-13 Arial / 13pt；C-14 FF0000；C-16 页码偏移
s = pres.addSlide();
title(s, '锚点、字体、颜色、页码', { x: 60, y: 52 });
T(s, '58%', { x: MX, y: TITLE_BOTTOM + 54, w: 300, size: 72, bold: true, color: C.accent, name: 'hero:big-number' });
T(s, 'This body uses Arial at 13pt in red.', { x: col(6), y: TITLE_BOTTOM + 54, w: colW(6), size: 13, font: 'Arial', color: 'FF0000', name: 'body' });
T(s, '这一段 accent 色的连续文字远远超过二十个汉字的上限，用来触发颜色检查的第二条规则。', { x: col(6), y: 260, w: colW(6), size: 12, color: C.accent, name: 'body' });
divider(s, 480);
pagenum(s, 3, { x: 80 });

// 4 C-03 hero 字号不足 + 隐性第二主元素；C-11 kicker 存在但 subtitle=false，结论行复述标题
s = pres.addSlide();
title(s, '主元素不成立');
T(s, '这是一个副标题', { x: MX, y: TITLE_BOTTOM + 12, w: MW, size: 16, color: C.gray, name: 'kicker' });
T(s, '12', { x: MX, y: 170, w: 300, size: 20, bold: true, color: C.accent, name: 'hero:big-number' });
T(s, '隐性主元素', { x: col(6), y: 170, w: colW(6), size: 50, bold: true, color: C.navy, name: 'body' });
T(s, '普通正文，字号 12。', { x: MX, y: 260, w: 300, size: 12, name: 'body' });
T(s, '主元素不成立', { x: MX, y: 400, w: MW, size: 16, bold: true, color: C.accent, name: 'conclusion' });
divider(s, 480);
pagenum(s, 4);

// 5 C-04 超 480 字；C-36 单框超 200 字；C-10 卡片 2 张、一 fill 一 stroke；S-04 容器没有子项
s = pres.addSlide();
title(s, '字数与卡片');
T(s, '9', { x: MX, y: TITLE_BOTTOM + 54, w: 120, size: 72, bold: true, color: C.accent, name: 'hero:big-number' });
T(s, LONG, { x: col(2), y: TITLE_BOTTOM + 54, w: colW(10), size: 10.5, name: 'body' });
T(s, LONG.slice(0, 200), { x: col(2), y: 330, w: colW(10), size: 10.5, name: 'body' });
rect(s, { x: col(2), y: 430, w: colW(4), h: 40, fill: C.t1, name: 'card:1' });
rect(s, { x: col(7), y: 430, w: colW(4), h: 40, fill: C.white, line: C.gray, name: 'card:2' });
divider(s, 480);
pagenum(s, 5);

// 6 S-02：g = 4 低于 0.5 × 正文；间距 4 / 10 / 14 / 20 / 28 / 40 不成 {g, 2g, 3g}；C-09 标题下方 20 ≠ 3g
s = pres.addSlide();
title(s, '间距失序');
y = TITLE_BOTTOM + 20;                                                                // C-09
T(s, '7', { x: MX, y, w: 200, size: 72, bold: true, color: C.accent, name: 'hero:big-number' });
const gaps = [4, 10, 14, 20, 28, 40];
let yy = y;
gaps.forEach((g, i) => {
  const r = T(s, '间距分层被打乱的一行正文，' + '文字'.repeat(24), { x: col(4), y: yy, w: colW(8), size: 12, name: 'body' });
  yy = r.bottom + g;                                                                  // S-02
});
divider(s, 480);
pagenum(s, 6);

// 7 C-15 灰字压在无遮罩图上；C-34 低分辨率原图；C-32 与下页同图；S-01 hero:image 高度不足 80% body；C-03 面积不足；C-35 拉伸
s = pres.addSlide();
img(s, '_qa/selected/07.jpg', { x: col(6), y: TITLE_BOTTOM + 54, w: 960 - col(6), h: 150, name: 'hero:image' });   // 600px 原图，w/h 直接给
title(s, '图片与漂浮元素');
T(s, '压在图上的灰色小字', { x: col(7), y: TITLE_BOTTOM + 80, w: colW(4), size: 10.5, color: C.gray, name: 'body' });   // C-15
[[MX, 150], [col(3), 210], [MX, 300], [col(3), 380], [MX, 440]].forEach(([x, yv], i) => T(s, '漂浮元素 ' + (i + 1), { x, y: yv, w: colW(2), size: 12, name: 'body' }));
divider(s, 480);
pagenum(s, 7);
s.addNotes('Photo: Khunkorn Laowisit / Pexels — https://www.pexels.com/photo/ship-with-container-vans-1211787/');

// 8 C-30 选图记录；C-32 同图
s = pres.addSlide();
img(s, '_qa/selected/08.jpg', { x: col(6), y: 0, w: 960 - col(6), h: 540, name: 'hero:image' });
title(s, '选图记录不完整');
T(s, '这一页的 manifest 声明只看过 3 张，选的图不在候选里，reason 只有两个字，备注也没写摄影师。', { x: MX, y: TITLE_BOTTOM + 54, w: colW(5), size: 12, name: 'body' });
divider(s, 480);
pagenum(s, 8);
s.addNotes('无来源');

// 9 S-03 内容块横向只占左 3 列；S-05 主元素与正文之间一个大洞；S-02 g 远大于 1.5 × 正文
s = pres.addSlide();
title(s, '内容块与洞');
T(s, '5', { x: MX, y: TITLE_BOTTOM + 64, w: colW(3), size: 72, bold: true, color: C.accent, name: 'hero:big-number' });
T(s, '这一块正文离主元素很远，中间是一个洞。', { x: MX, y: 440, w: colW(3), size: 12, name: 'body' });
s.addShape(pres.shapes.LINE, { x: P(MX), y: P(480), w: P(colW(3)), h: 0, line: { color: C.gray, width: 0.75 }, objectName: 'divider' });   // 短分隔线，内容块只占左 3 列
pagenum(s, 9);

// 10 C-18 [W] 主元素在页尾；C-09 标题下方 200；S-03 底对齐留顶
s = pres.addSlide();
title(s, '主元素在页尾');
T(s, '这段正文离标题 200pt。', { x: MX, y: TITLE_BOTTOM + 200, w: MW, size: 12, name: 'body' });
T(s, '主元素沉到最底', { x: MX, y: 420, w: MW, size: 50, bold: true, color: C.navy, name: 'hero:big-label' });
divider(s, 40 + 28 * LH + 400);
pagenum(s, 10);

// 11 S-04：色块里的内容缩在左上角（四边内缩不一致、p 小于 g、内部大片空矩形）；C-10 panel + divider 两种容器
s = pres.addSlide();
title(s, '容器不贴内容');
T(s, '9', { x: MX, y: TITLE_BOTTOM + 54, w: 200, size: 72, bold: true, color: C.accent, name: 'hero:big-number' });
rect(s, { x: col(5), y: TITLE_BOTTOM + 54, w: colW(7), h: 300, fill: C.t1, name: 'panel' });
T(s, '色块里只有这一小段文字，缩在左上角。', { x: col(5) + 10, y: TITLE_BOTTOM + 64, w: 180, size: 12, name: 'body' });
divider(s, 480);
pagenum(s, 11);

// 12 S-01：声明 medium，正文 10.5、hero 40 都不在档内
s = pres.addSlide();
title(s, '尺度不随密度');
T(s, '42', { x: MX, y: TITLE_BOTTOM + 54, w: MW, size: 40, bold: true, color: C.accent, name: 'hero:big-number' });
T(s, '这一页声明为中密度，但正文用了 10.5、主元素只有 40：内容太小，页面在撑开，留白不是设计出来的，是没放大留下的。', { x: MX, y: TITLE_BOTTOM + 54 + 48 + 18, w: MW, size: 10.5, name: 'body' });
T(s, '第二段正文，同样 10.5。这一页也没有把内容块撑到版心，S-03 与 S-05 会一起失败。', { x: MX, y: TITLE_BOTTOM + 54 + 48 + 18 + 30, w: MW, size: 10.5, name: 'body' });
divider(s, 480);
pagenum(s, 12);

// 13 S-06：五条左沿、四条右沿；title 左沿没有任何内容元素与之对齐
s = pres.addSlide();
title(s, '对齐线失守');
T(s, '3', { x: 60, y: TITLE_BOTTOM + 54, w: 260, size: 72, bold: true, color: C.accent, name: 'hero:big-number' });
[[76, 200, 300], [92, 250, 340], [108, 300, 380], [124, 350, 420]].forEach(([x, yv, w], i) => T(s, `左沿 ${x}，右沿 ${x + w}，第 ${i + 1} 行`, { x, y: yv, w, size: 12, name: 'body' }));
divider(s, 480);
pagenum(s, 13);

// 14 第五轮层级规则：两个 hero 字号 / 颜色不一致（C-01）；panel:region 只贴一条边且与 card 同页（C-10 / C-01）；heading 复述 title、kicker 是元标签（C-11）；
//    title 两行（C-13）；focus 声明 headings×3 实际只有 1 个（C-40）；大数字不加粗（C-13）
s = pres.addSlide();
rect(s, { x: 600, y: 200, w: 360, h: 200, fill: C.t1, name: 'panel:region' });
title(s, '层级规则失守：这是一条故意写得很长、长到一行放不下所以必然会折成两行的大标题');
T(s, '结论先行', { x: MX, y: 40 + 2 * 28 * LH + 8, w: MW, size: 12, color: C.gray, name: 'kicker' });
T(s, '层级规则失守：这是一条故意写得很长、长到一行放不下的大标题', { x: MX, y: 180, w: 500, size: 20, bold: true, color: C.navy, name: 'heading' });
T(s, '12', { x: MX, y: 260, w: 120, size: 48, bold: true, color: C.accent, name: 'hero:big-number' });
T(s, '34', { x: 200, y: 260, w: 120, size: 40, bold: false, color: C.navy, name: 'hero:big-number' });
rect(s, { x: MX, y: 340, w: 400, h: 120, line: C.accent, name: 'card:1' });
rect(s, { x: MX + 420, y: 340, w: 100, h: 120, line: C.accent, name: 'card:2' });
T(s, '卡片里的正文，第一张。', { x: MX + 12, y: 352, w: 376, size: 14, name: 'body' });
T(s, '第二张。', { x: MX + 432, y: 352, w: 76, size: 14, name: 'body' });
pagenum(s, 14);

// 15 第五轮（不触发 C-01，让几何检查跑到）：panel:region 只贴一条边（C-10）；heading 复述 title、kicker 是元标签（C-11）；title 两行、大数字未加粗（C-13）；focus 声明 headings×3 实际 1 个（C-40）
s = pres.addSlide();
rect(s, { x: 600, y: 200, w: 360, h: 200, fill: C.t1, name: 'panel:region' });
title(s, '层级规则失守：这是一条故意写得很长、长到一行放不下所以必然会折成两行的大标题');
T(s, '结论先行', { x: MX, y: 40 + 2 * 28 * LH + 8, w: MW, size: 12, color: C.gray, name: 'kicker' });
T(s, '层级规则失守：这是一条故意写得很长、长到一行放不下的大标题', { x: MX, y: 180, w: 500, size: 20, bold: true, color: C.navy, name: 'heading' });
T(s, '56', { x: MX, y: 260, w: 120, size: 48, bold: false, color: C.accent, name: 'hero:big-number' });
T(s, '这一页的正文。', { x: MX, y: 340, w: 400, size: 14, name: 'body' });
pagenum(s, 15);

pres.writeFile({ fileName: 'deck.pptx' }).then(f => console.log('wrote', f));
