#!/usr/bin/env python3
# 『となり』 브랜드 마크 패밀리 F2 「클래식 에디토리얼」 — 2026-10-15 KST
#
# 한 줄: 디돈 세리프(라틴)와 올드 명조(가나)를 '세로 강세·가로:세로 = 7:20' 한 붓 원리로 다시 칠한 가족.
#
# 사용(리포 루트):
#   python3 -I docs/japanology/magazine/brand/marks/families/F2-editorial/build-f2.py
#     → svg/*.svg, card.html, family.json
#   export PATH=/opt/node24/bin:$PATH
#   node <스크래치패드>/shotfull.cjs docs/.../F2-editorial/card.html docs/.../F2-editorial/card.png 1500
# 서체: google/fonts 고정 커밋에서 받아 SHA256을 검증하고 캐시(TONARI_FONT_CACHE, 기본 임시 폴더/tonari-f2-fonts)에 둔다.
#       리포에 서체 파일은 두지 않는다. 결정적: 같은 서체면 바이트 단위로 같은 산출물.
import hashlib, json, math, os, sys, tempfile, urllib.request

sys.dont_write_bytecode = True
HERE = os.path.dirname(os.path.abspath(__file__))
CACHE = os.environ.get('TONARI_FONT_CACHE') or os.path.join(tempfile.gettempdir(), 'tonari-f2-fonts')
NIGHT, SNOW, VERMILION = '#151b2c', '#eef0f4', '#d4462a'

# ── 출발 서체(모두 SIL OFL 1.1) ────────────────────────────────────────────────────────
GF = 'https://raw.githubusercontent.com/google/fonts/67bc647ce1910e92f461bcc82aae30f21d21a9cc/ofl/'
FONTS = {
    'bodoni': ('bodonimoda/BodoniModa%5Bopsz,wght%5D.ttf', '550f5e34ee0a828d7941b1fe9bc58b34e5260d3f33a61532e6d0a0114e79a5cf'),
    'zenold-bold': ('zenoldmincho/ZenOldMincho-Bold.ttf', 'd6b95c1ff45c8dac153d28961e4c37d7d03b648330c71f884d124dc652a13c0d'),
}

# ── 가족 원리(숫자) — 단위: 라틴 대문자 높이 H = 750 ───────────────────────────────────
H = 750
STEM = 130            # ① 세로 기둥 = 라틴 I 기둥 = 가나에서 가장 굵은 세로 획(り 오른 획). 가나 붓 확장량은 이 실측으로 계산
HAIR = 45.5           # ② 가로 헤어라인 = T 팔 = ナ 가로획.  HAIR/STEM = 0.35 (7:20)
KANA_H = 1.06         # ③ 가나 잉크 높이 = H × 1.06, 대문자 높이 가운데에 중심을 맞춘다(위아래 0.03H씩 넘침)
TRACK = 0             # ④ 라틴 간격 = Bodoni 자체 너비 그대로(자간 0, 커닝 없음) — 디자이너의 리듬을 기준으로 삼는다
DEPTH = 2.0           #    리듬 계량: 이웃 윤곽 사이 흰 깊이(상한 STEM × 2.0, 겹침은 음수)의 평균 = G
MINGAP = 0.75         # ⑤ 가나 간격: 쌍마다 흰 깊이 평균 = TONARI 다섯 쌍의 G, 단 가장 가까운 가로 거리 ≥ STEM × 0.75(TONARI 최근접 거리 중앙값 116 ≈ 0.9 STEM보다 조금 좁게)
ACC_D, ACC_RING, ACC_GAP = 1.15, 1.9, 0.6   # ⑥ 주홍 문장부호: 점 지름 = 기둥×1.15, 구점 고리 바깥 지름 = 기둥×1.9, 앞 글자와 잉크 거리 = 기둥×0.6
BODONI_LOC = {'wght': 597, 'opsz': 6}   # 가장 작은 광학 크기 = 헤어라인이 가장 굵은 Bodoni


def font_path(key):
    rel, sha = FONTS[key]
    os.makedirs(CACHE, exist_ok=True)
    p = os.path.join(CACHE, rel.split('/')[-1].replace('%5B', '[').replace('%5D', ']'))
    if not os.path.exists(p):
        print('download', GF + rel, file=sys.stderr)
        urllib.request.urlretrieve(GF + rel, p)
    h = hashlib.sha256(open(p, 'rb').read()).hexdigest()
    if h != sha:
        sys.exit(f'SHA256 불일치 {p}: {h}')
    return p


_T = {}


KANA_FONT = 'zenold-bold'   # Black도 붓 뒤 결과가 거의 같았다 — 덧붙는 획 머리가 적은 Bold를 채택


def load(key, ch):
    if key == 'zenold':
        key = KANA_FONT
    """윤곽 = [[x, y, on], ...] 목록(1000 단위, y 위쪽)."""
    if key not in _T:
        from fontTools.ttLib import TTFont
        t = TTFont(font_path(key))
        if key == 'bodoni':
            from fontTools.varLib.instancer import instantiateVariableFont
            t = instantiateVariableFont(t, BODONI_LOC)
        _T[key] = t
    t = _T[key]; glyf = t['glyf']; k = 1000 / t['head'].unitsPerEm
    g = glyf[t.getBestCmap()[ord(ch)]]
    co, ends, fl = g.getCoordinates(glyf)
    out, s = [], 0
    for e in ends:
        out.append([[co[i][0] * k, co[i][1] * k, bool(fl[i] & 1)] for i in range(s, e + 1)]); s = e + 1
    return out


# ── 윤곽 연산 ────────────────────────────────────────────────────────────────────────
def xform(cs, s=1.0, dx=0.0, dy=0.0):
    return [[[p[0] * s + dx, p[1] * s + dy, p[2]] for p in c] for c in cs]


def brush(cs, ax, ay, span=1):
    """비등방 윤곽 확장 = '세로 강세 붓'. 세로 변은 ax, 가로 변은 ay만큼(한쪽) 밀고,
    기운 변은 법선 성분 제곱으로 보간(d = ax·nx² + ay·ny²). 꺾임 32~107°의 모서리만 두 변 오프셋 선의 교점(마이터, 상한 3배)."""
    out = []
    for c in cs:
        n = len(c); nc = []
        for i in range(n):
            a, b, e = c[(i - span) % n], c[i], c[(i + span) % n]

            def nor(u, v):
                dx, dy = v[0] - u[0], v[1] - u[1]; L = math.hypot(dx, dy)
                return None if L < 1e-9 else (-dy / L, dx / L)
            n1, n2 = nor(a, b), nor(b, e)
            n1 = n1 or n2; n2 = n2 or n1
            if n1 is None:
                nc.append(b[:]); continue
            d1 = ax * n1[0] ** 2 + ay * n1[1] ** 2
            d2 = ax * n2[0] ** 2 + ay * n2[1] ** 2
            cosang = n1[0] * n2[0] + n1[1] * n2[1]
            if cosang < -0.3:
                # 107° 넘게 꺾이는 뾰족한 끝(붓 끝·꼬리): 마이터를 쓰면 가시가 생긴다 → 두 변 오프셋의 평균만
                vx = (n1[0] * d1 + n2[0] * d2) / 2; vy = (n1[1] * d1 + n2[1] * d2) / 2
            elif cosang > 0.85:
                # 매끈한 곳(32° 미만 꺾임): 이등분 법선에서 d를 재고 반각으로 나눈다(두 직선 교점은 거의 평행이라 불안정)
                mx, my = n1[0] + n2[0], n1[1] + n2[1]; L = math.hypot(mx, my); mx, my = mx / L, my / L
                d = (ax * mx * mx + ay * my * my) / max(0.5, mx * n1[0] + my * n1[1])
                vx, vy = mx * d, my * d
            else:
                det = n1[0] * n2[1] - n1[1] * n2[0]
                vx = (d1 * n2[1] - d2 * n1[1]) / det
                vy = (n1[0] * d2 - n2[0] * d1) / det
            lim = 3 * max(abs(ax), abs(ay)); L = math.hypot(vx, vy)
            if L > lim:
                vx, vy = vx / L * lim, vy / L * lim
            nc.append([b[0] + vx, b[1] + vy, b[2]])
        out.append(nc)
    return out


RASTER_K = 3   # 래스터 정리: 1단위 = 3px
SMOOTH_PASSES = 6
BRUSH_SPAN = 6   # 붓 방향(법선)을 ±6점(=±6단위) 떨어진 이웃에서 잰다 — 래스터 윤곽의 방향 계단을 붓이 키우지 않게
CLEAN_OPEN, CLEAN_CLOSE = 5.0, 8.0   # 단위. 열기 = 붓머리 잔가시, 닫기 = 이음매 잔홈(넓은 법선이 오목 모서리 곁을 덜 미는 자국)


def _raster(P, k, box, positive, sub=4):
    """꺾은선 윤곽 P를 k px/단위로 칠한 '덮임 비율' 영상(0~1). 가로는 구간 끝을 소수로, 세로는 한 행을 sub줄로 나눠 평균
    → 0.5 등고선이 1/(sub)px 정도로 정확해 계단이 생기지 않는다. positive=True면 감김 > 0만, 아니면 감김 ≠ 0."""
    import numpy as np
    x0, y0, W, Hh = box
    seg = np.array([(a[0], a[1], b[0], b[1]) for q in P for a, b in zip(q, q[1:] + q[:1]) if a[1] != b[1]], float)
    sx0, sx1 = (seg[:, 0] - x0) * k, (seg[:, 2] - x0) * k
    sy0, sy1 = (seg[:, 1] - y0) * k, (seg[:, 3] - y0) * k
    lo_y, hi_y = np.minimum(sy0, sy1), np.maximum(sy0, sy1)
    img = np.zeros((Hh, W + 2), np.float32)
    for r in range(Hh):
        row = img[r]
        for sidx in range(sub):
            yc = r + (sidx + 0.5) / sub
            m = (lo_y <= yc) & (hi_y > yc)
            if not m.any():
                continue
            xs = sx0[m] + (yc - sy0[m]) * (sx1[m] - sx0[m]) / (sy1[m] - sy0[m])
            ds = np.where(sy1[m] > sy0[m], 1, -1)
            o = np.argsort(xs, kind='stable'); xs, ds = xs[o], ds[o]
            w = np.cumsum(ds)
            for i in range(len(xs) - 1):
                if (w[i] > 0) if positive else (w[i] != 0):
                    a_, b_ = max(xs[i], 0.0), max(xs[i + 1], 0.0)
                    if b_ <= a_:
                        continue
                    ia, ib = int(a_), int(b_)
                    if ia == ib:
                        row[ia] += (b_ - a_) / sub
                    else:
                        row[ia] += (ia + 1 - a_) / sub
                        row[ia + 1:ib] += 1.0 / sub
                        row[ib] += (b_ - ib) / sub
    return np.minimum(img[:, :W], 1.0)


def _morph(im, r, op):
    """반경 r px 팔각(십자·정사각 3×3을 번갈아) 팽창/침식 — 덮임 비율(0~1) 영상에 그대로(회색조 형태학)."""
    import numpy as np
    for i in range(r):
        sh = [(0, 1), (0, -1), (1, 0), (-1, 0)] + ([(1, 1), (1, -1), (-1, 1), (-1, -1)] if i % 2 else [])
        acc = im.copy()
        for d in sh:
            b_ = np.roll(im, d, axis=(0, 1))
            acc = np.maximum(acc, b_) if op == 'max' else np.minimum(acc, b_)
        im = acc
    return im


def _rdp(pts, eps):
    if len(pts) < 3:
        return pts
    a, b = pts[0], pts[-1]; dx, dy = b[0] - a[0], b[1] - a[1]; Ln = math.hypot(dx, dy) or 1e-9
    dm, im = -1, 0
    for i in range(1, len(pts) - 1):
        d = abs(dy * (pts[i][0] - a[0]) - dx * (pts[i][1] - a[1])) / Ln
        if d > dm:
            dm, im = d, i
    if dm > eps:
        return _rdp(pts[:im + 1], eps)[:-1] + _rdp(pts[im:], eps)
    return [a, b]


def _trace(img, k, box, min_area, eps=0.3):
    """덮임 비율 영상의 0.5 등고선(마칭 스퀘어) → RDP 0.3px → 단위 좌표 꺾은선. 넓이 min_area(단위²) 미만 섬은 버린다."""
    import numpy as np
    x0, y0, W, Hh = box
    f = np.pad(img.astype(float), 2)
    tl, tr, br, bl = f[:-1, :-1], f[:-1, 1:], f[1:, 1:], f[1:, :-1]
    case = (tl > .5) * 8 + (tr > .5) * 4 + (br > .5) * 2 + (bl > .5) * 1
    rr, cc = np.nonzero((case > 0) & (case < 15))

    def ip(r1, c1, r2, c2):
        v1, v2 = f[r1, c1], f[r2, c2]; t = (0.5 - v1) / (v2 - v1)
        return (float(c1 + (c2 - c1) * t), float(r1 + (r2 - r1) * t))
    TAB = {1: [('L', 'B')], 2: [('B', 'R')], 3: [('L', 'R')], 4: [('R', 'T')], 5: [('L', 'T'), ('R', 'B')],
           6: [('B', 'T')], 7: [('L', 'T')], 8: [('T', 'L')], 9: [('T', 'B')], 10: [('T', 'R'), ('B', 'L')],
           11: [('T', 'R')], 12: [('R', 'L')], 13: [('R', 'B')], 14: [('B', 'L')]}

    def ekey(r, c, e):
        return {'T': ('h', r, c), 'B': ('h', r + 1, c), 'L': ('v', r, c), 'R': ('v', r, c + 1)}[e]

    def epos(key):
        t, r, c = key
        return ip(r, c, r, c + 1) if t == 'h' else ip(r, c, r + 1, c)
    nxt = {}
    for r, c in zip(rr.tolist(), cc.tolist()):
        cs_ = int(case[r, c]); pairs = TAB[cs_]
        if cs_ in (5, 10) and (tl[r, c] + tr[r, c] + br[r, c] + bl[r, c]) / 4 > .5:
            pairs = [('L', 'B'), ('R', 'T')] if cs_ == 5 else [('T', 'L'), ('B', 'R')]
        for e1, e2 in pairs:
            nxt[ekey(r, c, e1)] = ekey(r, c, e2)
    out, seen = [], set()
    for st in sorted(nxt):
        if st in seen:
            continue
        L = []; cur = st
        while cur not in seen:
            seen.add(cur); L.append(epos(cur)); cur = nxt[cur]
        U = [(x0 + (px - 2 + 0.5) / k, y0 + (py - 2 + 0.5) / k) for px, py in L]
        area = sum(U[i - 1][0] * U[i][1] - U[i][0] * U[i - 1][1] for i in range(len(U))) / 2
        if abs(area) < min_area:
            continue
        i0 = min(range(len(L)), key=lambda i: (L[i][1], L[i][0]))
        L = L[i0:] + L[:i0]
        j = max(range(len(L)), key=lambda i: (L[i][0] - L[0][0]) ** 2 + (L[i][1] - L[0][1]) ** 2)
        S = _rdp(L[:j + 1], eps)[:-1] + _rdp(L[j:] + [L[0]], eps)[:-1]   # 닫힌 고리: 가장 먼 점에서 둘로 나눠 줄인다
        out.append([[round(x0 + (px - 2 + 0.5) / k, 3), round(y0 + (py - 2 + 0.5) / k, 3), True] for px, py in S])
    # 방향을 TrueType 관례(바깥 윤곽 시계 방향, y 위쪽 = 넓이 음수)로 맞춘다
    sa = lambda c: sum(c[i - 1][0] * c[i][1] - c[i][0] * c[i - 1][1] for i in range(len(c))) / 2
    if out and sa(max(out, key=lambda c: abs(sa(c)))) > 0:
        out = [c[::-1] for c in out]
    return out


def _smooth(c, step):
    """닫힌 꺾은선을 step 단위 간격으로 다시 찍고 [1,2,3,2,1]/9 가중 평균을 SMOOTH_PASSES번(6번 = σ≈2.8단위)
    — 래스터에서 딴 윤곽의 잔물결을 지운다(붓이 잔물결을 혹으로 키운다, 실측 2026-10-15 KST)."""
    pts = [(p[0], p[1]) for p in c] + [(c[0][0], c[0][1])]
    out = []; carry = 0.0
    for a, b in zip(pts, pts[1:]):
        L = math.hypot(b[0] - a[0], b[1] - a[1]); t = carry
        while t < L:
            out.append((a[0] + (b[0] - a[0]) * t / L, a[1] + (b[1] - a[1]) * t / L)); t += step
        carry = t - L
    n = len(out)
    for _ in range(SMOOTH_PASSES):
        out = [tuple(sum(w * out[(i + j) % n][d] for j, w in zip(range(-2, 3), (1, 2, 3, 2, 1))) / 9 for d in (0, 1)) for i in range(n)]
    return [[x, y, True] for x, y in out]


def raster_brush(cs, ax, ay, k=RASTER_K):
    """가나용 '세로 강세 붓'. 벡터 비등방 오프셋을 서체 윤곽에 바로 걸면 겹친 획의 이음매와 작은 둥근 붓머리에서
    가시·고리·홈이 생긴다(실측 2026-10-15 KST). 그래서
    (1) 서체 윤곽을 칠해(감김 ≠ 0) 겹친 획을 한 윤곽으로 합쳐 다시 따고, 1단위 간격으로 찍어 가볍게 다듬는다(σ≈1.4단위)
    (2) 가로 팽창(d = ax·nx²) 다음 세로 침식(d = ay·ny², ay < 0)을 따로 건다(법선은 ±BRUSH_SPAN점 이웃에서)
    (3) 다시 칠하되 감김 > 0만 잉크로 친다 — 침식이 붓머리에서 만드는 뒤집힌 고리(감김 −1)가 빠진다
    (4) 열기(CLEAN_OPEN)·닫기(CLEAN_CLOSE)로 잔가시·잔홈을 지우고 넓이 400단위² 미만 섬을 버린 뒤
    (5) 덮임 비율의 0.5 등고선을 마칭 스퀘어로 따고, 다시 다듬어(σ≈2.8단위) RDP 0.1단위로 줄인다(직선 조각 윤곽)."""
    P = [flat(c, 64)[:-1] for c in cs]   # 2차 곡선 1개 = 64조각(12조각이면 긴 꼬리에서 8단위 꺾은선이 붓 혹이 된다)
    allp = [p for q in P for p in q]
    pad = abs(ax) + abs(ay) + 20
    x0 = min(p[0] for p in allp) - pad; y0 = min(p[1] for p in allp) - pad
    x1 = max(p[0] for p in allp) + pad; y1 = max(p[1] for p in allp) + pad
    box = (x0, y0, int(math.ceil((x1 - x0) * k)), int(math.ceil((y1 - y0) * k)))
    union = _trace(_raster(P, k, box, False), k, box, 400, eps=0.02)   # 겹친 획 윤곽을 하나로 합친다(줄이지 않음)
    dense = [_smooth(c, 1.0) for c in union]   # 1단위 간격 + 가벼운 평균
    poly = brush(brush(dense, ax, 0.0, BRUSH_SPAN), 0.0, ay, BRUSH_SPAN)
    img = _raster([[(p[0], p[1]) for p in c] for c in poly], k, box, True)
    ro, rc = int(round(CLEAN_OPEN * k)), int(round(CLEAN_CLOSE * k))
    img = _morph(_morph(img, ro, 'min'), ro, 'max')   # 열기: 붓머리·꼬리 끝의 잔가시(폭 < 2×CLEAN_OPEN)를 지운다
    img = _morph(_morph(img, rc, 'max'), rc, 'min')   # 닫기: 획 이음매의 잔홈을 메운다
    out = []
    for c in _trace(img, k, box, 400, eps=0.02):     # 팔각 형태학의 모서리 각을 다시 다듬고 0.1단위로 줄인다
        L = [(p[0], p[1]) for p in _smooth(c, 1.0)]
        j = max(range(len(L)), key=lambda i: (L[i][0] - L[0][0]) ** 2 + (L[i][1] - L[0][1]) ** 2)
        S = _rdp(L[:j + 1], 0.1)[:-1] + _rdp(L[j:] + [L[0]], 0.1)[:-1]
        out.append([[round(x, 2), round(y, 2), True] for x, y in S])
    return out


def flat(c, steps=12):
    n = len(c); st = next((i for i in range(n) if c[i][2]), None)
    if st is None:
        c = [[(c[0][0] + c[1][0]) / 2, (c[0][1] + c[1][1]) / 2, True]] + c; st = 0
    q = c[st:] + c[:st] + [c[st]]
    prev = (q[0][0], q[0][1]); pts = [prev]; k = 1
    while k < len(q):
        p = q[k]
        if p[2]:
            prev = (p[0], p[1]); pts.append(prev); k += 1
        else:
            r = q[k + 1] if k + 1 < len(q) else q[0]
            e = (r[0], r[1]) if r[2] else ((p[0] + r[0]) / 2, (p[1] + r[1]) / 2)
            for i in range(1, steps + 1):
                u = i / steps
                pts.append(((1 - u) ** 2 * prev[0] + 2 * (1 - u) * u * p[0] + u * u * e[0],
                            (1 - u) ** 2 * prev[1] + 2 * (1 - u) * u * p[1] + u * u * e[1]))
            prev = e; k += 2 if r[2] else 1
    return pts


def crossings(cs, axis, v):
    xs = []
    for c in cs:
        P = flat(c)
        for a, b in zip(P, P[1:]):
            if axis == 'h' and (a[1] <= v) != (b[1] <= v):
                xs.append(a[0] + (v - a[1]) * (b[0] - a[0]) / (b[1] - a[1]))
            if axis == 'v' and (a[0] <= v) != (b[0] <= v):
                xs.append(a[1] + (v - a[0]) * (b[1] - a[1]) / (b[0] - a[0]))
    return sorted(xs)


def runs(cs, axis, v):
    """잉크 구간(겹친 윤곽은 합쳐서) [(시작, 길이)]. 0이 아닌 감김 규칙 대신 구간 합집합으로 근사."""
    segs = []
    for c in cs:
        xs = crossings([c], axis, v)
        segs += [(xs[i], xs[i + 1]) for i in range(0, len(xs) - 1, 2)]
    segs.sort(); m = []
    for s in segs:
        if m and s[0] <= m[-1][1]:
            m[-1][1] = max(m[-1][1], s[1])
        else:
            m.append([s[0], s[1]])
    return [(round(a, 1), round(b - a, 1)) for a, b in m]


def bbox(cs):
    P = [p for c in cs for p in flat(c)]
    return min(p[0] for p in P), min(p[1] for p in P), max(p[0] for p in P), max(p[1] for p in P)


# ── 글자 준비 ────────────────────────────────────────────────────────────────────────
LOG = {}


def latin(ch):
    cs = load('bodoni', ch)
    # 붓 확장량(LAT_AX, LAT_AY)은 build()에서 실측으로 계산
    return brush(cs, LAT_AX, LAT_AY)


KANA_REF = 'ト'


def kana_scale():
    x0, y0, x1, y1 = bbox(load('zenold', KANA_REF))
    return H * KANA_H / (y1 - y0)


def kana(ch):
    s = kana_scale()
    cs = xform(load('zenold', ch), s)
    return raster_brush(cs, KANA_AX, KANA_AY)


def stroke_stats(get):
    """get(ch) → 윤곽(가나는 배율 뒤 좌표). 반환: (기둥 평균, 헤어라인 최소, 세부)."""
    import statistics
    s = kana_scale()
    med = lambda xs: statistics.median(xs)
    to = get('ト'); ri = get('リ'); rh = get('り'); na = get('ナ')
    st = {'ト 기둥': med([runs(to, 'h', y * s)[0][1] for y in range(220, 641, 20)]),
          'リ 오른 획': med([runs(ri, 'h', y * s)[-1][1] for y in range(300, 601, 20)]),
          'り 오른 획': med([runs(rh, 'h', y * s)[-1][1] for y in range(300, 541, 20)])}
    hr = {'ナ 가로획(최소)': min(r[1] for x in range(600, 701, 10) for r in runs(na, 'v', x * s) if 380 * s < r[0] < 470 * s)}
    return max(st.values()), min(hr.values()), {k: round(v, 1) for k, v in {**st, **hr}.items()}   # 가장 굵은 세로 획 = 기둥(라틴 I와 같은 자리)


def latin_stats(get):
    import statistics
    I = get('I'); T = get('T')
    st = statistics.median([runs(I, 'h', y)[0][1] for y in range(150, 601, 25)])
    hr = min(runs(T, 'v', x)[-1][1] for x in range(120, 241, 10))
    return st, hr, {'I 기둥': round(st, 1), 'T 팔(최소)': round(hr, 1)}


# ── 배치(면적 간격) ──────────────────────────────────────────────────────────────────
def profile(cs, y0, y1, n=80):
    L, R = [], []
    for i in range(n):
        y = y0 + (y1 - y0) * (i + 0.5) / n
        xs = crossings(cs, 'h', y)
        L.append(xs[0] if xs else None); R.append(xs[-1] if xs else None)
    return L, R


def pair_fn(left, right, y0, y1):
    """오른쪽 글자를 X만큼 옮겼을 때 (흰 깊이 평균, 가장 가까운 가로 거리) 함수. 흰 깊이는 상한 D에서 자르고 겹침은 음수."""
    D = STEM * DEPTH
    _, Rp = profile(left, y0, y1)
    Lq, _ = profile(right, y0, y1)
    rmax = max(r for r in Rp if r is not None)
    lmin = min(l for l in Lq if l is not None)

    def mean_gap(X):
        g = []
        for r, l in zip(Rp, Lq):
            rr = r if r is not None else rmax - D
            ll = (l + X) if l is not None else lmin + X + D
            g.append(min(ll - rr, D))
        return sum(g) / len(g)

    def min_gap(X):
        return min(l + X - r for r, l in zip(Rp, Lq) if r is not None and l is not None)
    return mean_gap, min_gap, rmax - lmin


def adv(ch):
    t = _T['bodoni']; return t['hmtx'][t.getBestCmap()[ord(ch)]][0] * 1000 / t['head'].unitsPerEm


def set_latin(text, y0, y1):
    """라틴: Bodoni 자체 너비 + 자간 TRACK(커닝 없음). 그 결과의 흰 깊이 평균을 잰다 → 가족 리듬 G."""
    out, x, gs = [], 0.0, []
    for i, ch in enumerate(text):
        g = xform(latin(ch), 1, x)
        if out:
            mg, mn, _ = pair_fn(out[-1], g, y0, y1)
            gs.append({'pair': text[i - 1:i + 1], 'mean': round(mg(0), 1), 'min': round(mn(0), 1)})
        out.append(g); x += adv(ch) + TRACK
    return out, gs


def set_kana(glyphs, text, y0, y1, G, adj=None):
    """가나: 쌍마다 흰 깊이 평균 = G(라틴에서 잰 값), 단 가장 가까운 가로 거리 ≥ STEM × MINGAP."""
    adj = adj or {}
    out, gs = [glyphs[0]], []
    for i in range(1, len(glyphs)):
        mg, mn, base = pair_fn(out[-1], glyphs[i], y0, y1)
        lo, hi = base - 3 * STEM, base + 3 * STEM
        for _ in range(60):
            mid = (lo + hi) / 2
            lo, hi = (mid, hi) if mg(mid) < G else (lo, mid)
        Xa = (lo + hi) / 2
        Xm = Xa + max(0.0, STEM * MINGAP - mn(Xa))
        X = Xm + adj.get(i, 0)
        gs.append({'pair': text[i - 1:i + 1], 'mean': round(mg(X), 1), 'min': round(mn(X), 1),
                   'by': 'area' if Xm == Xa else 'min', 'adj': adj.get(i, 0)})
        out.append(xform(glyphs[i], 1, X))
    return out, gs


def dot(cx, cy, r, n=16):
    """원(2차 베지어 16조각)."""
    pts = []
    for i in range(n):
        a = 2 * math.pi * i / n; b = a + math.pi / n
        pts.append([cx + r * math.cos(a), cy + r * math.sin(a), True])
        rr = r / math.cos(math.pi / n)
        pts.append([cx + rr * math.cos(b), cy + rr * math.sin(b), False])
    return [pts[::-1]]   # 시계 방향(잉크)


def ring(cx, cy, r_out, w):
    return dot(cx, cy, r_out) + [list(reversed(dot(cx, cy, r_out - w)[0]))]


# ── SVG ──────────────────────────────────────────────────────────────────────────────
def fmt(v):
    s = f'{v:.2f}'.rstrip('0').rstrip('.')
    return '0' if s in ('-0', '') else s


def to_d(cs, tf):
    d = []
    for c in cs:
        n = len(c); st = next((i for i in range(n) if c[i][2]), None)
        pts = c[st:] + c[:st] if st is not None else [[(c[0][0] + c[1][0]) / 2, (c[0][1] + c[1][1]) / 2, True]] + c
        P = lambda p: ' '.join(fmt(v) for v in tf(p[0], p[1]))
        d.append(f'M{P(pts[0])}')
        seq = pts[1:] + [pts[0]]; k = 0
        while k < len(seq):
            p = seq[k]
            if p[2]:
                d.append(f'L{P(p)}'); k += 1
            else:
                q = seq[k + 1] if k + 1 < len(seq) else pts[0]
                if q[2]:
                    d.append(f'Q{P(p)} {P(q)}'); k += 2
                else:
                    d.append(f'Q{P(p)} {P([(p[0] + q[0]) / 2, (p[1] + q[1]) / 2])}'); k += 1
        d.append('Z')
    return ''.join(d)


def svg(parts, label, ink, accent=VERMILION, pad=0):
    """parts: [(윤곽, 'ink'|'accent')]. 잉크 상자로 자르고, 단위 1/10 = 1px."""
    allc = [c for cs, _ in parts for c in cs]
    x0, y0, x1, y1 = bbox(allc)
    tf = lambda x, y: ((x - x0 + pad) / 10, (y1 - y + pad) / 10)
    W, Hh = (x1 - x0 + 2 * pad) / 10, (y1 - y0 + 2 * pad) / 10
    body = ''
    for role, col in (('ink', ink), ('accent', accent)):
        d = ''.join(to_d(cs, tf) for cs, r in parts if r == role)
        if d:
            body += f'<path fill="{col}" d="{d}"/>'
    return (f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {fmt(W)} {fmt(Hh)}" width="{fmt(W)}" height="{fmt(Hh)}" '
            f'role="img" aria-label="{label}">{body}</svg>'), W, Hh, (x0, y0, x1, y1)


# ── 세 마크 ──────────────────────────────────────────────────────────────────────────
KANA_AX = KANA_AY = LAT_AX = LAT_AY = 0.0
KANA_ADJ = {'となり': {}, 'トナリ': {}}   # 손 간격 보정(단위) — NOTES에 기록


def build():
    global KANA_AX, KANA_AY, LAT_AX, LAT_AY
    # 붓 확장량은 손 수치가 아니라 실측에서 계산: (목표 − 원래)/2 (한쪽)
    s = kana_scale()
    k_st, k_hr, k_raw = stroke_stats(lambda ch: xform(load('zenold', ch), s))
    l_st, l_hr, l_raw = latin_stats(lambda ch: load('bodoni', ch))
    KANA_AX, KANA_AY = (STEM - k_st) / 2, (HAIR - k_hr) / 2
    LAT_AX, LAT_AY = (STEM - l_st) / 2, (HAIR - l_hr) / 2
    LOG['kana_scale'] = round(s, 4)
    LOG['raw'] = {'kana': k_raw, 'latin': l_raw}
    LOG['brush_ax_ay'] = {'kana': [round(KANA_AX, 2), round(KANA_AY, 2)], 'latin': [round(LAT_AX, 2), round(LAT_AY, 2)]}
    LOG['after_brush'] = {'kana': stroke_stats(kana)[2], 'latin': latin_stats(latin)[2]}

    marks = {}
    # TONARI
    up, gs = set_latin('TONARI', 0, H)
    marks['TONARI'] = up
    G = sum(g['mean'] for g in gs) / len(gs)
    LOG['rhythm'] = {'G(TONARI 흰 깊이 평균)': round(G, 1), 'G/STEM': round(G / STEM, 3), 'TONARI': gs}
    # 가나: 기준 글자(ト)의 잉크 상자를 H 가운데에 맞춘 세로 이동을 모든 가나에 같게
    s = kana_scale(); rx0, ry0, rx1, ry1 = bbox(xform(load('zenold', KANA_REF), s))
    dy = H / 2 - (ry0 + ry1) / 2
    LOG['kana_dy'] = round(dy, 1)
    kb = (-H * (KANA_H - 1) / 2, H + H * (KANA_H - 1) / 2)
    hira, LOG['rhythm']['となり'] = set_kana([xform(kana(c), 1, 0, dy) for c in 'となり'], 'となり', *kb, G, KANA_ADJ['となり'])
    kata, LOG['rhythm']['トナリ'] = set_kana([xform(kana(c), 1, 0, dy) for c in 'トナリ'], 'トナリ', *kb, G, KANA_ADJ['トナリ'])
    LOG['G'] = G
    marks['となり'] = hira; marks['トナリ'] = kata
    return marks


def accents(marks):
    """주홍 = 문장부호 하나(비글자 악센트). 지름·위치 규칙은 NOTES."""
    out = {}
    # TONARI. — 마침표: 지름 = STEM × ACC_D, 기준선에 앉힘, 마지막 글자와 잉크 거리 = STEM × ACC_GAP
    up = marks['TONARI']; x1 = bbox(up[-1])[2]; r = STEM * ACC_D / 2
    out['TONARI'] = dot(x1 + STEM * ACC_GAP + r, r, r)
    # となり。 — 구점: 바깥 지름 = STEM × ACC_RING, 고리 굵기 = (STEM+HAIR)/2, 가나 잉크 바닥에 앉힘
    hi = marks['となり']; x1 = bbox(hi[-1])[2]; R = STEM * ACC_RING / 2; w = (STEM + HAIR) / 2
    out['となり'] = ring(x1 + STEM * ACC_GAP + R, -H * (KANA_H - 1) / 2 + R, R, w)
    # トナリ・ — 가운뎃점(외래어 이음표 = 경계의 기호): 지름 = STEM × ACC_D, 높이 가운데
    ka = marks['トナリ']; x1 = bbox(ka[-1])[2]; r = STEM * ACC_D / 2
    out['トナリ'] = dot(x1 + STEM * ACC_GAP + r, H / 2, r)
    return out


def main():
    marks = build()
    acc = accents(marks)
    os.makedirs(os.path.join(HERE, 'svg'), exist_ok=True)
    names = {'TONARI': 'F2-TONARI', 'となり': 'F2-tonari-hira', 'トナリ': 'F2-tonari-kata'}
    info = {}
    for key, glyphs in marks.items():
        ink_cs = [c for g in glyphs for c in g]
        for theme, ink in (('light', NIGHT), ('dark', SNOW)):
            s, W, Hh, bb = svg([(ink_cs, 'ink'), (acc[key], 'accent')], key, ink)
            open(os.path.join(HERE, 'svg', f'{names[key]}-{theme}.svg'), 'w').write(s)
        info[key] = {'file': names[key], 'W': W, 'H': Hh, 'bbox': [round(v, 1) for v in bb]}
    fam = {'principle': {'H': H, 'STEM': STEM, 'HAIR': HAIR, 'HAIR/STEM': round(HAIR / STEM, 3), 'KANA_H': KANA_H,
                         'TRACK': TRACK, 'MINGAP': MINGAP, 'DEPTH cap/STEM': DEPTH, 'bodoni': BODONI_LOC},
           'log': LOG, 'marks': info,
           'fonts': {k: {'url': GF + v[0], 'sha256': v[1]} for k, v in FONTS.items()}}
    open(os.path.join(HERE, 'family.json'), 'w').write(json.dumps(fam, ensure_ascii=False, indent=1) + '\n')
    write_card(info)
    print(json.dumps(fam['log'], ensure_ascii=False, indent=0))


def write_card(info):
    def img(key, theme, h):
        return f'<img src="svg/{info[key]["file"]}-{theme}.svg" style="height:{h}px" alt="{key}">'
    order = ('TONARI', 'となり', 'トナリ')
    scale = round((1420 - 24 - 3 * 90) / sum(info[k]['W'] * 10 for k in order), 4)   # 같은 배율: 단위 → px (svg 1px = 10단위)
    cols = ' '.join(f"{round(info[k]['W'] * 10 * scale + 90)}px" for k in order)
    big = lambda key, th: f'<div class="cell {th}">{img(key, th, round(info[key]["H"] * scale * 10, 1))}</div>'
    role = {'TONARI': '우산 · 국제', 'となり': '일본 시리즈', 'トナリ': '하이브리드 · 경계'}
    rows = ''
    for th in ('light', 'dark'):
        rows += f'<div class="row" style="grid-template-columns:{cols}">' + ''.join(
            f'<div class="cell {th}"><span class="tag">{role[k]}</span>{img(k, th, round(info[k]["H"] * scale * 10, 1))}</div>'
            for k in ('TONARI', 'となり', 'トナリ')) + '</div>'
    hdr = ''
    for k in ('TONARI', 'となり', 'トナリ'):
        for th in ('light', 'dark'):
            hdr += f'<div class="hdr {th}">{img(k, th, 24)}<span class="nav">（ダミー）見出し</span></div>'
    cover = ''
    for k in ('TONARI', 'となり', 'トナリ'):
        w = 312; h = round(info[k]['H'] * w / info[k]['W'], 1)
        cover += (f'<div class="cov"><div class="cv light"><img src="svg/{info[k]["file"]}-light.svg" style="width:{w}px;height:{h}px" alt="{k}"></div>'
                  f'<div class="cv dark"><img src="svg/{info[k]["file"]}-dark.svg" style="width:{w}px;height:{h}px" alt="{k}"></div>'
                  f'<p>표지 제호 폭 80%(390px 표지 312×{h}px)</p></div>')
    html = f'''<!doctype html><html lang="ko"><head><meta charset="utf-8"><title>F2 클래식 에디토리얼</title>
<style>
body{{margin:0;background:#d9dce4;font-family:system-ui,sans-serif;color:{NIGHT};width:1500px}}
.wrap{{padding:40px 40px 48px}}
h1{{font-size:30px;margin:0 0 6px;letter-spacing:.01em}} .sub{{margin:0 0 6px;font-size:17px}}
.prin{{margin:14px 0 22px;padding:10px 14px;border-left:4px solid {VERMILION};background:{SNOW};font-size:14px;line-height:1.6}}
.row{{display:grid;gap:12px;margin-bottom:12px}}
.cell{{height:210px;display:flex;align-items:center;justify-content:center;position:relative}}
.light{{background:{SNOW}}} .dark{{background:{NIGHT}}}
.tag{{position:absolute;left:12px;top:10px;font-size:12px;font-weight:600;padding:2px 7px;background:{NIGHT};color:{SNOW}}}
.dark .tag{{background:{SNOW};color:{NIGHT}}}
h2{{font-size:16px;margin:26px 0 10px}}
.hdrs{{display:grid;grid-template-columns:repeat(2,1fr);gap:8px;max-width:1000px}}
.hdr{{height:48px;display:flex;align-items:center;justify-content:space-between;padding:0 16px}}
.nav{{font-size:12px;color:#5b6274}} .hdr.dark .nav{{color:#aab0bf}}
.cap{{font-size:12px;color:#4a5163;margin:0}} .covs{{display:flex;gap:18px}} .cov p{{font-size:12px;margin:4px 0 0;color:#4a5163}}
.cv{{width:390px;padding:26px 0;display:flex;align-items:center;justify-content:center;margin-bottom:6px}}
</style></head><body><div class="wrap">
<h1>F2 클래식 에디토리얼</h1>
<p class="sub">디돈 세리프와 올드 명조를 '세로 강세 · 가로:세로 = 7:20' 한 붓으로 다시 칠한 지적인 가족 — 주홍은 문장부호 하나.</p>
<div class="prin">원리(단위: 대문자 높이 750) · 세로 기둥 {STEM} = I 기둥 = 가나의 가장 굵은 세로 획 · 가로 헤어라인 {HAIR}(기둥×{HAIR / STEM:.2f}) = T 팔 = ナ 가로획 · 세로 강세 붓(가나: 세로 변 +{LOG['brush_ax_ay']['kana'][0]}, 가로 변 {LOG['brush_ax_ay']['kana'][1]}) · 가나 높이 = 대문자×{KANA_H} · 이웃 흰 깊이 평균 = 기둥×{round(LOG['G'] / STEM, 2)}(Bodoni 자체 간격에서 잼) · 주홍 = 문장부호 하나: 마침표(국제)·구점(일본)·가운뎃점(경계)</div>
{rows}
<p class="cap">세 칸은 같은 배율(1단위 = {scale:.4f}px). 위 밝은 바탕, 아래 밤 바탕.</p>
<h2>웹 헤더 — 마크 높이 24px(1:1)</h2><div class="hdrs">{hdr}</div>
<h2>표지 제호 크기 — 폭 312px(390px 표지의 80%)</h2><div class="covs">{cover}</div>
</div></body></html>
'''
    open(os.path.join(HERE, 'card.html'), 'w').write(html)


if __name__ == '__main__':
    main()
