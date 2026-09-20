#!/usr/bin/env python3
"""
负向测试覆盖率：跑 validate_design.py，核对每条 M 检查至少命中一次，且信息里带声明值与反算值。

    python check_coverage.py          # 在 tests/negative 目录下运行（先 node build.js）
"""
import json
import os
import subprocess
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
SCRIPTS = os.path.join(HERE, '..', '..', 'scripts')
VALIDATE = os.path.join(SCRIPTS, 'validate_design.py')

# 全部 M 检查（schema 单独用 bad-schema manifest 验证）
M_CHECKS = ['C-01', 'C-02', 'C-03', 'C-04', 'C-09', 'C-10', 'C-11', 'C-13', 'C-14', 'C-15', 'C-16',
            'S-01', 'S-02', 'S-03', 'S-04', 'S-05', 'S-06', 'C-35', 'C-36', 'C-37',
            'C-20', 'C-22', 'C-23', 'C-24', 'C-26', 'C-30', 'C-31', 'C-32', 'C-34', 'C-40']
W_CHECKS = ['C-03', 'C-21', 'C-27', 'C-28', 'C-29', 'C-33']
# 交叉核对类：信息里必须同时有声明值与反算值
NEED_DECLARED_ACTUAL = {'C-40'}


def run(manifest, json_out):
    env = dict(os.environ, PYTHONWARNINGS='ignore')
    r = subprocess.run([sys.executable, VALIDATE, 'deck.pptx', manifest, '--json', json_out], cwd=HERE,
                       capture_output=True, text=True, env=env)
    with open(os.path.join(HERE, json_out), encoding='utf-8') as f:
        return r.returncode, json.load(f)


def main():
    ok = True
    # 1 schema
    code, rep = run('deck.manifest.bad-schema.yaml', '_qa/validate.bad-schema.json')
    schema_hits = [f for f in rep['findings'] if f['check'] == 'schema']
    print(f'schema  : exit={code} stopped_at={rep["stopped_at"]} findings={len(schema_hits)}')
    for f in schema_hits:
        print(f'          p{f["page"]} {f["message"]}')
    if code != 1 or rep['stopped_at'] != 'schema' or not schema_hits:
        ok = False
        print('  ✗ schema 阶段未按预期停止')

    # 2 全部 M
    code, rep = run('deck.manifest.yaml', '_qa/validate.json')
    print(f'\nnegative: exit={code} M={rep["summary"]["M"]} W={rep["summary"]["W"]}')
    by = {}
    for f in rep['findings']:
        by.setdefault(f['check'], []).append(f)
    print(f'\n{"check":6} {"level":5} {"hits":4}  示例信息')
    for c in M_CHECKS:
        hits = [f for f in by.get(c, []) if f['level'] == 'M']
        flag = '✓' if hits else '✗'
        if not hits:
            ok = False
        ex = hits[0] if hits else None
        msg = f'p{ex["page"]} {ex["message"]} {json.dumps(ex["values"], ensure_ascii=False)[:110]}' if ex else '（未命中）'
        print(f'{c:6} {"M":5} {len(hits):4} {flag} {msg}')
        if c in NEED_DECLARED_ACTUAL and hits:
            bad = [f for f in hits if not ({'declared', 'actual'} <= set(f['values']))]
            if bad:
                ok = False
                print(f'         ✗ {len(bad)} 条信息缺少 declared / actual')
    for c in W_CHECKS:
        hits = [f for f in by.get(c, []) if f['level'] == 'W']
        print(f'{c:6} {"W":5} {len(hits):4} {"·" if hits else " "} {"p%s %s" % (hits[0]["page"], hits[0]["message"]) if hits else "（未命中，W 不要求）"}')
    # 校验器自身异常不能算命中
    crashes = [f for f in rep['findings'] if '校验器异常' in f['message']]
    if crashes:
        ok = False
        print('\n✗ 校验器异常：')
        for f in crashes:
            print('  ', f['check'], f['message'], f['values'].get('trace'))
    if code != 1:
        ok = False
    print('\n' + ('全部 M 检查均已命中' if ok else '覆盖不完整'))
    return 0 if ok else 1


if __name__ == '__main__':
    sys.exit(main())
