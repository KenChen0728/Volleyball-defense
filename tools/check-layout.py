"""各尺寸版面檢查：超出畫面、按鈕被蓋住、按鈕小於 44×44、字小於 12px、主要按鈕要不要捲動。
用法：python3 -m http.server 8765 之後執行  python3 tools/check-layout.py
結果依「問題、尺寸、畫面、元素」列出；有問題的畫面截圖存到 /tmp/vbcheck/。"""
import asyncio, os, json
from collections import defaultdict
from playwright.async_api import async_playwright

URL = os.environ.get('VB_URL', 'http://localhost:8765/index.html')
CHROME = os.environ.get('CHROME', '/usr/bin/google-chrome')
SIZES = [(360,640),(375,667),(390,844),(402,874),(430,932),(768,1024),(1024,768),(820,1180),(1180,820),
         (1366,768),(1280,800),(1920,1080),(2560,1440),(683,330),(812,375),(844,390),(874,402),(956,440)]
OUT = '/tmp/vbcheck'

MEASURE = r"""
(state) => {
  const issues = [];
  const vw = innerWidth, vh = innerHeight;
  const de = document.documentElement;
  if (de.scrollWidth > vw + 1) issues.push(['超出畫面左右', 'document', de.scrollWidth + '>' + vw]);
  const visible = el => { const r = el.getBoundingClientRect(); if (!r.width || !r.height) return null; const cs = getComputedStyle(el); if (cs.visibility === 'hidden' || cs.display === 'none') return null; return r; };
  // 被捲動容器切掉後看得到的範圍
  const clipRect = el => { let r = el.getBoundingClientRect(); let x0 = r.left, y0 = r.top, x1 = r.right, y1 = r.bottom; let p = el.parentElement;
    while (p && p !== document.body){ const cs = getComputedStyle(p); if (/(auto|scroll|hidden)/.test(cs.overflow + cs.overflowY + cs.overflowX)){ const q = p.getBoundingClientRect(); x0 = Math.max(x0, q.left); y0 = Math.max(y0, q.top); x1 = Math.min(x1, q.right); y1 = Math.min(y1, q.bottom); } p = p.parentElement; }
    x0 = Math.max(x0, 0); y0 = Math.max(y0, 0); x1 = Math.min(x1, vw); y1 = Math.min(y1, vh); return { x0, y0, x1, y1 }; };
  const name = el => (el.id ? '#' + el.id : '') + (el.className && typeof el.className === 'string' ? '.' + el.className.split(' ').join('.') : '') + ' 「' + (el.textContent || el.getAttribute('aria-label') || '').trim().slice(0, 12) + '」';
  const modal = [...document.querySelectorAll('.overlay')].find(o => !o.hidden);
  for (const el of document.querySelectorAll('button, a, [role=button], summary')){
    const r = visible(el); if (!r) continue;
    if (el.closest('[hidden]')) continue;
    if (modal && !modal.contains(el)) continue;   // 視窗後面的按鈕本來就被蓋住
    const c = clipRect(el); if (c.x1 - c.x0 < 4 || c.y1 - c.y0 < 4) continue;   // 捲出去的不算
    const inline = el.tagName === 'A' && el.closest('p, li');
    if (!inline && (r.width < 43.5 || r.height < 43.5)) issues.push(['按鈕小於 44×44', name(el), Math.round(r.width) + '×' + Math.round(r.height)]);
    const cx = (c.x0 + c.x1) / 2, cy = (c.y0 + c.y1) / 2;
    const top = document.elementFromPoint(cx, cy);
    if (top && top !== el && !el.contains(top) && !(top.closest && top.closest('.toast'))) issues.push(['按鈕被蓋住', name(el), 'by ' + name(top)]);
  }
  // HTML 文字大小
  const tw = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  let n; const seen = new Set();
  while ((n = tw.nextNode())){
    if (!n.textContent.trim()) continue;
    const el = n.parentElement; if (!el || seen.has(el)) continue; seen.add(el);
    if (el.closest('svg') || el.closest('[hidden]')) continue;
    const r = visible(el); if (!r) continue;
    const c = clipRect(el); if (c.x1 - c.x0 < 2 || c.y1 - c.y0 < 2) continue;
    const fs = parseFloat(getComputedStyle(el).fontSize);
    if (fs < 12) issues.push(['字小於 12px', name(el), fs.toFixed(1) + 'px']);
  }
  // SVG 文字：用實際顯示的大小
  for (const t of document.querySelectorAll('#court text')){
    if (t.closest('[visibility=hidden]') || t.closest('[hidden]')) continue;
    const r = t.getBoundingClientRect(); if (!r.width) continue;
    if (!t.textContent.trim()) continue;
    const m = t.getScreenCTM(); const fs = parseFloat(t.getAttribute('font-size') || getComputedStyle(t).fontSize);
    const px = fs * Math.hypot(m.a, m.b);
    if (px < 11.5 && !t.classList.contains('zn')) issues.push([state === 'main-sheet' ? '設定時的預覽球場字小於 12px' : '球場字小於 12px', 'svg「' + t.textContent.trim().slice(0, 8) + '」', px.toFixed(1) + 'px']);
  }
  // 主要按鈕要不用捲動就看得到
  const prim = state === 'home' ? document.getElementById('btnStart') : (state.startsWith('main') ? document.getElementById('btnPlay') : null);
  if (prim){ const r = prim.getBoundingClientRect(); if (r.bottom > vh + 1 || r.top < 0) issues.push(['主要按鈕要捲動才看得到', name(prim), Math.round(r.bottom) + '>' + vh]); }
  // 球場不能被擠到太小
  if (state.startsWith('main')){ const r = document.getElementById('court').getBoundingClientRect(); if (r.height < 220) issues.push(['球場太矮', '#court', Math.round(r.height) + 'px']); }
  return issues;
}
"""

async def set_state(pg, st):
    await pg.evaluate("VB.showScreen('home', false)")
    if st == 'home':
        return
    if st.startswith('main'):
        await pg.evaluate("VB.S.mode='learn'; VB.showScreen('main', false); VB.markHintSeen()")
        await pg.wait_for_timeout(150)
        if st == 'main-dig':
            await pg.evaluate("VB.startSim([1.5,6.5]); VB.play.auto=false; VB.applyStep(1,false)")
        if st == 'main-set':
            await pg.evaluate("VB.startSim([1.5,6.5]); VB.play.auto=false; VB.applyStep(3,false)")
        if st == 'main-free':
            await pg.evaluate("VB.setMode('free')")
        if st == 'main-sheet':
            await pg.evaluate("VB.openSheet('sitSheet')")
        if st == 'main-help':
            await pg.evaluate("VB.openHelp('learn')")
    if st == 'know':
        await pg.evaluate("VB.showScreen('know', false); document.querySelectorAll('details').forEach(d=>d.open=true)")
    await pg.wait_for_timeout(250)

async def main():
    os.makedirs(OUT, exist_ok=True)
    results = defaultdict(list)
    async with async_playwright() as p:
        b = await p.chromium.launch(executable_path=CHROME, args=['--no-sandbox'])
        for (w, h) in SIZES:
            for scheme in (['light', 'dark'] if (w, h) in [(390,844),(844,390),(1366,768)] else ['light']):
                touch = w < 1100 or h < 500
                ctx = await b.new_context(viewport={'width': w, 'height': h}, device_scale_factor=1, has_touch=touch, color_scheme=scheme)
                pg = await ctx.new_page()
                await pg.goto(URL); await pg.wait_for_timeout(250)
                for st in ['home', 'main', 'main-dig', 'main-set', 'main-free', 'main-sheet', 'main-help', 'know']:
                    await set_state(pg, st)
                    iss = await pg.evaluate(MEASURE, st)
                    for i in iss:
                        results[i[0]].append((f'{w}x{h}', scheme, st, i[1], i[2]))
                    if iss:
                        await pg.screenshot(path=f'{OUT}/{w}x{h}-{scheme}-{st}.png')
                    await pg.evaluate("VB.closeTop && (VB.closeTop(true), VB.closeTop(true))")
                await ctx.close()
        await b.close()
    if not results:
        print('沒有發現問題')
    for k, v in results.items():
        print(f'\n== {k}（{len(v)}）')
        seen = set()
        for row in v:
            key = (row[0], row[2], row[3].split('「')[0])
            if key in seen: continue
            seen.add(key)
            print('  ', ' | '.join(row))

if __name__ == '__main__':
    asyncio.run(main())
