"""產生練球闖關的使用說明截圖（training/help/*.webp）。
用法：在 repo 根目錄 python3 -m http.server 8790，再跑 python3 training/tools/make-help-shots.py"""
import io, os
from PIL import Image
from playwright.sync_api import sync_playwright
URL = "http://localhost:8790/training/"
OUT = os.path.join(os.path.dirname(__file__), "..", "help")
def save(pg, name, h=620):
    png = pg.screenshot(clip={"x":0,"y":0,"width":390,"height":h})
    Image.open(io.BytesIO(png)).convert("RGB").save(os.path.join(OUT, name+".webp"), "WEBP", quality=72)
with sync_playwright() as p:
    br = p.chromium.launch()
    pg = br.new_page(viewport={"width":390,"height":844}, device_scale_factor=2)
    # 範例進度（只在截圖用）
    pg.add_init_script("""localStorage.setItem('vbtrain.progress', JSON.stringify({passhi:2,passlo:1,atk:1,set:1}));""")
    pg.goto(URL); pg.wait_for_timeout(400); save(pg, "home")
    pg.evaluate("location.hash='today'"); pg.wait_for_timeout(300); save(pg, "today", 560)
    pg.evaluate("location.hash='map-atk'"); pg.wait_for_timeout(300); save(pg, "map", 560)
    pg.evaluate("location.hash=''"); pg.wait_for_timeout(300)
    pg.click("[data-a=backup]"); pg.wait_for_timeout(500)
    png = pg.screenshot(clip={"x":0,"y":344,"width":390,"height":500})
    Image.open(io.BytesIO(png)).convert("RGB").save(os.path.join(OUT, "backup.webp"), "WEBP", quality=72)
    br.close()
print("ok")
