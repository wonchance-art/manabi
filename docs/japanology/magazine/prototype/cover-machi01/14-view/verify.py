# 14-view ③단계 — 생성 이미지를 실측 뼈대와 겹쳐 검수한다.
# 사용(리포 루트): python3 -I docs/japanology/magazine/prototype/cover-machi01/14-view/verify.py <생성 이미지> [...]
# 능선: 열마다 실측 y 위아래 ±60px에서 세로 밝기 변화가 가장 큰 곳을 찾아 어긋남(px)을 잰다.
# 판정: 중앙값 ≤ 6px 그리고 95% ≤ 15px(화면 높이 1536의 1%)이면 「능선 통과」. 도로·金鳥居 지점은 겹친 그림으로 사람이 본다.
import json, os, sys
import numpy as np
from PIL import Image, ImageDraw, ImageFilter

HERE = os.path.dirname(os.path.abspath(__file__))
G = json.load(open(os.path.join(HERE, 'out', 'guide.json')))
W, H = G['camera']['size']
os.makedirs(os.path.join(HERE, 'verify'), exist_ok=True)

def check(path):
    im = Image.open(path).convert('RGB')
    ar, ar0 = im.width / im.height, W / H
    if abs(ar / ar0 - 1) > 0.02:
        return {'file': os.path.basename(path), 'error': f'비율 {im.width}x{im.height}가 가이드 {W}x{H}와 다르다 — 같은 비율로 다시 받는다'}
    im = im.resize((W, H), Image.LANCZOS)
    g = np.asarray(im.convert('L').filter(ImageFilter.GaussianBlur(2)), dtype=float)
    grad = np.abs(np.diff(g, axis=0))
    offs = []
    det = []
    for s in G['skyline']:
        c, ye = s['col'], s['y']
        lo, hi = int(max(1, ye - 60)), int(min(H - 2, ye + 60))
        band = grad[lo:hi, c]
        yd = lo + int(np.argmax(band)) + 0.5
        offs.append(yd - ye); det.append((c, yd))
    a = np.abs(np.array(offs))
    res = {'file': os.path.basename(path), 'skyline_median_px': round(float(np.median(a)), 1), 'skyline_p95_px': round(float(np.percentile(a, 95)), 1),
           'within_8px_pct': round(float((a <= 8).mean() * 100), 1)}
    res['skyline_pass'] = res['skyline_median_px'] <= 6 and res['skyline_p95_px'] <= 15
    ov = im.copy(); d = ImageDraw.Draw(ov)
    d.line([(s['col'], s['y']) for s in G['skyline']], fill=(255, 0, 60), width=3)
    d.line(det, fill=(0, 200, 255), width=2)
    rp = G['road_center_px']; d.line([tuple(p) for p in rp], fill=(255, 0, 60), width=3)
    tx, ty = G['torii_ground_px']; d.line([(tx - 16, ty), (tx + 16, ty)], fill=(255, 0, 60), width=3); d.line([(tx, ty - 16), (tx, ty + 16)], fill=(255, 0, 60), width=3)
    out = os.path.join(HERE, 'verify', os.path.splitext(os.path.basename(path))[0] + '-overlay.png')
    ov.save(out); res['overlay'] = os.path.relpath(out, HERE)
    return res

if __name__ == '__main__':
    rs = [check(p) for p in sys.argv[1:]]
    json.dump(rs, open(os.path.join(HERE, 'verify', 'report.json'), 'w'), ensure_ascii=False, indent=1)
    print(json.dumps(rs, ensure_ascii=False, indent=1))
