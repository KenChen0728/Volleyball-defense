"""練球闖關版面檢查：各尺寸、深淺色、每個畫面和視窗，量超出畫面、按鈕太小、被蓋住、字太小。
用法：在 repo 根目錄 python3 -m http.server 8790，再跑 python3 training/tools/check-layout.py"""
from playwright.sync_api import sync_playwright
URL = "http://localhost:8790/training/"
SIZES = [(360,640),(375,667),(390,844),(430,932),(844,390),(768,1024),(1024,768),(1366,768),(1920,1080),(683,330)]
JS = r"""() => {
 const out=[]; const vw=innerWidth;
 if(document.documentElement.scrollWidth>vw+1) out.push('頁面可以左右捲 '+document.documentElement.scrollWidth);
 const root = document.querySelector('#layer .sheet') || document;
 root.querySelectorAll('button,input,textarea').forEach(b=>{
   if(b.closest('details:not([open])')) return; const r=b.getBoundingClientRect(); if(!r.width||!r.height) return;
   if(r.right>vw+1||r.left<-1) out.push('超出左右：'+b.textContent.trim().slice(0,16));
   if((r.height<44||r.width<44) && !b.closest('.foot')) out.push(`太小 ${Math.round(r.width)}x${Math.round(r.height)}：`+(b.textContent.trim().slice(0,16)||b.getAttribute('aria-label')));
   const cx=r.left+r.width/2, cy=r.top+r.height/2;
   if(cy>0 && cy<innerHeight && cx>0 && cx<vw){ const t=document.elementFromPoint(cx,cy);
     if(t && !b.contains(t) && !t.closest('.mini') && !t.closest('.top') && !t.closest('#toast') && !b.closest('.top') && !b.closest('.mini')) out.push('被蓋住：'+(b.textContent.trim().slice(0,16))+' ← '+(t.className||t.tagName)); }
 });
 document.querySelectorAll('body *').forEach(e=>{ if(e.closest('svg')) return; const fs=parseFloat(getComputedStyle(e).fontSize); if(e.childNodes.length && [...e.childNodes].some(n=>n.nodeType===3&&n.textContent.trim()) && fs<12) out.push('字太小 '+fs+'：'+e.textContent.trim().slice(0,12)); });
 return [...new Set(out)];
}"""
STATES = [("首頁",""),("今天","today"),("地圖","map-atk"),("體能","fitness"),("參考卡","ref-team1"),("說明","help")]
problems = 0
with sync_playwright() as p:
    br = p.chromium.launch()
    for (w,h) in SIZES:
        for dark in (False, True):
            pg = br.new_page(viewport={"width":w,"height":h}, color_scheme="dark" if dark else "light")
            errs=[]; pg.on("pageerror", lambda e: errs.append(str(e)))
            pg.goto(URL); pg.wait_for_timeout(300)
            def check(name):
                global problems
                r = pg.evaluate(JS)
                for x in r: print(f"{w}x{h}{' 深' if dark else ''}｜{name}｜{x}"); problems += 1
            for name,hsh in STATES:
                pg.evaluate(f"location.hash='{hsh}'"); pg.wait_for_timeout(150); check(name)
            pg.evaluate("location.hash='ref-team1'"); pg.wait_for_timeout(150)
            pg.click("[data-a='tstep:1']", force=True); pg.wait_for_timeout(200); check("團隊流程圖")
            for j in (4, 7, 11):
                pg.evaluate("location.hash='today'"); pg.wait_for_timeout(150)
                pg.click("summary"); pg.wait_for_timeout(100); pg.click(f"[data-a='tjump:{j}']"); pg.wait_for_timeout(200); check(f"練球模式第{j+1}項")
                pg.click("[data-a^=how]"); pg.wait_for_timeout(350); check(f"第{j+1}項要領視窗")
                pg.keyboard.press("Escape"); pg.wait_for_timeout(350)
            pg.evaluate("location.hash='today'"); pg.wait_for_timeout(150)
            pg.click("[data-a^=how]"); pg.wait_for_timeout(350); check("今天怎麼練視窗")
            for e in errs: print(f"{w}x{h}｜錯誤｜{e}"); problems += 1
            pg.close()
    br.close()
print("問題數：", problems)
