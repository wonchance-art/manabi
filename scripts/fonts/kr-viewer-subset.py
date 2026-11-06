#!/usr/bin/env python3
"""뷰어 한글 하위 집합 재생성(KR-VIEWER-SUBSET-001, 2026-11-07 KST).

문구가 바뀌어 CI 계약(src/components/fonts/__tests__/krViewerSubset.test.js)이 「추출한 한글 ⊄ 목록」으로 실패할 때만 손으로 돌린다.
빌드 · CI는 이 스크립트를 돌리지 않고, 원본 글꼴도 받지 않는다(커밋된 woff2 · JSON · CSS만 쓴다).

  python3 -m pip install fonttools brotli          # 한 번
  python3 scripts/fonts/kr-viewer-subset.py         # 원본을 캐시(저장소 밖)로 받아 sha256 확인 → 하위 집합 · 목록 · CSS를 다시 쓴다

원본은 운영 next/font 조각과 같은 판(Noto Sans KR 2.004 — vendor/google-fonts/files/notosanskr/v40과 윤곽선 · 너비가 같음을 확인)이고,
표 구성도 Google 조각과 같게 만든다(힌팅 없음 · prep/GDEF 없음 · 가변 wght 축 유지) — 그래서 같은 글자의 그림이 같다.
원본 TTF(약 10MB)는 저장소에 두지 않는다(오너 · 오케스트레이터 판정). 상류가 바뀌어 sha256이 다르면 멈춘다 — 판을 다시 확인하고
SOURCE_SHA256 · 대조를 함께 갱신한다.
"""
import hashlib
import json
import os
import subprocess
import sys
import tempfile
import urllib.request

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))
SOURCE_URL = 'https://raw.githubusercontent.com/google/fonts/main/ofl/notosanskr/NotoSansKR%5Bwght%5D.ttf'
SOURCE_SHA256 = '194018e6b2b293a7964f037b25c0249ce1418bc9ab3c971060a03aa57861e252'
SOURCE_VERSION = 'Version 2.004-H2;hotconv 1.0.118;makeotfexe 2.5.65603'
OUT_DIR = os.path.join(ROOT, 'src', 'components', 'fonts', 'kr-viewer')
WOFF2 = 'noto-sans-kr-viewer.woff2'
# src/app/layout.jsx Noto_Sans_KR({ weight: ['400', '500', '700'] })와 같은 셋 — 계약이 대조한다.
NEXT_FONT_WEIGHTS = ('400', '500', '700')
CACHE = os.path.join(os.environ.get('MANABI_FONT_CACHE') or tempfile.gettempdir(), 'manabi-font-src')


def sha256(path):
    h = hashlib.sha256()
    with open(path, 'rb') as f:
        for chunk in iter(lambda: f.read(1 << 20), b''):
            h.update(chunk)
    return h.hexdigest()


def source_font():
    os.makedirs(CACHE, exist_ok=True)
    path = os.path.join(CACHE, f'NotoSansKR-wght.{SOURCE_SHA256[:16]}.ttf')
    if not os.path.exists(path) or sha256(path) != SOURCE_SHA256:
        print(f'원본 받기: {SOURCE_URL}')
        urllib.request.urlretrieve(SOURCE_URL, path + '.part')
        os.replace(path + '.part', path)
    got = sha256(path)
    if got != SOURCE_SHA256:
        sys.exit(f'원본 sha256이 다르다 — 상류 판이 바뀌었다(받음 {got}). 판을 확인하고 SOURCE_SHA256을 갱신한다.')
    return path


def ranges(codepoints):
    """정렬된 코드포인트 → CSS unicode-range(이어진 것은 구간으로)."""
    out, start, prev = [], None, None
    for cp in codepoints:
        if start is None:
            start = prev = cp
        elif cp == prev + 1:
            prev = cp
        else:
            out.append((start, prev)); start = prev = cp
    if start is not None:
        out.append((start, prev))
    return ', '.join(f'U+{a:04X}' if a == b else f'U+{a:04X}-{b:04X}' for a, b in out)


def main():
    from fontTools import subset
    from fontTools.ttLib import TTFont

    chars = subprocess.run(['node', os.path.join(ROOT, 'scripts', 'fonts', 'kr-viewer-chars.mjs')], check=True, capture_output=True, text=True).stdout
    src = source_font()
    font = TTFont(src)
    if font['name'].getDebugName(5) != SOURCE_VERSION:
        sys.exit(f'원본 판이 다르다: {font["name"].getDebugName(5)}')
    os.makedirs(OUT_DIR, exist_ok=True)
    out = os.path.join(OUT_DIR, WOFF2)
    options = subset.Options()
    options.flavor = 'woff2'
    options.layout_features = ['*']
    options.hinting = False
    options.drop_tables += ['GDEF', 'prep']
    options.name_IDs = ['*']
    sub = subset.Subsetter(options=options)
    sub.populate(text=chars)
    sub.subset(font)
    subset.save_font(font, out, options)

    check = TTFont(out)
    cmap = check.getBestCmap()
    missing = [c for c in chars if ord(c) not in cmap]
    if missing:
        sys.exit(f'원본에 없는 글자: {"".join(missing)}')
    if 'fvar' not in check:
        sys.exit('가변 wght 축이 빠졌다')

    codepoints = sorted(ord(c) for c in chars)
    meta = {
        'note': 'KR-VIEWER-SUBSET-001 — scripts/fonts/kr-viewer-subset.py가 만든다. 손으로 고치지 않는다.',
        'chars': chars,
        'count': len(chars),
        'source': {'url': SOURCE_URL, 'sha256': SOURCE_SHA256, 'version': SOURCE_VERSION},
        'woff2': {'file': WOFF2, 'sha256': sha256(out), 'bytes': os.path.getsize(out)},
        'unicodeRange': ranges(codepoints),
    }
    with open(os.path.join(OUT_DIR, 'subset.json'), 'w', encoding='utf8') as f:
        json.dump(meta, f, ensure_ascii=False, indent=1)
        f.write('\n')
    # 굵기는 next/font 선언과 같은 셋(400 · 500 · 700)을 따로 — 범위(100 900)로 선언하면 600 같은 중간 굵기를 진짜 600으로 그려
    # next/font(가장 가까운 선언 굵기로 맞춤)와 글자 폭이 달라진다(화면 벽 실측 — 「이 글에서 아는 말 …」 줄이 몇 px 밀림).
    faces = ''.join(
        "@font-face{font-family:'Noto Sans KR';font-style:normal;"
        f"font-weight:{w};font-display:swap;src:url(./{WOFF2}) format('woff2');unicode-range:{meta['unicodeRange']}}}\n"
        for w in NEXT_FONT_WEIGHTS
    )
    css = (
        '/* 뷰어 한글 하위 집합(KR-VIEWER-SUBSET-001) — scripts/fonts/kr-viewer-subset.py가 만든다. 손으로 고치지 않는다.\n'
        '   next/font의 Noto Sans KR과 같은 family · 같은 판 · 같은 윤곽선 · 같은 굵기 선언(400 · 500 · 700)이다. 같은 family의 @font-face가\n'
        '   겹치면 뒤에 선언한 것이 먼저라(CSS Fonts 4) 뷰어 UI 한글은 이 한 파일로 그리고, 목록 밖 글자는 next/font 조각으로 넘어간다. */\n'
        + faces
    )
    with open(os.path.join(OUT_DIR, 'krViewerSubset.css'), 'w', encoding='utf8') as f:
        f.write(css)
    print(f'{len(chars)}자 · {meta["woff2"]["bytes"]} bytes → {os.path.relpath(out, ROOT)}')


if __name__ == '__main__':
    main()
