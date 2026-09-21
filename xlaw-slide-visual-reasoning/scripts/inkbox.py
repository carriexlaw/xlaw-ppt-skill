"""
inkbox.py — 文字墨迹框估算（14-validation-spec §3.3）

validate_design.py 与生成端共用。字宽用经验系数，不依赖字体文件：
    CJK: size×1.0    拉丁字母 / 数字: size×0.55    空格: size×0.3    字间距（rPr spc / pptxgenjs charSpacing）：每字再加 spc pt
    箭头（→ ← ↑ ↓ ↔ ⇒）: size×1.0（英文字体里没有这些字形，渲染时回退到中文字体，是全角宽）    %: size×0.9    ‰: size×1.25
行高 = size × 行距倍数（段落 lnSpc，缺省 1.2）；行数 = ceil(行宽 / inner_w)，空段落算 1 行。

校验端：
    from inkbox import text_ink_box
    x, y, w, h = text_ink_box(shape, th)        # pt；th 为 thresholds.yaml 的 dict

生成端（写 pptxgenjs 代码前估算文本框高度）：
    python inkbox.py --size 12 --width 300 --text "要放进去的文字"    # 打印需要的高度 pt
    python inkbox.py --size 12 --width 300 --file body.txt
"""
import math
import re
import sys

EMU_PER_PT = 12700
DEFAULT_TH = {'cjk': 1.0, 'latin': 0.55, 'space': 0.3, 'line_spacing': 1.2, 'inset': 7.2, 'arrow': 1.0, 'percent': 0.9, 'permille': 1.25}
_ARROWS = set('→←↑↓↔⇒⇐⟶⟵')
DEFAULT_SIZE = 18.0   # run 无 sz 时的回退值（pptxgenjs 总是写 sz）

_CJK_RE = re.compile(
    '[⺀-⻿⼀-⿟　-〿぀-ヿ㄀-ㄯ㐀-䶿'
    '一-鿿豈-﫿︰-﹏＀-￯\U00020000-\U0002ffff]')
_WORD_RE = re.compile(r"[A-Za-z0-9][A-Za-z0-9'\-]*")


def is_cjk(ch):
    return bool(_CJK_RE.match(ch))


def char_width(ch, size, ink):
    """单字宽（pt）。全角标点按 CJK 计，ASCII 标点按拉丁计。"""
    if ch == ' ' or ch == '\t':
        return size * ink['space']
    if is_cjk(ch):
        return size * ink['cjk']
    if ch in _ARROWS:                       # 回退到中文字体的全角箭头；按拉丁 0.55 估会让「86 → 178」压到右边的释义
        return size * ink.get('arrow', DEFAULT_TH['arrow'])
    if ch == '%':
        return size * ink.get('percent', DEFAULT_TH['percent'])
    if ch == '‰':
        return size * ink.get('permille', DEFAULT_TH['permille'])
    return size * ink['latin']


def line_width(text, size, ink, spc=0.0):
    """spc = 字间距 pt（中文大标题 0.1 × 字号）；每字加一次"""
    return sum(char_width(c, size, ink) for c in text) + spc * len(text)


def cjk_equiv(text):
    """汉字当量 = CJK 字符数 + 2 × 英文词数（§4 C-04）。标点与空白不计。"""
    cjk = sum(1 for c in text if is_cjk(c) and not ('　' <= c <= '〿' or '＀' <= c <= '￯'))
    words = len(_WORD_RE.findall(text))
    return cjk + 2 * words


# ---------------------------------------------------------------- 纯文本估算（生成端）

def estimate_lines(text, size, inner_w, ink=None, spc=0.0):
    """返回 (行数, 最长行宽)。text 内 '\n' 为段落分隔。"""
    ink = ink or DEFAULT_TH
    n_lines, max_w = 0, 0.0
    for para in text.split('\n'):
        w = line_width(para, size, ink, spc)
        max_w = max(max_w, w)
        n_lines += max(1, math.ceil(w / inner_w)) if inner_w > 0 else 1
    return n_lines, max_w


def estimate_height(text, size, box_w, ink=None, line_spacing=None, spc=0.0):
    """给定文本框宽度（pt，形状框宽），返回需要的形状框高度（pt，含上下内边距）。"""
    ink = ink or DEFAULT_TH
    ls = line_spacing or ink['line_spacing']
    inner_w = box_w - 2 * ink['inset']
    n, _ = estimate_lines(text, size, inner_w, ink, spc)
    return n * size * ls + 2 * ink['inset']


# ---------------------------------------------------------------- python-pptx 形状（校验端）

def _emu_attr(el, name, default_pt):
    v = el.get(name) if el is not None else None
    return int(v) / EMU_PER_PT if v is not None else default_pt


def _run_size(r_el, fallback):
    """<a:r>/<a:fld>/<a:br> 的 rPr sz（百分之一 pt）"""
    rpr = r_el.find('{http://schemas.openxmlformats.org/drawingml/2006/main}rPr')
    if rpr is not None and rpr.get('sz'):
        return int(rpr.get('sz')) / 100.0
    return fallback


def _run_spc(r_el):
    """rPr spc（百分之一 pt）→ pt"""
    rpr = r_el.find('{http://schemas.openxmlformats.org/drawingml/2006/main}rPr')
    if rpr is not None and rpr.get('spc'):
        try:
            return int(rpr.get('spc')) / 100.0
        except ValueError:
            return 0.0
    return 0.0


def _para_lines(p_el, fallback_size):
    """把一个 <a:p> 拆成行（按 <a:br> 分），每行 [(text, size, spc), ...]"""
    A = '{http://schemas.openxmlformats.org/drawingml/2006/main}'
    lines, cur = [], []
    for child in p_el:
        tag = child.tag
        if tag == A + 'r' or tag == A + 'fld':
            t = child.find(A + 't')
            cur.append(((t.text or '') if t is not None else '', _run_size(child, fallback_size), _run_spc(child)))
        elif tag == A + 'br':
            lines.append(cur)
            cur = []
    lines.append(cur)
    return lines


def _para_spacing(p_el, ink):
    """返回 (行距倍数, 段前 pt, 段后 pt)"""
    A = '{http://schemas.openxmlformats.org/drawingml/2006/main}'
    ppr = p_el.find(A + 'pPr')
    ls, before, after = ink['line_spacing'], 0.0, 0.0
    if ppr is not None:
        ln = ppr.find(A + 'lnSpc')
        if ln is not None:
            pct = ln.find(A + 'spcPct')
            if pct is not None and pct.get('val'):
                ls = int(pct.get('val')) / 100000.0
        for tag, idx in (('spcBef', 1), ('spcAft', 2)):
            sp = ppr.find(A + tag)
            if sp is not None:
                pts = sp.find(A + 'spcPts')
                if pts is not None and pts.get('val'):
                    v = int(pts.get('val')) / 100.0
                    if idx == 1: before = v
                    else: after = v
    return ls, before, after


def _para_align(p_el):
    A = '{http://schemas.openxmlformats.org/drawingml/2006/main}'
    ppr = p_el.find(A + 'pPr')
    return (ppr.get('algn') if ppr is not None else None) or 'l'


def text_ink_box(shape, th=None, default_size=DEFAULT_SIZE):
    """
    文本形状的墨迹框 (x, y, w, h)，单位 pt。非文本形状返回形状框。
    th: thresholds.yaml 的 dict（用其中 ink 段）；缺省用 DEFAULT_TH。
    """
    ink = (th or {}).get('ink', DEFAULT_TH)
    x0, y0 = shape.left / EMU_PER_PT, shape.top / EMU_PER_PT
    w0, h0 = shape.width / EMU_PER_PT, shape.height / EMU_PER_PT
    if not getattr(shape, 'has_text_frame', False) or not shape.has_text_frame:
        return (x0, y0, w0, h0)
    tf = shape.text_frame
    body_pr = tf._txBody.bodyPr
    l_ins = _emu_attr(body_pr, 'lIns', ink['inset'])
    r_ins = _emu_attr(body_pr, 'rIns', ink['inset'])
    t_ins = _emu_attr(body_pr, 'tIns', ink['inset'])
    b_ins = _emu_attr(body_pr, 'bIns', ink['inset'])
    anchor = body_pr.get('anchor') or 't'
    wrap = (body_pr.get('wrap') or 'square') != 'none'
    inner_w = max(w0 - l_ins - r_ins, 1.0)
    inner_h = max(h0 - t_ins - b_ins, 0.0)

    total_h, max_line_w, aligns = 0.0, 0.0, set()
    for p in tf.paragraphs:
        p_el = p._p
        ls, before, after = _para_spacing(p_el, ink)
        aligns.add(_para_align(p_el))
        ppr = p_el.find('{http://schemas.openxmlformats.org/drawingml/2006/main}pPr')
        mar = _emu_attr(ppr, 'marL', 0.0) if ppr is not None else 0.0      # bullet 缩进：折行宽度变窄
        para_w = max(inner_w - mar, 1.0)
        total_h += before + after
        for line in _para_lines(p_el, default_size):
            if not line:
                total_h += default_size * ls
                continue
            lw = sum(line_width(t, s, ink, sp) for t, s, sp in line)
            size = max(s for _, s, _sp in line)
            n = max(1, math.ceil(lw / para_w)) if wrap else 1
            max_line_w = max(max_line_w, (min(lw, para_w) + mar) if wrap else lw)
            total_h += n * size * ls
    ink_w = min(inner_w, max_line_w) if max_line_w > 0 else 0.0
    ink_h = total_h

    # 水平锚定：按段落对齐（多段不同对齐时取 inner 全宽）
    if len(aligns) == 1:
        a = next(iter(aligns))
        if a == 'ctr':
            ix = x0 + l_ins + (inner_w - ink_w) / 2
        elif a == 'r':
            ix = x0 + l_ins + inner_w - ink_w
        else:
            ix = x0 + l_ins
    else:
        ix, ink_w = x0 + l_ins, inner_w
    # 垂直锚定：按 bodyPr anchor（缺省 top）
    if anchor == 'ctr':
        iy = y0 + t_ins + (inner_h - ink_h) / 2
    elif anchor == 'b':
        iy = y0 + t_ins + inner_h - ink_h
    else:
        iy = y0 + t_ins
    return (ix, iy, ink_w, ink_h)


def text_line_count(shape, th=None, default_size=DEFAULT_SIZE):
    """文本形状估算的总行数（C-10 用）"""
    ink = (th or {}).get('ink', DEFAULT_TH)
    if not shape.has_text_frame:
        return 0
    body_pr = shape.text_frame._txBody.bodyPr
    l_ins = _emu_attr(body_pr, 'lIns', ink['inset'])
    r_ins = _emu_attr(body_pr, 'rIns', ink['inset'])
    inner_w = max(shape.width / EMU_PER_PT - l_ins - r_ins, 1.0)
    n = 0
    for p in shape.text_frame.paragraphs:
        for line in _para_lines(p._p, default_size):
            lw = sum(line_width(t, s, ink, sp) for t, s, sp in line)
            n += max(1, math.ceil(lw / inner_w))
    return n


def _cli(argv):
    import argparse
    ap = argparse.ArgumentParser(description='估算文本框需要的高度（pt）')
    ap.add_argument('--size', type=float, required=True, help='字号 pt')
    ap.add_argument('--width', type=float, required=True, help='文本框形状宽 pt')
    ap.add_argument('--line-spacing', type=float, default=None)
    ap.add_argument('--spacing', type=float, default=0.0, help='字间距 pt（中文大标题 = 0.1 × 字号）')
    ap.add_argument('--text', help='文本，\\n 分段')
    ap.add_argument('--file', help='从文件读文本')
    a = ap.parse_args(argv)
    text = open(a.file, encoding='utf-8').read() if a.file else (a.text or '').replace('\\n', '\n')
    inner_w = a.width - 2 * DEFAULT_TH['inset']
    n, mw = estimate_lines(text, a.size, inner_w, spc=a.spacing)
    h = estimate_height(text, a.size, a.width, line_spacing=a.line_spacing, spc=a.spacing)
    print(f'lines={n} max_line_w={mw:.1f}pt ink_h={h - 2 * DEFAULT_TH["inset"]:.1f}pt box_h={h:.1f}pt cjk_equiv={cjk_equiv(text)}')


if __name__ == '__main__':
    _cli(sys.argv[1:])
