#!/usr/bin/env python3
# 『となり』 제호(마스트헤드) 레터링 빌더 — 2026-10-15 KST, 표지 팀 2단계(레터링)
#
# 사용:  python3 -I build-mast.py            (이 파일이 있는 폴더에 산출물을 쓴다)
#        PNG:  export PATH=/opt/node24/bin:$PATH
#              node <scratchpad>/shotfull.cjs compare.html compare.png 1200
# 요구:  pip install fonttools==4.67.0 (4.x면 동작)
#
# 하는 일 (결정적: 같은 서체 파일이면 바이트 단위로 같은 SVG가 나온다)
#  1) 출처 서체를 google/fonts 고정 커밋에서 받아 SHA256을 검증한다(없을 때만 받음).
#  2) 「と」「な」「り」의 TrueType(2차 베지어) 윤곽점을 읽는다.
#  3) EDITS 표의 손 수정(점 이동·윤곽 삭제·획 연장)을 적용한다 — '서체 그대로'가 아니다.
#  4) 손으로 정한 자간·크기·기준선으로 배치하고, 괄호 『』는 서체 글리프가 아니라
#     0.75mm 고른 겹선(사각형 윤곽)으로 직접 그린다(AD 1.2mm 대비 근거는 compare.html 대안 줄).
#  5) mast-light.svg / mast-dark.svg (viewBox mm, 높이 16) 와 compare.html 을 쓴다.
import hashlib, os, sys, urllib.request

HERE = os.path.dirname(os.path.abspath(__file__))
FONT_DIR = os.path.join(HERE, 'fonts')

# ── 출처 서체 (SIL Open Font License 1.1) ─────────────────────────────────────────────
GF_COMMIT = '67bc647ce1910e92f461bcc82aae30f21d21a9cc'  # google/fonts main, 2026-10-15 KST 조회
FONT_FILE = 'ShipporiMincho-ExtraBold.ttf'               # name ID 5: "Version 3.110"
FONT_URL = f'https://raw.githubusercontent.com/google/fonts/{GF_COMMIT}/ofl/shipporimincho/{FONT_FILE}'
FONT_SHA256 = 'bdb787644b4b347e9a7efdd576f0d16ee4528cc9b5c86d23e06fa1a14ae0444c'
OFL_URL = f'https://raw.githubusercontent.com/google/fonts/{GF_COMMIT}/ofl/shipporimincho/OFL.txt'
OFL_FILE = 'OFL-ShipporiMincho.txt'
OFL_SHA256 = '41fba056279be5f45ff9a99e44b7b53897b42732f5806d8e666e0ab49ac6bd38'

# ── 색 (표지 공통 토큰) ──────────────────────────────────────────────────────────────
NIGHT, SNOW, VERMILION = '#151b2c', '#eef0f4', '#d4462a'


def fetch(url, name, sha):
    os.makedirs(FONT_DIR, exist_ok=True)
    p = os.path.join(FONT_DIR, name)
    if not os.path.exists(p):
        print('download', url, file=sys.stderr)
        urllib.request.urlretrieve(url, p)
    h = hashlib.sha256(open(p, 'rb').read()).hexdigest()
    if h != sha:
        sys.exit(f'SHA256 불일치: {name} {h} != {sha}')
    return p


# ── 윤곽 읽기: 윤곽마다 [x, y, on] 점 목록 ────────────────────────────────────────────
def load_glyphs(path, chars):
    from fontTools.ttLib import TTFont
    t = TTFont(path)
    cmap, glyf = t.getBestCmap(), t['glyf']
    out = {}
    for c in chars:
        g = glyf[cmap[ord(c)]]
        co, ends, fl = g.getCoordinates(glyf)
        cs, s = [], 0
        for e in ends:
            cs.append([[float(co[i][0]), float(co[i][1]), bool(fl[i] & 1)] for i in range(s, e + 1)])
            s = e + 1
        out[c] = cs
    return out


# ── 손 수정 표 ────────────────────────────────────────────────────────────────────────
# 좌표는 서체 단위(1000/em, y 위쪽). 점 번호는 위 고정 커밋의 Version 3.110 기준.
# op: move = 점들을 (dx, dy) 이동 / set = 점을 (x, y)로 / drop = 윤곽 삭제
EDITS = {
    'と': [
        # T1 맺음 연장: 마지막 가로획을 이웃(な) 쪽으로 뻗는다 — 「となり」의 '곁으로 손을 뻗는' 몸짓.
        #    끝 둥근 봉오리(58–64)를 오른쪽 46·위 10으로 옮기고, 끝을 살짝 들어 붓을 떼는 방향을 만든다.
        ('move', 0, [57, 58, 59, 60, 61, 62, 63], (30, 8), 'T1 아래 가로획 끝을 오른쪽(이웃 쪽)으로 30 연장, 8 들어올림'),
        ('move', 0, [56], (15, 4), 'T1 연장 구간 곡선 고르기'),
        # T2 꺾임 안쪽(35–37)이 30px에서 뭉치므로 안쪽 홈을 7 깊게 판다.
        ('move', 0, [35, 36], (4, 7), 'T2 첫 획과 둘째 획 이음 안쪽 홈을 깊게(30px 뭉침 방지)'),
        # T3 첫 획(세로)이 87단위로 な 사선(≈110)·り 왼획(≈115)보다 가늘어 30px에서 と만 옅어 보인다 → 오른 가장자리를 12 밀어 99로.
        ('move', 0, [29, 30, 31, 32, 33], (12, 0), 'T3 첫 획 오른 가장자리 12 두껍게(세 글자 기둥 굵기 맞춤)'),
        ('move', 0, [28, 34], (6, 0), 'T3 두껍게 한 구간 위아래 곡선 잇기'),
    ],
    'な': [
        # N1 첫 획과 둘째 획 교차부의 바늘구멍(윤곽 1, 27×43 단위)을 메운다.
        #    16mm에서 0.36mm 점, 30px에서 회색 얼룩이 되어 교차부가 지저분해 보인다.
        ('drop', 1, None, None, 'N1 교차부 바늘구멍(윤곽 1) 삭제'),
        # N2 고리 속공간(윤곽 3)을 키운다 — 107→129 단위. 바깥 윤곽은 그대로 두고 안만 판다(위·아래 잉크 77→65·67).
        ('move', 3, [8, 9, 10, 0], (0, -12), 'N2 고리 속공간 아랫변 12 내림'),
        ('move', 3, [3, 4, 5], (0, 10), 'N2 고리 속공간 윗변 10 올림'),
        # N3 오른쪽 아래 삐침(9–17) 끝을 이웃(り) 쪽으로 18 더 뻗고 4 내린다 — T1과 같은 몸짓.
        ('move', 2, [11, 12, 13, 14, 15, 16], (18, -4), 'N3 고리 끝 삐침을 오른쪽(이웃 쪽)으로 18 연장'),
        ('move', 2, [10, 17], (9, -2), 'N3 연장 구간 곡선 고르기'),
    ],
    'り': [
        # R1 왼획→오른획을 잇는 실선(58–61)을 두껍게: 30px에서 끊겨 두 조각으로 보이던 것을 잇는다.
        ('move', 0, [59], (-4, -14), 'R1 왼획-오른획 이음선 아래쪽을 내려 두께 확보'),
        ('move', 0, [60], (-8, -6), 'R1 이음선 곡선 고르기'),
        # R2 꼬리 끝을 바늘 끝에서 짧은 비스듬한 칼끝으로 바꾼다(16mm 인쇄 시 끝 날림 방지, 30px에서 꼬리 길이 유지).
        ('move', 0, [6, 7, 8, 9, 10, 11, 12], (6, 4), 'R2 꼬리 끝 바늘을 4·6 당겨 끝 정리'),
        ('move', 0, [12], (6, 6), 'R2 꼬리 끝 윗변을 벌려 칼끝 폭 확보'),
    ],
}

# 글자별 배치: 왼쪽 x(mm), 확대율(서체 단위→mm), 기준선 보정(mm, +는 아래)
# 기준 em: 13.2mm (s = 0.0132 mm/unit). 위 끝 り 838 → y≈2.0, 아래 끝 → y≈14.0
S = 0.0132
BASE_Y = 13.05
LAYOUT = {
    # char: (x_origin_mm, scale_mul, dy_mm)  — x_origin은 서체 원점(0)의 위치
    'と': (0.85, 1.03, 0.0),    # と는 シ 획이 많아 작아 보인다 → 3% 확대(광학 크기 보정)
    'な': (10.55, 0.985, 0.05),  # な는 획이 많고 넓어 무겁다 → 1.5% 축소
    'り': (19.75, 1.0, 0.0),
}

BR = dict(open_len=8.4, open_arm=4.0, close_len=8.4, close_arm=4.0, close_pad=3.55)
BR_W = 0.75  # 괄호 바깥 선 굵기(mm) — AD 1.2mm 단선에서 조정: 1.2 겹선은 30px에서 한 덩어리 막대로 읽힘(compare 변형 B)
BR_W2 = 0.75 # 괄호 안 선 굵기(mm) — 바깥과 같은 굵기의 고른 겹선
BR_GAP = 0.65 # 겹선 사이(mm) — 30px에서 1.2px, 두 줄이 붙지 않는 하한
H = 16.0


def contour_area(c):
    a = 0
    for i in range(len(c)):
        x1, y1 = c[i][0], c[i][1]
        x2, y2 = c[(i + 1) % len(c)][0], c[(i + 1) % len(c)][1]
        a += x1 * y2 - x2 * y1
    return a / 2


def apply_edits(glyphs, edits):
    out = {}
    for ch, cs in glyphs.items():
        cs = [[p[:] for p in c] for c in cs]
        drop = set()
        for op, ci, idx, val, _ in edits.get(ch, []):
            if op == 'drop':
                drop.add(ci)
            elif op == 'move':
                for i in idx:
                    cs[ci][i][0] += val[0]
                    cs[ci][i][1] += val[1]
            elif op == 'set':
                for i in idx:
                    cs[ci][i][0], cs[ci][i][1] = val
        out[ch] = [c for i, c in enumerate(cs) if i not in drop]
    return out


def fmt(v):
    s = f'{v:.3f}'.rstrip('0').rstrip('.')
    return '0' if s in ('-0', '') else s


def contour_to_d(c, tf):
    """TrueType 2차 윤곽 → SVG path(M/Q/L/Z), tf: (x,y)->(X,Y) mm."""
    n = len(c)
    # 시작 on점 찾기 (없으면 첫 두 off의 중점)
    start = next((i for i in range(n) if c[i][2]), None)
    pts = c[start:] + c[:start] if start is not None else c
    if start is None:
        m = [(pts[0][0] + pts[1][0]) / 2, (pts[0][1] + pts[1][1]) / 2, True]
        pts = [m] + pts
    P = lambda p: ' '.join(fmt(v) for v in tf(p[0], p[1]))
    d = [f'M{P(pts[0])}']
    i, n = 1, len(pts)
    seq = pts[1:] + [pts[0]]
    k = 0
    while k < len(seq):
        p = seq[k]
        if p[2]:
            d.append(f'L{P(p)}'); k += 1
        else:
            q = seq[k + 1] if k + 1 < len(seq) else pts[0]
            if q[2]:
                d.append(f'Q{P(p)} {P(q)}'); k += 2
            else:
                mid = [(p[0] + q[0]) / 2, (p[1] + q[1]) / 2, True]
                d.append(f'Q{P(p)} {P(mid)}'); k += 1
    d.append('Z')
    return ''.join(d)


def glyph_d(cs, x0, mul, dy):
    s = S * mul
    tf = lambda x, y: (x0 + x * s, BASE_Y + dy - y * s)
    return ''.join(contour_to_d(c, tf) for c in cs)


def glyph_bbox(cs, x0, mul, dy):
    s = S * mul
    xs = [x0 + p[0] * s for c in cs for p in c]
    ys = [BASE_Y + dy - p[1] * s for c in cs for p in c]
    return min(xs), min(ys), max(xs), max(ys)


def flatten(cs, x0, mul, dy, steps=12):
    """윤곽을 꺾은선으로 근사(간격 측정용)."""
    s = S * mul
    out = []
    for c in cs:
        n = len(c)
        start = next(i for i in range(n) if c[i][2])
        pts = c[start:] + c[:start] + [c[start]]
        poly, k = [(pts[0][0], pts[0][1])], 1
        while k < len(pts):
            p = pts[k]
            if p[2]:
                poly.append((p[0], p[1])); k += 1
            else:
                q = pts[k + 1]
                e = (q[0], q[1]) if q[2] else ((p[0] + q[0]) / 2, (p[1] + q[1]) / 2)
                a = poly[-1]
                for t in range(1, steps + 1):
                    u = t / steps
                    poly.append(((1-u)**2*a[0] + 2*(1-u)*u*p[0] + u*u*e[0], (1-u)**2*a[1] + 2*(1-u)*u*p[1] + u*u*e[1]))
                k += 2 if q[2] else 1
        out.extend((x0 + x * s, BASE_Y + dy - y * s) for x, y in poly)
    return out


def min_gap(a, b):
    import math
    return min(math.hypot(p[0]-q[0], p[1]-q[1]) for p in a[::2] for q in b[::2])


def rect_pts(x, y, w, h, n=40):
    return [(x + w * i / n, y) for i in range(n + 1)] + [(x + w * i / n, y + h) for i in range(n + 1)] + \
           [(x, y + h * i / n) for i in range(n + 1)] + [(x + w, y + h * i / n) for i in range(n + 1)]


def rect(x, y, w, h):
    return f'M{fmt(x)} {fmt(y)}h{fmt(w)}v{fmt(h)}h{fmt(-w)}Z'


def bracket_rects(x_open, x_close_right, open_len, open_arm, close_len, close_arm, weights=None):
    """괄호를 사각형(x, y, w, h) 목록으로. 『: 왼쪽 위 모서리 (x_open, 0). 』: 오른쪽 아래 모서리 (x_close_right, H).
    子持ち罫(굵은 선 + 가는 선) 겹선: 바깥 BR_W, 안 BR_W2, 사이 BR_GAP. 두 선의 끝은 가지런히(열린 끝)."""
    w, w2, g = weights or (BR_W, BR_W2, BR_GAP)
    x, y = x_open, 0.0
    o = [
        (x, y, w, open_len),                                   # 바깥 세로(굵게)
        (x + w, y, open_arm - w, w),                           # 바깥 가로(굵게)
        (x + w + g, y + w + g, w2, open_len - w - g),          # 안 세로(가늘게)
        (x + w + g + w2, y + w + g, open_arm - w - g - w2, w2),  # 안 가로(가늘게)
    ]
    xr, yb = x_close_right, H
    cl = [
        (xr - w, yb - close_len, w, close_len),
        (xr - close_arm, yb - w, close_arm - w, w),
        (xr - w - g - w2, yb - close_len, w2, close_len - w - g),
        (xr - close_arm, yb - w - g - w2, close_arm - w - g - w2, w2),
    ]
    return o, cl


def brackets(*a, **k):
    o, cl = bracket_rects(*a, **k)
    return ''.join(rect(*r) for r in o), ''.join(rect(*r) for r in cl)


def build(glyphs, layout):
    letters = {c: glyph_d(cs, *layout[c]) for c, cs in glyphs.items()}
    bb = {c: glyph_bbox(cs, *layout[c]) for c, cs in glyphs.items()}
    return letters, bb


def svg(letters, br, width, fg, br_col, title='となり'):
    o, cl = br
    return (f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {fmt(width)} {fmt(H)}" '
            f'width="{fmt(width)}mm" height="{fmt(H)}mm" role="img" aria-label="{title}">'
            f'<title>『{title}』</title>'
            f'<path fill="{br_col}" d="{o}"/>'
            f'<path fill="{fg}" d="{letters["と"]}{letters["な"]}{letters["り"]}"/>'
            f'<path fill="{br_col}" d="{cl}"/></svg>')


def main():
    fp = fetch(FONT_URL, FONT_FILE, FONT_SHA256)
    fetch(OFL_URL, OFL_FILE, OFL_SHA256)
    raw = load_glyphs(fp, 'となり『』')
    ed = apply_edits({c: raw[c] for c in 'となり'}, EDITS)

    # 수정본 배치
    letters, bb = build(ed, LAYOUT)
    width = bb['り'][2] + BR['close_pad']
    br = brackets(0.0, width, BR['open_len'], BR['open_arm'], BR['close_len'], BR['close_arm'])
    light = svg(letters, br, width, NIGHT, VERMILION)
    dark = svg(letters, br, width, SNOW, VERMILION)
    open(os.path.join(HERE, 'mast-light.svg'), 'w').write(light + '\n')
    open(os.path.join(HERE, 'mast-dark.svg'), 'w').write(dark + '\n')

    # 간격 실측(mm) — 손으로 자간을 잡을 때 보는 값
    fl = {c: flatten(ed[c], *LAYOUT[c]) for c in 'となり'}
    ro, rc = bracket_rects(0.0, width, BR['open_len'], BR['open_arm'], BR['close_len'], BR['close_arm'])
    ob = [p for r in ro for p in rect_pts(*r)]
    cb = [p for r in rc for p in rect_pts(*r)]
    gaps = {'『–と': min_gap(ob, fl['と']), 'と–な': min_gap(fl['と'], fl['な']),
            'な–り': min_gap(fl['な'], fl['り']), 'り–』': min_gap(fl['り'], cb)}

    # 비교용 '서체 그대로': 손 수정 없음, 괄호도 서체 글리프, 서체 palt 자간, 같은 em(13.2mm)
    pal = {'『': (-506, 497), 'と': (-203, 599), 'な': (-65, 863), 'り': (-198, 597), '』': (4, 497)}
    x, lay = 0.0, {}
    for c in '『となり』':
        lay[c] = (x + pal[c][0] * S, 1.0, 0.0)
        x += pal[c][1] * S
    x0 = -glyph_bbox(raw['『'], *lay['『'])[0]
    lay = {c: (v[0] + x0, v[1], v[2]) for c, v in lay.items()}
    rl, rbb = build(raw, lay)
    rwidth = rbb['』'][2]
    def raw_svg(fg):
        return (f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {fmt(rwidth)} {fmt(H)}">'
                f'<path fill="{VERMILION}" d="{rl["『"]}{rl["』"]}"/><path fill="{fg}" d="{rl["と"]}{rl["な"]}{rl["り"]}"/></svg>')

    # 겹쳐 보기(원본 윤곽선 + 수정본 면)
    overlay = (f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="-1 -1 {fmt(width + 2)} {fmt(H + 2)}">'
               f'<path fill="{VERMILION}" fill-opacity=".25" d="{br[0]}{br[1]}"/>'
               f'<path fill="{NIGHT}" fill-opacity=".16" d="{letters["と"]}{letters["な"]}{letters["り"]}"/>'
               + ''.join(f'<path fill="none" stroke="{VERMILION}" stroke-width=".06" d="{glyph_d(raw[c], *LAYOUT[c])}"/>' for c in 'となり')
               + f'<path fill="none" stroke="{NIGHT}" stroke-width=".05" d="{letters["と"]}{letters["な"]}{letters["り"]}"/></svg>')

    # 괄호 굵기 대안(같은 글자): AD 문자대로 1.2mm 겹선 / 1.2+0.6 子持ち罫 / 채택 0.75+0.75
    alts = []
    for name, wts in (('AD 지시 그대로: 1.2mm 선 두 줄(사이 0.8)', (1.2, 1.2, 0.8)),
                      ('子持ち罫: 1.2 + 0.6(사이 0.7)', (1.2, 0.6, 0.7)),
                      ('채택: 0.75 + 0.75(사이 0.65)', (BR_W, BR_W2, BR_GAP))):
        b = brackets(0.0, width, BR['open_len'], BR['open_arm'], BR['close_len'], BR['close_arm'], weights=wts)
        alts.append((name, svg(letters, b, width, NIGHT, VERMILION), svg(letters, b, width, SNOW, VERMILION)))

    write_compare(raw_svg(NIGHT), raw_svg(SNOW), rwidth, light, dark, width, overlay, gaps, alts)
    print(f'width {width:.2f}mm (서체 그대로 {rwidth:.2f}mm)', file=sys.stderr)
    print('bbox', {c: tuple(round(v, 2) for v in b) for c, b in bb.items()}, file=sys.stderr)
    print('gaps', {k: round(v, 2) for k, v in gaps.items()}, file=sys.stderr)


def write_compare(raw_light, raw_dark, rw, light, dark, w, overlay, gaps, alts):
    MM = 96 / 25.4  # CSS px per mm (실제 크기)
    PX30 = 390 / 210  # 390px 표지 축척: 1mm = 1.857px → 16mm ≈ 29.7px

    def cell(s, width_mm, scale, bg):
        return (f'<div class="cell" style="background:{bg}"><div style="width:{width_mm * scale:.2f}px;height:{H * scale:.2f}px">'
                f'{s.replace("<svg ", "<svg style=\"width:100%;height:100%;display:block\" ", 1)}</div></div>')

    def ctx(sv, width_mm, bg, fg):
        k = PX30
        sv = sv.replace("<svg ", "<svg style='width:100%;height:100%;display:block' ", 1)
        return (f'<div style="position:relative;width:390px;height:{297 * k:.0f}px;background:{bg};overflow:hidden">'
                f'<div style="position:absolute;left:{13 * k:.2f}px;top:{13 * k:.2f}px;width:{width_mm * k:.2f}px;height:{H * k:.2f}px">{sv}</div>'
                f'<div style="position:absolute;left:{13 * k:.2f}px;top:{33.5 * k:.2f}px;color:{fg};font:500 {5.6 * k:.1f}px/1 \'Zen Kaku Gothic New\',\'Noto Sans JP\',sans-serif;letter-spacing:.08em">一つの町　01</div>'
                f'<div style="position:absolute;left:{126 * k - 1.2 * k:.2f}px;top:{118 * k:.2f}px;width:{2.4 * k:.2f}px;bottom:0;background:{VERMILION}"></div></div>')

    rows = []
    for label, sz in (('16mm 실제 크기(96dpi 기준 60.5px)', MM), ('390px 표지 축척(16mm ≈ 29.7px)', PX30)):
        rows.append(f'<h2>{label}</h2><div class="grid">'
                    f'<figure>{cell(raw_light, rw, sz, SNOW)}<figcaption>서체 그대로 · 밝은 바탕</figcaption></figure>'
                    f'<figure>{cell(light, w, sz, SNOW)}<figcaption>수정본 · 밝은 바탕</figcaption></figure>'
                    f'<figure>{cell(raw_dark, rw, sz, NIGHT)}<figcaption>서체 그대로 · 어두운 바탕</figcaption></figure>'
                    f'<figure>{cell(dark, w, sz, NIGHT)}<figcaption>수정본 · 어두운 바탕</figcaption></figure></div>')
    html = f'''<!doctype html><html lang="ko"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1"><title>제호 비교</title>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Zen+Kaku+Gothic+New:wght@500&display=swap">
<style>
:root{{--bg:#f6f5f1;--fg:#151b2c;--mute:#5b6273}}
body{{margin:0;padding:24px 28px 40px;background:var(--bg);color:var(--fg);font:14px/1.5 system-ui,sans-serif}}
h1{{font-size:18px;margin:0 0 4px}} h2{{font-size:14px;margin:26px 0 10px;color:var(--mute);font-weight:600}}
p{{margin:0;color:var(--mute)}}
.grid{{display:grid;grid-template-columns:repeat(4,max-content);gap:14px 18px;align-items:end}}
figure{{margin:0}} figcaption{{font-size:12px;color:var(--mute);margin-top:6px}}
.cell{{padding:14px 16px;display:inline-block}}
.big{{background:#fff;padding:10px;width:{(w + 2) * 30:.0f}px}}
</style></head><body>
<h1>『となり』 제호 — 서체 그대로 vs 수정본</h1>
<p>출처 Shippori Mincho ExtraBold 3.110 (OFL-1.1) · 괄호 0.75mm 고른 겹선 직접 작도 · 글자 #151b2c / #eef0f4 · 괄호 #d4462a</p>
{''.join(rows)}
<p>간격 실측(가장 가까운 잉크 사이, mm): {' · '.join(f'{k} {v:.2f}' for k, v in gaps.items())} · 전체 폭 {w:.1f}mm</p>
<h2>괄호 굵기 대안 — 같은 글자, 390px 표지 축척과 16mm</h2>
<div class="grid" style="grid-template-columns:repeat(4,max-content)">{''.join(f'<figure>{cell(a, w, PX30, SNOW)}<figcaption>{n}</figcaption></figure><figure>{cell(d, w, PX30, NIGHT)}<figcaption>&nbsp;</figcaption></figure>' for n, a, d in alts)}</div>
<div class="grid" style="grid-template-columns:repeat(3,max-content);margin-top:10px">{''.join(f'<figure>{cell(a, w, MM, SNOW)}<figcaption>{n}</figcaption></figure>' for n, a, d in alts)}</div>
<h2>표지 맥락 — 390px 폭 표지 왼쪽 위 (13, 13)mm, 호 표기 (13, 33.5)mm</h2>
<div class="grid" style="grid-template-columns:repeat(2,max-content)">{ctx(light, w, SNOW, NIGHT)}{ctx(dark, w, NIGHT, SNOW)}</div>
<h2>겹쳐 보기 30배 — 주홍 선 = 서체 원래 윤곽, 남색 면 = 수정본(같은 배치)</h2>
<div class="big">{overlay.replace("<svg ", "<svg style=\"width:100%;display:block\" ", 1)}</div>
</body></html>'''
    open(os.path.join(HERE, 'compare.html'), 'w').write(html)


if __name__ == '__main__':
    main()
