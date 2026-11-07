#!/usr/bin/env python3
"""첫 화면 한글 하위 집합 재생성(KR-VIEWER-SUBSET-001 · VOCAB-SUBSET-SMALL-001, 2026-11-07 KST) — 뷰어 · 복습실 둘 다.

문구가 바뀌어 CI 계약(src/components/fonts/__tests__/krViewerSubset.test.js)이 「추출한 한글 ⊄ 목록」으로 실패할 때만 손으로 돌린다.
빌드 · CI는 이 스크립트를 돌리지 않고, 원본 글꼴도 받지 않는다(커밋된 woff2 · JSON · CSS만 쓴다).

  python3 -m pip install fonttools brotli          # 한 번
  python3 scripts/fonts/kr-viewer-subset.py         # 원본을 캐시(저장소 밖)로 받아 sha256 확인 → 하위 집합마다 woff2 · 목록 · CSS를 다시 쓴다

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
# 글꼴 파일은 public 아래 내용 해시 이름으로 — 싣는 세그먼트 레이아웃(뷰어 · 복습실)이 그 주소를 미리 받는다(preload). 첫 그림 뒤에 도착하면 상단 막대의 한글이
# 대체 글꼴 → 하위 집합으로 바뀌며 도구 묶음이 4px 밀렸다(운영 실측 CLS 0.0002, #1721 뒤). 이름이 내용이라 1년 immutable(next.config).
PUBLIC_DIR = os.path.join(ROOT, 'public', 'fonts', 'kr-viewer')
PUBLIC_HREF = '/fonts/kr-viewer'
STUDIES_STEM = 'noto-sans-kr-studies'  # scripts/fonts/kr-studies-chars.mjs와 같은 값(계약이 대조)
STUDIES_MANIFEST = 'studies-subsets.json'
STUDIES_WEIGHTS = {'body': 400, 'head': 700}  # kr-studies-chars.mjs STUDIES_WEIGHTS와 같다(계약이 대조)
STUDIES_REST_WEIGHTS = {'rest400': 400, 'rest700': 700}  # 나머지 파일 — 미리 받지 않는다(STUDIES-REST-001)
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


def make_woff2(stem, chars, src, wght=None):
    """woff2 하나를 내용 해시 이름으로 쓴다 — (href, sha256, bytes). 같은 stem의 옛 판은 지운다.
    wght가 있으면 가변 원본을 그 굵기의 정적 글꼴로 고정한 뒤 자른다(지역학 — 굵기별 파일이 가변 한 파일보다 약 30% 작다)."""
    from fontTools import subset
    from fontTools.ttLib import TTFont
    from fontTools.varLib import instancer

    font = TTFont(src)
    if font['name'].getDebugName(5) != SOURCE_VERSION:
        sys.exit(f'원본 판이 다르다: {font["name"].getDebugName(5)}')
    if wght is not None:
        font = instancer.instantiateVariableFont(font, {'wght': wght})
    out = os.path.join(PUBLIC_DIR, f'{stem}.tmp.woff2')
    options = subset.Options()
    options.flavor = 'woff2'
    options.layout_features = ['*']
    options.hinting = False
    options.drop_tables += ['GDEF', 'prep']
    options.name_IDs = ['*']
    sub = subset.Subsetter(options=options)
    sub.populate(text=chars)
    sub.subset(font)
    # 결정적 산출 — 저장 시각을 head.modified에 다시 쓰지 않는다(같은 입력이면 같은 바이트 · 같은 해시 이름).
    font.recalcTimestamp = False
    subset.save_font(font, out, options)

    check = TTFont(out)
    cmap = check.getBestCmap()
    missing = [c for c in chars if ord(c) not in cmap]
    if missing:
        sys.exit(f'원본에 없는 글자: {"".join(missing)}')
    if wght is None and 'fvar' not in check:
        sys.exit('가변 wght 축이 빠졌다')
    if wght is not None and 'fvar' in check:
        sys.exit(f'{wght} 정적 글꼴에 가변 축이 남았다')

    digest = sha256(out)
    final = os.path.join(PUBLIC_DIR, f'{stem}.{digest[:16]}.woff2')
    for old in os.listdir(PUBLIC_DIR):
        # 같은 stem의 옛 판만 지운다(다른 하위 집합 파일은 그대로).
        if old.startswith(stem + '.') and old.endswith('.woff2') and os.path.join(PUBLIC_DIR, old) not in (out, final):
            os.remove(os.path.join(PUBLIC_DIR, old))
    os.replace(out, final)
    return f'{PUBLIC_HREF}/{os.path.basename(final)}', digest, os.path.getsize(final)


def build(name, spec, src):
    """화면 하위 집합 하나(뷰어 · 복습실) — woff2 · 목록 JSON · CSS를 쓴다."""
    chars = spec['chars']
    href, digest, size = make_woff2(spec['stem'], chars, src)
    out = os.path.join(ROOT, 'public', href.lstrip('/'))
    codepoints = sorted(ord(c) for c in chars)
    meta = {
        'note': f'KR-VIEWER-SUBSET-001 ({name}) — scripts/fonts/kr-viewer-subset.py가 만든다. 손으로 고치지 않는다.',
        'chars': chars,
        'count': len(chars),
        'source': {'url': SOURCE_URL, 'sha256': SOURCE_SHA256, 'version': SOURCE_VERSION},
        'woff2': {'href': href, 'sha256': digest, 'bytes': size},
        'unicodeRange': ranges(codepoints),
    }
    with open(os.path.join(OUT_DIR, spec['json']), 'w', encoding='utf8') as f:
        json.dump(meta, f, ensure_ascii=False, indent=1)
        f.write('\n')
    # 굵기는 next/font 선언과 같은 셋(400 · 500 · 700)을 따로 — 범위(100 900)로 선언하면 600 같은 중간 굵기를 진짜 600으로 그려
    # next/font(가장 가까운 선언 굵기로 맞춤)와 글자 폭이 달라진다(화면 벽 실측 — 「이 글에서 아는 말 …」 줄이 몇 px 밀림).
    faces = ''.join(
        "@font-face{font-family:'Noto Sans KR';font-style:normal;"
        f"font-weight:{w};font-display:swap;src:url({href}) format('woff2');unicode-range:{meta['unicodeRange']}}}\n"
        for w in NEXT_FONT_WEIGHTS
    )
    css = (
        f'/* 첫 화면 한글 하위 집합 {name}(KR-VIEWER-SUBSET-001) — scripts/fonts/kr-viewer-subset.py가 만든다. 손으로 고치지 않는다.\n'
        '   next/font의 Noto Sans KR과 같은 family · 같은 판 · 같은 윤곽선 · 같은 굵기 선언(400 · 500 · 700)이다. 같은 family의 @font-face가\n'
        '   겹치면 뒤에 선언한 것이 먼저라(CSS Fonts 4) 화면 UI 한글은 이 한 파일로 그리고, 목록 밖 글자는 next/font 조각으로 넘어간다. */\n'
        + faces
    )
    with open(os.path.join(OUT_DIR, spec['css']), 'w', encoding='utf8') as f:
        f.write(css)
    print(f'{name}: {len(chars)}자 · {meta["woff2"]["bytes"]} bytes → {os.path.relpath(out, ROOT)} ({href})')


def build_studies(src):
    from fontTools.ttLib import TTFont
    """지역학 문서별 하위 집합 — 첫 화면(본문 400 · 제목 700, 미리 받기, STUDIES-CLS-001)과 나머지(400 · 700, 미리 받지 않음, STUDIES-REST-001)
    정적 woff2, 목록은 studies-subsets.json 한 파일.
    CSS는 문서 쪽(KrStudiesSubset)이 목록의 unicodeRange로 그 자리에서 만든다(문서 26개의 CSS 파일을 따로 두지 않는다)."""
    docs = json.loads(subprocess.run(['node', os.path.join(ROOT, 'scripts', 'fonts', 'kr-studies-chars.mjs')], check=True, capture_output=True, text=True).stdout)
    manifest = {
        'note': 'STUDIES-CLS-001 — scripts/fonts/kr-viewer-subset.py가 만든다. 손으로 고치지 않는다. 문서 앞부분 문구를 크게 고치면 다시 돌린다.',
        'source': {'url': SOURCE_URL, 'sha256': SOURCE_SHA256, 'version': SOURCE_VERSION},
        'weights': STUDIES_WEIGHTS,
        'restWeights': STUDIES_REST_WEIGHTS,
        'docs': {},
    }
    stems = set()
    for d in docs:
        entry = {}
        for part, wght in list(STUDIES_WEIGHTS.items()) + list(STUDIES_REST_WEIGHTS.items()):
            stem = f"{STUDIES_STEM}-{d['slug']}-{part if part.startswith('rest') else wght}"
            chars = d[part]
            skipped = ''
            if part.startswith('rest'):
                # 나머지에는 한자 · 가나가 든다 — Noto Sans KR에 없는 글자(예: 일본 신자체 縄)는 원래도 다음 글꼴(Noto Sans JP 등)이 그린다.
                # 파일에서 빼고 목록에 skipped로 남긴다(계약이 「덮은 글자」로 센다).
                cmap = TTFont(src).getBestCmap()
                skipped = ''.join(c for c in chars if ord(c) not in cmap)
                chars = ''.join(c for c in chars if ord(c) in cmap)
            if not chars:  # 나머지가 없으면 파일도 없다
                continue
            href, digest, size = make_woff2(stem, chars, src, wght=wght)
            stems.add(stem)
            entry[part] = {
                'chars': chars, 'count': len(chars), **({'skipped': skipped} if skipped else {}),
                'woff2': {'href': href, 'sha256': digest, 'bytes': size},
                'unicodeRange': ranges(sorted(ord(c) for c in chars)),
            }
        manifest['docs'][d['key']] = entry
        print(f"studies {d['key']}: " + ' · '.join(f"{p} {e['count']}자 {e['woff2']['bytes']}B" for p, e in entry.items()))
    # 사라진 문서의 파일을 지운다
    for old in os.listdir(PUBLIC_DIR):
        if old.startswith(STUDIES_STEM + '-') and old.endswith('.woff2') and old.split('.')[0] not in stems:
            os.remove(os.path.join(PUBLIC_DIR, old))
    with open(os.path.join(OUT_DIR, STUDIES_MANIFEST), 'w', encoding='utf8') as f:
        json.dump(manifest, f, ensure_ascii=False, indent=1)
        f.write('\n')


def main():
    specs = json.loads(subprocess.run(['node', os.path.join(ROOT, 'scripts', 'fonts', 'kr-viewer-chars.mjs'), '--json'], check=True, capture_output=True, text=True).stdout)
    src = source_font()
    os.makedirs(OUT_DIR, exist_ok=True)
    os.makedirs(PUBLIC_DIR, exist_ok=True)
    for name, spec in specs.items():
        build(name, spec, src)
    build_studies(src)


if __name__ == '__main__':
    main()
