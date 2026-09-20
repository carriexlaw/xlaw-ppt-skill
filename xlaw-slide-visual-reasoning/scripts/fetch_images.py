"""
fetch_images.py — 三家图库官方 API → 候选缩略图 + _qa/candidates/NN.json（10 选图流程；C-30）

    python fetch_images.py --check
        Step 0：检查 PEXELS_API_KEY / UNSPLASH_ACCESS_KEY / PIXABAY_API_KEY，逐家发一次测试请求。
        无一可用 → exit 1，打印授权说明（key 免费、怎么拿）。key 本身绝不打印。

    python fetch_images.py search --page 5 --query "aerial coastal port cool tones" [--query "..."] [--source pexels] [--per 10] [--qa _qa]
        每组检索词取前 --per 张（默认 10），只下载缩略图到 _qa/candidates/05/，合并写入 _qa/candidates/05.json（viewed=false）。
        之后用 Read 逐张看缩略图，再用 mark 记录打分。

    python fetch_images.py mark --page 5 --id 1234567 --score 4 --note "负空间右侧，冷色" [--qa _qa]
        置 viewed=true 并记录 score / note。看过但不选的也要 mark（candidates_viewed 只数 viewed=true）。

    python fetch_images.py select --page 5 --id 1234567 [--index 1] [--qa _qa]
        下载原图到 _qa/selected/05.jpg（多图页 --index k → 05-k.jpg），打印 manifest.image 与页备注要写的字段。

key 只从环境变量（或当前目录 .env）读取；不写入任何输出。
"""
import argparse
import json
import os
import sys
import warnings

warnings.filterwarnings('ignore', message='urllib3 v2 only supports OpenSSL')

QA_DEFAULT = '_qa'
TIMEOUT = 20
THUMB_MAX = 640      # 缩略图长边上限（14 C-30 images.thumb_max_px）


def _shrink(path, max_px):
    """图库的「中图」长边可能超过 640（全景图），本地压到上限以内，证明只下了缩略图"""
    from PIL import Image
    im = Image.open(path)
    if max(im.size) > max_px:
        im.thumbnail((max_px, max_px))
        im.convert('RGB').save(path, quality=85)

AUTH_HINT = """本 skill 依赖图库图片，需要至少一个图库 API key（免费）。当前没有可用的 key 或网络不通。
请任选一家注册、拿到 key 后告诉我，我会在你同意后写入 shell 配置或项目 .env：
  1. Pexels   （优先）https://www.pexels.com/api/         注册即发 key      → PEXELS_API_KEY
  2. Pixabay           https://pixabay.com/api/docs/       注册即发 key      → PIXABAY_API_KEY
  3. Unsplash          https://unsplash.com/developers     需创建应用，demo 额度低，必须署名 → UNSPLASH_ACCESS_KEY
沙箱 / 无网环境无法运行本 skill，请在能访问图库 API 的环境（如本机 Claude Code）运行。"""


def _load_dotenv():
    """从当前目录与脚本目录向上逐级找 .env（项目根目录的 .env 也能被 deck 子目录读到）"""
    seen = set()
    for start in (os.getcwd(), os.path.dirname(os.path.abspath(__file__))):
        d = start
        while True:
            p = os.path.join(d, '.env')
            if p not in seen and os.path.exists(p):
                seen.add(p)
                with open(p, encoding='utf-8') as f:
                    for line in f:
                        line = line.strip()
                        if '=' in line and not line.startswith('#'):
                            k, v = line.split('=', 1)
                            os.environ.setdefault(k.strip(), v.strip().strip('"').strip("'"))
            parent = os.path.dirname(d)
            if parent == d:
                break
            d = parent


def keys():
    _load_dotenv()
    return {
        'pexels': os.environ.get('PEXELS_API_KEY'),
        'unsplash': os.environ.get('UNSPLASH_ACCESS_KEY'),
        'pixabay': os.environ.get('PIXABAY_API_KEY'),
    }


def _get(url, params=None, headers=None):
    import requests
    r = requests.get(url, params=params, headers=headers, timeout=TIMEOUT)
    r.raise_for_status()
    return r


def _search(source, key, query, per, image_type='photo'):
    """返回统一结构的候选列表"""
    out = []
    if source == 'pexels':
        r = _get('https://api.pexels.com/v1/search', {'query': query, 'per_page': per, 'orientation': 'landscape'},
                 {'Authorization': key}).json()
        for p in r.get('photos', []):
            out.append({'source': 'pexels', 'id': str(p['id']), 'url': p['url'], 'photographer': p.get('photographer', ''),
                        'width': p.get('width'), 'height': p.get('height'), 'thumb_url': p['src']['medium'],
                        'orig_url': p['src']['original'], 'avg_color': p.get('avg_color')})
    elif source == 'unsplash':
        r = _get('https://api.unsplash.com/search/photos', {'query': query, 'per_page': per, 'orientation': 'landscape'},
                 {'Authorization': f'Client-ID {key}', 'Accept-Version': 'v1'}).json()
        for p in r.get('results', []):
            out.append({'source': 'unsplash', 'id': p['id'], 'url': p['links']['html'], 'photographer': p['user']['name'],
                        'width': p.get('width'), 'height': p.get('height'), 'thumb_url': p['urls']['small'],
                        'orig_url': p['urls']['full'], 'download_location': p['links'].get('download_location'),
                        'photographer_url': p['user']['links']['html']})
    elif source == 'pixabay':
        r = _get('https://pixabay.com/api/', {'key': key, 'q': query, 'per_page': max(3, per), 'orientation': 'horizontal',
                                              'image_type': image_type, 'safesearch': 'true'}).json()
        for p in r.get('hits', []):
            out.append({'source': 'pixabay', 'id': str(p['id']), 'url': p['pageURL'], 'photographer': p.get('user', ''),
                        'width': p.get('imageWidth'), 'height': p.get('imageHeight'), 'thumb_url': p['webformatURL'],
                        'orig_url': p.get('fullHDURL') or p.get('largeImageURL')})
    return out


def check():
    ks = keys()
    ok = []
    for src, k in ks.items():
        if not k:
            print(f'  {src:9s} key 未设置')
            continue
        try:
            res = _search(src, k, 'aerial coastline', 1)
            print(f'  {src:9s} key 已设置，测试请求成功（{len(res)} 条）')
            ok.append(src)
        except Exception as e:
            print(f'  {src:9s} key 已设置，测试请求失败：{type(e).__name__}')
    if not ok:
        print(AUTH_HINT)
        return 1
    print(f'可用图库：{", ".join(ok)}')
    return 0


def _rec_path(qa, page):
    return os.path.join(qa, 'candidates', f'{page:02d}.json')


def _load_rec(qa, page):
    p = _rec_path(qa, page)
    if os.path.exists(p):
        with open(p, encoding='utf-8') as f:
            return json.load(f)
    return {'page': page, 'queries': [], 'candidates': []}


def _save_rec(qa, page, rec):
    os.makedirs(os.path.dirname(_rec_path(qa, page)), exist_ok=True)
    with open(_rec_path(qa, page), 'w', encoding='utf-8') as f:
        json.dump(rec, f, ensure_ascii=False, indent=1)


def search(page, queries, source, per, qa, image_type='photo'):
    ks = keys()
    if image_type != 'photo':
        source = 'pixabay'                      # vector / illustration 只有 Pixabay 支持（11 Icon：双色扁平语义 icon）
    sources = [source] if source else [s for s, k in ks.items() if k]
    sources = [s for s in sources if ks.get(s)]
    if not sources:
        print(AUTH_HINT)
        return 1
    rec = _load_rec(qa, page)
    have = {c['id'] for c in rec['candidates']}
    thumb_dir = os.path.join(qa, 'candidates', f'{page:02d}')
    os.makedirs(thumb_dir, exist_ok=True)
    added = 0
    for q in queries:
        if q not in rec['queries']:
            rec['queries'].append(q)
        for src in sources:
            try:
                res = _search(src, ks[src], q, per, image_type)
            except Exception as e:
                print(f'{src} 请求失败：{type(e).__name__}: {e}')
                continue
            for c in res:
                if c['id'] in have:
                    continue
                thumb = os.path.join(thumb_dir, f'{c["id"]}.jpg')
                try:
                    data = _get(c['thumb_url']).content
                    with open(thumb, 'wb') as f:
                        f.write(data)
                    _shrink(thumb, THUMB_MAX)
                except Exception as e:
                    print(f'  缩略图下载失败 {c["id"]}：{type(e).__name__}')
                    continue
                c['thumb'] = os.path.relpath(thumb, os.path.dirname(qa.rstrip('/')) or '.')
                c['query'] = q
                c['viewed'] = False
                c['score'] = None
                c['note'] = ''
                rec['candidates'].append(c)
                have.add(c['id'])
                added += 1
    _save_rec(qa, page, rec)
    print(f'page {page:02d}: 新增 {added} 张候选，共 {len(rec["candidates"])} 张 → {_rec_path(qa, page)}')
    for c in rec['candidates']:
        flag = '✓' if c.get('viewed') else ' '
        print(f'  [{flag}] {c["source"]:8s} {c["id"]:14s} {c.get("width")}x{c.get("height")}  {c["thumb"]}  q="{c.get("query", "")}"')
    print('下一步：用 Read 逐张查看缩略图，每看一张就 mark 一张。')
    return 0


def mark(page, cid, score, note, qa):
    rec = _load_rec(qa, page)
    for c in rec['candidates']:
        if c['id'] == str(cid):
            c['viewed'] = True
            if score is not None:
                c['score'] = score
            if note:
                c['note'] = note
            _save_rec(qa, page, rec)
            n = sum(1 for x in rec['candidates'] if x.get('viewed'))
            print(f'page {page:02d}: {cid} viewed=true score={c["score"]} note={c["note"]!r}；已看 {n} 张')
            return 0
    print(f'候选里没有 id={cid}')
    return 1


def select(page, cid, index, qa):
    rec = _load_rec(qa, page)
    c = next((x for x in rec['candidates'] if x['id'] == str(cid)), None)
    if c is None:
        print(f'候选里没有 id={cid}，不能选定候选之外的图')
        return 1
    if not c.get('viewed'):
        print('该候选尚未 mark 为 viewed，先看再选')
        return 1
    ks = keys()
    out_dir = os.path.join(qa, 'selected')
    os.makedirs(out_dir, exist_ok=True)
    name = f'{page:02d}.jpg' if not index else f'{page:02d}-{index}.jpg'
    out = os.path.join(out_dir, name)
    headers = {}
    if c['source'] == 'unsplash' and c.get('download_location'):
        try:  # Unsplash API 规范：下载时触发 download endpoint
            _get(c['download_location'], headers={'Authorization': f'Client-ID {ks["unsplash"]}'})
        except Exception:
            pass
    data = _get(c['orig_url'], headers=headers).content
    with open(out, 'wb') as f:
        f.write(data)
    from PIL import Image
    w, h = Image.open(out).size
    n_viewed = sum(1 for x in rec['candidates'] if x.get('viewed'))
    print(f'原图 → {out} ({w}x{h})')
    print('manifest.image 字段：')
    print(f'  source: {c["source"]}\n  id: "{c["id"]}"\n  photographer: {c["photographer"]}\n  url: {c["url"]}\n  query: {c.get("query", "")}\n  candidates_viewed: {n_viewed}')
    credit = f'Photo: {c["photographer"]} / {c["source"].capitalize()} — {c["url"]}'
    if c['source'] == 'unsplash':
        credit = f'Photo by {c["photographer"]} on Unsplash — {c["url"]}'
    print(f'页备注（notes）须包含：{credit}')
    return 0


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument('--check', action='store_true')
    sub = ap.add_subparsers(dest='cmd')
    s = sub.add_parser('search'); s.add_argument('--page', type=int, required=True); s.add_argument('--query', action='append', required=True)
    s.add_argument('--source', choices=['pexels', 'unsplash', 'pixabay']); s.add_argument('--per', type=int, default=10); s.add_argument('--qa', default=QA_DEFAULT)
    s.add_argument('--type', dest='image_type', choices=['photo', 'vector', 'illustration'], default='photo', help='vector：Pixabay 的矢量 / 扁平 icon 检索，同样走 mark / select 筛选')
    m = sub.add_parser('mark'); m.add_argument('--page', type=int, required=True); m.add_argument('--id', required=True)
    m.add_argument('--score', type=int); m.add_argument('--note', default=''); m.add_argument('--qa', default=QA_DEFAULT)
    e = sub.add_parser('select'); e.add_argument('--page', type=int, required=True); e.add_argument('--id', required=True)
    e.add_argument('--index', type=int, default=0); e.add_argument('--qa', default=QA_DEFAULT)
    a = ap.parse_args()
    if a.check:
        return check()
    if a.cmd == 'search':
        return search(a.page, a.query, a.source, a.per, a.qa, a.image_type)
    if a.cmd == 'mark':
        return mark(a.page, a.id, a.score, a.note, a.qa)
    if a.cmd == 'select':
        return select(a.page, a.id, a.index, a.qa)
    ap.print_help()
    return 2


if __name__ == '__main__':
    sys.exit(main())
