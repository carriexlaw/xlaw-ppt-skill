#!/usr/bin/env python3
"""
postfix.py — 生成后的 XML 后处理（11 字体系统）。pptxgenjs 生成 deck.pptx 之后、渲染与校验之前跑一次。

    python postfix.py deck.pptx deck.manifest.yaml [--out deck.pptx] [--dry-run]

做两件 pptxgenjs 设不了的事：
1  数字 / 英文用英文字体：pptxgenjs 的 fontFace 把 a:latin 与 a:ea 写成同一个中文字体，数字就被中文字体渲染。
   遍历每个 run（形状、表格单元格、图表的 txPr / rich），a:ea 保留生成端给的中文字体，a:latin 改成英文字体：
     - run 的 latin 已是 deck.fonts_latin 里的字体（生成端给纯数字 run 直接指定了英文字体）→ 不动
     - 否则按 deck.font_pairs[<ea 字体>] 取；没有配对 → deck.fonts_latin[0]
2  bullet：带 a:buChar 的段落统一写成 a:buFont + a:buChar=● + a:buSzPct=135000 + a:buClr；圆点字体缺省 System Font Regular（macOS，与用户重排稿一致；Arial 的 • 字形偏小），
   可用 deck.bullet: {font, char} 覆盖（Windows 上可设 {font: Arial, char: ●}）（02：大圆点、尺寸 135%）。
   不指定 buFont 时圆点跟随段首 run 的字体：段首是汉字就用中文字体的全角 ●（特别大），段首是数字就用英文字体的（正常），同页大小不一。
   颜色约定：生成端 bullet code 用 25CF（●）→ accent；用 25CB（○）→ 降噪色 deck.palette.secondary[0]（页面有重点组件时，非重点项的圆点不用高亮色）。
3  pptxgenjs 在多 run 段落里会给后续 run 再写一个 a:pPr（一个 a:p 里出现多个 pPr，不合 schema，bullet 会丢）：只保留每段的第一个。

deck.manifest.yaml 里用到的字段：
    deck.fonts_latin: [Avenir Next]
    deck.font_pairs:  {Source Han Sans CN Medium: Avenir Next Demi Bold, Source Han Sans CN Bold: Avenir Next Bold}   # 可选
    deck.palette.accent[0]
"""
import argparse
import os
import re
import shutil
import sys
import tempfile
import zipfile

from lxml import etree

A = 'http://schemas.openxmlformats.org/drawingml/2006/main'
NS = {'a': A}
BULLET_SIZE_PCT = 135000
# a:pPr 子元素的 schema 顺序：bu* 必须排在 lnSpc / spcBef / spcAft 之后、tabLst / defRPr / extLst 之前
_PPR_AFTER = {f'{{{A}}}{t}' for t in ('tabLst', 'defRPr', 'extLst')}
_BU_CLR = {f'{{{A}}}{t}' for t in ('buClrTx', 'buClr')}
_BU_SZ = {f'{{{A}}}{t}' for t in ('buSzTx', 'buSzPct', 'buSzPts')}
_BU_FONT = {f'{{{A}}}{t}' for t in ('buFontTx', 'buFont')}
_BU_KIND = {f'{{{A}}}{t}' for t in ('buNone', 'buAutoNum', 'buChar', 'buBlip')}


def _is_latin_font(face, latin_fonts):
    return any(face == f or face.startswith(f + ' ') for f in latin_fonts)


def fix_fonts(root, latin_fonts, pairs):
    """返回改动的 rPr 数。rPr / defRPr / endParaRPr 都处理（图表的字体在 defRPr 里）"""
    n = 0
    for tag in ('rPr', 'defRPr', 'endParaRPr'):
        for rpr in root.iter(f'{{{A}}}{tag}'):
            lat, ea = rpr.find('a:latin', NS), rpr.find('a:ea', NS)
            if lat is None and ea is None:
                continue
            cur = lat.get('typeface') if lat is not None else None
            if cur and _is_latin_font(cur, latin_fonts):
                continue
            ea_face = ea.get('typeface') if ea is not None else cur
            want = pairs.get(ea_face) or latin_fonts[0]
            if lat is None:
                lat = etree.SubElement(rpr, f'{{{A}}}latin')
                if ea is not None:                      # schema 顺序：latin 在 ea 之前
                    rpr.remove(lat)
                    ea.addprevious(lat)
            if ea is None and cur:                      # 只有 latin（中文字体）→ 把它挪给 ea
                ea = etree.Element(f'{{{A}}}ea')
                ea.set('typeface', cur)
                lat.addnext(ea)
            lat.set('typeface', want)
            for k in ('pitchFamily', 'charset', 'panose'):
                if k in lat.attrib:
                    del lat.attrib[k]
            n += 1
    return n


def fix_dup_ppr(root):
    n = 0
    for p in root.iter(f'{{{A}}}p'):
        pprs = p.findall('a:pPr', NS)
        for extra in pprs[1:]:
            p.remove(extra)
            n += 1
        if pprs and p[0] is not pprs[0]:
            p.remove(pprs[0]); p.insert(0, pprs[0])
    return n


def fix_bullets(root, accent, quiet, bfont='System Font Regular', bchar='●'):
    n = 0
    for ppr in root.iter(f'{{{A}}}pPr'):
        bu = ppr.find('a:buChar', NS)
        if bu is None:
            continue
        color = quiet if bu.get('char') in ('○', '◦') else accent
        bu.set('char', bchar)
        for ch in list(ppr):
            if ch.tag in _BU_CLR or ch.tag in _BU_SZ or ch.tag in _BU_FONT:
                ppr.remove(ch)
        clr = etree.Element(f'{{{A}}}buClr')
        etree.SubElement(clr, f'{{{A}}}srgbClr').set('val', color)
        sz = etree.Element(f'{{{A}}}buSzPct')
        sz.set('val', str(BULLET_SIZE_PCT))
        bf = etree.Element(f'{{{A}}}buFont')
        bf.set('typeface', bfont)
        anchor = next((ch for ch in ppr if ch.tag in _BU_FONT or ch.tag in _BU_KIND or ch.tag in _PPR_AFTER), None)
        if anchor is None:
            ppr.append(clr); ppr.append(sz); ppr.append(bf)
        else:
            anchor.addprevious(clr); anchor.addprevious(sz); anchor.addprevious(bf)
        n += 1
    return n


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument('pptx')
    ap.add_argument('manifest')
    ap.add_argument('--out', default=None, help='输出路径，默认覆盖原文件')
    ap.add_argument('--dry-run', action='store_true')
    a = ap.parse_args()
    import yaml
    with open(a.manifest, encoding='utf-8') as f:
        deck = yaml.safe_load(f)['deck']
    latin_fonts = list(deck.get('fonts_latin') or [])
    if not latin_fonts:
        print('deck.fonts_latin 为空：无法确定英文字体', file=sys.stderr)
        return 2
    pairs = dict(deck.get('font_pairs') or {})
    bcfg = dict(deck.get('bullet') or {})
    accent = str(deck['palette']['accent'][0]).upper()
    quiet = str((deck['palette'].get('secondary') or [accent])[0]).upper()
    pat = re.compile(r'ppt/(slides/slide\d+|charts/chart\d+|notesSlides/notesSlide\d+)\.xml$')
    out = a.out or a.pptx
    tmp = tempfile.NamedTemporaryFile(delete=False, suffix='.pptx', dir=os.path.dirname(os.path.abspath(out)))
    tmp.close()
    n_font = n_bu = n_ppr = 0
    with zipfile.ZipFile(a.pptx) as zin, zipfile.ZipFile(tmp.name, 'w', zipfile.ZIP_DEFLATED) as zout:
        for item in zin.infolist():
            data = zin.read(item.filename)
            if pat.search(item.filename) and 'notesSlide' not in item.filename:
                root = etree.fromstring(data)
                n_ppr += fix_dup_ppr(root)
                n_font += fix_fonts(root, latin_fonts, pairs)
                n_bu += fix_bullets(root, accent, quiet, bcfg.get('font', 'System Font Regular'), bcfg.get('char', '●'))
                data = etree.tostring(root, xml_declaration=True, encoding='UTF-8', standalone=True)
            zout.writestr(item, data)
    print(f'英文字体：改 {n_font} 处 rPr → {latin_fonts[0]}（配对 {len(pairs)} 组）；bullet：改 {n_bu} 段（135%，{accent}）；删多余 pPr {n_ppr} 个')
    if a.dry_run:
        os.unlink(tmp.name)
        return 0
    shutil.move(tmp.name, out)
    return 0


if __name__ == '__main__':
    sys.exit(main())
