#!/usr/bin/env python3
"""F5 기하·모더니즘 패밀리 — TONARI · となり · トナリ 를 서체 없이 직접 작도한다.

모든 글자는 한 격자에서 나온다(단위 u):
  - 획 굵기 W = 1u, 끝은 모두 획 방향에 직각으로 자른다(butt).
  - 글자 높이 H = 5u(대문자·가나 같은 5u 칸).
  - 곡선은 원호뿐이다. 중심선 반지름은 R_BIG(=2u, O의 바깥 지름 5u = H) ·
    R_MID(=1.5u) · R_SMALL(=1u, 최소 속공간 1u) 세 가지만 쓴다.
  - 사선은 획 직각 두께가 W가 되도록 수평 폭을 계산한 평행사변형이다.
  - 자간(잉크 사이) = 1u 기본, 표의 예외만 숫자로 둔다.
  - 주홍 = 지름 1u 원 하나(격자 단위 그 자체). 각 마크 끝 기준선 위, 마침표(。/.) 자리.

재생성(리포 루트):  python3 -I docs/japanology/magazine/brand/marks/families/F5-geometric/build-f5.py
외부 의존 없음(표준 라이브러리만). 같은 입력이면 같은 바이트를 낸다.
"""
import hashlib
import math
import os

HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(HERE, 'svg')

# ── 작도 파라미터(가족 원리) ────────────────────────────────────────────────
U = 20.0            # SVG 단위/1u
W = 1.0             # 획 굵기(u)
H = 5.0             # 글자 높이(u)
R_BIG = 2.0         # 큰 원호 중심선 반지름 → 바깥 지름 5u = H
R_MID = 1.5         # 중간 원호
R_SMALL = 1.0       # 작은 원호 → 속공간 지름 1u(최소 속공간 = W)
GAP = 1.0           # 기본 자간(잉크 사이)
DOT = 1.0           # 주홍 점 지름 = W
DOT_GAP = 1.0       # 마지막 잉크 → 주홍 점 사이
KANA_SLANT = 22.0   # ト 짧은 획·な 점 획의 기울기(도, 수평에서 아래로)
TO_HEADING = 150.0  # と 사선 진행각(수평에서 30° 아래로, 왼쪽으로)
TO_TOP = 0.5        # と 사선 시작 중심선 y
NA_LOOP_X = 3.3     # な 고리 중심 x(사선 끝과 0.6u 이상 떨어짐)
NA_STEM_TOP = 0.95  # な 수직 위 끝(가로획 윗변 0.85 바로 아래)
NA_TAIL = 2.0       # な 꼬리 길이(고리 중심에서)
NA_DOT_GAP = 0.5    # な 점 획 ↔ 수직 사이(24px 헤더에서 2px 이상 틈)
TAIL_SWEEP = 62.0   # ナ·リ·り 끝 원호 회전각

NIGHT = '#151b2c'
SNOW = '#eef0f4'
VERMILION = '#d4462a'


# ── 기하 도구 ───────────────────────────────────────────────────────────────
def nrm(th):
    """진행 방향 th(도, y 아래)에 대한 법선(-sin, cos)."""
    r = math.radians(th)
    return (-math.sin(r), math.cos(r))


def fwd(th):
    r = math.radians(th)
    return (math.cos(r), math.sin(r))


def add(p, v, k=1.0):
    return (p[0] + v[0] * k, p[1] + v[1] * k)


class Contour:
    """닫힌 윤곽. edges: ('L', p0, p1) | ('A', p0, p1, r, c, a0, a1)  (a: 중심 기준 극각, 도)."""

    def __init__(self, edges):
        self.edges = edges

    def sample(self):
        pts = []
        for e in self.edges:
            if e[0] == 'L':
                pts.append(e[1])
            else:
                _, p0, p1, r, c, a0, a1 = e
                n = max(4, int(abs(a1 - a0) / 3))
                for i in range(n):
                    a = math.radians(a0 + (a1 - a0) * i / n)
                    pts.append((c[0] + r * math.cos(a), c[1] + r * math.sin(a)))
        return pts

    def area(self):
        p = self.sample()
        return 0.5 * sum(p[i][0] * p[(i + 1) % len(p)][1] - p[(i + 1) % len(p)][0] * p[i][1]
                         for i in range(len(p)))

    def reversed(self):
        out = []
        for e in reversed(self.edges):
            if e[0] == 'L':
                out.append(('L', e[2], e[1]))
            else:
                _, p0, p1, r, c, a0, a1 = e
                out.append(('A', p1, p0, r, c, a1, a0))
        return Contour(out)

    def bbox(self):
        p = self.sample()
        # 원호 극값 보강
        for e in self.edges:
            if e[0] == 'A':
                _, p0, p1, r, c, a0, a1 = e
                lo, hi = min(a0, a1), max(a0, a1)
                k = math.ceil(lo / 90.0)
                while k * 90 <= hi:
                    a = math.radians(k * 90)
                    p.append((c[0] + r * math.cos(a), c[1] + r * math.sin(a)))
                    k += 1
        xs = [q[0] for q in p]
        ys = [q[1] for q in p]
        return min(xs), min(ys), max(xs), max(ys)

    def shifted(self, dx):
        out = []
        for e in self.edges:
            if e[0] == 'L':
                out.append(('L', (e[1][0] + dx, e[1][1]), (e[2][0] + dx, e[2][1])))
            else:
                _, p0, p1, r, c, a0, a1 = e
                out.append(('A', (p0[0] + dx, p0[1]), (p1[0] + dx, p1[1]), r, (c[0] + dx, c[1]), a0, a1))
        return Contour(out)

    def d(self, s=U, ox=0.0, oy=0.0):
        def f(v):
            t = ('%.3f' % v).rstrip('0').rstrip('.')
            return '0' if t in ('-0', '') else t

        def P(p):
            return f((p[0] - ox) * s) + ' ' + f((p[1] - oy) * s)
        out = ['M' + P(self.edges[0][1])]
        for e in self.edges:
            if e[0] == 'L':
                out.append('L' + P(e[2]))
            else:
                _, p0, p1, r, c, a0, a1 = e
                large = 1 if abs(a1 - a0) > 180 else 0
                sweep = 1 if a1 > a0 else 0
                out.append('A%s %s 0 %d %d %s' % (f(r * s), f(r * s), large, sweep, P(p1)))
        return ''.join(out) + 'Z'


def polar(c, p):
    return math.degrees(math.atan2(p[1] - c[1], p[0] - c[0]))


def stroke(start, heading, segs, w=W):
    """거북이 작도: 중심선(직선 'L' 길이 / 원호 'A' 반지름·회전각)을 ±w/2 평행 이동해 윤곽을 만든다.
    회전각 + 는 진행 방향 각이 커지는 쪽(y 아래 좌표에서 화면상 시계 방향)."""
    h = w / 2.0
    nodes = [(start, heading)]
    p, th = start, heading
    arcs = []
    for s in segs:
        if s[0] == 'L':
            p = add(p, fwd(th), s[1])
            arcs.append(None)
        else:
            _, r, sw = s
            sg = 1 if sw > 0 else -1
            c = add(p, nrm(th), sg * r)
            a0 = polar(c, p)
            th = th + sw
            a1 = a0 + sw
            p = (c[0] + r * math.cos(math.radians(a1)), c[1] + r * math.sin(math.radians(a1)))
            arcs.append((c, a0, a1, r))
        nodes.append((p, th))

    def side(sd):
        pts = [add(q, nrm(t), sd * h) for q, t in nodes]
        edges = []
        for i, a in enumerate(arcs):
            if a is None:
                edges.append(('L', pts[i], pts[i + 1]))
            else:
                c, a0, a1, r = a
                q0, q1 = pts[i], pts[i + 1]
                rr = math.hypot(q0[0] - c[0], q0[1] - c[1])
                edges.append(('A', q0, q1, rr, c, polar(c, q0), polar(c, q0) + (a1 - a0)))
        return pts, edges

    lp, le = side(+1)
    rp, re_ = side(-1)
    back = Contour(re_).reversed().edges
    edges = le + [('L', lp[-1], rp[-1])] + back + [('L', rp[0], lp[0])]
    return Contour(edges)


def poly(pts):
    return Contour([('L', pts[i], pts[(i + 1) % len(pts)]) for i in range(len(pts))])


def rect(x, y, w, h):
    return poly([(x, y), (x + w, y), (x + w, y + h), (x, y + h)])


def circle(c, r):
    a = (c[0] + r, c[1])
    b = (c[0] - r, c[1])
    return Contour([('A', a, b, r, c, 0, 180), ('A', b, a, r, c, 180, 360)])


def diag(xt, xb, y0=0.0, y1=H, w=W, lean='right'):
    """y0→y1 을 가르는 사선 획. xt: 위 끝 왼쪽 x, xb: 아래 끝 오른쪽 x.
    수평 폭 hw 를 직각 두께 = w 가 되도록 반복 계산한다."""
    dy = y1 - y0
    hw = w
    for _ in range(50):
        if lean == 'right':
            dx = (xb - hw) - xt
        else:
            dx = xt - (xb - hw)
        hw = w * math.hypot(dx, dy) / dy
    if lean == 'right':   # 왼쪽 위 → 오른쪽 아래
        return poly([(xt, y0), (xt + hw, y0), (xb, y1), (xb - hw, y1)]), hw
    # 오른쪽 위 → 왼쪽 아래: xt = 위 끝 오른쪽 x, xb = 아래 끝 왼쪽 x
    return poly([(xt - hw, y0), (xt, y0), (xb + hw, y1), (xb, y1)]), hw


# ── 글리프(잉크 원점 = 글자 칸 왼쪽 위, 단위 u) ─────────────────────────────────
def g_T():
    return [rect(0, 0, 4, W), rect(1.5, 0, W, H)]


def g_O():
    c = (2.5, 2.5)
    return [circle(c, R_BIG + W / 2), circle(c, R_BIG - W / 2).reversed()]


def g_N():
    d, _ = diag(0.0, 4.0)
    return [rect(0, 0, W, H), rect(3, 0, W, H), d]


def g_A():
    # 아치 A: 원(지름 5u)의 윗반 + 두 기둥, 가로대 윗변 = 원 중심선
    arch = stroke((0.5, H), 270, [('L', 2.5), ('A', R_BIG, 180), ('L', 2.5)])
    bar = rect(1.0, 2.5, 3.0, W)
    return [arch, bar]


def g_R():
    stem = rect(0, 0, W, H)
    # 볼: 윗변 → 작은 반원(R_SMALL) → 아랫변, 높이 3u, 속공간 높이 1u
    bowl = stroke((0.5, 0.5), 0, [('L', 1.5), ('A', R_SMALL, 180), ('L', 1.5)])
    leg, _ = diag(1.6, 4.0, y0=2.5)
    return [stem, bowl, leg]


def g_I():
    return [rect(0, 0, W, H)]


# 가나: 5u × 5u 칸
def g_to():
    # と 둘째 획: 오른쪽 위에서 왼쪽 아래로 내려오는 사선(TO_HEADING) → R_MID 원호로 돌아 → 바닥 수평
    th = TO_HEADING
    r = R_MID
    # 원호 끝(바닥) 중심선 y = H − W/2, 맨 왼쪽 중심선 x = W/2 → 원호 중심 (W/2 + r, H − W/2 − r)
    c = (W / 2 + r, H - W / 2 - r)
    a_start = th + 90.0              # 회전이 음(−)이면 극각 = 진행각 + 90
    p_arc0 = (c[0] + r * math.cos(math.radians(a_start)), c[1] + r * math.sin(math.radians(a_start)))
    L = (p_arc0[1] - TO_TOP) / math.sin(math.radians(th))
    start = add(p_arc0, fwd(th), -L)
    tail = 4.6 - c[0]                 # 바닥 수평 끝 x = 4.6u
    main = stroke(start, th, [('L', L), ('A', r, -th), ('L', tail)])
    # 첫 획: 짧은 수직, 사선을 지나 조금 아래까지
    first = rect(1.0, 0.0, W, 2.0)
    return [first, main]


def g_na():
    # 1 가로획, 2 사선(오른쪽 위→왼쪽 아래), 3 점 획, 4 수직 + 고리(원, 속공간 1u) + 꼬리
    bar = rect(0.0, 0.85, 2.7, W)
    d2, _ = diag(2.0, 0.0, y0=0.0, y1=3.7, lean='left')
    cx, cy = NA_LOOP_X, H - W / 2 - R_SMALL       # 고리 중심(바닥 = 5u)
    ring_o = circle((cx, cy), R_SMALL + W / 2)
    ring_i = circle((cx, cy), R_SMALL - W / 2).reversed()
    sx = cx - W / 2                                # 수직 = 고리 정수리에 내려앉음(실제 な 처럼 고리 위 가운데)
    stem = rect(sx, NA_STEM_TOP, W, (cy - R_SMALL) - NA_STEM_TOP)   # 고리 띠 중심선까지(속공간 침범 없음)
    dot = stroke((sx + W + NA_DOT_GAP + 0.5 * math.sin(math.radians(KANA_SLANT)), NA_STEM_TOP - 0.45), KANA_SLANT, [('L', 1.1)])
    tail = rect(cx, H - W, NA_TAIL, W)
    return [bar, d2, dot, stem, ring_o, ring_i, tail]


def fit_bottom(make, lo=0.0, hi=4.0, target=H):
    """make(L) 의 잉크 맨 아래가 target(기준선)에 닿는 L 을 이분법으로 찾는다."""
    for _ in range(60):
        mid = (lo + hi) / 2
        if make(mid).bbox()[3] > target:
            hi = mid
        else:
            lo = mid
    return make(lo)


def g_ri():
    # り: 왼쪽 짧은 기둥 + 아치(R_MID)로 오른쪽 긴 다리 → R_BIG+W/2 원호로 왼쪽 아래 꼬리
    left = rect(0.0, 0.6, W, 2.9)
    arch = fit_bottom(lambda L: stroke((0.5, 2.3), 270, [('A', R_MID, 180), ('L', L), ('A', R_BIG + W / 2, TAIL_SWEEP)]))
    return [left, arch]


def g_TO():
    stem = rect(0.0, 0.0, W, H)
    short = stroke((0.5, 1.6), KANA_SLANT, [('L', 2.9)])
    return [stem, short]


def g_NA():
    bar = rect(0.0, 1.3, 4.8, W)
    # 수직: 위 끝 y=0 (가로획 위로 1.3u 솟음 — 잘리면 テ 로 읽힌다), 아래에서 원호로 왼쪽 아래
    v = fit_bottom(lambda L: stroke((2.9, 0.0), 90, [('L', L), ('A', R_BIG + W / 2, TAIL_SWEEP)]))
    return [bar, v]


def g_RI():
    left = rect(0.0, 0.3, W, 3.0)
    right = fit_bottom(lambda L: stroke((3.2, 0.0), 90, [('L', L), ('A', R_BIG + W / 2, TAIL_SWEEP)]))
    return [left, right]


GLYPHS = {
    'T': g_T, 'O': g_O, 'N': g_N, 'A': g_A, 'R': g_R, 'I': g_I,
    'と': g_to, 'な': g_na, 'り': g_ri, 'ト': g_TO, 'ナ': g_NA, 'リ': g_RI,
}

# 자간 예외(잉크 사이, u). 기본 GAP = 1u.
KERN = {
    ('T', 'O'): 0.55,   # T 팔 아래 빈 자리
    ('O', 'N'): 0.8,
    ('A', 'R'): 0.9,
    ('R', 'I'): 0.75,   # R 다리 끝 사선
    ('と', 'な'): 0.75,
    ('な', 'り'): 0.85,
    ('ト', 'ナ'): 0.55,  # ト 짧은 획 아래 빈 자리
    ('ナ', 'リ'): 0.7,
}


def layout(text):
    contours = []
    x = 0.0
    prev = None
    for ch in text:
        cs = GLYPHS[ch]()
        xmin = min(c.bbox()[0] for c in cs)
        xmax = max(c.bbox()[2] for c in cs)
        if prev is not None:
            x += KERN.get((prev, ch), GAP)
        dx = x - xmin
        contours += [c.shifted(dx) for c in cs]
        x = xmax + dx
        prev = ch
    dot = circle((x + DOT_GAP + DOT / 2, H - DOT / 2), DOT / 2)
    return contours, dot


def orient(contours):
    """사용자가 reversed()로 만든 구멍을 제외하고, 모든 윤곽의 방향을 같게 맞춘다.
    구멍 판정: 같은 중심의 더 큰 원 안에 있는 원(O·な 고리 속공간)."""
    out = []
    for c in contours:
        a = c.area()
        out.append((c, a))
    # 바깥(+) 기준: 면적 절대값 큰 것 기준 부호
    fixed = []
    for c, a in out:
        is_hole = getattr(c, '_hole', False)
        want_pos = not is_hole
        if (a > 0) != want_pos:
            c = c.reversed()
        fixed.append(c)
    return fixed


def mark_hole(c):
    c._hole = True
    return c


def build(text):
    cs, dot = layout(text)
    # 구멍 표시: 원 두 개가 같은 중심이면 작은 쪽이 구멍
    circles = [c for c in cs if len(c.edges) == 2 and all(e[0] == 'A' for e in c.edges)]
    for a in circles:
        for b in circles:
            if a is not b and abs(a.edges[0][4][0] - b.edges[0][4][0]) < 1e-9 \
                    and abs(a.edges[0][4][1] - b.edges[0][4][1]) < 1e-9 and a.edges[0][3] < b.edges[0][3]:
                mark_hole(a)
    cs = orient(cs)
    dot = orient([dot])[0]
    boxes = [c.bbox() for c in cs] + [dot.bbox()]
    x0 = min(b[0] for b in boxes)
    y0 = min(b[1] for b in boxes)
    x1 = max(b[2] for b in boxes)
    y1 = max(b[3] for b in boxes)
    return cs, dot, (x0, y0, x1, y1)


def svg(text, fg, label, grid=False):
    cs, dot, (x0, y0, x1, y1) = build(text)
    w = (x1 - x0) * U
    h = (y1 - y0) * U
    f = lambda v: ('%.3f' % v).rstrip('0').rstrip('.')
    body = ''.join(c.d(U, x0, y0) for c in cs)
    parts = ['<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 %s %s" width="%s" height="%s" role="img" aria-label="%s">'
             % (f(w), f(h), f(w), f(h), label)]
    if grid:
        parts.append('<g stroke="#8a93a8" stroke-width="0.6" fill="none" opacity="0.55">')
        gx0 = math.floor(x0 * 4) / 4
        gy0 = math.floor(y0 * 4) / 4
        nx = int(math.ceil((x1 - gx0) * 4))
        for i in range(0, nx + 1):
            xx = (gx0 + i / 4 - x0) * U
            sw = '0.9' if abs((gx0 + i / 4) - round(gx0 + i / 4)) < 1e-9 else '0.35'
            parts.append('<line x1="%s" y1="0" x2="%s" y2="%s" stroke-width="%s"/>' % (f(xx), f(xx), f(h), sw))
        for j in range(0, int(math.ceil((y1 - gy0) * 4)) + 1):
            yy = (gy0 + j / 4 - y0) * U
            sw = '0.9' if abs((gy0 + j / 4) - round(gy0 + j / 4)) < 1e-9 else '0.35'
            parts.append('<line x1="0" y1="%s" x2="%s" y2="%s" stroke-width="%s"/>' % (f(yy), f(w), f(yy), sw))
        parts.append('</g>')
        parts.append('<path fill="%s" fill-opacity="0.82" d="%s"/>' % (fg, body))
        # 원호 중심 표시
        parts.append('<g fill="%s">' % VERMILION)
        seen = set()
        for c in cs:
            for e in c.edges:
                if e[0] == 'A':
                    k = (round(e[4][0], 4), round(e[4][1], 4))
                    if k not in seen:
                        seen.add(k)
                        parts.append('<circle cx="%s" cy="%s" r="3"/>' % (f((k[0] - x0) * U), f((k[1] - y0) * U)))
        parts.append('</g>')
    else:
        parts.append('<path fill="%s" d="%s"/>' % (fg, body))
    parts.append('<path fill="%s" d="%s"/>' % (VERMILION, dot.d(U, x0, y0)))
    parts.append('</svg>\n')
    return ''.join(parts), (x1 - x0, y1 - y0)


MARKS = [
    ('F5-up', 'TONARI', 'TONARI'),
    ('F5-hira', 'となり', 'となり'),
    ('F5-kata', 'トナリ', 'トナリ'),
]


def main():
    os.makedirs(OUT, exist_ok=True)
    lines = []
    for key, text, label in MARKS:
        for var, fg in (('light', NIGHT), ('dark', SNOW)):
            s, (wu, hu) = svg(text, fg, label)
            fn = os.path.join(OUT, '%s-%s.svg' % (key, var))
            with open(fn, 'w', encoding='utf-8') as fh:
                fh.write(s)
            lines.append('%s  %s-%s.svg  %.3fu x %.3fu' % (hashlib.sha256(s.encode()).hexdigest(), key, var, wu, hu))
        s, _ = svg(text, NIGHT, label + ' 작도 격자', grid=True)
        fn = os.path.join(OUT, '%s-grid.svg' % key)
        with open(fn, 'w', encoding='utf-8') as fh:
            fh.write(s)
        lines.append('%s  %s-grid.svg' % (hashlib.sha256(s.encode()).hexdigest(), key))
    with open(os.path.join(HERE, 'SHA256SUMS.txt'), 'w', encoding='utf-8') as fh:
        fh.write('\n'.join(lines) + '\n')
    print('\n'.join(lines))


if __name__ == '__main__':
    main()
