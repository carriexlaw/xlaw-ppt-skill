#!/usr/bin/env python3
"""
mask_color.py — 由图片自身的主色算遮罩颜色（11 配图方式 1 / 2 / 3）。
遮罩不跟随主题色：取图片平均色的色相，压暗（深色遮罩）或提亮（浅色遮罩），饱和度收住。

    python mask_color.py _qa/selected/01.jpg            # 深色遮罩 hex
    python mask_color.py _qa/selected/01.jpg --light    # 浅色遮罩 hex（配图方式 2）
"""
import argparse
import colorsys

from PIL import Image


def mask_color(path, light=False):
    r, g, b = [v / 255 for v in Image.open(path).convert('RGB').resize((64, 64)).resize((1, 1)).getpixel((0, 0))]
    h, _, s = colorsys.rgb_to_hls(r, g, b)
    l2, s2 = (0.94, min(s, 0.25)) if light else (0.11, min(max(s, 0.25), 0.55))
    return '%02X%02X%02X' % tuple(round(v * 255) for v in colorsys.hls_to_rgb(h, l2, s2))


if __name__ == '__main__':
    ap = argparse.ArgumentParser()
    ap.add_argument('image')
    ap.add_argument('--light', action='store_true')
    a = ap.parse_args()
    print(mask_color(a.image, a.light))
