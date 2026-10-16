"""L2 一筆 — TONARI·となり·トナリ 한 줄 작도 (결정적 빌드).

실행: PYTHONPATH=<shapely 설치 경로> python3 build-l2.py [--iter NAME]
산출: svg/<word>-<light|dark>[-small].svg, card.html 이 참조.
구성 규칙(NOTES.md): 굵기 W 하나·모서리 반경 R=W 하나. 가지(획 끝이 세 개 이상 모이는 곳)는
'혀(舌)' — 같은 선이 W 간격으로 되접혀 나갔다 돌아온다. 교차는 위 가닥 양옆 0.5W 절단(매듭).
"""
import json
import math
import os
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
from engine import build, poly_to_d  # noqa: E402

NIGHT, SNOW, SHU = "#151b2c", "#eef0f4", "#d4462a"


def tongue(p1, p2, G, side):
    """p1→p2로 나갔다가 G 간격 평행선으로 되돌아와 p1을 지나던 원래 진행선(host)에 닿는다.
    side=+1: 진행 방향 왼쪽으로 되접힘, -1: 오른쪽. 반환: [p2, p3] (복귀 끝점은 호출측이 지정)."""
    dx, dy = p2[0] - p1[0], p2[1] - p1[1]
    L = math.hypot(dx, dy)
    nx, ny = -dy / L * side, dx / L * side
    p3 = (p2[0] + nx * G, p2[1] + ny * G)
    return p2, p3


def ret_to_x(p3, d, x):
    """p3에서 방향 d(=-(p2-p1))로 진행해 x=const 에 닿는 점."""
    t = (x - p3[0]) / d[0]
    return (x, p3[1] + d[1] * t)


def ret_to_line(p3, d, a, b):
    """p3에서 방향 d로 진행해 직선 ab와 만나는 점."""
    ex, ey = b[0] - a[0], b[1] - a[1]
    den = d[0] * ey - d[1] * ex
    t = ((a[0] - p3[0]) * ey - (a[1] - p3[1]) * ex) / den
    return (p3[0] + d[0] * t, p3[1] + d[1] * t)


# ---------------------------------------------------------------- 펜
class Pen:
    """꼭짓점 누적기. r=None → 기본 반경 R, r=0 → 굴리지 않는 원점(원호 표본점)."""
    def __init__(self, R):
        self.R = R
        self.pts = []
        self.radii = {}

    def v(self, x, y, r=None):
        if self.pts and math.dist(self.pts[-1], (x, y)) < 1e-6:
            return self
        if r is not None:
            self.radii[len(self.pts)] = r
        self.pts.append((float(x), float(y)))
        return self

    def circle(self, cx, cy, rad, a0, sweep, n=96):
        """중심 (cx,cy) 반지름 rad, 시작각 a0(도)에서 sweep(도)만큼 표본점(굴림 없음)."""
        for k in range(n + 1):
            a = math.radians(a0 + sweep * k / n)
            self.v(cx + rad * math.cos(a), cy + rad * math.sin(a), 0)
        return self

    @property
    def last(self):
        return self.pts[-1]


def corner_ext(p0, v, p2, r):
    """p0→v→p2 모서리를 반경 r로 굴렸을 때 원호의 (miny, maxy)."""
    from engine import fillet
    d, _ = fillet([p0, v, p2], r)
    ys = [y for _, y in d[1:-1]] or [v[1]]
    return min(ys), max(ys)


def peak(p0, x, p2, r, target, top=True):
    """꼭짓점 x좌표 고정, 굴린 원호의 꼭대기(top) 또는 바닥이 target에 오도록 y를 푼다."""
    y = target
    for _ in range(30):
        lo, hi = corner_ext(p0, (x, y), p2, r)
        y += (target - (hi if top else lo))
    return (x, y)


# ---------------------------------------------------------------- TONARI
def tonari(W):
    R = W
    G = 2 * W            # 되접힘 중심 간격(빈틈 = W)
    H = 100
    p = Pen(R)
    # T — 왼팔 끝에서 시작(주홍), 오른팔은 혀로 되접혀 기둥이 된다
    tx = 34
    p.v(tx + 32, H).v(tx - 30, H).v(tx - 30, H - G).v(tx, H - G).v(tx, 0)
    # O — 철사 위에 굴러가는 고리(원). 접점에서 철사와 한 몸
    c = tx + 98
    rad = H / 2
    p.circle(c, rad, rad, -90, 360, 160)
    # N·A — N의 셋째 획이 A의 왼다리(벽 하나를 나눈 이웃)
    n = c + rad + 30
    nw = 58
    aw = 92
    yb_apex = None
    p.v(n, 0)
    tl = peak((n, 0), n, (n + nw, 0), R, H, top=True)
    p.v(*tl)
    vb = (n + nw, 0)
    vb = peak(tl, n + nw, (n + nw + aw / 2, H), R, 0, top=False)
    p.v(*vb)
    ap = peak(vb, n + nw + aw / 2, (n + nw + aw, 0), R, H, top=True)
    p.v(*ap)
    rb = (n + nw + aw, 0)
    # 가로대 = 오른다리에서 왼쪽으로 내민 혀
    def leg_x(y):
        return ap[0] + (rb[0] - ap[0]) * (ap[1] - y) / ap[1]
    def left_x(y):
        return vb[0] + (ap[0] - vb[0]) * (y - vb[1]) / (ap[1] - vb[1])
    y1 = 50
    y2 = y1 - G
    tip = left_x((y1 + y2) / 2) + 4
    p.v(leg_x(y1), y1).v(tip, y1).v(tip, y2).v(leg_x(y2), y2)
    p.v(*rb)
    # R — 기둥·주머니·다리. 주머니 아랫변이 기둥을 넘어가 되접혀 한 번 감고(매듭 둘) 다리로 나간다
    r0 = rb[0] + 30 + G
    yb = 50
    p.v(r0, 0).v(r0, H).v(r0 + 52, H).v(r0 + 52, yb).v(r0 - G, yb).v(r0 - G, yb - G)
    p.v(r0 + 14, yb - G).v(r0 + 56, 0)
    # I — 철사로 이어 올라가 끝
    i0 = r0 + 60 + 30
    p.v(i0, 0).v(i0, H)
    return p


def on_seg(a, b, x):
    """선분 ab 위에서 x좌표가 x인 점."""
    t = (x - a[0]) / (b[0] - a[0])
    return (x, a[1] + (b[1] - a[1]) * t)


def fold_par(a, b, G, side):
    """방향 a→b 진행선의 b에서 G만큼 옆(side=+1 왼쪽)으로 평행 이동한 점."""
    dx, dy = b[0] - a[0], b[1] - a[1]
    L = math.hypot(dx, dy)
    return (b[0] - dy / L * G * side, b[1] + dx / L * G * side)


def to_w(W):
    """となり"""
    R = W
    G = 2 * W
    p = Pen(R)
    # と — 점 머리에서 시작(주홍) ↘, 둘째 획 대각에 닿아 ↗ 머리(S)까지 혀로 올라갔다 되접혀 ↙, 왼아래로 굽어 철사로
    S, A = (96, 104), (18, 60)
    M = on_seg(S, A, 52)
    p.v(30, 128).v(*M).v(*S)
    _, s3 = tongue(M, S, G, -1)
    p.v(*s3)
    A2 = ret_to_x(s3, (M[0] - S[0], M[1] - S[1]), A[0])
    p.v(*A2).v(A2[0], 0)
    # な — 철사 → 비침 ↗ → 머리 되접힘 → 가로획(비침과 매듭) → 끝에서 점(혀 ↗) → 세로 ↓ → 고리(원) → 철사
    ox = 116
    foot = (ox + 0, 0)
    top = (ox + 26, 128)
    p.v(*foot).v(*top)
    t2 = fold_par(foot, top, G, +1)
    p.v(*t2)
    bar_y = 92
    k = (t2[1] - bar_y) / (top[1] - foot[1])
    p.v(t2[0] - (top[0] - foot[0]) * k, bar_y)
    vx = ox + 68
    t1 = (vx, bar_y)
    tt = (vx + 24, 110)
    p.v(*t1).v(*tt)
    _, p3 = tongue(t1, tt, G, -1)
    p.v(*p3)
    p.v(*ret_to_x(p3, (t1[0] - tt[0], t1[1] - tt[1]), vx))
    rr = 18
    p.circle(vx - rr, 36, rr, 0, -360, 96)
    p.v(vx, 0)
    # り — 철사 → 오른획 쓸어올림 ↗ → 오른획 ↑ → 대각 ↙ → 왼획 갈고리 → 왼획 ↑ 끝
    rx = ox + 120
    p.v(rx + 18, 0).v(rx + 52, 42).v(rx + 52, 120).v(rx, 22).v(rx, 116)
    return p


def to_k(W):
    """トナリ"""
    R = W
    G = 2 * W
    p = Pen(R)
    # ト — 점 끝에서 시작(주홍) ↖, 기둥을 올라 머리에서 되접혀(머리핀) 내려와 발 → 철사
    x = 16 + G
    p.v(x + 34, 58).v(x, 76).v(x, 128).v(x - G, 128).v(x - G, 0)
    # ナ — 발 ↗(ト의 점 아래로 파고듦) 기둥 ↑(가로획과 매듭) → 머리핀 → 가로획 → リ
    sx = 122
    p.v(66, 0).v(sx, 54).v(sx, 130).v(sx - G, 130).v(sx - G, 88)
    # リ — 가로획이 꺾여 왼획 ↓ → 반원 갈고리 → ↗ → 오른획 ↓ 쓸어내림
    rx = 190
    rr = rx + G + 40
    p.v(rx, 88).v(rx, 26).v(rx + G, 26).v(rx + G, 44).v(rr, 120).v(rr, 52).v(rx + G + 4, -8)
    return p


WORDS = {
    # R의 감기: 첫 교차는 주머니가 위, 둘째는 기둥이 위(번갈아 → 감은 매듭)
    "tonari": dict(fn=tonari, over={0: "late", 1: "early"}),
    "tonari-hira": dict(fn=to_w, over={}),
    "tonari-kata": dict(fn=to_k, over={}),
}


def make(word, W, accent_len=None):
    spec = WORDS[word]
    pen = spec["fn"](W)
    La = accent_len or 2.2 * W
    res = build(pen.pts, W, over=spec.get("over"), accent=("start", La), radii=pen.radii)
    return res


def svg_of(res, fg, bg, acc, pad=12, scale=1.0, title=""):
    b = res["body"].bounds
    minx, miny, maxx, maxy = b
    w = (maxx - minx) + 2 * pad
    h = (maxy - miny) + 2 * pad
    ox = -minx + pad
    oy = maxy + pad
    d_body = poly_to_d(res["body"], 1, 1, ox, oy)
    d_acc = poly_to_d(res["accent"], 1, 1, ox, oy)
    bgrect = f'<rect width="{w:.2f}" height="{h:.2f}" fill="{bg}"/>' if bg else ""
    return (f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {w:.2f} {h:.2f}" '
            f'role="img" aria-label="{title}">{bgrect}'
            f'<path fill="{fg}" fill-rule="evenodd" d="{d_body}"/>'
            f'<path fill="{acc}" fill-rule="evenodd" d="{d_acc}"/></svg>')


def debug_svg(res, W):
    """중심선·교차 표시 디버그."""
    b = res["body"].bounds
    pad = 20
    minx, miny, maxx, maxy = b
    w = (maxx - minx) + 2 * pad
    h = (maxy - miny) + 2 * pad
    ox, oy = -minx + pad, maxy + pad
    pts = " ".join(f"{ox + x:.1f},{oy - y:.1f}" for x, y in res["line"].coords)
    marks = "".join(f'<circle cx="{ox + P[0]:.1f}" cy="{oy - P[1]:.1f}" r="3" fill="red"/>'
                    for _, _, P in res["crossings"])
    return (f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {w:.1f} {h:.1f}">'
            f'<rect width="{w:.1f}" height="{h:.1f}" fill="{SNOW}"/>'
            f'<path fill="{NIGHT}" fill-rule="evenodd" d="{poly_to_d(res["body"], 1, 1, ox, oy)}"/>'
            f'<path fill="{SHU}" d="{poly_to_d(res["accent"], 1, 1, ox, oy)}"/>'
            f'<polyline points="{pts}" fill="none" stroke="#2a9" stroke-width="0.8"/>{marks}</svg>')


TITLES = {"tonari": "TONARI", "tonari-hira": "となり", "tonari-kata": "トナリ"}
SIZES = {"": 10.0, "-small": 13.0}   # 본판 W=10, 24px용 굵은 판 W=13 (R=W 동일 규칙)


def export(outdir):
    """svg/<word>[-small]-<light|dark>.svg 와 metrics.json 을 쓴다."""
    os.makedirs(outdir, exist_ok=True)
    meta = {}
    for suf, W in SIZES.items():
        for word in WORDS:
            res = make(word, W)
            if res["warn"]:
                raise SystemExit(f"{word}{suf}: 모서리 굴림이 선분을 넘음 {res['warn']}")
            for mode, fg in (("light", NIGHT), ("dark", SNOW)):
                svg = svg_of(res, fg, None, SHU, pad=W, title=TITLES[word])
                with open(os.path.join(outdir, f"{word}{suf}-{mode}.svg"), "w") as f:
                    f.write(svg + "\n")
            x0, y0, x1, y1 = res["body"].bounds
            meta[word + suf] = dict(W=W, R=W, gap_fold=W, gap_knot=W / 2,
                                    knots=len(res["crossings"]),
                                    length=round(res["line"].length, 1),
                                    width=round(x1 - x0, 1), height=round(y1 - y0, 1))
    with open(os.path.join(outdir, "metrics.json"), "w") as f:
        json.dump(meta, f, ensure_ascii=False, indent=1)
        f.write("\n")
    return meta


CARD_CSS = """
:root{--night:#151b2c;--snow:#eef0f4;--shu:#d4462a;--ink2:#5a6275}
*{box-sizing:border-box}body{margin:0;background:#dfe2e8;font:14px/1.5 -apple-system,'Noto Sans KR','Hiragino Sans',sans-serif;color:var(--night)}
.wrap{width:1500px;padding:28px}
h1{font-size:22px;margin:0 0 4px}.rule{color:var(--ink2);margin:0 0 18px}
.panel{border-radius:10px;padding:34px 40px;margin:0 0 16px;display:flex;align-items:flex-end;gap:56px;flex-wrap:wrap}
.light{background:var(--snow)}.dark{background:var(--night)}
.cap{font-size:12px;color:var(--ink2);margin:6px 0 0}.dark .cap{color:#9aa3b5}
.row{display:flex;gap:16px;margin:0 0 16px}
.hdr{flex:1;border-radius:8px;height:56px;display:flex;align-items:center;gap:22px;padding:0 20px}
.hdr .lbl{font-size:12px;color:var(--ink2)}.hdr.dark .lbl{color:#9aa3b5}
.cover{background:var(--night);border-radius:10px;padding:40px 44px 34px;margin:0 0 16px}
.cover .meta{color:#9aa3b5;font-size:13px;display:flex;justify-content:space-between;margin-top:18px}
.cons{background:var(--snow);border-radius:10px;padding:24px 40px;display:flex;gap:40px;align-items:center}
.cons p{margin:0;max-width:520px;color:var(--ink2)}
"""


def write_card(meta):
    """card.html — 큰 크기 명/암, 24px 헤더(본판·굵은 판), 표지 제호 크기, 작도."""
    k = 1.55  # px per unit (큰 크기)
    def img(name, unit_k=k, extra=""):
        m = meta[name.rsplit("-", 1)[0]] if name.rsplit("-", 1)[0] in meta else None
        h = (m["height"] + 2 * m["W"]) * unit_k
        return f'<img src="svg/{name}.svg" style="height:{h:.1f}px{extra}" alt="">'
    def at24(word, suf, mode):
        m = meta[word + suf]
        hh = 24.0
        return f'<img src="svg/{word}{suf}-{mode}.svg" style="height:{hh}px" alt="">'
    big_l = "".join(f'<div>{img(w + "-light")}<div class="cap">{TITLES[w]}</div></div>' for w in WORDS)
    big_d = "".join(f'<div>{img(w + "-dark")}<div class="cap">{TITLES[w]}</div></div>' for w in WORDS)
    def hdr(mode):
        cells = []
        for suf, lab in (("", "본판 W10"), ("-small", "굵은 판 W13")):
            cells.append(f'<span class="lbl">{lab}</span>' + "".join(at24(w, suf, mode) for w in WORDS))
        return f'<div class="hdr {mode}">' + "".join(cells) + "</div>"
    cover_w = 1330
    m = meta["tonari"]
    cover_h = (m["height"] + 2 * m["W"]) * cover_w / (m["width"] + 2 * m["W"])
    html = f"""<!doctype html><html lang="ko"><head><meta charset="utf-8"><title>L2 一筆</title>
<style>{CARD_CSS}</style></head><body><div class="wrap">
<h1>L2 一筆 — 끊기지 않는 한 줄</h1>
<p class="rule">규칙: 굵기 W 하나·모서리 반경 R=W 하나로 단어 전체를 한 줄로 그린다. 글자들은 바닥의 '철사'로 이어지고, 획 끝이 남는 곳은 W 간격으로 되접히며(혀·머리핀), 교차는 위 가닥 양옆을 0.5W 끊어 매듭으로 보인다. 시작점 2.2W만 주홍.</p>
<div class="panel light">{big_l}</div>
<div class="panel dark">{big_d}</div>
<div class="row">{hdr("light")}</div>
<div class="row">{hdr("dark")}</div>
<div class="cover"><img src="svg/tonari-dark.svg" style="width:{cover_w}px;height:{cover_h:.1f}px" alt="">
<div class="meta"><span>表紙 제호 크기 — 폭 {cover_w}px</span><span>となり · トナリ 는 같은 W·R</span></div></div>
<div class="cons"><img src="construction.svg" style="height:200px" alt=""><p>작도: 초록 중심선 하나가 전부다. O는 철사에 접해 구르는 고리, N과 A는 사선 하나를 나눠 쓰는 이웃(벽 한 장), A의 가로대는 오른다리에서 내민 혀가 왼다리에 닿은 것, R의 주머니는 기둥을 한 번 감아(매듭 둘) 다리로 나간다.</p></div>
</div></body></html>
"""
    with open(os.path.join(HERE, "card.html"), "w") as f:
        f.write(html)


if __name__ == "__main__":
    import argparse
    ap = argparse.ArgumentParser()
    ap.add_argument("--debug", help="디버그 SVG 출력 디렉터리")
    ap.add_argument("--w", type=float, default=10)
    args = ap.parse_args()
    W = args.w
    if not args.debug:
        meta = export(os.path.join(HERE, "svg"))
        with open(os.path.join(HERE, "construction.svg"), "w") as f:
            f.write(debug_svg(make("tonari", 10.0), 10.0) + "\n")
        write_card(meta)
        print(json.dumps(meta, ensure_ascii=False))
        sys.exit(0)
    for word in WORDS:
        res = make(word, W)
        if res["warn"]:
            print(word, "fillet warn", res["warn"])
        print(word, "crossings", len(res["crossings"]))
        if args.debug:
            os.makedirs(args.debug, exist_ok=True)
            with open(os.path.join(args.debug, word + ".svg"), "w") as f:
                f.write(debug_svg(res, W))
