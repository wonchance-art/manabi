#!/usr/bin/env python3
# 『となり』 제호 5안(괄호 없음) 빌더 — 2026-10-15 KST, 08-mast
#
# 오너 피드백(2026-10-15 KST) 「『』 괄호 씌운 제호 구림」 → 03-mast(괄호안) 폐기, 방향이 다른 5안.
#   A 이름형(となり 작게·넓은 자간, 호 표기와 한 줄)   B TONARI 주 + となり 부
#   C 「隣」 한 자 마크 + 세로 읽기 となり             D 세로 제호(と・な・り)
#   E 자유안: となり ｜ 이웃 — 한일 두 말을 '이웃'으로 나란히, 사이에 주홍 경계선
#
# 사용(리포 루트에서):
#   python3 -I docs/japanology/magazine/prototype/cover-machi01/08-mast/build-mast.py
#     → svg/{A..E}-{light,dark}.svg, covers/{A..E}-{ippon,danmen}.html, compare.html, layout.json
#   그다음 node docs/japanology/magazine/prototype/cover-machi01/08-mast/shoot.cjs (PNG·잉크 실측·check-cover)
# 서체 캐시: 환경 변수 TONARI_FONT_CACHE(기본: 임시 폴더/tonari-mast-fonts). 리포에는 서체 파일을 두지 않는다.
# 결정적: 같은 서체(SHA256 고정)면 바이트 단위로 같은 산출물.
import hashlib, json, math, os, re, sys, tempfile, urllib.request

HERE = os.path.dirname(os.path.abspath(__file__))
REFINE = os.path.join(HERE, '..', '07-refine')
CACHE = os.environ.get('TONARI_FONT_CACHE') or os.path.join(tempfile.gettempdir(), 'tonari-mast-fonts')

NIGHT, SNOW, VERMILION = '#151b2c', '#eef0f4', '#d4462a'

# ── 출처 서체: 모두 SIL OFL 1.1, google/fonts 고정 커밋 ───────────────────────────────
GF = 'https://raw.githubusercontent.com/google/fonts/67bc647ce1910e92f461bcc82aae30f21d21a9cc/ofl/'
FONTS = {
    'shippori-eb': ('shipporimincho/ShipporiMincho-ExtraBold.ttf', 'bdb787644b4b347e9a7efdd576f0d16ee4528cc9b5c86d23e06fa1a14ae0444c', None),
    'shippori-sb': ('shipporimincho/ShipporiMincho-SemiBold.ttf', 'bc7925544894a91466449adb73c6d943f50c3e53eb1c74d0673fe2dbafcd4d2d', None),
    'garamond-600': ('ebgaramond/EBGaramond%5Bwght%5D.ttf', 'ef9512f92f6d579e5dc75af59a5a4b1b8b47d2eda89e00b954d44520e5369027', 600),
    'nanum-eb': ('nanummyeongjo/NanumMyeongjo-ExtraBold.ttf', '60c0077fce069ba90ae97c0a3679f6eb3712e0ca637bdd0c15b72d335ec46db7', None),
}


def font_path(key):
    rel, sha, _ = FONTS[key]
    os.makedirs(CACHE, exist_ok=True)
    p = os.path.join(CACHE, rel.split('/')[-1].replace('%5B', '[').replace('%5D', ']'))
    if not os.path.exists(p):
        print('download', GF + rel, file=sys.stderr)
        urllib.request.urlretrieve(GF + rel, p)
    h = hashlib.sha256(open(p, 'rb').read()).hexdigest()
    if h != sha:
        sys.exit(f'SHA256 불일치 {p}: {h}')
    return p


_FONT_CACHE = {}


def load(key, ch):
    """윤곽 = [[x, y, on], ...] 목록(서체 단위, y 위쪽). 가변 서체는 wght 인스턴스."""
    if key not in _FONT_CACHE:
        from fontTools.ttLib import TTFont
        t = TTFont(font_path(key))
        if FONTS[key][2] is not None:
            from fontTools.varLib.instancer import instantiateVariableFont
            t = instantiateVariableFont(t, {'wght': FONTS[key][2]})
        _FONT_CACHE[key] = t
    t = _FONT_CACHE[key]
    glyf = t['glyf']
    g = glyf[t.getBestCmap()[ord(ch)]]
    co, ends, fl = g.getCoordinates(glyf)
    cs, s = [], 0
    for e in ends:
        cs.append([[float(co[i][0]), float(co[i][1]), bool(fl[i] & 1)] for i in range(s, e + 1)])
        s = e + 1
    return cs


# ── 손 수정 연산 ──────────────────────────────────────────────────────────────────────
# ('drop', ci)                         윤곽 삭제
# ('move', ci, [idx], (dx, dy))        점 이동
# ('scale', ci, (sx, sy))              윤곽을 자기 중심 기준 확대(속공간 열기)
# ('squash', ci|None, y0, k, side)     y0 위('above')/아래('below') 점을 y0 쪽으로 k배 압축
# ('region', ci|None, (x0,y0,x1,y1), (dx, dy))  상자 안 점 이동
# ('embolden', d)                      윤곽을 d단위 바깥으로(작은 크기 광학 보정)
def apply(cs, ops):
    cs = [[p[:] for p in c] for c in cs]
    drop = set()
    for op in ops:
        kind = op[0]
        if kind == 'drop':
            drop.add(op[1])
        elif kind == 'move':
            for i in op[2]:
                cs[op[1]][i][0] += op[3][0]; cs[op[1]][i][1] += op[3][1]
        elif kind == 'scale':
            c = cs[op[1]]
            cx = sum(p[0] for p in c) / len(c); cy = sum(p[1] for p in c) / len(c)
            for p in c:
                p[0] = cx + (p[0] - cx) * op[2][0]; p[1] = cy + (p[1] - cy) * op[2][1]
        elif kind == 'squash':
            _, ci, y0, k, side = op
            for j, c in enumerate(cs):
                if ci is not None and j != ci:
                    continue
                for p in c:
                    if (side == 'above' and p[1] > y0) or (side == 'below' and p[1] < y0):
                        p[1] = y0 + (p[1] - y0) * k
        elif kind == 'region':
            _, ci, (x0, y0, x1, y1), (dx, dy) = op
            for j, c in enumerate(cs):
                if ci is not None and j != ci:
                    continue
                for p in c:
                    if x0 <= p[0] <= x1 and y0 <= p[1] <= y1:
                        p[0] += dx; p[1] += dy
        elif kind == 'embolden':
            d = op[1]
            out = []
            for c in cs:
                n = len(c); nc = []
                for i in range(n):
                    a, b, e = c[i - 1], c[i], c[(i + 1) % n]
                    def ln(u, v):
                        dx, dy = v[0] - u[0], v[1] - u[1]; L = math.hypot(dx, dy) or 1
                        return (-dy / L, dx / L)
                    n1, n2 = ln(a, b), ln(b, e)
                    nx, ny = n1[0] + n2[0], n1[1] + n2[1]; L = math.hypot(nx, ny)
                    if L < 1e-6:
                        nx, ny = n1
                    else:
                        nx, ny = nx / L, ny / L
                    cosv = max(0.5, nx * n1[0] + ny * n1[1])
                    nc.append([b[0] + nx * d / cosv, b[1] + ny * d / cosv, b[2]])
                out.append(nc)
            cs = out
    return [c for i, c in enumerate(cs) if i not in drop]


# 03-mast에서 검증한 ExtraBold 「となり」 수정(점 번호 = Shippori Mincho ExtraBold 3.110)
EB_KANA = {
    'と': {
        'T1': [('move', 0, [57, 58, 59, 60, 61, 62, 63], (30, 8)), ('move', 0, [56], (15, 4))],
        'T2': [('move', 0, [35, 36], (4, 7))],
        'T3': [('move', 0, [29, 30, 31, 32, 33], (12, 0)), ('move', 0, [28, 34], (6, 0))],
    },
    'な': {
        'N2': [('move', 3, [8, 9, 10, 0], (0, -12)), ('move', 3, [3, 4, 5], (0, 10))],
        'N3': [('move', 2, [11, 12, 13, 14, 15, 16], (18, -4)), ('move', 2, [10, 17], (9, -2))],
        'N1': [('drop', 1)],   # drop은 마지막(윤곽 번호가 바뀌므로)
    },
    'り': {
        'R1': [('move', 0, [59], (-4, -14)), ('move', 0, [60], (-8, -6))],
        'R2': [('move', 0, [6, 7, 8, 9, 10, 11, 12], (6, 4)), ('move', 0, [12], (6, 6))],
    },
}


def eb_kana(ch, use):
    ops = []
    for k in use:
        ops += EB_KANA[ch].get(k, [])
    return apply(load('shippori-eb', ch), ops)


# ── 경로 출력 ─────────────────────────────────────────────────────────────────────────
def fmt(v):
    s = f'{v:.3f}'.rstrip('0').rstrip('.')
    return '0' if s in ('-0', '') else s


def to_d(cs, tf):
    d = []
    for c in cs:
        n = len(c)
        st = next((i for i in range(n) if c[i][2]), None)
        pts = c[st:] + c[:st] if st is not None else [[(c[0][0] + c[1][0]) / 2, (c[0][1] + c[1][1]) / 2, True]] + c
        P = lambda p: ' '.join(fmt(v) for v in tf(p[0], p[1]))
        d.append(f'M{P(pts[0])}')
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
                    d.append(f'Q{P(p)} {P([(p[0] + q[0]) / 2, (p[1] + q[1]) / 2])}'); k += 1
        d.append('Z')
    return ''.join(d)


def flat(cs, tf, steps=10):
    pts = []
    for c in cs:
        n = len(c)
        st = next((i for i in range(n) if c[i][2]), 0)
        q = c[st:] + c[:st] + [c[st]]
        prev = (q[0][0], q[0][1]); pts.append(tf(*prev)); k = 1
        while k < len(q):
            p = q[k]
            if p[2]:
                prev = (p[0], p[1]); pts.append(tf(*prev)); k += 1
            else:
                r = q[k + 1] if k + 1 < len(q) else q[0]
                e = (r[0], r[1]) if r[2] else ((p[0] + r[0]) / 2, (p[1] + r[1]) / 2)
                for t in range(1, steps + 1):
                    u = t / steps
                    pts.append(tf((1 - u) ** 2 * prev[0] + 2 * (1 - u) * u * p[0] + u * u * e[0],
                                  (1 - u) ** 2 * prev[1] + 2 * (1 - u) * u * p[1] + u * u * e[1]))
                prev = e; k += 2 if r[2] else 1
    return pts


class Mast:
    """mm 좌표에 글리프·사각형을 놓고, 잉크 상자로 viewBox를 잘라 SVG를 만든다."""

    def __init__(self, label):
        self.label, self.items = label, []

    def glyph(self, cs, s, role='ink', name=''):
        """cs를 크기 s(mm/단위)로 만들고, 잉크 상자 왼쪽 위가 (0,0)인 조각을 돌려준다."""
        pts = flat(cs, lambda x, y: (x * s, -y * s))
        x0 = min(p[0] for p in pts); y0 = min(p[1] for p in pts)
        x1 = max(p[0] for p in pts); y1 = max(p[1] for p in pts)
        return {'cs': cs, 's': s, 'ox': -x0, 'oy': -y0, 'w': x1 - x0, 'h': y1 - y0, 'role': role, 'name': name,
                'base': -y0}  # base: 잉크 위 끝에서 서체 기준선(y=0)까지 mm

    def put(self, g, x, y):
        """g의 잉크 왼쪽 위를 (x, y)mm에 둔다."""
        self.items.append(('g', g, x, y)); return (x, y, x + g['w'], y + g['h'])

    def rect(self, x, y, w, h, role='accent'):
        self.items.append(('r', (x, y, w, h), role))

    def bbox(self):
        xs, ys = [], []
        for it in self.items:
            if it[0] == 'g':
                _, g, x, y = it; xs += [x, x + g['w']]; ys += [y, y + g['h']]
            else:
                x, y, w, h = it[1]; xs += [x, x + w]; ys += [y, y + h]
        return min(xs), min(ys), max(xs), max(ys)

    def gaps(self):
        """이웃한 조각 사이 가장 가까운 잉크 거리(mm)."""
        polys = []
        for it in self.items:
            if it[0] == 'g':
                _, g, x, y = it; s = g['s']
                polys.append((g['name'], flat(g['cs'], lambda u, v: (x + g['ox'] + u * s, y + g['oy'] - v * s), 6)))
            else:
                x, y, w, h = it[1]
                polys.append(('rule', [(x + w * i / 20, y + h * j) for i in range(21) for j in (0, 1)] +
                              [(x + w * j, y + h * i / 40) for i in range(41) for j in (0, 1)]))
        out = {}
        for i in range(len(polys) - 1):
            a, b = polys[i], polys[i + 1]
            out[f'{a[0]}–{b[0]}'] = round(min(math.hypot(p[0] - q[0], p[1] - q[1]) for p in a[1][::2] for q in b[1][::2]), 2)
        return out

    def svg(self, ink, accent=VERMILION):
        bx0, by0, bx1, by1 = self.bbox()
        W, H = bx1 - bx0, by1 - by0
        paths = {'ink': [], 'accent': []}
        for it in self.items:
            if it[0] == 'g':
                _, g, x, y = it; s = g['s']
                tf = lambda u, v, x=x, y=y, g=g, s=s: (x - bx0 + g['ox'] + u * s, y - by0 + g['oy'] - v * s)
                paths[g['role']].append(to_d(g['cs'], tf))
            else:
                (x, y, w, h), role = it[1], it[2]
                paths[role].append(f'M{fmt(x - bx0)} {fmt(y - by0)}h{fmt(w)}v{fmt(h)}h{fmt(-w)}Z')
        body = ''.join(f'<path fill="{col}" d="{"".join(paths[r])}"/>' for r, col in (('accent', accent), ('ink', ink)) if paths[r])
        return (f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {fmt(W)} {fmt(H)}" width="{fmt(W)}mm" height="{fmt(H)}mm" '
                f'role="img" aria-label="{self.label}">{body}</svg>'), W, H


# ── 다섯 안 ────────────────────────────────────────────────────────────────────────────
def row(m, glyphs, gaps, x=0.0, base=None):
    """가로 한 줄: 각 글리프의 기준선을 맞추고(base = 기준선 y), 잉크 사이를 gaps(mm)로."""
    top = base if base is not None else 0.0
    xs = []
    for i, g in enumerate(glyphs):
        y = (base - g['base']) if base is not None else top
        xs.append(m.put(g, x, y))
        if i < len(gaps):
            x = xs[-1][2] + gaps[i]
    return xs


def col(m, glyphs, gaps, cx, y=0.0, dx=None):
    """세로 한 줄: 잉크 가운데를 cx에 맞추고, 위아래 잉크 사이를 gaps(mm)로."""
    out = []
    for i, g in enumerate(glyphs):
        x = cx - g['w'] / 2 + (dx[i] if dx else 0)
        out.append(m.put(g, x, y))
        if i < len(gaps):
            y = out[-1][3] + gaps[i]
    return out


EDIT_LOG = {}

# SemiBold 「となり」 수정(점 번호 = Shippori Mincho SemiBold 3.110) — A안 본체, B안 부
SB_KANA = {
    'と': [('move', 0, [31, 32, 33, 34], (10, 0)), ('move', 0, [30, 35], (5, 0)), ('embolden', 6)],
    'な': [('move', 3, [8, 9, 10, 0], (0, -14)), ('move', 3, [3, 4, 5], (0, 12)), ('drop', 1), ('embolden', 6)],
    'り': [('move', 0, [61], (-4, -12)), ('move', 0, [62], (-6, -5)), ('embolden', 6)],
}


def build_A():
    """A 이름형: SemiBold, em 8.6mm, 넓은 자간. 호 표기와 같은 줄(오른쪽)."""
    m = Mast('となり')
    s = 8.6 / 1000
    ops = SB_KANA
    EDIT_LOG['A'] = [
        'と 첫 획 오른 가장자리(점 31–34) +10, 30·35 +5 — 기둥 66→76, な·り(≈90)와 무게 맞춤',
        'な 교차부 바늘구멍(윤곽 1) 삭제 — 16px에서 회색 얼룩',
        'な 고리 속공간(윤곽 3) 아래 −14·위 +12 — 109→135단위, 16px에서 막힘 방지',
        'り 왼획→오른획 이음(61: −4·−12, 62: −6·−5) 두껍게',
        '세 글자 전체 윤곽 +6단위 확장 — 작은 크기 광학 보정(SemiBold 가는 획이 390px에서 0.5px 아래로 떨어짐)',
    ]
    g = [m.glyph(apply(load('shippori-sb', c), ops[c]), s, name=c) for c in 'となり']
    row(m, g, [3.3, 3.1], base=8.0)
    return m


def build_B():
    """B TONARI(EB Garamond 600) 주 + となり 부."""
    m = Mast('TONARI となり')
    s = 7.6 / 650   # 대문자 높이 ≈ 7.6mm
    ops = {
        'T': [('squash', 0, 655, 0.35, 'above')],
        'O': [],
        'N': [],
        'A': [('squash', 0, 652, 0.45, 'above')],
        'R': [('region', 0, (560, -40, 800, 130), (34, 0))],
        'I': [],
    }
    EDIT_LOG['B'] = [
        'T 가로획 양끝 세리프가 대문자선 위로 40단위 솟는 것을 35%로 눌러 O·N과 같은 높이에 맞춤',
        'A 꼭짓점 깃발(대문자선 위 30단위)을 45%로 눌러 꼭짓점을 단정하게',
        'R 다리 끝(x 560–800, y<130)을 오른쪽 34 연장 — R–I 사이 빈자리를 메우는 획(となり의 「곁으로 뻗기」)',
        '자간: 잉크 사이 2.4mm 기준, T–O 1.6·A–R 2.05로 광학 보정',
        'となり(부): A안 SemiBold 수정본(Garamond 600과 무게를 맞추려 ExtraBold 대신), em 6.6mm, 기준선 공유',
    ]
    g = [m.glyph(apply(load('garamond-600', c), ops[c]), s, name=c) for c in 'TONARI']
    xs = row(m, g, [1.6, 2.4, 2.4, 2.05, 2.6], base=7.6)
    k = [m.glyph(apply(load('shippori-sb', c), SB_KANA[c]), 6.6 / 1000, name=c) for c in 'となり']
    row(m, k, [1.0, 1.0], x=xs[-1][2] + 4.6, base=7.6)
    return m


def build_C():
    """C 「隣」 마크 + 오른쪽 세로 읽기(ルビ 자리) となり."""
    m = Mast('隣（となり）')
    ops = [
        ('scale', 5, (1.22, 1.22)),   # 夕 속 삼각 공간
        ('scale', 6, (1.35, 1.0)),    # 舛 오른쪽 세로 틈
        ('scale', 7, (1.15, 1.06)),   # 舛 왼쪽 속공간
        ('scale', 3, (1.06, 1.04)),   # 阝 위 고리 속공간
    ]
    EDIT_LOG['C'] = [
        '隣 夕 속 삼각 공간(윤곽 5) 122% — 390px(33px 크기)에서 점으로 막힘 방지',
        '隣 舛 오른쪽 세로 틈(윤곽 6) 가로 135%, 왼쪽 속공간(윤곽 7) 115×106% — 세로획 사이 뭉침 방지',
        '隣 阝 고리 속공간(윤곽 3) 106×104%',
        'となり(읽기): 03-mast ExtraBold 수정 중 가로 이웃용 T1·N3 제외, em 5.9mm 세로 쌓기',
    ]
    big = m.glyph(apply(load('shippori-eb', '隣'), ops), 18.5 / 1000, name='隣')
    m.put(big, 0, 0)
    k = [m.glyph(eb_kana(c, ['T2', 'T3', 'N2', 'R1', 'R2', 'N1']), 5.9 / 1000, name=c) for c in 'となり']
    cx = big['w'] + 1.6 + max(g['w'] for g in k) / 2
    col(m, k, [0.55, 0.45], cx, y=0.35)
    return m


def build_D():
    """D 세로 제호: と・な・り를 세로로. 가로 이웃용 맺음(T1·N3) 대신 마지막 り 꼬리를 아래로."""
    m = Mast('となり')
    s = 11.6 / 1000
    use = ['T2', 'T3', 'N2', 'R1', 'R2', 'N1']
    g = [m.glyph(eb_kana('と', use), s, name='と'),
         m.glyph(eb_kana('な', use), s, name='な'),
         m.glyph(apply(eb_kana('り', use), [('region', 0, (300, -90, 520, 40), (-10, -46)), ('move', 0, [5, 13], (-4, -18))]), s, name='り')]
    EDIT_LOG['D'] = [
        '03-mast ExtraBold 수정 중 T2·T3·N1·N2·R1·R2 유지, 가로 이웃을 향한 T1·N3는 뺌(세로에서는 이웃이 아래)',
        'り 꼬리 끝(x 300–520, y<40)을 아래로 46·왼쪽 10 연장, 5·13번 점 −18 — 세로 기둥이 내리긋는 획으로 끝나게',
        '세로 자간: 잉크 사이 1.3·1.1mm, 잉크 가운데 맞춤 + な −0.25mm·り +0.35mm 광학 보정',
    ]
    col(m, g, [1.3, 1.1], cx=6.0, dx=[0, -0.25, 0.35])
    return m


def build_E():
    """E となり ｜ 이웃 — 한일 두 말을 나란히, 사이에 주홍 경계선 하나."""
    m = Mast('となり 이웃')
    s = 10.4 / 1000
    k = [m.glyph(eb_kana(c, ['T1', 'T2', 'T3', 'N2', 'N3', 'R1', 'R2', 'N1']), s, name=c) for c in 'となり']
    hops = [('squash', None, -24, 0.5, 'below')]
    sk = 9.6 / 1000
    h = [m.glyph(apply(load('nanum-eb', c), hops), sk, name=c) for c in '이웃']
    EDIT_LOG['E'] = [
        'となり: 03-mast ExtraBold 수정 8곳 전부(T1–T3·N1–N3·R1·R2)',
        '이·웃(나눔명조 ExtraBold): 기준선 아래 내림(ㅣ·ㅅ 끝, y<−24)을 50%로 눌러 가나 기준선과 맞춤',
        '이웃 em 9.6mm — 한글 네모꼴이 가나보다 커 보여 가나(10.4mm) 대비 92%로 광학 맞춤',
        '경계선: 주홍 0.75mm(03 괄호 굵기 계승), 글자 위아래로 1.2mm 넘침',
    ]
    xs = row(m, k, [1.5, 1.5], base=9.0)
    top = min(b[1] for b in xs); bot = max(b[3] for b in xs)
    rx = xs[-1][2] + 2.6
    m.rect(rx, top - 1.2, 0.75, (bot - top) + 2.4)
    row(m, h, [0.9], x=rx + 0.75 + 2.6, base=9.0 - 0.2)
    return m


# ── 표지 복사본: 제호만 바꿔 끼운다(원본 수정 금지) ──────────────────────────────────
# 각 안의 제호 위치(mm, 잉크 왼쪽 위)와 호 표기 배치
PLACE = {
    'A': {'mast': (13.0, 13.0), 'no_css': '.cover .no{left:calc(var(--mm)*41.4);top:calc(var(--mm)*14.18)}'},
    'B': {'mast': (13.0, 13.0), 'no_css': '.cover .no{left:calc(var(--mm)*12.57);top:calc(var(--mm)*25.6)}'},
    'C': {'mast': (13.0, 13.0), 'no_css': '.cover .no{left:calc(var(--mm)*12.57);top:calc(var(--mm)*35.2)}'},
    'D': {'mast': (13.0, 13.0), 'no_css': '.cover .no{left:calc(var(--mm)*23.9);top:calc(var(--mm)*12.5);writing-mode:vertical-rl;letter-spacing:.12em}'
                                           '.cover .no .n,.cover .no span{margin-left:0;margin-top:calc(var(--mm)*2.5);text-combine-upright:all;letter-spacing:0}'},
    'E': {'mast': (13.0, 13.0), 'no_css': '.cover .no{left:calc(var(--mm)*12.57);top:calc(var(--mm)*28.0)}'},
}
COVERS = {'ippon': ('01-ippon/cover.html', 'light'), 'danmen': ('05-danmen/cover.html', 'dark')}


def cover_copy(key, svg_text, W, H, which):
    src, _ = COVERS[which]
    html = open(os.path.join(REFINE, src), encoding='utf-8').read()
    x, y = PLACE[key]['mast']
    inline = svg_text.replace('<svg xmlns="http://www.w3.org/2000/svg" ', '<svg class="mast" xmlns="http://www.w3.org/2000/svg" ', 1)
    html, n = re.subn(r'<svg class="mast".*?</svg>', lambda _: inline, html, count=1, flags=re.S)
    assert n == 1
    html, n = re.subn(r'\.cover \.mast\{[^}]*\}',
                      f'.cover .mast{{left:calc(var(--mm)*{fmt(x)});top:calc(var(--mm)*{fmt(y)});width:calc(var(--mm)*{fmt(W)});height:calc(var(--mm)*{fmt(H)})}}',
                      html, count=1)
    assert n == 1
    html = html.replace('</style>', f'/* 08-mast {key}안 */\n{PLACE[key]["no_css"]}\n</style>', 1)
    html = html.replace('<!--', f'<!--\n  ※ 08-mast/build-mast.py가 07-refine/{src}를 복사해 제호만 {key}안으로 바꾼 비교용 사본(2026-10-15 KST). 원본은 그대로.', 1)
    return html


def main():
    builders = {'A': build_A, 'B': build_B, 'C': build_C, 'D': build_D, 'E': build_E}
    os.makedirs(os.path.join(HERE, 'svg'), exist_ok=True)
    os.makedirs(os.path.join(HERE, 'covers'), exist_ok=True)
    layout = {}
    for k, fn in builders.items():
        m = fn()
        light, W, H = m.svg(NIGHT)
        dark, _, _ = m.svg(SNOW)
        open(os.path.join(HERE, 'svg', f'{k}-light.svg'), 'w').write(light + '\n')
        open(os.path.join(HERE, 'svg', f'{k}-dark.svg'), 'w').write(dark + '\n')
        for which, (_, tone) in COVERS.items():
            open(os.path.join(HERE, 'covers', f'{k}-{which}.html'), 'w').write(
                cover_copy(k, light if tone == 'light' else dark, W, H, which))
        layout[k] = {'w_mm': round(W, 2), 'h_mm': round(H, 2), 'w_390px': round(W * 390 / 210, 1), 'h_390px': round(H * 390 / 210, 1),
                     'at_mm': PLACE[k]['mast'], 'gaps_mm': m.gaps(), 'edits': EDIT_LOG[k]}
        print(k, f'{W:.2f}×{H:.2f}mm', f'390px: {W * 390 / 210:.1f}×{H * 390 / 210:.1f}px', m.gaps(), file=sys.stderr)
    json.dump(layout, open(os.path.join(HERE, 'layout.json'), 'w'), ensure_ascii=False, indent=1)
    open(os.path.join(HERE, 'layout.json'), 'a').write('\n')
    write_compare(layout)


def write_compare(layout):
    names = {'A': 'A 이름형 — となり 작게·넓은 자간, 호 표기와 한 줄',
             'B': 'B TONARI 주 + となり 부',
             'C': 'C 「隣」 한 자 + 세로 읽기',
             'D': 'D 세로 제호',
             'E': 'E となり ｜ 이웃 — 두 말을 이웃으로'}
    def frame(k, which):
        return f'<iframe src="covers/{k}-{which}.html" width="422" height="592" scrolling="no"></iframe>'
    rows = ''
    for which, label in (('ippon', '① 01-ippon(밝은 바탕)'), ('danmen', '⑤ 05-danmen(밤 바탕)')):
        rows += f'<h2>{label} — 표지 폭 390px</h2><div class="row">' + ''.join(
            f'<figure>{frame(k, which)}<figcaption>{names[k]}</figcaption></figure>' for k in layout) + '</div>'
    strip = ''
    for k, v in layout.items():
        strip += (f'<figure class="m"><div class="pair"><div class="sw l"><img src="svg/{k}-light.svg" style="height:{v["h_390px"]}px"></div>'
                  f'<div class="sw d"><img src="svg/{k}-dark.svg" style="height:{v["h_390px"]}px"></div>'
                  f'<div class="sw l"><img src="svg/{k}-light.svg" style="height:{v["h_mm"] * 96 / 25.4:.1f}px"></div></div>'
                  f'<figcaption>{names[k]}<br>{v["w_mm"]}×{v["h_mm"]}mm · 390px 표지에서 {v["w_390px"]}×{v["h_390px"]}px</figcaption></figure>')
    html = f'''<!doctype html><html lang="ko"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>제호 다섯 안</title>
<style>
:root{{--bg:#d9dce3;--fg:#151b2c;--mute:#4a5163}}
body{{margin:0;padding:22px 24px 36px;background:var(--bg);color:var(--fg);font:14px/1.5 system-ui,sans-serif}}
h1{{font-size:18px;margin:0 0 2px}} h2{{font-size:14px;margin:22px 0 8px;color:var(--mute)}} p{{margin:0;color:var(--mute)}}
.row{{display:flex;gap:10px}} figure{{margin:0}} figcaption{{font-size:12px;color:var(--mute);max-width:422px;margin-top:2px}}
iframe{{border:0;display:block}}
.strip{{display:flex;gap:18px;flex-wrap:wrap}} .pair{{display:flex;gap:8px;align-items:flex-start}} .strip{{align-items:flex-start}}
.sw{{padding:10px 12px;display:flex;align-items:center}} .sw.l{{background:#eef0f4}} .sw.d{{background:#151b2c}} .sw img{{display:block}}
</style></head><body>
<h1>『となり』 제호 — 괄호 없는 다섯 안</h1>
<p>모두 아웃라인 SVG(서체 &lt;text&gt; 없음). 표지는 07-refine 원본의 복사본에서 제호·호 표기 위치만 바꿨다. 각 칸 = 실제 390px 표지.</p>
<h2>제호만 — 390px 표지 축척(명·암) · 16mm 실제 크기 비율(96dpi)</h2>
<div class="strip">{strip}</div>
{rows}
</body></html>'''
    open(os.path.join(HERE, 'compare.html'), 'w').write(html)


if __name__ == '__main__':
    main()
