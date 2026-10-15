#!/usr/bin/env python3
# 『となり』 브랜드 마크 패밀리 F4 손·붓 — 2026-10-15 KST
#
# 한 자루 붓(타원 붓끝, 고정 각도)과 한 벌의 운필 규칙(입필·止め·払い·はね·右上がり)으로
# TONARI · となり · トナリ 를 모두 직접 작도한다. 서체 윤곽은 쓰지 않는다(골격 비례만 Yuji Syuku·Klee One 참조).
#
# 사용(리포 루트):  python3 -I docs/japanology/magazine/brand/marks/families/F4-brush/build-f4.py
#                   → svg/*.svg, marks.json, card.html
#   그다음 card.png:  node docs/japanology/magazine/brand/marks/families/F4-brush/shoot-f4.cjs (Node 24, playwright)
# 의존: 표준 라이브러리만. 결정적(같은 입력 → 바이트 단위로 같은 산출물).
import hashlib, json, math, os, sys

HERE = os.path.dirname(os.path.abspath(__file__))
NIGHT, SNOW, VERMILION = '#151b2c', '#eef0f4', '#d4462a'

# ── 1. 붓 하나 ────────────────────────────────────────────────────────────────────────────
# 붓끝 자국 = 타원. 장축이 수평에서 NIB_DEG만큼 오른쪽 아래로 기운다(붓끝이 왼쪽 위를 향함).
# 세로획 굵기 V, 가로획 굵기 H 를 정하면 타원 반축 a,b 가 결정된다(필압 1.0 기준).
NIB_DEG = 25.0
V_STEM = 140.0      # 세로로 그은 획의 굵기(필압 1)
H_BAR = 86.0        # 가로로 그은 획의 굵기(필압 1)


def solve_nib(V, H, deg):
    s2, c2 = math.sin(math.radians(deg)) ** 2, math.cos(math.radians(deg)) ** 2
    v, h = (V / 2) ** 2, (H / 2) ** 2
    d = (v - h) / (c2 - s2)
    a2, b2 = ((v + h) + d) / 2, ((v + h) - d) / 2
    return math.sqrt(a2), math.sqrt(b2)


NIB_A, NIB_B = solve_nib(V_STEM, H_BAR, NIB_DEG)
_t = math.radians(-NIB_DEG)          # y 위쪽 좌표에서 오른쪽 아래
_ct, _st = math.cos(_t), math.sin(_t)
M0 = ((_ct * NIB_A, -_st * NIB_B), (_st * NIB_A, _ct * NIB_B))       # R(t)·diag(a,b)
_det = M0[0][0] * M0[1][1] - M0[0][1] * M0[1][0]
M0I = ((M0[1][1] / _det, -M0[0][1] / _det), (-M0[1][0] / _det, M0[0][0] / _det))


def mul(M, p):
    return (M[0][0] * p[0] + M[0][1] * p[1], M[1][0] * p[0] + M[1][1] * p[1])


# ── 2. 운필 규칙(모든 표기 공통) ────────────────────────────────────────────────────────────
RULE = {
    'entry_dir': (-1.0, 1.0),   # 입필: 붓은 언제나 왼쪽 위 45°에서 들어온다
    'entry_len': 30.0,          # 입필 접근 길이(단위)
    'entry_p': (0.78, 1.07),    # 입필 필압: 닿을 때 → 누를 때
    'press_relax': 0.16,        # 누른 뒤 본 필압(1.0)으로 돌아오는 구간(획 길이 비율)
    'tome_p': 1.05,             # 止め: 끝에서 살짝 다시 누름
    'waist': 0.94,              # 획 허리: 가운데서 필압이 살짝 빠짐
    'harai_from': 0.50,         # 払い: 획 길이의 이 지점부터 가늘어짐
    'harai_p': 0.10,            # 払い 끝 필압
    'rise_deg': 3.5,            # 右上がり: 가로획은 오른쪽으로 3.5° 오른다
}


# ── 3. 경로 ─────────────────────────────────────────────────────────────────────────────
def cubic(p0, p1, p2, p3, t):
    u = 1 - t
    return (u * u * u * p0[0] + 3 * u * u * t * p1[0] + 3 * u * t * t * p2[0] + t * t * t * p3[0],
            u * u * u * p0[1] + 3 * u * u * t * p1[1] + 3 * u * t * t * p2[1] + t * t * t * p3[1])


def path_points(segs, n=40):
    """segs: [p0, c1, c2, p1, c1, c2, p2, ...] 연속 3차 베지어(직선은 c를 선분 위에)."""
    pts = [segs[0]]
    for i in range(0, len(segs) - 1, 3):
        for k in range(1, n + 1):
            pts.append(cubic(segs[i], segs[i + 1], segs[i + 2], segs[i + 3], k / n))
    return resample(pts, 3.0)


def line(p0, p1):
    return [p0, (p0[0] + (p1[0] - p0[0]) / 3, p0[1] + (p1[1] - p0[1]) / 3),
            (p0[0] + 2 * (p1[0] - p0[0]) / 3, p0[1] + 2 * (p1[1] - p0[1]) / 3), p1]


def resample(pts, step):
    L = [0.0]
    for i in range(1, len(pts)):
        L.append(L[-1] + math.dist(pts[i - 1], pts[i]))
    tot = L[-1]
    n = max(8, int(math.ceil(tot / step)))
    out, j = [], 0
    for k in range(n + 1):
        s = tot * k / n
        while j < len(L) - 2 and L[j + 1] < s:
            j += 1
        seg = L[j + 1] - L[j] or 1e-9
        f = (s - L[j]) / seg
        out.append((pts[j][0] + (pts[j + 1][0] - pts[j][0]) * f, pts[j][1] + (pts[j + 1][1] - pts[j][1]) * f))
    return out


def smooth(a, b, f):
    f = max(0.0, min(1.0, f))
    f = f * f * (3 - 2 * f)
    return a + (b - a) * f


def pressure(keys, u):
    if u <= keys[0][0]:
        return keys[0][1]
    for (u0, p0), (u1, p1) in zip(keys, keys[1:]):
        if u <= u1:
            return smooth(p0, p1, (u - u0) / ((u1 - u0) or 1e-9))
    return keys[-1][1]


# ── 4. 획 → 윤곽(붓끝 타원이 지나간 자리의 정확한 포락선) ──────────────────────────────────────
# 타원 붓은 선형 변환 M0 아래에서 원이다. 원 가족(중심 C, 반경 p)의 포락선을 구해 M0로 되돌린다.
def sweep(pts, ps):
    C = [mul(M0I, p) for p in pts]
    n = len(C)
    L, R = [], []
    for i in range(n):
        a, b = max(0, i - 1), min(n - 1, i + 1)
        dx, dy = C[b][0] - C[a][0], C[b][1] - C[a][1]
        dl = math.hypot(dx, dy) or 1e-9
        k = (ps[b] - ps[a]) / dl
        k = max(-0.97, min(0.97, k))
        tx, ty = dx / dl, dy / dl
        nx, ny = -ty, tx
        q = math.sqrt(1 - k * k)
        r = ps[i]
        L.append((C[i][0] + r * (-k * tx + q * nx), C[i][1] + r * (-k * ty + q * ny)))
        R.append((C[i][0] + r * (-k * tx - q * nx), C[i][1] + r * (-k * ty - q * ny)))

    def cap(c, r, p_from, p_to, via):
        a0 = math.atan2(p_from[1] - c[1], p_from[0] - c[0])
        a1 = math.atan2(p_to[1] - c[1], p_to[0] - c[0])
        av = math.atan2(via[1], via[0])
        # a0 → a1 을 via 방향을 지나는 쪽으로
        def norm(x):
            while x < 0:
                x += 2 * math.pi
            while x >= 2 * math.pi:
                x -= 2 * math.pi
            return x
        ccw = norm(a1 - a0)
        go_ccw = norm(av - a0) <= ccw
        span = ccw if go_ccw else -(2 * math.pi - ccw)
        m = max(6, int(abs(span) * r / 3))
        return [(c[0] + r * math.cos(a0 + span * j / m), c[1] + r * math.sin(a0 + span * j / m)) for j in range(1, m)]

    t0 = (C[1][0] - C[0][0], C[1][1] - C[0][1])
    t1 = (C[-1][0] - C[-2][0], C[-1][1] - C[-2][1])
    poly = L + cap(C[-1], ps[-1], L[-1], R[-1], t1) + R[::-1] + cap(C[0], ps[0], R[0], L[0], (-t0[0], -t0[1]))
    poly = [mul(M0, p) for p in poly]
    return orient(poly)


def area(poly):
    return sum(poly[i][0] * poly[(i + 1) % len(poly)][1] - poly[(i + 1) % len(poly)][0] * poly[i][1] for i in range(len(poly))) / 2


def orient(poly):
    return poly if area(poly) > 0 else poly[::-1]


def rdp(pts, eps):
    if len(pts) < 3:
        return pts
    a, b = pts[0], pts[-1]
    dx, dy = b[0] - a[0], b[1] - a[1]
    dl = math.hypot(dx, dy) or 1e-9
    imax, dmax = 0, 0.0
    for i in range(1, len(pts) - 1):
        d = abs(dy * (pts[i][0] - a[0]) - dx * (pts[i][1] - a[1])) / dl
        if d > dmax:
            imax, dmax = i, d
    if dmax <= eps:
        return [a, b]
    return rdp(pts[:imax + 1], eps)[:-1] + rdp(pts[imax:], eps)


def rdp_closed(poly, eps):
    k = max(range(len(poly)), key=lambda i: math.dist(poly[0], poly[i]))
    return rdp(poly[:k + 1], eps)[:-1] + rdp(poly[k:] + [poly[0]], eps)[:-1]


# ── 5. 획 정의 ──────────────────────────────────────────────────────────────────────────
def stroke(segs, end='tome', entry=True, keys=None, p_start=None, accent=False, hane=None):
    """segs: 3차 베지어 사슬. end: 'tome' | 'harai' | 'none' | 'press'(右払い: 눌렀다가 납작하게).
    entry: 입필(왼쪽 위 45°에서 접근해 누름). hane: (dx, dy) — 끝에서 튕겨 올리는 방향."""
    return {'segs': segs, 'end': end, 'entry': entry, 'keys': keys, 'p_start': p_start, 'accent': accent, 'hane': hane}


def render_stroke(st, scale=1.0):
    pts = path_points([(x * scale, y * scale) for x, y in st['segs']])
    tot = sum(math.dist(pts[i - 1], pts[i]) for i in range(1, len(pts)))
    keys = []
    if st['keys']:
        keys = list(st['keys'])
    else:
        p0 = RULE['entry_p'][1] if st['entry'] else (st['p_start'] if st['p_start'] is not None else 0.7)
        relax = min(0.4, RULE['press_relax'] * 380 / max(tot, 1))
        keys = [(0.0, p0), (relax, 1.0)]
        if st['end'] == 'tome':
            keys += [(0.5, RULE['waist']), (0.86, 0.99), (1.0, RULE['tome_p'])]
        elif st['end'] == 'harai':
            keys += [(RULE['harai_from'], 1.0), (1.0, RULE['harai_p'])]
        elif st['end'] == 'press':
            keys += [(0.5, 0.92), (0.84, 1.12), (1.0, 0.82)]
        else:
            keys += [(0.5, RULE['waist']), (1.0, 1.0)]
    L = [0.0]
    for i in range(1, len(pts)):
        L.append(L[-1] + math.dist(pts[i - 1], pts[i]))
    ps = [pressure(keys, l / (L[-1] or 1)) for l in L]
    polys = [sweep(pts, ps)]
    if st['entry']:
        d = RULE['entry_dir']; dl = math.hypot(*d)
        el = RULE['entry_len']
        q = (pts[0][0] + d[0] / dl * el, pts[0][1] + d[1] / dl * el)
        epts = resample([q, pts[0]], 2.0)
        eps = [smooth(RULE['entry_p'][0], ps[0], i / (len(epts) - 1)) for i in range(len(epts))]
        polys.append(sweep(epts, eps))
    if st['hane']:
        hx, hy = st['hane']
        e = pts[-1]
        tip = (e[0] + hx, e[1] + hy)
        tx, ty = pts[-1][0] - pts[-4][0], pts[-1][1] - pts[-4][1]
        tl = math.hypot(tx, ty) or 1
        c1 = (e[0] + tx / tl * 30, e[1] + ty / tl * 30)          # 진행 방향으로 조금 더 누르고
        c2 = (tip[0] - hx * 0.55, tip[1] - hy * 0.55)            # 튕겨 올림
        hp = path_points([e, c1, c2, tip])
        hps = [smooth(ps[-1], 0.08, i / (len(hp) - 1)) for i in range(len(hp))]
        polys.append(sweep(hp, hps))
    return [rdp_closed(p, 0.12) for p in polys]


# ── 6. 글자 골격(단위: 1000, y 위쪽, 기준선 0) ───────────────────────────────────────────────
# 라틴 대문자 높이 700. 가나 잉크는 대략 −90…790. 골격 비례는 Yuji Syuku·Klee One 을 보고 손으로 잡았다(윤곽 복제 없음).
def rise(p, dx):
    """右上がり: p에서 dx만큼 오른쪽으로 갈 때 RULE rise_deg 만큼 오른 점."""
    return (p[0] + dx, p[1] + dx * math.tan(math.radians(RULE['rise_deg'])))


def S(*pts):
    return list(pts)


def K(*kv):
    return list(kv)


STEM = S((70, 690), (66, 460), (72, 230), (76, 0))          # 라틴 세로획: 살짝 휜 한 획(입필·止め)
GLYPHS = {}

# T — 가로(입필·右上がり·止め) + 세로(가로 밑에서 시작, 止め)
_tl = (40, 678)
GLYPHS['T'] = [
    stroke(line(_tl, rise(_tl, 600)), 'tome'),
    stroke(S((330, 690), (326, 460), (334, 230), (340, 0)), 'tome', entry=False, p_start=1.0),
]
# O — 한 붓 고리: 위에서 반시계로 돌아 출발점으로 돌아온다(닫힌 고리는 입필 매듭을 숨긴다 — 유일한 예외)
GLYPHS['O'] = [
    stroke(S((345, 711), (170, 711), (40, 540), (40, 350),
             (40, 140), (170, -12), (340, -12),
             (520, -12), (640, 140), (640, 360),
             (640, 560), (520, 712), (380, 712),
             (345, 711), (312, 704), (270, 696)), 'none', entry=False,
           keys=K((0, 0.98), (0.45, RULE['waist']), (0.93, 0.97), (1.0, 0.6))),
]
# N — 왼 세로 · 사선(왼 세로 머리에서 출발, 끝은 오른 세로 발에 녹음) · 오른 세로
GLYPHS['N'] = [
    stroke(STEM, 'tome'),
    stroke(S((80, 688), (250, 460), (420, 230), (585, 0)), 'none', entry=False, p_start=1.0),
    stroke(S((592, 690), (596, 460), (592, 230), (590, 0)), 'tome'),
]
# A — 왼 다리 = ノ(払い) · 오른 다리 = 右払い(누름) · 가로대 = 점 한 번(주홍, 오른 다리에서 떨어짐)
GLYPHS['A'] = [
    stroke(S((345, 720), (300, 520), (180, 200), (20, 0)), 'harai'),
    stroke(S((352, 712), (440, 470), (540, 220), (680, 0)), 'press', entry=False, p_start=0.85),
    stroke(line((232, 236), rise((232, 236), 175)), 'tome', accent=True),
]
# R — 세로 · 고리(세로 머리에서 출발해 세로로 돌아옴) · 다리 = 右払い
GLYPHS['R'] = [
    stroke(STEM, 'tome'),
    stroke(S((82, 692), (330, 708), (555, 700), (555, 530),
             (555, 385), (330, 365), (90, 375)), 'none', entry=False, p_start=1.0),
    stroke(S((290, 378), (380, 260), (470, 120), (600, 0)), 'press', entry=False, p_start=0.9),
]
GLYPHS['I'] = [stroke(STEM, 'tome')]

# と — 짧은 첫 획 · 둘째 획(오른쪽 위 입필 → 왼쪽 아래로 감아 → 바닥 가로 止め)
GLYPHS['と'] = [
    stroke(S((300, 690), (320, 610), (345, 540), (370, 470)), 'tome'),
    stroke(S((730, 600), (530, 530), (310, 420), (295, 250),
             (285, 80), (420, 55), (560, 55),
             (650, 55), (720, 58), (780, 66)), 'tome'),
]
# な — 가로 · ノ(払い) · 점(주홍) · 세로 → 고리 → 오른쪽 아래로 맺음
GLYPHS['な'] = [
    stroke(line((110, 560), rise((110, 560), 380)), 'tome'),
    stroke(S((400, 760), (370, 600), (300, 420), (205, 240)), 'harai'),
    stroke(S((615, 505), (645, 485), (672, 462), (700, 428)), 'tome', accent=True),
    stroke(S((560, 420), (568, 320), (566, 200), (562, 130)), 'none'),
    stroke(S((562, 160), (562, 30), (500, -60), (400, -60),
             (290, -60), (240, 40), (300, 130),
             (360, 210), (540, 200), (640, 130),
             (700, 90), (750, 50), (800, 5)), 'tome', entry=False,
           keys=K((0, 1.0), (0.25, 0.86), (0.55, 0.80), (0.8, 0.92), (1.0, RULE['tome_p']))),
]
# り — 왼 획(はね) · 오른 획(왼 획의 はね를 이어받아 가늘게 시작 → 아치 → 払い)
GLYPHS['り'] = [
    stroke(S((300, 690), (282, 540), (276, 400), (296, 290)), 'none', hane=(100, 115)),
    stroke(S((455, 545), (520, 650), (600, 700), (660, 670),
             (720, 630), (705, 420), (690, 260),
             (660, 80), (570, 0), (440, -70)), 'harai', entry=False,
           keys=K((0, 0.3), (0.16, 0.85), (0.28, 1.0), (0.55, 0.95), (1.0, RULE['harai_p']))),
]
# ト — 세로(입필·止め) · 짧은 획(주홍, 세로 오른쪽에서 출발)
GLYPHS['ト'] = [
    stroke(S((390, 760), (392, 480), (398, 230), (402, -40)), 'tome'),
    stroke(S((425, 450), (530, 418), (620, 380), (700, 325)), 'tome', entry=False, p_start=0.9, accent=True),
]
# ナ — 가로(右上がり) · 세로 → 왼쪽 아래 払い
GLYPHS['ナ'] = [
    stroke(line((90, 420), rise((90, 420), 800)), 'tome'),
    stroke(S((540, 760), (545, 560), (545, 420), (520, 300),
             (480, 120), (380, 20), (240, -60)), 'harai'),
]
# リ — 짧은 왼 세로(止め) · 긴 오른 획(払い)
GLYPHS['リ'] = [
    stroke(S((285, 640), (280, 520), (284, 400), (292, 260)), 'tome'),
    stroke(S((650, 740), (655, 520), (660, 300), (620, 160),
             (580, 30), (480, -40), (360, -90)), 'harai'),
]


# 가나 골격 배율: 붓(굵기)은 그대로 두고 골격만 줄여, 가나 몸(払い 꼬리 제외) 높이 ≈ 대문자 높이 × 1.04 가 되게 한다.
KANA_SCALE = 0.92


def glyph_polys(ch):
    ink, acc = [], []
    sc = 1.0 if ch.isascii() else KANA_SCALE
    for st in GLYPHS[ch]:
        (acc if st['accent'] else ink).extend(render_stroke(st, sc))
    return ink, acc


def bbox(polys):
    xs = [p[0] for c in polys for p in c]; ys = [p[1] for c in polys for p in c]
    return min(xs), min(ys), max(xs), max(ys)


# ── 7. 조판 ─────────────────────────────────────────────────────────────────────────────
GAP = V_STEM * 0.62          # 잉크 사이 = 세로획 굵기 × 0.62
KERN = {('T', 'O'): -40, ('O', 'N'): -14, ('N', 'A'): -36, ('A', 'R'): -24, ('R', 'I'): 0,
        ('と', 'な'): 0, ('な', 'り'): 0, ('ト', 'ナ'): 0, ('ナ', 'リ'): 0}


def compose(word):
    out_ink, out_acc, x = [], [], 0.0
    prev = None
    for ch in word:
        ink, acc = glyph_polys(ch)
        x0, _, x1, _ = bbox(ink + acc)
        if prev is not None:
            x += GAP + KERN.get((prev, ch), 0)
        dx = x - x0
        out_ink += [[(p[0] + dx, p[1]) for p in c] for c in ink]
        out_acc += [[(p[0] + dx, p[1]) for p in c] for c in acc]
        x += x1 - x0
        prev = ch
    return out_ink, out_acc


def fmt(v):
    s = f'{v:.1f}'
    return '0' if s in ('-0.0', '0.0') else s.rstrip('0').rstrip('.')


def d_of(polys, ox, oy):
    return ''.join('M' + 'L'.join(f'{fmt(p[0] - ox)} {fmt(oy - p[1])}' for p in c) + 'Z' for c in polys)


def svg(word, ink_col, acc_col=VERMILION, pad=24):
    ink, acc = compose(word)
    x0, y0, x1, y1 = bbox(ink + acc)
    W, H = x1 - x0 + 2 * pad, y1 - y0 + 2 * pad
    ox, oy = x0 - pad, y1 + pad
    body = ''
    if acc:
        body += f'<path fill="{acc_col}" d="{d_of(acc, ox, oy)}"/>'
    body += f'<path fill="{ink_col}" d="{d_of(ink, ox, oy)}"/>'
    return (f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {fmt(W)} {fmt(H)}" width="{fmt(W)}" height="{fmt(H)}">'
            f'{body}</svg>\n'), {'w': W, 'h': H, 'ink_h': y1 - y0, 'base_from_top': oy}


MARKS = [('F4-up', 'TONARI', '우산 · 국제'), ('F4-hira', 'となり', '일본 시리즈'), ('F4-kata', 'トナリ', '하이브리드 · 경계')]


def measure():
    """가족 원리 실측(기준선 위 높이끼리 비교): I 잉크 꼭대기, 가나 잉크 꼭대기 평균, 가나 払い 꼬리 깊이."""
    cap = bbox(glyph_polys('I')[0])
    cap_h = cap[3]                      # 기준선 → I 잉크 꼭대기(입필 매듭 포함)
    kana = [bbox(sum(glyph_polys(c), [])) for c in 'となりトナリ']
    body = sum(k[3] for k in kana) / len(kana)
    tail = min(k[1] for k in kana)
    return {'cap_ink_h': round(cap_h, 1), 'kana_body_h_avg': round(body, 1),
            'kana_body_over_cap': round(body / cap_h, 3), 'kana_tail_depth': round(-tail, 1)}


# ── 8. 카드(card.html → card.png) ──────────────────────────────────────────────────────────
DEMO = [  # 같은 규칙의 라틴·가나 짝: (라틴 글자, 획 번호, 가나 글자, 획 번호, 설명)
    ('T', 0, 'ナ', 0, '가로 — 입필 45° · 右上がり 3.5° · 止め'),
    ('A', 0, 'ナ', 1, 'ノ 払い — 굵게 들어가 끝 필압 0.10'),
    ('R', 2, 'な', 4, '오른쪽 아래로 맺는 획 — 다시 눌렀다 뗌'),
    ('I', 0, 'ト', 0, '세로 — 입필 · 허리 0.94 · 止め 1.05'),
]


def demo_svg(ch, hi):
    sc = 1.0 if ch.isascii() else KANA_SCALE
    a, b = [], []
    for i, st in enumerate(GLYPHS[ch]):
        (a if i == hi else b).extend(render_stroke(st, sc))
    x0, y0, x1, y1 = bbox(a + b)
    pad = 20
    ox, oy = x0 - pad, 800 + pad
    W, H = x1 - x0 + 2 * pad, 800 + 120 + 2 * pad
    return (f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {fmt(W)} {fmt(H)}" style="height:92px">'
            f'<path fill="#b9bfcc" d="{d_of(b, ox, oy)}"/><path fill="{NIGHT}" d="{d_of(a, ox, oy)}"/></svg>')


def write_card(info, rule_m):
    k = 430 / info['F4-up']['w']          # 세 마크 같은 배율: TONARI 폭 430px 기준
    css = """
body{margin:0;background:#d9dce4;font-family:system-ui,sans-serif;color:#151b2c;width:1500px}
.wrap{padding:40px 40px 48px}
h1{font-size:30px;margin:0 0 6px;letter-spacing:.01em} .sub{margin:0 0 6px;font-size:17px}
.prin{margin:14px 0 22px;padding:10px 14px;border-left:4px solid #d4462a;background:#eef0f4;font-size:14px;line-height:1.65}
.row{display:grid;grid-template-columns:repeat(3,1fr);gap:12px;margin-bottom:12px}
.cell{height:230px;display:flex;align-items:center;justify-content:center;position:relative}
.light{background:#eef0f4} .dark{background:#151b2c}
.tag{position:absolute;left:12px;top:10px;font-size:12px;font-weight:600;padding:2px 7px;background:#151b2c;color:#eef0f4}
.dark .tag{background:#eef0f4;color:#151b2c}
h2{font-size:16px;margin:26px 0 10px}
.pairs{display:grid;grid-template-columns:repeat(4,1fr);gap:12px}
.pair{background:#eef0f4;padding:12px 14px 10px;display:flex;flex-direction:column;align-items:center}
.pair .g{display:flex;gap:18px;align-items:flex-end} .pair p{font-size:12px;margin:8px 0 0;color:#4a5163;text-align:center}
.hdrs{display:grid;grid-template-columns:repeat(2,1fr);gap:8px;max-width:1000px}
.hdr{height:48px;display:flex;align-items:center;justify-content:space-between;padding:0 16px}
.nav{font-size:12px;color:#5b6274} .hdr.dark .nav{color:#aab0bf}
.covs{display:flex;gap:18px;align-items:flex-start} .cov p{font-size:12px;margin:4px 0 0;color:#4a5163}
.cv{width:390px;padding:26px 0;display:flex;align-items:center;justify-content:center;margin-bottom:6px}
"""
    r = info['_rule']
    prin = (f"원리(단위: 대문자 높이 700) · 붓 하나 = 타원 붓끝 {r['nib_a']:.1f}×{r['nib_b']:.1f}, 장축 {NIB_DEG:g}° 기울임 → "
            f"세로획 {V_STEM:g} · 가로획 {H_BAR:g}(0.61) · 입필 = 왼쪽 위 45°에서 {RULE['entry_len']:g} 접근해 필압 {RULE['entry_p'][1]} · "
            f"허리 {RULE['waist']} · 止め {RULE['tome_p']} · 払い 끝 {RULE['harai_p']} · 가로획 右上がり {RULE['rise_deg']}° · "
            f"가나 골격 ×{KANA_SCALE}(붓은 그대로) → 가나 잉크 꼭대기 = I 잉크 꼭대기×{rule_m['kana_body_over_cap']}(払い 꼬리는 기준선 아래 {rule_m['kana_tail_depth']:g}) · 잉크 사이 = 세로획×0.62 · "
            f"주홍 = 붓 점 한 번(A 가로대 · な 셋째 점 · ト 짧은 획)")
    h = ['<!doctype html><html lang="ko"><head><meta charset="utf-8"><title>F4 손·붓</title>',
         f'<style>{css}</style></head><body><div class="wrap">',
         '<h1>F4 손·붓</h1>',
         '<p class="sub">한 자루 붓과 한 벌의 운필 규칙(입필·止め·払い·右上がり)으로 라틴과 가나를 같은 손이 쓴 듯 직접 작도한 따뜻한 가족 — 주홍은 붓 점 하나.</p>',
         f'<div class="prin">{prin}</div>']
    for mode in ('light', 'dark'):
        h.append('<div class="row">')
        for name, word, tag in MARKS:
            hh = info[name]['h'] * k
            h.append(f'<div class="cell {mode}"><span class="tag">{tag}</span>'
                     f'<img src="svg/{name}-{mode}.svg" style="height:{hh:.1f}px" alt="{word}"></div>')
        h.append('</div>')
    h.append('<h2>같은 획, 같은 규칙 — 라틴 획과 가나 획을 같은 붓·같은 필압 곡선으로 그렸다(진한 획)</h2><div class="pairs">')
    for lc, li, kc, ki, cap in DEMO:
        h.append(f'<div class="pair"><div class="g">{demo_svg(lc, li)}{demo_svg(kc, ki)}</div><p>{lc} · {kc} — {cap}</p></div>')
    h.append('</div>')
    h.append('<h2>웹 헤더 — 마크 높이 24px(1:1)</h2><div class="hdrs">')
    for name, word, tag in MARKS:
        for mode in ('light', 'dark'):
            h.append(f'<div class="hdr {mode}"><img src="svg/{name}-{mode}.svg" style="height:24px" alt="{word}">'
                     f'<span class="nav">（ダミー）見出し</span></div>')
    h.append('</div><h2>표지 제호 크기 — 폭 312px(390px 표지의 80%)</h2><div class="covs">')
    for name, word, tag in MARKS:
        hh = 312 * info[name]['h'] / info[name]['w']
        h.append('<div class="cov">')
        for mode in ('light', 'dark'):
            h.append(f'<div class="cv {mode}"><img src="svg/{name}-{mode}.svg" style="width:312px" alt="{word}"></div>')
        h.append(f'<p>표지 제호 폭 80%(390px 표지 312×{hh:.1f}px)</p></div>')
    h.append('</div></div></body></html>\n')
    open(os.path.join(HERE, 'card.html'), 'w').write(''.join(h))


def main():
    os.makedirs(os.path.join(HERE, 'svg'), exist_ok=True)
    info = {}
    for name, word, _ in MARKS:
        for mode, col in (('light', NIGHT), ('dark', SNOW)):
            s, m = svg(word, col)
            p = os.path.join(HERE, 'svg', f'{name}-{mode}.svg')
            open(p, 'w').write(s)
            info.setdefault(name, {'word': word, **{k: round(v, 1) for k, v in m.items()}})
            info[name]['sha256-' + mode] = hashlib.sha256(s.encode()).hexdigest()
    rule_m = measure()
    info['_rule'] = {'nib_deg': NIB_DEG, 'nib_a': round(NIB_A, 2), 'nib_b': round(NIB_B, 2), 'V': V_STEM, 'H': H_BAR,
                     'gap': round(GAP, 1), 'kana_scale': KANA_SCALE, **{k: v for k, v in RULE.items()}, **rule_m}
    open(os.path.join(HERE, 'marks.json'), 'w').write(json.dumps(info, ensure_ascii=False, indent=1) + '\n')
    write_card(info, rule_m)
    print(json.dumps(info['_rule'], ensure_ascii=False))


if __name__ == '__main__':
    main()
