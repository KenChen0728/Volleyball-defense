/* 排球防守站位：立體畫面（自己寫的透視投影，用 canvas 畫，不需要外部套件）
 * 世界座標：x 0~9 由左到右，y 由網子往我們底線為正（對方場地為負），z 往上（公尺）。
 */
(function(){
'use strict';
const NET_H = 2.24, NET_BOTTOM = 1.24, ANT_H = 3.04, NEAR = 0.15;
function sub(a, b){ return [a[0]-b[0], a[1]-b[1], a[2]-b[2]]; }
function dot(a, b){ return a[0]*b[0] + a[1]*b[1] + a[2]*b[2]; }
function cross(a, b){ return [a[1]*b[2]-a[2]*b[1], a[2]*b[0]-a[0]*b[2], a[0]*b[1]-a[1]*b[0]]; }
function norm(a){ const n = Math.hypot(a[0], a[1], a[2]) || 1; return [a[0]/n, a[1]/n, a[2]/n]; }

function create(canvas){
  const ctx = canvas.getContext('2d');
  let W = 0, H = 0, dpr = 1, cam = null;
  function resize(){
    const r = canvas.getBoundingClientRect();
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    W = Math.max(1, Math.round(r.width)); H = Math.max(1, Math.round(r.height));
    canvas.width = Math.round(W * dpr); canvas.height = Math.round(H * dpr);
  }
  function setCamera(c){
    const f = norm(sub(c.target, c.eye));
    let r = cross(f, [0, 0, 1]); if (Math.hypot(r[0], r[1], r[2]) < 1e-6) r = [1, 0, 0];
    r = norm(r); const u = cross(r, f);
    const fov = (c.fov || 62) * Math.PI / 180;
    const focal = (H / 2) / Math.tan(fov / 2);
    cam = { eye:c.eye, f, r, u, focal };
  }
  function toCam(p){ const d = sub(p, cam.eye); return [dot(d, cam.r), dot(d, cam.u), dot(d, cam.f)]; }
  function proj(c){ return [W / 2 + cam.focal * c[0] / c[2], H / 2 - cam.focal * c[1] / c[2]]; }
  // 多邊形對近平面裁切（Sutherland–Hodgman）
  function clipPoly(pts){
    const cs = pts.map(toCam), out = [];
    for (let i = 0; i < cs.length; i++){
      const a = cs[i], b = cs[(i + 1) % cs.length];
      const ain = a[2] >= NEAR, bin = b[2] >= NEAR;
      if (ain) out.push(a);
      if (ain !== bin){ const t = (NEAR - a[2]) / (b[2] - a[2]); out.push([a[0] + (b[0]-a[0]) * t, a[1] + (b[1]-a[1]) * t, NEAR]); }
    }
    return out.map(proj);
  }
  function poly(pts, fill, stroke, lw){
    const s = clipPoly(pts); if (s.length < 3) return;
    ctx.beginPath(); ctx.moveTo(s[0][0], s[0][1]); for (let i = 1; i < s.length; i++) ctx.lineTo(s[i][0], s[i][1]); ctx.closePath();
    if (fill){ ctx.fillStyle = fill; ctx.fill(); }
    if (stroke){ ctx.strokeStyle = stroke; ctx.lineWidth = lw || 1; ctx.stroke(); }
  }
  function line(a, b, color, lw){
    let ca = toCam(a), cb = toCam(b);
    if (ca[2] < NEAR && cb[2] < NEAR) return;
    if (ca[2] < NEAR){ const t = (NEAR - ca[2]) / (cb[2] - ca[2]); ca = [ca[0] + (cb[0]-ca[0]) * t, ca[1] + (cb[1]-ca[1]) * t, NEAR]; }
    if (cb[2] < NEAR){ const t = (NEAR - cb[2]) / (ca[2] - cb[2]); cb = [cb[0] + (ca[0]-cb[0]) * t, cb[1] + (ca[1]-cb[1]) * t, NEAR]; }
    const pa = proj(ca), pb = proj(cb);
    ctx.beginPath(); ctx.moveTo(pa[0], pa[1]); ctx.lineTo(pb[0], pb[1]); ctx.strokeStyle = color; ctx.lineWidth = lw; ctx.stroke();
  }
  function lineW(a, b, color, meters){ // 依距離換算線寬
    const c = toCam([(a[0]+b[0])/2, (a[1]+b[1])/2, (a[2]+b[2])/2]);
    line(a, b, color, Math.max(1, cam.focal * meters / Math.max(c[2], NEAR)));
  }
  function person(e, colors){
    const feet = toCam([e.x, e.y, e.z || 0]), head = toCam([e.x, e.y, (e.z || 0) + (e.h || 1.68)]);
    if (feet[2] < NEAR || head[2] < NEAR) return;
    const pf = proj(feet), ph = proj(head);
    const w = cam.focal * .46 / feet[2];
    // 地上的影子
    const sh = toCam([e.x, e.y, 0]);
    if (sh[2] > NEAR){ const ps = proj(sh); ctx.beginPath(); ctx.ellipse(ps[0], ps[1], w * .75, w * .22, 0, 0, Math.PI * 2); ctx.fillStyle = 'rgba(0,0,0,.28)'; ctx.fill(); }
    const top = ph[1] + w * .55, bot = pf[1];
    ctx.fillStyle = e.color; ctx.strokeStyle = 'rgba(255,255,255,.9)'; ctx.lineWidth = Math.max(1, w * .06);
    const r = w / 2;
    ctx.beginPath(); ctx.moveTo(pf[0] - r, bot); ctx.lineTo(pf[0] - r, top + r * .6); ctx.quadraticCurveTo(pf[0] - r, top, pf[0], top); ctx.quadraticCurveTo(pf[0] + r, top, pf[0] + r, top + r * .6); ctx.lineTo(pf[0] + r, bot); ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.beginPath(); ctx.arc(ph[0], ph[1] + w * .2, w * .33, 0, Math.PI * 2); ctx.fillStyle = e.skin || '#f2d2b6'; ctx.fill(); ctx.stroke();
    if (e.arms){ // 攔網或攻擊時手舉起來
      ctx.strokeStyle = e.color; ctx.lineWidth = Math.max(2, w * .18); ctx.lineCap = 'round';
      ctx.beginPath(); ctx.moveTo(pf[0] - r * .7, top + r * .3); ctx.lineTo(pf[0] - r * .55, ph[1] - w * .65); ctx.moveTo(pf[0] + r * .7, top + r * .3); ctx.lineTo(pf[0] + r * .55, ph[1] - w * .65); ctx.stroke();
    }
    if (e.label){
      const fs = Math.max(11, Math.min(26, w * .62));
      ctx.font = `700 ${fs}px system-ui, -apple-system, "PingFang TC", "Noto Sans TC", sans-serif`;
      const tw = ctx.measureText(e.label).width + fs * .7, th = fs * 1.35, ly = ph[1] - w * .95 - th / 2;
      ctx.fillStyle = e.tagBg || 'rgba(28,31,35,.82)';
      ctx.beginPath(); if (ctx.roundRect) ctx.roundRect(ph[0] - tw/2, ly - th/2, tw, th, th * .3); else ctx.rect(ph[0] - tw/2, ly - th/2, tw, th); ctx.fill();
      ctx.fillStyle = '#fff'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(e.label, ph[0], ly + 1);
    }
  }
  function ball(b){
    const c = toCam([b.x, b.y, b.z]); if (c[2] < NEAR) return;
    const sh = toCam([b.x, b.y, 0]);
    if (sh[2] > NEAR){ const ps = proj(sh), rs = cam.focal * .13 / sh[2]; ctx.beginPath(); ctx.ellipse(ps[0], ps[1], rs * 1.2, rs * .4, 0, 0, Math.PI*2); ctx.fillStyle = 'rgba(0,0,0,.35)'; ctx.fill(); }
    const p = proj(c), r = Math.max(3, cam.focal * .105 / c[2]);
    const g = ctx.createRadialGradient(p[0] - r * .35, p[1] - r * .35, r * .1, p[0], p[1], r);
    g.addColorStop(0, '#fff6b0'); g.addColorStop(.55, '#facc15'); g.addColorStop(1, '#b7791f');
    ctx.beginPath(); ctx.arc(p[0], p[1], r, 0, Math.PI * 2); ctx.fillStyle = g; ctx.fill();
    ctx.strokeStyle = '#854d0e'; ctx.lineWidth = Math.max(1, r * .12); ctx.stroke();
  }
  function render(scene){
    if (!W) resize();
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    setCamera(scene.camera);
    const dark = scene.dark;
    // 天空、牆
    const sky = ctx.createLinearGradient(0, 0, 0, H);
    sky.addColorStop(0, dark ? '#1b2027' : '#dfe7ee'); sky.addColorStop(1, dark ? '#2a2f37' : '#f3efe6');
    ctx.fillStyle = sky; ctx.fillRect(0, 0, W, H);
    // 地板與場地
    poly([[-6,-16,0],[15,-16,0],[15,16,0],[-6,16,0]], dark ? '#3a3f47' : '#c9b79c');
    poly([[0,-9,0],[9,-9,0],[9,0,0],[0,0,0]], dark ? '#5a4632' : '#d9b483');
    poly([[0,0,0],[9,0,0],[9,9,0],[0,9,0]], dark ? '#6a5034' : '#e8c796');
    poly([[0,0,0],[9,0,0],[9,3,0],[0,3,0]], dark ? '#5e472e' : '#ddb67f');
    poly([[0,-3,0],[9,-3,0],[9,0,0],[0,0,0]], dark ? '#52402c' : '#d2aa75');
    if (scene.zones) for (const z of scene.zones) poly(z.pts.map(p => [p[0], p[1], 0.005]), z.fill);
    const lc = '#ffffff';
    for (const [a, b] of [[[0,-9],[9,-9]],[[0,9],[9,9]],[[0,-9],[0,9]],[[9,-9],[9,9]],[[0,3],[9,3]],[[0,-3],[9,-3]],[[0,0],[9,0]]])
      lineW([a[0], a[1], .01], [b[0], b[1], .01], lc, .05);
    if (scene.target) { const t = scene.target; const pts = []; for (let i = 0; i < 20; i++){ const a = i / 20 * Math.PI * 2; pts.push([t[0] + Math.cos(a) * .8, t[1] + Math.sin(a) * .8, .02]); } poly(pts, 'rgba(14,116,144,.28)', 'rgba(14,116,144,.8)', 2); }
    // 依距離排序：網子後面的東西先畫
    const items = [];
    for (const e of scene.people || []) items.push({ kind:'p', e, d: toCam([e.x, e.y, 1])[2], side: e.y < 0 ? 0 : 1 });
    if (scene.ball) items.push({ kind:'b', e:scene.ball, d: toCam([scene.ball.x, scene.ball.y, scene.ball.z])[2], side: scene.ball.y < 0 ? 0 : 1 });
    const eyeSide = cam.eye[1] < 0 ? 0 : 1;
    const behind = items.filter(i => i.side !== eyeSide).sort((a, b) => b.d - a.d);
    const front = items.filter(i => i.side === eyeSide).sort((a, b) => b.d - a.d);
    const drawItem = i => i.kind === 'p' ? person(i.e) : ball(i.e);
    behind.forEach(drawItem);
    // 網子、標竿
    poly([[-0.6,0,NET_BOTTOM],[9.6,0,NET_BOTTOM],[9.6,0,NET_H],[-0.6,0,NET_H]], dark ? 'rgba(10,10,12,.35)' : 'rgba(20,20,24,.22)');
    for (let x = -0.5; x <= 9.5; x += 0.5) lineW([x, 0, NET_BOTTOM], [x, 0, NET_H], 'rgba(20,20,24,.35)', .01);
    for (let z = NET_BOTTOM; z <= NET_H + .001; z += .25) lineW([-0.6, 0, z], [9.6, 0, z], 'rgba(20,20,24,.35)', .01);
    lineW([-0.6, 0, NET_H], [9.6, 0, NET_H], '#f8fafc', .07);
    lineW([-1, 0, 0], [-1, 0, NET_H + .1], '#64748b', .08); lineW([10, 0, 0], [10, 0, NET_H + .1], '#64748b', .08);
    for (const x of [0, 9]){ for (let k = 0; k < 9; k++){ const z0 = NET_BOTTOM + k * .2; lineW([x, 0, z0], [x, 0, Math.min(ANT_H, z0 + .2)], k % 2 ? '#ffffff' : '#dc2626', .02); } }
    if (scene.block) lineW([scene.block[0], 0, 2.3], [scene.block[1], 0, 2.3], 'rgba(28,31,35,.0)', .01);
    front.forEach(drawItem);
    if (scene.hud){ ctx.font = '600 14px system-ui, -apple-system, "PingFang TC", sans-serif'; ctx.fillStyle = dark ? '#ebe8e3' : '#1c1f23'; ctx.textAlign = 'left'; ctx.textBaseline = 'top'; ctx.fillText(scene.hud, 10, 10); }
  }
  // 點畫面上的地板：回傳場上座標
  function pick(clientX, clientY){
    if (!cam) return null;
    const r = canvas.getBoundingClientRect();
    const sx = clientX - r.left - W / 2, sy = -(clientY - r.top - H / 2);
    const dir = norm([cam.r[0] * sx + cam.u[0] * sy + cam.f[0] * cam.focal, cam.r[1] * sx + cam.u[1] * sy + cam.f[1] * cam.focal, cam.r[2] * sx + cam.u[2] * sy + cam.f[2] * cam.focal]);
    if (dir[2] >= -1e-4) return null;
    const t = -cam.eye[2] / dir[2];
    return [cam.eye[0] + dir[0] * t, cam.eye[1] + dir[1] * t];
  }
  return { resize, render, pick };
}
window.VB3D = { create };
})();
