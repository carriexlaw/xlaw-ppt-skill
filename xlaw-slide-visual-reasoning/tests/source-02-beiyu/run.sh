#!/bin/sh
# build → postfix → validate（M = 0 之后才渲染）→ contact sheet → render + grid
set -e
node build.js > _qa/build.log 2>&1 || { grep -E "失败|Error" _qa/build.log; }
python3 ../../scripts/postfix.py deck.pptx deck.manifest.yaml | tail -1
python3 ../../scripts/validate_design.py deck.pptx deck.manifest.yaml > _qa/validate.out 2>&1 || true
grep -E "^\s*\[(M|W)\]|^---|^M 失败" _qa/validate.out | cut -c1-400
python3 ../../scripts/contact_sheet.py deck.manifest.yaml --qa _qa | tail -1
python3 ../../scripts/render_deck.py deck.pptx --grid 3x2 | tail -2
