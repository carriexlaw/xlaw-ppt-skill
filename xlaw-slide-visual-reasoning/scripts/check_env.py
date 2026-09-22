"""
check_env.py — 一次检查全部前置条件；任一必需项缺失 → exit 1，并打印缺什么、怎么装

    python scripts/check_env.py [--node-dir <deck 目录>]

检查项（必需）：
  1. Python 3.9+ 与依赖：python-pptx、Pillow、numpy、imagehash、PyYAML、requests、pymupdf、lxml（cairosvg 可选）
  2. Node 与 pptxgenjs（在 --node-dir 下 require，默认当前目录）
  3. LibreOffice（soffice）与 CJK 字体渲染（同 render_deck.py --check）
  4. 至少一个图库 API key 且测试请求成功（同 fetch_images.py --check）
  5. 机器上的字体：至少一套中文黑体（Source Han Sans / Noto Sans CJK / PingFang / Microsoft YaHei）与一套英文字体（Avenir Next / Segoe UI）
"""
import argparse
import glob
import os
import shutil
import subprocess
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)

PY_MODS = [('pptx', 'python-pptx'), ('PIL', 'Pillow'), ('numpy', 'numpy'), ('imagehash', 'imagehash'),
           ('yaml', 'PyYAML'), ('requests', 'requests'), ('fitz', 'pymupdf'), ('lxml', 'lxml')]
FONT_DIRS = ['~/Library/Fonts', '/Library/Fonts', '/System/Library/Fonts', '/System/Library/Fonts/Supplemental',
             '/System/Library/AssetsV2/com_apple_MobileAsset_Font*/*/AssetData', '/usr/share/fonts', '/usr/local/share/fonts',
             '~/.fonts', '~/.local/share/fonts', r'C:\Windows\Fonts']
CJK = [('Source Han Sans', 'SourceHanSans*'), ('Noto Sans CJK', 'NotoSansCJK*'), ('Noto Sans SC', 'NotoSansSC*'),
       ('PingFang', 'PingFang.ttc'), ('Microsoft YaHei', 'msyh*')]
LATIN = [('Avenir Next', 'Avenir Next.ttc'), ('Segoe UI', 'segoeui*')]


def _find_font(pattern):
    for d in FONT_DIRS:
        for base in glob.glob(os.path.expanduser(d)):
            if glob.glob(os.path.join(base, pattern)) or glob.glob(os.path.join(base, '**', pattern), recursive=True):
                return True
    return False


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument('--node-dir', default='.', help='deck 目录（含 node_modules/pptxgenjs）')
    a = ap.parse_args()
    fails = []

    # 1 Python
    if sys.version_info < (3, 9):
        fails.append(f'Python {sys.version.split()[0]} < 3.9')
    missing = []
    for mod, pkg in PY_MODS:
        try:
            __import__(mod)
        except ImportError:
            missing.append(pkg)
    if missing:
        fails.append('缺少 Python 包：python3 -m pip install --user ' + ' '.join(missing))
    else:
        print('[ok] Python 依赖齐全')
    try:
        __import__('cairosvg')
        print('[ok] cairosvg 可用（icon 栅格化）')
    except Exception:
        print('[--] cairosvg 不可用，icon.py 将回退到 PyMuPDF（不影响运行）')

    # 2 Node + pptxgenjs
    node = shutil.which('node')
    if not node:
        fails.append('未找到 node：安装 Node.js 18+（macOS：brew install node；其它平台 https://nodejs.org）')
    else:
        r = subprocess.run([node, '-e', "require('pptxgenjs'); console.log(require('pptxgenjs/package.json').version)"],
                           cwd=a.node_dir, capture_output=True, text=True)
        if r.returncode != 0:
            fails.append(f'在 {os.path.abspath(a.node_dir)} 下找不到 pptxgenjs：cd <deck 目录> && npm i pptxgenjs @phosphor-icons/core')
        else:
            print(f'[ok] node {subprocess.run([node, "--version"], capture_output=True, text=True).stdout.strip()}，pptxgenjs {r.stdout.strip()}')

    # 3 LibreOffice + CJK render
    try:
        import render_deck
        if render_deck.check() != 0:
            fails.append('LibreOffice 或 CJK 渲染不可用（见上方提示）')
        else:
            print('[ok] LibreOffice 渲染')
    except Exception as e:
        fails.append(f'render_deck.py --check 失败：{type(e).__name__}: {e}')

    # 4 image API key
    try:
        import fetch_images
        if fetch_images.check() != 0:
            fails.append('没有可用的图库 API key（见上方授权说明）')
        else:
            print('[ok] 图库 API')
    except Exception as e:
        fails.append(f'fetch_images.py --check 失败：{type(e).__name__}: {e}')

    # 5 fonts
    cjk = [n for n, pat in CJK if _find_font(pat)]
    latin = [n for n, pat in LATIN if _find_font(pat)]
    if not cjk:
        fails.append('没有中文黑体：macOS 建议 brew install --cask font-source-han-sans 或 font-noto-sans-cjk-sc；Windows 自带 Microsoft YaHei')
    else:
        print(f'[ok] 中文字体：{", ".join(cjk)}' + ('' if 'Source Han Sans' in cjk else '（无 Source Han Sans，deck.fonts 按 11 的次序写可用的那一种）'))
    if not latin:
        fails.append('没有英文字体 Avenir Next / Segoe UI：deck.fonts_latin 只能写机器上确实存在的英文字体')
    else:
        print(f'[ok] 英文字体：{", ".join(latin)}')

    if fails:
        print('\n前置检查未通过：')
        for f in fails:
            print('  - ' + f)
        return 1
    print('\n前置检查全部通过')
    return 0


if __name__ == '__main__':
    sys.exit(main())
