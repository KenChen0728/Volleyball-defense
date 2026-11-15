"""產生 App 圖示和分享預覽圖。用法：python3 tools/make-icons.py（在專案根目錄執行）"""
from PIL import Image, ImageDraw, ImageFont
import os

OUT = 'icons'
TEAL = (14, 116, 144)
WHITE = (255, 255, 255)
SAND = (232, 199, 150)
BALL = (250, 204, 21)
BALL_LINE = (133, 77, 14)
BLUE = (29, 78, 216)
GREEN = (4, 120, 87)
ORANGE = (194, 65, 12)


def draw_icon(size):
    s = 4  # 先畫大張再縮小，邊緣比較平滑
    W = size * s
    im = Image.new('RGB', (W, W), TEAL)
    d = ImageDraw.Draw(im)
    u = W / 100.0
    # 球場（主體放在中間 70% 內，Android 裁成圓形也不會切到）
    x0, y0, x1, y1 = 24 * u, 22 * u, 76 * u, 82 * u
    d.rounded_rectangle([x0, y0, x1, y1], radius=3 * u, fill=SAND, outline=WHITE, width=int(2.2 * u))
    net_y = 40 * u
    d.line([x0 - 3 * u, net_y, x1 + 3 * u, net_y], fill=(28, 31, 35), width=int(3.2 * u))
    # 一個圈圈（防守範圍）和三個球員
    def dot(cx, cy, r, col):
        d.ellipse([cx - r, cy - r, cx + r, cy + r], fill=col, outline=WHITE, width=int(1.2 * u))
    rr = 11 * u
    d.ellipse([38 * u - rr, 66 * u - rr, 38 * u + rr, 66 * u + rr], outline=WHITE, width=int(1.4 * u))
    dot(38 * u, 66 * u, 5 * u, GREEN)
    dot(62 * u, 70 * u, 5 * u, BLUE)
    dot(58 * u, 50 * u, 5 * u, ORANGE)
    # 球
    bx, by, br = 64 * u, 30 * u, 7.5 * u
    d.ellipse([bx - br, by - br, bx + br, by + br], fill=BALL, outline=BALL_LINE, width=int(1.2 * u))
    d.arc([bx - br * 1.6, by - br * .9, bx + br * .4, by + br * 1.1], 300, 60, fill=BALL_LINE, width=int(1 * u))
    d.arc([bx - br * .2, by - br * 1.5, bx + br * 1.5, by + br * .5], 120, 220, fill=BALL_LINE, width=int(1 * u))
    return im.resize((size, size), Image.LANCZOS)


def main():
    os.makedirs(OUT, exist_ok=True)
    big = draw_icon(1024)
    for name, sz in [('icon-512.png', 512), ('icon-192.png', 192), ('apple-touch-icon.png', 180), ('favicon-32.png', 32), ('maskable-512.png', 512)]:
        big.resize((sz, sz), Image.LANCZOS).save(os.path.join(OUT, name), optimize=True)
    # 分享預覽圖 1200x630
    og = Image.new('RGB', (1200, 630), TEAL)
    og.paste(big.resize((360, 360), Image.LANCZOS), (90, 135))
    d = ImageDraw.Draw(og)
    bold = '/usr/share/fonts/opentype/noto/NotoSansCJK-Bold.ttc'
    reg = '/usr/share/fonts/opentype/noto/NotoSansCJK-Regular.ttc'
    try:
        f1 = ImageFont.truetype(bold, 84, index=3)
        f2 = ImageFont.truetype(reg if os.path.exists(reg) else bold, 40, index=3)
    except Exception:
        f1 = f2 = ImageFont.load_default()
    d.text((510, 210), '排球站位教室', font=f1, fill=WHITE)
    d.text((514, 330), '輪轉、接發球、防扣球、防吊球', font=f2, fill=(220, 240, 245))
    d.text((514, 390), '誰站哪裡、誰接、怎麼跑', font=f2, fill=(220, 240, 245))
    og.save(os.path.join(OUT, 'og-image.png'), optimize=True)
    print('ok')


if __name__ == '__main__':
    main()
