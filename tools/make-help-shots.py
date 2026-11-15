"""產生使用說明用的真實畫面截圖（help/*.webp）。
用法：在專案根目錄先開本機伺服器  python3 -m http.server 8765
      再執行  python3 tools/make-help-shots.py
改版後重跑一次，說明圖就會跟著更新。"""
import asyncio, io, os, sys
from PIL import Image
from playwright.async_api import async_playwright

URL = os.environ.get('VB_URL', 'http://localhost:8765/index.html')
CHROME = os.environ.get('CHROME', '/usr/bin/google-chrome')
OUT = 'help'
W, H, DPR = 390, 844, 2


def save(png_bytes, name, crop=None, max_w=760):
    im = Image.open(io.BytesIO(png_bytes)).convert('RGB')
    if crop:
        x0, y0, x1, y1 = [int(v * DPR) for v in crop]
        im = im.crop((x0, y0, x1, y1))
    if im.width > max_w:
        im = im.resize((max_w, round(im.height * max_w / im.width)), Image.LANCZOS)
    im.save(os.path.join(OUT, name + '.webp'), 'WEBP', quality=78, method=6)
    print('saved', name, im.size)


async def court_box(pg):
    return await pg.evaluate("(() => { const r = document.getElementById('court').getBoundingClientRect(); return [r.left, r.top, r.right, r.bottom]; })()")


async def main():
    os.makedirs(OUT, exist_ok=True)
    async with async_playwright() as p:
        b = await p.chromium.launch(executable_path=CHROME, args=['--no-sandbox'])
        ctx = await b.new_context(viewport={'width': W, 'height': H}, device_scale_factor=DPR, has_touch=False, color_scheme='light')
        pg = await ctx.new_page()
        await pg.goto(URL)
        await pg.evaluate("localStorage.clear(); sessionStorage.clear()")
        await pg.reload(); await pg.wait_for_timeout(300)
        await pg.click('#btnStart'); await pg.wait_for_timeout(400)
        await pg.evaluate("VB.markHintSeen(); VB.setSettings({formation:'up', block:'double', setter:'back', libero:5, radius:2, attackType:'spike', attacker:{x:8.2,y:-1.3}})")
        await pg.wait_for_timeout(400)
        cb = await court_box(pg)
        # 看懂畫面
        save(await pg.screenshot(), 'screen-1', (0, 0, W, cb[3]))
        save(await pg.screenshot(), 'screen-2', (0, cb[1] + (cb[3]-cb[1]) * .2, W, cb[1] + (cb[3]-cb[1]) * .62))
        save(await pg.screenshot(), 'screen-3', (0, cb[1], W, cb[3]))
        # 拖球看誰接
        await pg.evaluate("VB.setSettings({attacker:{x:1.0,y:-1.4}})"); await pg.wait_for_timeout(400)
        save(await pg.screenshot(), 'learn-1', (0, cb[1], W, cb[3]))
        await pg.evaluate("VB.setSettings({attacker:{x:8.2,y:-1.3}})"); await pg.wait_for_timeout(400)
        bx = await pg.evaluate("(() => { const r = document.getElementById('ball').getBoundingClientRect(); return [r.left + r.width/2, r.top + r.height/2]; })()")
        tgt = await pg.evaluate("VB.toClient(1.6, 6.6)")
        await pg.mouse.move(bx[0], bx[1]); await pg.mouse.down()
        for i in range(1, 11):
            await pg.mouse.move(bx[0] + (tgt[0]-bx[0]) * i / 10, bx[1] + (tgt[1]-bx[1]) * i / 10); await pg.wait_for_timeout(30)
        await pg.wait_for_timeout(200)
        save(await pg.screenshot(), 'learn-2', (0, cb[1], W, cb[3]))
        await pg.mouse.up(); await pg.wait_for_timeout(200)
        await pg.evaluate("VB.play.auto = false; VB.applyStep(1, false)"); await pg.wait_for_timeout(300)
        save(await pg.screenshot(), 'learn-3')
        await pg.evaluate("VB.applyStep(2, false)"); await pg.wait_for_timeout(300)
        save(await pg.screenshot(), 'learn-4')
        # 換情境
        await pg.evaluate("VB.resetPlay()"); await pg.wait_for_timeout(200)
        await pg.click('#btnSit'); await pg.wait_for_timeout(500)
        save(await pg.screenshot(), 'sit-1')
        sb = await pg.evaluate("(() => { const r = document.getElementById('sitSheet').getBoundingClientRect(); return [r.left, r.top, r.right, r.bottom]; })()")
        save(await pg.screenshot(), 'sit-2', (0, sb[1], W, min(H, sb[1] + 470)))
        await pg.click('#sitSheet [data-close]'); await pg.wait_for_timeout(400)
        await pg.click('.seg-type button[data-type="tip"]'); await pg.wait_for_timeout(100)
        await pg.evaluate("VB.startSim([6.9, 2.2])"); await pg.wait_for_timeout(100)
        await pg.evaluate("VB.play.auto = false; VB.applyStep(1, false)"); await pg.wait_for_timeout(300)
        save(await pg.screenshot(), 'sit-3')
        await pg.click('.seg-type button[data-type="spike"]'); await pg.wait_for_timeout(200)
        await pg.evaluate("VB.resetPlay()")
        # 自己擺
        await pg.click('.seg-mode button[data-mode="free"]'); await pg.wait_for_timeout(500)
        save(await pg.screenshot(), 'free-1', (0, 0, W, cb[3]))
        await pg.evaluate("VB.custom = {OH1:[1.2,3.2], MB:[4.5,.35], OPP:[7.6,3.0], S:[7.6,6.4], OH2:[4.5,8.2], L:[1.3,6.4]}; VB.resetPlay(false, 0)"); await pg.wait_for_timeout(300)
        save(await pg.screenshot(), 'free-2', (0, cb[1], W, cb[3]))
        await pg.evaluate("VB.startSim([4.5, 5.6])"); await pg.wait_for_timeout(100)
        await pg.evaluate("VB.play.auto = false; VB.applyStep(1, false)"); await pg.wait_for_timeout(300)
        save(await pg.screenshot(), 'free-3')
        await pg.evaluate("localStorage.clear()")
        await b.close()

if __name__ == '__main__':
    asyncio.run(main())
