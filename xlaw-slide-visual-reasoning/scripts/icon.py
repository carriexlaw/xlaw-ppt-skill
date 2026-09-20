#!/usr/bin/env python3
"""
icon.py — 开源 icon 的 SVG → 重着色 → 4× PNG（带透明通道），供 pptxgenjs addImage 插入（11 Icon Style）。

    python icon.py node_modules/@phosphor-icons/core/assets/fill/factory-fill.svg _qa/icons/factory-1F4FD8.png --color 1F4FD8 [--secondary 9CC2FF] [--px 256]

- 单色（线形 / 面性）：把 SVG 里的 currentColor / 黑色改成 --color
- 双色（Phosphor duotone）：opacity="0.2" 的那一层改成 --secondary（不透明），其余用 --color
- 栅格化优先 cairosvg；没有 libcairo 的机器上回退到 PyMuPDF（本 skill 的既有依赖），不直接插 SVG
"""
import argparse
import os
import re
import sys


def recolor(svg, color, secondary=None):
    c = '#' + color.lstrip('#')
    if secondary:
        s2 = '#' + secondary.lstrip('#')
        svg = re.sub(r'(<[^>]*?)opacity="0\.2"([^>]*?>)', lambda m: (m.group(1) + f'fill="{s2}"' + m.group(2)), svg)
    svg = svg.replace('currentColor', c)
    if 'fill=' not in svg.split('>', 1)[0]:
        svg = svg.replace('<svg ', f'<svg fill="{c}" ', 1)
    svg = re.sub(r'fill="(#000|#000000|black)"', f'fill="{c}"', svg)
    svg = re.sub(r'stroke="(#000|#000000|black)"', f'stroke="{c}"', svg)
    return svg


def rasterize(svg, out, px):
    try:
        import cairosvg
        cairosvg.svg2png(bytestring=svg.encode('utf-8'), write_to=out, output_width=px, output_height=px)
        return 'cairosvg'
    except (ImportError, OSError):
        import fitz
        doc = fitz.open(stream=svg.encode('utf-8'), filetype='svg')
        page = doc[0]
        z = px / max(page.rect.width, page.rect.height)
        pix = page.get_pixmap(matrix=fitz.Matrix(z, z), alpha=True)
        pix.save(out)
        return 'pymupdf'


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument('svg')
    ap.add_argument('out')
    ap.add_argument('--color', required=True, help='色板色 hex')
    ap.add_argument('--secondary', default=None, help='duotone 第二色 hex')
    ap.add_argument('--px', type=int, default=256)
    a = ap.parse_args()
    with open(a.svg, encoding='utf-8') as f:
        svg = recolor(f.read(), a.color, a.secondary)
    os.makedirs(os.path.dirname(os.path.abspath(a.out)), exist_ok=True)
    how = rasterize(svg, a.out, a.px)
    print(f'{a.out} ({how})')
    return 0


if __name__ == '__main__':
    sys.exit(main())
