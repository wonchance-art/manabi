# 14-view ①단계 — 실측 뼈대(구도 가이드) 생성. 金鳥居 북쪽 거리에서 富士みち를 따라 富士山 쪽을 보는 시점.
# 사용(리포 루트): python3 -I docs/japanology/magazine/prototype/cover-machi01/14-view/view.py
# 입력: data/road.json(OSM 富士みち 노드·金鳥居·剣ヶ峰), 국토지리원 標高タイル(DEM10B, z14 txt — data/dem/에 캐시, 커밋 안 함)
# 출력: out/guide.png(생성기 첨부용, 글자 없음) · out/guide-notes.png(사람용 주석) · out/guide.json(검수용 수치)
# 결정적: 같은 타일·같은 상수면 같은 결과. 시각은 KST로만 기록한다.
import json, math, os, sys, urllib.request
import numpy as np
from PIL import Image, ImageDraw, ImageFont

HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(HERE, 'out'); DEM = os.path.join(HERE, 'data', 'dem')
os.makedirs(OUT, exist_ok=True); os.makedirs(DEM, exist_ok=True)
R = 6371000.0; K_REFR = 0.13
Z = 14

# ── 상수(구도) — 바꾸면 guide.json에 그대로 남는다
VIEW_BACK_M = 100.0     # 金鳥居에서 도로를 따라 북쪽으로 물러선 거리
EYE_M = 1.6             # 눈높이(지면 위)
W, H = 1024, 1536       # 생성기 세로 출력(2:3). 표지는 가운데 1024×1448(210:297)을 잘라 쓴다
HFOV = 26.0             # 수평 화각(도) — 망원(후지를 크게 당겨 보는 통상 구도)
PITCH = 1.8             # 위로 든 각(도) — 剣ヶ峰이 위에서 1/4 지점에 오도록
YAW_OFFSET = 3.0        # 시점→剣ヶ峰 방위에 더할 값(도) — 산(왼쪽)과 길(오른쪽)이 가운데를 나눠 갖게

road = json.load(open(os.path.join(HERE, 'data', 'road.json'), encoding='utf-8'))

# ── DEM 타일
def tile_xy(lat, lon):
    n = 2 ** Z
    x = (lon + 180) / 360 * n
    y = (1 - math.log(math.tan(math.radians(lat)) + 1 / math.cos(math.radians(lat))) / math.pi) / 2 * n
    return x, y
_cache = {}
def tile(tx, ty):
    if (tx, ty) in _cache: return _cache[(tx, ty)]
    f = os.path.join(DEM, f'{Z}_{tx}_{ty}.txt')
    if not os.path.exists(f):
        url = f'https://cyberjapandata.gsi.go.jp/xyz/dem/{Z}/{tx}/{ty}.txt'
        try:
            data = urllib.request.urlopen(url, timeout=30).read().decode()
        except Exception as e:
            data = ''
        open(f, 'w').write(data)
    txt = open(f).read().strip()
    if not txt:
        arr = np.full((256, 256), np.nan)
    else:
        arr = np.array([[float(v) if v != 'e' else np.nan for v in row.split(',')] for row in txt.split('\n')])
    _cache[(tx, ty)] = arr
    return arr
def elev(lat, lon):
    x, y = tile_xy(lat, lon)
    px, py = x * 256 - 0.5, y * 256 - 0.5
    x0, y0 = math.floor(px), math.floor(py); fx, fy = px - x0, py - y0
    v = []
    for dy in (0, 1):
        for dx in (0, 1):
            gx, gy = x0 + dx, y0 + dy
            v.append(tile(gx // 256, gy // 256)[gy % 256, gx % 256])
    return (v[0] * (1 - fx) + v[1] * fx) * (1 - fy) + (v[2] * (1 - fx) + v[3] * fx) * fy

# ── 좌표 도우미(시점 중심 국소 평면)
def bearing(a, b):
    p1, p2 = math.radians(a[0]), math.radians(b[0]); dl = math.radians(b[1] - a[1])
    return (math.degrees(math.atan2(math.sin(dl) * math.cos(p2), math.cos(p1) * math.sin(p2) - math.sin(p1) * math.cos(p2) * math.cos(dl))) + 360) % 360
def dist(a, b):
    p1, p2 = math.radians(a[0]), math.radians(b[0]); dp = p2 - p1; dl = math.radians(b[1] - a[1])
    h = math.sin(dp / 2) ** 2 + math.cos(p1) * math.cos(p2) * math.sin(dl / 2) ** 2
    return 2 * R * math.asin(math.sqrt(h))
def dest(a, brg, d):
    p1, l1 = math.radians(a[0]), math.radians(a[1]); b = math.radians(brg); dr = d / R
    p2 = math.asin(math.sin(p1) * math.cos(dr) + math.cos(p1) * math.sin(dr) * math.cos(b))
    l2 = l1 + math.atan2(math.sin(b) * math.sin(dr) * math.cos(p1), math.cos(dr) - math.sin(p1) * math.sin(p2))
    return (math.degrees(p2), math.degrees(l2))

# ── 시점: 金鳥居에서 도로(북쪽 구간)를 따라 VIEW_BACK_M 물러선 점
pts = [(p['lat'], p['lon']) for p in road['road']]
ti = next(i for i, p in enumerate(road['road']) if p['node'] == 'torii')
left = VIEW_BACK_M; i = ti; cam = pts[ti]
while i > 0:
    seg = dist(pts[i], pts[i - 1])
    if seg >= left:
        t = left / seg; cam = (pts[i][0] + (pts[i - 1][0] - pts[i][0]) * t, pts[i][1] + (pts[i - 1][1] - pts[i][1]) * t); break
    left -= seg; i -= 1
ground0 = elev(*cam); camh = ground0 + EYE_M
KEN = (road['kengamine']['lat'], road['kengamine']['lon'])
yaw = bearing(cam, KEN) + YAW_OFFSET

# ── 카메라: 방위 yaw, 위로 PITCH. 점(방위 az, 수평거리 d, 높이차 dh) → 화면 좌표
f = (W / 2) / math.tan(math.radians(HFOV / 2))
cp, sp = math.cos(math.radians(PITCH)), math.sin(math.radians(PITCH))
def project(az, d, dh):
    a = math.radians(az - yaw)
    x, y, z = d * math.sin(a), d * math.cos(a), dh  # 오른쪽, 앞, 위
    yc, zc = y * cp + z * sp, -y * sp + z * cp       # 위로 든 카메라
    if yc <= 0: return None
    return (W / 2 + f * x / yc, H / 2 - f * zc / yc)
def drop(d):
    return d * d / (2 * R) * (1 - K_REFR)
def proj_geo(p, h):
    d = dist(cam, p)
    return project(bearing(cam, p), d, h - camh - drop(d))

# ── 능선: 열마다 방위를 정해 지형의 최대 앙각
sky = []
for col in range(W):
    az = yaw + math.degrees(math.atan((col + 0.5 - W / 2) / f))
    best = -90.0; bestd = None
    d = 20.0
    while d < 26000:
        p = dest(cam, az, d); h = elev(*p)
        if not math.isnan(h):
            ang = math.degrees(math.atan2(h - camh - drop(d), d))
            if ang > best: best, bestd = ang, d
        d += 8 if d < 1500 else (25 if d < 8000 else 40)
    # 그 앙각을 화면 y로(같은 열)
    a = math.radians(az - yaw); t = math.tan(math.radians(best))
    x, y, z = math.sin(a), math.cos(a), t
    yc, zc = y * cp + z * sp, -y * sp + z * cp
    sky.append({'col': col, 'az': round(az, 4), 'elevDeg': round(best, 4), 'dist': round(bestd or 0), 'y': round(H / 2 - f * zc / yc, 2)})

# ── 도로 중심선(시점보다 앞쪽만), 金鳥居 지점, 剣ヶ峰
ahead = [cam] + pts[i:]  # i = 시점이 든 구간의 남쪽 끝 이후
road_px = []
for p in ahead:
    if p == cam: continue
    q = proj_geo(p, elev(*p))
    if q: road_px.append([round(q[0], 2), round(q[1], 2)])
# 시점 바로 앞 5m 지점도(화면 아래 밖일 수 있음)
near = dest(cam, bearing(cam, pts[ti]), 6); qn = proj_geo(near, elev(*near))
torii_px = proj_geo(pts[ti], elev(*pts[ti]))
ken_px = proj_geo(KEN, elev(*KEN))

guide = {
    'made_kst': '2026-10-16', 'camera': {'lat': round(cam[0], 7), 'lon': round(cam[1], 7), 'ground_m': round(ground0, 2), 'eye_m': EYE_M,
        'yaw_deg': round(yaw, 3), 'pitch_deg': PITCH, 'hfov_deg': HFOV, 'size': [W, H], 'back_from_torii_m': VIEW_BACK_M},
    'refraction_k': K_REFR, 'dem': 'GSI DEM10B z14 (cyberjapandata.gsi.go.jp/xyz/dem)',
    'kengamine_px': [round(ken_px[0], 2), round(ken_px[1], 2)], 'kengamine_dist_m': round(dist(cam, KEN)),
    'torii_ground_px': [round(torii_px[0], 2), round(torii_px[1], 2)],
    'road_center_px': ([[round(qn[0], 2), round(qn[1], 2)]] if qn else []) + road_px,
    'skyline': sky,
    'unverified': ['도로 폭(OSM에 width 없음, lanes=2·sidewalk 일부)', '金鳥居 높이·모양(위치만 실측)', '건물(DEM은 맨땅 — 길가 건물이 능선 아래쪽을 가릴 수 있음)'],
}
json.dump(guide, open(os.path.join(OUT, 'guide.json'), 'w'), ensure_ascii=False)

# ── 그림
def draw(notes):
    im = Image.new('RGB', (W, H), 'white'); g = ImageDraw.Draw(im)
    g.line([(s['col'], s['y']) for s in sky], fill='black', width=7, joint='curve')
    rp = guide['road_center_px']
    for k in range(len(rp) - 1):  # 점선
        (x1, y1), (x2, y2) = rp[k], rp[k + 1]
        n = max(1, int(math.hypot(x2 - x1, y2 - y1) / 18))
        for j in range(0, n, 2):
            a, b = j / n, min(1, (j + 1) / n)
            g.line([(x1 + (x2 - x1) * a, y1 + (y2 - y1) * a), (x1 + (x2 - x1) * b, y1 + (y2 - y1) * b)], fill='black', width=5)
    tx, ty = torii_px
    g.line([(tx - 14, ty), (tx + 14, ty)], fill='black', width=5); g.line([(tx, ty - 14), (tx, ty + 14)], fill='black', width=5)
    if notes:
        try: font = ImageFont.truetype('/usr/share/fonts/truetype/fonts-japanese-gothic.ttf', 22)
        except Exception: font = None
        kx, ky = ken_px
        g.ellipse([kx - 8, ky - 8, kx + 8, ky + 8], outline='red', width=3)
        g.text((kx + 14, ky - 40), f"剣ヶ峰 {guide['kengamine_dist_m']/1000:.1f}km", fill='red', font=font)
        g.text((tx + 20, ty - 10), '金鳥居の位置（高さ・形は未検証）', fill='red', font=font)
        g.text((20, H - 120), f"視点: 金鳥居の北{VIEW_BACK_M:.0f}m 富士みち上・目の高さ{EYE_M}m（地面{ground0:.0f}m）", fill='red', font=font)
        g.text((20, H - 90), f"方位{yaw:.2f}° 仰角{PITCH}° 水平画角{HFOV}° 標高:国土地理院DEM10B 道:OSM", fill='red', font=font)
        g.text((20, H - 60), '太線=稜線（実測） 点線=道の中心（実測） ＋=金鳥居の地点', fill='red', font=font)
    return im
draw(False).save(os.path.join(OUT, 'guide.png'))
draw(True).save(os.path.join(OUT, 'guide-notes.png'))
print(json.dumps({k: guide[k] for k in ('camera', 'kengamine_px', 'kengamine_dist_m', 'torii_ground_px')}, ensure_ascii=False))
print('skyline y range', min(s['y'] for s in sky), max(s['y'] for s in sky), 'tiles', len(_cache))
