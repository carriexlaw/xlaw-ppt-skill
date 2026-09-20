// 测试 deck 生成脚本（第五版：层级重写 + 可视化拆解）。内容元素的坐标、字号、g、p 全部来自 scripts/layout.py（14 §4c），本文件只写元素树与绘制。
// 生成后必须跑 scripts/postfix.py（英文字体 + bullet），再渲染、校验。
const pptxgen = require('pptxgenjs');
const { execSync } = require('child_process');
const fs = require('fs');
const pres = new pptxgen();
pres.layout = 'LAYOUT_WIDE';                     // 960×540pt
const P = v => v / 72;
const ZH = { bold: 'Source Han Sans CN Bold', med: 'Source Han Sans CN Medium', light: 'Source Han Sans CN Light' };
const EN = 'Avenir Next', EN_DEMI = 'Avenir Next Demi Bold';
const C = { accent: '1F4FD8', navy: '0B1F3A', navy2: '16305C', t1: 'E3ECFC', t2: 'F4F7FD', light: '9CC8FF', muted: '8A9AB5',
  black: '000000', white: 'FFFFFF', body: '333333', gray: '7A7A7A', dark: '3A4150', pale: 'F3F4F6' };
const LH = 1.2;
const MX = 48, MW = 864;
const LAYOUT = '../../scripts/layout.py', ICON = '../../scripts/icon.py';
const PH = 'node_modules/@phosphor-icons/core/assets';
fs.mkdirSync('_qa/layout', { recursive: true });
fs.mkdirSync('_qa/icons', { recursive: true });
const solved = {};

// ---- 文本：box 来自 layout.py。runs = 字符串 | [{text, o}]；paras = [[runs]...]（bullet 用）
function text(s, runs, box, o) {
  const size = box.size || o.size;
  const face = o.face || ZH.light;
  const base = { fontFace: face, fontSize: size, color: o.color || C.body, bold: !!o.bold, breakLine: false };
  if (o.spc) base.charSpacing = o.spc;
  const paras = o.paras || [Array.isArray(runs) ? runs : [{ text: runs }]];
  const rich = [];
  paras.forEach((para, pi) => para.forEach((r, ri) => {
    const opt = Object.assign({}, base, r.o || {});
    if (o.bullet && ri === 0) opt.bullet = { code: o.quiet ? '25CB' : '25CF', indent: o.bullet };      // 25CB = 降噪色圆点（postfix.py 统一成 Arial •）
    if (ri === para.length - 1 && pi < paras.length - 1) opt.breakLine = true;
    if (box.para_gap && ri === 0 && pi > 0) opt.paraSpaceBefore = box.para_gap;
    rich.push({ text: r.text, options: opt });
  }));
  s.addText(rich, { x: P(box.x), y: P(box.y), w: P(box.w), h: P(box.h), margin: 0, valign: o.valign || box.valign || 'top', align: o.align || box.align || 'left',
    objectName: o.name, lineSpacing: size * LH, fontFace: face, fontSize: size, color: o.color || C.body, wrap: o.nowrap ? false : true });
}
const num = (t, o = {}) => ({ text: t, o: Object.assign({ fontFace: EN, bold: true }, o) });          // 数字 run：英文字体
function title(s, box, t, color = C.black) { text(s, t, box, { face: ZH.bold, bold: true, color, spc: box.spc, name: 'title' }); }
function image(s, path, box, name) {
  s.addImage({ path, x: P(box.x), y: P(box.y), w: P(box.img_w), h: P(box.img_h), sizing: { type: 'cover', w: P(box.w), h: P(box.h) }, objectName: name });
}
function fullImage(s, path, name) {
  const [pw, ph] = execSync(`python3 -c "from PIL import Image;im=Image.open('${path}');print(im.size[0],im.size[1])"`).toString().trim().split(' ').map(Number);
  const a = pw / ph, b = 960 / 540, w = a > b ? 540 * a : 960, h = a > b ? 540 : 960 / a;
  s.addImage({ path, x: 0, y: 0, w: P(w), h: P(h), sizing: { type: 'cover', w: P(960), h: P(540) }, objectName: name });
}
function rect(s, box, o) {
  s.addShape(o.round ? pres.shapes.ROUNDED_RECTANGLE : pres.shapes.RECTANGLE, { x: P(box.x), y: P(box.y), w: P(box.w), h: P(box.h),
    fill: o.fill ? { color: o.fill, transparency: o.transparency || 0 } : { type: 'none' }, line: o.line ? { color: o.line, width: 0.75 } : { type: 'none' },
    rectRadius: o.round ? P(o.round) : undefined, objectName: o.name });
}
// 小容器：圆形 / 胶囊 + 文字
function tag(s, box, t, o = {}) {
  const shape = box.shape === 'circle' ? pres.shapes.OVAL : pres.shapes.ROUNDED_RECTANGLE;
  const base = { fontFace: o.face || ZH.med, fontSize: box.size, color: o.color || C.white, bold: !!o.bold };
  const rich = (Array.isArray(t) ? t : [{ text: t }]).map(r => ({ text: r.text, options: Object.assign({}, base, r.o || {}) }));
  s.addText(rich, { shape, x: P(box.x), y: P(box.y), w: P(box.w), h: P(box.h),
    fill: { color: o.fill || C.navy2 }, line: { type: 'none' }, rectRadius: box.shape === 'circle' ? undefined : P(box.h / 2), margin: 0, align: 'center', valign: 'middle',
    lineSpacing: box.size * LH, fontFace: o.face || ZH.med, fontSize: box.size, color: o.color || C.white, objectName: 'tag' });
}
const _icons = {};
function icon(s, box, name, color, style = 'fill', secondary = null) {
  const key = `${name}-${style}-${color}${secondary ? '-' + secondary : ''}`;
  if (!_icons[key]) {
    const out = `_qa/icons/${key}.png`;
    execSync(`python3 ${ICON} ${PH}/${style}/${name}${style === 'regular' ? '' : '-' + style}.svg ${out} --color ${color}${secondary ? ' --secondary ' + secondary : ''} --px 384`);
    _icons[key] = out;
  }
  s.addImage({ path: _icons[key], x: P(box.x), y: P(box.y), w: P(box.w), h: P(box.h), objectName: 'icon' });
}
const credit = (ph, url) => `Photo: ${ph} / Pexels — ${url}`;

// ---- 调 layout.py：spec.page 从 manifest 读
function pageMf(pageNo) {
  return JSON.parse(execSync(`python3 -c "import yaml,json;m=yaml.safe_load(open('deck.manifest.yaml'));p=[p for p in m['pages'] if p['page']==${pageNo}][0];print(json.dumps({'page':${pageNo},'density':p['density'],'columns':p['columns'],'source_chars':p['source_chars']}))"`).toString());
}
function layout(pageNo, spec) {
  spec.page = pageMf(pageNo);
  const tagN = String(pageNo).padStart(2, '0');
  const inPath = `_qa/layout/${tagN}.in.json`, outPath = `_qa/layout/${tagN}.json`;
  fs.writeFileSync(inPath, JSON.stringify(spec, null, 1));
  let out;
  try { out = execSync(`python3 ${LAYOUT} ${inPath} --deck deck.manifest.yaml --write-g`).toString(); }
  catch (e) { out = e.stdout.toString(); console.error(`page ${pageNo} layout 失败:`, JSON.parse(out).notes); process.exit(1); }
  fs.writeFileSync(outPath, out);
  const r = JSON.parse(out);
  solved[pageNo] = { g: r.g, p: r.p, sizes: r.sizes };
  console.log(`page ${pageNo}: g=${r.g} p=${r.p} sizes=${JSON.stringify(r.sizes)}` + (r.notes.length ? ' | ' + r.notes.join(' | ') : ''));
  return r;
}
const T = (id, role, txt, extra = {}) => Object.assign({ id, kind: 'text', role, text: txt }, extra);
const PAIR = (left, right, extra = {}) => Object.assign({ kind: 'pair', left, right }, extra);
const IC = (id, em) => ({ id, kind: 'icon', em });

let s, r, bx;

// ================================================================ 1 封面：7 个字 → 60；副标题细体 24；署名与时间放页面底部居中
s = pres.addSlide();
fullImage(s, '_qa/selected/01.jpg', 'image:full-bleed');
rect(s, { x: 0, y: 0, w: 960, h: 540 }, { fill: C.navy, transparency: 40, name: 'mask' });
text(s, '出海不是选择题', { x: 180, y: 196, w: 600, h: 72, size: 60 }, { face: ZH.bold, bold: true, color: C.white, align: 'center', spc: 6, name: 'title' });
text(s, [num('2026 ', { bold: false }), { text: '年东南亚产能布局决策建议' }], { x: 180, y: 284, w: 600, h: 28.8, size: 24 }, { color: C.white, align: 'center', name: 'kicker' });
text(s, [{ text: '集团战略部 · ' }, num('2026 ', { bold: false }), { text: '年 ' }, num('9 ', { bold: false }), { text: '月' }], { x: 180, y: 476, w: 600, h: 24, size: 20 }, { color: C.white, align: 'center', name: 'body' });
s.addNotes(credit('Atlantic Ambience', 'https://www.pexels.com/photo/an-aerial-photography-of-a-cargo-ship-sailing-on-the-sea-13606787/'));

// ================================================================ 2 目录：配图方式 5（左，28% 宽，满高）；序号英文字体加粗 + data_muted；条目块居中偏右
s = pres.addSlide();
{
  const IW = 0.28 * 960;
  const dims = execSync(`python3 -c "from PIL import Image;im=Image.open('_qa/selected/02.jpg');print(im.size[0],im.size[1])"`).toString().trim().split(' ').map(Number);
  const a = dims[0] / dims[1], bb = IW / 540;
  image(s, '_qa/selected/02.jpg', { x: 0, y: 0, w: IW, h: 540, img_w: a > bb ? 540 * a : IW, img_h: a > bb ? 540 : IW / a }, 'image:atmosphere');
  text(s, '目录', { x: IW + 72, y: 72, w: 300, h: 48, size: 40 }, { face: ZH.bold, bold: true, color: C.black, spc: 4, name: 'title' });
  const items = ['为什么现在', '去哪里', '三个候选国', '怎么落地', '决策'];
  const x0 = 500, step = 64, y0 = (540 - (4 * step + 48)) / 2;          // 条目块竖向居中、横向居中偏右
  items.forEach((t, i) => {
    text(s, [num('0' + (i + 1), { fontFace: EN_DEMI, bold: true })], { x: x0, y: y0 + i * step, w: 72, h: 48, size: 40 }, { color: C.muted, name: 'label' });
    text(s, t, { x: x0 + 72 + 12, y: y0 + i * step + 4.8, w: 300, h: 38.4, size: 32 }, { face: ZH.light, color: C.navy, name: 'body' });
  });
}
s.addNotes(credit('Wolfgang Weiser', 'https://www.pexels.com/photo/hochhausidylle-27383355/'));

// ================================================================ 3 一句话页（statement）：18 字 → 54，两行各 9 字，折在逗号处并省略行尾标点；重点词 accent_light；无标题、无元标签
s = pres.addSlide();
fullImage(s, '_qa/selected/03.jpg', 'image:full-bleed');
rect(s, { x: 0, y: 0, w: 960, h: 540 }, { fill: C.navy, transparency: 35, name: 'mask' });
{
  const size = 54, w = 9 * size + 8, h = 2 * size * LH;
  text(s, null, { x: (960 - w) / 2, y: (540 - h) / 2, w, h, size }, { face: ZH.bold, bold: true, color: C.white, align: 'center', name: 'hero:big-label',
    paras: [[{ text: '三年', o: { color: C.light } }, { text: '内不建海外产能' }], [{ text: '欧美订单将流失' }, { text: '四成', o: { color: C.light } }]] });
}
s.addNotes(credit('zs Lin', 'https://www.pexels.com/photo/aerial-view-of-a-bridge-over-turquoise-water-28970204/'));

// ================================================================ 4 数据页（轻）：图表半宽在左，图表标题单列在上；右半列 = 自绘序列名 + 结论句；论证对象（越南）accent，参照（中国）data_muted；趋势线
s = pres.addSlide();
{
  const CT = '对美出口综合税率（%）', CONC = '税差从 7.5 个点扩大到 25 个点，价格优势已被完全抵消';
  const SRC = '2023–2026E　来源：海关总署、USTR 公告、公司财务部测算';
  const LG = (id, t) => PAIR({ id: id + 's', kind: 'icon', em: 1.1 }, T(id + 't', 'legend', t, { tier: 'fixed', size: 20 }), { group: 'lg' });
  r = layout(4, { title: { text: '关税差已抵消全部价格优势' }, column_gap: 3, columns: [
    { items: [T('ct', 'heading', CT, { tier: 'fixed', size: 20, group: 'c' }), { id: 'chart', kind: 'chart', role: 'hero:chart', aspect: 0.6, group: 'c' }, T('src', 'source', SRC, { size: 10.5, group: 'c' })] },
    { items: [LG('l0', '中国'), LG('l1', '越南'), T('conc', 'conclusion', CONC, { gap: 3 })] }] });
  bx = r.boxes;
  title(s, bx.title, '关税差已抵消全部价格优势');
  text(s, [{ text: '对美出口综合税率（' }, num('%', { fontFace: EN_DEMI }), { text: '）' }], bx.ct, { face: ZH.med, color: C.navy, name: 'heading' });
  const labels = ['2023', '2024', '2025', '2026E'];
  s.addChart([
    { type: pres.charts.BAR, data: [{ name: '中国', labels, values: [7.5, 25, 34, 45] }, { name: '越南', labels, values: [0, 0, 10, 20] }],
      options: { barDir: 'col', barGrouping: 'clustered', barGapWidthPct: 80, chartColors: [C.muted, C.accent], showValue: true, dataLabelFormatCode: 'General', dataLabelFontFace: EN, dataLabelFontSize: 14, dataLabelColor: C.body, dataLabelPosition: 'outEnd' } },
    { type: pres.charts.LINE, data: [{ name: '越南趋势', labels, values: [0, 0, 10, 20] }],
      options: { chartColors: [C.navy], lineSize: 1.25, lineSmooth: true, lineDataSymbol: 'none', showValue: false } },
  ], { x: P(bx.chart.x), y: P(bx.chart.y), w: P(bx.chart.w), h: P(bx.chart.h), showTitle: false, showLegend: false,
    catAxisLabelFontFace: EN, catAxisLabelFontSize: 16, catAxisLabelFontBold: true, catAxisLabelColor: C.navy, valAxisHidden: true, valGridLine: { style: 'none' }, catGridLine: { style: 'none' },
    catAxisLineShow: false, valAxisLineShow: false, plotArea: { fill: { color: C.white } }, objectName: 'hero:chart' });
  text(s, [num('2023–2026E', { bold: false }), { text: '　来源：海关总署、' }, num('USTR ', { bold: false }), { text: '公告、公司财务部测算' }], bx.src, { color: C.gray, name: 'source' });
  [['l0', '中国', C.muted], ['l1', '越南', C.accent]].forEach(([id, t, col]) => {
    rect(s, bx[id + 's'], { fill: col, name: 'legend' });
    text(s, t, bx[id + 't'], { face: ZH.med, color: C.navy, valign: 'middle', name: 'legend' });
  });
  text(s, [{ text: '税差从 ' }, num('7.5 '), { text: '个点扩大到 ' }, num('25 '), { text: '个点，价格优势已被完全抵消' }], bx.conc, { face: ZH.med, color: C.navy2, name: 'conclusion' });
}
s.addNotes('无图');

// ================================================================ 5 并列页：论述对象 = 客户类型（小标题级 + 语义 icon）；右侧区域背景 = 结论（60% + 占比图 + 结论句）
s = pres.addSlide();
{
  const rows = [
    { h: '客户 A - 家电', ic: 'television', kp: '30% → 60%', body: [{ text: '2025 ', n: 1 }, { text: '年起新品类要求 ' }, { text: '30% ', n: 1 }, { text: '产能在东南亚，' }, { text: '2027 ', n: 1 }, { text: '年提高到 ' }, { text: '60%', n: 1 }] },
    { h: '客户 B - 工具', ic: 'wrench', body: [{ text: '已把两个 ' }, { text: 'SKU ', n: 1 }, { text: '转给泰国供应商，年' }, { text: '损失订单约 ', hot: 1 }, { text: '4,200 ', n: 1, hot: 1 }, { text: '万元', hot: 1 }] },
    { h: '客户 C - 园艺', ic: 'plant', body: [{ text: '合同新增条款，若无海外产能则' }, { text: '取消年度返利', hot: 1 }] },
    { h: '客户 D、E、F', ic: null, body: [{ text: '口头询问', hot: 1 }, { text: '，尚未落到合同' }] },
  ];
  const plain = b => b.map(x => x.text).join('');
  const LEAD = '过去 18 个月，前十大客户中已有 6 家明确要求「中国 + 1」供应方案', CONC = '这不是价格谈判，是准入条件', CONC_BR = '这不是价格谈判，\n是准入条件', LEAD_BR = '过去 18 个月，\n前十大客户中已有 6 家明确要求\n「中国 + 1」供应方案';      // 折行点选在标点处
  const mkRow = (rw, i) => ({ kind: 'row', ratios: [2.2, 0.75, 3.6], valign: 'center', cell_gap: 2, group: 'rows', cells: [
    [T(`h${i}`, 'heading', rw.h, { nowrap: true, tier: 'fixed', size: 20 })],
    rw.ic ? [IC(`i${i}`, 2.9)] : [],
    rw.kp ? [T(`k${i}`, 'heading', rw.kp, { group: `b${i}` }), T(`b${i}`, 'body', plain(rw.body), { group: `b${i}` })] : [T(`b${i}`, 'body', plain(rw.body))] ] });
  r = layout(5, { title: { text: '客户在用脚投票', w: 520 }, column_gap: 3, columns: [
    { items: rows.map(mkRow).map((n, i) => Object.assign(n, { gap: i ? 3 : 0 })) },
    // 区域背景是窄长的：60% 与占比图互相解释，是一组，上下紧排（间距 g），图最大；上下的文字收窄居中
    { region: true, items: [T('lead', 'body', LEAD_BR, { align: 'center', w_frac: 0.96 }),
      T('n60', 'hero:big-number', '60%', { align: 'center', group: 'pie' }), { id: 'pie', kind: 'chart', role: 'chart', aspect: 1.0, w_frac: 0.5, group: 'pie' },
      T('conc', 'conclusion', CONC_BR, { align: 'center', w_frac: 0.8, tier: 'fixed', size: 20 })] }] });
  bx = r.boxes;
  rect(s, bx.region, { fill: C.t1, name: 'panel:region' });
  title(s, bx.title, '客户在用脚投票');
  const runOf = x => x.n ? num(x.text, { bold: !!x.hot, color: x.hot ? C.accent : undefined }) : { text: x.text, o: x.hot ? { fontFace: ZH.bold, bold: true, color: C.accent } : {} };
  rows.forEach((rw, i) => {
    // 一组并列小标题里只让一个成分高亮：「客户 A -」深色，类型（家电）accent
    const m = rw.h.match(/^(客户 [A-Z、 ]+?)(?: - (.+))?$/);
    text(s, [{ text: m[1] + (m[2] ? ' - ' : ''), o: { color: C.navy } }].concat(m[2] ? [{ text: m[2], o: { color: C.accent } }] : []), bx[`h${i}`], { face: ZH.med, name: 'heading' });
    if (rw.ic) icon(s, bx[`i${i}`], rw.ic, C.navy, 'duotone', C.light);          // 高亮色已用在小标题上，icon 降噪
    if (rw.kp) text(s, [num('30% → 60%')], bx[`k${i}`], { color: C.navy2, name: 'heading' });      // 分支信息：小标题字号，不用高亮色
    text(s, rw.body.map(runOf), bx[`b${i}`], { name: 'body' });
  });
  text(s, null, bx.lead, { face: ZH.med, color: C.navy, align: 'center', name: 'body', paras: LEAD_BR.split('\n').map(t => [{ text: t }]) });
  text(s, [num('60%')], bx.n60, { color: C.accent, align: 'center', valign: 'middle', nowrap: true, name: 'hero:big-number' });
  s.addChart(pres.charts.DOUGHNUT, [{ name: '前十大客户', labels: ['已要求', '未要求'], values: [6, 4] }], { x: P(bx.pie.x), y: P(bx.pie.y), w: P(bx.pie.w), h: P(bx.pie.h),
    holeSize: 58, chartColors: [C.accent, C.navy], showLegend: false, showTitle: false, showValue: false, showPercent: false, showLabel: false, dataBorder: { pt: 1, color: C.t1 }, objectName: 'chart' });
  text(s, null, bx.conc, { face: ZH.med, color: C.navy, align: 'center', name: 'conclusion', paras: CONC_BR.split('\n').map(t => [{ text: t }]) });
}
s.addNotes('无图');

// ================================================================ 6 章节页
s = pres.addSlide();
rect(s, { x: 0, y: 0, w: 960, h: 540 }, { fill: C.navy, name: 'bg' });
text(s, '二 · 去哪里', { x: 180, y: 214, w: 600, h: 64.8, size: 54 }, { face: ZH.bold, bold: true, color: C.white, align: 'center', spc: 5.4, name: 'title' });
text(s, '三个候选国的取舍', { x: 180, y: 294, w: 600, h: 28.8, size: 24 }, { color: C.white, align: 'center', name: 'kicker' });

// ================================================================ 7 表格页（中）：表头 Medium；数据 20、行名 18；数字 Avenir Next Demi Bold；中密度 → 数据区 accent
s = pres.addSlide();
{
  const TT = '三国候选：成本、配套、风险各有取舍', KICK = '2026 年 Q2 数据';
  const rows = [
    ['维度', '越南（海防）', '泰国（罗勇）', '印尼（巴淡）'],
    ['对美综合税率 2026E', '20%', '19%', '19%'],
    ['制造业月均工资（美元）', '330', '460', '300'],
    ['到美西海运（天）', '22', '26', '24'],
    ['工业园土地（美元/㎡，50 年）', '95', '120', '70'],
    ['电价（美元/kWh）', '0.08', '0.13', '0.10'],
    ['本地配套（注塑 / 冲压 / 电子）', '强 / 中 / 强', '强 / 强 / 中', '弱 / 弱 / 弱'],
    ['中资企业数量（同行业）', '40+', '25+', '5'],
    ['政治与汇率风险', '中', '低', '中高'],
  ];
  const SRC = '来源：各国投资促进机构 2026 年 Q2 数据，公司实地调研';
  r = layout(7, { title: { text: TT }, kicker: { text: KICK, size: 16, w: MW }, columns: [
    { items: [{ id: 'tbl', kind: 'table', role: 'hero:table', rows: rows.length, row_min: 30 }, T('src', 'source', SRC, { size: 10.5, gap: 1 })] }] });
  bx = r.boxes;
  title(s, bx.title, TT);
  text(s, [num('2026 ', { bold: false }), { text: '年 ' }, num('Q2 ', { bold: false }), { text: '数据' }], bx.kicker, { color: C.gray, name: 'kicker' });
  const border = [{ type: 'none' }, { type: 'none' }, { type: 'solid', color: C.t1, pt: 0.75 }, { type: 'none' }];
  const w = bx.tbl.w, c1 = w * 0.37, c2 = (w - c1) / 3;
  const isNum = c => /^[0-9.+%,]+$/.test(c);
  const cell = (c, ri, ci) => {
    const o = { border, margin: [2, 8, 2, 8], valign: 'middle', align: ci === 0 ? 'left' : 'center' };
    if (ri === 0) return { text: c, options: Object.assign(o, { fontFace: ZH.med, fontSize: 16, color: C.white, fill: { color: C.navy } }) };
    if (ci === 0) return { text: c, options: Object.assign(o, { fontFace: ZH.light, fontSize: 18, color: C.navy }) };
    return { text: c, options: Object.assign(o, isNum(c) ? { fontFace: EN_DEMI, fontSize: 20, color: C.accent } : { fontFace: ZH.med, fontSize: 20, color: C.accent }) };
  };
  s.addTable(rows.map((rw, ri) => rw.map((c, ci) => cell(c, ri, ci))), { x: P(bx.tbl.x), y: P(bx.tbl.y), w: P(w), h: P(bx.tbl.h), colW: [P(c1), P(c2), P(c2), P(c2)], rowH: P(bx.tbl.row_h), objectName: 'hero:table' });
  text(s, [{ text: '来源：各国投资促进机构 ' }, num('2026 ', { bold: false }), { text: '年 ' }, num('Q2 ', { bold: false }), { text: '数据，公司实地调研' }], bx.src, { color: C.gray, name: 'source' });
}
s.addNotes('无图');

// ================================================================ 8–10 系列页：三个数字并列（数字 + 释义）；适合（圆形标签）；优 / 劣双框（accent / 深灰，面性 icon）；配图方式 5 右，满高
const countries = [
  { n: 8, t: '越南 · 海防', img: '08', ph: 'Khunkorn Laowisit', url: 'https://www.pexels.com/photo/ship-with-container-vans-1211787/',
    nums: [['1.2', '亿元\n一期投资'], ['14', '个月\n投产'], ['3', '第 3 年\n盈亏平衡']], fit: '以出口美国为主、需要快速复制现有产线的品类',
    pro: [['link', '距深圳工厂 2 天陆运，同行业中资企业最多，供应链可以整体搬迁'], ['lightning', '电价最低']],
    con: [['hard-hat', '工资三年涨了 38%，熟练工流动率高'], ['map-trifold', '海防工业园土地已接近售罄，新地块在 40 公里外']] },
  { n: 9, t: '泰国 · 罗勇', img: '09', ph: 'Tom Fisk', url: 'https://www.pexels.com/photo/cityscape-of-industrial-town-with-factory-6060193/',
    nums: [['1.6', '亿元\n一期投资'], ['16', '个月\n投产'], ['4', '第 4 年\n盈亏平衡']], fit: '高附加值、对品质稳定性要求高的品类',
    pro: [['seal-check', '汽车与电子配套最成熟，政治风险最低，BOI 给 8 年免税'], ['users-three', '本地管理人才充足']],
    con: [['money', '工资最高，土地最贵'], ['hourglass', '海运多 4 天'], ['hard-hat', '同行业竞争激烈，招工要和日资企业抢人']] },
  { n: 10, t: '印尼 · 巴淡', img: '10', ph: 'Adiardi Zulfansyah', url: 'https://www.pexels.com/photo/stunning-aerial-view-of-jayapura-s-tropical-coastline-37815248/',
    nums: [['0.9', '亿元\n一期投资'], ['18', '个月\n投产'], ['4', '第 4 年\n盈亏平衡']], fit: '劳动密集、零部件体积小的品类；作为第二阶段布局',
    pro: [['coins', '成本最低，土地充足'], ['map-trifold', '距新加坡 1 小时船程'], ['users-three', '未来 10 年人口红利最大']],
    con: [['factory', '配套几乎为零，所有零部件需从中国海运'], ['bank', '宗教与劳工法规复杂'], ['money', '印尼盾三年贬值 12%']] },
];
const mixed = (t, o = {}) => t.split(/([A-Za-z0-9][A-Za-z0-9.,%+]*\s?)/).filter(Boolean).map(x => /^[A-Za-z0-9]/.test(x) ? num(x, Object.assign({ bold: false }, o)) : { text: x, o });
for (const c of countries) {
  s = pres.addSlide();
  const IW = 0.29 * 960;
  const bullets = (pre, arr) => arr.map((b, i) => PAIR(IC(`${pre}i${i}`, 1.9), T(`${pre}t${i}`, 'body', b[1]), { gap: i ? 1 : 0 }));
  r = layout(c.n, { title: { text: c.t, w: 960 - IW - 48 - 48 }, inset: 1.5, columns: [
    { items: [
      { kind: 'row', cell_gap: 2, valign: 'center', cells: c.nums.map((nn, i) => [PAIR(T(`n${i}`, 'hero:big-number', nn[0]), T(`nl${i}`, 'label', nn[1]))]) },
      PAIR({ id: 'fitTag', kind: 'tag', shape: 'circle', text: '适合', size: 14 }, T('fit', 'body', c.fit), { gap: 2 }),
      { kind: 'row', cell_gap: 2, balance: true, stretch: true, cells: [
        [{ id: 'proCard', kind: 'card', tag: { id: 'proTag', shape: 'circle', text: '优势', size: 14 }, items: bullets('p', c.pro) }],
        [{ id: 'conCard', kind: 'card', tag: { id: 'conTag', shape: 'circle', text: '劣势', size: 14 }, items: bullets('c', c.con) }]], gap: 2 }] },
    { edge: 'right', w: IW, items: [{ id: 'img', kind: 'image', role: 'image:atmosphere', path: `_qa/selected/${c.img}.jpg` }] }] });
  bx = r.boxes;
  image(s, `_qa/selected/${c.img}.jpg`, bx.img, 'image:atmosphere');
  title(s, bx.title, c.t);
  c.nums.forEach((nn, i) => {
    text(s, [num(nn[0])], bx[`n${i}`], { color: C.accent, nowrap: true, name: 'hero:big-number' });
    text(s, null, bx[`nl${i}`], { color: C.accent, name: 'label', paras: nn[1].split('\n').map(l => mixed(l)) });
  });
  tag(s, bx.fitTag, '适合', { fill: C.t1, color: C.navy, face: ZH.bold, bold: true });
  text(s, c.fit, bx.fit, { face: ZH.med, color: C.navy, name: 'body' });
  [['pro', 'p', c.pro, C.accent, '优势'], ['con', 'c', c.con, C.dark, '劣势']].forEach(([k, pre, arr, col, lab]) => {
    rect(s, bx[`${k}Card`], { line: col, round: 12, name: `card:${k === 'pro' ? 1 : 2}` });
    tag(s, bx[`${k}Tag`], lab, { fill: col, face: ZH.bold, bold: true });
    arr.forEach((b, i) => { icon(s, bx[`${pre}i${i}`], b[0], col, 'fill'); text(s, mixed(b[1]), bx[`${pre}t${i}`], { name: 'body' }); });
  });
  s.addNotes(credit(c.ph, c.url));
}

// ================================================================ 11 重密度页：四条结论 → 四个小标题（胶囊，secondary）+ bullet；底部区域背景：外派成本（数字 + 释义 + 大括号 + items）| 后备干部池
s = pres.addSlide();
{
  const TT = '海外工厂：八成失败是派错人', KICK = '我们调研了 11 家同行业中资企业在越南和泰国的运营情况，得到四条共性结论';
  const cols = [
    { h: '总经理任期 ≥ 3 年', b: ['总经理必须由集团派驻、直接向 CEO 汇报，且任期不少于三年', '所有在两年内换过总经理的工厂，产能爬坡都推迟了半年以上'] },
    { h: '重要岗位必须外派', b: ['财务、采购、质量三个岗位的负责人必须是集团外派，本地化的是生产、人事和行政', '有两家企业把采购交给本地团队，一年内出现供应商回扣问题'] },
    { h: '符合当地劳工制度', b: ['本地人事负责人必须在开工前六个月到岗，负责建立符合当地劳工法的制度', '越南和泰国的工会与加班规定与国内差异很大，三家企业因加班安排被罚款或停工'] },
    { h: '海外运营委员会', b: ['集团要设立海外运营委员会，每月审议海外工厂的现金流、良率和客户投诉', '前 18 个月不得下放审批权限'] },
  ];
  const POOL = ['建议同步在国内建立「海外后备干部池」，从现有厂长、车间主任中选拔 12 人进行为期一年的轮训', '覆盖语言、当地法规与跨文化管理，避免第二期布局时再次无人可派'];
  const NOTE = '占一期投资的 6%，这笔钱不能省', PILLS = ['含税年薪', '住房', '探亲', '保险'];
  const pill = (id, t) => ({ id, kind: 'tag', shape: 'pill', text: t, size: 14 });
  r = layout(11, { title: { text: TT }, kicker: { text: KICK, size: 14, w: MW }, columns: [{ items: [
    { kind: 'row', cell_gap: 2, cells: cols.map((c, i) => [Object.assign(pill(`ph${i}`, c.h), { size: 16, group: `c${i}` }), T(`pb${i}`, 'body', c.b.join('\n'), { indent: 1.4, para_gap: true, group: `c${i}` })]) },
    { kind: 'row', cell_gap: 3, ratios: [1.3, 1], region: 'bottom', gap: 3, cells: [
      [T('costH', 'heading', '外派成本测算', { group: 'k' }),
       { kind: 'row', cell_gap: 2, ratios: [1, 1.15], valign: 'center', group: 'k', cells: [
         [PAIR(T('n720', 'hero:big-number', '720'), T('l720', 'label', '万元 / 年\n核心团队 6 人'))],
         [PAIR({ id: 'brace', kind: 'brace' }, { kind: 'stack', items: [
           { kind: 'row', cell_gap: 2, cells: [[pill('pl0', PILLS[0])], [pill('pl1', PILLS[1])]] },
           { kind: 'row', cell_gap: 2, gap: 1, cells: [[pill('pl2', PILLS[2])], [pill('pl3', PILLS[3])]] }] })]] },
       T('note', 'body', NOTE, { group: 'k' })],
      [Object.assign(pill('poolTag', '海外后备干部池'), { size: 16, group: 'pool' }), T('pool', 'body', POOL.join('\n'), { indent: 1.4, para_gap: true, group: 'pool' })]] }] }] });
  bx = r.boxes;
  rect(s, bx.region, { fill: C.t1, name: 'panel:region' });
  title(s, bx.title, TT);
  text(s, mixed(KICK), bx.kicker, { color: C.gray, name: 'kicker' });
  const hot = { 1: ['财务、采购、质量'], 3: ['前 18 个月'] };
  cols.forEach((c, i) => {
    tag(s, bx[`ph${i}`], c.h, { fill: C.navy2 });
    const paras = c.b.map(t => {
      const k = (hot[i] || []).find(x => t.includes(x));
      if (!k) return mixed(t);
      const [a, b] = t.split(k);
      return [...mixed(a), ...mixed(k, { fontFace: ZH.bold, bold: true, color: C.accent }), ...mixed(b)];
    });
    text(s, null, bx[`pb${i}`], { name: 'body', paras, bullet: Math.round(1.4 * bx[`pb${i}`].size) });
  });
  text(s, '外派成本测算', bx.costH, { face: ZH.med, color: C.navy, name: 'heading' });
  text(s, [num('720')], bx.n720, { color: C.accent, nowrap: true, name: 'hero:big-number' });
  text(s, null, bx.l720, { color: C.accent, name: 'label', paras: ['万元 / 年', '核心团队 6 人'].map(l => mixed(l)) });
  s.addShape(pres.shapes.LEFT_BRACE, { x: P(bx.brace.x), y: P(bx.brace.y), w: P(bx.brace.w), h: P(bx.brace.h), line: { color: C.accent, width: 1 }, fill: { type: 'none' }, objectName: 'arrow' });
  PILLS.forEach((t, i) => tag(s, bx[`pl${i}`], t, { fill: C.white, color: C.navy }));
  text(s, mixed(NOTE), bx.note, { face: ZH.med, color: C.navy, name: 'body' });
  tag(s, bx.poolTag, '海外后备干部池', { fill: C.navy2 });
  const [pa, pb] = POOL[0].split('12 人');
  text(s, null, bx.pool, { name: 'body', bullet: Math.round(1.4 * bx.pool.size),
    paras: [[...mixed(pa), ...mixed('12 人', { fontFace: ZH.bold, bold: true, color: C.accent }), ...mixed(pb)], mixed(POOL[1])] });
}
s.addNotes('无图');

// ================================================================ 12 时间线（横向）：时间在线上方（年份 Bold，季度细体，重复年份只出现一次），内容在线下方，中间语义 icon；重点节点 accent；说明容器 + 箭头指向 2027 Q3
s = pres.addSlide();
{
  const TT = '落地路径：18 个月，验厂是硬节点';
  const nodes = [
    { id: 't0', y: '2026', q: 'Q4', text: '选址签约', ic: 'map-pin' },
    { id: 't1', y: '2027', q: 'Q1', text: '注册与 BOI / 投资许可', ic: 'certificate' },
    { id: 't2', q: 'Q2', text: '厂房改造与设备到港', ic: 'factory' },
    { id: 't3', q: 'Q3', text: '试产与客户验厂', ic: 'seal-check', hot: true },
    { id: 't4', q: 'Q4', text: '量产爬坡', ic: 'package' },
    { id: 't5', y: '2028', q: 'Q1', empty: true },
    { id: 't6', q: 'Q2', text: '一期达产', ic: 'gear' },
  ];
  const CO = '客户验厂必须在 2027 Q3 完成，否则错过 2028 年订单窗口';
  r = layout(12, { title: { text: TT }, columns: [{ items: [{ id: 'tl', kind: 'timeline', icon_em: 3.2, callout: { text: CO, at: 3 },
    nodes: nodes.map(n => ({ id: n.id, time: (n.y ? n.y + '\n' : '') + n.q, text: n.text, icon: !!n.ic, empty: !!n.empty })) }] }] });
  bx = r.boxes;
  title(s, bx.title, TT);
  const co = bx['tl.callout'];
  tag(s, co, CO, { fill: C.t1, color: C.navy2, face: ZH.med });      // 24 字 > 20 → 不用 accent（C-14），用 secondary
  const ar = bx['tl.arrow'];
  s.addShape(pres.shapes.DOWN_ARROW, { x: P(ar.x), y: P(ar.y), w: P(ar.w), h: P(ar.h), fill: { color: C.accent }, line: { type: 'none' }, objectName: 'arrow' });
  const ax = bx['tl.axis'];
  s.addShape(pres.shapes.LINE, { x: P(ax.x), y: P(ax.y), w: P(ax.w), h: 0, line: { color: C.navy2, width: 1, endArrowType: 'triangle' }, objectName: 'arrow' });
  nodes.forEach(n => {
    const col = n.hot ? C.accent : C.navy;
    const tb = bx[`${n.id}.time`];
    const paras = (n.y ? [[num(n.y, { color: col })]] : []).concat([[num(n.q, { bold: !!n.hot, color: col })]]);
    text(s, null, tb, { color: col, align: 'center', valign: 'bottom', name: 'heading', paras });
    const d = bx[`${n.id}.dot`];
    s.addShape(pres.shapes.OVAL, { x: P(d.x), y: P(d.y), w: P(d.w), h: P(d.h), fill: { color: n.empty ? C.muted : col }, line: { type: 'none' }, objectName: 'tag' });
    if (n.ic) icon(s, bx[`${n.id}.icon`], n.ic, n.hot ? C.accent : C.navy, 'duotone', C.light);
    if (n.text) text(s, mixed(n.text, n.hot ? { fontFace: ZH.bold, bold: true, color: C.accent } : {}), bx[`${n.id}.text`], { face: n.hot ? ZH.bold : ZH.med, bold: !!n.hot, color: col, align: 'center', name: 'body' });
  });
}
s.addNotes('无图');

// ================================================================ 13 一句话页（英文引言）：全屏氛围图 + 遮罩；16 汉字当量 → 48；英文用英文字体；原标题降为辅助行（细体，accent_light），出处小一号
s = pres.addSlide();
fullImage(s, '_qa/selected/13.jpg', 'image:full-bleed');
rect(s, { x: 0, y: 0, w: 960, h: 540 }, { fill: C.navy, transparency: 30, name: 'mask' });
{
  const Q = 'We are not asking you to leave China.', BY = '— Head of Sourcing, Customer A, Q2 2026 business review';
  const w = 570, x = (960 - w) / 2, size = 48, qh = 2 * size * LH;
  const total = qh + 16 + 18 * LH + 20 + 24 * LH, y0 = (540 - total) / 2;
  text(s, [{ text: Q, o: { fontFace: EN_DEMI, bold: true } }], { x, y: y0, w, h: qh, size }, { face: EN_DEMI, bold: true, color: C.white, name: 'hero:big-label' });
  text(s, [{ text: BY, o: { fontFace: EN } }], { x, y: y0 + qh + 16, w, h: 18 * LH, size: 18 }, { face: EN, color: C.white, name: 'body' });
  text(s, '客户原话：给我们第二个地址', { x, y: y0 + qh + 16 + 18 * LH + 20, w, h: 24 * LH, size: 24 }, { face: ZH.light, color: C.light, name: 'kicker' });
}
s.addNotes(credit('Mohannad Marashdeh', 'https://www.pexels.com/photo/low-angle-photo-of-buildings-405857/'));

// ================================================================ 14 方案页：第一层级 = 三个方案名（小标题级 accent）；胶囊「方案一 / 二 / 三」；推荐项 tertiary 填充，其余中性浅灰；35% 留在要点里加粗；决策句在卡片下方
s = pres.addSlide();
{
  const TT = '决策建议：先越南后印尼，本季度批准选址预算';
  const opts = [
    { tag: '方案一（推荐）', h: '先越南后印尼', b: ['2027 年越南一期投产，2029 年评估印尼二期', '三年累计投资 2.1 亿元，2029 年海外产能占比 35%'], hot: '35%', fill: C.t1 },
    { tag: '方案二', h: '只建泰国', b: ['单点投入 1.6 亿元，品质与风险最优，但成本优势最弱', '2029 年海外产能占比 20%，不满足客户 A 的 60% 要求'], hot: '20%', fill: C.pale },
    { tag: '方案三', h: '暂不建厂，用代工过渡', b: ['零资本投入', '但毛利下降 6 个点，且失去客户验厂资格'], fill: C.pale },
  ];
  const ASK = '需要管理层决定：本季度内批准方案一的选址预算 300 万元';
  r = layout(14, { title: { text: TT }, inset: 1.5, columns: [{ items: [
    { kind: 'row', cell_gap: 2, balance: true, stretch: true, cells: opts.map((o, i) => [{ id: `card${i}`, kind: 'card', tag: { id: `tg${i}`, shape: 'pill', text: o.tag, size: 16 },
      items: [T(`oh${i}`, 'heading', o.h, { group: 'o' }), T(`ob${i}`, 'body', o.b.join('\n'), { indent: 1.4, para_gap: true, group: 'o' })] }]) },
    T('ask', 'conclusion', ASK, { gap: 3 })] }] });
  bx = r.boxes;
  title(s, bx.title, TT);
  opts.forEach((o, i) => {
    rect(s, bx[`card${i}`], { fill: o.fill, round: 12, name: `card:${i + 1}` });
    tag(s, bx[`tg${i}`], o.tag, { fill: i === 0 ? C.accent : C.navy2 });
    text(s, o.h, bx[`oh${i}`], { face: ZH.med, color: i === 0 ? C.accent : C.navy, name: 'heading' });      // 高亮色集中在推荐项
    const paras = o.b.map(t => {
      if (i !== 0 || !o.hot || !t.includes(o.hot)) return mixed(t);
      const [a, b] = t.split(o.hot);
      return [...mixed(a), num(o.hot, { color: C.accent }), ...mixed(b)];
    });
    text(s, null, bx[`ob${i}`], { name: 'body', paras, bullet: Math.round(1.4 * bx[`ob${i}`].size), quiet: i !== 0 });
  });
  text(s, ASK, bx.ask, { face: ZH.med, color: C.navy, name: 'conclusion' });
}
s.addNotes('无图');

// ================================================================ 15 结束页
s = pres.addSlide();
rect(s, { x: 0, y: 0, w: 960, h: 540 }, { fill: C.navy, name: 'bg' });
text(s, '谢谢', { x: 180, y: 204, w: 600, h: 72, size: 60 }, { face: ZH.bold, bold: true, color: C.white, align: 'center', spc: 6, name: 'title' });
text(s, [{ text: '附录与数据来源见备注 · 图片：' }, { text: 'Pexels', o: { fontFace: EN } }, { text: '（' }, { text: 'Atlantic Ambience、zs Lin、Khunkorn Laowisit、Tom Fisk、Adiardi Zulfansyah、Wolfgang Weiser、Mohannad Marashdeh', o: { fontFace: EN } }, { text: '）' }],
  { x: 100, y: 470, w: 760, h: 28.8, size: 12 }, { color: C.white, align: 'center', name: 'body' });

fs.writeFileSync('_qa/layout/solved.json', JSON.stringify(solved, null, 1));
pres.writeFile({ fileName: 'deck.pptx' }).then(f => console.log('wrote', f));
