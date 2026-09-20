"""
contact_sheet.py — 把全部选中图拼成一张 contact sheet（10 选图流程第 6 步；C-31）

    python contact_sheet.py deck.manifest.yaml [--qa _qa] [--out _qa/contact_sheet.png]

读 manifest 里每个有 image 的页，从 _qa/selected/NN.jpg（多图页 NN-1.jpg、NN-2.jpg …）取原图，
按页码顺序排成网格，每格 CELL_W×CELL_H，下方标注「页码 · 角色 · 来源 · 摄影师」。
validate_design.py 的 C-31 用同一组 CELL 常量核对格数。
"""
import argparse
import math
import os
import sys

CELL_W, CELL_H = 320, 220      # 格宽 / 格高（含 40px 标注条）
THUMB_H = 180
COLS = 4


def selected_files(qa, page_no, n_images):
    d = os.path.join(qa, 'selected')
    if n_images <= 1:
        cands = [os.path.join(d, f'{page_no:02d}{ext}') for ext in ('.jpg', '.jpeg', '.png')]
    else:
        cands = [os.path.join(d, f'{page_no:02d}-{k}{ext}') for k in range(1, n_images + 1) for ext in ('.jpg', '.jpeg', '.png')]
    return [c for c in cands if os.path.exists(c)]


def build(manifest_path, qa, out):
    import yaml
    from PIL import Image, ImageDraw
    with open(manifest_path, encoding='utf-8') as f:
        m = yaml.safe_load(f)
    items = []
    missing = []
    for pg in m.get('pages', []):
        im = pg.get('image')
        if not im:
            continue
        imgs = im if isinstance(im, list) else [im]
        files = selected_files(qa, int(pg['page']), len(imgs))
        if len(files) < len(imgs):
            missing.append(int(pg['page']))
        for k, meta in enumerate(imgs):
            path = files[k] if k < len(files) else None
            items.append((int(pg['page']), meta, path))
    if not items:
        print('manifest 中没有带 image 的页')
        return 1
    n = len(items)
    cols = min(COLS, n)
    rows = math.ceil(n / cols)
    sheet = Image.new('RGB', (cols * CELL_W, rows * CELL_H), 'white')
    draw = ImageDraw.Draw(sheet)
    for i, (page_no, meta, path) in enumerate(items):
        x0, y0 = (i % cols) * CELL_W, (i // cols) * CELL_H
        if path:
            im = Image.open(path).convert('RGB')
            im.thumbnail((CELL_W - 8, THUMB_H - 8))
            sheet.paste(im, (x0 + (CELL_W - im.width) // 2, y0 + (THUMB_H - im.height) // 2))
        else:
            draw.rectangle([x0 + 4, y0 + 4, x0 + CELL_W - 4, y0 + THUMB_H - 4], outline='red', width=3)
            draw.text((x0 + 12, y0 + 12), 'MISSING', fill='red')
        label = f'p{page_no:02d} · {meta.get("role")} · {meta.get("source")} · {meta.get("photographer")}'
        draw.text((x0 + 6, y0 + THUMB_H + 6), label[:60], fill='black')
        draw.text((x0 + 6, y0 + THUMB_H + 22), str(meta.get('id'))[:60], fill='gray')
    os.makedirs(os.path.dirname(out) or '.', exist_ok=True)
    sheet.save(out)
    print(f'{n} 张 → {out} ({sheet.width}x{sheet.height})')
    if missing:
        print(f'缺少选中图文件的页：{missing}（_qa/selected/NN.jpg）')
        return 1
    return 0


if __name__ == '__main__':
    ap = argparse.ArgumentParser()
    ap.add_argument('manifest')
    ap.add_argument('--qa', default='_qa')
    ap.add_argument('--out', default=None)
    a = ap.parse_args()
    sys.exit(build(a.manifest, a.qa, a.out or os.path.join(a.qa, 'contact_sheet.png')))
