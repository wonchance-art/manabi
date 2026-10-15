#!/usr/bin/env python3
# 『となり』 브랜드 마크(워드마크) 세트 — 2026-10-15 KST
#
# 오너 요청 「tonari만 알파벳 버전이랑 히라가나/가타카나 버전으로 브랜드 마크 뽑아볼까」 + 역할 결정
#   Primary·International = TONARI / Primary·Japan(·Korea 후보) = となり / Accent = トナリ
# 표기 3계열 × 스타일, 그리고 세 표기를 한 기하 원리로 맞춘 '패밀리'(Murecho 출발).
#
# 사용(리포 루트):  python3 -I docs/japanology/magazine/brand/marks/build-marks.py   → svg/, sheet.html, marks.json
#                   node docs/japanology/magazine/brand/marks/shoot.cjs              → sheet.png
# 서체: 08-mast/build-mast.py의 google/fonts 고정 커밋·SHA256 검증·캐시(TONARI_FONT_CACHE)를 그대로 쓴다. 리포에 서체 파일 없음.
# 결정적: 같은 서체면 바이트 단위로 같은 산출물.
import importlib.util, json, math, os, sys
sys.dont_write_bytecode = True

HERE = os.path.dirname(os.path.abspath(__file__))
M08 = os.path.join(HERE, '..', '..', 'prototype', 'cover-machi01', '08-mast', 'build-mast.py')
spec = importlib.util.spec_from_file_location('m08', M08)
m08 = importlib.util.module_from_spec(spec); spec.loader.exec_module(m08)
apply, Mast, fmt = m08.apply, m08.Mast, m08.fmt
NIGHT, SNOW, VERMILION = m08.NIGHT, m08.SNOW, m08.VERMILION

# ── 출발 서체(모두 SIL OFL 1.1, google/fonts 67bc647ce1910e92f461bcc82aae30f21d21a9cc) ─────────────
FONTS = {
    'instrument': ('instrumentserif/InstrumentSerif-Regular.ttf', '498efd461f6ddfcb7a111bf9a565709d2085d48201d501ead960d93e84ffbb88'),
    'instrument-i': ('instrumentserif/InstrumentSerif-Italic.ttf', '08939b8bdf534afec24ae0ef5e03f948940cd9a8fe08e7fecbad040e62327385'),
    'bigshoulders': ('bigshouldersdisplay/BigShouldersDisplay%5Bwght%5D.ttf', '60e208dc276a1c35fc5b62e94f9fb959c40c11783a9eb7548175c14b1fbeb720'),
    'murecho': ('murecho/Murecho%5Bwght%5D.ttf', '3a273c2f11e0164f829bc15c0689e587fe34d1493ff167d5afff8fe71a29e667'),
    'kaisei': ('kaiseitokumin/KaiseiTokumin-ExtraBold.ttf', 'bf44bb3e23cc703bfb19111833f78e651998d0a2b1863eff9e88cecb38a8bc53'),
    'dela': ('delagothicone/DelaGothicOne-Regular.ttf', '4ff87a0965f1b0505e5a2c58424bc6ad3cff27e56a82f21c2fc9d6b0e3857ee2'),
    'zenmaru': ('zenmarugothic/ZenMaruGothic-Black.ttf', '6bd74fe76cd39ee0ec18775c3661d845343fb3f6f8fa09a3076638417baf741f'),
}
LICENSE = {
    'instrument': ('Instrument Serif 1.000', 'Copyright 2022 The Instrument Serif Project Authors'),
    'instrument-i': ('Instrument Serif Italic 1.000', 'Copyright 2022 The Instrument Serif Project Authors'),
    'bigshoulders': ('Big Shoulders Display 2.002(가변, wght 800 인스턴스)', 'Copyright 2019 The Big Shoulders Project Authors'),
    'murecho': ('Murecho 1.010(가변, wght 700 인스턴스)', 'Copyright 2021 The Murecho Project Authors'),
    'kaisei': ('Kaisei Tokumin ExtraBold 5.003', 'Copyright 2020 The Kaisei Project Authors'),
    'dela': ('Dela Gothic One 1.005', 'Copyright 2020 The Dela Gothic Project Authors'),
    'zenmaru': ('Zen Maru Gothic Black 1.001', 'Copyright 2021 The Zen Maru Gothic Authors'),
}
for k, (rel, sha) in FONTS.items():
    m08.FONTS['bm-' + k] = (rel, sha, None)
_T = {}


def glyph(key, ch, loc=None):
    """윤곽(1000 단위로 정규화, y 위쪽)."""
    kk = (key, tuple(sorted((loc or {}).items())))
    if kk not in _T:
        from fontTools.ttLib import TTFont
        t = TTFont(m08.font_path('bm-' + key))
        if loc:
            from fontTools.varLib.instancer import instantiateVariableFont
            t = instantiateVariableFont(t, loc)
        _T[kk] = t
    t = _T[kk]; glyf = t['glyf']; k = 1000 / t['head'].unitsPerEm
    g = glyf[t.getBestCmap()[ord(ch)]]
    co, ends, fl = g.getCoordinates(glyf)
    cs, s = [], 0
    for e in ends:
        cs.append([[co[i][0] * k, co[i][1] * k, bool(fl[i] & 1)] for i in range(s, e + 1)]); s = e + 1
    return cs


MU = {'wght': 700}


# ── 직접 그린 모노라인 가타카나(K2) — 서체 없이 직선·원호로 작도 ───────────────────────────
def rect_c(x0, y0, x1, y1):
    """시계 방향(잉크) 사각 윤곽."""
    return [[x0, y0, True], [x0, y1, True], [x1, y1, True], [x1, y0, True]]


def arc_band(cx, cy, r, w, a0, a1, cap0=None):
    """중심 (cx,cy), 중심선 반경 r, 굵기 w인 원호 띠(각도 a0→a1, 도). 2차 베지어로 근사(조각 ≤ 30°)."""
    n = max(1, int(math.ceil(abs(a1 - a0) / 30)))
    def side(rr, A0, A1):
        pts = []
        step = (A1 - A0) / n
        for i in range(n):
            t0 = math.radians(A0 + step * i); t1 = math.radians(A0 + step * (i + 1)); tm = (t0 + t1) / 2
            rc = rr / math.cos((t1 - t0) / 2)
            if i == 0:
                pts.append([cx + rr * math.cos(t0), cy + rr * math.sin(t0), True])
            pts.append([cx + rc * math.cos(tm), cy + rc * math.sin(tm), False])
            pts.append([cx + rr * math.cos(t1), cy + rr * math.sin(t1), True])
        return pts
    outer = side(r + w / 2, a0, a1)
    inner = side(r - w / 2, a1, a0)
    c = outer + inner
    # 잉크 방향(시계)으로 맞춘다
    area = sum(c[i][0] * c[(i + 1) % len(c)][1] - c[(i + 1) % len(c)][0] * c[i][1] for i in range(len(c))) / 2
    return c if area < 0 else c[::-1]


def k2_glyph(ch, w=104):
    """K2 모노라인 가타카나: 굵기 w 단일, 끝은 모두 수평·수직으로 자름, 꺾임은 원호 하나."""
    h = w / 2
    if ch == 'ト':
        stem = rect_c(300 - h, -40, 300 + h, 780)
        # 오른쪽으로 내려가는 짧은 획: 줄기 오른쪽에서 출발, 기울기 −22°, 끝은 수직 절단
        a = math.radians(-22); L = 470
        x0, y0 = 300, 470
        x1, y1 = x0 + L * math.cos(a), y0 + L * math.sin(a)
        nx, ny = -math.sin(a) * h, math.cos(a) * h
        tick = [[x0 - nx, y0 - ny, True], [x0 + nx, y0 + ny, True], [x1 + nx, y1 + ny + (0), True], [x1 - nx, y1 - ny, True]]
        tick = tick[::-1] if sum(tick[i][0] * tick[(i + 1) % 4][1] - tick[(i + 1) % 4][0] * tick[i][1] for i in range(4)) > 0 else tick
        return [stem, tick], [1]
    if ch == 'ナ':
        bar = rect_c(70, 560 - h, 930, 560 + h)
        stem = rect_c(560 - h, 300, 560 + h, 800)
        tail = arc_band(560 - 420, 300, 420, w, 0, -62)
        return [bar, stem, tail], []
    if ch == 'リ':
        left = rect_c(250 - h, 280, 250 + h, 770)
        right = rect_c(740 - h, 330, 740 + h, 770)
        tail = arc_band(740 - 460, 330, 460, w, 0, -62)
        return [left, right, tail], []
    raise KeyError(ch)


# ── 조립 도구 ─────────────────────────────────────────────────────────────────────────
def split_accent(m, accents):
    """m.items의 글리프 중 accents[name] 윤곽 번호를 주홍 조각으로 떼어낸다(같은 자리·같은 원점)."""
    out = []
    for it in m.items:
        if it[0] == 'g' and it[1]['name'] in accents:
            _, g, x, y = it
            idx = set(accents[g['name']])
            gi = dict(g, cs=[c for i, c in enumerate(g['cs']) if i not in idx])
            ga = dict(g, cs=[c for i, c in enumerate(g['cs']) if i in idx], role='accent')
            out += [('g', ga, x, y), ('g', gi, x, y)]
        else:
            out.append(it)
    m.items = out


def hrow(m, gs, gaps, x=0.0, base=0.0):
    xs = []
    for i, g in enumerate(gs):
        xs.append(m.put(g, x, base - g['base']))
        if i < len(gaps):
            x = xs[-1][2] + gaps[i]
    return xs


def word(label, chars, cs_of, em, gaps, accents=None):
    """가로 워드마크. gaps = 잉크 사이(em 비율) 목록."""
    m = Mast(label)
    gs = [m.glyph(cs_of(ch), em / 1000, name=ch) for ch in chars]
    hrow(m, gs, [g * em for g in gaps], base=em)
    if accents:
        split_accent(m, accents)
    return m


MARKS = {}   # id → dict


def mark(mid, script, style, label, build, fonts, edits, intent):
    MARKS[mid] = {'script': script, 'style': style, 'label': label, 'build': build, 'fonts': fonts, 'edits': edits, 'intent': intent}


# ── 알파벳 ────────────────────────────────────────────────────────────────────────────
INS_UP = {
    'T': [('squash', 0, 722, 0.4, 'above'), ('embolden', 8)],
    'O': [('embolden', 8)], 'N': [('embolden', 8)],
    'A': [('squash', 0, 722, 0.4, 'above'), ('embolden', 8)],
    'R': [('region', 0, (420, -20, 560, 80), (22, 0)), ('embolden', 8)],
    'I': [('embolden', 8)],
}
mark('L1-up', 'alphabet', '에디토리얼 세리프', 'TONARI — Instrument Serif',
     lambda: word('TONARI', 'TONARI', lambda c: apply(glyph('instrument', c), INS_UP[c]), 100, [0.02, 0.035, 0.02, 0.03, 0.035]),
     ['instrument'],
     ['T·A 대문자선 위로 솟은 세리프 끝·꼭짓점(>722)을 40%로 눌러 높이를 고름',
      'R 다리 끝(x 420–560, y<80)을 오른쪽 22 — R–I 사이를 메움',
      '윤곽 +8단위 — 원래 가는 디스플레이 세리프라 웹 헤더 24px에서 헤어라인이 사라지는 것을 막음',
      '자간: 잉크 사이 0.02–0.035em(원래 측면 여백의 약 1/3)'],
     '좁고 높은 디스플레이 세리프 대문자. 글자 사이를 조여 한 덩어리 이름으로.')
INS_LO = {
    't': [('move', 0, [25, 26, 27, 28, 29], (64, 0)), ('embolden', 8)],
    'o': [('embolden', 8)], 'n': [('embolden', 8)], 'a': [('embolden', 8)], 'r': [('embolden', 8)], 'i': [('embolden', 8)],
}
mark('L1-lo', 'alphabet', '에디토리얼 세리프', 'tonari — Instrument Serif Italic',
     lambda: word('tonari', 'tonari', lambda c: apply(glyph('instrument-i', c), INS_LO[c]), 100, [-0.005, 0.02, 0.015, 0.02, 0.02]),
     ['instrument-i'],
     ['t 가로획 오른쪽 끝(점 25–29)을 +64 늘여 o에 닿게 — t와 o가 가로획으로 이어지는 이음(이웃끼리 손을 잡음)',
      '윤곽 +8단위(작은 크기 헤어라인 보강)', '자간: t–o는 이음 때문에 −0.005em, 나머지 0.015–0.02em'],
     '이탤릭 세리프 소문자 — 손으로 쓴 듯한 흐름. t의 가로획이 옆 글자로 건너간다.')

BS = {'wght': 800}
BS_UP = {
    'T': [], 'O': [], 'N': [],
    'A': [('move', 0, [5, 6], (0, -40)), ('move', 0, [5], (4, 0)), ('move', 0, [6], (-4, 0)), ('move', 1, [0, 1], (0, -40)),
          ('move', 1, [0], (-4, 0)), ('move', 1, [1], (4, 0)), ('move', 0, [1], (20, 0)), ('move', 0, [2], (-20, 0))],
    'R': [('move', 0, [13], (-12, 0)), ('move', 0, [14], (12, 0))],
    'I': [],
}
mark('L2-up', 'alphabet', '압축 그로테스크', 'TONARI — Big Shoulders Display',
     lambda: word('TONARI', 'TONARI', lambda c: apply(glyph('bigshoulders', c, BS), BS_UP[c]), 100, [0.035, 0.05, 0.04, 0.045, 0.05]),
     ['bigshoulders'],
     ['A 가로대를 20(1000 단위) 내리고 사선 위 x 보정, 꼭짓점 평평한 윗변을 양쪽 10씩 좁힘 — 큰 크기에서 A가 덜 뭉툭하게',
      'R 다리 발끝 폭을 좁혀(13: −6, 14: +6) 다리를 곧게',
      '자간: 잉크 사이 0.035–0.05em — 압축체 기둥 리듬을 고르게'],
     '압축 그로테스크 대문자. 좁은 기둥 여섯 개가 같은 간격으로 선다.')
BS_LO = {
    't': [('move', 0, [5, 6], (57, 0)), ('move', 0, [11, 12], (40, 0))],
    'o': [], 'n': [], 'a': [], 'r': [], 'i': [],
}
mark('L2-lo', 'alphabet', '압축 그로테스크', 'tonari — Big Shoulders Display',
     lambda: word('tonari', 'tonari', lambda c: apply(glyph('bigshoulders', c, BS), BS_LO[c]), 100, [0.01, 0.04, 0.035, 0.035, 0.04]),
     ['bigshoulders'],
     ['t 가로대 왼쪽 돌기(점 5·6)를 줄기 쪽으로 +28 깎고 오른쪽(11·12)을 +20 늘림 — 가로대가 o 쪽으로만 뻗는다',
      '자간: t–o 0.01em, 나머지 0.035–0.04em'],
     '압축 소문자. t의 가로대가 오른쪽 이웃으로만 뻗는다.')


# ── 패밀리(Murecho 출발): TONARI · tonari · となり · トナリ ─────────────────────────────
# 원리 ① 같은 획 굵기: 라틴 대문자 기둥(I: 170단위) = 모든 표기의 기둥  ② 같은 높이: 가나 잉크 높이 = 대문자 높이 × 1.04
#      ③ 같은 자간: 잉크 사이 = 기둥 굵기 × 0.42  ④ 주홍 하나: 각 표기에서 본체 곁에 떨어져 선 작은 획(A 가로대·i 점·と 첫 획·ト 짧은 획)
CAP = 728.0; STEM = 170.0; KANA_H = CAP * 1.04; GAP = STEM * 0.42
FAM_ACCENT = {'A': [1], 'i': [1], 'と': [1], 'ト': [1]}


def fam_kana(ch):
    cs = glyph('murecho', ch, MU)
    ys = [p[1] for c in cs for p in c]
    return cs, max(ys) - min(ys)


def kana_scale():
    """가나 잉크 높이를 KANA_H에 맞추는 배율(세 글자 평균)."""
    hs = [fam_kana(c)[1] for c in 'となりトナリ']
    return KANA_H / (sum(hs) / len(hs))


def fam_kana_cs(ch):
    k = kana_scale()
    # Murecho 가나 기둥(ト 158·リ 149, 평균 153)을 배율 k 뒤에도 라틴 기둥 170과 같게: 윤곽을 d만큼 확장
    d = (STEM / k - 153.5) / 2
    cs = glyph('murecho', ch, MU)
    return apply(cs, [('embolden', d)]), k, d


def fam_word(chars, label):
    m = Mast(label)
    em = 100.0
    gs = []
    for ch in chars:
        if ord(ch) > 0x3000:
            cs, k, d = fam_kana_cs(ch)
            gs.append(m.glyph(cs, em * k / 1000, name=ch))
        else:
            gs.append(m.glyph(glyph('murecho', ch, MU), em / 1000, name=ch))
    hrow(m, gs, [GAP / 1000 * em] * (len(gs) - 1), base=em * CAP / 1000 if ord(chars[0]) < 0x3000 else em)
    split_accent(m, FAM_ACCENT)
    return m


FAM_EDITS = ['출발: Murecho wght 700(라틴·가나를 한 디자이너가 같은 기하로 그린 OFL 서체)',
             '가나: 배율 = 대문자 높이×1.04 ÷ 가나 평균 잉크 높이, 그 뒤 기둥이 라틴 기둥(170)과 같도록 윤곽을 확장(계산값은 marks.json)',
             '자간: 세 표기 모두 잉크 사이 = 기둥×0.42(71단위) — 같은 리듬',
             '주홍 하나: 본체 곁에 떨어진 작은 획만 주홍 — TONARI의 A 가로대·tonari의 i 점·となり의 と 첫 획·トナリ의 ト 짧은 획(겹치는 부분은 본체 색이 위)']
mark('F-up', 'alphabet', '패밀리(기하 산세리프)', 'TONARI — 패밀리', lambda: fam_word('TONARI', 'TONARI'), ['murecho'], FAM_EDITS,
     '우산 브랜드 — 일본 외 나라 시리즈와 서비스 전체를 대표. A 가로대(두 다리 사이의 이웃 획)만 주홍.')
mark('F-lo', 'alphabet', '패밀리(기하 산세리프)', 'tonari — 패밀리 보조 소문자', lambda: fam_word('tonari', 'tonari'), ['murecho'], FAM_EDITS,
     '패밀리 소문자(본문 속 언급·URL 같은 보조 자리). i 점이 주홍.')
mark('F-hira', 'hiragana', '패밀리(기하 고딕)', 'となり — 패밀리', lambda: fam_word('となり', 'となり'), ['murecho'], FAM_EDITS,
     '일본 국내 시리즈. と의 첫 획(본체 곁의 짧은 획)이 주홍.')
mark('F-kata', 'katakana', '패밀리(기하 고딕)', 'トナリ — 패밀리', lambda: fam_word('トナリ', 'トナリ'), ['murecho'], FAM_EDITS,
     '하이브리드/경계 — 일본×다른 나라가 만나는 꼭지. ト의 짧은 획이 주홍.')

# ── 히라가나 ──────────────────────────────────────────────────────────────────────────
KS = {'と': [], 'な': [('drop', 1), ('scale', 0, (1.12, 1.3))], 'り': []}
mark('H1', 'hiragana', '명조', 'となり — Kaisei Tokumin',
     lambda: word('となり', 'となり', lambda c: apply(glyph('kaisei', c), KS[c]), 100, [0.05, 0.05]), ['kaisei'],
     ['な 교차부 바늘구멍(윤곽 1, 33×41) 삭제 — 파비콘·헤더 크기에서 얼룩', 'な 고리 속공간(윤곽 0) 112×130% — 작게 써도 고리가 열림',
      '자간: 잉크 사이 0.05em(가나 기본 여백의 약 1/4)'],
     '구슬 같은 맺음이 있는 장식 명조. 잡지 본문 제목(12-hip H2)과 같은 목소리.')
DS = {'と': [], 'な': [('scale', 2, (1.7, 2.1))], 'り': []}
mark('H2', 'hiragana', '굵은 고딕 디스플레이', 'となり — Dela Gothic One',
     lambda: word('となり', 'となり', lambda c: apply(glyph('dela', c), DS[c]), 100, [0.035, 0.035]), ['dela'],
     ['な 고리 속공간(윤곽 2, 96×52 — 거의 막힘)을 170×210% — 굵은 획 안에서 고리가 읽히게', '자간: 잉크 사이 0.035em(넓적한 글자를 바짝)'],
     '넓적하고 아주 굵은 고딕. 작은 크기에서도 덩어리로 읽힌다.')
ZM = {'と': [], 'な': [('scale', 3, (1.45, 1.75))], 'り': []}
mark('H3', 'hiragana', '둥근 고딕', 'となり — Zen Maru Gothic Black',
     lambda: word('となり', 'となり', lambda c: apply(glyph('zenmaru', c), ZM[c]), 100, [0.04, 0.04]), ['zenmaru'],
     ['な 고리 속공간(윤곽 3, 95×67)을 145×175% — 둥근 굵은 획 안에서 고리가 막히지 않게', '자간: 잉크 사이 0.04em'],
     '둥근 끝의 굵은 고딕 — 손에 잡히는 부드러움(굿즈·아이 대상 등).')

# ── 가타카나 ──────────────────────────────────────────────────────────────────────────
DK = {'ト': [('region', 0, (800, 100, 1000, 560), (36, 0)), ('embolden', -10)],
      'ナ': [('embolden', -10)],
      'リ': [('embolden', -10)]}
mark('K1', 'katakana', '굵은 고딕', 'トナリ — Dela Gothic One',
     lambda: word('トナリ', 'トナリ', lambda c: apply(glyph('dela', c), DK[c]), 100, [0.03, 0.04]), ['dela'],
     ['ト 짧은 획 끝(x>800)을 오른쪽 36 — ナ 쪽으로 뻗음',
      '윤곽 −10단위 — 아주 굵은 Dela의 글자 사이·안쪽 틈이 헤더 24px에서 막히지 않게(시험: ナ 줄기 머리를 자르면 テ로 읽혀 기각)',
      '자간: 잉크 사이 0.03·0.04em'],
     '아주 굵은 직선 가타카나. 세 글자가 하나의 띠처럼.')
mark('K2', 'katakana', '모노라인 기하(직접 작도)', 'トナリ — 모노라인 작도',
     lambda: word('トナリ', 'トナリ', lambda c: k2_glyph(c)[0], 100, [0.06, 0.06]), [],
     ['서체 없이 직접 작도: 굵기 104(1000 단위) 단일, 끝은 모두 직각 절단',
      'ト = 수직 줄기 + −22° 짧은 획 / ナ = 가로획 + 줄기 + 62° 원호 꼬리 / リ = 짧은 줄기 + 긴 줄기 + 62° 원호 꼬리(원호는 2차 베지어 30° 조각)',
      '자간: 잉크 사이 0.06em'],
     '직선과 원호 하나씩만으로 그린 가타카나. 기하가 곧 형태.')


# ── 락업 ────────────────────────────────────────────────────────────────────────────
def fam_glyphs(m, chars, em, tag=''):
    gs = []
    for ch in chars:
        if ord(ch) > 0x3000:
            cs, k, d = fam_kana_cs(ch); gs.append(m.glyph(cs, em * k / 1000, name=tag + ch))
        else:
            gs.append(m.glyph(glyph('murecho', ch, MU), em / 1000, name=tag + ch))
    return gs


def hier(series):
    """계층 락업: 우산 TONARI(크게) 아래 왼쪽에 시리즈 마크(작게), 사이에 얇은 밤 선."""
    m = Mast(f'TONARI {series}')
    em = 100.0
    big = fam_glyphs(m, 'TONARI', em)
    xs = hrow(m, big, [GAP / 1000 * em] * 5, base=em * CAP / 1000)
    left, right, bottom = xs[0][0], xs[-1][2], max(b[3] for b in xs)
    se = em * 0.34
    sm = fam_glyphs(m, series, se, tag='s')
    rule_y = bottom + 0.12 * em
    m.rect(left, rule_y, right - left, STEM / 1000 * em * 0.22, role='ink')
    hrow(m, sm, [GAP / 1000 * se] * (len(sm) - 1), x=left, base=rule_y + 0.1 * em + se)
    split_accent(m, {'A': [1], 's' + series[0]: [1]})
    return m


def lockup_kr():
    """선택: となり(크게) + 아래 TONARI(작게, となり 폭에 맞춰 자간을 벌림) — 한국 독자용 후보."""
    m = Mast('となり TONARI')
    em = 100.0
    big = fam_glyphs(m, 'となり', em)
    xs = hrow(m, big, [GAP / 1000 * em] * 2, base=em)
    left, right, bottom = xs[0][0], xs[-1][2], max(b[3] for b in xs)
    se = em * 0.24
    sm = fam_glyphs(m, 'TONARI', se, tag='s')
    gap = (right - left - sum(g['w'] for g in sm)) / 5
    hrow(m, sm, [gap] * 5, x=left, base=bottom + 0.16 * em + se * CAP / 1000)
    split_accent(m, {'と': [1]})
    return m


LOCKUPS = {
    'HL-tonari': ('계층 락업 — TONARI / となり', lambda: hier('となり'), '우산 TONARI 아래 일본 시리즈 となり. 같은 굵기·자간 원리라 크기만 다른 한 가족.'),
    'HL-tonari-k': ('계층 락업 — TONARI / トナリ', lambda: hier('トナリ'), '우산 TONARI 아래 하이브리드 꼭지 トナリ.'),
    'LK-kr': ('(선택) となり + 작은 TONARI', lockup_kr, '한국 독자용 후보로 낮춘 선택안 — となり 폭에 맞춰 자간을 벌린 읽기 TONARI.'),
}


def nest(svg_text, x, y, w):
    """마크 SVG를 다른 SVG 안의 (x, y)에 폭 w로 끼운다(아웃라인 유지)."""
    i = svg_text.index('viewBox="') + 9; vb = svg_text[i:svg_text.index('"', i)]
    _, _, vw, vh = map(float, vb.split())
    inner = svg_text[svg_text.index('>') + 1:svg_text.rindex('</svg>')]
    h = w * vh / vw
    return f'<svg x="{fmt(x)}" y="{fmt(y)}" width="{fmt(w)}" height="{fmt(h)}" viewBox="{vb}">{inner}</svg>', h


def text_mark(text, wght=600):
    """짧은 라벨 글자(Murecho 윤곽)."""
    m = Mast(text)
    em = 100.0; gs = []; gaps = []
    for i, ch in enumerate(text):
        if ch in ' 　':
            continue
        gs.append(m.glyph(glyph('murecho', ch, {'wght': wght}), em / 1000, name=ch))
        gaps.append(0.36 * em if i + 1 < len(text) and text[i + 1] in ' 　' else 0.05 * em)
    hrow(m, gs, gaps[:len(gs) - 1], base=em)
    return m


def chip(kata, word):
    """꼭지 라벨 칩 「トナリ｜ことば」: 밤 알약 + トナリ(눈, 주홍 획) + 주홍 세로선 + 꼭지 이름(눈)."""
    H = 64.0
    a_svg = kata.svg(SNOW)[0]; w_svg = text_mark(word).svg(SNOW)[0]
    a, ah = nest(a_svg, 26, 0, 92); a = a.replace('y="0"', f'y="{fmt((H - ah) / 2)}"', 1)
    ww = 28.5 * len(word)   # 꼭지 이름 폭: 글자당 28.5(가나 높이 약 26)
    b, bh = nest(w_svg, 142, 0, ww); b = b.replace('y="0"', f'y="{fmt((H - bh) / 2)}"', 1)
    W = 142 + ww + 28
    return (f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {fmt(W)} {fmt(H)}" role="img" aria-label="トナリ｜{word}">'
            f'<rect width="{fmt(W)}" height="{fmt(H)}" rx="32" fill="{NIGHT}"/><rect x="128" y="18" width="2.6" height="28" fill="{VERMILION}"/>{a}{b}</svg>')


def sticker(kata):
    """원형 스티커: 주홍 원 + トナリ(눈)."""
    c, ch = nest(kata.svg(SNOW, accent=NIGHT)[0], 36, 0, 128); c = c.replace('y="0"', f'y="{fmt(100 - ch / 2)}"', 1)
    return (f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200" role="img" aria-label="トナリ">'
            f'<circle cx="100" cy="100" r="100" fill="{VERMILION}"/>{c}</svg>')


def main():
    os.makedirs(os.path.join(HERE, 'svg'), exist_ok=True)
    out = {}
    def save(name, text):
        open(os.path.join(HERE, 'svg', name), 'w').write(text + '\n')
    for mid, info in MARKS.items():
        m = info['build']()
        light, W, H = m.svg(NIGHT); dark, _, _ = m.svg(SNOW)
        save(f'{mid}-light.svg', light); save(f'{mid}-dark.svg', dark)
        out[mid] = {k: v for k, v in info.items() if k != 'build'}
        out[mid].update({'ratio': round(W / H, 3), 'vb': [round(W, 2), round(H, 2)]})
    lk = {}
    for lid, (label, fn, intent) in LOCKUPS.items():
        m = fn(); light, W, H = m.svg(NIGHT); dark, _, _ = m.svg(SNOW)
        save(f'{lid}-light.svg', light); save(f'{lid}-dark.svg', dark)
        lk[lid] = {'label': label, 'intent': intent, 'ratio': round(W / H, 3)}
    kata = MARKS['F-kata']['build']()
    save('use-chip-kotoba.svg', chip(kata, 'ことば'))
    save('use-sticker.svg', sticker(kata))
    k = kana_scale()
    fam = {'kana_scale': round(k, 4), 'kana_embolden_units': round((STEM / k - 153.5) / 2, 2), 'stem': STEM, 'cap': CAP, 'gap': GAP}
    json.dump({'marks': out, 'lockups': lk, 'family': fam, 'licenses': LICENSE, 'fonts': {k: v[0] for k, v in FONTS.items()}},
              open(os.path.join(HERE, 'marks.json'), 'w'), ensure_ascii=False, indent=1)
    open(os.path.join(HERE, 'marks.json'), 'a').write('\n')
    write_sheet(out, lk)


ROLE = {'F-up': '우산 · 국제', 'F-hira': '일본 시리즈', 'F-kata': '하이브리드 · 경계', 'F-lo': '보조 소문자'}


def uses(mid, ratio):
    k = 390 / 210
    w80 = 168 * k; h80 = w80 / ratio
    cover = (f'<div class="use"><div class="cv" style="height:{13 * k + h80 + 18:.0f}px"><img src="svg/{mid}-light.svg" style="width:{w80:.1f}px;left:{(390 - w80) / 2:.1f}px;top:{13 * k:.1f}px"></div>'
             f'<div class="cap">표지 제호 폭 80%(390px 표지에서 {w80:.0f}×{h80:.0f}px)</div></div>')
    head = ''.join(f'<div class="hd {t}"><img src="svg/{mid}-{t}.svg" style="height:24px"><span>（ダミー）見出し</span></div>' for t in ('light', 'dark'))
    return cover + f'<div class="use">{head}<div class="cap">웹 헤더 마크 높이 24px</div></div>'


SCREENS = r"""
<h2>화면별 사용 견본 <small>(더미 글자는 모두 「ダミー」「Série」 등으로 표시 — 사실 주장 없음)</small></h2>
<h3><b class="role">우산 · 국제</b> TONARI</h3>
<div class="scr">
 <figure><div class="ph shelf390">
   <div class="bar"><img src="svg/F-up-light.svg" style="height:20px"><span>マガジン</span></div>
   <div class="row4"><i>表紙<br>ダミー</i><i>表紙<br>ダミー</i><i>表紙<br>ダミー</i></div>
 </div><figcaption>서재 매거진 진열대 머리 · 390px</figcaption></figure>
 <figure><div class="scale50" style="height:150px"><div class="ph shelf1440">
   <div class="bar"><img src="svg/F-up-light.svg" style="height:30px"><span>マガジン · すべてのシリーズ</span></div>
   <div class="row8"><i>表紙ダミー</i><i>表紙ダミー</i><i>表紙ダミー</i><i>表紙ダミー</i><i>表紙ダミー</i><i>表紙ダミー</i><i>表紙ダミー</i></div>
 </div></div><figcaption>같은 머리 · 1440px(50% 축소)</figcaption></figure>
 <figure><div class="ph cover fr">
   <img class="mh" src="svg/F-up-light.svg" style="width:312px;left:39px;top:24px">
   <div class="ser">Série ——（ダミー）</div><div class="img">写真ダミー</div><div class="ttl">Titre（ダミー）</div>
 </div><figcaption>일본 외 시리즈 표지 제호(가상 · 시리즈명은 자리 표시)</figcaption></figure>
 <figure><div class="scale50" style="width:600px;height:315px"><div class="ph sns">
   <img src="svg/F-up-dark.svg" style="height:86px">
   <div class="t">記事タイトル（ダミー）</div><div class="s">tonari · manabi（ダミーURL）</div>
 </div></div><figcaption>SNS 공유 이미지 1200×630(50% 축소)</figcaption></figure>
</div>
<h3><b class="role">일본 시리즈</b> となり</h3>
<div class="scr">
 <figure><div class="ph cover jp">
   <img class="mh" src="svg/F-hira-light.svg" style="width:206px;left:24px;top:24px">
   <div class="no">一つの町　01</div><div class="vt">富士吉田</div><div class="line"></div>
 </div><figcaption>일본 시리즈 표지 제호(一つの町 01 富士吉田, 12-hip 배치 참고·단순화)</figcaption></figure>
 <figure><div class="ph toc">
   <div class="bar"><img src="svg/F-hira-light.svg" style="height:22px"><span>一つの町　01　富士吉田</span></div>
   <div class="h">目次</div><ol><li>（ダミー）見出し一</li><li>（ダミー）見出し二</li><li>（ダミー）見出し三</li></ol>
 </div><figcaption>호 목차 페이지 머리</figcaption></figure>
 <figure><div class="ph tobira">
   <div class="bar"><img src="svg/F-hira-dark.svg" style="height:18px"><span>一つの町　01</span></div>
   <div class="h">（ダミー）扉の見出し</div>
 </div><figcaption>뷰어 扉 머리(밤)</figcaption></figure>
 <figure><div class="ph credit">
   <p>地図　© OpenStreetMap contributors（ODbL）</p><p class="cr"><img src="svg/F-hira-light.svg" style="height:11px">編集部</p><p class="plain">（文字のみ）となり編集部</p>
 </div><figcaption>크레딧 「となり編集部」 — 마크 + 글자 / 글자만</figcaption></figure>
</div>
<h3><b class="role">하이브리드 · 경계</b> トナリ</h3>
<div class="scr">
 <figure><div class="ph plainbg"><img src="svg/use-chip-kotoba.svg" style="height:40px"><img src="svg/use-chip-kotoba.svg" style="height:24px;margin-top:10px"></div><figcaption>꼭지 라벨 칩 「トナリ｜ことば」(한일 비교 꼭지, 40·24px)</figcaption></figure>
 <figure><div class="ph kw">
   <div class="bar"><img src="svg/F-kata-light.svg" style="height:22px"><span>つながるキーワード</span></div>
   <div class="h">（ダミー）キーワード</div><p>日本語 ↔ 韓国語（ダミー）</p>
 </div><figcaption>연결 키워드 페이지 머리</figcaption></figure>
 <figure><div class="ph plainbg"><img src="svg/use-sticker.svg" style="width:140px"></div><figcaption>스티커(원형 · 주홍)</figcaption></figure>
</div>
"""


def write_sheet(out, lk):
    def block(mid, title=None):
        v = out[mid]
        role = f'<b class="role">{ROLE[mid]}</b> ' if mid in ROLE else ''
        return (f'<section class="mk"><h3>{role}{title or v["label"]}</h3><p>{v["intent"]}</p>'
                f'<div class="big"><div class="l"><img src="svg/{mid}-light.svg"></div><div class="d"><img src="svg/{mid}-dark.svg"></div></div>'
                f'<div class="uses">{uses(mid, v["ratio"])}</div></section>')
    f = 380 / out['F-up']['vb'][0]   # 같은 배율: TONARI 폭 380px 기준 — 세 마크의 획 굵기·높이를 그대로 비교
    famrow = ''.join(f'<div class="fr1"><b class="role">{ROLE[m]}</b><img src="svg/{m}-light.svg" style="width:{out[m]["vb"][0] * f:.1f}px;max-width:none;max-height:none"></div>' for m in ('F-up', 'F-hira', 'F-kata'))
    famrow_d = ''.join(f'<div class="fr1 d"><b class="role">{ROLE[m]}</b><img src="svg/{m}-dark.svg" style="width:{out[m]["vb"][0] * f:.1f}px;max-width:none;max-height:none"></div>' for m in ('F-up', 'F-hira', 'F-kata'))
    fam = ''.join(block(m) for m in ('F-up', 'F-hira', 'F-kata', 'F-lo'))
    lock = ''.join(f'<section class="mk"><h3>{v["label"]}</h3><p>{v["intent"]}</p><div class="big lk"><div class="l"><img src="svg/{k}-light.svg"></div><div class="d"><img src="svg/{k}-dark.svg"></div></div></section>' for k, v in lk.items())
    rest = ''
    for script, title in (('alphabet', '알파벳'), ('hiragana', '히라가나'), ('katakana', '가타카나')):
        ids = [k for k, v in out.items() if v['script'] == script and not k.startswith('F-')]
        rest += f'<h2>{title} — 다른 스타일</h2>' + ''.join(block(k, f'{out[k]["style"]} — {out[k]["label"]}') for k in ids)
    html = f"""<!doctype html><html lang="ko"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>となり 브랜드 마크</title>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Murecho:wght@400;600&family=Shippori+Mincho:wght@800&family=Zen+Kaku+Gothic+New:wght@400;500&display=swap">
<style>
:root{{--bg:#d9dce3;--fg:#151b2c;--mute:#4a5163}}
body{{margin:0;padding:22px 26px 40px;background:var(--bg);color:var(--fg);font:13px/1.5 system-ui,sans-serif}}
h1{{font-size:19px;margin:0 0 4px}} h2{{font-size:16px;margin:30px 0 6px;border-top:2px solid #151b2c;padding-top:10px}} h2 small{{font-weight:400;color:var(--mute);font-size:12px}}
h3{{font-size:14px;margin:12px 0 4px}} p{{margin:0 0 8px;color:var(--mute)}} .role{{background:#151b2c;color:#eef0f4;padding:1px 7px;border-radius:3px;font-size:12px;margin-right:4px}}
.mk{{margin:12px 0 18px}}
.big{{display:flex;gap:12px}} .big>div{{padding:22px 28px;display:flex;align-items:center;justify-content:center;width:480px;height:140px;box-sizing:border-box}}
.big.lk>div{{height:200px}} .big img{{max-width:100%;max-height:100%;display:block}} .l{{background:#eef0f4}} .d{{background:#151b2c}}
.uses{{display:flex;gap:16px;align-items:flex-start;margin-top:10px;flex-wrap:wrap}} .use .cap{{font-size:11px;color:var(--mute);margin-top:3px}}
.cv{{position:relative;width:390px;height:120px;overflow:hidden;background:#eef0f4}} .cv img{{position:absolute;display:block}}
.hd{{width:390px;height:48px;display:flex;align-items:center;gap:14px;padding:0 14px;box-sizing:border-box;margin-bottom:4px;font-size:12px}}
.hd.light{{background:#eef0f4;color:#151b2c;border-bottom:1px solid #c3c7d1}} .hd.dark{{background:#151b2c;color:#eef0f4}} .hd span{{margin-left:auto;opacity:.7}}
.famtop{{display:grid;grid-template-columns:repeat(3,480px);gap:10px}} .fr1{{background:#eef0f4;padding:30px 26px 22px;position:relative;height:150px;display:flex;align-items:center;justify-content:center;box-sizing:border-box}}
.fr1.d{{background:#151b2c}} .fr1 img{{max-width:88%;max-height:70px}} .fr1 .role{{position:absolute;left:10px;top:8px}}
.famhead{{background:#eef0f4;padding:10px 14px;border-left:4px solid #d4462a;margin:8px 0}}
.scr{{display:flex;gap:18px;flex-wrap:wrap;align-items:flex-start}} figure{{margin:0}} figcaption{{font-size:11.5px;color:var(--mute);margin-top:4px;max-width:390px}}
.ph{{background:#eef0f4;font-family:'Murecho','Zen Kaku Gothic New',sans-serif;color:#151b2c;position:relative;overflow:hidden}}
.ph .bar{{display:flex;align-items:center;gap:12px;height:52px;padding:0 16px;border-bottom:1px solid #c3c7d1}} .ph .bar span{{font-size:12px;opacity:.75}}
.shelf390{{width:390px;height:230px}} .row4{{display:flex;gap:12px;padding:14px 16px}} .row4 i,.row8 i{{display:flex;align-items:center;justify-content:center;text-align:center;font-style:normal;font-size:11px;color:#6b7284;background:#d0d4dd;width:104px;height:146px}}
.scale50{{width:720px;overflow:hidden}} .scale50>.ph{{transform:scale(.5);transform-origin:0 0}}
.shelf1440{{width:1440px;height:300px}} .shelf1440 .bar{{height:72px;padding:0 40px}} .row8{{display:flex;gap:22px;padding:22px 40px}} .row8 i{{width:150px;height:210px}}
.cover{{width:390px;height:551px}} .cover .mh{{position:absolute}} .fr .ser{{position:absolute;left:39px;top:96px;font:500 13px 'Zen Kaku Gothic New';letter-spacing:.06em}}
.fr .img{{position:absolute;left:0;right:0;top:130px;height:300px;background:#cfd3dc;display:flex;align-items:center;justify-content:center;color:#6b7284;font-size:12px}}
.fr .ttl{{position:absolute;left:39px;top:450px;font:800 30px 'Shippori Mincho',serif}}
.sns{{width:1200px;height:630px;background:#151b2c;color:#eef0f4;padding:80px 90px;box-sizing:border-box}} .sns .t{{font:600 64px 'Murecho';margin-top:120px}} .sns .s{{font-size:28px;opacity:.6;margin-top:30px}}
.jp .no{{position:absolute;left:24px;top:108px;font:500 10.5px 'Zen Kaku Gothic New';letter-spacing:.08em}} .jp .vt{{position:absolute;right:40px;top:150px;writing-mode:vertical-rl;font:800 38px 'Shippori Mincho',serif}}
.jp .line{{position:absolute;left:226px;top:200px;width:6px;bottom:0;background:#d4462a;transform:rotate(4deg);transform-origin:top}}
.toc{{width:390px;height:230px}} .toc .h,.kw .h{{font:600 22px 'Murecho';padding:14px 16px 4px}} .toc ol{{margin:0;padding:4px 16px 0 36px;font-size:13px;line-height:1.9}}
.tobira{{width:390px;height:150px;background:#151b2c;color:#eef0f4}} .tobira .bar{{border-color:#2a3247}} .tobira .h{{font:800 24px 'Shippori Mincho',serif;padding:24px 16px}}
.credit{{width:390px;padding:16px;box-sizing:border-box;font-size:11px}} .credit p{{color:#151b2c;margin:0 0 4px}} .credit .cr{{display:flex;align-items:flex-end;gap:2px}} .credit .plain{{color:#4a5163}}
.plainbg{{width:300px;padding:20px;display:flex;flex-direction:column;align-items:flex-start}} .kw{{width:390px;height:180px}} .kw p{{padding:0 16px}}
</style></head><body>
<h1>となり 브랜드 마크(워드마크) 세트</h1>
<p>모두 아웃라인 SVG(서체 &lt;text&gt; 없음) · 출발 서체는 SIL OFL 1.1뿐 · 색: 밤 #151b2c · 눈 #eef0f4 · 주홍 #d4462a(비글자 악센트) · 2026-10-15 KST</p>
<h2>패밀리 — 한 기하 원리로 그린 세 역할(Murecho 출발)</h2>
<div class="famtop">{famrow}</div><div class="famtop" style="margin-top:10px">{famrow_d}</div>
<p>세 칸 모두 같은 배율(획 굵기·높이를 그대로 비교). 역할: TONARI = 국제·보편(우산 — 일본 외 나라 시리즈·서비스 대표) · となり = 일본 국내 시리즈 · トナリ = 하이브리드/경계(일본×다른 나라가 만나는 꼭지)</p>
<div class="famhead">원리: 같은 기둥 굵기(라틴 I 기둥 = 가나 기둥) · 가나 높이 = 대문자 높이×1.04 · 잉크 사이 = 기둥×0.42 · 주홍은 '본체 곁의 작은 획' 하나(A 가로대 · と 첫 획 · ト 짧은 획 · i 점)</div>
{fam}
<h2>계층 락업 — 우산 TONARI + 시리즈</h2>
{lock}
{SCREENS}
{rest}
</body></html>"""
    open(os.path.join(HERE, 'sheet.html'), 'w').write(html)


if __name__ == '__main__':
    main()
