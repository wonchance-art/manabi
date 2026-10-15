#!/usr/bin/env python3
"""L3 型紙(가타가미) — TONARI · となり · トナリ 를 서체 없이, 형지를 오려 내듯 작도한다.

구성 규칙(한 줄): 굵기 1u 단선 획을 칼로 오려 낸 형지 — 종이 섬(닫힌 속공간)과
획이 엇갈리는 자리마다 '/' 45° 방향, 폭 b의 つり(다리) 하나를 남긴다.

  - 획 굵기 W = 1u, 글자 높이 H = 5u. 획 끝은 모두 획 방향에 직각으로 자른다(칼 끝).
  - 곡선은 원호뿐(거북이 작도: 직선 + 원호).
  - つり는 한 종류다: 방향 45°('/'), 폭 b, 놓는 자리는 두 경우뿐
      ① 닫힌 속공간(O·A·R·な 고리) — 섬 하나에 つり 하나
      ② 획이 서로 꿰뚫는 교차(な·ナ) — 교차 중심을 '/'로 갈라 두 개의 ㄱ/ㄴ으로 나눔
  - 둥근 획의 つり는 '/' 방향이 반지름과 겹치는 자리(북동·남서)에만 둔다 → 획에 직각으로 잘린다.
  - 교차가 섬을 닫으면(な 고리의 꼬리×기둥) 그 교차의 つり 하나가 섬도 겸한다.
  - 주홍: 'な' 음절의 つり 하나(TONARI의 A 꼭지 / な·ナ의 교차) — 두 조각을 묶는 붉은 실.
  - 검증: つり를 오려 낸 뒤 잉크에 구멍(떨어지는 종이 섬)이 0개여야 한다(assert).
  - 24px 이하용 작은 판(-s): 같은 자리, 폭만 b_small 로 넓힌다.

재생성(리포 루트):  python3 -I docs/japanology/magazine/brand/marks/lettering/L3-katagami/build-l3.py
  L3_PLATE=1 을 주면 버린 시도(형지 판 테두리 + 小紋 점) SVG를 iterations/에 다시 낸다.
의존: shapely 2.x(불리언 연산). 같은 입력이면 같은 바이트를 낸다(좌표 0.01 반올림).
"""
import hashlib
import math
import os
import sys

from shapely import affinity
from shapely.geometry import LineString, Point, Polygon, box
from shapely.ops import unary_union

HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(HERE, 'svg')

# ── 가족 파라미터 ────────────────────────────────────────────────────────────
U = 40.0              # SVG 단위 / 1u
W = 1.0               # 획 굵기(u)
H = 5.0               # 글자 높이(u)
SEAM_DEG = 45.0       # つり 방향(수평에서 반시계, '/' )
SEAM_B = 0.24         # つり 폭(u) — 큰 판
SEAM_B_SMALL = 0.50   # つり 폭(u) — 작은 판(24px 헤더에서 약 2px)
ROUND_GAIN = 1.08     # 둥근 획 굵기 보정(같은 W라도 원호가 가늘어 보임)
KS = 1.12             # 가나 좌표 배율(가나 칸 5.6u, 획은 W 그대로)
PAD = 0.4             # SVG 여백(u)

NIGHT = '#151b2c'
SNOW = '#eef0f4'
VERMILION = '#d4462a'


# ── 기하 도구 ───────────────────────────────────────────────────────────────
def turtle(start, heading, segs, step=2.0):
    """y 아래 좌표. heading 도(0=오른쪽, 90=아래). segs: ('L', 길이) | ('A', 반지름, 회전각±)."""
    x, y = start
    h = heading
    pts = [(x, y)]
    for s in segs:
        if s[0] == 'L':
            r = math.radians(h)
            x, y = x + math.cos(r) * s[1], y + math.sin(r) * s[1]
            pts.append((x, y))
        else:
            _, rad, sweep = s
            # 회전 중심: 진행 방향의 오른쪽(+90, sweep>0) 또는 왼쪽(-90)
            side = 90.0 if sweep > 0 else -90.0
            cr = math.radians(h + side)
            cx, cy = x + math.cos(cr) * rad, y + math.sin(cr) * rad
            a0 = math.degrees(math.atan2(y - cy, x - cx))
            n = max(2, int(abs(sweep) / step))
            for i in range(1, n + 1):
                a = math.radians(a0 + sweep * i / n)
                pts.append((cx + math.cos(a) * rad, cy + math.sin(a) * rad))
            x, y = pts[-1]
            h += sweep
    return pts


def stroke(pts, w=W):
    return LineString(pts).buffer(w / 2.0, cap_style='flat', join_style='round', quad_segs=24)


def ring(cx, cy, r_out, r_in):
    return Point(cx, cy).buffer(r_out, quad_segs=64).difference(Point(cx, cy).buffer(r_in, quad_segs=64))


def seam_rect(p, length, b, deg=SEAM_DEG):
    """중심 p, 방향 deg('/'는 화면에서 오른쪽 위), 길이·폭."""
    r = box(-length / 2.0, -b / 2.0, length / 2.0, b / 2.0)
    # 화면 y가 아래이므로 '/'(오른쪽 위)는 -deg 회전
    r = affinity.rotate(r, -deg, origin=(0, 0))
    return affinity.translate(r, p[0], p[1])


def on_circle(cx, cy, r, deg_ccw):
    a = math.radians(deg_ccw)
    return (cx + math.cos(a) * r, cy - math.sin(a) * r)


# ── 글리프: (잉크, つり 목록[(중심, 길이, 주홍?)]) ─────────────────────────────
def g_T():
    ink = unary_union([box(0, 0, 4.4, W), box(1.7, 0, 1.7 + W, H)])
    return ink, []


def g_O():
    t = W * ROUND_GAIN
    c = (2.55, 2.5)
    ro = 2.58
    ink = ring(c[0], c[1], ro, ro - t)
    p = on_circle(c[0], c[1], ro - t / 2, 45)        # 북동, '/' = 반지름 방향
    return ink, [(p, 1.7, False)]


def g_N():
    wid = 4.4
    dx = 1.3
    ink = unary_union([box(0, 0, W, H), box(wid - W, 0, wid, H),
                       Polygon([(0, 0), (dx, 0), (wid, H), (wid - dx, H)])])
    return ink, []


def g_A():
    wid, top = 5.1, 1.2
    xl, xr = (wid - top) / 2, (wid + top) / 2
    slope = xl / H                    # 다리 기울기(수평 이동 / 높이): 왼다리 바깥 (0,H)→(xl,0)
    ang = math.atan2(H, xl)
    th = W * 1.02 / math.sin(ang)     # 수평 두께
    outer = Polygon([(0, H), (xl, 0), (xr, 0), (wid, H)])
    # 안쪽 선: 왼 x = th + slope*(H-y), 오른 x = wid - th - slope*(H-y)
    t_apex = (wid - 2 * th) / (2 * slope)
    y_apex = H - t_apex
    bar_top, bar_bot = 3.05, 3.05 + W * 0.95
    def lx(y): return th + slope * (H - y)
    def rx(y): return wid - th - slope * (H - y)
    counter = Polygon([(wid / 2, y_apex), (rx(bar_top), bar_top), (lx(bar_top), bar_top)])
    opening = Polygon([(lx(bar_bot), bar_bot), (rx(bar_bot), bar_bot), (rx(H + 1), H + 1), (lx(H + 1), H + 1)])
    ink = outer.difference(counter).difference(opening)
    # つり: 속공간 꼭지에서 '/'로 올라가 오른다리 바깥으로 — 오른다리를 꼭지에서 떼어 냄
    d = 0.62
    p = (wid / 2 + d * math.cos(math.radians(45)), y_apex - d * math.sin(math.radians(45)))
    return ink, [(p, 1.9, True)]


def g_R():
    cx, cy, r = 2.85, 1.5, 1.5
    t = W
    outer = unary_union([box(0, 0, cx, 2 * r), Point(cx, cy).buffer(r, quad_segs=64)])
    inner = unary_union([box(W, t, cx, 2 * r - t), Point(cx, cy).buffer(r - t, quad_segs=64)])
    bowl = outer.difference(inner)
    leg = Polygon([(1.85, 2.4), (3.1, 2.4), (4.6, H), (3.35, H)])
    ink = unary_union([box(0, 0, W, H), bowl, leg]).intersection(box(-1, -1, 10, H))
    p = on_circle(cx, cy, r - t / 2, 45)
    return ink, [(p, 1.6, False)]


def g_I():
    return box(0, 0, W, H), []


# 가나 — 같은 W. 작도는 5u 칸에서 하고 좌표만 KS배(가나 칸 5.6u), 획 굵기는 그대로
def ks(pts):
    return [(x * KS, y * KS) for x, y in pts]


def kst(start, heading, segs):
    return stroke(ks(turtle(start, heading, segs)))


def kpt(p):
    return (p[0] * KS, p[1] * KS)


def g_to():
    s1 = stroke(ks([(1.15, 0.05), (1.45, 2.0)]))
    s2 = kst((4.1, 1.05), 151, [('L', 2.3), ('A', 1.2, -146), ('L', 1.7)])
    return unary_union([s1, s2]), []


def g_na():
    bar_y = 1.2
    s1 = stroke(ks([(0.0, bar_y), (2.75, bar_y)]))
    top, bot = (1.75, 0.0), (0.5, 4.55)
    s2 = stroke(ks([top, bot]))
    s3 = stroke(ks([(3.95, 0.6), (5.05, 1.22)]))
    stem_x, stem_top, stem_len, loop_r = 3.85, 1.5, 2.05, 0.94
    s4 = kst((stem_x, stem_top), 90,
             [('L', stem_len), ('A', loop_r, 270), ('L', loop_r + 0.32), ('A', 1.0, 40), ('L', 0.3)])
    ink = unary_union([s1, s2, s3, s4])
    k = (bar_y - top[1]) / (bot[1] - top[1])
    cross = kpt((top[0] + (bot[0] - top[0]) * k, bar_y))          # 가로획 × 왼 사선 교차
    # 꼬리 × 기둥 교차 — 고리(섬)를 닫는 자리이므로 이 つり 하나가 섬도 겸한다
    knot = kpt((stem_x, stem_top + stem_len - loop_r))
    return ink, [(cross, 1.9, True), (knot, 1.9, False)]


def g_ri():
    s1 = kst((0.75, 0.25), 90, [('L', 2.2), ('A', 0.85, -125)])
    s2 = kst((2.7, 0.0), 40, [('A', 1.05, 50), ('L', 1.95), ('A', 2.5, 52)])
    return unary_union([s1, s2]), []


def g_TO():
    stem = stroke(ks([(1.0, 0.0), (1.0, 5.0)]))
    tick = stroke(ks([(1.0, 1.95), (3.4, 2.85)]))
    return unary_union([stem, tick]), []


def g_NA():
    bar_y = 1.6
    bar = stroke(ks([(0.0, bar_y), (4.6, bar_y)]))
    vx = 2.85
    v = kst((vx, 0.0), 90, [('L', 2.35), ('A', 2.9, 52)])
    return unary_union([bar, v]), [(kpt((vx, bar_y)), 2.2, True)]


def g_RI():
    s1 = stroke(ks([(0.95, 0.35), (0.95, 2.9)]))
    s2 = kst((3.0, 0.0), 90, [('L', 2.3), ('A', 2.7, 48)])
    return unary_union([s1, s2]), []


# ── 마크 조립 ───────────────────────────────────────────────────────────────
MARKS = {
    'TONARI': [(g_T, 0.0), (g_O, -0.05), (g_N, 0.75), (g_A, 0.3), (g_R, 0.25), (g_I, 0.55)],
    'tonari-hira': [(g_to, 0.0), (g_na, 0.55), (g_ri, 0.55)],
    'tonari-kata': [(g_TO, 0.0), (g_NA, 0.45), (g_RI, 0.45)],
}


def build(name, b):
    """잉크(つり를 오려 낸 뒤)와 주홍 조각."""
    x = 0.0
    inks, reds = [], []
    prev_right = None
    for fn, gap in MARKS[name]:
        ink, seams = fn()
        minx, _, maxx, _ = ink.bounds
        dx = (0.0 - minx) if prev_right is None else (prev_right + gap - minx)
        ink = affinity.translate(ink, dx, 0)
        cut = []
        for (p, L, red) in seams:
            sr = seam_rect((p[0] + dx, p[1]), L, b)
            cut.append(sr)
            if red:
                reds.append(sr.intersection(ink))
        if cut:
            ink = ink.difference(unary_union(cut))
        # 형지 검증: つり를 오려 낸 뒤 종이 섬(구멍 = interior ring)이 하나도 없어야 한다
        polys = [ink] if ink.geom_type == 'Polygon' else list(ink.geoms)
        islands = sum(len(pg.interiors) for pg in polys)
        assert islands == 0, f'{name}/{fn.__name__}: 떨어지는 종이 섬 {islands}개'
        inks.append(ink)
        prev_right = ink.bounds[2]
    return unary_union(inks), unary_union(reds) if reds else None


def fmt(v):
    s = f'{v:.2f}'.rstrip('0').rstrip('.')
    return '0' if s in ('-0', '') else s


def ring_d(coords, ox, oy):
    pts = list(coords)[:-1]
    out = []
    for i, (x, y) in enumerate(pts):
        out.append(('M' if i == 0 else 'L') + fmt((x + ox) * U) + ' ' + fmt((y + oy) * U))
    return ''.join(out) + 'Z'


def geom_d(g, ox, oy):
    if g is None or g.is_empty:
        return ''
    polys = [g] if g.geom_type == 'Polygon' else list(g.geoms)
    polys = [p for p in polys if p.geom_type == 'Polygon' and p.area > 1e-6]
    polys.sort(key=lambda p: (round(p.bounds[0], 3), round(p.bounds[1], 3)))
    d = []
    for p in polys:
        p = p.simplify(0.003, preserve_topology=True)
        d.append(ring_d(p.exterior.coords, ox, oy))
        for it in p.interiors:
            d.append(ring_d(it.coords, ox, oy))
    return ''.join(d)


def svg(name, theme, small=False, plate=False):
    b = SEAM_B_SMALL if small else SEAM_B
    ink, red = build(name, b)
    minx, miny, maxx, maxy = ink.bounds
    pad = PAD + (0.9 if plate else 0.0)
    ox, oy = pad - minx, pad - miny
    wv, hv = (maxx - minx + 2 * pad) * U, (maxy - miny + 2 * pad) * U
    fg = NIGHT if theme == 'light' else SNOW
    parts = [f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {fmt(wv)} {fmt(hv)}" '
             f'width="{fmt(wv)}" height="{fmt(hv)}" role="img" aria-label="{label(name)}">',
             f'<title>{label(name)}</title>',
             f'<path fill="{fg}" fill-rule="evenodd" d="{geom_d(ink, ox, oy)}"/>']
    if plate:
        # 실험(버린 시도 기록용): 형지 판 테두리 + 小紋 점 한 줄
        m, t = 0.75, 0.16
        fr = box(minx - m, miny - m, maxx + m, maxy + m).difference(
            box(minx - m + t, miny - m + t, maxx + m - t, maxy + m - t))
        dots = []
        n = int((maxx - minx + 2 * m - 0.6) / 0.45)
        for i in range(n + 1):
            cx = minx - m + 0.3 + i * (maxx - minx + 2 * m - 0.6) / n
            dots.append(Point(cx, maxy + m - 0.38).buffer(0.07, quad_segs=8))
        parts.append(f'<path fill="{fg}" fill-rule="evenodd" d="{geom_d(unary_union([fr] + dots), ox, oy)}"/>')
    if red is not None and not red.is_empty:
        parts.append(f'<path fill="{VERMILION}" d="{geom_d(red, ox, oy)}"/>')
    parts.append('</svg>\n')
    return ''.join(parts), (wv, hv)


def label(name):
    return {'TONARI': 'TONARI', 'tonari-hira': 'となり', 'tonari-kata': 'トナリ'}[name]


def main():
    os.makedirs(OUT, exist_ok=True)
    sums = []
    sizes = {}
    for name in MARKS:
        for small in (False, True):
            for theme in ('light', 'dark'):
                s, wh = svg(name, theme, small)
                fn = f'L3-{name}{"-s" if small else ""}-{theme}.svg'
                with open(os.path.join(OUT, fn), 'w', encoding='utf-8') as f:
                    f.write(s)
                sums.append(f'{hashlib.sha256(s.encode()).hexdigest()}  svg/{fn}')
                sizes[fn] = wh
    if os.environ.get('L3_PLATE'):
        for name in MARKS:
            s, _ = svg(name, 'light', plate=True)
            with open(os.path.join(HERE, 'iterations', f'plate-{name}.svg'), 'w', encoding='utf-8') as f:
                f.write(s)
    with open(os.path.join(HERE, 'SHA256SUMS.txt'), 'w', encoding='utf-8') as f:
        f.write('\n'.join(sums) + '\n')
    for k in sorted(sizes):
        print(k, fmt(sizes[k][0]), fmt(sizes[k][1]))


if __name__ == '__main__':
    sys.dont_write_bytecode = True
    main()
