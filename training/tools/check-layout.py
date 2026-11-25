"""練球手冊版面檢查：走過每一頁，在各種尺寸、深淺色量問題。
用法：在 repo 根目錄先開 python3 -m http.server 8790，再跑 python3 training/tools/check-layout.py [--shots 資料夾]"""
import sys, json
from playwright.sync_api import sync_playwright

BASE = "http://localhost:8790/training/index.html"
SIZES = [(360,640),(375,667),(390,844),(430,932),(844,390),(768,1024),(1024,768),(1366,768),(1920,1080),(683,330)]
MEASURE = r"""() => {
  const out = [], W = innerWidth;
  if (document.documentElement.scrollWidth > W + 1) out.push(["頁面可以左右捲", document.documentElement.scrollWidth + ">" + W]);
  if (document.title.startsWith("ERROR")) out.push(["程式錯誤", document.title]);
  document.querySelectorAll("button").forEach(b => {
    const r = b.getBoundingClientRect(); if (!r.width) return;
    if (r.width < 43.5 || r.height < 43.5) out.push(["按鈕小於 44", (b.textContent||"").trim().slice(0,16) + " " + Math.round(r.width) + "x" + Math.round(r.height)]);
    if (r.right > W + 1 || r.left < -1) out.push(["按鈕超出畫面", (b.textContent||"").trim().slice(0,16)]);
    if (r.top >= 0 && r.bottom <= innerHeight) { const e = document.elementFromPoint(r.left + r.width/2, r.top + r.height/2);
      if (e && !b.contains(e) && !e.closest(".top")) out.push(["按鈕被蓋住", (b.textContent||"").trim().slice(0,16)]); }
  });
  document.querySelectorAll("p,li,span,div,small,figcaption,h1,h2,h3").forEach(e => {
    if (!e.childNodes.length || ![...e.childNodes].some(n => n.nodeType===3 && n.textContent.trim())) return;
    const fs = parseFloat(getComputedStyle(e).fontSize); if (fs < 12) out.push(["字小於 12px", e.textContent.trim().slice(0,16) + " " + fs]);
  });
  document.querySelectorAll("svg text").forEach(t => { const svg = t.ownerSVGElement; const r = svg.getBoundingClientRect(), vb = svg.viewBox.baseVal;
    if (!vb || !vb.width) return; const sc = r.width / vb.width; const fs = parseFloat(t.getAttribute("font-size")||"12") * sc;
    if (fs < 9) out.push(["圖裡的字太小", (t.textContent||"").slice(0,14) + " " + fs.toFixed(1)]); });
  return out;
}"""

def routes(page):
    page.goto(BASE); page.wait_for_timeout(200)
    data = page.evaluate("() => SECTIONS.map(s => [s.id, s.items.map(i => i.id)])")
    r = ["", "today", "help", "plan", "plan/out"]
    for sid, items in data:
        r.append("s/" + sid); r += ["i/%s/%s" % (sid, i) for i in items]
    return r

def main():
    shots = sys.argv[sys.argv.index("--shots")+1] if "--shots" in sys.argv else None
    problems = {}
    with sync_playwright() as p:
        b = p.chromium.launch()
        for scheme in ("light", "dark"):
            for (w,h) in SIZES:
                ctx = b.new_context(viewport={"width":w,"height":h}, color_scheme=scheme, device_scale_factor=1)
                page = ctx.new_page(); errs = []
                page.on("pageerror", lambda e: errs.append(str(e)))
                for rt in routes(page):
                    page.goto(BASE + "#" + rt); page.wait_for_timeout(120)
                    for kind, el in page.evaluate(MEASURE):
                        problems.setdefault((kind, rt, el), set()).add("%dx%d %s" % (w,h,scheme))
                    if shots and scheme=="light" and (w,h) in [(390,844),(1366,768)]:
                        page.screenshot(path="%s/%s_%dx%d.png" % (shots, (rt or "home").replace("/","_"), w, h), full_page=True)
                for e in errs: problems.setdefault(("JS 錯誤", "", e), set()).add("%dx%d" % (w,h))
                ctx.close()
        b.close()
    if not problems: print("沒有發現問題"); return
    for (kind, rt, el), where in sorted(problems.items()):
        print("%s｜%s｜%s｜%s" % (kind, rt or "首頁", el, "、".join(sorted(where))[:120]))
    sys.exit(1)

main()
