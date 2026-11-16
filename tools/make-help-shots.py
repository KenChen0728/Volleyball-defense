"""產生使用說明用的真實畫面截圖（help/*.webp）。
用法：在專案根目錄先開本機伺服器  python3 -m http.server 8765
      再執行  python3 tools/make-help-shots.py
改版後重跑一次，說明圖就會跟著更新。"""
import asyncio, io, os
from PIL import Image
from playwright.async_api import async_playwright

URL = os.environ.get('VB_URL', 'http://localhost:8765/index.html')
CHROME = os.environ.get('CHROME', '/usr/bin/google-chrome')
OUT = 'help'
W, H, DPR = 390, 844, 2
BASE = "{system:'51', rot:1, recv:'team', useLib:true, formation:'ours', canOH:true, canMB:true, canR:false, mbLate:false, blockRes:'soft', libero:5, radius:2, attacker:{x:8.2,y:-1.3}, serveX:1.6, mode:'learn', view:'2d', cam:'dig'}"


def save(png_bytes, name, crop=None, max_w=760):
    im = Image.open(io.BytesIO(png_bytes)).convert('RGB')
    if crop:
        x0, y0, x1, y1 = [int(v * DPR) for v in crop]
        im = im.crop((max(0, x0), max(0, y0), min(im.width, x1), min(im.height, y1)))
    if im.width > max_w:
        im = im.resize((max_w, round(im.height * max_w / im.width)), Image.LANCZOS)
    im.save(os.path.join(OUT, name + '.webp'), 'WEBP', quality=78, method=6)
    print('saved', name, im.size)


async def box(pg, sel):
    return await pg.evaluate(f"(() => {{ const r = document.querySelector('{sel}').getBoundingClientRect(); return [r.left, r.top, r.right, r.bottom]; }})()")


async def step(pg, s, extra=''):
    await pg.evaluate(f"VB.S.step='{s}'; VB.markHintSeen(); VB.setSettings(Object.assign({BASE}, {{step:'{s}'}}, {extra or '{}'})); VB.set3D(false, true)")
    await pg.wait_for_timeout(450)


async def drag_ball(pg, to, hold=True):
    bx = await pg.evaluate("(() => { const r = document.getElementById('ball').getBoundingClientRect(); return [r.left + r.width/2, r.top + r.height/2]; })()")
    tgt = await pg.evaluate(f"VB.toClient({to[0]}, {to[1]})")
    await pg.mouse.move(bx[0], bx[1]); await pg.mouse.down()
    for i in range(1, 11):
        await pg.mouse.move(bx[0] + (tgt[0]-bx[0]) * i / 10, bx[1] + (tgt[1]-bx[1]) * i / 10); await pg.wait_for_timeout(30)
    await pg.wait_for_timeout(200)
    if not hold:
        await pg.mouse.up()


async def main():
    os.makedirs(OUT, exist_ok=True)
    async with async_playwright() as p:
        b = await p.chromium.launch(executable_path=CHROME, args=['--no-sandbox', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'])
        ctx = await b.new_context(viewport={'width': W, 'height': H}, device_scale_factor=DPR, has_touch=False, color_scheme='light')
        pg = await ctx.new_page()
        await pg.goto(URL)
        await pg.evaluate("localStorage.clear(); sessionStorage.clear()")
        await pg.reload(); await pg.wait_for_timeout(300)
        await pg.click('#btnStart'); await pg.wait_for_timeout(400)
        # 看懂畫面、輪轉
        await step(pg, 'rot')
        cb = await box(pg, '#court')
        save(await pg.screenshot(), 'screen-1', (0, 0, W, cb[3]))
        save(await pg.screenshot(), 'screen-2', (0, cb[1] + (cb[3]-cb[1]) * .3, W, cb[1] + (cb[3]-cb[1]) * .78))
        sp = await box(pg, '#stepper')
        save(await pg.screenshot(), 'screen-3', (0, 0, W, sp[3] + 8))
        save(await pg.screenshot(), 'rot-1')
        await pg.click('#btnRotNext'); await pg.wait_for_timeout(800)
        save(await pg.screenshot(), 'rot-2')
        for i in range(2):
            await pg.click('#btnRotNext'); await pg.wait_for_timeout(300)
        await pg.evaluate("VB.markHintSeen()")
        await pg.click('#btnPlay'); await pg.wait_for_timeout(200)
        await pg.evaluate("VB.play.auto = false; VB.applyStep(1, false)"); await pg.wait_for_timeout(400)
        save(await pg.screenshot(), 'rot-3')
        # 接發球
        await step(pg, 'recv')
        cb = await box(pg, '#court')
        save(await pg.screenshot(), 'recv-1', (0, cb[1], W, cb[3]))
        await drag_ball(pg, (3.0, 5.6))
        save(await pg.screenshot(), 'recv-2', (0, cb[1], W, cb[3]))
        await pg.mouse.up(); await pg.wait_for_timeout(200)
        await pg.evaluate("VB.play.auto = false; VB.applyStep(1, false)"); await pg.wait_for_timeout(350)
        save(await pg.screenshot(), 'recv-3')
        # 防扣球、防吊球
        await step(pg, 'spike')
        cb = await box(pg, '#court')
        save(await pg.screenshot(), 'learn-1', (0, cb[1], W, cb[3]))
        await pg.evaluate("VB.setSettings({attacker:{x:1.0,y:-1.4}})"); await pg.wait_for_timeout(400)
        save(await pg.screenshot(), 'learn-2', (0, cb[1], W, cb[3]))
        await pg.evaluate("VB.setSettings({attacker:{x:8.2,y:-1.3}})"); await pg.wait_for_timeout(300)
        await pg.evaluate("VB.startSim([1.6, 6.6]); VB.play.auto = false; VB.applyStep(1, false)"); await pg.wait_for_timeout(350)
        save(await pg.screenshot(), 'learn-3')
        await pg.evaluate("VB.applyStep(2, false)"); await pg.wait_for_timeout(350)
        save(await pg.screenshot(), 'learn-4')
        # 立體
        await step(pg, 'spike', "{cam:'stand'}")
        await pg.evaluate("VB.set3D(true)"); await pg.wait_for_timeout(900)
        cb = await box(pg, '#courtbox')
        await pg.evaluate("VB.startSim([1.6, 6.6]); VB.play.auto=false"); await pg.wait_for_timeout(900)
        save(await pg.screenshot(), '3d-1', (0, 0, W, cb[3]))
        await pg.evaluate("VB.S.cam='dig'; document.getElementById('camSel').value='dig'; VB.S.speed='slow'; VB.startSim([1.6, 6.6]); VB.play.auto=false"); await pg.wait_for_timeout(1250)
        save(await pg.screenshot(), '3d-2', (0, cb[1], W, cb[3]))
        await pg.evaluate("VB.S.speed='normal'")
        await pg.evaluate("VB.set3D(false)"); await pg.wait_for_timeout(200)
        # 設定
        await step(pg, 'spike')
        await pg.click('#btnSit'); await pg.wait_for_timeout(500)
        save(await pg.screenshot(), 'sit-1')
        await pg.evaluate("document.querySelector('#sitSheetBody').scrollTop = document.querySelector('.chips-multi').closest('fieldset').offsetTop - 160"); await pg.wait_for_timeout(200)
        sb = await box(pg, '#sitSheet')
        save(await pg.screenshot(), 'sit-2', (0, sb[1], W, min(H, sb[1] + 470)))
        await pg.click('#sitSheet [data-close]'); await pg.wait_for_timeout(400)
        # 自己擺
        await pg.click('#btnFreeToggle'); await pg.wait_for_timeout(500)
        cb = await box(pg, '#court')
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
