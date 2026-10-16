# 받은 마크 실측: 잉크 높이 H 기준 비율로 글자 사이 최소 틈, 속공간(구멍) 크기, 획 굵기 근사
import json, os, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from shapely.ops import unary_union
from geom import load, parts

def measure(path, groups):
    g = load(path); ps = parts(g)
    minx, miny, maxx, maxy = g.bounds; H = maxy - miny
    glyphs = [unary_union([ps[i] for i in grp]) for grp in groups]
    gaps = [round(glyphs[k].distance(glyphs[k+1]) / H * 100, 2) for k in range(len(glyphs) - 1)]
    holes = [round((h.area ** 0.5) / H * 100, 1) for p in ps for h in [__import__('shapely').geometry.Polygon(r) for r in p.interiors]]
    stroke = [round(2 * p.area / p.length / H * 100, 1) for p in ps]  # 길쭉한 획이면 ≈ 획 굵기
    return {'file': path.split('/')[-1], 'H': round(H, 1), 'W/H': round((maxx - minx) / H, 3),
            'components': [[round(v) for v in p.bounds] for p in ps],
            'gap%H': gaps, 'hole√area%H': holes, 'stroke≈%H': stroke}

if __name__ == '__main__':
    path = sys.argv[1]; groups = json.loads(sys.argv[2]) if len(sys.argv) > 2 else None
    g = load(path); n = len(parts(g))
    print(json.dumps(measure(path, groups or [[i] for i in range(n)]), ensure_ascii=False))
