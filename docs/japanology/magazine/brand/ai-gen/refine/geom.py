# SVG(절대 M/L/C/Z + translate) → shapely 도형. 결정적: 3차 베지어는 구간당 24점으로 고정 분할.
import re
from functools import reduce
from shapely.geometry import Polygon, MultiPolygon
from shapely.ops import unary_union

STEPS = 24

def _rings(d, tx=0.0, ty=0.0):
    toks = re.findall(r'[MLCZmlcz]|-?\d*\.?\d+(?:e-?\d+)?', d)
    rings, cur, cmd, i, pt = [], [], None, 0, (0.0, 0.0)
    num = lambda k: float(toks[k])
    while i < len(toks):
        t = toks[i]
        if t.isalpha():
            cmd = t.upper(); i += 1
            if cmd == 'Z':
                if len(cur) > 2: rings.append(cur)
                cur = []
            continue
        if cmd == 'M':
            if len(cur) > 2: rings.append(cur)
            pt = (num(i) + tx, num(i + 1) + ty); cur = [pt]; i += 2; cmd = 'L'
        elif cmd == 'L':
            pt = (num(i) + tx, num(i + 1) + ty); cur.append(pt); i += 2
        elif cmd == 'C':
            p1 = (num(i) + tx, num(i + 1) + ty); p2 = (num(i + 2) + tx, num(i + 3) + ty); p3 = (num(i + 4) + tx, num(i + 5) + ty)
            p0 = pt
            for s in range(1, STEPS + 1):
                u = s / STEPS; v = 1 - u
                cur.append((v**3*p0[0] + 3*v*v*u*p1[0] + 3*v*u*u*p2[0] + u**3*p3[0],
                            v**3*p0[1] + 3*v*v*u*p1[1] + 3*v*u*u*p2[1] + u**3*p3[1]))
            pt = p3; i += 6
        else:
            raise ValueError(f'지원하지 않는 명령 {cmd}')
    if len(cur) > 2: rings.append(cur)
    return rings

def load(svg_path):
    """파일의 모든 <path>를 even-odd로 합친 도형(MultiPolygon). 흰 바탕 rect는 무시한다."""
    src = open(svg_path, encoding='utf-8').read()
    rings = []
    for m in re.finditer(r'<path\b([^>]*)/?>', src):
        attrs = m.group(1)
        fill = re.search(r'fill="([^"]*)"', attrs)
        if fill and fill.group(1).lower() in ('#fff', '#ffffff', 'white', 'none'):
            continue
        d = re.search(r'\sd="([^"]*)"', attrs).group(1)
        tr = re.search(r'translate\(\s*([-\d.]+)[ ,]+([-\d.]+)\s*\)', attrs)
        tx, ty = (float(tr.group(1)), float(tr.group(2))) if tr else (0.0, 0.0)
        rings += _rings(d, tx, ty)
    polys = [Polygon(r).buffer(0) for r in rings]
    g = reduce(lambda a, b: a.symmetric_difference(b), polys)
    return MultiPolygon([p for p in getattr(g, 'geoms', [g]) if p.area > 0]) if g.geom_type != 'MultiPolygon' else g

def parts(g):
    return sorted(list(g.geoms), key=lambda p: p.bounds[0])

def to_d(g, prec=1):
    """도형 → SVG path d(직선 근사, 소수 prec자리). 구멍은 even-odd로 그린다."""
    out = []
    f = lambda v: f'{v:.{prec}f}'.rstrip('0').rstrip('.')
    for p in getattr(g, 'geoms', [g]):
        for ring in [p.exterior, *p.interiors]:
            c = list(ring.coords)[:-1]
            out.append('M' + ' L'.join(f'{f(x)} {f(y)}' for x, y in c) + 'Z')
    return ''.join(out)
