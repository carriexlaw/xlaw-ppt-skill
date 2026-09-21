#!/usr/bin/env python3
"""
layout.py — 尺度循环（14 §4c）：由页级 manifest（density、columns、source_chars）与元素树算出字号、g、p 与每个元素的框。
留白不是输入：内容按密度档放大到位，间距 g 由剩余空间算出，剩下的才是留白。
第五轮：字号分四层（正文 / 小标题级 / 数字释义 / 大数字，01 字号分级），有余量时的放大顺序是 正文 → 小标题级 → 大数字。

    python layout.py page.json [--deck deck.manifest.yaml] [--thresholds thresholds.yaml] [--write-g] > out.json

输入 page.json：
{
  "page": {"page": 5, "density": "medium", "columns": "2:1", "source_chars": 130},
  "title": {"text": "客户在用脚投票", "w"?: 864},      # 给了就由 layout 定 title 字号（该档区间内最大的单行字号，字间距 10%）并输出 boxes.title
  "title_bottom": 73.6,                                   # 不给 title 时：title 墨迹下沿；无标题页给 null
  "kicker": {"text", "size", "w"},                        # 可选，放在 title 下 g 处
  "column_gap": 2, "inset": 2,                            # 分栏间距 = column_gap × g（2 或 3）；容器内缩 p = inset × g（1–3）
  "columns": [ {"items": [node...], "edge"?: "left"|"right", "w"?: 211, "region"?: true}, ... ]
      # edge：贴页边的图片列（配图方式 5 / 6），从页边起算、宽度固定、满页高
      # region：该列铺 panel:region（01 区域背景）：从列左侧分栏带中线铺到页面右 / 左边缘，满页高；输出 boxes["region"]
}
节点（node）：
  text      {"id", "kind": "text", "role", "text", "tier"?: body|heading|label|number|fixed, "size"?, "align"?, "spc"?, "fit"?: true, "nowrap"?: true, "indent"?: 1.2, "para_gap"?: true, "w_frac"?: 0.75}
            para_gap：bullet 段距 = hierarchy.para_gap_mult × 字号（段前）；w_frac：框宽收窄到列宽的比例并居中（窄长区域里的文字），chart 同样支持
            indent：bullet 缩进（× 字号），折行宽度相应变窄
            tier 缺省：hero:big-number → number；heading / conclusion → heading；label → label；body → body；其它 → fixed（用 size）
            unit：数字的单位（「万」「亿元」「个月」），与数字写在同一个文本框里、紧跟数字、字号 = 数字释义档或 "unit_size"（输出 unit_size）：单位不藏进小字释义
  icon      {"id", "kind": "icon", "em"?: 2.2, "align"?: "center"}     # 方形，边长 = em × 正文字号；align=center：在所在格 / 列内居中（与居中的文字同一条中轴线）
  box       {"id", "kind": "box", "role", "h": pt, "w"?: pt, "w_frac"?: 0.6, "align"?: "center"}     # 固定高的占位框（自绘的小表格 / 对比条），宽缺省 = 列宽
  tag       {"id", "kind": "tag", "shape": "circle"|"pill", "text", "size", "d_em"?: 1.7}     # 小容器：宽高由文字定；circle 直径 = d_em × 字号（序号圆要小，数字加粗）
  brace     {"id", "kind": "brace"}                                    # 只作 pair.left：大括号，高 = pair 高（包含 / 组成关系）
  image     {"id", "kind": "image", "role", "path", "h"?}              # 无 h：伸缩（只在列的顶层）；输出 img_w / img_h
  chart     {"id", "kind": "chart", "role", "aspect"?: 0.75}           # 有 aspect：高 = 宽 × aspect（小型图表半宽）；无：伸缩
  table     {"id", "kind": "table", "role", "rows", "row_min"}         # 伸缩，输出 row_h
  pair      {"kind": "pair", "left": node, "right": node, "valign"?: "center"|"top"}     # 紧贴对：左项取自身墨迹宽，间距 0.35 × 正文
  row       {"kind": "row", "cells": [node | [node...]], "ratios"?, "cell_gap"?: 2|3, "valign"?: "center", "balance"?: true, "stretch"?: true}
            # balance：调各格宽度让自然高度相等（容器大小由内容决定，横排只对齐高度）；stretch：card 撑到行高
  stack     {"kind": "stack", "items": [node...]}
  card      {"id", "kind": "card", "items": [node...], "tag"?: {"id", "shape": "circle"|"pill", "text", "size"}}
            # tag 压在卡片左上角：circle 的圆心落在卡片上沿；pill 的垂直中心落在卡片上沿
  timeline  {"id", "kind": "timeline", "nodes": [{"id", "time": "2026\\nQ4", "text"?, "icon"?: true, "empty"?: true}], "callout"?: {"text", "at": 3, "size"?}}
  vtimeline {"id", "kind": "vtimeline", "nodes": [{"id", "time", "text"}], "time_em"?: 5, "time_size"?: 18}
            # 竖向时间线（05）：线左是时间（右对齐到线）、线右是内容；节点多、每条内容长（横向放不下）时用。输出 <id>.axis、<nid>.time / .dot / .text
  band      顶层 stack 里的节点加 "region": "bottom" → 从该节点上方 1.5g 铺到页面底边、左右满宽；输出 boxes["region"]
  相邻节点间距 = gap × g；gap 缺省：同 group → 1，不同 group → 2
输出：{"ok", "g", "p", "e", "sizes": {body, heading, label, number, title}, "B", "boxes": {id: {x,y,w,h,size?,...}}, "notes"}
"""
import argparse
import json
import math
import os
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
from inkbox import estimate_lines, DEFAULT_TH  # noqa: E402

LH = 1.2
TIGHT = 0.35          # 紧贴对间距 = 0.35 × 正文字号（< 0.8 × g_min = 0.4 × 正文，校验器一定合并）


def load_yaml(path):
    import yaml
    with open(path, encoding='utf-8') as f:
        return yaml.safe_load(f)


class Fail(Exception):
    pass


class Layout:
    def __init__(self, spec, deck, th):
        self.spec, self.deck, self.th = spec, deck, th
        self.sc, self.hi = th['scale'], th['hierarchy']
        self.page_w, self.page_h = deck['page']['w'], deck['page']['h']
        m = deck['margins']
        self.margin = (m['l'], m['t'], self.page_w - m['l'] - m['r'], self.page_h - m['t'] - m['b'])
        self.type_scale = sorted(deck['type_scale'])
        self.ink = th.get('ink', DEFAULT_TH)
        self.notes = []
        page = spec['page']
        self.density = page['density']
        self.band = self.sc['bands'][self.density]
        ratios = [float(x) for x in str(page['columns']).split(':')]
        if len(ratios) != len(spec['columns']):
            raise Fail(f'page.columns 有 {len(ratios)} 列，元素清单有 {len(spec["columns"])} 列')
        self.ratios = ratios
        self.col_gap_mult = float(spec.get('column_gap', 2))
        self.inset_mult = float(spec.get('inset', 2))
        if self.col_gap_mult not in self.sc['column_gap_steps']:
            raise Fail(f'column_gap 必须是 {self.sc["column_gap_steps"]} 之一（× g）')
        if not (self.sc['inset_min_mult'] <= self.inset_mult <= self.sc['inset_max_mult']):
            raise Fail(f'inset 必须在 [{self.sc["inset_min_mult"]}, {self.sc["inset_max_mult"]}]（× g）')
        # 正文起始 = 声明档的起始值；放大上限按字数档（元素多但字少的页，如时间线，正文仍可放大）
        self.body = self._at_least(self.band['body_min'])
        d = th['density']
        sc_chars = page.get('source_chars') or 10 ** 6
        cb = 'light' if sc_chars <= d['light_chars'] else 'medium' if sc_chars <= d['medium_chars'] else 'heavy'
        self.body_cap = max(self.body, self._at_most(self.sc['bands'][cb].get('body_cap') or self.band['body_min']))
        self._derive()

    # ---- 字号刻度
    def _at_least(self, v):
        c = [t for t in self.type_scale if t >= v - 0.5]
        if not c:
            raise Fail(f'type_scale 里没有 ≥ {v} 的字号')
        return c[0]

    def _at_most(self, v):
        c = [t for t in self.type_scale if t <= v + 0.5]
        if not c:
            raise Fail(f'type_scale 里没有 ≤ {v} 的字号')
        return c[-1]

    def _derive(self):
        """由正文字号取各层级的起始值（01 字号分级）"""
        b, hi = self.body, self.hi
        self.heading = self._at_least(hi['heading_mult'][0] * b)
        self.number = min(self._at_least(hi['number_mult'][0] * b), self._at_most(hi['number_max']))
        self.heading_cap = self._at_most(hi['heading_mult'][1] * b)
        self.number_cap = self._at_most(min(hi['number_mult'][1] * b, hi['number_max']))

    def label_size(self, text):
        """数字释义：1.1–1.8 b，总高 ≤ 数字高"""
        lines = text.count('\n') + 1
        hi = self.hi
        cap = min(hi['label_mult'][1] * self.body, self.number / lines)
        c = [t for t in self.type_scale if hi['label_mult'][0] * self.body - 0.5 <= t <= cap + 0.5]
        return c[-1] if c else self._at_least(hi['label_mult'][0] * self.body)

    def tier(self, it):
        t = it.get('tier')
        if t:
            return t
        role = it.get('role', '')
        if role == 'hero:big-number':
            return 'number'
        if role in ('heading', 'conclusion'):
            return 'heading'
        if role == 'label':
            return 'label'
        if role == 'body':
            return 'body'
        return 'fixed'

    def size_of(self, it):
        t = self.tier(it)
        if t == 'body':
            return self.body
        if t == 'heading':
            return self.heading
        if t == 'number':
            return self.number
        if t == 'label':
            return self._label
        return float(it['size'])

    # ---- 几何
    @property
    def p(self):
        return self.inset_mult * self.g

    @property
    def B(self):
        mx, my, mw, mh = self.margin
        top = self.title_bottom + self.sc['title_gap_step'] * self.g if self.title_bottom is not None else my
        return (mx, top, mw, my + mh - top)

    def col_widths(self):
        cols = self.spec['columns']
        gap = self.col_gap_mult * self.g
        left, right = self.margin[0], self.margin[0] + self.margin[2]
        fixed = {}
        for i, c in enumerate(cols):
            if c.get('edge') == 'left':
                fixed[i] = (0.0, float(c['w'])); left = float(c['w']) + gap
            elif c.get('edge') == 'right':
                fixed[i] = (self.page_w - float(c['w']), float(c['w'])); right = self.page_w - float(c['w']) - gap
        flex = [i for i in range(len(cols)) if i not in fixed]
        W = (right - left) - (len(flex) - 1) * gap
        tot = sum(self.ratios[i] for i in flex) or 1.0
        out, x = [None] * len(cols), left
        for i in flex:
            w = W * self.ratios[i] / tot
            out[i] = (x, w); x += w + gap
        for i, xw in fixed.items():
            out[i] = xw
        return out, gap

    def unit_w(self, it):
        """数字后的单位：释义档字号，前面留 0.15 × 数字字号"""
        if not it.get('unit'):
            return 0.0
        us = float(it.get('unit_size') or self._label)
        return 0.15 * self.size_of(it) + estimate_lines(it['unit'], us, 10 ** 6, self.ink)[1]

    def ink_of(self, it, w=None):
        if it.get('unit'):
            n, mw, h = self.ink_of(dict(it, unit=None), None)
            mw += self.unit_w(it)
            return (1 if not w or mw <= w else 2), (min(w, mw) if w else mw), h
        if w and it.get('indent'):
            w = max(w - float(it['indent']) * self.size_of(it), 1.0)
        """(行数, 墨迹宽, 高)。数字 / 拉丁字符按安全系数估宽（渲染字体比估算宽）"""
        size = self.size_of(it)
        k = self.sc.get('nowrap_safety', 1.0) if self.tier(it) in ('number', 'label') or it.get('fit') else 1.0
        ink = dict(self.ink, latin=self.ink['latin'] * k)
        spc = float(it.get('spc', 0.0)) * size
        n, mw = estimate_lines(it['text'], size, w if w else 10 ** 6, ink, spc)
        extra = it['text'].count('\n') * self.hi.get('para_gap_mult', 0.4) * size if it.get('para_gap') else 0.0
        return n, (min(w, mw) if w else mw), n * size * LH + extra

    def gap_mult(self, items, i):
        if i == 0:
            return 0.0
        it, prev = items[i], items[i - 1]
        if it.get('gap') is not None:
            return float(it['gap'])
        return 1.0 if it.get('group') is not None and it.get('group') == prev.get('group') else 2.0

    def is_flex(self, it):
        k = it['kind']
        return (k == 'image' and 'h' not in it) or (k == 'chart' and 'aspect' not in it) or k == 'table'

    # ---- 自然高度
    def cells_of(self, row):
        return [c if isinstance(c, list) else [c] for c in row['cells']]

    def row_widths(self, row, w):
        n = len(row['cells'])
        gap = float(row.get('cell_gap', self.col_gap_mult)) * self.g
        ratios = row.get('_ratios') or row.get('ratios') or [1.0] * n
        W = w - (n - 1) * gap
        tot = sum(ratios)
        return [W * r / tot for r in ratios], gap

    def fit_w(self, it):
        if it['kind'] == 'icon':
            return float(it.get('em', 2.2)) * self.body
        if it['kind'] == 'text':
            return self.ink_of(it)[1] + 1.0
        if it['kind'] == 'tag':
            return self.tag_dim(it)[0]
        if it['kind'] == 'brace':
            return 0.8 * self.body
        raise Fail('pair.left 只能是 text / icon / tag / brace')

    def h_of(self, it, w):
        k = it['kind']
        if it.get('w_frac') and k in ('text', 'chart'):
            w = w * float(it['w_frac'])
        if k == 'text':
            return self.ink_of(it, w)[2]
        if k == 'icon':
            return float(it.get('em', 2.2)) * self.body
        if k == 'tag':
            return self.tag_dim(it)[1]
        if k == 'brace':
            return 0.0
        if k == 'image':
            return float(it.get('h', 0.0))
        if k == 'box':
            return float(it['h'])
        if k == 'vtimeline':
            return self.vtimeline_parts(it, w)['h']
        if k == 'chart':
            return w * float(it['aspect']) if 'aspect' in it else 0.0
        if k == 'table':
            return it['rows'] * float(it.get('row_min', 24))
        if k == 'pair':
            wl = self.fit_w(it['left'])
            return max(self.h_of(it['left'], wl), self.h_of(it['right'], max(w - wl - TIGHT * self.body, 1.0)))
        if k == 'stack':
            return self.stack_h(it['items'], w)
        if k == 'row':
            ws, _ = self.row_widths(it, w)
            return max(self.stack_h(c, cw) for c, cw in zip(self.cells_of(it), ws))
        if k == 'card':
            p, off = self.p, self.tag_off(it)
            return off[1] + self.tag_clear(it) + self.stack_h(it['items'], w - off[0] - 2 * p) + 2 * p
        if k == 'timeline':
            return self.timeline_h(it, w)
        raise Fail(f'未知 kind {k}')

    def stack_h(self, items, w):
        return sum(self.gap_mult(items, i) * self.g + self.h_of(it, w) for i, it in enumerate(items))

    def tag_dim(self, tag):
        size = float(tag['size'])
        if tag.get('shape', 'circle') == 'circle':
            k = float(tag.get('d_em', 1.7))      # 第七轮：序号圆缩小（≈ 1.7 × 字号）+ 数字加粗；大圆 + 小数字不再用
            d = max(self.ink_of({'kind': 'text', 'text': tag['text'], 'size': size, 'tier': 'fixed'})[1] + max(k - 1.2, 0.5) * size, k * size)
            return d, d
        return self.ink_of({'kind': 'text', 'text': tag['text'], 'size': size, 'tier': 'fixed'})[1] + 2.2 * size, 2.0 * size

    def tag_off(self, card):
        """(卡片相对格子左沿的偏移, 卡片上沿相对格子上沿的偏移)"""
        tag = card.get('tag')
        if not tag:
            return 0.0, 0.0
        tw, th_ = self.tag_dim(tag)
        return (tw / 3 if tag.get('shape', 'circle') == 'circle' else 0.0), th_ / 2

    def tag_clear(self, card):
        """卡片内容要让开压在左上角的 tag：上内缩至少 = tag 下半截 + 0.4g（仍在 S-04 的 p ± e 之内）"""
        tag = card.get('tag')
        if not tag:
            return 0.0
        return max(0.0, self.tag_dim(tag)[1] / 2 + 0.4 * self.g - self.p)

    # ---- 时间线
    def timeline_parts(self, it, w):
        n = len(it['nodes'])
        gap = 2 * self.g
        iw = (w - (n - 1) * gap) / n
        time_h = max(self.ink_of({'kind': 'text', 'text': nd['time'], 'tier': 'heading'}, iw)[2] for nd in it['nodes'] if nd.get('time'))
        text_h = max([self.ink_of({'kind': 'text', 'text': nd['text'], 'tier': 'body'}, iw)[2] for nd in it['nodes'] if nd.get('text')] or [0.0])
        has_icon = any(nd.get('icon') for nd in it['nodes'])
        icon = float(it.get('icon_em', 3.4)) * self.body if has_icon else 0.0
        dot = 0.9 * self.body
        co = it.get('callout')
        co_h = co_w = 0.0
        if co:
            cs = float(co.get('size', self.body))
            co_w = min(w, self.ink_of({'kind': 'text', 'text': co['text'], 'size': cs, 'tier': 'fixed'})[1] + 2 * self.g + 2.0)
            co_h = self.ink_of({'kind': 'text', 'text': co['text'], 'size': cs, 'tier': 'fixed'}, co_w - 2 * self.g)[2] + self.g
        return dict(n=n, gap=gap, iw=iw, time_h=time_h, text_h=text_h, icon=icon, dot=dot, co_h=co_h, co_w=co_w, arrow=1.2 * self.body if co else 0.0)

    def timeline_h(self, it, w):
        t = self.timeline_parts(it, w)
        h = t['time_h'] + self.g + t['dot'] + self.g + (t['icon'] + self.g if t['icon'] else 0.0) + t['text_h']
        if t['co_h']:
            h += t['co_h'] + TIGHT * self.body + t['arrow'] + self.g
        return h

    # ---- 竖向时间线
    def vtimeline_parts(self, it, w):
        ts = float(it.get('time_size', self.heading))
        tw = float(it.get('time_em', 5)) * ts
        xw = max(w - tw - 2 * self.g, 1.0)
        rows = []
        for nd in it['nodes']:
            th_ = self.ink_of({'kind': 'text', 'text': nd['time'], 'tier': 'fixed', 'size': ts}, tw)[2]
            xh = self.ink_of({'kind': 'text', 'text': nd['text'], 'tier': 'body'}, xw)[2]
            rows.append((th_, xh, max(th_, xh)))
        return dict(ts=ts, tw=tw, xw=xw, rows=rows, dot=0.7 * self.body, h=sum(r[2] for r in rows) + (len(rows) - 1) * self.g)

    def place_vtimeline(self, it, x, y, w, out):
        t = self.vtimeline_parts(it, w)
        tid, ax = it['id'], x + t['tw'] + self.g
        out[f'{tid}.axis'] = {'id': f'{tid}.axis', 'kind': 'arrow', 'x': ax, 'y': y, 'w': 0.0, 'h': t['h']}
        for nd, (th_, xh, rh) in zip(it['nodes'], t['rows']):
            nid = nd['id']
            out[f'{nid}.time'] = {'id': f'{nid}.time', 'kind': 'text', 'x': x, 'y': y + (rh - th_) / 2, 'w': t['tw'], 'h': th_, 'size': t['ts'], 'align': 'right'}
            out[f'{nid}.dot'] = {'id': f'{nid}.dot', 'kind': 'tag', 'x': ax - t['dot'] / 2, 'y': y + rh / 2 - t['dot'] / 2, 'w': t['dot'], 'h': t['dot'], 'shape': 'circle'}
            out[f'{nid}.text'] = {'id': f'{nid}.text', 'kind': 'text', 'x': ax + self.g, 'y': y + (rh - xh) / 2, 'w': t['xw'], 'h': xh, 'size': self.body, 'align': 'left'}
            y += rh + self.g

    # ---- g：二分求最大的可行 g
    def col_h(self, col, w):
        return self.stack_h(col['items'], w)

    def col_flex(self, col):
        return any(self.is_flex(it) for it in col['items'])

    def set_title(self):
        t = self.spec.get('title')
        if not t:
            self.title_bottom0 = self.spec.get('title_bottom')
            self.title_box = None
            return
        tw = float(t.get('w', self.margin[2]))
        rng = self.th['title']['heavy_size'] if self.density == 'heavy' else self.th['title']['other_size']
        lo = self.deck['title_size']['min']
        cands = [s for s in self.type_scale if lo - 0.5 <= s <= rng[1] + 0.5]
        size = None
        tt = self.th['title']
        spc_k, maxw = float(tt.get('content_spacing', 0.075)), float(tt.get('max_width_frac', 0.84))
        for s in reversed(cands):                 # 长标题（占了大半页宽）适当缩号：墨迹宽 ≤ 84% 标题宽
            n, mw = estimate_lines(t['text'], s, tw, self.ink, spc_k * s)
            if n == 1 and mw <= maxw * tw:
                size = s
                break
        if size is None and cands and estimate_lines(t['text'], cands[0], tw, self.ink, spc_k * cands[0])[0] == 1:
            size = cands[0]
        if size is None:
            raise Fail(f'title 在 {lo}pt 仍放不进一行（宽 {tw}）：缩短标题由用户决定，排版不改文案')
        if size < rng[0] - 0.5:
            self.notes.append(f'title 为保持单行缩到 {size}（该档区间 {rng}）')
        a = self.deck['title_anchor']
        self.title_box = {'id': 'title', 'kind': 'text', 'x': float(t.get('x', a['x'])), 'y': a['y'], 'w': tw, 'h': size * LH, 'size': size, 'spc': round(spc_k * size, 2)}
        self.title_bottom0 = a['y'] + size * LH

    def feasible(self, g):
        """返回 max(刚性列高 − body 高)；≤ 0 即放得下"""
        self.g = g
        self.title_bottom = self.title_bottom0
        k = self.spec.get('kicker')
        if k and self.title_bottom0 is not None:
            kh = estimate_lines(k['text'], float(k['size']), float(k['w']), self.ink)[0] * float(k['size']) * LH
            self.title_bottom = self.title_bottom0 + g + kh
        B = self.B
        worst = -10 ** 6
        for col, (_, w) in zip(self.spec['columns'], self.col_widths()[0]):
            if col.get('edge') or self.col_flex(col):
                floor = sum(self.gap_mult(col['items'], i) * g + (0 if self.is_flex(it) else self.h_of(it, w)) for i, it in enumerate(col['items'])) + (48 if self.col_flex(col) else 0)
                worst = max(worst, floor - B[3]) if not col.get('edge') else worst
                continue
            self.balance_rows(col['items'], w)
            worst = max(worst, self.col_h(col, w) - B[3])
        return worst

    def balance_rows(self, items, w):
        for it in items:
            if it['kind'] == 'row' and it.get('balance'):
                n = len(it['cells'])
                it['_ratios'] = list(it.get('ratios') or [1.0] * n)
                for _ in range(12):
                    ws, _g = self.row_widths(it, w)
                    hs = [self.stack_h(c, cw) for c, cw in zip(self.cells_of(it), ws)]
                    mean = sum(hs) / n
                    if max(hs) - min(hs) < 0.5 * self.body:
                        break
                    it['_ratios'] = [r * (h / mean) ** 0.6 for r, h in zip(it['_ratios'], hs)]
            elif it['kind'] == 'stack':
                self.balance_rows(it['items'], w)

    def solve_g(self):
        g_min, g_max = self.sc['g_min_mult'] * self.body, self.sc['g_max_mult'] * self.body
        if all(c.get('edge') or self.col_flex(c) for c in self.spec['columns']):
            # 只有伸缩列（整页一张表 / 一张图）：没有内容在约束 g，取 1 × 正文，把高度让给伸缩元素，而不是撑开间距
            g = self.body if self.feasible(self.body) <= 0 else g_min
            if self.feasible(g) > 0.5:
                raise Fail('伸缩列的固定部分已超过 body 高：内容超载')
            return g, False
        if self.feasible(g_max) <= 0:
            return g_max, True
        if self.feasible(g_min) > 0.5:
            raise Fail(f'g 低于下限 {g_min:.1f}（正文 {self.body}）仍放不下：内容超载，拆页或改结构，不缩字号')
        lo, hi = g_min, g_max
        for _ in range(40):
            mid = (lo + hi) / 2
            if self.feasible(mid) <= 0:
                lo = mid
            else:
                hi = mid
        return lo, False

    def text_nodes(self, items=None):
        items = items if items is not None else [it for c in self.spec['columns'] for it in c['items']]
        for it in items:
            k = it['kind']
            if k == 'text':
                yield it
            elif k == 'pair':
                yield from self.text_nodes([it['left'], it['right']])
            elif k in ('stack', 'card'):
                yield from self.text_nodes(it['items'])
            elif k == 'row':
                for c in self.cells_of(it):
                    yield from self.text_nodes(c)

    def refresh_label(self):
        labels = [t['text'] for t in self.text_nodes() if self.tier(t) == 'label']
        self._label = min([self.label_size(t) for t in labels]) if labels else self.body

    def sizes_ok(self):
        """升档后：段落 ≤ 4 行、大数字 / nowrap 不折行、g 不低于下限"""
        self.refresh_label()
        try:
            g, _ = self.solve_g()
        except Fail:
            return False
        self.feasible(g)
        return not self.wrap_problems()

    def wrap_problems(self, items=None, w=None):
        """在当前 g 下走一遍树，找折行的大数字 / nowrap 文本与超过 4 行的正文段落"""
        bad = []
        mx = self.th['text']['para_max_lines']

        def walk(it, w):
            k = it['kind']
            if k == 'text':
                n = self.ink_of(it, w)[0]
                if (self.tier(it) == 'number' or it.get('nowrap')) and n > it['text'].count('\n') + 1:
                    bad.append(('wrap', it.get('id')))
                if self.tier(it) == 'body' and any(self.ink_of(dict(it, text=para), w)[0] > mx for para in it['text'].split('\n')):
                    bad.append(('para', it.get('id')))
            elif k == 'pair':
                wl = self.fit_w(it['left'])
                if wl > w * 0.75:
                    bad.append(('wrap', it['left'].get('id')))
                walk(it['right'], max(w - wl - TIGHT * self.body, 1.0))
            elif k == 'stack':
                for c in it['items']:
                    walk(c, w)
            elif k == 'card':
                for c in it['items']:
                    walk(c, w - self.tag_off(it)[0] - 2 * self.p)
            elif k == 'row':
                ws, _ = self.row_widths(it, w)
                for cell, cw in zip(self.cells_of(it), ws):
                    for c in cell:
                        walk(c, cw)
        for col, (_, cw) in zip(self.spec['columns'], self.col_widths()[0]):
            for it in col['items']:
                walk(it, cw)
        return bad

    def solve(self):
        self.set_title()
        self.refresh_label()
        has = {t: any(self.tier(x) == t for x in self.text_nodes()) for t in ('body', 'heading', 'number')}
        has['body'] = has['body'] or any(it['kind'] in ('timeline', 'vtimeline') for c in self.spec['columns'] for it in c['items'])
        # 大数字起始就折行 → 缩（不低于 2.5 b 的起始值就是下限：此时只能加宽列）
        g, capped = self.solve_g()
        self.feasible(g)
        if any(k == 'wrap' for k, _ in self.wrap_problems()):
            raise Fail('大数字 / nowrap 文本在起始字号下就折行：加宽列（改 columns）或改结构，不换内容')
        # 放大顺序：正文 → 小标题级 → 大数字；大数字永远最后升
        while capped:
            old = (self.body, self.heading, self.number, self.heading_cap, self.number_cap, self.body_cap)
            moved = False
            if has['body'] and self.body < self.body_cap - 0.5:
                keep_h, keep_n = self.heading, self.number
                self.body = self._at_least(self.body + 0.6)
                self._derive()
                self.heading, self.number = max(self.heading, keep_h), max(self.number, keep_n)
                moved = self.sizes_ok()
            if not moved:
                self.body, self.heading, self.number, self.heading_cap, self.number_cap, self.body_cap = old
                if has['heading'] and self.heading < self.heading_cap - 0.5:
                    self.heading = self._at_least(self.heading + 0.6)
                    moved = self.sizes_ok()
            if not moved:
                self.body, self.heading, self.number, self.heading_cap, self.number_cap, self.body_cap = old
                if has['number'] and self.number < self.number_cap - 0.5:
                    self.number = self._at_least(self.number + 0.6)
                    moved = self.sizes_ok()
            if not moved:
                self.body, self.heading, self.number, self.heading_cap, self.number_cap, self.body_cap = old
                self.refresh_label()
                break
            self.notes.append(f'升档：正文 {self.body} / 小标题 {self.heading} / 大数字 {self.number}')
            g, capped = self.solve_g()
        g, capped = self.solve_g()
        self.feasible(g)
        return self.finalize()

    # ---- 出框
    def place(self, it, x, y, w, out, h_avail=None):
        k = it['kind']
        h = h_avail if (h_avail is not None and (self.is_flex(it) or (k == 'card' and it.get('_stretch')))) else self.h_of(it, w)
        if it.get('w_frac') and k in ('text', 'chart'):
            nw = w * float(it['w_frac'])
            x, w = x + (w - nw) / 2, nw
            it = dict(it, w_frac=None)
        b = {'id': it.get('id'), 'kind': k, 'x': x, 'y': y, 'w': w, 'h': h}
        if k == 'text':
            n, iw, th_ = self.ink_of(it, w)
            al = it.get('align', 'left')
            if it.get('para_gap'):
                b['para_gap'] = round(self.hi.get('para_gap_mult', 0.4) * self.size_of(it), 1)
            if it.get('unit'):
                b['unit_size'] = float(it.get('unit_size') or self._label)
            b.update(size=self.size_of(it), lines=n, ink_w=iw, align=al, role=it.get('role'),
                     ink_x=x + ((w - iw) / 2 if al == 'center' else (w - iw) if al == 'right' else 0.0))
            if it.get('spc'):
                b['spc'] = round(float(it['spc']) * b['size'], 2)
        elif k == 'icon':
            b['w'] = h
            if it.get('align') == 'center':
                b['x'] = x + (w - h) / 2
        elif k == 'box':
            bw = float(it['w']) if it.get('w') else w * float(it.get('w_frac', 1.0))
            b['x'], b['w'] = (x + (w - bw) / 2 if it.get('align') == 'center' else x), bw
        elif k == 'vtimeline':
            self.place_vtimeline(it, x, y, w, out)
        elif k == 'tag':
            b['w'], b['shape'], b['size'] = self.tag_dim(it)[0], it.get('shape', 'circle'), float(it['size'])
        elif k == 'image':
            from PIL import Image
            pw, ph = Image.open(it['path']).size
            a, bb = pw / ph, b['w'] / b['h']
            b['img_w'] = b['h'] * a if a > bb else b['w']
            b['img_h'] = b['h'] if a > bb else b['w'] / a
        elif k == 'table':
            b['row_h'] = b['h'] / it['rows']
        elif k == 'pair':
            wl = self.fit_w(it['left'])
            hl, wr = self.h_of(it['left'], wl), max(w - wl - TIGHT * self.body, 1.0)
            hr = self.h_of(it['right'], wr)
            ctr = it.get('valign', 'center') == 'center'
            if it['left']['kind'] == 'brace':
                out[it['left']['id']] = {'id': it['left']['id'], 'kind': 'brace', 'x': x, 'y': y, 'w': wl, 'h': h}
            else:
                self.place(it['left'], x, y + ((h - hl) / 2 if ctr else 0.0), wl, out)
            self.place(it['right'], x + wl + TIGHT * self.body, y + ((h - hr) / 2 if ctr else 0.0), wr, out)
            return h
        elif k == 'stack':
            self.place_stack(it['items'], x, y, w, out)
            return h
        elif k == 'row':
            ws, gap = self.row_widths(it, w)
            cx = x
            for cell, cw in zip(self.cells_of(it), ws):
                ch = self.stack_h(cell, cw)
                if it.get('stretch'):
                    for c in cell:
                        if c['kind'] == 'card':
                            c['_stretch'] = True
                    self.place_stack(cell, cx, y, cw, out, fill_h=h)
                else:
                    self.place_stack(cell, cx, y + ((h - ch) / 2 if it.get('valign') == 'center' else 0.0), cw, out)
                cx += cw + gap
            return h
        elif k == 'card':
            p = self.p
            ox, oy = self.tag_off(it)
            b.update(x=x + ox, y=y + oy, w=w - ox, h=h - oy, p=p)
            inner_h = self.stack_h(it['items'], w - ox - 2 * p)
            tc = self.tag_clear(it)
            self.place_stack(it['items'], x + ox + p, y + oy + p + tc + max(0.0, (h - oy - tc - 2 * p - inner_h) / 2), w - ox - 2 * p, out)
            tag = it.get('tag')
            if tag:
                tw, th_ = self.tag_dim(tag)
                out[tag['id']] = {'id': tag['id'], 'kind': 'tag', 'x': x, 'y': y, 'w': tw, 'h': th_, 'size': float(tag['size']), 'shape': tag.get('shape', 'circle')}
        elif k == 'timeline':
            self.place_timeline(it, x, y, w, out)
        if b['id']:
            out[b['id']] = b
        return h

    def place_stack(self, items, x, y0, w, out, target_h=None, fill_h=None):
        nat = self.stack_h(items, w)
        n_flex = sum(1 for it in items if self.is_flex(it))
        share = ((target_h - nat) / n_flex) if (target_h is not None and n_flex) else 0.0
        y = y0
        for i, it in enumerate(items):
            y += self.gap_mult(items, i) * self.g
            avail = None
            if self.is_flex(it) and target_h is not None:
                avail = self.h_of(it, w) + share
            elif fill_h is not None and it['kind'] == 'card' and len(items) == 1:
                avail = fill_h
            y += self.place(it, x, y, w, out, avail)
        return y

    def place_timeline(self, it, x, y, w, out):
        t = self.timeline_parts(it, w)
        g, tid = self.g, it['id']
        centers = [x + t['iw'] / 2 + i * (t['iw'] + t['gap']) for i in range(t['n'])]
        if t['co_h']:
            co = it['callout']
            cx = centers[int(co['at'])]
            bx = min(max(cx - t['co_w'] / 2, x), x + w - t['co_w'])
            out[f'{tid}.callout'] = {'id': f'{tid}.callout', 'kind': 'tag', 'x': bx, 'y': y, 'w': t['co_w'], 'h': t['co_h'], 'size': float(co.get('size', self.body)), 'shape': 'round'}
            ay = y + t['co_h'] + TIGHT * self.body
            out[f'{tid}.arrow'] = {'id': f'{tid}.arrow', 'kind': 'arrow', 'x': cx - 0.5 * self.body, 'y': ay, 'w': self.body, 'h': t['arrow']}
            y = ay + t['arrow'] + g
        y_dot = y + t['time_h'] + g
        y_icon = y_dot + t['dot'] + g
        y_text = y_icon + (t['icon'] + g if t['icon'] else 0.0)
        out[f'{tid}.axis'] = {'id': f'{tid}.axis', 'kind': 'arrow', 'x': x, 'y': y_dot + t['dot'] / 2, 'w': w, 'h': 0.0}
        for nd, cx in zip(it['nodes'], centers):
            nid = nd['id']
            th_ = self.ink_of({'kind': 'text', 'text': nd['time'], 'tier': 'heading'}, t['iw'])[2] if nd.get('time') else 0.0
            if nd.get('time'):
                out[f'{nid}.time'] = {'id': f'{nid}.time', 'kind': 'text', 'x': cx - t['iw'] / 2, 'y': y, 'w': t['iw'], 'h': t['time_h'], 'size': self.heading, 'align': 'center', 'valign': 'bottom'}
            out[f'{nid}.dot'] = {'id': f'{nid}.dot', 'kind': 'tag', 'x': cx - t['dot'] / 2, 'y': y_dot, 'w': t['dot'], 'h': t['dot'], 'shape': 'circle', 'empty': bool(nd.get('empty'))}
            if nd.get('icon'):
                out[f'{nid}.icon'] = {'id': f'{nid}.icon', 'kind': 'icon', 'x': cx - t['icon'] / 2, 'y': y_icon, 'w': t['icon'], 'h': t['icon']}
            if nd.get('text'):
                hh = self.ink_of({'kind': 'text', 'text': nd['text'], 'tier': 'body'}, t['iw'])[2]
                out[f'{nid}.text'] = {'id': f'{nid}.text', 'kind': 'text', 'x': cx - t['iw'] / 2, 'y': y_text, 'w': t['iw'], 'h': hh, 'size': self.body, 'align': 'center'}

    def ink_span(self, it, x, w):
        """节点的墨迹左右沿（S-03 预检）。容器 / 图 / 表 / 时间线占满所在宽度"""
        k = it['kind']
        if it.get('w_frac') and k in ('text', 'chart'):
            nw = w * float(it['w_frac']); x, w = x + (w - nw) / 2, nw
        if k == 'text':
            n, iw = self.ink_of(it, w)[:2]
            if n > it['text'].count('\n') + 1:                                # 折行的段落：墨迹撑满文本框
                return x, x + w
            iw += float(it.get('indent', 0.0)) * self.size_of(it)
            if self.tier(it) in ('number', 'label') or it.get('fit'):
                iw = min(w, iw / self.sc.get('nowrap_safety', 1.0))          # 校验器不带安全系数
            al = it.get('align', 'left')
            x0 = x + ((w - iw) / 2 if al == 'center' else (w - iw) if al == 'right' else 0.0)
            return x0, x0 + iw
        if k in ('icon', 'tag', 'brace'):
            fw = self.fit_w(it)
            x0 = x + (w - fw) / 2 if it.get('align') == 'center' else x
            return x0, x0 + fw
        if k == 'pair':
            wl = self.fit_w(it['left'])
            return x, self.ink_span(it['right'], x + wl + TIGHT * self.body, max(w - wl - TIGHT * self.body, 1.0))[1]
        if k == 'stack':
            sp = [self.ink_span(c, x, w) for c in it['items']]
            return min(a for a, _ in sp), max(b for _, b in sp)
        if k == 'row':
            ws, gap = self.row_widths(it, w)
            sp, cx = [], x
            for cell, cw in zip(self.cells_of(it), ws):
                sp += [self.ink_span(c, cx, cw) for c in cell]
                cx += cw + gap
            return (min(a for a, _ in sp), max(b for _, b in sp)) if sp else (x, x + w)
        if k == 'box':
            bw = float(it['w']) if it.get('w') else w * float(it.get('w_frac', 1.0))
            x0 = x + (w - bw) / 2 if it.get('align') == 'center' else x
            return x0, x0 + bw
        return x, x + w

    def precheck_edges(self, xws, e):
        """S-03 横向：内容块左右沿必须落在版心边 ± e。左对齐的窄内容放在最右列、居中的窄内容放在最左列都会挂"""
        cols = self.spec['columns']
        spans = [(ci, self.ink_span({'kind': 'stack', 'items': c['items']}, x, w)) for ci, (c, (x, w)) in enumerate(zip(cols, xws)) if not c.get('edge') and c['items']]
        if not spans:
            return True
        ok = True
        left, right = self.margin[0], self.margin[0] + self.margin[2]
        side_l = any(c.get('edge') == 'left' or (c.get('region') and i == 0 and len(cols) > 1) for i, c in enumerate(cols))
        side_r = any(c.get('edge') == 'right' or (c.get('region') and i == len(cols) - 1 and len(cols) > 1) for i, c in enumerate(cols))
        d_l, d_r = min(a for _, (a, _) in spans) - left, right - max(b for _, (_, b) in spans)
        if not side_l and d_l > e:
            ok = False
            self.notes.append(f'内容块左沿离版心 {d_l:.1f} > e={e:.1f}（S-03 会挂）：最左列是居中 / 收窄的内容，改左对齐，或把它放进区域背景')
        if not side_r and d_r > e:
            ok = False
            self.notes.append(f'内容块右沿离版心 {d_r:.1f} > e={e:.1f}（S-03 会挂）：最右列是左对齐的窄内容。把图表 / 表格 / 区域背景放右、文字放左，或用 row.ratios 收窄末格，不加字')
        return ok

    def finalize(self):
        xws, gap = self.col_widths()
        B = self.B
        e = self.sc['e_mult'] * self.g
        out = {}
        heights, flexes = [], []
        for col, (x, w) in zip(self.spec['columns'], xws):
            if col.get('edge'):
                heights.append(0.0); flexes.append(True); continue
            self.balance_rows(col['items'], w)
            heights.append(self.col_h(col, w)); flexes.append(self.col_flex(col))
        rigid = [h for h, f in zip(heights, flexes) if not f]
        block_h = max(rigid) if rigid else B[3]
        block_top = B[1] + (B[3] - block_h) / 2
        if block_h < B[3] - 0.5:
            self.notes.append(f'内容块高 {block_h:.1f} < body 高 {B[3]:.1f}，整块居中，上下各留 {(B[3] - block_h) / 2:.1f}（字号已到上限，不加字）')
        ok, max_res = True, 0.0
        for ci, (col, (x, w)) in enumerate(zip(self.spec['columns'], xws)):
            if col.get('edge'):                                  # 配图方式 5 / 6：满页高贴边
                it = col['items'][0]
                self.place(dict(it, h=self.page_h), x, 0.0, w, out)
                continue
            off = 0.0 if flexes[ci] else (block_h - heights[ci]) / 2
            if off > 0.5:
                self.notes.append(f'列 {ci} 比内容块矮，列内居中，上下各空 {off:.1f}（S-05 允许 ≤ 3g={3 * self.g:.1f}）')
                max_res = max(max_res, off)
            self.place_stack(col['items'], x, block_top + off, w, out, target_h=block_h if flexes[ci] else None)
            if col.get('region'):
                rx = x - gap / 2
                left_side = ci == 0 and len(xws) > 1
                out['region'] = {'id': 'region', 'kind': 'region', 'y': 0.0, 'h': self.page_h,
                                 'x': 0.0 if left_side else rx, 'w': (x + w + gap / 2) if left_side else self.page_w - rx}
            y = block_top + off
            for i, it in enumerate(col['items']):
                y += self.gap_mult(col['items'], i) * self.g
                if it.get('region') == 'bottom':
                    ry = y - 1.5 * self.g
                    out['region'] = {'id': 'region', 'kind': 'region', 'x': 0.0, 'y': ry, 'w': self.page_w, 'h': self.page_h - ry}
                y += self.h_of(it, w) if not self.is_flex(it) else 0.0
        if not self.precheck_edges(xws, e):
            ok = False
        reg = out.get('region')
        if reg and self.title_box and reg['h'] >= self.page_h - 1:          # 侧边区域背景：标题墨迹不得压到区域上
            t = self.spec['title']
            spc_k = float(self.th['title'].get('content_spacing', 0.075))
            ink_r = self.title_box['x'] + estimate_lines(t['text'], self.title_box['size'], 10 ** 6, self.ink, spc_k * self.title_box['size'])[1]
            if reg['x'] > self.title_box['x'] and ink_r > reg['x'] - self.g:
                ok = False
                self.notes.append(f'标题墨迹右沿 {ink_r:.0f} 压到右侧区域背景（x={reg["x"]:.0f}）：改用贴底区域（节点加 region: "bottom"），或给 title.w 让标题缩一档')
        if max_res > self.sc['hole_mult'] * self.g + 0.5:
            ok = False
            self.notes.append(f'列内居中留下的空当 {max_res:.1f} > 3g={3 * self.g:.1f}（S-05 会判洞）：调列比或改结构，不加字')
        if self.title_box:
            out['title'] = self.title_box
        k = self.spec.get('kicker')
        if k and self.title_bottom0 is not None:
            kh = estimate_lines(k['text'], float(k['size']), float(k['w']), self.ink)[0] * float(k['size']) * LH
            out['kicker'] = {'id': 'kicker', 'kind': 'text', 'x': self.margin[0], 'y': self.title_bottom0 + self.g, 'w': float(k['w']), 'h': kh, 'size': float(k['size'])}
        for b in out.values():
            for kk, v in list(b.items()):
                if isinstance(v, float):
                    b[kk] = round(v, 2)
        return {'ok': ok, 'g': round(self.g, 2), 'p': round(self.p, 2), 'e': round(e, 2), 'tight': round(TIGHT * self.body, 2),
                'sizes': {'body': self.body, 'heading': self.heading, 'label': self._label, 'number': self.number,
                          'title': self.title_box['size'] if self.title_box else None},
                'title_bottom': self.title_bottom, 'B': [round(v, 2) for v in B], 'boxes': out, 'notes': self.notes}


def write_g(manifest_path, page_no, g):
    """把算出的 g 写进 deck.manifest.yaml 该页条目（有则替换，无则加在 columns 后）"""
    import re
    p = manifest_path
    with open(p, encoding='utf-8') as f:
        s = f.read()
    m = re.search(rf'^  - page: {page_no}\s*$', s, re.M)
    if not m:
        return False
    end = re.search(r'^  - page: ', s[m.end():], re.M)
    a, b = m.start(), (m.end() + end.start()) if end else len(s)
    blk = s[a:b]
    line = f'    g: {round(g, 2)}'
    if re.search(r'^    g: .*$', blk, re.M):
        blk = re.sub(r'^    g: .*$', line, blk, count=1, flags=re.M)
    elif re.search(r'^    columns: .*$', blk, re.M):
        blk = re.sub(r'^(    columns: .*)$', r'\1\n' + line, blk, count=1, flags=re.M)
    else:
        blk = blk.rstrip('\n') + '\n' + line + '\n'
    with open(p, 'w', encoding='utf-8') as f:
        f.write(s[:a] + blk + s[b:])
    return True


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('spec')
    ap.add_argument('--deck', default=None)
    ap.add_argument('--thresholds', default=os.path.join(HERE, '..', 'thresholds.yaml'))
    ap.add_argument('--write-g', action='store_true', help='把算出的 g 写进 --deck 的该页条目（spec.page.page 为页码）')
    a = ap.parse_args()
    with open(a.spec, encoding='utf-8') as f:
        spec = json.load(f)
    deck = spec.get('deck') or load_yaml(a.deck)['deck']
    th = load_yaml(a.thresholds)
    try:
        out = Layout(spec, deck, th).solve()
    except Fail as ex:
        out = {'ok': False, 'notes': [str(ex)], 'boxes': {}}
    if out['ok'] and a.write_g and a.deck and spec['page'].get('page'):
        out['g_written'] = write_g(a.deck, int(spec['page']['page']), out['g'])
    json.dump(out, sys.stdout, ensure_ascii=False, indent=1)
    return 0 if out['ok'] else 1


if __name__ == '__main__':
    sys.exit(main())
