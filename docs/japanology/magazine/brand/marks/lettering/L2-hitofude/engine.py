"""L2 一筆 — 단일 선(모노라인) 작도 엔진.

구성 규칙: 하나의 중심선(폴리라인 꼭짓점 목록)을 일정 반경 R로 모서리를 굴리고,
굵기 W로 두께를 준 뒤, 자기 교차점은 '위 가닥 양옆을 gap만큼 끊어' 매듭으로 만든다.
모든 크기는 W 단위로 파생된다(R = W, 평행 되접기 간격 = 2R - W = W).

의존: shapely 2.x (GEOS). 결과는 결정적이다(난수·시계 없음).
"""
import math
from shapely.geometry import LineString, Point, Polygon, MultiPolygon, box
from shapely.ops import unary_union, substring
from shapely import set_precision


def _unit(dx, dy):
    L = math.hypot(dx, dy)
    return dx / L, dy / L, L


def fillet(pts, R, radii=None, step_deg=3.0):
    """꼭짓점마다 반경 R 원호로 모서리를 굴린 조밀 폴리라인을 돌려준다."""
    radii = radii or {}
    out = [tuple(pts[0])]
    tans = []
    for i in range(1, len(pts) - 1):
        (x0, y0), (x1, y1), (x2, y2) = pts[i - 1], pts[i], pts[i + 1]
        ax, ay, _ = _unit(x1 - x0, y1 - y0)
        bx, by, _ = _unit(x2 - x1, y2 - y1)
        cr = ax * by - ay * bx
        dt = ax * bx + ay * by
        th = math.atan2(cr, dt)
        r = radii.get(i, R)
        t = r * math.tan(abs(th) / 2) if (abs(th) > 1e-9 and r) else 0.0
        tans.append(t)
        if abs(th) < 1e-9 or r == 0:
            out.append((x1, y1))
            continue
        a = (x1 - ax * t, y1 - ay * t)
        if th > 0:
            nx, ny = -ay, ax
        else:
            nx, ny = ay, -ax
        c = (a[0] + nx * r, a[1] + ny * r)
        a0 = math.atan2(a[1] - c[1], a[0] - c[0])
        n = max(4, int(math.ceil(abs(math.degrees(th)) / step_deg)))
        for k in range(n + 1):
            ang = a0 + th * k / n
            out.append((c[0] + r * math.cos(ang), c[1] + r * math.sin(ang)))
    out.append(tuple(pts[-1]))
    # 접선 길이 점검: 이웃 모서리의 굴림이 선분 길이를 넘으면 경고
    warn = []
    tl = [0.0] + tans + [0.0]
    for i in range(len(pts) - 1):
        L = math.dist(pts[i], pts[i + 1])
        if tl[i] + tl[i + 1] > L + 1e-6:
            warn.append((i, round(L, 2), round(tl[i] + tl[i + 1], 2)))
    return out, warn


def find_crossings(line, W):
    """중심선 자기 교차점(호길이 s1<s2)을 찾는다. 인접 구간(길이 < 2W)은 무시."""
    coords = list(line.coords)
    segs = []
    s = 0.0
    for i in range(len(coords) - 1):
        L = math.dist(coords[i], coords[i + 1])
        segs.append((coords[i], coords[i + 1], s, L))
        s += L
    hits = []
    for i in range(len(segs)):
        p, q, s1, L1 = segs[i]
        for j in range(i + 2, len(segs)):
            u, v, s2, L2 = segs[j]
            if s2 - (s1 + L1) < 2 * W:
                continue
            if max(p[0], q[0]) < min(u[0], v[0]) or max(u[0], v[0]) < min(p[0], q[0]):
                continue
            if max(p[1], q[1]) < min(u[1], v[1]) or max(u[1], v[1]) < min(p[1], q[1]):
                continue
            d1x, d1y = q[0] - p[0], q[1] - p[1]
            d2x, d2y = v[0] - u[0], v[1] - u[1]
            den = d1x * d2y - d1y * d2x
            if abs(den) < 1e-12:
                continue
            t = ((u[0] - p[0]) * d2y - (u[1] - p[1]) * d2x) / den
            w = ((u[0] - p[0]) * d1y - (u[1] - p[1]) * d1x) / den
            # 접선(같은 방향으로 스치는 접촉)은 매듭이 아니다 — 25° 미만 교각 무시
            sang = abs(den) / (math.hypot(d1x, d1y) * math.hypot(d2x, d2y))
            if 0 <= t <= 1 and 0 <= w <= 1 and sang > math.sin(math.radians(25)):
                hits.append((s1 + t * L1, s2 + w * L2,
                             (p[0] + t * d1x, p[1] + t * d1y)))
    # 군집(같은 교차가 여러 세그먼트에서 잡히는 경우)
    hits.sort()
    out = []
    for h in hits:
        if out and abs(h[0] - out[-1][0]) < W and abs(h[1] - out[-1][1]) < W:
            continue
        out.append(h)
    return out


def build(pts, W, R=None, gap=None, over=None, accent=None, radii=None):
    """pts: 중심선 꼭짓점. over: 교차별 'late'(나중 가닥이 위)|'early'.
    accent: ('start'|'end', 길이). 반환: dict(body=Polygon, accent=Polygon, ...)."""
    R = W if R is None else R
    gap = 0.5 * W if gap is None else gap
    dense, warn = fillet(pts, R, radii)
    line = LineString(dense)
    hw = W / 2
    body = line.buffer(hw, quad_segs=24, cap_style="round", join_style="round")
    xs = find_crossings(line, W)
    over = over or {}
    span = 3 * W
    for k, (s1, s2, P) in enumerate(xs):
        mode = over.get(k, "late")
        so, su = (s2, s1) if mode == "late" else (s1, s2)
        ol = substring(line, max(0, so - span), min(line.length, so + span))
        ul = substring(line, max(0, su - span), min(line.length, su + span))
        ring = ol.buffer(hw + gap, quad_segs=24, cap_style="flat").difference(
            ol.buffer(hw, quad_segs=24, cap_style="flat"))
        cut = ring.intersection(ul.buffer(hw + 0.6, quad_segs=24, cap_style="flat"))
        body = body.difference(cut)
        body = body.union(ol.buffer(hw, quad_segs=24, cap_style="flat"))
    acc = None
    if accent:
        where, La = accent
        if where == "start":
            piece = substring(line, 0, La)
            tip = Point(line.coords[0])
        else:
            piece = substring(line, line.length - La, line.length)
            tip = Point(line.coords[-1])
        acc = piece.buffer(hw, quad_segs=24, cap_style="flat").union(
            tip.buffer(hw, quad_segs=24))
    body = set_precision(body, 0.01)
    if acc is not None:
        acc = set_precision(acc, 0.01)
    return dict(body=body, accent=acc, line=line, crossings=xs, warn=warn)


def poly_to_d(geom, sx, sy, ox, oy, nd=2):
    """shapely (Multi)Polygon → SVG path d (y 뒤집기: Y = oy - y*sy)."""
    if geom is None or geom.is_empty:
        return ""
    polys = list(geom.geoms) if hasattr(geom, "geoms") else [geom]
    parts = []
    fmt = "{:." + str(nd) + "f}"
    for pg in polys:
        if pg.is_empty or pg.geom_type != "Polygon":
            continue
        for ring in [pg.exterior] + list(pg.interiors):
            cs = list(ring.coords)[:-1]
            seg = []
            for i, (x, y) in enumerate(cs):
                X = fmt.format(ox + x * sx)
                Y = fmt.format(oy - y * sy)
                seg.append(("M" if i == 0 else "L") + X + " " + Y)
            parts.append("".join(seg) + "Z")
    return "".join(parts)
