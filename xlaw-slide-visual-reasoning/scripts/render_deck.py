"""
render_deck.py — 把 deck.pptx 渲染成逐页 PNG，供 13-visual-qa 的感知测试自查

    python render_deck.py --check              # 前置检查：检测 soffice 与 CJK 字体，缺失即 exit 1 并打印安装方式
    python render_deck.py deck.pptx            # 输出 _qa/render/NN.png（NN 从 01 起，宽 1280）
    python render_deck.py deck.pptx --grid 3x2 # 另输出 _qa/render/grid-NN.png：每张 3×2 页的整套拼图（Flip / Silhouette / Anchor 测试用）
    python render_deck.py deck.pptx --pages 5,12   # 只重渲染这几页（其余 PNG 保留）
    python render_deck.py deck.pptx --width 1920 --out _qa/render

依赖 LibreOffice（soffice）与 PyMuPDF。渲染是运行前提，不允许跳过。
"""
import argparse
import os
import shutil
import subprocess
import sys
import tempfile

SOFFICE_CANDIDATES = [
    'soffice', 'libreoffice',
    '/Applications/LibreOffice.app/Contents/MacOS/soffice',
    r'C:\Program Files\LibreOffice\program\soffice.exe',
    r'C:\Program Files (x86)\LibreOffice\program\soffice.exe',
    '/usr/bin/soffice', '/usr/lib/libreoffice/program/soffice', '/snap/bin/libreoffice',
]

INSTALL_HINT = """未检测到 LibreOffice（soffice）。本 skill 需要把 pptx 渲染成图做感知测试，这是运行前提。
请安装后重试：
  macOS   : brew install --cask libreoffice
  Windows : https://www.libreoffice.org/download/ 官网安装包
  Linux   : sudo apt install libreoffice-impress"""


def find_soffice():
    for c in SOFFICE_CANDIDATES:
        p = shutil.which(c) if not os.path.isabs(c) else (c if os.path.exists(c) else None)
        if p:
            return p
    return None


CJK_HINT = """LibreOffice 渲染中文时找不到任何 CJK 字体（会渲染成方框）。
macOS 上 LibreOffice 只读它自己的字体目录与用户 profile 的 fonts 目录，看不到系统的 PingFang。
本脚本会自动把 ~/Library/Fonts 里的 Noto Sans CJK 与系统 PingFang.ttc 链接到 LibreOffice 的 user/fonts；
若两者都没有，请先安装：brew install --cask font-noto-sans-cjk-sc，然后重跑 --check。"""

LO_USER_FONTS = os.path.expanduser('~/Library/Application Support/LibreOffice/4/user/fonts')


def _link_cjk_fonts():
    """把可用的 CJK 字体链接进 LibreOffice 用户字体目录；返回链接的文件名列表"""
    import glob
    if sys.platform != 'darwin':
        return []
    cands = glob.glob(os.path.expanduser('~/Library/Fonts/NotoSansCJK*.otf')) + \
        glob.glob('/System/Library/AssetsV2/com_apple_MobileAsset_Font*/*/AssetData/PingFang.ttc')
    # 11 字体系统的 macOS 首选：Source Han Sans（中文）与 Avenir Next（英文 / 数字）。不链接的话预览里会回退成衬线体，层级判断失真
    for d in ('~/Library/Fonts', '/Library/Fonts'):
        cands += glob.glob(os.path.expanduser(d + '/SourceHanSans*.otf')) + glob.glob(os.path.expanduser(d + '/SourceHanSans*.ttc'))
    cands += [f for f in ('/System/Library/Fonts/Avenir Next.ttc', '/System/Library/Fonts/Avenir Next Condensed.ttc') if os.path.exists(f)]
    if not cands:
        return []
    os.makedirs(LO_USER_FONTS, exist_ok=True)
    linked = []
    for src in cands:
        dst = os.path.join(LO_USER_FONTS, os.path.basename(src))
        if not os.path.exists(dst):
            os.symlink(src, dst)
            linked.append(os.path.basename(src))
    return linked


def _probe_cjk(soffice):
    """渲染一行中文，看 PDF 里是否嵌入了 CJK 字体"""
    import fitz
    with tempfile.TemporaryDirectory() as tmp:
        txt = os.path.join(tmp, 'probe.txt')
        with open(txt, 'w', encoding='utf-8') as f:
            f.write('中文渲染探测\n')
        subprocess.run([soffice, '--headless', '--norestore', '--convert-to', 'pdf', '--outdir', tmp, txt],
                       capture_output=True, text=True, timeout=120)
        pdf = os.path.join(tmp, 'probe.pdf')
        if not os.path.exists(pdf):
            return False, []
        fonts = sorted({f[3].split('+')[-1] for f in fitz.open(pdf)[0].get_fonts()})
        return any(not n.startswith('Liberation') for n in fonts), fonts


def check():
    p = find_soffice()
    if not p:
        print(INSTALL_HINT)
        return 1
    try:
        import fitz  # noqa: F401
    except ImportError:
        print('缺少 PyMuPDF：python3 -m pip install --user pymupdf')
        return 1
    print(f'soffice: {p}')
    linked = _link_cjk_fonts()      # 幂等：把 Noto CJK 与系统 PingFang 链接进 LibreOffice，渲染字体尽量贴近真实
    if linked:
        print(f'已链接 CJK 字体到 LibreOffice user/fonts：{", ".join(linked)}')
    ok, fonts = _probe_cjk(p)
    if not ok:
        print(CJK_HINT)
        return 1
    print(f'CJK 渲染探测通过：{", ".join(fonts)}')
    return 0


def _grid(out_dir, pages, cols, rows, width):
    """把已渲染的单页 PNG 拼成 cols×rows 的整套拼图 grid-NN.png（NN 从 01 起）"""
    from PIL import Image, ImageDraw
    per = cols * rows
    outs = []
    cell_w = width // cols
    for gi in range(0, len(pages), per):
        chunk = pages[gi:gi + per]
        ims = [Image.open(os.path.join(out_dir, f'{n:02d}.png')).convert('RGB') for n in chunk]
        cell_h = int(cell_w * ims[0].height / ims[0].width) + 18
        r = (len(chunk) + cols - 1) // cols
        sheet = Image.new('RGB', (cols * cell_w, r * cell_h), 'white')
        draw = ImageDraw.Draw(sheet)
        for i, (n, im) in enumerate(zip(chunk, ims)):
            im.thumbnail((cell_w - 6, cell_h - 22))
            x0, y0 = (i % cols) * cell_w, (i // cols) * cell_h
            sheet.paste(im, (x0 + 3, y0 + 3))
            draw.text((x0 + 6, y0 + cell_h - 16), f'p{n:02d}', fill='black')
        path = os.path.join(out_dir, f'grid-{gi // per + 1:02d}.png')
        sheet.save(path)
        outs.append(path)
    return outs


def render(pptx, out_dir='_qa/render', width=1280, pages=None, grid=None):
    import fitz
    soffice = find_soffice()
    if not soffice:
        print(INSTALL_HINT)
        return 1
    os.makedirs(out_dir, exist_ok=True)
    with tempfile.TemporaryDirectory() as tmp:
        cmd = [soffice, '--headless', '--norestore', '--convert-to', 'pdf', '--outdir', tmp, os.path.abspath(pptx)]
        r = subprocess.run(cmd, capture_output=True, text=True, timeout=300)
        pdf = os.path.join(tmp, os.path.splitext(os.path.basename(pptx))[0] + '.pdf')
        if r.returncode != 0 or not os.path.exists(pdf):
            print('soffice 转换失败：', r.stdout, r.stderr)
            return 1
        doc = fitz.open(pdf)
        if not pages:
            for old in os.listdir(out_dir):
                if old.endswith('.png'):
                    os.remove(os.path.join(out_dir, old))
        done = []
        for i, page in enumerate(doc, 1):
            if pages and i not in pages:
                continue
            zoom = width / page.rect.width
            pix = page.get_pixmap(matrix=fitz.Matrix(zoom, zoom), alpha=False)
            path = os.path.join(out_dir, f'{i:02d}.png')
            pix.save(path)
            done.append(i)
        print(f'{len(done)} 页 → {out_dir}/' + ('（只重渲染 ' + ','.join(f'{n:02d}' for n in done) + '）' if pages else ''))
        if grid:
            cols, rows = (int(v) for v in grid.lower().split('x'))
            all_pages = [n for n in range(1, len(doc) + 1) if os.path.exists(os.path.join(out_dir, f'{n:02d}.png'))]
            outs = _grid(out_dir, all_pages, cols, rows, width * 2)
            print('整套拼图：' + ', '.join(outs))
    return 0


if __name__ == '__main__':
    ap = argparse.ArgumentParser()
    ap.add_argument('pptx', nargs='?')
    ap.add_argument('--check', action='store_true')
    ap.add_argument('--out', default='_qa/render')
    ap.add_argument('--width', type=int, default=1280)
    ap.add_argument('--pages', default=None, help='只重渲染这些页：5,12')
    ap.add_argument('--grid', default=None, help='整套拼图的格数，如 3x2 → grid-NN.png')
    a = ap.parse_args()
    if a.check:
        sys.exit(check())
    if not a.pptx:
        ap.print_help(); sys.exit(2)
    pages = [int(v) for v in a.pages.split(',') if v.strip()] if a.pages else None
    sys.exit(render(a.pptx, a.out, a.width, pages, a.grid))
