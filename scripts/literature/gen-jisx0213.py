#!/usr/bin/env python3
"""青空文庫 외자 표기(「第3水準1-87-71」·「第4水準2-13-28」) → Unicode 표 생성기.

JIS X 0208에 없는 JIS X 0213 칸(제3·제4수준)만 싣는다 — 파서(src/lib/aozoraParser.js)가 면-구-점으로 찾는다.
표의 원천은 Python 표준 코덱 euc_jis_2004(JIS X 0213:2004 ↔ Unicode 공식 대응)다. 결정적이라 다시 돌려도 같은 파일이 나온다.

  python3 scripts/literature/gen-jisx0213.py > src/lib/aozoraJisx0213.json
"""
import json
import sys


def cell(plane, ku, ten):
    if plane == 1:
        raw = bytes([0xA0 + ku, 0xA0 + ten])
    else:
        raw = bytes([0x8F, 0xA0 + ku, 0xA0 + ten])
    try:
        return raw.decode('euc_jis_2004')
    except UnicodeDecodeError:
        return None


def in_jisx0208(plane, ku, ten):
    if plane != 1:
        return False
    try:
        bytes([0xA0 + ku, 0xA0 + ten]).decode('euc_jp')
        return True
    except UnicodeDecodeError:
        return False


# 제2면은 JIS X 0213이 쓰는 구만 있다(1·3–5·8·12–15·78–94) — 나머지 구를 euc_jis_2004가 JIS X 0212로 풀어 주므로 걸러야 한다.
PLANE2_ROWS = {1, 3, 4, 5, 8, 12, 13, 14, 15, *range(78, 95)}

table = {}
for plane in (1, 2):
    for ku in range(1, 95):
        if plane == 2 and ku not in PLANE2_ROWS:
            continue
        for ten in range(1, 95):
            if in_jisx0208(plane, ku, ten):
                continue
            char = cell(plane, ku, ten)
            if char and '�' not in char:
                table[f'{plane}-{ku}-{ten}'] = char

json.dump(table, sys.stdout, ensure_ascii=False, indent=0, sort_keys=False)
sys.stdout.write('\n')
