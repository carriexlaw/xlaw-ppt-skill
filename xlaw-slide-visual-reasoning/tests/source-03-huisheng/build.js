// 回声笔记 2027 商业化方案 deck。内容元素的坐标、字号、g、p 全部来自 scripts/layout.py（14 §4c），本文件只写元素树与绘制。
// 生成后必须跑 scripts/postfix.py（英文字体 + bullet），再渲染、校验。 node build.js [页码...] 只影响日志，不影响输出。
const pptxgen = require('pptxgenjs');
const { execSync } = require('child_process');
const fs = require('fs');
const pres = new pptxgen();
pres.layout = 'LAYOUT_WIDE';                     // 960×540pt
const P = v => v / 72;
const ZH = { bold: 'Source Han Sans CN Bold', med: 'Source Han Sans CN Medium', light: 'Source Han Sans CN Light' };
const EN = 'Avenir Next', EN_DEMI = 'Avenir Next Demi Bold';
const C = { accent: '6A4BE4', dark: '1B1440', dark2: '33287A', deep: '4B3BB0', t1: 'F3F1FD', t2: 'F7F6FB', t3: 'E9E6FC', t4: 'DEDBF5', light: 'BFB2FF', muted: 'B4B0CC',
  black: '000000', white: 'FFFFFF', body: '333333', gray: '7A7A7A', grayD: '4A4A4A', pale: 'F4F4F6', line: 'DCDAE6' };
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
const maskOf = path => execSync(`python3 ../../scripts/mask_color.py ${path}`).toString().trim();      // 遮罩取图片自身主色压暗，不跟主题色
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
  const b = { type: 'none' }, border = [b, b, b, b], cs = o.capSize || 20, ns = o.numSize || 48, us = o.unitSize || 20, aw = ns * 1.3, r = o.ratio || 1, cw = (box.w - aw) / (1 + r);
  const cell = (runs, align) => ({ text: runs, options: { border, margin: 0, valign: 'middle', align } });
  const cap = t => cell(mixed(t).map(r => ({ text: r.text, options: { fontFace: r.o.fontFace === EN ? EN : ZH.light, fontSize: cs, color: C.dark } })), 'left');
  const nm = (t, col, u) => cell([{ text: t, options: { fontFace: EN, bold: true, fontSize: ns, color: col } }].concat(u ? [{ text: ' ' + u, options: { fontFace: ZH.med, fontSize: us, color: col } }] : []), 'left');
  const U = o.units || [];
  s.addTable([[cap(caps[0]), cell([{ text: ' ', options: { fontFace: EN, fontSize: cs, color: C.dark } }], 'left'), cap(caps[1])], [nm(vals[0], C.dark2, U[0]), nm('→', C.dark2), nm(vals[1], C.accent, U[1])]],
    { x: P(box.x), y: P(box.y), w: P(box.w), h: P(box.h), colW: [P(cw), P(aw), P(cw * r)], rowH: [P(cs * 1.5), P(box.h - cs * 1.5)], objectName: 'table' });
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

const NOTE = {
  1: 'Photo: 马 力 / Pexels — https://www.pexels.com/photo/stunning-twilight-cityscape-over-expansive-urban-landscape-34617907/',
  2: 'Photo: SevenStorm JUHASZIMRUS / Pexels — https://www.pexels.com/photo/high-rise-building-digital-wallpaper-566321/',
  3: 'Photo: Marek Piwnicki / Pexels — https://www.pexels.com/photo/pink-blue-and-green-light-14082663/',
  9: 'Photo: Marc Schulte / Pexels — https://www.pexels.com/photo/black-and-silver-microphone-on-black-background-2370767/',
  17: 'Photo: panumas nikhomkhai / Pexels — https://www.pexels.com/photo/box-server-illuminated-on-blue-17489160/',
  24: 'Photo: Dom J / Pexels — https://www.pexels.com/photo/city-building-303335/' };
const LG = (id, t, size = 20, extra = {}) => PAIR({ id: id + 's', kind: 'icon', em: size / 18 }, T(id + 't', 'legend', t, { tier: 'fixed', size }), Object.assign({ group: 'lg' }, extra));
function legend(s, bx, id, runs, col, med) { rect(s, bx[id + 's'], { fill: col, name: 'legend' }); text(s, runs, bx[id + 't'], { face: med ? ZH.med : ZH.light, color: C.dark, valign: 'middle', name: 'legend' }); }
const NB = { type: 'none' };
const lineB = [NB, NB, { type: 'solid', color: C.line, pt: 0.75 }, NB];
// 表格单元格：中文 / 数字分字体
const tcell = (t, o = {}) => ({ text: String(t).split('\n').flatMap((ln, li, arr) => mixed(ln).map((x, xi, xs) => ({ text: x.text, options: { fontFace: x.o.fontFace === EN ? (o.num ? EN_DEMI : EN) : (o.med ? ZH.med : ZH.light), fontSize: o.size || 16, color: o.color || C.dark, bold: false, breakLine: xi === xs.length - 1 && li < arr.length - 1 } }))),
  options: Object.assign({ border: o.border || lineB, margin: o.margin || [2, 8, 2, 8], valign: 'middle', align: o.align || 'center' }, o.fill ? { fill: { color: o.fill } } : {}) });

let s;
// ================================================================ 1 封面：11 个字 → 54；副标题细体 24；署名贴底
s = pres.addSlide();
fullImage(s, '_qa/selected/01.jpg', 'image:full-bleed');
rect(s, { x: 0, y: 0, w: 960, h: 540 }, { fill: maskOf('_qa/selected/01.jpg'), transparency: 45, name: 'mask' });
text(s, '把每一小时转写变成生意', { x: 130, y: 200, w: 700, h: 64.8, size: 54 }, { face: ZH.bold, bold: true, color: C.white, align: 'center', spc: 5.4, name: 'title' });
text(s, mixed('回声笔记 2027 商业化方案'), { x: 130, y: 282, w: 700, h: 28.8, size: 24 }, { color: C.white, align: 'center', name: 'kicker' });
text(s, mixed('商业化项目组 · 2026 年 11 月'), { x: 180, y: 476, w: 600, h: 24, size: 20 }, { color: C.white, align: 'center', name: 'body' });
s.addNotes(NOTE[1]);

// ================================================================ 2 目录：配图方式 5（左，28% 宽，满高）
s = pres.addSlide();
{
  const IW = 0.28 * 960, [pw, ph] = dimsOf('_qa/selected/02.jpg'), a = pw / ph, bb = IW / 540;
  image(s, '_qa/selected/02.jpg', { x: 0, y: 0, w: IW, h: 540, img_w: a > bb ? 540 * a : IW, img_h: a > bb ? 540 : IW / a }, 'image:atmosphere');
  text(s, '目录', { x: IW + 72, y: 72, w: 300, h: 48, size: 40 }, { face: ZH.bold, bold: true, color: C.black, spc: 4, name: 'title' });
  const items = ['现状：用得越多，亏得越多', '方案：收费、降本、做深', '计划与决策'];
  const x0 = 430, step = 84, y0 = (540 - (2 * step + 48)) / 2 + 20;
  items.forEach((t, i) => {
    text(s, [num('0' + (i + 1), { fontFace: EN_DEMI, bold: true })], { x: x0, y: y0 + i * step, w: 72, h: 48, size: 40 }, { color: C.muted, name: 'label' });
    text(s, t, { x: x0 + 84, y: y0 + i * step + 7.2, w: 400, h: 33.6, size: 28 }, { face: ZH.light, color: C.dark, name: 'body' });
  });
}
s.addNotes(NOTE[2]);

// ================================================================ 一句话页（图 + 遮罩）
function statement(path, maskT, lines, size, note, kicker) {
  const s = pres.addSlide();
  fullImage(s, path, 'image:full-bleed');
  rect(s, { x: 0, y: 0, w: 960, h: 540 }, { fill: maskOf(path), transparency: maskT, name: 'mask' });
  const w = 640, h = lines.length * size * LH, kh = kicker ? 24 + 24 * LH : 0, y = (540 - h - kh) / 2;
  text(s, null, { x: (960 - w) / 2, y, w, h, size }, { face: ZH.bold, bold: true, color: C.white, align: 'center', name: 'hero:big-label', paras: lines });
  if (kicker) text(s, mixed(kicker), { x: (960 - w) / 2, y: y + h + 24, w, h: 24 * LH, size: 24 }, { color: C.light, align: 'center', name: 'kicker' });
  s.addNotes(note);
  return s;
}
const HL = { color: C.light };
// 3 摘要：8 个字 → 60，一行；「摘要」是元标签，不上页面
statement('_qa/selected/03.jpg', 40, [[{ text: '转写越多，' }, { text: '亏得越多', o: HL }]], 60, NOTE[3]);

// ================================================================ 章节页：浅色底，高亮色只给序号
function section(no, t) {
  const s = pres.addSlide();
  rect(s, { x: 0, y: 0, w: 960, h: 540 }, { fill: C.t2, name: 'bg' });
  text(s, [num(no, { fontFace: EN_DEMI })], { x: 130, y: 212, w: 700, h: 33.6, size: 28 }, { color: C.accent, align: 'center', name: 'label' });
  text(s, t, { x: 130, y: 264, w: 700, h: 57.6, size: 48 }, { face: ZH.bold, bold: true, color: C.dark, align: 'center', spc: 4.8, name: 'title' });
}
section('01', '现状：用得越多，亏得越多');                                                            // 4

// ================================================================ 5 左 = 规模三项（论据，深色，语义 icon）；右侧区域背景 = 付费三项，只有付费率用 accent
content(5, s => {
  const TT = '两百万月活，付钱的不到 3%', KICK = '截至 2026 年 10 月';
  const K = [['users-three', '注册用户', '1,260', '万'], ['user-circle-check', '月活用户', '218', '万'], ['waveform', '累计转写时长', '9,400', '万小时']];
  const PAY = [['付费用户', '6.1', '万'], ['月收入', '152', '万元'], ['付费率', '2.8%', '']];
  const r = layout(5, { title: { text: TT, w: 575 }, kicker: { text: KICK, size: 16, w: 400 }, column_gap: 3, columns: [
    { items: K.flatMap((k, i) => [T(`l${i}`, 'label', k[1], { tier: 'fixed', size: 20, gap: i ? 2 : 0, group: `k${i}` }),
      PAIR(IC(`i${i}`, 3.4), T(`n${i}`, 'hero:big-number', k[2], { unit: k[3], unit_size: 24, nowrap: true }), { gap: 1, group: `k${i}`, valign: 'center' })]) },
    { region: true, items: PAY.flatMap((p, i) => [T(`ph${i}`, 'heading', p[0], { tier: 'fixed', size: 20, gap: i ? 2 : 0, group: `p${i}` }),
      T(`pn${i}`, 'heading', p[1], Object.assign({ tier: 'fixed', size: 48, nowrap: true, gap: 1, group: `p${i}` }, p[2] ? { unit: p[2], unit_size: 24 } : {}))]) }] });
  const bx = r.boxes;
  rect(s, bx.region, { fill: C.t1, name: 'panel:region' });
  title(s, bx.title, TT);
  text(s, mixed(KICK), bx.kicker, { color: C.gray, name: 'kicker' });
  K.forEach((k, i) => {
    icon(s, bx[`i${i}`], k[0], C.dark, 'duotone', C.muted);
    text(s, k[1], bx[`l${i}`], { face: ZH.med, color: C.dark, name: 'label' });
    text(s, numUnit(k[2], k[3], bx[`n${i}`], C.dark2), bx[`n${i}`], { color: C.dark2, nowrap: true, name: 'hero:big-number' });
  });
  PAY.forEach((p, i) => {
    const hot = i === 2, col = hot ? C.accent : C.dark2, b = bx[`pn${i}`];
    text(s, p[0], bx[`ph${i}`], { face: ZH.med, color: C.dark, name: 'heading' });
    text(s, [num(p[1], { color: col })].concat(p[2] ? [{ text: '\u2009' + p[2], o: { fontFace: ZH.med, fontSize: b.unit_size, color: col } }] : []), b, { color: col, nowrap: true, name: 'heading' });
  });
  s.addNotes('无图');
});

// ================================================================ 6 趋势：折线（成本 accent，收入 data_muted）；右侧序列名 + 三行小表 + 9 月的说明
content(6, s => {
  const TT = '收入在涨，成本涨得更快', CT = '月收入与月服务成本（万元）', SRC = '来源：回声数据平台，截至 2026 年 10 月 31 日';
  const B = ['2026 年 9 月开学季叠加应用商店推荐，转写时长单月跳升 53%', '成本跟着跳，收入几乎没动'];
  const r = layout(6, { title: { text: TT }, column_gap: 3, columns: [
    { items: [T('ct', 'heading', CT, { tier: 'fixed', size: 24, group: 'c' }), { id: 'chart', kind: 'chart', role: 'hero:chart', group: 'c' }, T('src', 'source', SRC, { size: 10.5, group: 'c' })] },
    { items: [LG('l0', '月服务成本'), LG('l1', '月收入'), { id: 'tbl', kind: 'box', role: 'table', h: 132, gap: 3 }, T('b', 'body', B.join('\n'), { indent: 1.4, para_gap: true, gap: 2 })] }] });
  const bx = r.boxes;
  title(s, bx.title, TT);
  text(s, CT, bx.ct, { face: ZH.med, color: C.dark, name: 'heading' });
  const rev = [60, 63, 65, 68, 74, 79, 84, 90, 93, 95, 104, 110, 117, 124, 128, 133, 145, 152], cost = [231, 246, 227, 235, 291, 305, 320, 333, 304, 280, 360, 378, 400, 423, 391, 407, 622, 666];
  const labels = rev.map((_, i) => { const m = 4 + i, y = 2025 + Math.floor(m / 12), mm = m % 12 + 1; return (i % 3 === 0 || i === 17) && i !== 15 ? `${y}-${String(mm).padStart(2, '0')}` : ' '.repeat(i + 1); });
  s.addChart(pres.charts.LINE, [{ name: '月服务成本', labels, values: cost }, { name: '月收入', labels, values: rev }], Object.assign(chartBase(bx.chart, 'hero:chart'),
    { chartColors: [C.accent, C.muted], lineSize: 2.5, lineDataSymbol: 'none', valAxisHidden: false, valAxisLabelFontFace: EN, valAxisLabelFontSize: 12, valAxisLabelColor: C.gray, valGridLine: { color: C.line, size: 0.5 },
      catAxisLabelFontSize: 12, catAxisLabelFontBold: false, catAxisLabelFrequency: 3, showValue: false }));
  text(s, mixed(SRC), bx.src, { color: C.gray, name: 'source' });
  legend(s, bx, 'l0', '月服务成本', C.accent, true); legend(s, bx, 'l1', '月收入', C.muted);
  const t = bx.tbl, L = (x) => tcell(x, { align: 'left', size: 16, margin: [2, 4, 2, 0] }), N = (x, col) => tcell(x, { num: true, med: true, size: 24, align: 'right', color: col || C.dark, margin: [2, 0, 2, 6] });
  const LOSS = { text: [{ text: '171 → 514', options: { fontFace: EN_DEMI, fontSize: 24, color: C.dark } }, { text: ' 万元', options: { fontFace: ZH.med, fontSize: 16, color: C.dark } }], options: { border: lineB, margin: [2, 0, 2, 6], valign: 'middle', align: 'right' } };
  s.addTable([[L('18 个月收入增长'), N('153%')], [L('18 个月成本增长'), N('188%', C.accent)], [L('月度亏损'), LOSS]],
    { x: P(t.x), y: P(t.y), w: P(t.w), h: P(t.h), colW: [P(t.w * 0.42), P(t.w * 0.58)], rowH: P(t.h / 3), objectName: 'table' });
  bulletsOf(s, bx.b, B, { quiet: true });
  s.addNotes('无图');
});

// ================================================================ 7 构成：两根堆叠柱（收入 0.24 / 成本 1.04），云端推理 accent；左侧序列名带数值 + 结论
content(7, s => {
  const TT = '每转写一小时，收 0.24 元，花 1.04 元', KICK = '10 月全平台转写 640 万小时，摊到每一小时', CT = '每小时的收入与成本（元）';
  const CONC = '成本跟着用量走，收入不跟着用量走，这是现在这个模式的根本问题';
  const SER = [['云端推理', '0.86 元，占成本 83%', C.accent], ['存储与带宽', '0.12 元', C.light], ['其他', '0.06 元', C.muted], ['收入', '0.24 元', C.dark2]];
  const r = layout(7, { title: { text: TT }, kicker: { text: KICK, size: 16, w: MW }, column_gap: 3, columns: [
    { items: SER.map((x, i) => LG('l' + i, `${x[0]}　${x[1]}`, 20, i === 3 ? { gap: 2, group: 'lg2' } : {})).concat([T('conc', 'conclusion', CONC, { gap: 3 })]) },
    { items: [T('ct', 'heading', CT, { tier: 'fixed', size: 20, group: 'c' }), { id: 'chart', kind: 'chart', role: 'hero:chart', aspect: 0.66, group: 'c' }] }] });
  const bx = r.boxes;
  title(s, bx.title, TT);
  text(s, mixed(KICK), bx.kicker, { color: C.gray, name: 'kicker' });
  SER.forEach((x, i) => legend(s, bx, 'l' + i, [{ text: x[0] + '　', o: i ? {} : { fontFace: ZH.med } }].concat(mixed(x[1]).map(q => (i === 0 && q.o.fontFace === EN ? { text: q.text, o: { fontFace: EN_DEMI, color: C.accent } } : q))), x[2], i === 0));
  text(s, CONC, bx.conc, { face: ZH.med, color: C.dark2, name: 'conclusion' });
  text(s, CT, bx.ct, { face: ZH.med, color: C.dark, name: 'heading' });
  const labels = ['收入 0.24 元', '成本 1.04 元'];
  s.addChart(pres.charts.BAR, [{ name: '收入', labels, values: [0.24, 0] }, { name: '云端推理', labels, values: [0, 0.86] }, { name: '存储与带宽', labels, values: [0, 0.12] }, { name: '其他', labels, values: [0, 0.06] }],
    Object.assign(chartBase(bx.chart, 'hero:chart'), { barDir: 'col', barGrouping: 'stacked', barGapWidthPct: 90, chartColors: [C.dark2, C.accent, C.light, C.muted], catAxisLabelFontFace: ZH.med, catAxisLabelFontBold: false, catAxisLabelFontSize: 16, showValue: false }));
  s.addNotes('无图');
});

// ================================================================ 8 表格：法律与咨询一行 accent，学生一行加重；两句结论在表下
content(8, s => {
  const TT = '用得最多的人和愿意付钱的人，不是同一群人';
  const CONC = ['学生贡献了全平台 54% 的转写时长，付费率只有 0.4%', '法律与咨询从业者只占月活的 7%，付费率是学生的 26 倍'];
  const rows = [['人群', '主要场景', '占月活', '人均月转写时长', '付费率'], ['学生', '课堂录音', '38%', '4.2 小时', '0.4%'], ['职场人', '会议纪要', '33%', '2.1 小时', '2.6%'], ['内容创作者与记者', '采访整理', '17%', '2.4 小时', '5.8%'],
    ['法律与咨询从业者', '访谈取证', '7%', '3.0 小时', '10.5%'], ['其他', '—', '5%', '1.2 小时', '1.0%']];
  const r = layout(8, { title: { text: TT }, columns: [{ items: [{ id: 'tbl', kind: 'table', role: 'hero:table', rows: rows.length, row_min: 32 }, T('conc', 'conclusion', CONC.join('\n'), { tier: 'fixed', size: 20, gap: 1, para_gap: true })] }] });
  const bx = r.boxes;
  title(s, bx.title, TT);
  const w = bx.tbl.w, cw = [0.27, 0.19, 0.16, 0.22, 0.16].map(f => P(w * f));
  const cell = (c, ri, ci) => {
    const left = ci < 2 ? 'left' : 'center';
    if (ri === 0) return tcell(c, { med: true, size: 16, color: C.white, fill: C.dark, align: left });
    const hot = ri === 4, stu = ri === 1;
    if (ci < 2) return tcell(c, { size: 18, med: hot || stu, align: 'left', fill: hot ? C.t1 : undefined, color: C.dark });
    return tcell(c, { num: true, med: true, size: 20, fill: hot ? C.t1 : undefined, color: hot && ci === 4 ? C.accent : (stu && ci >= 3) ? C.dark2 : C.body });
  };
  s.addTable(rows.map((rw, ri) => rw.map((c, ci) => cell(c, ri, ci))), { x: P(bx.tbl.x), y: P(bx.tbl.y), w: P(w), h: P(bx.tbl.h), colW: cw, rowH: P(bx.tbl.row_h), objectName: 'hero:table' });
  text(s, null, bx.conc, { face: ZH.med, color: C.dark, name: 'conclusion', paras: [rich(CONC[0], [], { fontFace: ZH.med, noBold: true }), rich(CONC[1], ['26 倍'], { fontFace: ZH.med, noBold: true })] });
  s.addNotes('无图');
});

// ================================================================ 9 英文引言：18 汉字当量 → 48，三行；原标题降为辅助行
s = pres.addSlide();
fullImage(s, '_qa/selected/09.jpg', 'image:full-bleed');
rect(s, { x: 0, y: 0, w: 960, h: 540 }, { fill: maskOf('_qa/selected/09.jpg'), transparency: 35, name: 'mask' });
{
  const size = 48, w = 600, x = (960 - w) / 2, qh = 3 * size * LH, total = qh + 16 + 18 * LH + 20 + 24 * LH, y0 = (540 - total) / 2;
  const q = ["I'd pay for accuracy.", "I won't pay", 'for minutes.'].map(t => [{ text: t, o: { fontFace: EN_DEMI, bold: true } }]);
  text(s, null, { x, y: y0, w, h: qh, size }, { face: EN_DEMI, bold: true, color: C.white, align: 'center', nowrap: true, name: 'hero:big-label', paras: q });
  text(s, [{ text: '— Freelance journalist, in-app feedback, Sep 2026', o: { fontFace: EN } }], { x, y: y0 + qh + 16, w, h: 18 * LH, size: 18 }, { face: EN, color: C.white, align: 'center', name: 'body' });
  text(s, '用户原话：我为准确付费，不为时长付费', { x, y: y0 + qh + 16 + 18 * LH + 20, w, h: 24 * LH, size: 24 }, { face: ZH.light, color: C.light, align: 'center', name: 'kicker' });
}
s.addNotes(NOTE[9]);

section('02', '方案：收费、降本、做深');                                                              // 10

// ================================================================ 11 三件事并列：小标题 + 大 icon + 说明；不用 accent（三件事同等重要）
content(11, s => {
  const TT = '明年只做三件事';
  const W = [['重新定价', 'tag', '免费额度从不限时长收到每月 3 小时，付费层按用量和专业能力分档'], ['端云分层', 'devices', '简单场景交给手机上的小模型，复杂场景才上云端大模型，把单小时成本打下来'],
    ['为专业用户做深', 'scales', '给付费意愿最高的那 7% 做他们真正需要的功能，而不是给所有人做更多功能']];
  const r = layout(11, { title: { text: TT }, columns: [{ items: [{ kind: 'row', cell_gap: 2, cells: W.map((w, i) => [T(`h${i}`, 'heading', w[0], { align: 'center' }), Object.assign(IC(`i${i}`, 5), { align: 'center', gap: 2 }), T(`b${i}`, 'body', w[2], { gap: 2 })]) }] }] });
  const bx = r.boxes;
  title(s, bx.title, TT);
  W.forEach((w, i) => {
    text(s, w[0], bx[`h${i}`], { face: ZH.med, color: C.deep, align: 'center', name: 'heading' });
    icon(s, bx[`i${i}`], w[1], C.dark, 'duotone', C.light);
    text(s, mixed(w[2]), bx[`b${i}`], { name: 'body' });
  });
  s.addNotes('无图');
});

// ================================================================ 12 三档并列（胶囊 + 价格 + bullet），accent 集中在专业版；右侧区域背景 = 竞品定价与结论
content(12, s => {
  const TT = '新的三档定价', CH = '三家主要竞品的 Pro 档定价', CONC = '没有一家提供面向法律与媒体的专业档';
  const O = [{ tag: '免费版', h: '每月 3 小时转写', b: ['仅端侧模型', '基础纪要', '现在是不限时长'] },
    { tag: 'Pro 版', h: '28 元 / 月', b: ['或 228 元 / 年', '每月 30 小时', '云端大模型', '说话人分离', '纪要与待办提取', '导出不带水印', '学生认证后半价'] },
    { tag: '专业版', h: '88 元 / 月', b: ['不限时长', '专业词库', '逐字稿校对模式', '声纹记忆', '合规存储', '支持 5 人团队共享'], hot: true }];
  const r = layout(12, { title: { text: TT, w: 560 }, column_gap: 3, columns: [
    { items: [{ kind: 'row', cell_gap: 2, cells: O.map((o, i) => [pill(`tg${i}`, o.tag, 16), T(`oh${i}`, 'heading', o.h, { tier: 'fixed', size: 20, gap: 1, group: `o${i}` }), T(`ob${i}`, 'body', o.b.join('\n'), { indent: 1.4, para_gap: true, gap: 1, group: `o${i}` })]) }] },
    { region: true, items: [T('ch', 'heading', CH, { tier: 'fixed', size: 20, group: 'c' }), T('cn', 'heading', '25–39', { tier: 'fixed', size: 40, unit: '元 / 月', unit_size: 20, nowrap: true, gap: 1, group: 'c' }), T('conc', 'conclusion', CONC, { tier: 'fixed', size: 20, gap: 3 })] }] });
  const bx = r.boxes;
  rect(s, bx.region, { fill: C.t1, name: 'panel:region' });
  title(s, bx.title, TT);
  O.forEach((o, i) => {
    tag(s, bx[`tg${i}`], o.tag, { fill: o.hot ? C.accent : C.dark2 });
    text(s, mixed(o.h, { fontFace: ZH.med }).map(x => (x.o.fontFace === EN ? (x.o.fontFace = EN_DEMI, x.o.bold = false, x) : x)), bx[`oh${i}`], { face: ZH.med, color: o.hot ? C.accent : C.dark, name: 'heading' });
    bulletsOf(s, bx[`ob${i}`], o.b, { quiet: !o.hot });
  });
  text(s, mixed(CH, { fontFace: ZH.med }).map(x => (x.o.bold = false, x)), bx.ch, { face: ZH.med, color: C.dark, name: 'heading' });
  text(s, [num('25–39', { color: C.dark2 }), { text: '\u2009元 / 月', o: { fontFace: ZH.med, fontSize: bx.cn.unit_size, color: C.dark2 } }], bx.cn, { color: C.dark2, nowrap: true, name: 'heading' });
  text(s, rich(CONC, ['没有一家'], { fontFace: ZH.med, noBold: true }), bx.conc, { face: ZH.med, color: C.dark, name: 'conclusion' });
  s.addNotes('无图');
});

// ================================================================ 13 三个方案同维度对比 → 表格；方案 A 一行 tertiary + accent
content(13, s => {
  const TT = '免费额度定多少';
  const rows = [['方案', '免费额度', '覆盖免费用户\n现在的用量', '预计月活流失', '付费率', '月度亏损'],
    ['方案 A（推荐）', '每月 3 小时', '61%', '9%', '2.8% → 5.5%', '514 万元 → 120 万元以内\n全量后 6 个月内'],
    ['方案 B', '每月 10 小时', '89%', '3%', '3.6%', '约 380 万元'],
    ['方案 C', '维持不限时长', '—', '—', '—', '2027 年年中超过 800 万元']];
  const r = layout(13, { title: { text: TT }, columns: [{ items: [{ id: 'tbl', kind: 'table', role: 'hero:table', rows: rows.length, row_min: 40 }] }] });
  const bx = r.boxes;
  title(s, bx.title, TT);
  const w = bx.tbl.w, cw = [0.19, 0.17, 0.13, 0.1, 0.16, 0.25].map(f => P(w * f));
  const cell = (c, ri, ci) => {
    if (ri === 0) return tcell(c, { med: true, size: 16, color: C.white, fill: C.dark, align: ci === 0 ? 'left' : 'center' });
    const hot = ri === 1, fill = hot ? C.t1 : undefined;
    if (ci === 0) return tcell(c, { med: true, size: 18, align: 'left', color: hot ? C.accent : C.dark, fill, margin: [2, 4, 2, 8] });
    if (ci === 1) return tcell(c, { size: 18, color: C.dark, fill, med: hot });
    if (ci === 5) return tcell(c, { size: 18, num: true, med: hot, color: hot ? C.accent : C.body, fill });
    return tcell(c, { num: true, med: true, size: 20, color: hot && ci === 4 ? C.accent : C.body, fill });
  };
  s.addTable(rows.map((rw, ri) => rw.map((c, ci) => cell(c, ri, ci))), { x: P(bx.tbl.x), y: P(bx.tbl.y), w: P(w), h: P(bx.tbl.h), colW: cw, rowH: P(bx.tbl.row_h), objectName: 'hero:table' });
  s.addNotes('无图');
});

// ================================================================ 14 流程：上排 = 阶段标题 + icon（线条箭头，深色）；下排 = 具体流程（面性箭头，浅色）；分叉节点用容器，端侧小模型用 accent 色系
content(14, s => {
  const TT = '一段录音怎么走';
  const ST = [['录音开始', 'microphone'], ['路由判断', 'arrows-split'], null, ['转写', 'cpu'], ['文字汇合', 'list-checks'], ['用户校对', 'pencil-simple-line']];
  const KEYS = ['场景类型', '当前网络', '用户档位'], BR = ['安静环境的单人\n录音 / 免费版用户', '多人会议、课堂\n远场、中英混说\n和方言'], MODELS = ['端侧小模型', '云端大模型'];
  const RATIOS = [1.0, 1.05, 1.45, 1.4, 1.4, 0.9];
  const D0 = '先在手机上\n做降噪和\n场景识别', D4 = '再做说话人分离\n生成纪要与待办', D5 = '最后交\n给用户';      // 折行点选在语义断点（折行处行尾标点省略）
  const r = layout(14, { title: { text: TT }, columns: [{ items: [
    { kind: 'row', cell_gap: 2, ratios: RATIOS, cells: ST.map((x, i) => x ? [T(`h${i}`, 'heading', x[0], { tier: 'fixed', size: 20, align: 'center', nowrap: true }), Object.assign(IC(`i${i}`, 3), { align: 'center', gap: 1 })] : [{ id: 'sp', kind: 'box', role: 'arrow', h: 1 }]) },
    { kind: 'row', cell_gap: 2, ratios: RATIOS, valign: 'center', gap: 3, cells: [
      [T('d0', 'body', D0, { align: 'center' })],
      KEYS.map((k, i) => Object.assign(pill(`k${i}`, k, 16), { gap: i ? 1 : 0 })),
      [T('b0', 'body', BR[0], { align: 'center' }), { id: 'a0', kind: 'box', role: 'arrow', h: 24, gap: 1 }, { id: 'a1', kind: 'box', role: 'arrow', h: 24, gap: 1 }, T('b1', 'body', BR[1], { align: 'center', gap: 1 })],
      MODELS.map((m, i) => Object.assign(pill(`m${i}`, m, 20), { gap: i ? 1 : 0 })),
      [T('d4', 'body', D4, { align: 'center' })],
      [T('d5', 'body', D5, { align: 'center' })]] }] }] });
  const bx = r.boxes, g = r.g;
  title(s, bx.title, TT);
  const idx = [0, 1, 3, 4, 5];
  idx.forEach(i => { const hot = i === 1; text(s, ST[i][0], bx[`h${i}`], { face: ZH.med, color: hot ? C.accent : C.dark, align: 'center', nowrap: true, name: 'heading' }); icon(s, bx[`i${i}`], ST[i][1], hot ? C.accent : C.dark, 'duotone', hot ? C.light : C.muted); });
  // 线条箭头：连接相邻阶段的 icon，深色细线
  idx.slice(0, -1).forEach((i, k) => { const a = bx[`i${i}`], b = bx[`i${idx[k + 1]}`], x0 = a.x + a.w + g, x1 = b.x - g;
    s.addShape(pres.shapes.LINE, { x: P(x0), y: P(a.y + a.h / 2), w: P(x1 - x0), h: 0, line: { color: C.dark2, width: 1, endArrowType: 'triangle' }, objectName: 'arrow' }); });
  // 面性箭头：连接具体流程，颜色一定要浅
  const block = (x, y, w, h) => s.addShape(pres.shapes.RIGHT_ARROW, { x: P(x), y: P(y), w: P(w), h: P(h), fill: { color: C.t4 }, line: { type: 'none' }, objectName: 'arrow' });
  const cellX = i => { const k = [['d0'], ['k0', 'k1', 'k2'], ['b0', 'b1'], ['m0', 'm1'], ['d4'], ['d5']][i].map(id => bx[id]); return [Math.min(...k.map(b => b.x)), Math.max(...k.map(b => b.x + b.w))]; };
  const rowCy = (bx.k0.y + bx.k2.y + bx.k2.h) / 2;
  [[0, 1], [3, 4], [4, 5]].forEach(([a, b]) => { const x0 = cellX(a)[1] + 0.25 * g, x1 = cellX(b)[0] - 0.25 * g; block(x0, rowCy - 13, x1 - x0, 26); });
  ['a0', 'a1'].forEach(id => block(bx[id].x, bx[id].y, bx[id].w, bx[id].h));
  const lines = (x, o = {}) => x.split('\n').map(l => mixed(l, o).map(q => (q.o.bold = false, q)));
  text(s, null, bx.d0, { align: 'center', name: 'body', paras: lines(D0) });
  KEYS.forEach((k, i) => tag(s, bx[`k${i}`], k, { fill: C.deep }));
  text(s, null, bx.b0, { face: ZH.med, color: C.accent, align: 'center', name: 'body', paras: lines(BR[0], { fontFace: ZH.med, color: C.accent }) });
  text(s, null, bx.b1, { face: ZH.med, color: C.dark, align: 'center', name: 'body', paras: lines(BR[1], { fontFace: ZH.med, color: C.dark }) });
  MODELS.forEach((m, i) => tag(s, Object.assign({}, bx[`m${i}`], { shape: 'round' }), m, { fill: C.t3, color: i ? C.dark : C.accent }));
  text(s, null, bx.d4, { align: 'center', name: 'body', paras: lines(D4) });
  text(s, null, bx.d5, { align: 'center', name: 'body', paras: lines(D5) });
  s.addNotes('无图');
});

// ================================================================ 15 对比双框：端侧（accent 描边）/ 云端（深紫描边），框内各分优势 / 劣势
content(15, s => {
  const TT = '端侧小模型和云端大模型，各有各的账';
  const G = [{ t: '端侧小模型', col: C.accent, pro: ['单小时成本接近零', '离线可用，录音不出手机，法律和医疗这类对隐私敏感的用户更愿意用'], con: ['多人和远场场景的字错率接近云端的两倍', '只支持近三年的中高端机型，覆盖 64% 的月活', '安装包增加 180 MB'] },
    { t: '云端大模型', col: C.dark2, pro: ['全部场景的准确率都领先竞品平均水平', '可以持续迭代，不需要用户更新 App'], con: ['单小时推理成本 0.86 元', '弱网下录音上传失败率 4.3%'] }];
  const r = layout(15, { title: { text: TT }, inset: 1.5, columns: [{ items: [{ kind: 'row', cell_gap: 3, stretch: true, ratios: [1.15, 1], cells: G.map((g, i) => [{ id: `card${i}`, kind: 'card', tag: { id: `tg${i}`, shape: 'pill', text: g.t, size: 18 },
    items: [T(`ph${i}`, 'heading', '优势', { tier: 'fixed', size: 20, group: 'p' }), T(`pb${i}`, 'body', g.pro.join('\n'), { indent: 1.4, para_gap: true, group: 'p' }),
      T(`ch${i}`, 'heading', '劣势', { tier: 'fixed', size: 20, group: 'c', gap: 2 }), T(`cb${i}`, 'body', g.con.join('\n'), { indent: 1.4, para_gap: true, group: 'c' })] }]) }] }] });
  const bx = r.boxes;
  title(s, bx.title, TT);
  G.forEach((g, i) => {
    rect(s, bx[`card${i}`], { line: g.col, round: 12, name: `card:${i + 1}` });
    tag(s, bx[`tg${i}`], g.t, { fill: g.col });
    text(s, '优势', bx[`ph${i}`], { face: ZH.med, color: C.dark2, name: 'heading' });
    bulletsOf(s, bx[`pb${i}`], g.pro, { quiet: true });
    text(s, '劣势', bx[`ch${i}`], { face: ZH.med, color: C.gray, name: 'heading' });
    bulletsOf(s, bx[`cb${i}`], g.con, { quiet: true });
  });
  s.addNotes('无图');
});

// ================================================================ 16 六个场景 × 三个序列：横向条形（端侧 accent）；右侧序列名 + 可用线 + 结论
content(16, s => {
  const TT = '端侧模型在哪些场景够用', CT = '字错率（CER，越低越好）', LINE4 = '可用线是 4%';
  const CONC = '端侧 v1 只有安静环境单人这一个场景过线，但这一个场景占了全平台转写时长的 46%';
  const SER = [['端侧小模型 v1', C.accent], ['云端大模型 v4', C.dark2], ['竞品平均', C.muted]];
  const r = layout(16, { title: { text: TT }, column_gap: 3, columns: [
    { items: SER.map((x, i) => LG('l' + i, x[0])).concat([T('l4', 'heading', LINE4, { tier: 'fixed', size: 24, gap: 3 }), T('conc', 'conclusion', CONC, { tier: 'fixed', size: 20, gap: 1 })]) },
    { items: [T('ct', 'heading', CT, { tier: 'fixed', size: 20, group: 'c' }), { id: 'chart', kind: 'chart', role: 'hero:chart', aspect: 0.6, group: 'c' }] }] });
  const bx = r.boxes;
  title(s, bx.title, TT);
  text(s, mixed(CT, { fontFace: ZH.med }), bx.ct, { face: ZH.med, color: C.dark, name: 'heading' });
  const labels = ['安静环境单人', '电话录音', '会议室多人', '中英混说', '课堂远场', '方言（粤语、四川话）'];
  s.addChart(pres.charts.BAR, [{ name: '端侧小模型 v1', labels, values: [3.4, 9.7, 8.9, 14.2, 13.6, 21.5] }, { name: '云端大模型 v4', labels, values: [2.1, 5.5, 4.8, 6.3, 7.2, 9.4] }, { name: '竞品平均', labels, values: [3.0, 7.1, 6.5, 10.4, 9.8, 15.2] }],
    Object.assign(chartBase(bx.chart, 'hero:chart'), { barDir: 'bar', barGrouping: 'clustered', barGapWidthPct: 45, chartColors: SER.map(x => x[1]), catAxisOrientation: 'maxMin', catAxisLabelFontFace: ZH.med, catAxisLabelFontSize: 14, catAxisLabelFontBold: false,
      showValue: true, dataLabelFormatCode: '0.0"%"', dataLabelFontFace: EN, dataLabelFontSize: 11, dataLabelColor: C.dark, dataLabelPosition: 'outEnd' }));
  SER.forEach((x, i) => legend(s, bx, 'l' + i, mixed(x[0], i ? {} : { fontFace: ZH.med }), x[1], i === 0));
  text(s, mixed(LINE4, { fontFace: ZH.med }), bx.l4, { face: ZH.med, color: C.dark, name: 'heading' });
  text(s, rich(CONC, ['46%'], { fontFace: ZH.med, noBold: true }), bx.conc, { face: ZH.med, color: C.dark2, name: 'conclusion' });
  s.addNotes('无图');
});

// ================================================================ 17 两对前后数据（全 deck 唯一一页「大数字 → 大数字」）；配图方式 5（右，满高）
content(17, s => {
  const TT = '成本能降多少', IW = 0.28 * 960;
  const B1 = '安静单人场景全部改走端侧，云端推理时长减少 46%';
  const spec = tx => ({ title: { text: TT, x: tx, w: 960 - tx - 48 }, column_gap: 3, columns: [
    { edge: 'left', w: IW, items: [{ id: 'img', kind: 'image', role: 'image:atmosphere', path: '_qa/selected/17.jpg' }] },
    { items: [T('h1', 'heading', '每小时综合成本', { tier: 'fixed', size: 24, group: 'a' }), { id: 'c1', kind: 'box', role: 'table', h: 100, gap: 1, group: 'a' }, T('b1', 'body', B1, { gap: 1, group: 'a' }),
      T('h2', 'heading', '月度服务成本', { tier: 'fixed', size: 24, gap: 3, group: 'b' }), { id: 'c2', kind: 'box', role: 'table', h: 100, gap: 1, group: 'b' }] }] });
  let r = layout(17, spec(IW + 48));
  r = layout(17, spec(IW + 3 * r.g));      // C-02：title 左沿 = 图右沿 + 3g
  const bx = r.boxes;
  image(s, '_qa/selected/17.jpg', bx.img, 'image:atmosphere');
  title(s, bx.title, TT);
  text(s, '每小时综合成本', bx.h1, { face: ZH.med, color: C.dark, name: 'heading' });
  compare(s, bx.c1, ['现在', '改走端侧之后'], ['1.04', '0.64'], { capSize: 18, units: ['元', '元'], ratio: 1.4 });
  text(s, mixed(B1), bx.b1, { name: 'body' });
  text(s, '月度服务成本', bx.h2, { face: ZH.med, color: C.dark, name: 'heading' });
  compare(s, bx.c2, ['现在', '再叠加免费额度收紧'], ['666', '430'], { capSize: 18, units: ['万元', '万元左右'], ratio: 1.4 });
  s.addNotes(NOTE[17]);
});

// ================================================================ 18 四项能力并列：icon + 小标题 + 说明
content(18, s => {
  const TT = '专业版的四项能力';
  const F = [['book-bookmark', '专业词库', '法律、医疗、财经三个领域各 2 万词条，人名、案号、药名不再转错'], ['headphones', '逐字稿校对模式', '音频与文字逐句对齐，点哪个字就从哪里开始听'],
    ['fingerprint', '声纹记忆', '同一个人第二次出现时自动标注姓名，不用每次手动改「说话人 1」'], ['lock-key', '合规存储', '录音在本地加密，可以选择完全不上云，满足律所和媒体机构的保密要求']];
  const r = layout(18, { title: { text: TT }, columns: [{ items: [{ kind: 'row', cell_gap: 2, cells: F.map((f, i) => [IC(`i${i}`, 4), T(`h${i}`, 'heading', f[1], { tier: 'fixed', size: 24, gap: 2, group: `g${i}` }), T(`b${i}`, 'body', f[2], { gap: 1, group: `g${i}` })]) }] }] });
  const bx = r.boxes;
  title(s, bx.title, TT);
  F.forEach((f, i) => { icon(s, bx[`i${i}`], f[0], C.dark, 'duotone', C.light); text(s, f[1], bx[`h${i}`], { face: ZH.med, color: C.deep, name: 'heading' }); text(s, mixed(f[2]), bx[`b${i}`], { name: 'body' }); });
  s.addNotes('无图');
});

section('03', '计划与决策');                                                                          // 19

// ================================================================ 20 三条线 × 四个季度：泳道表；2027 Q1 一列 accent；关键约束一句在表下
content(20, s => {
  const TT = '三条线并行推进', CONC = '新定价必须在 2027 年一季度内全量：3 月是开学季加春招，是全年用量最高的时候，错过这个窗口，亏损会再跳一次';
  const rows = [['', '2026 Q4', '2027 Q1', '2027 Q2', '2027 Q3'], ['产品线', '新定价页与额度提醒上线，灰度 10% 用户', '新定价全量', '专业版上线', '团队共享上线'],
    ['模型线', '端侧小模型 v1 内测', '路由策略上线', '端侧 v2 发布，支持会议室多人场景', '方言专项'], ['商业线', '—', '学生认证半价上线', '律所与媒体机构渠道签约', '首次实现单季度盈亏平衡']];
  const r = layout(20, { title: { text: TT }, columns: [{ items: [{ id: 'tbl', kind: 'table', role: 'hero:table', rows: rows.length, row_min: 44 }, T('conc', 'conclusion', CONC, { tier: 'fixed', size: 20, gap: 1 })] }] });
  const bx = r.boxes;
  title(s, bx.title, TT);
  const w = bx.tbl.w, c1 = 0.12, cw = [c1, (1 - c1) / 4, (1 - c1) / 4, (1 - c1) / 4, (1 - c1) / 4].map(f => P(w * f));
  const cell = (c, ri, ci) => {
    const q1 = ci === 2;
    if (ri === 0) return tcell(c, { num: true, size: 18, color: C.white, fill: q1 ? C.accent : C.dark });
    if (ci === 0) return tcell(c, { med: true, size: 20, align: 'left', color: C.dark });
    return tcell(c, { size: 16, align: 'left', fill: q1 ? C.t1 : undefined, med: q1 && ri === 1, color: q1 && ri === 1 ? C.accent : C.body, margin: [4, 10, 4, 10] });
  };
  s.addTable(rows.map((rw, ri) => rw.map((c, ci) => cell(c, ri, ci))), { x: P(bx.tbl.x), y: P(bx.tbl.y), w: P(w), h: P(bx.tbl.h), colW: cw, rowH: P(bx.tbl.row_h), objectName: 'hero:table' });
  text(s, rich(CONC, ['2027 年一季度内全量'], { fontFace: ZH.med, noBold: true }), bx.conc, { face: ZH.med, color: C.dark, name: 'conclusion' });
  s.addNotes('无图');
});

// ================================================================ 21 交叉：半宽成对柱图（收入 accent，成本 data_muted；折线在交叉点标签互相压）+ 序列名 + 结论
content(21, s => {
  const TT = '什么时候不再亏钱', CT = '按方案 A 测算的季度收入与成本（万元）', CONC = ['收入线和成本线', '在 2027 年三季度交叉'];
  const r = layout(21, { title: { text: TT }, column_gap: 3, columns: [
    { items: [LG('l0', '收入', 24), LG('l1', '成本', 24), T('conc', 'conclusion', CONC.join('\n'), { tier: 'fixed', size: 28, gap: 3 })] },
    { items: [T('ct', 'heading', CT, { tier: 'fixed', size: 20, group: 'c' }), { id: 'chart', kind: 'chart', role: 'hero:chart', aspect: 0.62, group: 'c' }] }] });
  const bx = r.boxes;
  title(s, bx.title, TT);
  text(s, mixed(CT, { fontFace: ZH.med }), bx.ct, { face: ZH.med, color: C.dark, name: 'heading' });
  const labels = ['26 Q4', '27 Q1', '27 Q2', '27 Q3', '27 Q4'];
  const COST = [1950, 1480, 1260, 1300, 1390], REV = [470, 760, 1050, 1380, 1620];
  const ln = (name, values, col) => ({ type: pres.charts.LINE, data: [{ name, labels, values }], options: { chartColors: [col], lineSize: 1.5, lineSmooth: false, lineDataSymbol: 'none', showValue: false } });
  s.addChart([{ type: pres.charts.BAR, data: [{ name: '成本', labels, values: COST }, { name: '收入', labels, values: REV }],
    options: { barDir: 'col', barGrouping: 'clustered', barGapWidthPct: 60, chartColors: [C.muted, C.accent], showValue: true, dataLabelFormatCode: '#,##0', dataLabelFontFace: EN, dataLabelFontSize: 12, dataLabelColor: C.dark, dataLabelPosition: 'outEnd' } },
    ln('成本趋势', COST, C.grayD), ln('收入趋势', REV, C.dark2)], chartBase(bx.chart, 'hero:chart'));      // 趋势线：两条线在 2027 Q3 交叉
  legend(s, bx, 'l0', '收入', C.accent, true); legend(s, bx, 'l1', '成本', C.muted);
  text(s, null, bx.conc, { face: ZH.med, color: C.dark2, name: 'conclusion', paras: [rich(CONC[0], [], { fontFace: ZH.med, noBold: true }), rich(CONC[1], ['2027 年三季度'], { fontFace: ZH.med, noBold: true })] });
  s.addNotes('无图');
});

// ================================================================ 22 钱：总投入 + 环形图 + 序列名；右侧区域背景 = 人：新增 9 人的三个去向
content(22, s => {
  const TT = '需要多少钱、多少人';
  const SER = [['端侧模型研发', '45%', C.accent], ['云端推理优化', '20%', C.dark2], ['专业版产品研发', '20%', C.light], ['渠道与市场', '10%', C.muted], ['预备金', '5%', C.line]];
  const HC = [['cpu', '端侧算法', '4 人'], ['devices', '客户端', '3 人'], ['storefront', '商业化运营', '2 人']];
  const r = layout(22, { title: { text: TT, w: 480 }, column_gap: 3, columns: [
    { items: [T('nl0', 'label', '项目总投入', { tier: 'fixed', size: 24, group: 'm' }), T('n0', 'hero:big-number', '2,400', { unit: '万元', unit_size: 24, nowrap: true, gap: 1, group: 'm' }),
      { kind: 'row', cell_gap: 2, ratios: [1, 1.1], valign: 'center', gap: 2, cells: [[{ id: 'pie', kind: 'chart', role: 'chart', aspect: 0.9 }], [{ kind: 'stack', items: SER.map((x, i) => LG('l' + i, `${x[0]}　${x[1]}`, 18)) }]] }] },
    { region: true, items: [T('nl1', 'label', '新增', { tier: 'fixed', size: 24, group: 'h' }), T('n1', 'hero:big-number', '9', { unit: '人', unit_size: 24, nowrap: true, gap: 1, group: 'h' })].concat(
      HC.map((h, i) => PAIR(IC(`hi${i}`, 2.0), T(`hc${i}`, 'heading', `${h[1]} ${h[2]}`, { tier: 'fixed', size: 24 }), { gap: i ? 1 : 2, valign: 'center' }))) }] });
  const bx = r.boxes;
  rect(s, bx.region, { fill: C.t1, name: 'panel:region' });
  title(s, bx.title, TT);
  text(s, numUnit('2,400', '万元', bx.n0, C.dark2), bx.n0, { color: C.dark2, nowrap: true, name: 'hero:big-number' });
  text(s, '项目总投入', bx.nl0, { face: ZH.med, color: C.dark, name: 'label' });
  s.addChart(pres.charts.DOUGHNUT, [{ name: '投入', labels: SER.map(x => x[0]), values: [45, 20, 20, 10, 5] }], Object.assign(chartBase(bx.pie, 'chart'),
    { holeSize: 56, chartColors: SER.map(x => x[2]), showValue: false, showPercent: false, showLabel: false, dataBorder: { pt: 1.5, color: C.white } }));
  SER.forEach((x, i) => legend(s, bx, 'l' + i, [{ text: x[0] + '　', o: i ? {} : { fontFace: ZH.med } }, num(x[1], { fontFace: EN_DEMI, bold: false, color: i ? C.dark : C.accent })], x[2], i === 0));
  text(s, numUnit('9', '人', bx.n1, C.dark2), bx.n1, { color: C.dark2, nowrap: true, name: 'hero:big-number' });
  text(s, '新增', bx.nl1, { face: ZH.med, color: C.dark, name: 'label' });
  HC.forEach((h, i) => { icon(s, bx[`hi${i}`], h[0], C.dark, 'duotone', C.muted); text(s, [{ text: h[1] + ' ', o: { fontFace: ZH.med } }, num(h[2].split(' ')[0] + ' ', { fontFace: EN_DEMI, bold: false }), { text: '人', o: { fontFace: ZH.med } }], bx[`hc${i}`], { face: ZH.med, color: C.dark, valign: 'middle', name: 'heading' }); });
  s.addNotes('无图');
});

// ================================================================ 23 三问三答：左问（序号圆 + 小标题级）右答（bullet），三行
content(23, s => {
  const TT = '三个一定会被问到的问题';
  const QA = [['收紧免费额度，会不会把用户赶到竞品那里？', ['竞品的免费额度在每月 2–5 小时之间，我们的 3 小时处在中间', '过去 4 周对 10% 用户做了灰度：碰到额度上限的用户里，31% 选择了付费或等到下个月', '卸载率只比对照组高 1.8 个百分点'], ['1.8 个百分点']],
    ['学生占了一半以上的用量，是不是直接放弃？', ['不放弃，学生就是几年后的职场用户', '学生认证后 Pro 版半价，14 元 / 月', '一个学生平均每月转写 4.2 小时，成本约 4.4 元，半价仍然覆盖得住'], ['不放弃']],
    ['端侧模型要是\n做不出来怎么办？', ['端侧 v1 已经在内测，安静单人场景字错率 3.4%，过了可用线', '即使 v2 延期，只靠 v1 分流 46% 的时长，单小时成本也能降到 0.64 元', '整个方案不依赖 v2'], ['不依赖 v2']]];
  const r = layout(23, { title: { text: TT }, columns: [{ items: QA.map((q, i) => ({ kind: 'row', cell_gap: 3, ratios: [1, 2.25], gap: i ? 2 : 0, cells: [
    [PAIR({ id: `c${i}`, kind: 'tag', shape: 'circle', text: String(i + 1), size: 18 }, T(`q${i}`, 'heading', q[0], { tier: 'fixed', size: 20 }), { valign: 'top' })], [T(`a${i}`, 'body', q[1].join('\n'), { indent: 1.4, para_gap: true })]] })) }] });
  const bx = r.boxes;
  title(s, bx.title, TT);
  QA.forEach((q, i) => {
    tag(s, bx[`c${i}`], [num(String(i + 1))], { fill: C.dark2, bold: true });
    text(s, null, bx[`q${i}`], { face: ZH.med, color: C.dark, name: 'heading', paras: q[0].split('\n').map(l => [{ text: l }]) });
    bulletsOf(s, bx[`a${i}`], q[1], { hots: q[2], quiet: true });
  });
  s.addNotes('无图');
});

// ================================================================ 24 三件待决策的事：配图方式 5（左，满高）；目录式序号（细体、data_muted）+ 同色细竖线，与上一页的序号圆区分开
content(24, s => {
  const TT = '需要本次会议决定的三件事', IW = 0.28 * 960;
  const D = [['批准方案 A：免费额度收到每月 3 小时\n新三档定价于 2027 年一季度全量', ['方案 A']], ['批准项目总投入 2,400 万元\n与新增 9 个编制', ['2,400 万元', '9 个编制']], ['同意端侧小模型 v1 随 2027 年一季度版本\n一起发布，接受安装包增加 180 MB', ['端侧小模型 v1']]];
  const spec = tx => ({ title: { text: TT, x: tx, w: 960 - tx - 48 }, column_gap: 3, columns: [
    { edge: 'left', w: IW, items: [{ id: 'img', kind: 'image', role: 'image:atmosphere', path: '_qa/selected/24.jpg' }] },
    { items: D.map((d, i) => ({ kind: 'row', cell_gap: 2, ratios: [1, 13], valign: 'center', gap: i ? 2 : 0, cells: [[T(`n${i}`, 'label', String(i + 1), { tier: 'fixed', size: 54, nowrap: true })], [T(`d${i}`, 'heading', d[0], { tier: 'fixed', size: 24 })]] })) }] });
  let r = layout(24, spec(IW + 48));
  r = layout(24, spec(IW + 3 * r.g));      // C-02：title 左沿 = 图右沿 + 3g
  const bx = r.boxes;
  image(s, '_qa/selected/24.jpg', bx.img, 'image:atmosphere');
  title(s, bx.title, TT);
  D.forEach((d, i) => {
    const n = bx[`n${i}`], t = bx[`d${i}`], lx = (n.x + n.w + t.x) / 2, lh = Math.max(t.h, 48);
    text(s, [{ text: String(i + 1), o: { fontFace: EN, bold: false } }], n, { face: EN, color: C.muted, nowrap: true, valign: 'middle', name: 'label' });
    s.addShape(pres.shapes.LINE, { x: P(lx), y: P(t.y + t.h / 2 - lh / 2), w: 0, h: P(lh), line: { color: C.muted, width: 1.5 }, objectName: 'arrow' });
    text(s, null, t, { face: ZH.light, color: C.dark, name: 'heading', paras: d[0].split('\n').map(l => rich(l, d[1], { noBold: true }).map(x => (x.o.color === C.accent && x.o.fontFace !== EN_DEMI && x.o.fontFace !== EN ? (x.o.fontFace = ZH.med) : 0, x))) });      // 关键词 Medium + accent，不用 Bold
  });
  s.addNotes(NOTE[24]);
});

// ================================================================ 25 结束页：数据口径 + 图片致谢
s = pres.addSlide();
rect(s, { x: 0, y: 0, w: 960, h: 540 }, { fill: C.dark, name: 'bg' });
text(s, '谢谢', { x: 180, y: 204, w: 600, h: 72, size: 60 }, { face: ZH.bold, bold: true, color: C.white, align: 'center', spc: 6, name: 'title' });
text(s, mixed('数据口径：除特别说明外，均来自回声数据平台，截至 2026 年 10 月 31 日').map(r => (r.o.bold = false, r)), { x: 100, y: 440, w: 760, h: 16.8, size: 14 }, { color: C.white, align: 'center', name: 'body' });
text(s, [{ text: '图片：' }, { text: 'Pexels', o: { fontFace: EN } }, { text: '（马 力' }, { text: ', SevenStorm JUHASZIMRUS, Marek Piwnicki, Marc Schulte, panumas nikhomkhai, Dom J', o: { fontFace: EN } }, { text: '）' }],
  { x: 100, y: 470, w: 760, h: 14.4, size: 12 }, { color: C.muted, align: 'center', name: 'source' });

pres.writeFile({ fileName: 'deck.pptx' }).then(f => { console.log('wrote', f); if (failed.length) { console.error('layout 失败的页：', failed.join(', ')); process.exit(2); } });
