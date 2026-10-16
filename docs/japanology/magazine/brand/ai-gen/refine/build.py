# 받은 AI 마크 → 정밀화 v1(결정적). 같은 입력이면 같은 SVG.
# 사용: python3 -I build.py   (입력: ../inbox, ../out/svg 추적본 / 출력: ./v1/)
# 하는 일
#  ① TONARI 원판: 글자 사이 틈을 평균값 하나로 고른다(실측 1.35~2.24%H → 균일), 가장자리 울퉁불퉁 정리(열림·닫힘 r=0.4%H)
#  ② TONARI 소형판(48px 이하): 글자마다 2.5%H 깎아 틈 6%H·속공간 확대 — 작은 크기에서 틈이 메워지지 않게
#  ③ 가나: TONARI 획 굵기(평균 31%H)에 가깝게 살을 붙이고(구멍이 막히지 않는 한도), 글자 사이를 TONARI 리듬에 맞춰 조인다
#  ④ 조합판: TONARI 위, となり 아래(TONARI 폭의 45%, 가운데, 사이 10%H) — 오너 컨셉 시트(01·05)의 비율
import json, os, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from shapely import affinity
from shapely.geometry import MultiPolygon, Polygon
from shapely.ops import unary_union
from geom import load, parts, to_d

HERE = os.path.dirname(os.path.abspath(__file__))
AI = os.path.dirname(HERE)
OUT = os.path.join(HERE, 'v1'); os.makedirs(OUT, exist_ok=True)
UNIT = 1000.0  # 출력 좌표계: 잉크 높이 = 1000

def norm(g):
    minx, miny, maxx, maxy = g.bounds
    s = UNIT / (maxy - miny)
    return affinity.scale(affinity.translate(g, -minx, -miny), s, s, origin=(0, 0))

def smooth(g, r):
    return g.buffer(-r, join_style=1).buffer(2 * r, join_style=1).buffer(-r, join_style=1)

def respace(glyphs, gap):
    """왼쪽부터 다음 글자를 가로로 옮겨 최소 거리 = gap(이분법)."""
    out = [glyphs[0]]
    for g in glyphs[1:]:
        prev = out[-1]
        lo = prev.bounds[2] - g.bounds[0] - 2000
        hi = prev.bounds[2] - g.bounds[0] + 2000
        for _ in range(60):
            mid = (lo + hi) / 2
            m = affinity.translate(g, mid, 0)
            if m.intersects(prev) or m.distance(prev) < gap: lo = mid
            else: hi = mid
        out.append(affinity.translate(g, hi, 0))
    return out

def group(g, groups):
    ps = parts(g)
    return [unary_union([ps[i] for i in grp]) for grp in groups]

def gaps(glyphs, H=UNIT):
    return [round(glyphs[k].distance(glyphs[k + 1]) / H * 100, 2) for k in range(len(glyphs) - 1)]

def holes(g, H=UNIT):
    return [round((Polygon(r).area ** 0.5) / H * 100, 1) for p in getattr(g, 'geoms', [g]) for r in p.interiors]

def stroke(g, H=UNIT):
    ps = list(getattr(g, 'geoms', [g]))
    return round(sum(2 * p.area / p.length for p in ps) / len(ps) / H * 100, 1)

def fin(glyphs, tol=0.6):
    g = unary_union(glyphs).simplify(tol, preserve_topology=True)
    return norm(g)

def svg(g, name, note):
    minx, miny, maxx, maxy = g.bounds
    d = to_d(g)
    open(os.path.join(OUT, name), 'w').write(
        f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="{minx:.0f} {miny:.0f} {maxx - minx:.0f} {maxy - miny:.0f}">'
        f'<!-- {note} --><path fill="currentColor" fill-rule="evenodd" d="{d}"/></svg>\n')

report = {}

# ① TONARI 원판
src = norm(load(os.path.join(AI, 'inbox', 'TONARI-gpt-01c.svg')))
G = [p for p in parts(src)]  # T O N A R I 각 1조각
report['TONARI_before'] = {'gap%H': gaps(G), 'hole%H': holes(src), 'stroke%H': stroke(src)}
target = sum(gaps(G)) / len(gaps(G)) / 100 * UNIT
G1 = respace([smooth(g, 4) for g in G], target)
master = fin(G1)
report['TONARI_master'] = {'gap%H': gaps(parts(master)), 'hole%H': holes(master), 'stroke%H': stroke(master), 'W/H': round(master.bounds[2] / UNIT, 3)}
svg(master, 'TONARI-master.svg', 'TONARI 원판 v1 — 틈 균일·가장자리 정리. 원본 TONARI-gpt-01c.svg')

# ② TONARI 소형판
G2 = respace([g.buffer(-25, join_style=1) for g in G1], 60)
small = fin(G2)
report['TONARI_small'] = {'gap%H': gaps(parts(small)), 'hole%H': holes(small), 'stroke%H': stroke(small), 'W/H': round(small.bounds[2] / UNIT, 3)}
svg(small, 'TONARI-small.svg', 'TONARI 소형판 v1(48px 이하) — 글자마다 2.5%H 깎고 틈 6%H')

# ③ 가나 — 획을 TONARI 쪽으로 굵게(구멍 최소 6%H 유지), 틈은 TONARI 원판보다 조금 넓은 4%H(가나는 획 끝이 많아 더 붙이면 뭉친다)
def kana(name, groups, grow):
    k = norm(load(os.path.join(AI, 'out', 'svg', name)))
    before = {'gap%H': gaps(group(k, groups)), 'hole%H': holes(k), 'stroke%H': stroke(k)}
    kg = [smooth(g.buffer(grow, join_style=1), 4) for g in group(k, groups)]
    kg = respace(kg, 40)
    out = fin(kg)
    after = {'gap%H': gaps(kg), 'hole%H': holes(out), 'stroke%H': stroke(out), 'W/H': round(out.bounds[2] / UNIT, 3)}
    return out, before, after

hira, hb, ha = kana('hira-gpt-01c.svg', [[0, 1], [2, 3, 4], [5, 6]], 12)
report['hira_before'], report['hira_v1'] = hb, ha
svg(hira, 'hira-v1.svg', 'となり v1 — 획 +2.4%H(な 고리 속공간 유지), 틈 4%H. 원본 hira-gpt-01c(추적본)')
kata, kb, ka = kana('kata-gpt-01c.svg', [[0], [1], [2, 3]], 30)
report['kata_before'], report['kata_v1'] = kb, ka
svg(kata, 'kata-v1.svg', 'トナリ v1 — 획 +6%H, 틈 4%H. 원본 kata-gpt-01c(추적본)')

# ④ 조합판(가운데 정렬)
W = master.bounds[2]
s = 0.45 * W / hira.bounds[2]
h2 = affinity.scale(hira, s, s, origin=(0, 0))
h2 = affinity.translate(h2, (W - h2.bounds[2]) / 2, UNIT * 1.10)
lock = unary_union([master, h2])
svg(lock, 'lockup-center.svg', '조합판 v1 — TONARI 위, となり 아래(폭 45%, 가운데, 사이 10%H)')

json.dump(report, open(os.path.join(OUT, 'report.json'), 'w'), ensure_ascii=False, indent=1)
print(json.dumps(report, ensure_ascii=False))
