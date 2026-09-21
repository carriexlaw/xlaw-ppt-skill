// 北屿协作复盘 deck。内容元素的坐标、字号、g、p 全部来自 scripts/layout.py（14 §4c），本文件只写元素树与绘制。
// 生成后必须跑 scripts/postfix.py（英文字体 + bullet），再渲染、校验。 node build.js [页码...] 只影响日志，不影响输出。
const pptxgen = require('pptxgenjs');
const { execSync } = require('child_process');
const fs = require('fs');
const pres = new pptxgen();
pres.layout = 'LAYOUT_WIDE';                     // 960×540pt
const P = v => v / 72;
const ZH = { bold: 'Source Han Sans CN Bold', med: 'Source Han Sans CN Medium', light: 'Source Han Sans CN Light' };
const EN = 'Avenir Next', EN_DEMI = 'Avenir Next Demi Bold';
const C = { accent: 'EE6A2C', dark: '2E1F17', dark2: '5A3420', rust: 'A3501F', t1: 'FBF5EC', t2: 'F6F2EC', light: 'FFB48F', muted: 'BFB1A8',
  black: '000000', white: 'FFFFFF', body: '333333', gray: '7A7A7A', grayD: '4A4A4A', pale: 'F4F3F2', line: 'D9D2CC' };
const LH = 1.2;
const MW = 864;
const LAYOUT = '../../scripts/layout.py', ICON = '../../scripts/icon.py';
const PH = 'node_modules/@phosphor-icons/core/assets';
fs.mkdirSync('_qa/layout', { recursive: true });
fs.mkdirSync('_qa/icons', { recursive: true });
const failed = [];

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
    if (o.bullet && ri === 0) opt.bullet = { code: o.quiet ? '25CB' : '25CF', indent: o.bullet };
    if (ri === para.length - 1 && pi < paras.length - 1) opt.breakLine = true;
    if (box.para_gap && ri === 0 && pi > 0) opt.paraSpaceBefore = box.para_gap;
    rich.push({ text: r.text, options: opt });
  }));
  s.addText(rich, { x: P(box.x), y: P(box.y), w: P(box.w), h: P(box.h), margin: 0, valign: o.valign || box.valign || 'top', align: o.align || box.align || 'left',
    objectName: o.name, lineSpacing: size * LH, fontFace: face, fontSize: size, color: o.color || C.body, wrap: o.nowrap ? false : true });
}
const num = (t, o = {}) => ({ text: t, o: Object.assign({ fontFace: EN, bold: true }, o) });          // 数字 run：英文字体
const mixed = (t, o = {}) => t.split(/([A-Za-z0-9][A-Za-z0-9.,:%+]*\s?)/).filter(Boolean).map(x => /^[A-Za-z0-9]/.test(x) ? num(x, Object.assign({ bold: false }, o)) : { text: x, o });
// 句中关键词高亮：hots 里的片段加粗 + accent，其余照常
function rich(t, hots = [], o = {}) {
  const k = hots.map(h => [t.indexOf(h), h]).filter(x => x[0] >= 0).sort((a, b) => a[0] - b[0])[0];
  if (!k) return mixed(t, o);
  const [i, h] = k;
  return [...mixed(t.slice(0, i), o), ...mixed(h, Object.assign({}, o, { color: C.accent })).map(r => { if (r.o.fontFace === EN) { r.o.bold = true; if (o.noBold) r.o.fontFace = EN_DEMI; } else if (!o.noBold) { r.o.bold = true; r.o.fontFace = ZH.bold; } return r; }), ...rich(t.slice(i + h.length), hots, o)];
}
function title(s, box, t, color = C.black) { text(s, mixed(t, { fontFace: undefined }).map(r => (r.o.fontFace = /^[A-Za-z0-9]/.test(r.text) ? EN : ZH.bold, r.o.bold = true, r)), box, { face: ZH.bold, bold: true, color, spc: box.spc, name: 'title' }); }
function image(s, path, box, name) {
  s.addImage({ path, x: P(box.x), y: P(box.y), w: P(box.img_w), h: P(box.img_h), sizing: { type: 'cover', w: P(box.w), h: P(box.h) }, objectName: name });
}
const dimsOf = path => execSync(`python3 -c "from PIL import Image;im=Image.open('${path}');print(im.size[0],im.size[1])"`).toString().trim().split(' ').map(Number);
function fullImage(s, path, name) {
  const [pw, ph] = dimsOf(path);
  const a = pw / ph, b = 960 / 540, w = a > b ? 540 * a : 960, h = a > b ? 540 : 960 / a;
  s.addImage({ path, x: 0, y: 0, w: P(w), h: P(h), sizing: { type: 'cover', w: P(960), h: P(540) }, objectName: name });
}
function rect(s, box, o) {
  s.addShape(o.round ? pres.shapes.ROUNDED_RECTANGLE : pres.shapes.RECTANGLE, { x: P(box.x), y: P(box.y), w: P(box.w), h: P(box.h),
    fill: o.fill ? { color: o.fill, transparency: o.transparency || 0 } : { type: 'none' }, line: o.line ? { color: o.line, width: 0.75 } : { type: 'none' },
    rectRadius: o.round ? P(o.round) : undefined, objectName: o.name });
}
function tag(s, box, t, o = {}) {
  const shape = box.shape === 'circle' ? pres.shapes.OVAL : pres.shapes.ROUNDED_RECTANGLE;
  const base = { fontFace: o.face || ZH.med, fontSize: box.size, color: o.color || C.white, bold: !!o.bold };
  const runs = (Array.isArray(t) ? t : mixed(t)).map(r => ({ text: r.text, options: Object.assign({}, base, r.o && r.o.fontFace === EN ? { fontFace: EN } : {}) }));
  s.addText(runs, { shape, x: P(box.x), y: P(box.y), w: P(box.w), h: P(box.h),
    fill: { color: o.fill || C.dark2 }, line: { type: 'none' }, rectRadius: box.shape === 'circle' ? undefined : P(box.shape === 'round' ? 8 : box.h / 2), margin: 0, align: 'center', valign: 'middle',
    lineSpacing: box.size * LH, fontFace: o.face || ZH.med, fontSize: box.size, color: o.color || C.white, objectName: 'tag' });
}
const _icons = {};
function icon(s, box, name, color, style = 'duotone', secondary = null) {
  const key = `${name}-${style}-${color}${secondary ? '-' + secondary : ''}`;
  if (!_icons[key]) {
    const out = `_qa/icons/${key}.png`;
    if (!fs.existsSync(out)) execSync(`python3 ${ICON} ${PH}/${style}/${name}${style === 'regular' ? '' : '-' + style}.svg ${out} --color ${color}${secondary ? ' --secondary ' + secondary : ''} --px 384`);
    _icons[key] = out;
  }
  s.addImage({ path: _icons[key], x: P(box.x), y: P(box.y), w: P(box.w), h: P(box.h), objectName: 'icon' });
}
const pagenum = (s, n) => s.addText([{ text: String(n), options: { fontFace: EN, fontSize: 10.5, color: C.gray } }], { x: P(880), y: P(508), w: P(32), h: P(12.6), margin: 0, align: 'right', valign: 'top', fontFace: EN, fontSize: 10.5, color: C.gray, objectName: 'pagenum' });

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
  try { out = execSync(`python3 ${LAYOUT} ${inPath} --deck deck.manifest.yaml --write-g`, { stdio: ['pipe', 'pipe', 'pipe'] }).toString(); }
  catch (e) { out = e.stdout.toString(); let notes; try { notes = JSON.parse(out).notes; } catch (_) { notes = [e.stderr.toString().slice(-600)]; } throw new Error('layout 失败: ' + notes.join(' | ')); }
  fs.writeFileSync(outPath, out);
  const r = JSON.parse(out);
  console.log(`page ${pageNo}: g=${r.g} p=${r.p} sizes=${JSON.stringify(r.sizes)}` + (r.notes.length ? ' | ' + r.notes.join(' | ') : ''));
  return r;
}
const _nw = {};
function NW(t) {
  if (_nw[t] === undefined) {
    const em = Number(execSync(`python3 -c "from PIL import ImageFont;import sys;f=ImageFont.truetype('/System/Library/Fonts/Avenir Next.ttc',1000,index=0);print(f.getlength(sys.argv[1])/1000)" "${t}"`).toString());
    let est = [...t].reduce((a, c) => a + (c === ' ' ? 0.3 : 0.55 * 1.25), 0), pad = '';
    const need = em + 0.12 + 0.5 * (t.split('→').length - 1);      // LibreOffice / PowerPoint 里 → 常回退到更宽的字形
    _nw[t] = t;
  }
  return _nw[t];
}
const numUnit = (n, unit, box, color) => [num(n, { color })].concat(unit ? [{ text: '\u2009' + unit, o: { fontFace: ZH.bold, bold: true, fontSize: box.unit_size, color } }] : []);
// 前后对比小表：上行 = 对比维度（时间 / 口径），下行 = 前值（深色）→ 后值（accent）
function compare(s, box, caps, vals, o = {}) {
  const b = { type: 'none' }, border = [b, b, b, b], cs = o.capSize || 20, ns = o.numSize || 48, aw = ns * 1.3, cw = (box.w - aw) / 2;
  const cell = (runs, align) => ({ text: runs, options: { border, margin: 0, valign: 'middle', align } });
  const cap = t => cell(mixed(t).map(r => ({ text: r.text, options: { fontFace: r.o.fontFace === EN ? EN : ZH.light, fontSize: cs, color: C.dark } })), 'left');
  const nm = (t, col) => cell([{ text: t, options: { fontFace: EN, bold: true, fontSize: ns, color: col } }], 'left');
  s.addTable([[cap(caps[0]), cell([{ text: ' ', options: { fontFace: EN, fontSize: cs, color: C.dark } }], 'left'), cap(caps[1])], [nm(vals[0], C.dark2), nm('→', C.dark2), nm(vals[1], C.accent)]],
    { x: P(box.x), y: P(box.y), w: P(box.w), h: P(box.h), colW: [P(cw), P(aw), P(cw)], rowH: [P(cs * 1.5), P(box.h - cs * 1.5)], objectName: 'table' });
}
const T = (id, role, txt, extra = {}) => Object.assign({ id, kind: 'text', role, text: txt }, extra);
const PAIR = (left, right, extra = {}) => Object.assign({ kind: 'pair', left, right }, extra);
const IC = (id, em) => ({ id, kind: 'icon', em });
const pill = (id, t, size = 16) => ({ id, kind: 'tag', shape: 'pill', text: t, size });
const bulletsOf = (s, box, arr, o = {}) => text(s, null, box, Object.assign({ name: 'body', bullet: Math.round(1.4 * box.size), paras: arr.map(t => rich(t, o.hots || [])) }, o));

// 内容页包装：失败的页留一张空白占位，保证页码不串，最后统一报错
function content(n, fn) {
  const s = pres.addSlide();
  try { fn(s); pagenum(s, n); s._ok = true; }
  catch (e) { failed.push(n); console.error(`page ${n}: ${e.message}`); }
}
const chartBase = (bx, name) => ({ x: P(bx.x), y: P(bx.y), w: P(bx.w), h: P(bx.h), showTitle: false, showLegend: false,
  catAxisLabelFontFace: EN, catAxisLabelFontSize: 14, catAxisLabelFontBold: true, catAxisLabelColor: C.dark, valAxisHidden: true, valGridLine: { style: 'none' }, catGridLine: { style: 'none' },
  catAxisLineShow: false, valAxisLineShow: false, plotArea: { fill: { color: C.white } }, objectName: name });

let s;
// ================================================================ 1 封面：8 个字 → 54；副标题细体 24；署名贴底
s = pres.addSlide();
fullImage(s, '_qa/selected/01.jpg', 'image:full-bleed');
rect(s, { x: 0, y: 0, w: 960, h: 540 }, { fill: C.dark, transparency: 35, name: 'mask' });
text(s, '把增长交还给留存', { x: 180, y: 200, w: 600, h: 64.8, size: 54 }, { face: ZH.bold, bold: true, color: C.white, align: 'center', spc: 5.4, name: 'title' });
text(s, mixed('北屿协作 2026 前三季度产品复盘与 2027 规划'), { x: 130, y: 282, w: 700, h: 28.8, size: 24 }, { color: C.white, align: 'center', name: 'kicker' });
text(s, mixed('产品与增长中心 · 2026 年 10 月'), { x: 180, y: 476, w: 600, h: 24, size: 20 }, { color: C.white, align: 'center', name: 'body' });
s.addNotes('Photo: cottonbro studio / Pexels — https://www.pexels.com/photo/workstations-of-a-startup-software-company-6804612/');

// ================================================================ 2 目录：配图方式 5（左，28% 宽，满高）
s = pres.addSlide();
{
  const IW = 0.28 * 960, [pw, ph] = dimsOf('_qa/selected/02.jpg'), a = pw / ph, bb = IW / 540;
  image(s, '_qa/selected/02.jpg', { x: 0, y: 0, w: IW, h: 540, img_w: a > bb ? 540 * a : IW, img_h: a > bb ? 540 : IW / a }, 'image:atmosphere');
  text(s, '目录', { x: IW + 72, y: 72, w: 300, h: 48, size: 40 }, { face: ZH.bold, bold: true, color: C.black, spc: 4, name: 'title' });
  const items = ['发生了什么', '问题出在哪', '今年做了什么', '明年怎么打', '需要决策的事'];
  const x0 = 500, step = 64, y0 = (540 - (4 * step + 48)) / 2;
  items.forEach((t, i) => {
    text(s, [num('0' + (i + 1), { fontFace: EN_DEMI, bold: true })], { x: x0, y: y0 + i * step, w: 72, h: 48, size: 40 }, { color: C.muted, name: 'label' });
    text(s, t, { x: x0 + 84, y: y0 + i * step + 4.8, w: 300, h: 38.4, size: 32 }, { face: ZH.light, color: C.dark, name: 'body' });
  });
}
s.addNotes('Photo: Scott Webb / Pexels — https://www.pexels.com/photo/low-angle-photography-of-curtain-wall-614228/');

// ================================================================ 一句话页（图 + 遮罩）
function statement(path, maskT, lines, size, note, kicker, dy = 0) {
  const s = pres.addSlide();
  fullImage(s, path, 'image:full-bleed');
  rect(s, { x: 0, y: 0, w: 960, h: 540 }, { fill: C.dark, transparency: maskT, name: 'mask' });
  const w = 640, h = lines.length * size * LH, kh = kicker ? 24 + 24 * LH : 0, y = (540 - h - kh) / 2 + dy;
  text(s, null, { x: (960 - w) / 2, y, w, h, size }, { face: ZH.bold, bold: true, color: C.white, align: 'center', name: 'hero:big-label', paras: lines });
  if (kicker) text(s, mixed(kicker), { x: (960 - w) / 2, y: y + h + 24, w, h: 24 * LH, size: 24 }, { color: C.light, align: 'center', name: 'kicker' });
  s.addNotes(note);
  return s;
}
const HL = { color: C.light };
const bn = (t, o = {}) => num(t, Object.assign({ bold: true }, o));
// 3 核心结论：33 字 → 40，三行，折在标点处并省略行尾标点
statement('_qa/selected/03.jpg', 40, [[{ text: '买量换不来增长了' }], [{ text: '获客成本两年' }, { text: '翻了一倍', o: HL }], [{ text: '而留下来的老团队贡献了' }, { text: '九成收入', o: HL }]], 40,
  'Photo: 马 力 / Pexels — https://www.pexels.com/photo/stunning-twilight-cityscape-over-expansive-urban-landscape-34617907/', null, -60);      // 文字块上移到天空里，让开下沿的城市灯火

// ================================================================ 章节页
function section(no, t) {
  const s = pres.addSlide();
  rect(s, { x: 0, y: 0, w: 960, h: 540 }, { fill: C.t2, name: 'bg' });
  text(s, [num(no, { fontFace: EN_DEMI })], { x: 180, y: 170, w: 600, h: 33.6, size: 28 }, { color: C.accent, align: 'center', name: 'label' });
  text(s, t, { x: 180, y: 222, w: 600, h: 64.8, size: 54 }, { face: ZH.bold, bold: true, color: C.dark, align: 'center', spc: 5.4, name: 'title' });
}
section('01', '发生了什么');                                                                          // 4

// ================================================================ 5 大盘：四项规模指标并列（数字 + 释义），右侧区域背景 = 增速腰斩（46% → 18%）
content(5, s => {
  // 论据 = 四项规模指标（深色、低饱和 icon、单位跟着数字）；结论 = 增速腰斩（贴底大区域，两个时间标在数字上方，只有 18% 用 accent）
  const TT = '大盘：规模还在涨，但增速腰斩';
  const K = [['users-three', '48.6', '万', '累计注册团队'], ['crown-simple', '3.9', '万', '付费团队'], ['user', '312', '万', '月活用户（MAU）'], ['coins', '2.34', '亿', '年度经常性收入\n（ARR）']];
  const r = layout(5, { title: { text: TT }, columns: [{ items: [
    { kind: 'row', cell_gap: 2, cells: K.map((k, i) => [Object.assign(IC(`i${i}`, 3.0), { align: 'center' }), T(`n${i}`, 'hero:big-number', k[1], { unit: k[2], unit_size: 24, align: 'center', nowrap: true, gap: 1, group: `k${i}` }),
      T(`l${i}`, 'label', k[3], { tier: 'fixed', size: 18, align: 'center', gap: 1, group: `k${i}` })]) },
    { kind: 'row', cell_gap: 2, ratios: [1.35, 1.75, 1.1], valign: 'center', region: 'bottom', gap: 3, cells: [[T('gh', 'heading', 'ARR 同比增长')], [{ id: 'cmp', kind: 'box', role: 'table', h: 112 }],
      [T('gb', 'body', '截至 2026 年 9 月\n去年同期这个数字是 46%')]] }] }] });
  const bx = r.boxes;
  rect(s, bx.region, { fill: C.t1, name: 'panel:region' });
  title(s, bx.title, TT);
  K.forEach((k, i) => {
    icon(s, bx[`i${i}`], k[0], C.dark2, 'duotone', C.muted);
    text(s, numUnit(k[1], k[2], bx[`n${i}`], C.dark2), bx[`n${i}`], { color: C.dark2, align: 'center', nowrap: true, name: 'hero:big-number' });
    text(s, null, bx[`l${i}`], { face: ZH.med, color: C.dark, align: 'center', name: 'label', paras: k[3].split('\n').map(l => mixed(l, { fontFace: ZH.med })) });
  });
  text(s, mixed('ARR 同比增长', { fontFace: ZH.med }), bx.gh, { face: ZH.med, color: C.dark, name: 'heading' });
  compare(s, bx.cmp, ['2025.9', '2026.9'], ['46%', '18%'], { capSize: 24 });
  text(s, null, bx.gb, { name: 'body', paras: ['截至 2026 年 9 月', '去年同期这个数字是 46%'].map(l => mixed(l)) });
  s.addNotes('无图');
});

// ================================================================ 6 趋势：半宽柱图（买量 accent，自然流量 data_muted）+ 买量趋势线；右侧自绘序列名 + 结论
content(6, s => {
  const TT = '买量带来的新增已连续四个季度下滑', CT = '季度新增注册团队数（万个）';
  const CONC = '买量新增从 2025 年三季度的高点一路下滑，2026 年一季度起被自然流量与成员邀请反超', SRC = '来源：北屿数据平台，截至 2026 年 9 月 30 日';
  const LG = (id, t) => PAIR({ id: id + 's', kind: 'icon', em: 1.1 }, T(id + 't', 'legend', t, { tier: 'fixed', size: 20 }), { group: 'lg' });
  const r = layout(6, { title: { text: TT }, column_gap: 3, columns: [
    { items: [T('ct', 'heading', CT, { tier: 'fixed', size: 20, group: 'c' }), { id: 'chart', kind: 'chart', role: 'hero:chart', aspect: 0.62, group: 'c' }, T('src', 'source', SRC, { size: 10.5, group: 'c' })] },
    { items: [LG('l0', '买量'), LG('l1', '自然流量与成员邀请'), T('conc', 'conclusion', CONC, { gap: 3 })] }] });
  const bx = r.boxes;
  title(s, bx.title, TT);
  text(s, CT, bx.ct, { face: ZH.med, color: C.dark, name: 'heading' });
  const labels = ['25 Q1', '25 Q2', '25 Q3', '25 Q4', '26 Q1', '26 Q2', '26 Q3'], buy = [2.1, 2.4, 2.6, 2.5, 2.2, 1.9, 1.6], org = [1.8, 1.9, 2.1, 2.2, 2.3, 2.5, 2.7];
  s.addChart([
    { type: pres.charts.BAR, data: [{ name: '买量', labels, values: buy }, { name: '自然流量与成员邀请', labels, values: org }],
      options: { barDir: 'col', barGrouping: 'clustered', barGapWidthPct: 60, chartColors: [C.accent, C.muted], showValue: true, dataLabelFormatCode: '0.0', dataLabelFontFace: EN, dataLabelFontSize: 12, dataLabelColor: C.body, dataLabelPosition: 'outEnd' } },
    { type: pres.charts.LINE, data: [{ name: '买量趋势', labels, values: buy }], options: { chartColors: [C.dark], lineSize: 1.25, lineSmooth: true, lineDataSymbol: 'none', showValue: false } },
  ], chartBase(bx.chart, 'hero:chart'));
  text(s, mixed(SRC), bx.src, { color: C.gray, name: 'source' });
  [['l0', '买量', C.accent], ['l1', '自然流量与成员邀请', C.muted]].forEach(([id, t, col]) => {
    rect(s, bx[id + 's'], { fill: col, name: 'legend' });
    text(s, t, bx[id + 't'], { face: ZH.med, color: C.dark, valign: 'middle', name: 'legend' });
  });
  text(s, mixed(CONC), bx.conc, { face: ZH.med, color: C.dark2, name: 'conclusion' });
  s.addNotes('无图');
});

// ================================================================ 7 三对数据（前 → 后）；右侧区域背景 = 三个原因（语义 icon）
content(7, s => {
  // 重点 = 三个原因（左侧主区：提炼的小标题 + icon + 说明）；翻倍的数据只是现象，收进右侧区域容器，每对数据带名称与单位，只有翻倍后的数字用 accent
  const TT = '获客成本两年翻倍', KICK = '原因有三个', SCOPE = '2024 年 → 2026 年前三季度';
  const WHY = [['渠道涨价', 'cursor-click', '信息流渠道的单次点击价格两年上涨 64%'], ['竞品投放', 'megaphone', '三家主要竞品同期都加大了投放'], ['转化下降', 'trend-down', '我们自己的落地页转化率从 4.1% 降到了 3.2%']];
  const K = [[['单个注册团队', ' 获客成本'], '86', '178', '元'], [['付费团队', ' 获客成本'], '1,080', '2,230', '元'], [['回本周期', ''], '2.2', '4.5', '个月']];
  const r = layout(7, { title: { text: TT, w: 480 }, kicker: { text: KICK, size: 16, w: 480 }, column_gap: 3, columns: [
    { items: [{ kind: 'row', cell_gap: 2, cells: WHY.map((w, i) => [T(`h${i}`, 'heading', w[0], { align: 'center' }), Object.assign(IC(`i${i}`, 6), { align: 'center', gap: 2 }), T(`b${i}`, 'body', w[2], { gap: 2 })]) }] },
    { region: true, items: [T('scope', 'body', SCOPE, { tier: 'fixed', size: 16 })].concat(K.flatMap((k, i) => [T(`kh${i}`, 'heading', k[0].join(''), { tier: 'fixed', size: 20, gap: i ? 2 : 1, group: `k${i}` }),
      T(`kn${i}`, 'heading', `${k[1]} → ${k[2]}`, { tier: 'fixed', size: 32, unit: k[3], unit_size: 16, nowrap: true, gap: 1, group: `k${i}` })])) }] });
  const bx = r.boxes;
  rect(s, bx.region, { fill: C.t1, name: 'panel:region' });
  title(s, bx.title, TT);
  text(s, KICK, bx.kicker, { color: C.gray, name: 'kicker' });
  WHY.forEach((w, i) => {
    text(s, w[0], bx[`h${i}`], { face: ZH.med, color: C.rust, align: 'center', name: 'heading' });
    icon(s, bx[`i${i}`], w[1], C.dark, 'duotone', C.light);
    text(s, mixed(w[2]), bx[`b${i}`], { name: 'body' });
  });
  text(s, mixed(SCOPE), bx.scope, { color: C.gray, name: 'body' });
  K.forEach((k, i) => {
    text(s, [{ text: k[0][0], o: { fontFace: ZH.med } }, { text: k[0][1], o: { fontFace: ZH.light } }], bx[`kh${i}`], { face: ZH.med, color: C.dark, name: 'heading' });
    const b = bx[`kn${i}`];
    text(s, [num(`${k[1]} → `, { color: C.dark2 }), num(k[2], { color: C.accent }), { text: ' ' + k[3], o: { fontFace: ZH.med, fontSize: b.unit_size, color: C.accent } }], b, { nowrap: true, name: 'heading' });
  });
  s.addNotes('无图');
});

// ================================================================ 8 占比：Doughnut + 自绘序列名（带占比）+ 结论
content(8, s => {
  const TT = '收入从哪来', CT = '2026 年前三季度收入 1.71 亿元', CONC = '这不是一门新客的生意，是一门老客的生意';
  const SER = [['存量团队续费', '58%', C.accent], ['存量团队加席位', '31%', C.light], ['当年新签团队', '11%', C.muted]];
  const LG = (id, t) => PAIR({ id: id + 's', kind: 'icon', em: 1.0 }, T(id + 't', 'legend', t, { tier: 'fixed', size: 24 }), { group: 'lg' });
  const r = layout(8, { title: { text: TT }, column_gap: 3, columns: [
    { items: [T('ct', 'heading', CT, { tier: 'fixed', size: 24, align: 'center', group: 'c' }), { id: 'pie', kind: 'chart', role: 'hero:chart', aspect: 0.66, group: 'c' }] },
    { items: SER.map((x, i) => LG('l' + i, `${x[0]}　${x[1]}`)).concat([T('conc', 'conclusion', CONC, { gap: 3 })]) }] });
  const bx = r.boxes;
  title(s, bx.title, TT);
  text(s, mixed(CT), bx.ct, { face: ZH.med, color: C.dark, align: 'center', name: 'heading' });
  s.addChart(pres.charts.DOUGHNUT, [{ name: '收入来源', labels: SER.map(x => x[0]), values: [58, 31, 11] }], Object.assign(chartBase(bx.pie, 'hero:chart'),
    { holeSize: 56, chartColors: SER.map(x => x[2]), showValue: false, showPercent: false, showLabel: false, dataBorder: { pt: 1.5, color: C.white } }));
  SER.forEach((x, i) => {
    rect(s, bx[`l${i}s`], { fill: x[2], name: 'legend' });
    text(s, [{ text: x[0] + '　' }, num(x[1], { color: i === 0 ? C.accent : C.dark })], bx[`l${i}t`], { face: ZH.med, color: C.dark, valign: 'middle', name: 'legend' });
  });
  text(s, CONC, bx.conc, { face: ZH.med, color: C.dark, name: 'conclusion' });
  s.addNotes('无图');
});

section('02', '问题出在哪');                                                                          // 9

// ================================================================ 10 漏斗：横向条形图，「邀请」一步 accent；右侧区域背景 = 64% → 30% + 结论
content(10, s => {
  const TT = '新团队是在哪一步走掉的', CT = '2026 年三季度注册的 43,000 个团队';
  const CONC = '最大的一次流失发生在「邀请第二个人」这一步', B = '一个人用的协作工具留不住人';
  const r = layout(10, { title: { text: TT }, column_gap: 3, columns: [
    { items: [T('ct', 'heading', CT, { tier: 'fixed', size: 24, group: 'c' }), { id: 'chart', kind: 'chart', role: 'hero:chart', group: 'c' }] },
    { region: true, items: [{ id: 'cmp', kind: 'box', role: 'table', h: 96 }, T('conc', 'conclusion', CONC, { gap: 2 }), T('b', 'body', B, { gap: 2 })] }] });
  const bx = r.boxes;
  rect(s, bx.region, { fill: C.t1, name: 'panel:region' });
  title(s, bx.title, TT);
  text(s, mixed(CT), bx.ct, { face: ZH.med, color: C.dark, name: 'heading' });
  const labels = ['注册  100%', '创建首个项目  64%', '邀请到第 2 名成员  30%', '第 7 天仍活跃  19%', '30 天内付费  8%'];
  s.addChart(pres.charts.BAR, [{ name: '团队数', labels, values: [43000, 27500, 12900, 8200, 3440] }], Object.assign(chartBase(bx.chart, 'hero:chart'),
    { barDir: 'bar', barGapWidthPct: 45, chartColors: [C.muted, C.muted, C.accent, C.muted, C.muted], catAxisOrientation: 'maxMin', catAxisLabelFontFace: ZH.med, catAxisLabelFontSize: 14, catAxisLabelFontBold: false,
      showValue: true, dataLabelFormatCode: '#,##0', dataLabelFontFace: EN, dataLabelFontSize: 14, dataLabelFontBold: true, dataLabelColor: C.dark, dataLabelPosition: 'outEnd' }));
  compare(s, bx.cmp, ['创建首个项目', '邀请到第 2 名成员'], ['64%', '30%'], { capSize: 14, numSize: 40 });
  text(s, mixed(CONC), bx.conc, { face: ZH.med, color: C.dark, name: 'conclusion' });
  text(s, B, bx.b, { name: 'body' });
  s.addNotes('无图');
});

// ================================================================ 11 对比双框：邀请成功（accent 描边）/ 从未邀请成功（深灰描边）
content(11, s => {
  const TT = '来了第二个人，一切都不一样';
  const G = [{ t: '成功邀请过成员的团队', n: [['41%', '30 日留存'], ['24%', '付费转化']], col: C.accent, hero: true }, { t: '从未邀请成功的团队', n: [['4%', '30 日留存'], ['1.2%', '付费转化']], col: C.grayD }];
  const r = layout(11, { title: { text: TT }, inset: 1.6, columns: [{ items: [
    { kind: 'row', cell_gap: 3, stretch: true, cells: G.map((g, i) => [{ id: `card${i}`, kind: 'card', tag: { id: `tg${i}`, shape: 'pill', text: g.t, size: 18 },
      items: [{ kind: 'row', cell_gap: 2, cells: g.n.map((n, j) => [T(`n${i}${j}`, g.hero ? 'hero:big-number' : 'heading', n[0], { tier: 'number', nowrap: true, group: 'k' }), T(`l${i}${j}`, 'label', n[1], { tier: 'fixed', size: 28, group: 'k' })]) }] }]) }] }] });
  const bx = r.boxes;
  title(s, bx.title, TT);
  G.forEach((g, i) => {
    rect(s, bx[`card${i}`], { line: g.col, round: 12, name: `card:${i + 1}` });
    tag(s, bx[`tg${i}`], g.t, { fill: g.col });
    g.n.forEach((n, j) => {
      text(s, [num(n[0])], bx[`n${i}${j}`], { color: g.col, nowrap: true, name: g.hero ? 'hero:big-number' : 'heading' });
      text(s, mixed(n[1]), bx[`l${i}${j}`], { color: C.dark, name: 'label' });
    });
  });
  s.addNotes('无图');
});

// ================================================================ 12 三类并列：语义 icon + 类型小标题 + bullet；重点组件 = 运营类（accent 集中在它身上）
content(12, s => {
  const TT = '付费团队主要是三类', CONC = '运营类团队是流失的重灾区，原因是用工有季节性、人员流动大';
  const G = [{ ic: 'code', h: '软件与互联网研发团队', b: ['占付费团队的 41%', '平均 16 席', '最常用的功能是迭代看板', '年续费率 92%'] },
    { ic: 'paint-brush', h: '设计与创意工作室', b: ['占 34%', '平均 9 席', '最常用的功能是文件评审', '年续费率 88%'] },
    { ic: 'storefront', h: '电商与新媒体运营团队', b: ['占 25%', '平均 7 席', '最常用的功能是内容日历', '年续费率 71%'], hot: true }];
  const r = layout(12, { title: { text: TT }, columns: [{ items: [
    { kind: 'row', cell_gap: 3, cells: G.map((g, i) => [IC(`i${i}`, 3.0), T(`h${i}`, 'heading', g.h, { group: `g${i}`, gap: 1 }), T(`b${i}`, 'body', g.b.join('\n'), { indent: 1.4, para_gap: true, group: `g${i}` })]) },
    T('conc', 'conclusion', CONC, { gap: 3, tier: 'fixed', size: 20 })] }] });
  const bx = r.boxes;
  title(s, bx.title, TT);
  G.forEach((g, i) => {
    icon(s, bx[`i${i}`], g.ic, C.dark, 'duotone', g.hot ? C.accent : C.muted);
    text(s, g.h, bx[`h${i}`], { face: ZH.med, color: g.hot ? C.accent : C.dark, name: 'heading' });
    bulletsOf(s, bx[`b${i}`], g.b, { hots: g.hot ? ['71%'] : [], quiet: !g.hot });
  });
  text(s, CONC, bx.conc, { face: ZH.med, color: C.dark2, name: 'conclusion' });
  s.addNotes('无图');
});

// ================================================================ 13 英文引言：18 汉字当量 → 48，三行；原标题降为辅助行
s = pres.addSlide();
fullImage(s, '_qa/selected/13.jpg', 'image:full-bleed');
rect(s, { x: 0, y: 0, w: 960, h: 540 }, { fill: C.dark, transparency: 40, name: 'mask' });
{
  const size = 48, w = 580, x = (960 - w) / 2, qh = 3 * size * LH, total = qh + 16 + 18 * LH + 20 + 24 * LH, y0 = (540 - total) / 2;
  const q = ['Great for me.', 'Useless until', 'my team shows up.'].map(t => [{ text: t, o: { fontFace: EN_DEMI, bold: true } }]);
  text(s, null, { x, y: y0, w, h: qh, size }, { face: EN_DEMI, bold: true, color: C.white, name: 'hero:big-label', paras: q });
  text(s, [{ text: '— App Store review, Singapore, Aug 2026', o: { fontFace: EN } }], { x, y: y0 + qh + 16, w, h: 18 * LH, size: 18 }, { face: EN, color: C.white, name: 'body' });
  text(s, '用户原话：团队不来，工具没用', { x, y: y0 + qh + 16 + 18 * LH + 20, w, h: 24 * LH, size: 24 }, { face: ZH.light, color: C.light, name: 'kicker' });
}
s.addNotes('Photo: Magda Ehlers / Pexels — https://www.pexels.com/photo/lonely-sailboat-on-vast-open-ocean-38201634/');

// ================================================================ 14 三句原话：三张描边卡（≥ 3 个多行组），压角胶囊 = 团队规模，小标题 = 受访者
content(14, s => {
  const TT = '访谈里反复听到的三句话';
  const Q = [['9 人团队', '设计工作室\n负责人', '我自己注册完觉得挺好，但同事懒得装，两周后我也不打开了', ['同事懒得装']],
    ['23 人团队', '研发经理', '真正让我们续费的不是功能多，是全组的任务都在这儿，搬不走', ['全组的任务都在这儿']],
    ['6 人团队', '电商运营主管', '大促一完兼职就散了，席位空着还要付钱，干脆降回免费版', ['兼职就散了']]];
  const r = layout(14, { title: { text: TT }, inset: 1, columns: [{ items: [
    { kind: 'row', cell_gap: 2, stretch: true, cells: Q.map((q, i) => [{ id: `card${i}`, kind: 'card', tag: { id: `tg${i}`, shape: 'pill', text: q[0], size: 16 },
      items: [T(`h${i}`, 'heading', q[1], { tier: 'fixed', size: 24, group: 'q' }), T(`b${i}`, 'body', `「${q[2]}」`, { group: 'q' })] }]) }] }] });
  const bx = r.boxes;
  title(s, bx.title, TT);
  Q.forEach((q, i) => {
    rect(s, bx[`card${i}`], { line: C.dark2, round: 12, name: `card:${i + 1}` });
    tag(s, bx[`tg${i}`], q[0], { fill: C.dark2 });
    text(s, null, bx[`h${i}`], { face: ZH.med, color: C.dark, name: 'heading', paras: q[1].split('\n').map(l => [{ text: l }]) });
    text(s, rich(`「${q[2]}」`, q[3]), bx[`b${i}`], { name: 'body' });
  });
  s.addNotes('无图');
});

// ================================================================ 15 表格：Android 列 accent，目标列灰；结论一行在表下
content(15, s => {
  const TT = 'Android 是体验短板：四项指标垫底，工单占近一半', KICK = '2026 年三季度各端体验指标';
  const CONC = '被邀请的成员里有 52% 用的是 Android 手机，他们的第一印象就是这一端';
  const rows = [[KICK, 'Web', '桌面端', 'iOS', 'Android', '目标'],
    ['冷启动耗时 P90（秒）', '2.8', '3.6', '1.9', '3.1', '≤ 2.0'], ['文档首屏加载 P90（秒）', '1.7', '1.4', '2.2', '2.9', '≤ 1.5'], ['崩溃率（‰）', '—', '1.2', '0.6', '2.4', '≤ 1.0'],
    ['同步冲突率（‰）', '3.1', '2.7', '4.8', '5.2', '≤ 2.0'], ['应用商店评分', '—', '—', '4.7', '3.9', '≥ 4.5'], ['客服工单占比', '22%', '18%', '14%', '46%', '—']];
  const r = layout(15, { title: { text: TT }, columns: [
    { items: [{ id: 'tbl', kind: 'table', role: 'hero:table', rows: rows.length, row_min: 30 }, T('conc', 'conclusion', CONC, { tier: 'fixed', size: 20, gap: 2 })] }] });
  const bx = r.boxes;
  title(s, bx.title, TT);
  const border = [{ type: 'none' }, { type: 'none' }, { type: 'solid', color: C.line, pt: 0.75 }, { type: 'none' }];
  const w = bx.tbl.w, c1 = w * 0.32, c2 = (w - c1) / 5;
  const cell = (c, ri, ci) => {
    const o = { border, margin: [2, 8, 2, 8], valign: 'middle', align: ci === 0 ? 'left' : 'center' };
    if (ri === 0) return { text: mixed(c).map(x => ({ text: x.text, options: { fontFace: x.o.fontFace === EN ? EN_DEMI : ZH.med, fontSize: 16, color: C.white } })), options: Object.assign(o, { fill: { color: ci === 4 ? C.accent : C.dark } }) };
    if (ci === 0) return { text: mixed(c).map(x => ({ text: x.text, options: { fontFace: x.o.fontFace === EN ? EN : ZH.light, fontSize: 18, color: C.dark } })), options: o };
    return { text: c, options: Object.assign(o, { fontFace: EN_DEMI, fontSize: 20, color: ci === 4 ? C.accent : ci === 5 ? C.gray : C.body, fill: ci === 4 ? { color: C.t2 } : undefined }) };
  };
  s.addTable(rows.map((rw, ri) => rw.map((c, ci) => cell(c, ri, ci))), { x: P(bx.tbl.x), y: P(bx.tbl.y), w: P(w), h: P(bx.tbl.h), colW: [P(c1), P(c2), P(c2), P(c2), P(c2), P(c2)], rowH: P(bx.tbl.row_h), objectName: 'hero:table' });
  text(s, rich(CONC, ['52%'], { fontFace: ZH.med, noBold: true }), bx.conc, { face: ZH.med, color: C.dark, name: 'conclusion' });
  s.addNotes('无图');
});

// ================================================================ 16 一句话页（无图，浅色底）：14 字 → 60，两行
s = pres.addSlide();
rect(s, { x: 0, y: 0, w: 960, h: 540 }, { fill: C.t2, name: 'bg' });
{
  const size = 54, w = 560, h = 2 * size * LH;
  text(s, null, { x: (960 - w) / 2, y: (540 - h) / 2, w, h, size }, { face: ZH.bold, bold: true, color: C.dark, align: 'center', name: 'hero:big-label',
    paras: [[{ text: '问题不在拉新' }], [{ text: '在拉新之后的 ' }, bn('7 ', { color: C.accent }), { text: '天', o: { color: C.accent } }]] });
}
section('03', '今年做了什么');                                                                        // 17

// ================================================================ 18–20 系列页：做法（胶囊 + bullet）→ 三个结果数字 → 做对了 / 没解决 双框
const INIT = [
  { n: 18, t: '新手引导改版', k: '2026 年 3 月上线，投入 14 人月', how: ['把「邀请同事」从工作台角落提前到注册后的第二步，可以跳过', '选模板即自动建好首个项目，原来 6 步的流程压到 3 步'],
    kr: [1, 1.1, 0.9], nums: [['64%', '首个项目创建率\n51% → 64%'], ['30%', '邀请到第 2 名成员\n22% → 30%'], ['19%', '7 日留存\n15% → 19%']],
    pro: ['流程变短后创建率提升明显', '邀请入口的曝光率从 18% 提到 100%'], con: ['邀请发出后对方的接受率只有 38%，被邀请人打开链接后仍被要求先下载客户端', '单人团队占注册量的 41%，他们没有可以邀请的人'], hots: ['38%', '41%'] },
  { n: 19, t: '模板中心', k: '2026 年 6 月上线，投入 22 人月', how: ['上线 126 个官方模板，按行业与场景分类', '开放用户投稿，审核后上架'],
    kr: [0.8, 1.35, 0.85], nums: [['47%', '新建项目\n用模板创建'], ['34%', '用模板起步的 30 日留存\n不用模板的只有 17%'], ['312', '用户投稿\n上架 89 个', '个']],
    pro: ['模板缓解了面对空白页不知道从哪开始的问题', '研发类和设计类模板复用率最高'], con: ['电商运营类模板只有 11 个，而这恰好是流失最高的人群', '模板搜索不支持同义词，搜索无结果率 27%'], hots: ['11 个', '27%'] },
  { n: 20, t: 'AI 助手', k: '2026 年 8 月开始内测，投入 31 人月', how: ['在文档和任务里提供会议纪要生成、任务拆解、周报汇总三项能力', '面向 2,000 个付费团队内测'],
    kr: [0.85, 1.05, 1.1], nums: [['58%', '内测团队\n周活跃使用率'], ['25', '周报汇总单次节省\n（用户自报）', '分钟'], ['12%', '内测团队席位扩容率\n对照组 7%']],
    pro: ['周报汇总是使用频率最高的功能', '管理者角色的使用率达到 81%'], con: ['单次调用成本 0.11 元，重度团队每月的接口成本超过其订阅费的 30%', '任务拆解的采纳率只有 23%'], hots: ['30%', '23%'] },
];
for (const c of INIT) content(c.n, s => {
  const r = layout(c.n, { title: { text: c.t }, kicker: { text: c.k, size: 16, w: MW }, inset: 1.5, columns: [{ items: [
    PAIR(pill('howTag', '做法', 14), T('how', 'body', c.how.join('\n'), { indent: 1.4, para_gap: true }), { valign: 'top' }),
    { kind: 'row', cell_gap: 2, gap: 2, cells: c.nums.map((nn, i) => [T(`n${i}`, 'hero:big-number', nn[0], Object.assign({ nowrap: true, group: `k${i}` }, nn[2] ? { unit: nn[2], unit_size: 20 } : {})), T(`nl${i}`, 'label', nn[1], { tier: 'fixed', size: 18, group: `k${i}` })]) },
    { kind: 'row', cell_gap: 2, balance: true, stretch: true, gap: 2, cells: [
      [{ id: 'proCard', kind: 'card', tag: { id: 'proTag', shape: 'pill', text: '做对了的', size: 14 }, items: [T('pro', 'body', c.pro.join('\n'), { indent: 1.4, para_gap: true })] }],
      [{ id: 'conCard', kind: 'card', tag: { id: 'conTag', shape: 'pill', text: '没解决的', size: 14 }, items: [T('con', 'body', c.con.join('\n'), { indent: 1.4, para_gap: true })] }]] }] }] });
  const bx = r.boxes;
  title(s, bx.title, c.t);
  text(s, mixed(c.k), bx.kicker, { color: C.gray, name: 'kicker' });
  tag(s, bx.howTag, '做法', { fill: C.t1, color: C.dark });
  bulletsOf(s, bx.how, c.how, { quiet: true });
  c.nums.forEach((nn, i) => {
    text(s, numUnit(nn[0], nn[2], bx[`n${i}`], C.dark2), bx[`n${i}`], { color: C.dark2, nowrap: true, name: 'hero:big-number' });
    text(s, null, bx[`nl${i}`], { color: C.dark, name: 'label', paras: nn[1].split('\n').map(l => mixed(l)) });
  });
  rect(s, bx.proCard, { line: C.accent, round: 12, name: 'card:1' });
  tag(s, bx.proTag, '做对了的', { fill: C.accent });
  bulletsOf(s, bx.pro, c.pro);
  rect(s, bx.conCard, { line: C.grayD, round: 12, name: 'card:2' });
  tag(s, bx.conTag, '没解决的', { fill: C.grayD });
  bulletsOf(s, bx.con, c.con, { quiet: true });
  s.addNotes('无图');
});

// ================================================================ 21 故障复盘：左 = 时间表（报警 → 升级两行 accent）；右 = 影响 + 教训
content(21, s => {
  const TT = '9 月 12 日同步故障复盘', LEAD = '2026 年 9 月 12 日（周六）实时同步服务发生故障';
  const FACTS = ['持续 97 分钟', '影响约 6.2 万名在线用户', '1,340 份文档出现编辑内容回滚'];
  const LES = ['从报警到升级用了 33 分钟，报警被当成噪音', '周六发布，值班人手只有平时的三分之一', '灰度只覆盖了 Web 端，而问题只在移动端弱网下出现'];
  const rows = [['14:06', '发布同步引擎 v3.8.2'], ['14:19', '冲突率监控报警，值班工程师判断为偶发，未处理', 1], ['14:41', '客服工单激增，Android 端大量用户反馈「内容消失」'], ['14:52', '升级为 P0 故障，拉起应急群', 1],
    ['15:10', '定位到原因：新版本的冲突合并逻辑在弱网重连时，会用本地旧内容覆盖服务端较新的版本'], ['15:18', '开始回滚'], ['15:43', '回滚完成，服务恢复'], ['次日 11:00', '完成全部 1,340 份文档的数据修复']];
  const r = layout(21, { title: { text: TT }, column_gap: 3, columns: [
    { items: [{ id: 'tl', kind: 'vtimeline', time_size: 20, time_em: 5.0, nodes: rows.map((rw, i) => ({ id: `t${i}`, time: rw[0], text: rw[1] })) }] },
    { items: [T('lead', 'body', LEAD), T('facts', 'heading', FACTS.join('\n'), { tier: 'fixed', size: 20, gap: 1 }), Object.assign(pill('lesTag', '教训', 14), { gap: 3 }), T('les', 'body', LES.join('\n'), { indent: 1.4, para_gap: true, gap: 1 })] }] });
  const bx = r.boxes;
  title(s, bx.title, TT);
  const ax = bx['tl.axis'];
  s.addShape(pres.shapes.LINE, { x: P(ax.x), y: P(ax.y), w: 0, h: P(ax.h), line: { color: C.muted, width: 1 }, objectName: 'arrow' });
  rows.forEach((rw, i) => {
    const hot = !!rw[2], col = hot ? C.accent : C.dark;
    text(s, mixed(rw[0], { fontFace: ZH.med }).map(x => (x.o.fontFace = x.o.fontFace === EN ? EN_DEMI : ZH.med, x.o.bold = false, x)), bx[`t${i}.time`], { face: ZH.med, color: col, align: 'right', valign: 'middle', name: 'heading' });
    const d = bx[`t${i}.dot`];
    s.addShape(pres.shapes.OVAL, { x: P(d.x), y: P(d.y), w: P(d.w), h: P(d.h), fill: { color: hot ? C.accent : C.dark2 }, line: { type: 'none' }, objectName: 'tag' });
    text(s, mixed(rw[1], hot ? { fontFace: ZH.med } : {}), bx[`t${i}.text`], { face: hot ? ZH.med : ZH.light, color: hot ? C.dark : C.body, name: 'body' });
  });
  text(s, mixed(LEAD), bx.lead, { name: 'body' });
  text(s, null, bx.facts, { face: ZH.med, color: C.dark, name: 'heading', paras: FACTS.map(t => rich(t, ['97 分钟'], { fontFace: ZH.med, noBold: true })) });
  tag(s, bx.lesTag, '教训', { fill: C.dark2 });
  bulletsOf(s, bx.les, LES, { hots: ['33 分钟'], quiet: true });
  s.addNotes('无图');
});

// ================================================================ 22 成本：左 = 1.63 → 1.92 + 两条要点；右 = 四项构成柱图（AI 接口 accent）
content(22, s => {
  const TT = '服务成本：增量几乎全部来自 AI', H1 = '单个月活用户的月均服务成本（元）', CT = '三季度 1.92 元的构成（元）';
  const B = ['AI 接口成本一季度只有 0.05 元，是增长最快的成本项', '如果 AI 助手全量开放且继续并入订阅费，预计这一项会在 2027 年二季度超过存储'];
  const SER = [['第三方 AI 接口', '0.34', C.accent], ['计算', '0.71', C.dark2], ['存储', '0.48', C.muted], ['带宽', '0.39', C.line]];
  const LG = (i) => PAIR({ id: `l${i}s`, kind: 'icon', em: 1.0 }, T(`l${i}t`, 'legend', `${SER[i][0]}　${SER[i][1]}`, { tier: 'fixed', size: 18 }));
  const r = layout(22, { title: { text: TT }, column_gap: 3, columns: [
    { items: [T('h1', 'heading', H1, { tier: 'fixed', size: 24 }), { id: 'tbl', kind: 'box', role: 'table', h: 132, gap: 1 }, T('b', 'body', B.join('\n'), { indent: 1.4, para_gap: true, gap: 2 })] },
    { items: [T('ct', 'heading', CT, { tier: 'fixed', size: 24, group: 'c' }), { id: 'chart', kind: 'chart', role: 'hero:chart', aspect: 0.5, group: 'c' },
      { kind: 'row', cell_gap: 2, ratios: [1.5, 1], gap: 1, cells: [[LG(0)], [LG(1)]] }, { kind: 'row', cell_gap: 2, ratios: [1.5, 1], gap: 1, cells: [[LG(2)], [LG(3)]] }] }] });
  const bx = r.boxes;
  title(s, bx.title, TT);
  text(s, mixed(H1, { fontFace: ZH.med }), bx.h1, { face: ZH.med, color: C.dark, name: 'heading' });
  const bd = [{ type: 'none' }, { type: 'none' }, { type: 'solid', color: C.line, pt: 0.75 }, { type: 'none' }];
  const tc = (t, o = {}) => ({ text: mixed(t).map(x => ({ text: x.text, options: { fontFace: x.o.fontFace === EN ? (o.num ? EN_DEMI : EN) : (o.med ? ZH.med : ZH.light), fontSize: o.size || 16, color: o.color || C.dark } })), options: { border: bd, margin: [2, 6, 2, 0], valign: 'middle', align: o.align || 'center' } });
  s.addTable([[tc('', { align: 'left' }), tc('月均服务成本', { med: true }), tc('其中 AI 接口', { med: true })],
    [tc('一季度', { align: 'left', size: 18 }), tc('1.63', { num: true, size: 24 }), tc('0.05', { num: true, size: 24 })],
    [tc('三季度', { align: 'left', size: 18 }), tc('1.92', { num: true, size: 24 }), tc('0.34', { num: true, size: 24, color: C.accent })]],
    { x: P(bx.tbl.x), y: P(bx.tbl.y), w: P(bx.tbl.w), h: P(bx.tbl.h), colW: [P(bx.tbl.w * 0.26), P(bx.tbl.w * 0.37), P(bx.tbl.w * 0.37)], rowH: P(bx.tbl.h / 3), objectName: 'table' });
  bulletsOf(s, bx.b, B, { quiet: true });
  text(s, mixed(CT, { fontFace: ZH.med }), bx.ct, { face: ZH.med, color: C.dark, name: 'heading' });
  s.addChart(pres.charts.DOUGHNUT, [{ name: '成本', labels: SER.map(x => x[0]), values: SER.map(x => Number(x[1])) }], Object.assign(chartBase(bx.chart, 'hero:chart'),
    { holeSize: 56, chartColors: SER.map(x => x[2]), showValue: false, showPercent: false, showLabel: false, dataBorder: { pt: 1.5, color: C.white } }));
  SER.forEach((x, i) => {
    rect(s, bx[`l${i}s`], { fill: x[2], name: 'legend' });
    text(s, [{ text: x[0] + '　', o: i ? {} : { fontFace: ZH.med } }].map(q => q).flatMap(q => mixed(q.text, q.o)).concat([num(x[1], { fontFace: EN_DEMI, color: i ? C.dark : C.accent })]), bx[`l${i}t`], { face: i ? ZH.light : ZH.med, color: C.dark, valign: 'middle', name: 'legend' });
  });
  s.addNotes('无图');
});

section('04', '明年怎么打');                                                                          // 23
// 24 一句话页：15 字 → 54，两行；原标题降为辅助行
statement('_qa/selected/24.jpg', 55, [[{ text: '让每个新团队' }], [{ text: '在 ' }, bn('7 ', HL), { text: '天内', o: HL }, { text: '来齐 ' }, bn('3 ', HL), { text: '个人', o: HL }]], 54,
  'Photo: Miguel Rivera / Pexels — https://www.pexels.com/photo/boats-in-tranquil-waters-at-el-albir-spain-35104240/', '2027 年只做一件事', 96);      // 文字块下移，让开画面中部的两条船

// ================================================================ 25 三层架构：三张填充卡纵向叠放（层名 + 胶囊节点）；下沉的两项 accent
content(25, s => {
  const TT = '产品架构调整：把模板和 AI 从各应用里抽出来';
  const INTRO = '现在模板和 AI 能力分别写在任务、文档、日程三个应用里，各做各的，改一处要动三处。2027 年调整为三层', NOTE = '其中模板引擎和 AI 助手是这次从应用层下沉来的';
  const L = [['协作应用层', ['任务与看板', '文档', '日程与会议', '文件评审']], ['平台能力层', ['模板引擎', 'AI 助手', '组织与权限', '全局搜索', '通知中心']], ['基础设施层', ['实时同步引擎', '对象存储', '开放 API']]];
  const r = layout(25, { title: { text: TT }, inset: 1.2, columns: [{ items: [T('intro', 'body', INTRO)].concat(L.map((l, i) => ({ id: `card${i}`, kind: 'card', gap: i ? 1 : 2, items: [
    { kind: 'row', ratios: [1, 4.6], cell_gap: 2, valign: 'center', cells: [[T(`h${i}`, 'heading', l[0], { nowrap: true, tier: 'fixed', size: 20 })],
      [{ kind: 'row', cell_gap: 2, cells: l[1].map((t, j) => [pill(`p${i}${j}`, t, 14)]) }]] }] }))).concat([T('note', 'body', NOTE, { gap: 2 })]) }] });
  const bx = r.boxes;
  title(s, bx.title, TT);
  text(s, mixed(INTRO), bx.intro, { name: 'body' });
  L.forEach((l, i) => {
    rect(s, bx[`card${i}`], { fill: i === 1 ? C.t1 : C.pale, round: 12, name: `card:${i + 1}` });
    text(s, l[0], bx[`h${i}`], { face: ZH.med, color: i === 1 ? C.accent : C.dark, name: 'heading' });
    const x0 = bx[`p${i}0`].x, cw = (bx[`card${i}`].x + bx[`card${i}`].w - r.p - x0 - (l[1].length - 1) * 2 * r.g) / l[1].length;      // 节点胶囊铺满所在格（层内等宽）
    l[1].forEach((t, j) => { const hot = i === 1 && j < 2; tag(s, Object.assign({}, bx[`p${i}${j}`], { w: cw }), t, { fill: hot ? C.accent : C.white, color: hot ? C.white : C.dark }); });
  });
  text(s, rich(NOTE, ['模板引擎', 'AI 助手']), bx.note, { name: 'body' });
  s.addNotes('无图');
});

// ================================================================ 26 横向时间线：重点节点 2027 Q2（accent）+ 说明容器
content(26, s => {
  const TT = '落地节奏';
  const nodes = [{ id: 't0', y: '2026', q: 'Q4', text: '被邀请人免下载落地页上线\nAndroid 性能专项启动', ic: 'download-simple' },
    { id: 't1', y: '2027', q: 'Q1', text: 'AI 助手改为按额度计费\n电商运营类模板从 11 个扩到 60 个', ic: 'robot' },
    { id: 't2', q: 'Q2', text: '邀请流程重构全量上线', ic: 'user-plus', hot: true },
    { id: 't3', q: 'Q3', text: '平台能力层拆分完成', ic: 'stack' },
    { id: 't4', q: 'Q4', text: '开放 API 2.0 与渠道伙伴计划发布', ic: 'plugs-connected' }];
  const CO = '必须在 2027 年二季度内全量：每年三季度是中小团队的采购与续费高峰，错过就要再等一年';
  const r = layout(26, { title: { text: TT }, columns: [{ items: [{ id: 'tl', kind: 'timeline', icon_em: 2.8, callout: { text: CO, at: 2 },
    nodes: nodes.map(n => ({ id: n.id, time: (n.y ? n.y + '\n' : '') + n.q, text: n.text, icon: true })) }] }] });
  const bx = r.boxes;
  title(s, bx.title, TT);
  tag(s, bx['tl.callout'], CO, { fill: C.t1, color: C.dark2, face: ZH.med });
  const ar = bx['tl.arrow'];
  s.addShape(pres.shapes.DOWN_ARROW, { x: P(ar.x), y: P(ar.y), w: P(ar.w), h: P(ar.h), fill: { color: C.accent }, line: { type: 'none' }, objectName: 'arrow' });
  const ax = bx['tl.axis'];
  s.addShape(pres.shapes.LINE, { x: P(ax.x), y: P(ax.y), w: P(ax.w), h: 0, line: { color: C.dark2, width: 1, endArrowType: 'triangle' }, objectName: 'arrow' });
  nodes.forEach(n => {
    const col = n.hot ? C.accent : C.dark;
    const paras = (n.y ? [[num(n.y, { color: col })]] : []).concat([[num(n.q, { bold: !!n.hot, color: col })]]);
    text(s, null, bx[`${n.id}.time`], { color: col, align: 'center', valign: 'bottom', name: 'heading', paras });
    const d = bx[`${n.id}.dot`];
    s.addShape(pres.shapes.OVAL, { x: P(d.x), y: P(d.y), w: P(d.w), h: P(d.h), fill: { color: col }, line: { type: 'none' }, objectName: 'tag' });
    icon(s, bx[`${n.id}.icon`], n.ic, n.hot ? C.accent : C.dark, 'duotone', n.hot ? C.light : C.muted);
    text(s, null, bx[`${n.id}.text`], { face: n.hot ? ZH.med : ZH.light, color: col, align: 'center', name: 'body', paras: n.text.split('\n').map(l => mixed(l, n.hot ? { color: C.accent } : {})) });
  });
  s.addNotes('无图');
});

// ================================================================ 27 三组人数变化并列：icon + 组名 + 前 → 后
content(27, s => {
  const TT = '人怎么调', CT = '各组人数（人）', CONC = '其中 6 人由投放组转岗，净新增编制 7 人';
  const LG = (id, t) => PAIR({ id: id + 's', kind: 'icon', em: 1.1 }, T(id + 't', 'legend', t, { tier: 'fixed', size: 20 }), { group: 'lg' });
  const r = layout(27, { title: { text: TT }, column_gap: 3, columns: [
    { items: [T('ct', 'heading', CT, { tier: 'fixed', size: 24, group: 'c' }), { id: 'chart', kind: 'chart', role: 'hero:chart', aspect: 0.62, group: 'c' }] },
    { items: [LG('l0', '现在'), LG('l1', '调整后'), T('conc', 'conclusion', CONC, { gap: 3 })] }] });
  const bx = r.boxes;
  title(s, bx.title, TT);
  text(s, CT, bx.ct, { face: ZH.med, color: C.dark, name: 'heading' });
  const labels = ['投放组', '激活与留存小组', 'Android 端'];
  s.addChart(pres.charts.BAR, [{ name: '现在', labels, values: [12, 5, 6] }, { name: '调整后', labels, values: [6, 14, 10] }], Object.assign(chartBase(bx.chart, 'hero:chart'),
    { barDir: 'col', barGrouping: 'clustered', barGapWidthPct: 70, chartColors: [C.muted, C.accent], catAxisLabelFontFace: ZH.med, catAxisLabelFontBold: false, catAxisLabelFontSize: 16,
      showValue: true, dataLabelFormatCode: '0', dataLabelFontFace: EN, dataLabelFontSize: 18, dataLabelFontBold: true, dataLabelColor: C.dark, dataLabelPosition: 'outEnd' }));
  [['l0', '现在', C.muted], ['l1', '调整后', C.accent]].forEach(([id, t, col]) => { rect(s, bx[id + 's'], { fill: col, name: 'legend' }); text(s, t, bx[id + 't'], { face: ZH.med, color: C.dark, valign: 'middle', name: 'legend' }); });
  text(s, rich(CONC, ['净新增编制 7 人'], { fontFace: ZH.med, noBold: true }), bx.conc, { face: ZH.med, color: C.dark, name: 'conclusion' });
  s.addNotes('无图');
});

// ================================================================ 28 预算结构：两条 100% 堆叠条（2026 / 2027 提案），右侧自绘序列名（带前 → 后）
content(28, s => {
  const TT = '钱怎么调', KICK = '市场预算总额 3,200 万元不变，结构调整如下', CT = '市场预算结构（%）';
  const SER = [['买量', '70% → 30%', C.dark2, [30, 70]], ['产品内激活与邀请激励', '— → 35%', C.accent, [35, 0]], ['内容与社区', '12% → 20%', C.light, [20, 12]], ['渠道伙伴', '10% → 10%', C.muted, [10, 10]], ['品牌', '8% → 5%', C.line, [5, 8]]];
  const LG = (id, t) => PAIR({ id: id + 's', kind: 'icon', em: 1.0 }, T(id + 't', 'legend', t, { tier: 'fixed', size: 20 }), { group: 'lg' });
  const r = layout(28, { title: { text: TT }, kicker: { text: KICK, size: 16, w: MW }, column_gap: 3, columns: [
    { items: SER.map((x, i) => LG('l' + i, `${x[0]}　${x[1]}`)) },
    { items: [T('ct', 'heading', CT, { tier: 'fixed', size: 24, group: 'c' }), { id: 'chart', kind: 'chart', role: 'hero:chart', aspect: 0.5, group: 'c' }] }] });
  const bx = r.boxes;
  title(s, bx.title, TT);
  text(s, mixed(KICK), bx.kicker, { color: C.gray, name: 'kicker' });
  text(s, mixed(CT), bx.ct, { face: ZH.med, color: C.dark, name: 'heading' });
  const labels = ['2027 年提案', '2026 年'];
  s.addChart(pres.charts.BAR, SER.map(x => ({ name: x[0], labels, values: x[3] })), Object.assign(chartBase(bx.chart, 'hero:chart'),
    { barDir: 'bar', barGrouping: 'percentStacked', barGapWidthPct: 55, chartColors: SER.map(x => x[2]), catAxisLabelFontFace: ZH.med, catAxisLabelFontBold: false, catAxisLabelFontSize: 16, catAxisOrientation: 'maxMin', showValue: false }));
  SER.forEach((x, i) => {
    rect(s, bx[`l${i}s`], { fill: x[2], name: 'legend' });
    text(s, [{ text: x[0] + '　' }, num(x[1], { color: i === 1 ? C.accent : C.dark, fontFace: i === 1 ? EN : EN_DEMI })], bx[`l${i}t`], { face: i === 1 ? ZH.med : ZH.light, color: C.dark, valign: 'middle', name: 'legend' });
  });
  s.addNotes('无图');
});

// ================================================================ 29 三个风险并列：icon + 风险名 + 成因；底部区域背景 = 三条应对，与上方逐列对齐
content(29, s => {
  const TT = '三个风险';
  const R = [{ ic: 'chart-line-down', h: '买量收缩过快导致新增断档', b: ['自然流量与邀请的增长需要时间', '如果买量先降下来而邀请流程的改造效果晚于预期，新增会出现两到三个月的缺口'],
      a: ['按月设新增下限 1.2 万个团队', '连续两个月低于下限，就恢复 15 个百分点的买量预算'], hots: ['1.2 万个', '15 个百分点'] },
    { ic: 'robot', h: 'AI 单独计费引起付费团队反弹', b: ['内测团队已经习惯免费使用', '改为计费可能带来投诉甚至退订'],
      a: ['保留每席每月 50 次免费额度，这个额度覆盖了 72% 内测团队的现有用量', '提前 60 天公告'], hots: ['50 次', '60 天'] },
    { ic: 'users-three', h: 'Android 专项与平台拆分争抢同一批人', b: ['两件事都依赖同步引擎组的 5 名工程师'],
      a: ['Android 专项优先', '平台拆分中与同步引擎相关的部分顺延到 2027 年三季度，其余部分照常推进'], hots: ['Android 专项优先'] }];
  const r = layout(29, { title: { text: TT }, columns: [{ items: [
    { kind: 'row', cell_gap: 3, cells: R.map((x, i) => [IC(`i${i}`, 2.6), T(`h${i}`, 'heading', x.h, { tier: 'fixed', size: 20, gap: 1, group: `g${i}` }), T(`b${i}`, 'body', x.b.join('\n'), { indent: 1.4, para_gap: true, group: `g${i}` })]) },
    { kind: 'row', cell_gap: 3, region: 'bottom', gap: 3, cells: R.map((x, i) => [Object.assign(pill(`at${i}`, '应对', 14), { group: `a${i}` }), T(`a${i}`, 'body', x.a.join('\n'), { indent: 1.4, para_gap: true, group: `a${i}` })]) }] }] });
  const bx = r.boxes;
  rect(s, bx.region, { fill: C.t1, name: 'panel:region' });
  title(s, bx.title, TT);
  R.forEach((x, i) => {
    icon(s, bx[`i${i}`], x.ic, C.dark, 'duotone', C.muted);
    text(s, mixed(x.h, { fontFace: ZH.med }), bx[`h${i}`], { face: ZH.med, color: C.dark, name: 'heading' });
    bulletsOf(s, bx[`b${i}`], x.b, { quiet: true });
    tag(s, bx[`at${i}`], '应对', { fill: C.dark2 });
    bulletsOf(s, bx[`a${i}`], x.a, { hots: x.hots, quiet: true });
  });
  s.addNotes('无图');
});

section('05', '需要决策的事');                                                                        // 30

// ================================================================ 31 方案页：第一层级 = 三个方案名；推荐项 tertiary 填充 + accent 集中
content(31, s => {
  const TT = '三个方案';
  const O = [{ tag: '方案 A（推荐）', h: '全面转向', b: ['买量预算降到 30%', '激活与留存小组扩到 14 人', 'Android 专项增加 4 人', '预期新增注册团队下降 15%，但 30 日付费转化从 8% 提到 11%', '2027 年末 ARR 预期 3.1 亿元，较当前增长 32%'], hots: ['3.1 亿元', '32%'], fill: C.t1 },
    { tag: '方案 B', h: '小步试点', b: ['买量预算降到 55%，只在研发类团队中试点新邀请流程', '2027 年末 ARR 预期 2.75 亿元，增长 18%', '风险是在三季度旺季之前拿不到完整数据'], fill: C.pale },
    { tag: '方案 C', h: '维持现状', b: ['预算结构不变', '按当前获客成本的趋势，2027 年末 ARR 预期 2.6 亿元，增长 11%', '获客回本周期将超过 6 个月'], fill: C.pale }];
  const r = layout(31, { title: { text: TT }, inset: 1, columns: [{ items: [
    { kind: 'row', cell_gap: 2, ratios: [1.2, 1, 1], stretch: true, cells: O.map((o, i) => [{ id: `card${i}`, kind: 'card', tag: { id: `tg${i}`, shape: 'pill', text: o.tag, size: 16 },
      items: [T(`oh${i}`, 'heading', o.h, { group: 'o' }), T(`ob${i}`, 'body', o.b.join('\n'), { indent: 1.4, para_gap: true, group: 'o' })] }]) }] }] });
  const bx = r.boxes;
  title(s, bx.title, TT);
  O.forEach((o, i) => {
    rect(s, bx[`card${i}`], { fill: o.fill, round: 12, name: `card:${i + 1}` });
    tag(s, bx[`tg${i}`], o.tag, { fill: i === 0 ? C.accent : C.dark2 });
    text(s, o.h, bx[`oh${i}`], { face: ZH.med, color: i === 0 ? C.accent : C.dark, name: 'heading' });
    bulletsOf(s, bx[`ob${i}`], o.b, { hots: o.hots || [], quiet: i !== 0 });
  });
  s.addNotes('无图');
});

// ================================================================ 32 三件待决策的事：配图方式 5（左，满高）；序号圆 + 小标题级句子
content(32, s => {
  const TT = '需要本次会议决定的三件事', IW = 0.28 * 960;
  const D = [['批准方案 A 的预算结构调整，总额 3,200 万元不变', ['方案 A']], ['批准净新增 7 个编制，其中 Android 端 4 人须在 2026 年 11 月底前到岗', ['7 个编制']], ['同意 AI 助手自 2027 年一季度起按额度单独计费，不再并入团队版订阅费', ['按额度单独计费']]];
  const spec = tx => ({ title: { text: TT, x: tx, w: 960 - tx - 48 }, column_gap: 3, columns: [
    { edge: 'left', w: IW, items: [{ id: 'img', kind: 'image', role: 'image:atmosphere', path: '_qa/selected/32.jpg' }] },
    { items: D.map((d, i) => PAIR({ id: `c${i}`, kind: 'tag', shape: 'circle', text: String(i + 1), size: 20 }, T(`d${i}`, 'heading', d[0]), { gap: i ? 3 : 0 })) }] });
  let r = layout(32, spec(IW + 48));
  r = layout(32, spec(IW + 3 * r.g));      // C-02：title 左沿 = 图右沿 + 3g
  const bx = r.boxes;
  image(s, '_qa/selected/32.jpg', bx.img, 'image:atmosphere');
  title(s, bx.title, TT);
  D.forEach((d, i) => {
    tag(s, bx[`c${i}`], [num(String(i + 1))], { fill: C.dark2 });
    text(s, rich(d[0], d[1], { fontFace: ZH.med, noBold: true }), bx[`d${i}`], { face: ZH.med, color: C.dark, name: 'heading' });
  });
  s.addNotes('Photo: 준섭 윤 / Pexels — https://www.pexels.com/photo/low-angle-shot-of-skyscrapers-10421637/');
});

// ================================================================ 33 结束页
s = pres.addSlide();
rect(s, { x: 0, y: 0, w: 960, h: 540 }, { fill: C.dark, name: 'bg' });
text(s, '谢谢', { x: 180, y: 204, w: 600, h: 72, size: 60 }, { face: ZH.bold, bold: true, color: C.white, align: 'center', spc: 6, name: 'title' });
text(s, [{ text: '数据口径：除特别说明外，均来自北屿数据平台，截至 ' }, { text: '2026 ', o: { fontFace: EN } }, { text: '年 ' }, { text: '9 ', o: { fontFace: EN } }, { text: '月 ' }, { text: '30 ', o: { fontFace: EN } }, { text: '日' }],
  { x: 100, y: 440, w: 760, h: 16.8, size: 14 }, { color: C.white, align: 'center', name: 'body' });
text(s, [{ text: '图片：' }, { text: 'Pexels', o: { fontFace: EN } }, { text: '（' }, { text: 'cottonbro studio, Scott Webb, ', o: { fontFace: EN } }, { text: '马 力' }, { text: ', Magda Ehlers, Miguel Rivera, ', o: { fontFace: EN } }, { text: '준섭 윤' }, { text: '）' }],
  { x: 100, y: 470, w: 760, h: 14.4, size: 12 }, { color: C.muted, align: 'center', name: 'source' });

pres.writeFile({ fileName: 'deck.pptx' }).then(f => { console.log('wrote', f); if (failed.length) { console.error('layout 失败的页：', failed.join(', ')); process.exit(2); } });
