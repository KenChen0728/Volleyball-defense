/* 排球站位 v2.0.0：輪轉、接發球、防扣球、防吊球
 * 座標：公尺。x 0~9 由左到右（站在我們底線往網子看），y 0~9 由網子往我們底線；對方場地 y < 0。
 */
(() => {
'use strict';

const APP_VERSION = '2.4.0';
const BUILD_DATE = '2026-11-16';
const VERSION_TEXT = `v${APP_VERSION}（${BUILD_DATE}）`;
const COPY = '© 2026 Ken Chen';
const KEY = { simple:'vbdef.simple.v1', settings:'vbdef.settings.v1', custom:'vbdef.custom.v1', hint:'vbdef.hint.drag.v1', hint2:'vbdef.hint.v2', screen:'vbdef.screen' };
const NS = 'http://www.w3.org/2000/svg';
const VB = { x:-0.45, y:-3.55, w:9.9, h:13.55 };
const TARGET = [4.8, 2.6];                       // （舊的目標區，只留給測試對照）
// 修正球的目標：舉球員接第一球時，送給 1 號位跑上來的舉對（輔舉）；離網稍微開一點，但不能太開，攔中才打得到
const FIX_T = [6.1, 1.9];
// 防起來的球一律接到舉球員會跑到的終點（網前、2 號位偏中間）；舉球員自己接第一球時改送修正目標
function digTarget(d){ return d === 'S' ? FIX_T : rt(); }
const RT0 = [5.6, 1.15];                         // 接發球的傳球目標：網前 1 公尺多、中間偏右
function rt(){ return VBRot.teamOK(S.system, S.recv) ? VBRot.TEAM.target : RT0; }   // 隊上的圖：舉球員在 2 號位偏中間舉
const SERVER_Y = -9.6;                           // 發球員站在對方底線後面
const HIT = { OH1:[0.9,0.75], MB:[3.9,0.75], OPP:[8.1,0.75] };
const APPROACH = { OH1:[0.7,3.8], MB:[3.2,3.4], OPP:[8.3,3.8] };
const READY = { 5:[1.6,5.8], 6:[4.5,6.8], 1:[7.4,5.8] };
const ROLES = ['OH1','MB','OPP','S','OH2','L'];
const ROLE_INFO = {
  OH1:{ tok:'大砲', name:'前排大砲' }, MB:{ tok:'攔中', name:'攔中' }, OPP:{ tok:'舉對', name:'舉對' },
  S:{ tok:'舉球', name:'舉球員' }, OH2:{ tok:'大砲', name:'後排大砲' }, L:{ tok:'自由', name:'自由' },
};
// 沒有自由（或後排攔中正在發球）時，自由的位置由後排攔中自己站
let libOff = false;
function setLibOff(off){ libOff = !!off; ROLE_INFO.L.tok = libOff ? '攔中' : '自由'; ROLE_INFO.L.name = libOff ? '後排攔中' : '自由'; }
const GROUP_COLOR = { front:'var(--front)', back:'var(--back)', set:'var(--setter)', lib:'var(--lib)' };
const BLOCKRES_DESC = {
  soft:'球打進攔網的範圍時，碰到手變成慢慢掉下來的小球，看後面誰去接（新手的攔網通常攔不死）。',
  kill:'球打進攔網的範圍就算攔死，直接擋回對方場地。',
  miss:'攔網沒碰到球，球照原本的路線飛過來。',
};
const FORM_NAME = { up:'心跟進', rot:'邊跟進', per:'心後', ours:'舉球留網前' };
const FORM_DESC = {
  up:'一個人站在攔網後面專守吊球，兩邊站深。對手吊球、推球多時適合。',
  rot:'攔網那一側的後排往前守吊球，6 號位轉去守直線深球。',
  per:'後排三個人靠邊線、底線站，重扣最好接；吊球靠 1 號位（或 5 號位）往前和退下來的前排。',
  ours:'隊上的做法：舉球員和舉對都不攔網。舉球員一律守 2 號位，接 2 號位前面的短球（在後排時也留在右邊網前、隨時舉球）；比較長的球給後面 1 號位的舉對。',
};
const STEPS = ['rot','recv','spike','tip'];
const STEP_NAME = { rot:'輪轉站位', recv:'接發球', spike:'防扣球', tip:'防吊球' };
const ROT_ORDER = [1,6,5,4,3,2];                 // 比賽中輪轉的順序（看舉球員在幾號位）
const ZC = { 4:[1.5,1.6], 3:[4.5,1.6], 2:[7.5,1.6], 5:[1.5,6.3], 6:[4.5,6.3], 1:[7.5,6.3] };

/* ---------- 小工具 ---------- */
function clamp(v, a, b){ return Math.max(a, Math.min(b, v)); }
function dist(p, q){ return Math.hypot(p[0]-q[0], p[1]-q[1]); }
function lerp(p, q, t){ return [p[0]+(q[0]-p[0])*t, p[1]+(q[1]-p[1])*t]; }
function unit(v){ const n = Math.hypot(v[0], v[1]) || 1; return [v[0]/n, v[1]/n]; }
function clonePos(P){ const o = {}; for (const r in P) o[r] = P[r].slice(); return o; }
function clampCourt(p){ return [clamp(p[0], -0.25, 9.25), clamp(p[1], 0.2, 9.5)]; }
// 球的高度：z = [起點, 終點, 最高點]（最高點 0 代表直線）
function zAt(z, t){
  if (!z) return 0.11;
  const [z0, z1, pk] = z, mid = (z0 + z1) / 2, h = pk > 0 ? Math.max(0, pk - mid) : 0;
  return z0 + (z1 - z0) * t + h * 4 * t * (1 - t);
}
const $ = id => document.getElementById(id);
function el(tag, attrs, parent){
  const e = document.createElementNS(NS, tag);
  if (attrs) for (const k in attrs) e.setAttribute(k, attrs[k]);
  if (parent) parent.appendChild(e);
  return e;
}
const store = {
  get(k, fb){ try{ const v = localStorage.getItem(k); return v == null ? fb : JSON.parse(v); }catch(e){ return fb; } },
  set(k, v){ try{ localStorage.setItem(k, JSON.stringify(v)); return true; }catch(e){ return false; } },
};
const sess = {
  get(k){ try{ return sessionStorage.getItem(k); }catch(e){ return null; } },
  set(k, v){ try{ sessionStorage.setItem(k, v); }catch(e){} },
};
const reduceMotion = (() => { try{ return window.matchMedia('(prefers-reduced-motion: reduce)'); }catch(e){ return { matches:false }; } })();
const darkMQ = (() => { try{ return window.matchMedia('(prefers-color-scheme: dark)'); }catch(e){ return { matches:false }; } })();

/* ---------- 狀態 ---------- */
const DEFAULTS = { system:'51', rot:1, recv:'team', useLib:true, step:'rot', serveX:1.6, view:'2d', cam:'dig',
  formation:'ours', canOH:true, canMB:true, canR:false, mbLate:false, blockRes:'soft', libero:5, radius:2, speed:'normal', flow:'flow', attackType:'spike', mode:'learn', attacker:{ x:8.2, y:-1.3 } };
const CAMS = ['dig','stand','S','MB','OH1','OPP','OH2','L'];
function sanitizeSettings(o){
  const r = {};
  if (!o || typeof o !== 'object') return r;
  if (['up','rot','per','ours'].includes(o.formation)) r.formation = o.formation;
  // v1.0 的舊設定（攔網四選一）換成「誰會攔網」
  const OLD = { double:[1,1,1,0], single:[1,1,1,1], mb:[0,1,0,0], none:[0,0,0,0] };
  if (OLD[o.block]){ const [a, b, c, d] = OLD[o.block]; r.canOH = !!a; r.canMB = !!b; r.canR = !!c; r.mbLate = !!d; }
  // v1 的「舉球員在前排／後排」換成輪次：前排用舉球員在 2 號位的那一輪
  if (o.rot == null && typeof o.setter === 'string'){ r.rot = o.setter.startsWith('front') ? 2 : 1; }
  if (o.setter === 'frontNo') r.canR = false;
  for (const key of ['canOH','canMB','canR','mbLate']) if (typeof o[key] === 'boolean') r[key] = o[key];
  if ([5,6].includes(+o.libero)) r.libero = +o.libero;
  if ([1.2,1.6,2,2.4].includes(+o.radius)) r.radius = +o.radius;
  if (['normal','slow'].includes(o.speed)) r.speed = o.speed;
  if (['spike','tip'].includes(o.attackType)) r.attackType = o.attackType;
  if (['soft','kill','miss'].includes(o.blockRes)) r.blockRes = o.blockRes;
  if (['flow','step'].includes(o.flow)) r.flow = o.flow;
  if (['learn','free'].includes(o.mode)) r.mode = o.mode;
  if (o.attacker && isFinite(o.attacker.x) && isFinite(o.attacker.y)) r.attacker = { x:clamp(+o.attacker.x, .3, 8.7), y:clamp(+o.attacker.y, -3.2, -.6) };
  if (['51','62','42'].includes(o.system)) r.system = o.system;
  if ([1,2,3,4,5,6].includes(+o.rot)) r.rot = +o.rot;
  if (['team','w5','p4','p3'].includes(o.recv)) r.recv = o.recv;
  if (typeof o.useLib === 'boolean') r.useLib = o.useLib;
  if (STEPS.includes(o.step)) r.step = o.step;
  if (o.serveX != null && isFinite(o.serveX)) r.serveX = clamp(+o.serveX, .4, 8.6);
  if (['2d','3d'].includes(o.view)) r.view = o.view;
  if (CAMS.includes(o.cam)) r.cam = o.cam;
  // v2.1 以前的預設（五人 W、心跟進）改成隊上的站法（教練畫的單舉、舉球員守 2 號位）
  const sv = +o.sv || 0;
  if (sv < 3){ if (r.recv == null || r.recv === 'w5') r.recv = 'team'; if (r.formation == null || r.formation === 'up') r.formation = 'ours'; }
  // v2.2：隊上舉球員和舉對都不攔網（教練說的），舊的預設「會攔」改掉
  if (sv < 4) r.canR = false;
  return r;
}
function sanitizeCustom(o){
  if (!o || typeof o !== 'object') return null;
  const r = {};
  for (const k of ROLES){
    const p = o[k];
    if (!Array.isArray(p) || p.length !== 2 || !isFinite(p[0]) || !isFinite(p[1])) return null;
    r[k] = [clamp(+p[0], -0.25, 9.25), clamp(+p[1], 0.2, 9.5)];
  }
  return r;
}
const S = Object.assign({}, DEFAULTS, sanitizeSettings(store.get(KEY.settings, {})));
// 隊員版：網址加 ?team=1 打開就是隊員版（記在這台裝置），?coach=1 換回教練版
let simple = store.get(KEY.simple, false) === true;
try{
  const qp = new URLSearchParams(location.search);
  if (qp.has('team')){ simple = true; store.set(KEY.simple, true); }
  if (qp.has('coach')){ simple = false; store.set(KEY.simple, false); }
  if (qp.has('team') || qp.has('coach')) history.replaceState(history.state, '', location.pathname + location.hash);
}catch(e){}
// 隊員版固定用隊上的做法：單舉、隊上的接發球、舉球留網前、只有大砲和攔中攔網
function applySimple(){
  document.body.classList.toggle('simple', simple);
  if (!simple) return;
  Object.assign(S, { system:'51', recv:'team', formation:'ours', canOH:true, canMB:true, canR:false, mbLate:false, libero:5, radius:2 });
}
applySimple();
S.attacker = Object.assign({}, S.attacker);
let custom = sanitizeCustom(store.get(KEY.custom, null));
function saveSettings(){
  store.set(KEY.settings, { sv:4, blockRes:S.blockRes, flow:S.flow, system:S.system, rot:S.rot, recv:S.recv, useLib:S.useLib, step:S.step, serveX:+S.serveX.toFixed(2), view:S.view, cam:S.cam,
    formation:S.formation, canOH:S.canOH, canMB:S.canMB, canR:S.canR, mbLate:S.mbLate, libero:S.libero, radius:S.radius,
    speed:S.speed, attackType:S.attackType, mode:S.mode, attacker:{ x:+S.attacker.x.toFixed(2), y:+S.attacker.y.toFixed(2) } });
}
function saveCustom(){ if (custom) store.set(KEY.custom, custom); }

/* ---------- 輪轉：誰在前排 ---------- */
function rotInfo(){ return VBRot.rotation(S.system, S.rot); }
function setterBack(){ return !rotInfo().setterFront; }
function rotIndex(){ return ROT_ORDER.indexOf(S.rot) + 1; }

/* ---------- 誰站哪裡（防守時的固定位置） ---------- */
function lineup(){
  const sb = setterBack();
  const lu = {
    OH1:{ zone:4, front:true }, MB:{ zone:3, front:true },
    OPP: sb ? { zone:2, front:true } : { zone:1, front:false },
    S:   sb ? { zone:1, front:false } : { zone:2, front:true },
    L:{ zone:S.libero, front:false }, OH2:{ zone:S.libero === 5 ? 6 : 5, front:false },
  };
  if (S.formation === 'ours' && sb){ lu.S.zone = 2; lu.OPP.zone = 1; }
  return lu;
}
function groupOf(role, lu){ if (role === 'S') return 'set'; if (role === 'L' && !libOff) return 'lib'; return lu[role].front ? 'front' : 'back'; }
function roleName(r, lu){ return `${ROLE_INFO[r].name}（${lu[r].zone}號位）`; }
// 會不會攔網：只有前排、而且在「誰會攔網」裡勾選的人
function toggleOf(r){ return r === 'OH1' ? S.canOH : (r === 'MB' ? S.canMB : ((r === 'OPP' || r === 'S') ? S.canR : false)); }
function canBlockRole(r, lu){ return lu[r].front && lu[r].zone === ({ OH1:4, MB:3 }[r] || 2) && toggleOf(r); }
function canBlockFree(r, lu){ return lu[r].front && toggleOf(r); }
function sideOf(x){ return x > 6 ? 'R' : (x < 3 ? 'L' : 'M'); }

function compute(att){
  const lu = lineup();
  const occ = {}; for (const r of ROLES) occ[lu[r].zone] = r;
  const a = att.x, side = sideOf(a);
  const X = v => side === 'L' ? 9 - v : v;
  const inward = side === 'R' ? -1 : (side === 'L' ? 1 : 0);
  const canBlock = z => [2,3,4].includes(z) && canBlockRole(occ[z], lu);
  const P = {}, N = {};
  const outer = side === 'R' ? 2 : (side === 'L' ? 4 : null);
  const offZ = side === 'R' ? 4 : (side === 'L' ? 2 : null);
  let blockers = [], tipZ = null, seg = null;

  const late = S.mbLate;
  if (side !== 'M'){
    const o = canBlock(outer), m = canBlock(3);
    if (o && m && !late) blockers = [outer, 3];
    else if (o) blockers = [outer];
    else if (m && !late) blockers = [3];
  } else {
    const prim = canBlock(3) ? 3 : (canBlock(2) ? 2 : (canBlock(4) ? 4 : null));
    if (prim){ const helper = prim === 3 ? [2,4].find(z => canBlock(z)) : null; blockers = helper ? [3, helper] : [prim]; }
  }
  const ax = clamp(a, .55, 8.45);
  if (blockers.length){
    if (side !== 'M'){
      if (blockers.length === 2){
        P[outer] = [ax, .35]; P[3] = [clamp(ax + inward*1.0, .55, 8.45), .35];
        N[outer] = '攔網（外側）：手對準攻擊手的手臂，封住直線';
        N[3] = '攔網（併過來）：跟外側的人併攏，中間不能有縫';
      } else {
        const z = blockers[0]; P[z] = [ax, .35];
        N[z] = z === 3 ? '唯一攔網：看對方舉給誰，側併步跟過去；來不及就不要硬跳，喊「沒攔」'
                       : '單人攔網：封直線，斜線交給後排';
      }
    } else {
      const pz = blockers[0];
      P[pz] = [ax, .35]; N[pz] = pz === 3 ? '攔網：正對攻擊手的手臂跳' : '攔網：攔中不攔，由妳到中間攔';
      if (blockers.length === 2){ const h = blockers[1]; P[h] = [clamp(ax + (h === 2 ? 1.0 : -1.0), .55, 8.45), .35]; N[h] = '攔網（併過來）：跟攔中併攏'; }
    }
    const xs = blockers.map(z => P[z][0]);
    seg = [Math.min(...xs) - .45, Math.max(...xs) + .45];
  }
  // 沒去攔網的前排（Gold Medal Squared：退到離網 3 公尺、離邊線 3 公尺左右守吊球；
  // 三個人都不攔時，平均分開，離網 1.5～2.4 公尺，不要擋到後排看球）
  const mbWhy = !canBlock(3) ? '攔中不攔網' : '攔中來不及：不要硬跳（晚到的攔網，兩人中間會有縫）';
  for (const z of [2,3,4]){
    if (blockers.includes(z)) continue;
    const isS = occ[z] === 'S';
    if (!blockers.length){
      P[z] = isS ? [7.2, 2.1] : (z === 4 ? [1.5, 2.1] : (z === 3 ? [4.5, 2.1] : [7.5, 2.1]));
      N[z] = isS ? '沒人攔網：舉球員也退下來，離網兩公尺左右守短球，球起來就去舉'
                 : '沒人攔網：前排三個人平均分開，離網兩公尺左右蹲低，不要擋到後排看球；守短球、吊球';
      continue;
    }
    if (isS){
      P[z] = [7.0, 2.4];
      N[z] = lu.S.front ? '舉球員不攔網：退到右前三米線內守吊球，球起來就去舉'
                        : '舉球員（後排）：留在右邊網前守短球；不能攔網，也不能把高過網子的球直接打過去';
      continue;
    }
    if (side === 'M'){
      if (z === 3){ P[z] = [clamp(ax, 2.5, 6.5), 2.6]; N[z] = `${mbWhy}，退到攔網後面、三米線附近守吊球`; }
      else { P[z] = z === 4 ? [2.4, 3.0] : [6.6, 3.0]; N[z] = '沒去攔網：退到離網 3 公尺，守吊球和小斜線'; }
      continue;
    }
    if (z === offZ){ P[z] = [X(2.0), 3.2]; N[z] = '沒去攔網：退到離網 3 公尺、離邊線 2 公尺左右，守吊球、小斜線和中間的軟球'; continue; }
    if (z === outer){ P[z] = [X(7.0), 3.0]; N[z] = '不攔網：退到攔網後面、離網 3 公尺，守吊球'; continue; }
    P[z] = [X(5.2), 2.9]; N[z] = `${mbWhy}，退到攔網內側、三米線附近，守吊球和短球`;
  }
  // 後排
  const nb = side === 'R' ? 1 : (side === 'L' ? 5 : null);
  const fb = side === 'R' ? 5 : (side === 'L' ? 1 : null);
  const setterAt1 = occ[1] === 'S';
  const frontCover = side !== 'M' && blockers.length > 0 && !blockers.includes(outer);
  if (!blockers.length){
    const dx = side === 'R' ? .3 : (side === 'L' ? -.3 : 0);
    P[5] = [1.2+dx, 6.6]; P[6] = [4.5+dx, 7.9]; P[1] = [7.8+dx, 6.6];
    for (const z of [5,6,1]) N[z] = '沒人攔網：站深、站開，對方可以打任何地方';
  } else if (side === 'M'){
    if (S.formation === 'up'){
      const U = setterAt1 ? 1 : 6;
      P[U] = [4.5, 3.4]; N[U] = '跟進：站在攔網後面、三米線附近，專守吊球'; tipZ = U;
      P[5] = [1.3, 7.3]; N[5] = '守左後深球';
      const o = [6,1].find(z => z !== U); P[o] = [7.7, 7.3]; N[o] = '守右後深球';
    } else {
      P[5] = [1.3, 6.2]; P[1] = [7.7, 6.2]; P[6] = [4.5, 8.3];
      N[5] = '守左半邊：靠邊線，往中間跑'; N[1] = '守右半邊：靠邊線，往中間跑'; N[6] = '守深球：底線前一步';
    }
  } else if (frontCover){
    P[nb] = [X(8.3), 6.6]; P[fb] = [X(1.2), 6.2]; P[6] = [X(5.0), 8.3]; tipZ = outer;
    N[nb] = '守直線：靠邊線，站在攔網陰影外'; N[fb] = '守斜線：站在陰影外的斜線上，重扣最常來這裡'; N[6] = '守深球：底線前一步，往攻擊那一側偏';
  } else if (S.formation === 'rot'){
    P[nb] = [X(7.0), 3.4]; N[nb] = '邊跟進：往前守攔網後面的吊球'; tipZ = nb;
    P[6] = [X(8.3), 7.8]; N[6] = '轉去守直線深球';
    P[fb] = [X(1.2), 6.9]; N[fb] = '守斜線深球';
  } else if (S.formation === 'up'){
    const U = setterAt1 ? 1 : 6;
    const sc = (seg[0] + seg[1]) / 2;
    P[U] = [clamp(sc + inward*.5, 1.2, 7.8), 3.4]; N[U] = '跟進：站在攔網後面、三米線附近，專守吊球'; tipZ = U;
    const lp = nb !== U ? nb : 6, cp = fb !== U ? fb : 6;
    P[lp] = [X(8.3), 7.6]; N[lp] = '守直線深球：靠邊線、站深';
    P[cp] = [X(0.9), 7.3]; N[cp] = '守斜線深球：靠角落、站深';
  } else {
    P[nb] = [X(8.3), 6.4]; P[fb] = [X(1.2), 5.9]; P[6] = [X(5.4), 8.3]; tipZ = nb;
    N[nb] = '守直線：靠邊線，站在攔網陰影外；看到吊球就往前';
    N[fb] = '守斜線：站在陰影外的斜線上，重扣最常來這裡'; N[6] = '守深球：底線前一步，往攻擊那一側偏';
  }
  if (setterAt1 && N[1]) N[1] += '。舉球員：沒輪到妳接，就去目標區舉球';
  // 基本站位（對方還沒舉球前）
  const B = { 4:[1.0,.6], 3:[4.5,.6], 2:[8.0,.6] };
  for (const z of [2,3,4]) if (!canBlock(z)) B[z] = [B[z][0] === 1.0 ? 1.4 : (B[z][0] === 8.0 ? 7.6 : 4.5), 2.0];
  if (occ[2] === 'S' && !lu.S.front) B[2] = [7.2, 1.8];
  if (S.formation === 'up'){ const U = setterAt1 ? 1 : 6; B[U] = [4.5,3.6]; B[5] = [1.2,7.6]; B[[6,1].find(z => z !== U)] = [7.8,7.6]; }
  else { B[5] = [1.3,6.0]; B[6] = [4.5,8.0]; B[1] = [7.7,6.0]; }

  const pos = {}, base = {}, notes = {};
  for (const r of ROLES){ const z = lu[r].zone; pos[r] = P[z]; base[r] = B[z]; notes[r] = N[z]; }
  const blockRoles = blockers.map(z => occ[z]);
  const tip = tipZ ? occ[tipZ] : null;
  const sideText = side === 'R' ? '對方從我們右邊（他們的 4 號位）攻擊' : (side === 'L' ? '對方從我們左邊（他們的 2 號位）攻擊' : '對方從中間攻擊');
  const nm = r => ROLE_INFO[r].name;
  let blockText = !blockRoles.length ? '沒有人攔網：前排三個人平均分開、離網兩公尺左右，後排站深站開' : (blockRoles.map(nm).join('和') + (blockRoles.length === 2 ? '雙人攔網' : '攔網'));
  if (blockRoles.length && side !== 'M' && !blockRoles.includes('MB') && canBlock(3) && S.mbLate) blockText += '（攔中來不及，退下來守吊球）';
  const perTip = !frontCover && side !== 'M' && blockRoles.length && (S.formation === 'per' || S.formation === 'ours');
  let extra = tip ? (perTip ? `吊球靠${roleName(tip, lu)}看到就往前撲（離得遠，這是心後的弱點）。` : `吊球由${roleName(tip, lu)}守。`)
                  : (blockRoles.length ? '短球由退下來的前排守。' : '');
  if (frontCover && S.formation !== 'per' && S.formation !== 'ours') extra += '前排已經有人守吊球，後排三個人都站深。';
  if (tip === 'S') extra += '舉球員接了吊球，第二球由舉對（輔舉）舉。';
  const summary = `${sideText}：${blockText}。${extra}`;
  return { pos, base, notes, lu, side, blockers:blockRoles, seg, tip, summary, shadow: shadowPoly(att, seg), free:false };
}
function computeFree(att){
  const lu = lineup();
  if (!custom) custom = clonePos(compute(att).pos);
  const pos = clonePos(custom);
  const blockers = ROLES.filter(r => canBlockFree(r, lu) && pos[r][1] <= 0.9);
  let seg = null;
  if (blockers.length){ const xs = blockers.map(r => pos[r][0]); seg = [Math.min(...xs) - .45, Math.max(...xs) + .45]; }
  const notes = {};
  for (const r of ROLES){
    if (blockers.includes(r)) notes[r] = '攔網（站在網前 0.9 公尺內就算攔網）';
    else if (!lu[r].front && pos[r][1] <= 0.9) notes[r] = '後排球員站在網前也不能攔網';
    else if (lu[r].front && !toggleOf(r) && pos[r][1] <= 0.9) notes[r] = '設定成不攔網，站在網前也不算攔網';
    else notes[r] = '防守：負責自己的圈圈';
  }
  return { pos, base:clonePos(pos), notes, lu, side:sideOf(att.x), blockers, seg, tip:null,
    summary:'自己擺：拖球員到想站的位置，前排拉到網前就算攔網。圈圈是每個人的防守範圍，重疊的地方要講好誰接。', shadow:shadowPoly(att, seg), free:true };
}

// 攔網陰影：重扣打不進去的地方。女生的攔網通常只擋得住比較陡的球，深球會從上面飛過去，所以只畫到 4 公尺。
function shadowPoly(att, seg){
  if (!seg) return null;
  const ox = att.x, oy = att.y - 4.5, y0 = .12, y1 = 4.0;
  const ext = x => ox + (x - ox) * (y1 - oy) / (y0 - oy);
  return [[seg[0], y0], [seg[1], y0], [ext(seg[1]), y1], [ext(seg[0]), y1]];
}
function inPoly(p, poly){
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++){
    const [xi, yi] = poly[i], [xj, yj] = poly[j];
    if (((yi > p[1]) !== (yj > p[1])) && (p[0] < (xj - xi) * (p[1] - yi) / (yj - yi) + xi)) inside = !inside;
  }
  return inside;
}

/* ---------- 誰接這一球 ---------- */
// 往後退比往前、往旁邊難：往後的距離乘 1.6 再比
function effort(P, L, A){
  const mx = L[0] - P[0], my = L[1] - P[1];
  const u = unit([P[0] - A[0], P[1] - A[1]]);
  const along = mx*u[0] + my*u[1];
  const px = mx - along*u[0], py = my - along*u[1];
  const back = along > 0 ? along * 1.6 : -along;
  return Math.hypot(back, Math.hypot(px, py));
}
function decide(L, type, comp, att){
  const R = S.radius, A = [att.x, att.y];
  if (L[0] < -0.02 || L[0] > 9.02 || L[1] > 9.02) return { kind:'out' };
  if (type === 'spike' && comp.shadow && inPoly(L, comp.shadow)){
    if (S.blockRes === 'kill') return { kind:'blocked' };
    if (S.blockRes === 'soft'){
      // 碰到攔網的手：球速變慢，掉在攔網後面一兩公尺，跟吊球一樣要往前撲
      const bp = [clamp(L[0], comp.seg[0] + .1, comp.seg[1] - .1), .05];
      const v = [L[0] - bp[0], L[1] - bp[1]], dl = Math.hypot(v[0], v[1]) || 1;
      const len = clamp(dl * .55, 1.0, 2.2);
      const Ls = clampCourt([bp[0] + v[0] / dl * len, Math.max(.6, bp[1] + v[1] / dl * len)]);
      const d2 = decide(Ls, 'soft', comp, att);
      return Object.assign(d2, { soft:{ bp, L:Ls } });
    }
  }
  const cands = ROLES.filter(r => !comp.blockers.includes(r)).map(r => ({ r, d:dist(comp.pos[r], L), e:effort(comp.pos[r], L, A) }));
  const mk = (digger, rule, backup, extra) => Object.assign({ kind:'dig', digger, rule, backup:backup || null }, extra || {});
  if (!cands.length) return { kind:'nobody' };
  // 吊球交給負責吊球的人；但如果有別人（不是舉球員）就站在球旁邊、明顯比較近，就給她
  if ((type === 'tip' || type === 'soft') && comp.tip && !comp.blockers.includes(comp.tip)){
    const t = cands.find(c => c.r === comp.tip);
    const closer = cands.some(c => c.r !== comp.tip && c.r !== 'S' && c.d <= R && c.d + 1.0 < (t ? t.d : Infinity));
    if (t && t.d <= R * 1.6 && L[1] <= 4.6 && !closer) return mk(t.r, 'tip');
  }
  // 隊上的守法：舉球員不攔網、守 2 號位，2 號位前面的短球由她接；長一點的才給後面的舉對
  if (S.formation === 'ours' && comp.lu.S.zone === 2 && L[1] <= 3.0 && L[0] >= 5.0){
    const s = cands.find(c => c.r === 'S');
    if (s && s.d <= R) return mk('S', 'sShort');
  }
  const inR = cands.filter(c => c.d <= R);
  if (!inR.length){ const n = cands.slice().sort((p, q) => p.e - q.e)[0]; return mk(n.r, 'gap'); }
  if (inR.length === 1) return mk(inR[0].r, 'only');
  let pool = inR, yielded = false;
  if (pool.some(c => c.r === 'S')){ const rest = pool.filter(c => c.r !== 'S'); if (rest.length){ pool = rest; yielded = true; } }
  pool.sort((p, q) => p.e - q.e);
  if (pool.length === 1) return mk(pool[0].r, yielded ? 'yield' : 'only');
  return mk(pool[0].r, 'seam', pool[1].r, { yielded });
}
function reasonText(dec, lu){
  const nm = r => roleName(r, lu);
  switch (dec.rule){
    case 'tip': return dec.soft ? `小球：這個情境由${nm(dec.digger)}守攔網後面的短球，她往前接。` : `吊球：這個情境由${nm(dec.digger)}守吊球，她往前接。`;
    case 'sShort': return `短球落在 2 號位前面，由${nm('S')}接（隊上的守法）；比較長的球才給後面的舉對。`;
    case 'only': return `球落在${nm(dec.digger)}的範圍裡，由她接。`;
    case 'seam': return `兩個人都接得到：${nm(dec.digger)}離球比較近，而且是往前或往旁邊移動，由她接；${nm(dec.backup)}往她後面補位。` + (dec.yielded ? '舉球員也接得到，但讓給別人，她留著舉第二球。' : '');
    case 'yield': return `舉球員也接得到，但讓${nm(dec.digger)}接，舉球員留著舉第二球。`;
    case 'gap': return `這裡沒有人的範圍（空檔）：最近的${nm(dec.digger)}要衝過去，常常來不及。這種球一多，就要調整站位。`;
  }
  return '';
}
function ruleText(dec){
  switch (dec.rule){
    case 'tip': return '依據：每個隊形都要指定誰守吊球。';
    case 'sShort': return '依據：隊上的守法，舉球員不攔網、守 2 號位的短球，長一點的給 1 號位的舉對（教練）。';
    case 'seam': return '依據：兩人之間，離球最近、往前比往後容易的人接，另一個人補位（教練慣例）。';
    case 'yield': return '依據：舉球員能不接第一球就不接（教練慣例）。';
    case 'gap': return '圈圈是每個人一兩步內接得到的範圍；圈外的球很難接。';
  }
  return '';
}

/* ---------- 一球的過程 ---------- */
// 隊上的做法：舉球員接第一球時，由舉對（輔舉）舉第二球
function backupSetter(dec){ return dec.digger === 'OPP' ? 'L' : 'OPP'; }
function chooseHitter(d, L, comp, setter){
  const lu = comp.lu;
  if (setter === 'OH1') return 'MB';
  if (lu.OH1.front && !(d === 'OH1' && L[1] > 4)) return 'OH1';
  if (lu.OPP.front && d !== 'OPP' && setter !== 'OPP' && !(S.formation === 'ours' && setterBack())) return 'OPP';
  return 'MB';
}
function coverSpots(H){
  if (H[0] < 3) return { close:[[0.9,2.3],[2.2,1.7],[3.1,2.9]], deep:[[1.6,5.2],[4.2,5.6]] };
  if (H[0] > 6) return { close:[[8.1,2.3],[6.8,1.7],[5.9,2.9]], deep:[[7.4,5.2],[4.8,5.6]] };
  return { close:[[3.0,1.8],[5.2,1.8],[4.1,2.9]], deep:[[2.4,5.2],[6.0,5.2]] };
}
// 每個人分到一個保護位置，總移動距離最短（人數少，直接試所有排法）
function assignSpots(roles, spots, P, out){
  const n = Math.min(roles.length, spots.length);
  let best = null, bestCost = Infinity;
  const perm = (arr, k2, used) => {
    if (arr.length === n){ const c = arr.reduce((s, si, i) => s + dist(P[roles[i]], spots[si]), 0); if (c < bestCost){ bestCost = c; best = arr.slice(); } return; }
    for (let i = 0; i < spots.length; i++) if (!used[i]){ used[i] = true; arr.push(i); perm(arr, k2, used); arr.pop(); used[i] = false; }
  };
  perm([], 0, []);
  if (best) best.forEach((si, i) => { out[roles[i]] = spots[si].slice(); });
}
const SLOW3 = 2.4;      // 立體畫面放慢的倍數（扣球再慢 1.6 倍，看得到球慢慢飛過來）
function speedK(){ return (S.speed === 'slow' ? 1.8 : 1) * (v3.on ? SLOW3 : 1); }
function slowK(b){ return v3.on && b && b.slow ? 1.6 : 1; }

/* ---------- 接法（給說明用） ---------- */
function digTech(type, P, L){
  const d = dist(P, L);
  if (type === 'soft') return d < .6 ? '碰手的小球比較慢：往前踩一步、壓低身體，用雙手前臂把球托高。'
    : '碰手的小球比較慢：看到球碰到攔網的手就往前衝，壓低身體，用雙手前臂把球托高；來不及就單手撈起來。';
  if (type === 'tip'){
    if (d < .6) return '吊球比較慢：往前踩一步、壓低身體，用雙手前臂把球托高。';
    return '吊球比較慢：看到對方手放軟就往前衝，壓低身體，用雙手前臂把球托高；來不及就單手撈起來。';
  }
  if (d < .6) return '扣球很快：球朝她來，也要往前踩一步迎球，雙手前臂接，球才不會太低。';
  if (d < 1.7) return '扣球很快：球不是朝她來，要往球的方向跨一步（靠近球的腳先跨、另一腳推），身體壓低，雙手伸過去把球接高。';
  return '扣球很快：離得遠，看攻擊手手臂的方向先動；新手來不及時，先求把球碰起來。';
}
function recvTech(P, L){
  const dx = L[0] - P[0], dy = L[1] - P[1], d = Math.hypot(dx, dy);
  const foot = rt()[0] >= L[0] ? '右腳' : '左腳';
  let mv;
  if (d < .5) mv = '球朝她來：不用跑，往前踩一步迎球';
  else if (dy < -.8 && -dy >= Math.abs(dx)) mv = '球比較短：往前跑，壓低身體，跑到球的後面再停';
  else if (dy > .8 && dy >= Math.abs(dx)) mv = '球比較深：轉身往後退到球的後面再停；球在肩膀以上、又慢，也可以用上手接';
  else mv = Math.abs(dx) > 2 ? '球在旁邊比較遠：先用交叉步跑過去，最後一步停好' : '球在旁邊：用側併步（腳不交叉）移過去';
  return `${mv}。停的時候${foot}在前（靠近舉球員那隻腳），重心移到前腳，雙手前臂對準舉球員。`;
}

/* ---------- 一球的過程（防守） ---------- */
function buildSteps(L, type, comp, dec, att){
  const lu = comp.lu, nm = r => roleName(r, lu), short = r => ROLE_INFO[r].name;
  const A = [att.x, att.y], hand = ballHome(att);
  const P0 = clonePos(comp.pos);
  const allNotes = (fn) => { const o = {}; for (const r of ROLES) o[r] = fn(r); return o; };
  const atk = { from:hand, z:[2.75, .05, 0] };
  const steps = [{ key:'read', title:'讀球站位', pos:P0, ball:{ to:hand, z3:2.6 }, cap:comp.summary, notes:comp.notes, marks:{}, face:A }];
  if (dec.kind === 'out'){
    steps.push({ key:'out', title:'出界', pos:P0, ball:Object.assign({}, atk, { to:L, dur:520, arc:.15 }), marks:{ out:L }, face:L,
      cap:'出界：球落在界外，大家不要碰。站在邊線、底線內側一點，腰以上的高度朝妳飛來的球，通常會出界（攔網碰過的除外）。',
      rule:'依據：站在線內，讓出界的球過去（教練慣例）。', notes:allNotes(() => '看球，確定會出界就不要碰') });
    return steps;
  }
  if (dec.kind === 'blocked'){
    const bp = [clamp(L[0], comp.seg[0] + .1, comp.seg[1] - .1), .05];
    steps.push({ key:'blocked', title:'被攔網擋住', pos:P0, marks:{}, face:bp,
      ball:{ from:hand, to:bp, dur:330, arc:.08, z:[2.75, 2.45, 0], then:{ to:[bp[0], -2.7], dur:480, arc:.45, z:[2.45, .05, 3.2] } },
      cap:'這球打進攔網陰影（橘色斜線），被攔網擋回去。陰影裡只會有吊球，後排要站在陰影兩邊。',
      rule:'攔網陰影只畫到離網 4 公尺：比較深的球會從攔網上面飛過去。設定裡「攔網碰到球」選了「攔死」；改成「碰手變小球」可以練接攔網後的小球。',
      notes:allNotes(r => comp.blockers.includes(r) ? '攔網：把球擋回去' : '看球，準備接彈回來的球') });
    return steps;
  }
  if (dec.kind === 'nobody'){
    steps.push({ key:'nobody', title:'沒有人可以接', pos:P0, marks:{}, face:L, ball:Object.assign({}, atk, { to:L, dur:520, arc:.15 }), cap:'場上的人都去攔網了，沒有人能接這一球。', notes:comp.notes });
    return steps;
  }
  // 碰手變小球：球改從攔網的手掉下來，落點換成小球的落點
  const soft = dec.soft;
  if (soft){ L = soft.L; type = 'tip'; }
  // 1. 攻擊・接球：最近的人上前接，另一個人跟到她後面保護，旁邊的人往她空出來的地方移
  const d = dec.digger;
  const away = unit([L[0] - A[0], L[1] - A[1]]);
  const P1 = clonePos(P0);
  P1[d] = clampCourt([L[0] + away[0]*.45, L[1] + away[1]*.45]);   // 站在球的後面一點，球在身體前面接
  const busy = new Set([d, ...comp.blockers]);
  const TG = digTarget(d);
  const setterGoes = d !== 'S' && !comp.blockers.includes('S');
  if (setterGoes) busy.add('S');
  // 舉球員接第一球：舉對（輔舉）要去舉，不去補位
  const fixGoes = d === 'S';
  if (fixGoes) busy.add('OPP');
  let backup = dec.backup;
  if (backup === 'S' && setterGoes) backup = null;
  if (backup === 'OPP' && fixGoes) backup = null;
  // 前排攻擊手要準備攻擊，只有球落在前場（離網 3.5 公尺內）時才幫忙補位
  const canHelp = r => !busy.has(r) && (!lu[r].front || L[1] < 3.5);
  if (!backup){
    const near = ROLES.filter(canHelp).map(r => ({ r, d:dist(P0[r], L) })).filter(c => c.d <= 4.2).sort((p, q) => p.d - q.d);
    if (near.length) backup = near[0].r;
  }
  if (backup){ busy.add(backup); P1[backup] = clampCourt([L[0] + away[0]*1.5, L[1] + away[1]*1.5]); }
  const fillers = [];
  const hole = P0[d];
  if (dist(hole, L) > 1.0){
    const near = ROLES.filter(r => canHelp(r) && !busy.has(r) && (!lu[r].front || hole[1] < 3.5)).map(r => ({ r, d:dist(P0[r], hole) })).filter(c => c.d <= 4.5).sort((p, q) => p.d - q.d).slice(0, 1);
    for (const c of near){ P1[c.r] = lerp(P0[c.r], hole, .4); fillers.push(c.r); busy.add(c.r); }
  }
  // 其他人往球的方向靠一步（最多 0.6 公尺），準備救接飛的球
  const leaners = [];
  for (const r of ROLES){
    if (busy.has(r) || comp.blockers.includes(r) || (lu[r].front && L[1] >= 3.5)) continue;
    const dd = dist(P0[r], L); if (dd < .3) continue;
    const stp = Math.min(.6, dd * .25);
    P1[r] = [P0[r][0] + (L[0] - P0[r][0]) / dd * stp, P0[r][1] + (L[1] - P0[r][1]) / dd * stp]; leaners.push(r);
  }
  const setterRole = d === 'S' ? backupSetter(dec) : 'S';
  if (setterGoes) P1.S = lerp(P0.S, TG, .35);
  if (fixGoes && !comp.blockers.includes('OPP')) P1.OPP = lerp(P0.OPP, TG, .3);
  const tech = digTech(soft ? 'soft' : type, P0[d], L);
  let cap1 = (soft ? '這球打到攔網的手，速度變慢，掉在攔網後面變成小球。' : '') + reasonText(dec, lu) + tech;
  if (backup && backup !== dec.backup) cap1 += `${short(backup)}跟過去站在她後面，球接飛了可以救。`;
  if (fillers.length) cap1 += `${fillers.map(short).join('、')}往她空出來的地方移一點。`;
  if (leaners.length) cap1 += '其他人往球的方向靠一步，眼睛跟著球。';
  if (setterGoes) cap1 += '舉球員看到別人接，就往網前的舉球位置跑。';
  if (fixGoes) cap1 += '舉對（輔舉）看到舉球員去接，就往前跑，準備舉第二球。';
  const rules1 = [ruleText(dec)];
  if (backup || fillers.length) rules1.push('補位：最近的隊友跟到接球的人後面保護，旁邊的人往空出來的地方移（教練慣例）。');
  const faceMap = {}; for (const r of ROLES) faceMap[r] = L; faceMap[d] = A;
  if (soft) rules1.push('攔網碰到的球：設定裡可以改成「攔死」或「沒攔到」。');
  steps.push({ key:'dig', title: soft ? '碰手・接小球' : (type === 'tip' ? '吊球・接球' : '攻擊・接球'), pos:P1, faceMap,
    ball: soft ? { from:hand, to:soft.bp, dur:330, arc:.08, z:[2.75, 2.5, 0], then:{ to:L, dur:950, arc:.55, z:[2.5, .55, 3.0] } }
      : type === 'tip' ? { from:hand, to:L, dur:900, arc:.7, z:[2.6, .55, 3.1] } : { from:hand, to:L, dur:480, arc:.1, z:[2.75, .65, 0], slow:true },
    cap:cap1, rule:rules1.filter(Boolean).join(' '), marks:{ dig:d, backup, fillers, gap: dec.rule === 'gap' },
    notes:allNotes(r => r === d ? `接球：${tech}` : r === backup ? '補位：跟到接球的人後面，球接飛了可以救'
      : fillers.includes(r) ? '補空位：往接球的人空出來的地方移一點'
      : leaners.includes(r) ? '往球的方向靠一步，準備救接飛的球'
      : (r === 'S' && setterGoes) ? '往網前的舉球位置跑，準備舉球' : (r === 'OPP' && fixGoes) ? '看到舉球員去接，往前跑準備舉第二球' : comp.blockers.includes(r) ? '攔網落地，轉身看球' : '原地準備，眼睛跟著球') });
  // 2. 送到舉球位置（舉球員接第一球時送修正球）
  const P2 = clonePos(P1);
  const moved = new Set([setterRole]);
  P2[setterRole] = [TG[0] + .15, TG[1] + .3];
  const attackers = ['OH1','MB','OPP'].filter(r => lu[r].front && r !== setterRole && !(r === d && L[1] > 5));
  for (const r of attackers){ P2[r] = APPROACH[r].slice(); moved.add(r); }
  if (!moved.has(d)){
    // 接完球往舉球的人靠過去準備保護；舉球員自己接的，讓開位置給輔舉
    if (d === 'S'){ const v = unit([P1.S[0] - TG[0], P1.S[1] - TG[1]]); P2.S = clampCourt([P1.S[0] + v[0] * .6, P1.S[1] + v[1] * .6]); }
    else P2[d] = lerp(P1[d], TG, .2);
    moved.add(d);
  }
  for (const r of ROLES) if (!moved.has(r) && !lu[r].front) P2[r] = (READY[lu[r].zone] || P2[r]).slice();
  let cap2;
  if (d === 'S'){
    cap2 = `舉球員接了第一球：把球接高、離網稍微開一點（不能太開，攔中才打得到），${short(setterRole)}（輔舉）從後面跑上來修正，高高送到 4 號位。`;
    if (setterRole === 'L') cap2 += '自由在三米線前用手舉的話，攻擊手不能在網子上方打，所以要用下手舉，或退到三米線後面舉。';
  } else cap2 = `${short(d)}把球接高，往舉球員會跑到的地方送（網前、2 號位偏中間）。不管在哪個位置接，都往這裡接。舉球員跑到球下面準備舉。`;
  cap2 += '前排攻擊手退到起跑點' + (comp.blockers.length ? '，攔網的人落地轉身退開' : '') + '。';
  const passDur = clamp(900 + Math.max(0, dist(P1[setterRole], TG) - 3) * 140, 900, 1400);
  steps.push({ key:'pass', title: d === 'S' ? '修正：送給輔舉' : '送到舉球位置', pos:P2, moveDur:passDur - 100, ball:{ from:L, to:TG, dur:passDur, arc:1.1, z:[.65, 2.4, 4.6] }, cap:cap2, face:TG,
    rule: d === 'S' ? '依據：隊上的做法，舉球員接第一球時由舉對（輔舉）舉第二球；修正球離網稍微開一點（教練）。' : '依據：隊上的做法，防起來的球一律往舉球員跑到的終點接（教練）。',
    marks:{ set:setterRole, target: d === 'S' ? 'fix' : 'rt' },
    notes:allNotes(r => r === setterRole ? (d === 'S' ? '跑上來修正，準備舉第二球' : '跑到網前的舉球位置，準備舉球') : attackers.includes(r) ? '退到起跑點，準備助跑' : r === d ? '接完球往中間靠，準備保護' : '回到後排，準備保護') });
  // 3. 舉球・保護
  const hitter = chooseHitter(d, L, comp, setterRole);
  const H = HIT[hitter];
  const P3 = clonePos(P2);
  P3[hitter] = [H[0], H[1] + .2];
  // 舉球的人留在原地把球舉出去（球從她手上出去），其他人才去保護
  const others = ROLES.filter(r => r !== hitter && r !== setterRole).sort((p, q) => dist(P2[p], H) - dist(P2[q], H));
  const close = others.slice(0, 3), deep = others.slice(3);
  const sp = coverSpots(H);
  assignSpots(close, sp.close, P2, P3); assignSpots(deep, sp.deep, P2, P3);
  const over = [H[0] < 4.5 ? H[0] + 2.6 : H[0] - 2.6, -2.8];
  const toSide = hitter === 'OH1' ? '4 號位' : (hitter === 'OPP' ? '2 號位' : '中間');
  steps.push({ key:'set', title:'舉球・保護', pos:P3, face:H, ball:{ from:TG, to:H, dur:900, arc:1.0, z:[2.4, 2.95, 4.8], then:{ to:over, dur:300, arc:.1, z:[2.95, .05, 0] } },
    cap:`${short(setterRole)}站在球下面，把球舉高到${toSide}給${short(hitter)}攻擊，舉完就近保護。離攻擊手最近的三個人（${close.map(short).join('、')}）蹲低靠近保護，${deep.length ? `${deep.map(short).join('、')}站後面一點` : '其他人站後面一點'}：球被攔回來才接得到。`,
    rule:'依據：離攻擊手最近的人近距離保護，最遠的人守後面（教練慣例）。',
    marks:{ hit:hitter, set:setterRole, target: d === 'S' ? 'fix' : 'rt' }, hitter,
    notes:allNotes(r => r === hitter ? '助跑攻擊' : r === setterRole ? '站在球下面舉球，舉完就近保護' : close.includes(r) ? '靠近攻擊手、蹲低保護' : '站後面一點，保護比較遠的球') });
  // 4. 回防
  steps.push({ key:'reset', title:'回防', pos:clonePos(comp.base), ball:null, face:A,
    cap:'球過網後，大家回到基本站位，看對方舉給誰，再移動到防守位置。', marks:{},
    notes:allNotes(() => '回到基本站位') });
  return steps;
}

/* ---------- 第 1 課：輪轉站位 ---------- */
function luFromRot(R){ const lu = {}; for (const r of ROLES) lu[r] = { zone:R.roleZone[r], front:VBRot.FRONT(R.roleZone[r]) }; return lu; }
function atZones(lu){ const at = {}; for (const r of ROLES) at[lu[r].zone] = r; return at; }
function roleNote(r, lu){
  const f = lu[r].front, sys = S.system;
  switch (r){
    case 'S': return f ? '舉球員在前排：可以攔網，也可以直接把球打過去' : '舉球員在後排：發球後插上到網前舉球，不能攔網';
    case 'L': return '自由球員：換下後排的攔中，只在後排，不能攔網';
    case 'MB': return '攔中：前排中間，主要的攔網';
    case 'OH1': return '前排大砲：主要的攻擊手';
    case 'OH2': return '後排大砲：接發球、防守，也可以在三米線後面起跳攻擊';
    case 'OPP':
      if (sys === '62') return '另一位舉球員在前排，當舉對攻擊和攔網';
      if (sys === '42') return '另一位舉球員在後排，當一般的後排防守';
      return f ? '舉對：前排右邊攻擊和攔網' : '舉對在後排：防守右後';
  }
  return '';
}
function rotComp(){
  const R = rotInfo(), lu = luFromRot(R), at = atZones(lu), sys = VBRot.SYSTEMS[S.system];
  const pos = {}, notes = {};
  for (const r of ROLES){ pos[r] = ZC[lu[r].zone].slice(); notes[r] = `${lu[r].zone} 號位（${lu[r].front ? '前排' : '後排'}）：${roleNote(r, lu)}`; }
  const row = zs => zs.map(z => `${ROLE_INFO[at[z]].name}（${z}）`).join('、');
  const summary = `${sys.short}第 ${rotIndex()} 輪，舉球員在 ${lu.S.zone} 號位（${lu.S.front ? '前排' : '後排'}）。前排：${row([4,3,2])}；後排：${row([5,6,1])}。` +
    `贏回發球權時，大家順時針轉一格（2→1、1→6、6→5、5→4、4→3、3→2），轉到 1 號位的人發球。${sys.desc}`;
  return { pos, base:clonePos(pos), notes, lu, R, side:'M', blockers:[], seg:null, tip:null, summary, shadow:null, kind:'rot' };
}

/* ---------- 第 2 課：接發球 ---------- */
function serverPos(){ return [S.serveX, SERVER_Y]; }
function serveHome(){ return [clamp(S.serveX + .5, .2, 8.8), -2.55]; }
function recvComp(){
  setLibOff(!S.useLib);
  const rc = VBRot.receive(S.system, S.rot, S.recv);
  const R = rc.R, lu = luFromRot(R), at = atZones(lu), sys = VBRot.SYSTEMS[S.system], F = VBRot.FORMS[rc.team ? 'team' : (S.recv === 'team' ? 'w5' : S.recv)];
  const nm = r => roleName(r, lu), short = r => ROLE_INFO[r].name;
  const notes = {};
  for (const r of ROLES){
    if (rc.passers.includes(r)) notes[r] = '接發球：面向發球員，兩腳比肩膀寬一點、膝蓋彎、重心在前腳掌，眼睛看發球員的手';
    else if (r === 'S'){
      const fz = { 1:2, 6:3, 5:4 }[lu.S.zone];
      notes[r] = lu.S.front ? '不接發球：站在網前，發球後沿著網子移到傳球目標，準備舉球'
                            : `不接發球：躲在${nm(at[fz])}後面（發球前不能超過她），發球員一擊球就跑到傳球目標`;
    } else if (r === 'MB') notes[r] = '不接發球：站在網前，準備助跑快攻';
    else if (r === 'OPP') notes[r] = lu.OPP.front ? '不接發球：站在網前，發球後移到右邊準備從 2 號位攻擊' : '不接發球：站在後排右邊，準備保護和防守';
    else notes[r] = '不接發球：站在網前，準備攻擊';
  }
  const how = rc.team ? `${F.name}（教練畫的）：${rc.note}` : `${F.name}：${F.desc}`;
  const extra = S.recv === 'team' && !rc.team ? '（雙輔舉、雙舉沒有隊上的圖，先用五人 W。）' : '';
  const summary = `${sys.short}第 ${rotIndex()} 輪（舉球員在 ${lu.S.zone} 號位）・${how}${extra}不接發球：${rc.hidden.map(short).join('、')}。` +
    '發球前要照輪轉順序站：虛線連起來的兩個人，不能前後或左右交換；發球員一擊球，大家就可以移動。';
  return { pos:rc.pos, base:clonePos(rc.pos), notes, lu, R, passers:rc.passers, hidden:rc.hidden, legal:rc.legal, moves:rc.moves || [], swap:rc.swap, team:rc.team,
    side:'M', blockers:[], seg:null, tip:null, summary, shadow:null, kind:'recv' };
}
function decideRecv(L, rc){
  if (L[0] < -0.02 || L[0] > 9.02 || L[1] > 9.02 || L[1] < 0) return { kind:'out' };
  const A = serverPos(), R = recvRadius();
  const cands = rc.passers.map(r => ({ r, d:dist(rc.pos[r], L), e:effort(rc.pos[r], L, A) }));
  const inR = cands.filter(c => c.d <= R);
  if (!inR.length){ const n = cands.slice().sort((p, q) => p.e - q.e)[0]; return { kind:'dig', digger:n.r, rule:'gap' }; }
  if (inR.length === 1) return { kind:'dig', digger:inR[0].r, rule:'only' };
  inR.sort((p, q) => p.e - q.e);
  const a = inR[0], b = inR[1];
  // 自由球員通常最會接：距離差不多時讓她接
  const lib = inR.find(c => c.r === 'L');
  if (lib && lib !== a && lib.e - a.e < .6) return { kind:'dig', digger:'L', rule:'libero', backup:a.r };
  return { kind:'dig', digger:a.r, rule:'seam', backup:b.r };
}
function recvReason(dec, lu){
  const nm = r => roleName(r, lu);
  switch (dec.rule){
    case 'only': return `球落在${nm(dec.digger)}的範圍裡，她喊「我的」去接。`;
    case 'seam': return `兩個人都接得到：${nm(dec.digger)}離球比較近、而且是往前或往旁邊移動，由她喊「我的」去接。`;
    case 'libero': return `兩個人都接得到、距離差不多：讓比較會接的${nm(dec.digger)}接（全隊要先講好）。`;
    case 'gap': return `這裡沒有人顧到（空檔）：最近的${nm(dec.digger)}要衝過去，常常會被發球直接得分，要調整站位。`;
  }
  return '';
}
function recvRule(dec){
  if (dec.rule === 'gap') return '圈圈是每個人負責的範圍：五人 W 每個人顧的地方小，三人接每個人顧的地方大。';
  if (dec.rule === 'libero') return '依據：一個人明顯比較會接時，可以讓她多接一些，但全隊要先講好（教練慣例）。';
  return '依據：誰接要在發球前講好；兩人之間，離球近、往前或往旁邊移動的人接，靠後面的人負責深球（USA Volleyball、教練慣例）。';
}
function switchText(lu){
  const at = atZones(lu), short = r => ROLE_INFO[r].name;
  const list = zs => zs.map(z => `${short(at[z])}到 ${z}`).join('、');
  return `球過網後，大家換到自己固定的防守位置：前排${list([4,3,2])}；後排${list([5,6,1])}。對方舉球後，再照「3 防扣球」移動。`;
}
function buildRecvSteps(L, rc, dec){
  const lu = rc.lu, short = r => ROLE_INFO[r].name;
  const A = serverPos(), hand = serveHome();
  const P0 = clonePos(rc.pos);
  const allNotes = fn => { const o = {}; for (const r of ROLES) o[r] = fn(r); return o; };
  const off = rc.hidden.slice();
  const serveSeg = (to, zEnd) => ({ from:hand, from3:[A[0], A[1] + .25], to, dur:1350, arc:.55, z:[2.7, zEnd, 3.3] });
  const routes = recvRoutes(rc, P0);
  const steps = [{ key:'stand', title:'發球前站好', pos:P0, ball:{ to:hand, z3:1.25, at3:[A[0] + .3, A[1] + .25] }, cap:rc.summary, notes:rc.notes,
    marks:{ pairs:true, hidden:rc.hidden, routes, swap: rc.swap ? [P0[rc.swap[0]], P0[rc.swap[1]]] : null }, face:A, off }];
  if (dec.kind === 'out'){
    steps.push({ key:'out', title:'發球出界', pos:P0, ball:serveSeg(L, .05), marks:{ out:L, pairs:false }, face:L, off,
      cap:'發球出界：不要碰，讓它落地就是我們得分。站在邊線、底線內側一點；腰以上的高度朝妳飛過來的球，常常會出界。',
      rule:'依據：發球落在界外是發球失誤；我們碰到了，就不算出界（規則）。', notes:allNotes(() => '看球，確定出界就讓開不要碰') });
    return steps;
  }
  const d = dec.digger;
  const away = unit([L[0] - A[0], L[1] - A[1]]);
  const P1 = clonePos(P0);
  P1[d] = [clamp(L[0] + away[0]*.45, -.6, 9.6), clamp(L[1] + away[1]*.45, .3, 9.9)];
  const busy = new Set([d, 'S']);
  const partner = dec.backup || null;
  if (partner){ const v = unit([P0[partner][0] - L[0], P0[partner][1] - L[1]]); P1[partner] = [P0[partner][0] + v[0]*.35, P0[partner][1] + v[1]*.35]; busy.add(partner); }
  P1.S = lu.S.front ? lerp(P0.S, [rt()[0] + .1, rt()[1] - .25], .9) : lerp(P0.S, [rt()[0] + .1, rt()[1] + .2], .8);
  for (const [r, to] of rc.moves) if (r !== 'S' && !busy.has(r)){ P1[r] = lerp(P0[r], to, .7); busy.add(r); }
  for (const r of rc.passers){
    if (busy.has(r)) continue;
    const dd = dist(P0[r], L); if (dd < .3) continue;
    const stp = Math.min(.35, dd * .15);
    P1[r] = [P0[r][0] + (L[0] - P0[r][0]) / dd * stp, P0[r][1] + (L[1] - P0[r][1]) / dd * stp];
  }
  const tech = recvTech(P0[d], L);
  let cap1 = recvReason(dec, lu) + tech;
  if (partner) cap1 += `${short(partner)}喊「妳的」讓開，轉身看她接。`;
  cap1 += '舉球員在發球員擊球時就往目標區跑。';
  const faceMap = {}; for (const r of ROLES) faceMap[r] = L; faceMap[d] = A; faceMap.S = rt();
  steps.push({ key:'serve', title:'發球・接發球', pos:P1, ball:serveSeg(L, .7), faceMap, off,
    cap:cap1, rule:recvRule(dec), marks:{ dig:d, partner, gap: dec.rule === 'gap' },
    notes:allNotes(r => r === d ? `接發球：${tech}` : r === partner ? '讓開：喊「妳的」，轉身看她接，準備保護' : r === 'S' ? '跑到目標區準備舉球'
      : rc.passers.includes(r) ? '轉身面向接球的人，準備移動' : '看球，準備攻擊') });
  // 2. 傳到舉球員
  const P2 = clonePos(P1);
  P2.S = [rt()[0] + .1, rt()[1] + .25];
  // 前排攻擊手退到起跑點：攔中在中間，另外兩個照現在左右的位置（第一波先從站的那一邊攻擊）
  const attackers = ['OH1','MB','OPP'].filter(r => lu[r].front);
  const wing = attackers.filter(r => r !== 'MB').sort((a, b) => P1[a][0] - P1[b][0]);
  const spot = {};
  if (attackers.includes('MB')) spot.MB = 'MB';
  if (wing.length === 2){ spot[wing[0]] = 'OH1'; spot[wing[1]] = 'OPP'; }
  else if (wing.length === 1) spot[wing[0]] = P1[wing[0]][0] > 5 ? 'OPP' : 'OH1';
  for (const r of attackers) P2[r] = APPROACH[spot[r]].slice();
  for (const r of ROLES) if (!lu[r].front && r !== 'S' && r !== d) P2[r] = (READY[lu[r].zone] || P2[r]).slice();
  if (!lu[d].front && d !== 'S') P2[d] = lerp(P1[d], READY[lu[d].zone] || P1[d], .5);
  steps.push({ key:'pass', title:'傳到舉球員', pos:P2, ball:{ from:L, to:rt(), dur:950, arc:1.0, z:[.7, 2.4, 4.4] }, marks:{ set:'S', target:'rt' }, face:rt(), off:[],
    cap:`${short(d)}用雙手前臂把球傳到網前、中間偏右的目標區（離網 1 公尺左右），舉球員在那裡舉。不用傳得很貼網：離網一點，比較不會直接過網。前排攻擊手接完球，馬上退到起跑點。`,
    rule:'依據：很多教練把傳球目標放在離網 1～1.5 公尺、中間偏右（Gold Medal Squared）。',
    notes:allNotes(r => r === 'S' ? '在目標區等球，準備舉' : attackers.includes(r) ? '退到起跑點，準備助跑' : r === d ? '接完球往前靠，準備保護' : '準備保護攻擊手') });
  // 3. 舉球・保護：舉給左邊（4 號位）的攻擊手
  const hitter = attackers.find(r => spot[r] === 'OH1') || attackers.find(r => r !== 'S') || 'OH1';
  const H = HIT[spot[hitter] || 'OH1'];
  const P3 = clonePos(P2);
  P3[hitter] = [H[0], H[1] + .2];
  const setterRole = 'S';
  // 舉球員留在原地把球舉出去（球從她手上出去），其他人才去保護
  const others = ROLES.filter(r => r !== hitter && r !== setterRole).sort((p, q) => dist(P2[p], H) - dist(P2[q], H));
  const close = others.slice(0, 3), deep = others.slice(3);
  const sp = coverSpots(H);
  assignSpots(close, sp.close, P2, P3); assignSpots(deep, sp.deep, P2, P3);
  const over = [H[0] < 4.5 ? H[0] + 2.6 : H[0] - 2.6, -2.8];
  const toSide = spot[hitter] === 'OPP' ? '2 號位' : (spot[hitter] === 'MB' ? '中間' : '4 號位');
  steps.push({ key:'set', title:'舉球・保護', pos:P3, face:H, off:[], hitter,
    ball:{ from:rt(), to:H, dur:950, arc:1.0, z:[2.4, 2.95, 4.8], then:{ to:over, dur:320, arc:.1, z:[2.95, .05, 0] } },
    cap:`舉球員站在球下面，把球舉高到${toSide}給${short(hitter)}攻擊，舉完就近保護。離攻擊手最近的三個人（${close.map(short).join('、')}）蹲低靠近保護，其他人站後面一點。` +
      (rc.swap ? `第一波打完，${short(rc.swap[0])}和${short(rc.swap[1])}再交換位置。` : ''),
    rule:'依據：離攻擊手最近的人近距離保護，最遠的人守後面（教練慣例）。', marks:{ hit:hitter, set:'S', target:'rt' },
    notes:allNotes(r => r === hitter ? '助跑攻擊' : r === 'S' ? '站在球下面舉球，舉完就近保護' : close.includes(r) ? '靠近攻擊手、蹲低保護' : '站後面一點，保護比較遠的球') });
  // 4. 換到防守位置
  if (rc.team){
    const tb = teamBase(libOff);
    steps.push({ key:'switch', title:'換到防守位置', pos:tb.pos, ball:null, marks:{}, face:[S.attacker.x, S.attacker.y], off:[], lu:tb.lu,
      cap:teamSwitchText(libOff) + (rc.swap ? `前排的${short(rc.swap[0])}和${short(rc.swap[1])}在這時候交換。` : ''),
      rule:'依據：發球後球員可以站在場上任何位置（規則 7.4.4）；固定防守位置照教練畫的圖。',
      notes:allNotes(r => `換到 ${tb.lu[r].zone} 號位`) });
    return steps;
  }
  const dcomp = compute(S.attacker);
  steps.push({ key:'switch', title:'換到防守位置', pos:clonePos(dcomp.base), ball:null, marks:{}, face:[S.attacker.x, S.attacker.y], off:[], lu:dcomp.lu,
    cap:switchText(dcomp.lu), rule:'依據：發球後球員可以站在場上任何位置（規則 7.4.4）；固定防守位置是教練慣例（專位防守）。',
    notes:allNotes(r => `換到 ${dcomp.lu[r].zone} 號位：${ROLE_INFO[r].name}固定守的位置`) });
  return steps;
}
// 隊上的防守基本站位：舉球員一律在 2 號位、舉對在 1 號位
function teamBase(noLib){
  const T = VBRot.TEAM, kk = noLib ? 'noLib' : 'lib', R = rotInfo(), lu = {};
  for (const r of ROLES) lu[r] = { zone:T.baseZone[kk][r], front:VBRot.FRONT(R.roleZone[r]) };
  return { pos:clonePos(T.base[kk]), lu };
}
function teamSwitchText(noLib, lead){
  return `${lead || '球過網後'}，大家換到隊上的防守位置：舉球員一律到 2 號位、舉對到 1 號位，前排大砲到 4、攔中到 3；後排${noLib ? '大砲到 5、攔中到 6' : '自由到 5、大砲到 6'}。`;
}

// 發球後要跑的路線（舉球員一定有，隊上的圖還有攔中、舉對）
function recvRoutes(rc, P0){
  const routes = (rc.moves || []).map(([r, to]) => [P0[r], to]);
  if (!(rc.moves || []).some(m => m[0] === 'S')) routes.push([P0.S, [rt()[0] + .1, rt()[1] + .2]]);
  return routes;
}

/* ---------- 第 1 課：我們發球時怎麼換位 ---------- */
function serveHome1(){ return [7.95, 9.15]; }
function buildServeSteps(){
  const seq = VBRot.serveSeq(S.system, S.rot, S.recv);
  const noLib = seq.noLib || !S.useLib;
  setLibOff(noLib);
  const rc = rotComp(), lu0 = rc.lu, short = r => ROLE_INFO[r].name;
  const allNotes = fn => { const o = {}; for (const r of ROLES) o[r] = fn(r); return o; };
  let base, blu, swText;
  if (seq.team){ const tb = teamBase(noLib); base = tb.pos; blu = tb.lu; swText = teamSwitchText(noLib, '發球一出手'); }
  else { const dc = compute(S.attacker); base = clonePos(dc.base); blu = dc.lu; swText = switchText(dc.lu).replace('球過網後', '發球一出手'); }
  const server = seq.server, net = [4.5, -4];
  const arrows = ROLES.filter(r => r !== server).map(r => [seq.at[r], base[r]]);
  arrows.push([seq.at[server], base[server]]);
  const steps = [];
  steps.push({ key:'rotpos', title:'輪轉的號位', pos:clonePos(rc.pos), ball:null, cap:rc.summary, notes:rc.notes, marks:{}, face:net, off:ROLES.slice(), noLib });
  steps.push({ key:'atserve', title:'我們發球：發球前', pos:seq.at, off:ROLES.slice(), noLib, face:net,
    ball:{ to:serveHome1(), z3:1.3, at3:[7.75, 9.55] }, marks:{ serve:server, arrows },
    cap:`我們發球：${short(server)}到底線後面發球。` + (seq.team ? seq.note : '其他人先站在自己的號位，發球後換到固定的防守位置。') +
      (noLib && seq.server === 'L' ? '後排攔中發球時，自由還不能換上來。' : '') + '紅色箭頭是發球後要換去的位置。',
    rule:'依據：2025～2028 新規則，發球的隊伍在發球那一刻可以自由站位，接發球的隊伍才要照輪轉順序站。',
    notes:allNotes(r => r === server ? '發球：站在底線後面，發完球馬上進場' : `發球後換到 ${blu[r].zone} 號位`) });
  steps.push({ key:'switch', title:'發球後換位', pos:base, lu:blu, off:[], noLib, face:net, moveDur:1500,
    ball:{ from:serveHome1(), from3:[7.6, 9.6], to:[3.5, -6.0], dur:1350, arc:.55, z:[2.7, .05, 3.4] }, marks:{},
    cap:`${swText}接下來看「3 防扣球」。`,
    rule:'依據：發球後球員可以站在場上任何位置（規則 7.4.4）。',
    notes:allNotes(r => `${blu[r].zone} 號位：防守的基本位置，看對方怎麼進攻`) });
  play.server = server;
  return steps;
}
function startServeSeq(){
  markHintSeen();
  resetPlay(true);
  play.steps = buildServeSteps();
  play.dec = null; play.landing = null; v3.cam = null;
  applyStep(0, false);
  play.auto = true;
  applyStep(1, true);
  scheduleNext();
}

/* ---------- 扣球打得到、只能吊球的地方 ---------- */
function attackZones(att, comp){
  const side = sideOf(att.x);
  // 扣球最短大概落在離網 2～3.4 公尺：打斜線比較長，可以落得比較近
  const near = x => side === 'M' ? 2.8 : (side === 'R' ? 2.0 + 1.4 * x / 9 : 2.0 + 1.4 * (9 - x) / 9);
  return { spike:[[0, near(0)], [9, near(9)], [9, 9], [0, 9]], band:[[0, .05], [9, .05], [9, near(9)], [0, near(0)]], shadow:comp.shadow };
}
function currentComp(){
  if (S.step === 'rot') return rotComp();
  if (S.step === 'recv') return recvComp();
  return S.mode === 'free' ? computeFree(S.attacker) : compute(S.attacker);
}

/* ---------- 畫球場 ---------- */
const svg = $('court');
const G = {};
let plG = {}, rgG = {}, tgG = {}, fcG = {};
let k = 1;                 // 球員圖示的放大倍數（畫面小時放大，字才看得清楚）
let ballPos = [0, 0], ballScale = 1, ballRAF = 0, ballSeqToken = 0;
const ball3 = { x:0, y:0, z:0, show:false };
function ballHome(att){ return [clamp(att.x + .5, .2, 8.8), att.y + .5]; }

function buildCourt(){
  svg.innerHTML = '';
  const defs = el('defs', null, svg);
  const cp = el('clipPath', { id:'clipCourt' }, defs); el('rect', { x:0, y:0, width:9, height:9 }, cp);
  const pat = el('pattern', { id:'hatch', width:.3, height:.3, patternUnits:'userSpaceOnUse', patternTransform:'rotate(45)' }, defs);
  const pr = el('rect', { width:.3, height:.3 }, pat); pr.style.fill = 'var(--tipfill)';
  const pl = el('line', { x1:.08, y1:0, x2:.08, y2:.3, 'stroke-width':.08 }, pat); pl.style.stroke = 'var(--tip)';
  G.bg = el('g', null, svg);
  const r1 = el('rect', { x:0, y:VB.y, width:9, height:-VB.y }, G.bg); r1.style.fill = 'var(--opp-court)';
  const r2 = el('rect', { x:0, y:0, width:9, height:9 }, G.bg); r2.style.fill = 'var(--court)';
  const r3 = el('rect', { x:0, y:0, width:9, height:3 }, G.bg); r3.style.fill = 'var(--court-front)';
  G.zones = el('g', { 'clip-path':'url(#clipCourt)' }, svg);
  const lines = el('g', null, svg); lines.style.stroke = 'var(--courtline)'; lines.style.fill = 'none';
  el('rect', { x:0, y:0, width:9, height:9, 'stroke-width':.07 }, lines);
  el('line', { x1:0, y1:3, x2:9, y2:3, 'stroke-width':.06 }, lines);
  el('line', { x1:0, y1:-3, x2:9, y2:-3, 'stroke-width':.05, 'stroke-opacity':.6 }, lines);
  el('line', { x1:0, y1:VB.y, x2:0, y2:0, 'stroke-width':.05, 'stroke-opacity':.6 }, lines);
  el('line', { x1:9, y1:VB.y, x2:9, y2:0, 'stroke-width':.05, 'stroke-opacity':.6 }, lines);
  G.zn = el('g', null, svg);
  for (const [n, x, y] of [[4,1.5,1.5],[3,4.5,1.5],[2,7.5,1.5],[5,1.5,6],[6,4.5,6],[1,7.5,6]]){ const t = el('text', { x, y, class:'zn' }, G.zn); t.textContent = n; }
  G.shadow = el('g', { 'clip-path':'url(#clipCourt)' }, svg);
  G.ranges = el('g', null, svg);
  G.paths = el('g', null, svg);
  G.net = el('g', null, svg);
  const net = el('line', { x1:-.35, y1:0, x2:9.35, y2:0, 'stroke-width':.12, 'stroke-linecap':'round' }, G.net); net.style.stroke = 'var(--ink)';
  for (const x of [0, 9]){ const c = el('circle', { cx:x, cy:0, r:.11, 'stroke-width':.04 }, G.net); c.style.fill = '#fff'; c.style.stroke = '#dc2626'; }
  G.block = el('g', null, svg);
  G.players = el('g', null, svg);
  G.opp = el('g', null, svg);
  G.ballG = el('g', { id:'ball', 'data-drag':'ball' }, svg);
  el('circle', { r:.62, fill:'transparent' }, G.ballG);
  G.ballTok = el('g', null, G.ballG);
  const bc = el('circle', { r:.22, 'stroke-width':.05 }, G.ballTok); bc.style.fill = 'var(--ball)'; bc.style.stroke = 'var(--ballline)';
  const seam = el('path', { d:'M-.2 -.05 Q0 .1 .2 -.05 M-.08 -.2 Q-.02 0 -.1 .2', fill:'none', 'stroke-width':.035 }, G.ballTok); seam.style.stroke = 'var(--ballline)';
  G.hint = el('g', { class:'hint-finger' }, svg);
  G.tagLayer = el('g', null, svg);
  G.tags = el('g', null, svg);
  // 對方攻擊手
  G.att = el('g', { id:'attacker', 'data-drag':'attacker' }, G.opp);
  el('circle', { r:.62, fill:'transparent' }, G.att);
  G.attTok = el('g', null, G.att);
  const ac = el('circle', { r:.46, 'stroke-width':.05 }, G.attTok); ac.style.fill = 'var(--oppfill)'; ac.style.stroke = '#fff';
  const at = el('text', { y:.02, 'font-size':.34, 'text-anchor':'middle', 'dominant-baseline':'central', 'font-weight':700 }, G.attTok); at.textContent = '攻'; at.style.fill = '#fff';
  // 對方發球員（真正站在對方底線後面，畫面上放在最上面）
  G.srv = el('g', { id:'server', 'data-drag':'server' }, G.opp);
  el('circle', { r:.62, fill:'transparent' }, G.srv);
  G.srvTok = el('g', null, G.srv);
  const sc = el('circle', { r:.46, 'stroke-width':.05 }, G.srvTok); sc.style.fill = 'var(--oppfill)'; sc.style.stroke = '#fff';
  const stx = el('text', { y:.02, 'font-size':.34, 'text-anchor':'middle', 'dominant-baseline':'central', 'font-weight':700 }, G.srvTok); stx.textContent = '發'; stx.style.fill = '#fff';
  const sar = el('path', { d:'M-.16 -.62 L0 -.84 L.16 -.62', fill:'none', 'stroke-width':.06, 'stroke-linecap':'round' }, G.srvTok); sar.style.stroke = 'var(--oppfill)';
  G.oppLabel = el('text', { x:4.5, y:-3.18, 'text-anchor':'middle', 'font-size':.32 }, G.bg); G.oppLabel.style.fill = 'var(--muted)';
  G.oppLabel.textContent = '對方場地';
  buildPlayers();
}
function buildPlayers(){
  G.players.innerHTML = ''; G.ranges.innerHTML = ''; G.tagLayer.innerHTML = '';
  plG = {}; rgG = {}; tgG = {}; fcG = {};
  for (const r of ROLES){
    const rg = el('g', { class:'rg', 'data-role':r }, G.ranges);
    el('circle', { r:S.radius }, rg);
    rgG[r] = rg;
    const g = el('g', { class:'pl', 'data-role':r, 'data-drag':'player' }, G.players);
    const fc = el('g', { class:'face' }, g);
    const fp = el('path', { d:'M-.2 -.5 L0 -.8 L.2 -.5 Z' }, fc); fp.style.fill = 'var(--ink)';
    const tok = el('g', { class:'tok' }, g);
    el('circle', { class:'hit', r:.66, fill:'transparent' }, tok);
    el('circle', { class:'ring', r:.62 }, tok);
    el('circle', { class:'body', r:.46 }, tok);
    el('text', { class:'t', y:.02, 'font-size':.34 }, tok);
    const badge = el('g', { class:'badge', transform:'translate(.42 -.42)' }, tok);
    el('circle', { r:.25 }, badge);
    el('text', { y:.02, 'font-size':.32 }, badge);
    // 標籤放在最上層，不會被旁邊的人蓋住
    const tg = el('g', { class:'tagpos', 'data-role':r }, G.tagLayer);
    const ttok = el('g', { class:'tok' }, tg);
    const tag = el('g', { class:'tag-svg', transform:'translate(0 -.95)', visibility:'hidden' }, ttok);
    el('rect', { x:-.5, y:-.23, width:1, height:.46, rx:.14 }, tag);
    el('text', { 'font-size':.33, y:.02 }, tag);
    tgG[r] = tg; plG[r] = g; fcG[r] = fc;
  }
  refreshPlayerLooks(currentComp());
}
// 換一輪時：同一個人的圖示跟著她走（她的角色可能換了，例如大砲從前排轉到後排）
function remapTokens(prev, next){
  if (!prev || !next || prev.system !== next.system) return;
  const np = {}, nr = {}, nt = {}, nf = {}, nw = {};
  for (const id in prev.roleOf){
    const a = prev.roleOf[id], b = next.roleOf[id];
    if (!a || !b) return;
    np[b] = plG[a]; nr[b] = rgG[a]; nt[b] = tgG[a]; nf[b] = fcG[a]; nw[b] = tw[a];
  }
  if (Object.keys(np).length !== ROLES.length) return;
  plG = np; rgG = nr; tgG = nt; fcG = nf;
  for (const r of ROLES){ plG[r].dataset.role = r; rgG[r].dataset.role = r; tgG[r].dataset.role = r; if (nw[r]) tw[r] = nw[r]; else delete tw[r]; }
}
// 接發球的範圍：五人 W 每個人顧的地方小，三人接的大（跟著「防守範圍半徑」的設定等比例放大縮小）
function recvRadius(){ const f = VBRot.teamOK(S.system, S.recv) ? 'team' : (S.recv === 'team' ? 'w5' : S.recv); return ({ team:2.2, w5:2.0, p4:2.3, p3:2.6 })[f] * S.radius / 2; }
function rangeRadius(){
  if (S.step !== 'recv') return S.radius;
  const st = play.steps[play.i];
  return st && st.key === 'switch' ? S.radius : recvRadius();
}
function refreshPlayerLooks(comp){
  const lu = comp.lu, rad = rangeRadius();
  for (const r of ROLES){
    const g = plG[r], grp = groupOf(r, lu), col = GROUP_COLOR[grp];
    g.querySelector('.body').style.fill = col;
    const t = g.querySelector('.t'); t.textContent = ROLE_INFO[r].tok; t.setAttribute('font-size', ROLE_INFO[r].tok.length > 1 ? .33 : .38);
    g.querySelector('.badge text').textContent = lu[r].zone;
    g.setAttribute('aria-label', roleName(r, lu));
    const c = rgG[r].querySelector('circle');
    c.setAttribute('r', rad); c.style.fill = col; c.style.stroke = col; c.style.fillOpacity = S.step === 'recv' ? .08 : .14; c.style.strokeOpacity = .55;
  }
}
// 3D 和 2D 用同一組移動：記下每個人從哪裡、往哪裡、花多久
const tw = {};
let mvMs = 0;
function setMoveDur(ms){ mvMs = Math.round(ms); svg.style.setProperty('--mv', `${mvMs}ms`); }
function posNow(r, now){
  const a = tw[r]; if (!a) return null;
  if (!a.dur) return a.to;
  const t = clamp((now - a.t0) / a.dur, 0, 1), e = 1 - Math.pow(1 - t, 3);
  return [a.from[0] + (a.to[0] - a.from[0]) * e, a.from[1] + (a.to[1] - a.from[1]) * e];
}
const faceAng = {};
function placePlayers(P, off, face){
  const now = performance.now();
  for (const r of ROLES){
    const p = P[r]; if (!p) continue;
    tw[r] = { from: posNow(r, now) || p.slice(), to:p.slice(), t0:now, dur:mvMs };
    const tf = `translate(${p[0].toFixed(3)}px, ${p[1].toFixed(3)}px)`;
    plG[r].style.transform = tf; rgG[r].style.transform = tf; if (tgG[r]) tgG[r].style.transform = tf;
    rgG[r].classList.toggle('off', !!(off && off.includes(r)));
    const fp = face ? (Array.isArray(face) ? face : face[r]) : null;
    if (fp){
      let a = Math.atan2(fp[0] - p[0], -(fp[1] - p[1])) * 180 / Math.PI;
      const old = faceAng[r];
      if (old != null){ while (a - old > 180) a -= 360; while (a - old < -180) a += 360; }
      faceAng[r] = a;
    }
  }
  drawFaces();
}
function drawFaces(){
  for (const r of ROLES){ const a = faceAng[r]; if (a == null || !fcG[r]) continue; fcG[r].style.transform = `rotate(${a.toFixed(1)}deg) scale(${k.toFixed(3)})`; }
}
function placeAttacker(){ G.att.setAttribute('transform', `translate(${S.attacker.x.toFixed(3)} ${S.attacker.y.toFixed(3)})`); }
function placeServer(){ G.srv.setAttribute('transform', `translate(${S.serveX.toFixed(3)} -2.95)`); }
function drawBall(p, s, b3){
  ballPos = p.slice(); ballScale = s || 1;
  G.ballG.setAttribute('transform', `translate(${p[0].toFixed(3)} ${p[1].toFixed(3)})`);
  G.ballTok.setAttribute('transform', `scale(${(k * ballScale).toFixed(3)})`);
  if (b3){ ball3.x = b3[0]; ball3.y = b3[1]; ball3.z = b3[2]; }
  else { ball3.x = p[0]; ball3.y = p[1]; ball3.z = .11; }
  ball3.show = true;
}
function hideBall(){ G.ballG.style.display = 'none'; ball3.show = false; }
function drawShadow(comp){
  G.shadow.innerHTML = ''; G.block.innerHTML = '';
  if (!comp.seg) return;
  if (comp.shadow){
    const pts = comp.shadow.map(p => p.join(',')).join(' ');
    const base = el('polygon', { points:pts }, G.shadow); base.style.fill = 'var(--court)'; base.style.fillOpacity = .85;
    const pg = el('polygon', { points:pts, fill:'url(#hatch)', 'stroke-width':.04, 'stroke-dasharray':'.12 .08' }, G.shadow); pg.style.stroke = 'var(--tip)';
    pg.setAttribute('data-shadow', '1');
  }
  const w = el('rect', { x:comp.seg[0], y:-.09, width:comp.seg[1] - comp.seg[0], height:.18, rx:.08 }, G.block);
  w.style.fill = 'var(--ink)'; w.style.opacity = .85;
}
function isDefStep(){ return S.step === 'spike' || S.step === 'tip'; }
function drawZones(comp){
  G.zones.innerHTML = '';
  if (!isDefStep()) return;
  const z = attackZones(S.attacker, comp);
  const sp = el('polygon', { points:z.spike.map(p => p.join(',')).join(' ') }, G.zones); sp.style.fill = 'var(--spike)'; sp.style.fillOpacity = .16;
  const bd = el('polygon', { points:z.band.map(p => p.join(',')).join(' '), fill:'url(#hatch)' }, G.zones); bd.style.opacity = .75;
  // 攻擊手打得到的扇形邊界
  const o = [S.attacker.x, S.attacker.y];
  for (const c of [[0, 9], [9, 9]]){ const ln = el('line', { x1:o[0], y1:o[1], x2:c[0], y2:c[1], 'stroke-width':.04, 'stroke-dasharray':'.2 .14' }, G.zones); ln.style.stroke = 'var(--spike)'; ln.style.opacity = .55; }
}
function clearPaths(){ G.paths.innerHTML = ''; }
function drawTarget(T, text){
  const c = el('circle', { cx:T[0], cy:T[1], r:.85, class:'target' }, G.paths);
  const t = el('text', { x:T[0], y:T[1] + .12, class:'target-t' }, G.paths); t.textContent = text;
  t.setAttribute('font-size', (.33 * k).toFixed(3)); return c;
}
// 發球前的站位規則：連起來的兩個人不能前後（直線）或左右（橫線）交換
function drawPairs(P, roleZone){
  const at = {}; for (const r in roleZone) at[roleZone[r]] = r;
  const bad = VBRot.violations(P, roleZone);
  const isBad = (a, b) => bad.some(v => (v.a === a && v.b === b) || (v.a === b && v.b === a));
  const g = el('g', { class:'pairs' }, G.paths);
  for (const [a, b] of VBRot.FB_PAIRS.concat(VBRot.LR_PAIRS)){
    const ra = at[a], rb = at[b], pa = P[ra], pb = P[rb]; if (!pa || !pb) continue;
    const ln = el('line', { x1:pa[0], y1:pa[1], x2:pb[0], y2:pb[1], 'stroke-width': isBad(ra, rb) ? .08 : .045, 'stroke-dasharray':'.16 .12' }, g);
    ln.style.stroke = isBad(ra, rb) ? 'var(--opp)' : 'var(--ink)'; ln.style.opacity = isBad(ra, rb) ? 1 : .42;
  }
}
// 移動的箭頭：dashed 是預定路線（虛線），否則是換位的紅色箭頭
function drawMoveArrows(list, dashed){
  const g = el('g', { class:'move-arrows' }, G.paths);
  for (const [a, b] of list){
    if (!a || !b || dist(a, b) < .45) continue;
    const v = unit([b[0] - a[0], b[1] - a[1]]), off = .5 * Math.max(1, k);
    const p = [a[0] + v[0] * off, a[1] + v[1] * off], q = [b[0] - v[0] * .08, b[1] - v[1] * .08];
    if (dist(p, q) < .3) continue;
    const ln = el('line', { x1:p[0].toFixed(2), y1:p[1].toFixed(2), x2:q[0].toFixed(2), y2:q[1].toFixed(2), 'stroke-width': dashed ? .05 : .07, 'stroke-linecap':'round' }, g);
    if (dashed) ln.setAttribute('stroke-dasharray', '.16 .12');
    ln.style.stroke = dashed ? 'var(--ink)' : 'var(--opp)'; ln.style.opacity = dashed ? .7 : .9;
    const n = [-v[1], v[0]], s2 = .24;
    const ah = el('path', { d:`M${(q[0]-v[0]*s2+n[0]*s2*.75).toFixed(2)} ${(q[1]-v[1]*s2+n[1]*s2*.75).toFixed(2)} L${q[0].toFixed(2)} ${q[1].toFixed(2)} L${(q[0]-v[0]*s2-n[0]*s2*.75).toFixed(2)} ${(q[1]-v[1]*s2-n[1]*s2*.75).toFixed(2)}`, fill:'none', 'stroke-width': dashed ? .05 : .07, 'stroke-linecap':'round', 'stroke-linejoin':'round' }, g);
    ah.style.stroke = dashed ? 'var(--ink)' : 'var(--opp)'; ah.style.opacity = dashed ? .7 : .9;
  }
}
// 第一波打完要交換的兩個人：中間一條紅色雙箭頭
function drawSwap(pair){
  if (!pair || !pair[0] || !pair[1]) return;
  const [a, b] = pair, v = unit([b[0] - a[0], b[1] - a[1]]), off = .6 * Math.max(1, k);
  const p = [a[0] + v[0] * off, a[1] + v[1] * off], q = [b[0] - v[0] * off, b[1] - v[1] * off];
  const g = el('g', { class:'swap' }, G.paths);
  const ln = el('line', { x1:p[0].toFixed(2), y1:p[1].toFixed(2), x2:q[0].toFixed(2), y2:q[1].toFixed(2), 'stroke-width':.06, 'stroke-dasharray':'.16 .1' }, g); ln.style.stroke = 'var(--opp)';
  const n = [-v[1], v[0]], s2 = .22;
  for (const [t, d] of [[q, 1], [p, -1]]){
    const ah = el('path', { d:`M${(t[0]-d*v[0]*s2+n[0]*s2*.75).toFixed(2)} ${(t[1]-d*v[1]*s2+n[1]*s2*.75).toFixed(2)} L${t[0].toFixed(2)} ${t[1].toFixed(2)} L${(t[0]-d*v[0]*s2-n[0]*s2*.75).toFixed(2)} ${(t[1]-d*v[1]*s2-n[1]*s2*.75).toFixed(2)}`, fill:'none', 'stroke-width':.06, 'stroke-linecap':'round' }, g);
    ah.style.stroke = 'var(--opp)';
  }
}
// 輪轉方向的箭頭：2→1→6→5→4→3→2（順時針）
function drawRotArrows(){
  const g = el('g', { class:'rot-arrows' }, G.paths);
  const seq = [2,1,6,5,4,3,2];
  for (let i = 0; i < 6; i++){
    const a = ZC[seq[i]], b = ZC[seq[i+1]], v = unit([b[0]-a[0], b[1]-a[1]]), off = .75 * Math.max(1, k);
    const p = [a[0] + v[0]*off, a[1] + v[1]*off], q = [b[0] - v[0]*off, b[1] - v[1]*off];
    const n = [-v[1], v[0]], mid = [(p[0]+q[0])/2 + n[0]*.35, (p[1]+q[1])/2 + n[1]*.35];
    const pa = el('path', { d:`M${p[0].toFixed(2)} ${p[1].toFixed(2)} Q${mid[0].toFixed(2)} ${mid[1].toFixed(2)} ${q[0].toFixed(2)} ${q[1].toFixed(2)}`, fill:'none', 'stroke-width':.07, 'stroke-linecap':'round' }, g);
    pa.style.stroke = 'var(--muted)';
    const dv = unit([q[0] - mid[0], q[1] - mid[1]]), dn = [-dv[1], dv[0]], s = .22;
    const ah = el('path', { d:`M${(q[0]-dv[0]*s+dn[0]*s*.8).toFixed(2)} ${(q[1]-dv[1]*s+dn[1]*s*.8).toFixed(2)} L${q[0].toFixed(2)} ${q[1].toFixed(2)} L${(q[0]-dv[0]*s-dn[0]*s*.8).toFixed(2)} ${(q[1]-dv[1]*s-dn[1]*s*.8).toFixed(2)}`, fill:'none', 'stroke-width':.07, 'stroke-linecap':'round', 'stroke-linejoin':'round' }, g);
    ah.style.stroke = 'var(--muted)';
  }
}
let curTags = {};
function setMarks(m, P){
  curTags = {};
  const placed = [];
  for (const r of ROLES){
    const g = plG[r]; g.classList.remove('is-dig', 'is-backup');
    const tag = tgG[r].querySelector('.tag-svg'); tag.setAttribute('visibility', 'hidden');
  }
  const showTag = (r, text, below) => {
    curTags[r] = text;
    const tag = tgG[r].querySelector('.tag-svg'); tag.querySelector('text').textContent = text;
    tag.setAttribute('transform', below ? 'translate(0 .95)' : 'translate(0 -.95)');
    const w = .26 * text.length + .32; const rc = tag.querySelector('rect'); rc.setAttribute('x', -w/2); rc.setAttribute('width', w);
    tag.setAttribute('visibility', 'visible');
  };
  if (!m) return;
  // 名牌放在人的上面或下面：先放想放的那一邊，那裡有別人或別的名牌擋著就換另一邊（不要蓋住別人的名字）
  const put = (r, text, preferBelow) => {
    let below = !!preferBelow;
    if (P && P[r]){
      const free = y => !placed.some(q => Math.abs(q[0] - P[r][0]) < 1.25 * k && Math.abs(q[1] - y) < .55 * k)
        && !Object.keys(P).some(o => o !== r && Math.abs(P[o][0] - P[r][0]) < .9 * k && Math.abs(P[o][1] - y) < .6 * k);
      const up = P[r][1] - .95 * k, dn = P[r][1] + .95 * k;
      if (below ? (!free(dn) && free(up)) : (!free(up) && free(dn))) below = !below;
      placed.push([P[r][0], below ? dn : up]);
    }
    showTag(r, text, below);
  };
  if (m.hidden) for (const r of m.hidden.slice().sort((a, b) => P && P[a] && P[b] ? P[a][1] - P[b][1] : 0)) put(r, '不接');
  if (m.dig){ plG[m.dig].classList.add('is-dig'); put(m.dig, m.gap ? '衝！' : '接'); }
  if (m.serve) put(m.serve, '發球');
  if (m.set) put(m.set, '舉');
  if (m.hit) put(m.hit, '攻擊');
  if (m.backup){ plG[m.backup].classList.add('is-backup'); put(m.backup, '補位', true); }
  if (m.partner) put(m.partner, '讓開', true);
  if (m.fillers) for (const r of m.fillers){ plG[r].classList.add('is-backup'); put(r, '補空位'); }
}
function applyK(){
  const r = svg.getBoundingClientRect();
  if (!r.width || !r.height) return;
  const ppm = Math.min(r.width / VB.w, r.height / VB.h);
  k = clamp(40 / ppm, .85, document.body.classList.contains('sit-open') ? 1.8 : 1.75);
  svg.querySelectorAll('.tok').forEach(t => t.setAttribute('transform', `scale(${k.toFixed(3)})`));
  G.attTok.setAttribute('transform', `scale(${k.toFixed(3)})`);
  G.srvTok.setAttribute('transform', `scale(${k.toFixed(3)})`);
  G.ballTok.setAttribute('transform', `scale(${(k * ballScale).toFixed(3)})`);
  G.oppLabel.setAttribute('font-size', (.33 * Math.max(1, k)).toFixed(3));
  svg.querySelectorAll('.target-t').forEach(t => t.setAttribute('font-size', (.33 * k).toFixed(3)));
  drawFaces();
}

/* ---------- 球的動畫 ---------- */
function seg3(s, prevTo){ return { from: s.from3 || s.from || prevTo || ballPos, to: s.to }; }
function animateBall(seg, onDone){
  const token = ++ballSeqToken;
  cancelAnimationFrame(ballRAF);
  const run = (s, prevTo, done) => {
    const from = s.from ? s.from.slice() : ballPos.slice(), to = s.to, f3 = s.from3 || from;
    const dur = (s.dur || 500) * speedK() * slowK(s);
    if (reduceMotion.matches || dur <= 0){ drawBall(to, 1, [to[0], to[1], zAt(s.z, 1)]); done(); return; }
    const t0 = performance.now();
    const frame = now => {
      if (token !== ballSeqToken) return;
      const t = Math.min(1, (now - t0) / dur);
      const e = s.arc > .4 ? (t < .5 ? 2*t*t : 1 - Math.pow(-2*t + 2, 2) / 2) : t;
      drawBall([from[0] + (to[0] - from[0]) * e, from[1] + (to[1] - from[1]) * e], 1 + (s.arc || 0) * .9 * Math.sin(Math.PI * t),
        [f3[0] + (to[0] - f3[0]) * e, f3[1] + (to[1] - f3[1]) * e, zAt(s.z, e)]);
      if (t < 1) ballRAF = requestAnimationFrame(frame); else done();
    };
    ballRAF = requestAnimationFrame(frame);
  };
  run(seg, null, () => { if (seg.then && token === ballSeqToken) run(Object.assign({ from:seg.to }, seg.then), seg.to, () => onDone && onDone()); else if (onDone) onDone(); });
}
function ballEnd(b){ if (!b) return null; return b.then ? b.then.to : b.to; }
function ballEnd3(b){
  if (!b) return null;
  const s = b.then || b, to = b.then ? b.then.to : (b.at3 || b.to);
  const z = b.then ? zAt(b.then.z, 1) : (b.z3 != null ? b.z3 : zAt(b.z, 1));
  return [to[0], to[1], z];
}

/* ---------- 播放 ---------- */
const play = { steps:[], i:-1, auto:false, timer:0, comp:null, landing:null, dec:null, t0:0 };
function stopTimer(){ clearTimeout(play.timer); play.timer = 0; }
function idleState(comp){
  if (S.step === 'rot') return { off:ROLES.slice(), face:[4.5, -3] };
  if (S.step === 'recv') return { off:comp.hidden, face:serverPos() };
  return { off:comp.blockers, face:[S.attacker.x, S.attacker.y] };
}
function showLayers(){
  G.att.style.display = isDefStep() ? '' : 'none';
  G.srv.style.display = S.step === 'recv' ? '' : 'none';
  G.ballG.style.display = S.step === 'rot' ? 'none' : '';
  G.zn.style.opacity = S.step === 'rot' ? .45 : '';
}
function resetPlay(keepCaption, dur){
  stopTimer(); ballSeqToken++; cancelAnimationFrame(ballRAF);
  play.steps = []; play.i = -1; play.auto = false; play.landing = null; play.dec = null;
  clearPaths(); setLibOff(!S.useLib); setMarks(null); v3.jump = {};
  const comp = currentComp(); play.comp = comp;
  refreshPlayerLooks(comp);
  setMoveDur(reduceMotion.matches ? 0 : (dur == null ? 250 : dur));
  const st = idleState(comp);
  placePlayers(comp.pos, st.off, st.face);
  drawShadow(comp); drawZones(comp);
  G.shadow.style.display = ''; G.block.style.display = ''; G.zones.style.display = '';
  showLayers();
  placeAttacker(); placeServer();
  if (S.step === 'rot'){ drawRotArrows(); hideBall(); }
  else if (S.step === 'recv'){ drawPairs(comp.pos, comp.R.roleZone); drawMoveArrows(recvRoutes(comp, comp.pos), true); if (comp.swap) drawSwap([comp.pos[comp.swap[0]], comp.pos[comp.swap[1]]]); setMarks({ hidden:comp.hidden }, comp.pos); drawBall(serveHome(), 1, [S.serveX + .3, SERVER_Y + .25, 1.25]); }
  else drawBall(ballHome(S.attacker), 1, [ballHome(S.attacker)[0], ballHome(S.attacker)[1], 2.6]);
  updateLegend(true);
  if (!keepCaption) showIdleCaption(comp);
  updateButtons();
  return comp;
}
function showIdleCaption(comp){
  $('stepTitle').textContent = S.step === 'rot' ? `第 ${rotIndex()} 輪` : (S.step === 'recv' ? '發球前站好' : (S.mode === 'free' ? '自己擺' : '讀球站位'));
  let t = comp.summary;
  const hintOn = !hintSeen();
  $('btnHintOk').hidden = !hintOn; $('btnDetail').hidden = hintOn;
  if (hintOn) t = HINTS[hintKey()];
  $('caption').textContent = t;
  $('ruleLine').hidden = true;
  curNotes = comp.notes;
  if (detOpen()) renderDetail();
  updateNextLesson();
}
let curNotes = {};
function stepDur(st){
  if (st.moveDur) return st.moveDur;
  if (['dig','out','blocked','serve'].includes(st.key)) return (st.ball ? (st.ball.dur || 500) * slowK(st.ball) + (st.ball.then ? st.ball.then.dur : 0) : 500);
  return 800;
}
const BLOCK_KEYS = ['read','dig','out','blocked','nobody'];
function applyStep(i, animate){
  const st = play.steps[i]; if (!st) return;
  play.i = i;
  const comp = play.comp, now = performance.now();
  play.t0 = now;
  const mv = animate && !reduceMotion.matches ? stepDur(st) * speedK() : 0;
  setMoveDur(mv);
  setLibOff(!S.useLib || !!st.noLib);
  refreshPlayerLooks(st.lu ? { lu:st.lu } : comp);
  const off = st.off || (BLOCK_KEYS.includes(st.key) ? comp.blockers : []);
  placePlayers(st.pos, off, st.faceMap || st.face || ballEnd(st.ball));
  setMarks(st.marks, st.pos);
  const blockShown = BLOCK_KEYS.includes(st.key);
  G.shadow.style.display = blockShown ? '' : 'none'; G.block.style.display = blockShown ? '' : 'none'; G.zones.style.display = blockShown ? '' : 'none';
  updateLegend(blockShown);
  clearPaths();
  if (st.marks && st.marks.pairs) drawPairs(st.pos, comp.R.roleZone);
  if (st.marks && st.marks.target) drawTarget(st.marks.target === 'fix' ? FIX_T : rt(), st.marks.target === 'fix' ? '修正' : (st.key === 'pass' && S.step !== 'recv' ? '舉球位置' : '傳球目標'));
  if (st.marks && st.marks.routes) drawMoveArrows(st.marks.routes, true);
  if (st.marks && st.marks.arrows) drawMoveArrows(st.marks.arrows, false);
  if (st.marks && st.marks.swap) drawSwap(st.marks.swap);
  if (play.landing && i >= 1 && ['dig','out','nobody','serve'].includes(st.key)){
    const lx = el('circle', { cx:play.landing[0], cy:play.landing[1], r:.16, fill:'none', 'stroke-width':.05 }, G.paths); lx.style.stroke = 'var(--opp)';
  }
  if (st.marks && st.marks.out){ const t = el('text', { x:st.marks.out[0], y:st.marks.out[1] - .45, class:'out-t' }, G.paths); t.textContent = '出界'; }
  $('stepTitle').textContent = `${i + 1}/${play.steps.length}　${st.title}`;
  $('caption').textContent = st.cap;
  const rl = $('ruleLine'); rl.textContent = st.rule || ''; rl.hidden = !st.rule;
  curNotes = st.notes || {};
  if (detOpen()) renderDetail();
  ballSeqToken++; cancelAnimationFrame(ballRAF);
  if (st.ball){
    G.ballG.style.display = '';
    if (animate && st.ball.from) animateBall(st.ball);
    else { const e = ballEnd(st.ball); if (e) drawBall(e, 1, ballEnd3(st.ball)); }
  } else if (st.key === 'reset') drawBall(ballHome(S.attacker), 1, [ballHome(S.attacker)[0], ballHome(S.attacker)[1], 2.6]);
  else hideBall();
  set3DJumps(st, animate, now);
  updateButtons();
  updateNextLesson();
}
// 球還在空中的步驟（接球、送到舉球位置、接發球）播完馬上接下一步，像真的比賽一樣不停下來
const LIVE_KEYS = ['dig','pass','serve'];
function ballTotal(b){ if (!b || !b.from) return 0; return (b.dur || 500) * slowK(b) + (b.then ? (b.then.dur || 500) : 0); }
function scheduleNext(){
  stopTimer();
  if (!play.auto) return;
  if (play.i >= play.steps.length - 1){ play.auto = false; updateButtons(); return; }
  const st = play.steps[play.i];
  const read = clamp(900 + st.cap.length * 45, 1600, 5600) * (S.speed === 'slow' ? 1.4 : 1);
  const live = S.flow !== 'step' && LIVE_KEYS.includes(st.key) && st.ball;
  const wait = live ? Math.max(stepDur(st), ballTotal(st.ball)) * speedK() + 40 : stepDur(st) * speedK() + read;
  play.timer = setTimeout(() => { applyStep(play.i + 1, true); scheduleNext(); }, wait);
}
function startSim(L){
  if (S.step === 'rot') return;
  markHintSeen(); v3.cam = null;
  const comp = resetPlay(true);
  if (S.step === 'recv'){ const dec = decideRecv(L, comp); play.dec = dec; play.steps = buildRecvSteps(L, comp, dec); }
  else { const dec = decide(L, S.attackType, comp, S.attacker); play.dec = dec; play.steps = buildSteps(L, S.attackType, comp, dec, S.attacker); }
  play.landing = (play.dec && play.dec.soft) ? play.dec.soft.L.slice() : L.slice();
  applyStep(0, false);
  play.auto = true;
  applyStep(1, true);
  scheduleNext();
}
function demoBall(){
  if (S.step === 'recv'){ startSim(S.recv === 'p4' ? [4.5, 6.9] : (S.recv === 'p3' ? [3.0, 6.6] : [3.0, 5.6])); return; }
  const side = sideOf(S.attacker.x);
  startSim(side === 'R' ? [1.3, 6.3] : (side === 'L' ? [7.7, 6.3] : [2.0, 6.8]));
}
function updateButtons(){
  const has = play.steps.length > 0;
  const prev = $('btnPrev'), next = $('btnNext'), pl = $('btnPlay');
  prev.setAttribute('aria-disabled', String(!has || play.i <= 0));
  next.setAttribute('aria-disabled', String(!has || play.i >= play.steps.length - 1));
  let state = 'play', label = S.step === 'rot' ? '播放我們發球時怎麼換位' : (S.step === 'recv' ? '示範一球發球' : '示範一球');
  if (has){
    if (play.auto){ state = 'pause'; label = '暫停'; }
    else if (play.i >= play.steps.length - 1){ state = 'replay'; label = '重播這一球'; }
    else { state = 'play'; label = '繼續播放'; }
  }
  pl.dataset.state = state; pl.setAttribute('aria-label', label); pl.title = label;
}
function onPlay(){
  if (!play.steps.length){ if (S.step === 'rot') startServeSeq(); else demoBall(); return; }
  if (play.auto){ play.auto = false; stopTimer(); updateButtons(); return; }
  if (play.i >= play.steps.length - 1){ if (S.step === 'rot'){ startServeSeq(); return; } const L = play.landing; if (L) startSim(L); return; }
  play.auto = true; applyStep(play.i + 1, true); scheduleNext();
}
function noBallMsg(){ return S.step === 'rot' ? '按播放，看我們發球時大家怎麼換位' : (S.step === 'recv' ? '先把球拖到我們的場地，或按播放看示範發球' : '先把球拖到我們的場地，或按播放看示範'); }
function onPrev(){
  if (!play.steps.length){ toast(noBallMsg()); return; }
  if (play.i <= 0){ toast('已經是第一步'); return; }
  play.auto = false; stopTimer(); ballSeqToken++;
  applyStep(play.i - 1, false);
}
function onNext(){
  if (!play.steps.length){ toast(noBallMsg()); return; }
  if (play.i >= play.steps.length - 1){ toast('已經是最後一步，按播放鍵可以重播'); return; }
  play.auto = false; stopTimer();
  applyStep(play.i + 1, true);
}

/* ---------- 拖拉 ---------- */
let drag = null, rafPending = false;
function svgPt(e){
  const m = svg.getScreenCTM(); if (!m) return [0, 0];
  const p = svg.createSVGPoint(); p.x = e.clientX; p.y = e.clientY;
  const q = p.matrixTransform(m.inverse()); return [q.x, q.y];
}
function onDown(e){
  if (e.button !== undefined && e.button !== 0) return;
  const p = svgPt(e);
  const t = e.target.closest('[data-drag]');
  let kind = t ? t.dataset.drag : null;
  if (kind === 'player' && !(isDefStep() && S.mode === 'free')) kind = null;
  if (S.step === 'rot') kind = null;
  if (kind === 'attacker' && !isDefStep()) kind = null;
  if (kind === 'server' && S.step !== 'recv') kind = null;
  drag = { kind, id:e.pointerId, start:p, sx:e.clientX, sy:e.clientY, moved:false, role: kind === 'player' ? t.dataset.role : null };
  try{ svg.setPointerCapture(e.pointerId); }catch(err){}
  if (kind){
    e.preventDefault();
    if (play.steps.length && kind !== 'ball') resetPlay();
    if (kind === 'ball'){ resetPlay(true); G.ballG.classList.add('dragging'); hideHint(); }
    if (kind === 'attacker') G.att.classList.add('dragging');
    if (kind === 'server') G.srv.classList.add('dragging');
    if (kind === 'player'){ plG[drag.role].classList.add('dragging'); rgG[drag.role].classList.add('dragging'); tgG[drag.role].classList.add('dragging'); }
  }
}
function onMove(e){
  if (!drag || e.pointerId !== drag.id) return;
  const p = svgPt(e);
  if (!drag.moved && Math.hypot(e.clientX - drag.sx, e.clientY - drag.sy) > 6) drag.moved = true;
  drag.cur = p;
  if (!drag.kind) return;
  e.preventDefault();
  if (!rafPending){ rafPending = true; requestAnimationFrame(() => { rafPending = false; if (drag) dragUpdate(); }); }
}
function dragUpdate(){
  const p = drag.cur; if (!p) return;
  if (drag.kind === 'attacker'){
    S.attacker = { x:clamp(p[0], .3, 8.7), y:clamp(p[1], -3.2, -.6) };
    placeAttacker();
    const comp = currentComp(); play.comp = comp;
    setMoveDur(S.mode === 'free' ? 0 : 220);
    placePlayers(comp.pos, comp.blockers, [S.attacker.x, S.attacker.y]);
    refreshPlayerLooks(comp);
    drawShadow(comp); drawZones(comp);
    drawBall(ballHome(S.attacker), 1, [ballHome(S.attacker)[0], ballHome(S.attacker)[1], 2.6]);
    showIdleCaption(comp);
  } else if (drag.kind === 'server'){
    S.serveX = clamp(p[0], .4, 8.6);
    placeServer();
    const comp = play.comp;
    setMoveDur(0); placePlayers(comp.pos, comp.hidden, serverPos());
    drawBall(serveHome(), 1, [S.serveX + .3, SERVER_Y + .25, 1.25]);
  } else if (drag.kind === 'ball'){
    const q = [clamp(p[0], -.4, 9.4), clamp(p[1], VB.y + .2, 9.65)];
    drawBall(q, 1);
    previewBall(q);
  } else if (drag.kind === 'player'){
    const q = [clamp(p[0], -.25, 9.25), clamp(p[1], .2, 9.5)];
    custom[drag.role] = q;
    const comp = currentComp(); play.comp = comp;
    setMoveDur(0); placePlayers(comp.pos, comp.blockers, [S.attacker.x, S.attacker.y]); drawShadow(comp); drawZones(comp);
    curNotes = comp.notes;
  }
}
function previewBall(q){
  clearPaths();
  const h = S.step === 'recv' ? serveHome() : ballHome(S.attacker);
  el('line', { x1:h[0], y1:h[1], x2:q[0], y2:q[1], class:'prev-line' }, G.paths);
  for (const r of ROLES) rgG[r].classList.remove('hot');
  G.tags.innerHTML = '';
  if (q[1] <= .05) return;
  const comp = play.comp || currentComp();
  const dec = S.step === 'recv' ? decideRecv(q, comp) : decide(q, S.attackType, comp, S.attacker);
  let text = '';
  if (dec.kind === 'out') text = '出界';
  else if (dec.kind === 'blocked') text = '會被攔網擋住';
  else if (dec.kind === 'dig'){ rgG[dec.digger].classList.add('hot'); text = (dec.soft ? '碰手・' : '') + `${ROLE_INFO[dec.digger].tok}接` + (dec.rule === 'gap' ? '（空檔）' : ''); }
  if (text){
    const g = el('g', { class:'tag-svg', transform:`translate(${q[0].toFixed(2)} ${(q[1] - .75).toFixed(2)}) scale(${k.toFixed(2)})` }, G.tags);
    const w = .24 * text.length + .3;
    el('rect', { x:-w/2, y:-.23, width:w, height:.46, rx:.14 }, g);
    const t = el('text', { 'font-size':.33, y:.02 }, g); t.textContent = text;
  }
}
function onUp(e){
  if (!drag || e.pointerId !== drag.id) return;
  const d = drag; drag = null;
  try{ svg.releasePointerCapture(e.pointerId); }catch(err){}
  G.ballG.classList.remove('dragging'); G.att.classList.remove('dragging'); G.srv.classList.remove('dragging');
  for (const r of ROLES){ plG[r].classList.remove('dragging'); rgG[r].classList.remove('dragging', 'hot'); tgG[r].classList.remove('dragging'); }
  G.tags.innerHTML = '';
  const p = d.cur || d.start;
  if (d.kind === 'ball'){
    if (d.moved && p[1] > .05){ startSim([clamp(p[0], -.4, 9.4), clamp(p[1], .06, 9.65)]); }
    else { resetPlay(true); if (!d.moved) toast('按住黃色的球，拖到我們的場地'); }
    return;
  }
  if (d.kind === 'attacker' || d.kind === 'server'){ saveSettings(); return; }
  if (d.kind === 'player'){ saveCustom(); return; }
  if (!d.kind && !d.moved){
    if (S.step === 'rot'){ toast('按播放看我們發球時怎麼換位，按 ↻ 換下一輪'); return; }
    if (p[1] > .05 && p[1] < 9.65 && p[0] > -.4 && p[0] < 9.4) startSim([p[0], p[1]]);
  }
}
function onCancel(e){
  if (!drag || e.pointerId !== drag.id) return;
  drag = null; resetPlay();
}

/* ---------- 第一次的提示 ---------- */
const HINTS = {
  rot:'第一次用：按 ▶ 看我們發球時大家怎麼換位；按 ↻（下一輪）看大家怎麼順時針轉一格。看懂了，點上面的「2 接發球」。',
  recv:'第一次用：把黃色的球拖到我們的場地（或直接點場上），看誰去接發球、大家怎麼動。上面紅色的「發」是發球員，可以左右拖。',
  def:'提示：把黃色的球拖到我們的場地，或直接點場上任一點，就會看到誰去接。拖紅色的「攻」可以改變對方從哪裡打。',
};
function hintKey(){ return S.step === 'rot' ? 'rot' : (S.step === 'recv' ? 'recv' : 'def'); }
function hintSeen(){
  const h = hintKey();
  if (h === 'def') return !!store.get(KEY.hint, false);
  const o = store.get(KEY.hint2, {}); return !!(o && o[h]);
}
function markHintSeen(){
  const h = hintKey();
  if (h === 'def'){ if (!store.get(KEY.hint, false)) store.set(KEY.hint, true); }
  else { const o = Object.assign({}, store.get(KEY.hint2, {}) || {}); if (!o[h]){ o[h] = true; store.set(KEY.hint2, o); } }
  hideHint(); $('btnHintOk').hidden = true; $('btnDetail').hidden = false; $('btnPlay').classList.remove('pulse');
}
function hideHint(){ G.hint.innerHTML = ''; }
function showHint(){
  hideHint();
  $('btnPlay').classList.toggle('pulse', S.step === 'rot' && !hintSeen());
  if (hintSeen() || S.step === 'rot' || S.mode === 'free' && isDefStep() || v3.on) return;
  const h = S.step === 'recv' ? serveHome() : ballHome(S.attacker), to = S.step === 'recv' ? [3.2, 5.4] : [4.5, 5.6];
  const path = `M${h[0]} ${h[1]} L${to[0]} ${to[1]}`;
  const ln = el('path', { d:path, fill:'none', 'stroke-width':.06, 'stroke-dasharray':'.2 .14' }, G.hint); ln.style.stroke = 'var(--ink)'; ln.style.opacity = .55;
  const ah = el('path', { d:`M${to[0]-.25} ${to[1]-.35} L${to[0]} ${to[1]} L${to[0]+.3} ${to[1]-.3}`, fill:'none', 'stroke-width':.07, 'stroke-linecap':'round' }, G.hint); ah.style.stroke = 'var(--ink)'; ah.style.opacity = .55;
  if (!reduceMotion.matches){
    const f = el('g', null, G.hint);
    const c = el('circle', { r:.34, 'stroke-width':.05 }, f); c.style.fill = 'rgba(255,255,255,.55)'; c.style.stroke = 'var(--ink)';
    const am = el('animateMotion', { dur:'1.6s', repeatCount:'3', path, fill:'freeze' }, f);
    try{ am.beginElement && am.beginElement(); }catch(e){}
    setTimeout(() => { if (f.parentNode) f.remove(); }, 5000);
  }
}

/* ---------- 立體畫面（第一人稱） ---------- */
const cv = $('court3d'), lbl = $('court3dLabels');
const v3 = { on:false, r:null, gl:false, raf:0, cam:null, colors:null, jump:{}, down:null, last:0, prev:{}, phase:{} };
let legendShown = true;
function colors3(){
  const cs = getComputedStyle(document.documentElement);
  const g = (n, fb) => ((cs.getPropertyValue(n) || '').trim() || fb);
  return { front:g('--front', '#1d4ed8'), back:g('--back', '#047857'), set:g('--setter', '#c2410c'), lib:g('--lib', '#6d28d9') };
}
function set3DJumps(st, animate, now){
  v3.jump = {};
  if (!animate || reduceMotion.matches || !st) return;
  const kk = speedK();
  if (['dig','blocked','out','nobody'].includes(st.key)){
    v3.jump.att = { t0:now - 340 * kk, dur:720 * kk, h:.55 };
    const L = play.landing || [4.5, 4];
    const toNet = Math.abs(S.attacker.y) / (Math.abs(S.attacker.y) + Math.max(.5, L[1]));
    const tNet = (st.ball ? st.ball.dur * slowK(st.ball) : 480) * kk * (st.ball && st.ball.then && st.key === 'dig' ? 1 : toNet);
    for (const r of play.comp.blockers) v3.jump['us:' + r] = { t0:now + tNet - 330 * kk, dur:660 * kk, h:.48 };
  }
  if (st.key === 'set' && st.hitter){
    const tHit = (st.ball ? st.ball.dur : 900) * kk;
    v3.jump['us:' + st.hitter] = { t0:now + tHit - 380 * kk, dur:760 * kk, h:.55 };
  }
}
function jumpZ(key, now){
  const j = v3.jump[key]; if (!j) return 0;
  const t = (now - j.t0) / j.dur; if (t <= 0 || t >= 1) return 0;
  return j.h * Math.sin(Math.PI * t);
}
function camRoleNow(){
  if (S.cam === 'stand' || S.step === 'rot') return null;
  if (S.cam !== 'dig') return S.cam;
  return (play.dec && play.dec.digger) || 'L';
}
// 第一人稱：慢慢轉頭（最多每秒 80 度），球就在身邊時不突然轉頭
function camera3(now, role, dt, st){
  if (!role){ v3.cam = null; return S.step === 'rot' ? { eye:[4.5, 17.2, 5.6], target:[4.5, 3.2, .3], fov:50 } : { eye:[4.5, 15.2, 4.4], target:[4.5, .6, .8], fov:52 }; }
  const p = posNow(role, now) || play.comp.pos[role];
  const eye = [p[0], p[1], 1.3 + jumpZ('us:' + role, now)];   // 蹲低準備，眼睛大概 1.3 公尺高
  const key = st ? st.key : 'idle';
  let tg;
  if (!st || key === 'read' || key === 'stand') tg = S.step === 'recv' ? [S.serveX, SERVER_Y, 2.4] : [S.attacker.x, S.attacker.y, 2.6];
  else if (ball3.show) tg = [ball3.x, ball3.y, ball3.z];
  else tg = [4.5, -4, 1.4];
  const dx = tg[0] - eye[0], dy = tg[1] - eye[1], dz = tg[2] - eye[2], hd = Math.hypot(dx, dy);
  let yaw = Math.atan2(dx, -dy), pitch = clamp(Math.atan2(dz, Math.max(hd, .4)), -.72, .7);
  if (hd < .7 && v3.cam) yaw = v3.cam.yaw;
  if (!v3.cam) v3.cam = { yaw, pitch };
  let d = yaw - v3.cam.yaw; while (d > Math.PI) d -= 2 * Math.PI; while (d < -Math.PI) d += 2 * Math.PI;
  const kf = 1 - Math.exp(-dt * 3), mx = 1.4 * dt;
  v3.cam.yaw += clamp(d * kf, -mx, mx);
  v3.cam.pitch += clamp((pitch - v3.cam.pitch) * kf, -mx, mx);
  const cy = v3.cam.yaw, cp = v3.cam.pitch;
  return { eye, target:[eye[0] + Math.sin(cy) * Math.cos(cp), eye[1] - Math.cos(cy) * Math.cos(cp), eye[2] + Math.sin(cp)], fov:64 };
}
function poseFor(r, st, p, speed, jz){
  const key = st ? st.key : 'idle', m = (st && st.marks) || {};
  if (jz > .02) return (st && st.hitter === r) ? 'spike' : 'block';
  const near = lim => ball3.show && Math.hypot(ball3.x - p[0], ball3.y - p[1]) < lim;
  if (m.dig === r && near(1.4) && ball3.z < 2.1) return 'dig';
  if ((m.set === r || (key === 'pass' && r === 'S')) && near(1.3) && ball3.z > 1.5) return 'set';
  if (play.comp.blockers.includes(r) && BLOCK_KEYS.includes(key)) return 'blockReady';
  if (speed > .35) return 'run';
  if (S.step === 'rot') return (key === 'atserve' && r === play.server) ? 'serve' : 'stand';
  if (isDefStep() && (key === 'idle' || BLOCK_KEYS.includes(key))) return 'defense';
  return 'ready';
}
function oppPeople(now, st){
  const red = '#be123c', red2 = '#9f1239', out = [], key = st ? st.key : 'idle';
  const add = (id, x, y, pose, color, label, z) => out.push({ id, x, y, z:z || 0, yaw:Math.PI, pose, color, label, h:1.72 });
  if (S.step === 'recv'){
    add('srv', S.serveX, SERVER_Y, key === 'idle' || key === 'stand' ? 'serve' : 'stand', red, '發球');
    const far = [[1.8,-6.2],[4.5,-6.6],[7.2,-6.2]].filter(p => Math.abs(p[0] - S.serveX) > 1.6).slice(0, 2);
    [[1.6,-1.2],[4.5,-1.0],[7.4,-1.2]].concat(far).forEach((p, i) => add('o' + i, p[0], p[1], 'ready', red2));
  } else if (isDefStep()){
    const a = S.attacker, jz = jumpZ('att', now);
    add('att', a.x, a.y, jz > .02 ? 'spike' : 'ready', red, '攻', jz);
    add('os', a.x > 4.5 ? 3.0 : 6.0, -.9, 'ready', red2);
    add('ob', a.x > 4.5 ? .9 : 8.1, -1.7, 'ready', red2);
    [[1.8,-6.2],[4.5,-7.0],[7.2,-6.2]].forEach((p, i) => add('od' + i, p[0], p[1], 'defense', red2));
  } else {
    [[1.6,-4.6],[4.5,-4.3],[7.4,-4.6],[3.0,-7.0],[6.0,-7.0],[6.4,-1.0]].forEach((p, i) => add('or' + i, p[0], p[1], 'ready', red2));
  }
  return out;
}
function clipRect(pts){
  let out = pts.slice();
  const edges = [[p => p[0] >= 0, (a, b) => { const t = (0 - a[0]) / (b[0] - a[0]); return [0, a[1] + (b[1] - a[1]) * t]; }],
                 [p => p[0] <= 9, (a, b) => { const t = (9 - a[0]) / (b[0] - a[0]); return [9, a[1] + (b[1] - a[1]) * t]; }],
                 [p => p[1] >= 0, (a, b) => { const t = (0 - a[1]) / (b[1] - a[1]); return [a[0] + (b[0] - a[0]) * t, 0]; }],
                 [p => p[1] <= 9, (a, b) => { const t = (9 - a[1]) / (b[1] - a[1]); return [a[0] + (b[0] - a[0]) * t, 9]; }]];
  for (const [inside, cut] of edges){
    const src = out; out = [];
    for (let i = 0; i < src.length; i++){
      const a = src[i], b = src[(i + 1) % src.length];
      if (inside(a)) out.push(a);
      if (inside(a) !== inside(b)) out.push(cut(a, b));
    }
    if (!out.length) break;
  }
  return out;
}
function zones3(){
  const st = play.steps[play.i];
  if (!isDefStep() || (st && !BLOCK_KEYS.includes(st.key)) || !play.comp) return null;
  const z = attackZones(S.attacker, play.comp), dk = darkMQ.matches;
  const out = [{ pts:z.spike, color: dk ? [.98, .44, .52, .2] : [.88, .11, .28, .16], fill: dk ? 'rgba(251,113,133,.22)' : 'rgba(225,29,72,.16)' },
               { pts:z.band, color:[.85, .47, .02, .26], fill:'rgba(217,119,6,.26)' }];
  if (z.shadow){ const c = clipRect(z.shadow); if (c.length > 2) out.push({ pts:c, color:[.85, .47, .02, .42], fill:'rgba(217,119,6,.42)' }); }
  return out;
}
function frame3(now){
  v3.raf = requestAnimationFrame(frame3);
  if (document.hidden || !v3.r || !play.comp) return;
  const dt = v3.last ? Math.min(.1, (now - v3.last) / 1000) : 1 / 60; v3.last = now;
  const comp = play.comp, st = play.steps[play.i] || null, lu = (st && st.lu) || comp.lu;
  const role = camRoleNow();
  const people = [];
  for (const r of ROLES){
    const p = posNow(r, now) || comp.pos[r], q = v3.prev[r] || p;
    const mv = Math.hypot(p[0] - q[0], p[1] - q[1]); v3.prev[r] = p.slice();
    v3.phase[r] = (v3.phase[r] || 0) + mv * 6;
    const jz = jumpZ('us:' + r, now);
    people.push({ id:'us:' + r, x:p[0], y:p[1], z:jz, h:1.7, yaw:(faceAng[r] || 0) * Math.PI / 180, pose:poseFor(r, st, p, mv / Math.max(dt, 1e-3), jz), phase:v3.phase[r],
      color:v3.colors[groupOf(r, lu)], label: curTags[r] || ROLE_INFO[r].tok, labelDim: !curTags[r],
      tagBg: curTags[r] ? 'rgba(28,31,35,.92)' : 'rgba(28,31,35,.6)', arms: jz > .05, hidden: role === r });
  }
  for (const o of oppPeople(now, st)) people.push(o);
  const mk = st && st.marks && st.marks.target;
  const ball = ball3.show ? { x:ball3.x, y:ball3.y, z:ball3.z, spin:now / 150 } : null;
  const near = role && ball && Math.hypot(ball.x - (posNow(role, now) || comp.pos[role])[0], ball.y - (posNow(role, now) || comp.pos[role])[1]) < 1.6 && ball.z < 2;
  const scene = { camera:camera3(now, role, dt, st), people: v3.gl ? people : people.filter(p => !p.hidden), ball,
    dark:darkMQ.matches, zones:zones3(), target: mk ? (mk === 'fix' ? FIX_T : rt()) : null,
    hud:(role ? `第一人稱：${ROLE_INFO[role].name}的眼睛` : '看台視角') + '・慢動作',
    arms: role ? { on:true, pose: near ? 'platform' : 'ready', at: near ? [ball.x, ball.y, ball.z] : null, color:v3.colors[groupOf(role, lu)] } : null };
  v3.r.render(scene);
}
function makeRenderer(){
  try{ const r = window.VBGL ? VBGL.create(cv, lbl) : null; if (r){ v3.gl = true; return r; } }catch(e){ /* 這台不能用 WebGL：改用簡單的畫法 */ }
  v3.gl = false;
  return VB3D.create(lbl);
}
function set3D(on, silent){
  v3.on = !!on; S.view = on ? '3d' : '2d'; if (!silent) saveSettings();
  cv.hidden = !on; lbl.hidden = !on;
  svg.classList.toggle('is-hidden', !!on);
  $('camPick').hidden = !on;
  document.querySelectorAll('.seg-view button').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.view === S.view)));
  $('camSel').value = S.cam;
  updateLegend();
  cancelAnimationFrame(v3.raf);
  if (on){
    if (!v3.r) v3.r = makeRenderer();
    v3.colors = colors3(); v3.cam = null; v3.last = 0;
    hideHint();
    requestAnimationFrame(() => { v3.r.resize(); cancelAnimationFrame(v3.raf); v3.raf = requestAnimationFrame(frame3); });
  } else if (screen === 'main') showHint();
}
function updateLegend(shown){
  if (shown != null) legendShown = shown;
  $('legend').hidden = !(isDefStep() && legendShown && !v3.on);
}

/* ---------- 畫面 ---------- */
const SCREENS = ['home', 'main', 'know'];
let screen = 'home';
const histOK = (() => { try{ history.replaceState({ s:'home' }, ''); return true; }catch(e){ return false; } })();
function showScreen(id, push){
  closeAllSheets(true);
  screen = id;
  for (const s of SCREENS) $(s).hidden = s !== id;
  sess.set(KEY.screen, id);
  if (push && histOK){ try{ history.pushState({ s:id }, ''); }catch(e){} }
  if (id === 'main'){
    layout(); refreshStepUI(); refreshSitUI();
    document.body.classList.toggle('mode-free', S.mode === 'free' && isDefStep());
    resetPlay(false, 0); showHint();
    set3D(S.view === '3d', true);
    requestAnimationFrame(applyK);
  } else cancelAnimationFrame(v3.raf);
  window.scrollTo(0, 0);
}
function setStep(step){
  if (!STEPS.includes(step)) return;
  if (S.step === step){ refreshStepUI(); return; }
  S.step = step;
  if (isDefStep()) S.attackType = step;
  document.body.classList.toggle('mode-free', S.mode === 'free' && isDefStep());
  saveSettings(); hideHint();
  resetPlay(false, 350);
  refreshStepUI(); refreshSitUI(); showHint();
  if (v3.on) v3.cam = null;
}
function rotate(dir){
  const prev = rotInfo();
  const i = ROT_ORDER.indexOf(S.rot);
  S.rot = ROT_ORDER[(i + dir + 6) % 6];
  remapTokens(prev, rotInfo());
  saveSettings();
  if (S.step === 'rot') markHintSeen();
  resetPlay(false, S.step === 'rot' || S.step === 'recv' ? 500 : 300);
  refreshStepUI(); refreshSitUI();
}
function setMode(m, silent){
  S.mode = m;
  document.body.classList.toggle('mode-free', m === 'free' && isDefStep());
  if (m === 'free' && !custom){ custom = clonePos(compute(S.attacker).pos); saveCustom(); }
  if (!silent) saveSettings();
  if (m === 'free') hideHint();
  resetPlay(false, silent ? 0 : 350);
  refreshStepUI(); refreshSitUI();
  if (m === 'learn') showHint();
}
function nextLesson(){
  const last = play.steps.length && play.i >= play.steps.length - 1;
  if (S.step === 'rot') return 'recv';
  if (S.step === 'recv' && last) return 'spike';
  if (S.step === 'spike' && last) return 'tip';
  return null;
}
function updateNextLesson(){
  const n = nextLesson();
  document.querySelectorAll('#stepper button').forEach(b => b.classList.toggle('next', b.dataset.step === n));
}
function refreshStepUI(){
  document.querySelectorAll('#stepper button').forEach((b, i) => { const on = b.dataset.step === S.step; b.setAttribute('aria-current', on ? 'step' : 'false'); b.querySelector('.sn').textContent = on ? '✓' : String(i + 1); });
  const def = isDefStep();
  $('btnFreeToggle').hidden = !def;
  $('btnFreeToggle').setAttribute('aria-pressed', String(def && S.mode === 'free'));
  $('btnResetFree').hidden = !(def && S.mode === 'free');
  $('stepbtns').hidden = false;
  const R = rotInfo();
  $('rotNum').textContent = `第 ${rotIndex()} 輪`;
  $('rotSub').textContent = `舉在 ${R.roleZone.S} 號位`;
  document.body.dataset.step = S.step;
  $('mainTitle').textContent = STEP_NAME[S.step];
  updateNextLesson();
}
const mqWide = window.matchMedia('(orientation: landscape) and (min-width: 600px), (min-width: 980px)');
function layout(){ applyK(); if (v3.on && v3.r) v3.r.resize(); }
function sitSummary(){
  const sys = VBRot.SYSTEMS[S.system].short, rf = VBRot.FORMS[S.recv].short;
  if (S.step === 'rot') return sys;
  if (S.step === 'recv') return `${sys}・${rf}接發`;
  return `${sys}・${FORM_NAME[S.formation]}・${blockSummary()}`;
}
function rName(){ return setterBack() ? '舉對' : '舉球員'; }
function blockSummary(){
  const names = []; if (S.canOH) names.push('大砲'); if (S.canMB) names.push('攔中'); if (S.canR) names.push(rName());
  let s = !names.length ? '沒人攔' : (names.length === 3 ? '三人都會攔' : (names.length === 1 ? `只有${names[0]}攔` : `${names.join('、')}會攔`));
  if (S.canMB && S.mbLate) s += '・攔中來不及';
  return s;
}
function blockDesc(){
  if (!S.canOH && !S.canMB && !S.canR) return '沒人攔網：前排三個人平均分開、離網兩公尺左右，後排站深。';
  const parts = [];
  if (!S.canOH) parts.push('大砲不攔：對方從左邊打時退下來守吊球');
  if (!S.canMB) parts.push('攔中不攔：退到三米線附近守中間的吊球');
  else if (S.mbLate) parts.push('攔中來不及：對方打邊線時只有邊上的人攔，攔中不要硬跳，退下來守吊球');
  if (!S.canR) parts.push(S.formation === 'ours' ? '舉球員、舉對不攔：舉球員守 2 號位的短球，長一點的給後面的舉對' : `${rName()}不攔：對方從右邊打時退下來守吊球`);
  return parts.length ? parts.join('；') + '。' : '能攔的人都攔，邊線兩人攔、中間攔中加旁邊的人。';
}
function refreshSitUI(){
  $('sitText').textContent = sitSummary();
  document.querySelectorAll('.chips[data-key]').forEach(c => {
    const key = c.dataset.key; if (key === 'mbLate') return;
    c.querySelectorAll('button').forEach(b => b.setAttribute('aria-pressed', String(String(S[key]) === b.dataset.v)));
  });
  $('sysDesc').textContent = VBRot.SYSTEMS[S.system].desc;
  $('recvDesc').textContent = VBRot.FORMS[S.recv].desc + (S.recv === 'team' && S.system !== '51' ? '（現在是雙輔舉／雙舉，先用五人 W。）' : '');
  $('formDesc').textContent = FORM_DESC[S.formation] + (S.formation === 'ours' && !setterBack() ? '（這一輪舉球員在前排，本來就在網前，跟心後一樣。）' : '');
  document.querySelectorAll('.chips-multi button').forEach(b => b.setAttribute('aria-pressed', String(!!S[b.dataset.k])));
  $('chipR').textContent = rName();
  $('blockDesc').textContent = blockDesc();
  $('blockResDesc').textContent = BLOCKRES_DESC[S.blockRes];
  document.querySelectorAll('#modeChips button').forEach(b => b.setAttribute('aria-pressed', String((b.dataset.v === 'team') === simple)));
  $('modeDesc').textContent = simple ? '隊員版：只有隊上的站法和自己擺，設定只留常用的幾項。' : '教練版：可以換進攻系統、接發球隊形、防守隊形、誰會攔網。傳給隊員時用下面的按鈕，她們打開就是隊員版。';
  $('flowDesc').textContent = S.flow === 'step' ? '每一步停下來讓你看說明，再自動播下一步。' : '球在空中不停下來，像真的比賽；想看每一步的說明，按暫停或用 ‹ › 前後看。';
  document.querySelectorAll('.chips[data-key="mbLate"] button').forEach(b => { b.setAttribute('aria-pressed', String((S.mbLate ? '1' : '0') === b.dataset.v)); b.setAttribute('aria-disabled', String(!S.canMB)); });
}
function onChip(key, v){
  const prev = { canOH:S.canOH, canMB:S.canMB, canR:S.canR };
  if (key === 'mbLate'){ if (!S.canMB){ toast('攔中設定成不攔網，不用選這一項'); return; } S.mbLate = v === '1'; }
  else if (key === 'libero') S.libero = +v;
  else if (key === 'radius') S.radius = +v;
  else if (key.startsWith('can')) S[key] = !S[key];
  else if (key === 'useLib') S.useLib = v === 'true';
  else S[key] = v;
  let msg = null;
  saveSettings(); refreshSitUI(); refreshStepUI();
  resetPlay(false, 400);
  if (msg) toast(msg, '復原', () => { Object.assign(S, prev); saveSettings(); refreshSitUI(); resetPlay(false, 400); });
}

function setSimple(on){
  if (simple === on) return;
  simple = on; store.set(KEY.simple, on); applySimple(); DIAG = null;
  saveSettings(); refreshSitUI(); refreshStepUI(); resetPlay(false, 400);
  toast(on ? '換成隊員版：只留隊上的站法和自己擺' : '換成教練版：所有選項都打開了');
}
function shareTeamLink(){
  const url = location.origin + location.pathname + '?team=1&openExternalBrowser=1';
  const done = () => toast('已複製隊員版連結，可以貼到 LINE 群組');
  if (navigator.share){ navigator.share({ title:'排球站位教室（隊員版）', text:'隊上的站法：輪轉、接發球、防守，可以自己擺站位', url }).catch(() => {}); return; }
  if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(url).then(done, () => toast(url, null, null, 8000));
  else toast(url, null, null, 8000);
}

/* ---------- 底部（或側邊）面板、說明 ---------- */
const overlayStack = [];
function detOpen(){ return !$('detSheet').hidden; }
function openSheet(id){
  const sh = $(id); if (!sh.hidden) return;
  sh.hidden = false; sh.classList.add('closing'); sh.getBoundingClientRect(); sh.classList.remove('closing');
  if (id === 'sitSheet'){ document.documentElement.style.setProperty('--sheet-h', `${Math.ceil(sh.getBoundingClientRect().height)}px`); document.body.classList.add('sit-open'); requestAnimationFrame(layout); }
  overlayStack.push(id);
  if (histOK){ try{ history.pushState({ s:screen, ov:id }, ''); }catch(e){} }
  const f = sh.querySelector('[data-close]'); if (f) setTimeout(() => f.focus({ preventScroll:true }), 50);
}
function closeSheet(id, noHist){
  const sh = $(id); if (sh.hidden) return;
  const i = overlayStack.lastIndexOf(id); if (i >= 0) overlayStack.splice(i, 1);
  sh.classList.add('closing');
  if (id === 'sitSheet'){ document.body.classList.remove('sit-open'); requestAnimationFrame(layout); }
  const done = () => { sh.hidden = true; sh.classList.remove('closing'); sh.style.transform = ''; };
  if (reduceMotion.matches) done(); else setTimeout(done, 230);
  if (!noHist && histOK && history.state && history.state.ov === id){ ignorePop = true; try{ history.back(); }catch(e){ ignorePop = false; } }
}
function openOverlay(id){
  const o = $(id); if (!o.hidden) return;
  o.hidden = false; overlayStack.push(id);
  if (histOK){ try{ history.pushState({ s:screen, ov:id }, ''); }catch(e){} }
  lastFocus = document.activeElement;
  const f = o.querySelector('[data-close], #helpClose'); if (f) setTimeout(() => f.focus({ preventScroll:true }), 50);
}
let lastFocus = null, ignorePop = false;
function closeOverlay(id, noHist){
  const o = $(id); if (o.hidden) return;
  const i = overlayStack.lastIndexOf(id); if (i >= 0) overlayStack.splice(i, 1);
  o.hidden = true; const card = o.querySelector('.ov-card'); if (card) card.style.transform = '';
  if (!noHist && histOK && history.state && history.state.ov === id){ ignorePop = true; try{ history.back(); }catch(e){ ignorePop = false; } }
  if (lastFocus && lastFocus.focus) try{ lastFocus.focus({ preventScroll:true }); }catch(e){}
}
function closeTop(noHist){
  const id = overlayStack[overlayStack.length - 1]; if (!id) return false;
  if (id === 'help' && !$('helpTopic').hidden){ showHelpToc(); if (noHist && histOK){ try{ history.pushState({ s:screen, ov:'help' }, ''); }catch(e){} } return true; }
  if ($(id).classList.contains('sheet')) closeSheet(id, noHist); else closeOverlay(id, noHist);
  return true;
}
function closeAllSheets(){ while (overlayStack.length){ const id = overlayStack.pop(); const n = $(id); n.hidden = true; n.classList.remove('closing'); } document.body.classList.remove('sit-open'); }
window.addEventListener('popstate', () => {
  if (ignorePop){ ignorePop = false; return; }
  if (overlayStack.length){ closeTop(true); return; }
  if (screen !== 'home'){ showScreen('home', false); }
});
document.addEventListener('keydown', e => {
  if (e.key === 'Escape'){
    if (overlayStack.length){ e.preventDefault(); closeTop(false); }
  }
  if (!$('help').hidden && helpTopic){
    if (e.key === 'ArrowRight') helpGo(helpIdx + 1);
    if (e.key === 'ArrowLeft') helpGo(helpIdx - 1);
  }
});
// 往下滑關掉（把手、標題列；內容捲到最上面時也可以）
function swipeClose(container, handles, scrollEl, onClose){
  let st = null;
  const down = e => {
    if (e.pointerType === 'mouse') return;
    if (scrollEl && e.currentTarget === scrollEl && scrollEl.scrollTop > 0) return;
    st = { y:e.clientY, x:e.clientX, id:e.pointerId, dir:null, dy:0, t:performance.now() };
  };
  const move = e => {
    if (!st || e.pointerId !== st.id) return;
    const dy = e.clientY - st.y, dx = e.clientX - st.x;
    if (!st.dir){ if (Math.abs(dy) < 8 && Math.abs(dx) < 8) return; st.dir = Math.abs(dy) > Math.abs(dx) ? (dy > 0 ? 'down' : 'up') : 'side'; }
    if (st.dir !== 'down'){ st = null; return; }
    st.dy = Math.max(0, dy); container.classList.add('dragging'); container.style.transform = `translateY(${st.dy}px)`;
  };
  const up = () => {
    if (!st) return; const s = st; st = null;
    container.classList.remove('dragging');
    const fast = s.dy > 40 && (s.dy / (performance.now() - s.t)) > .5;
    if (s.dir === 'down' && (s.dy > 90 || fast)){ container.style.transform = ''; onClose(); }
    else container.style.transform = '';
  };
  for (const h of handles.concat(scrollEl ? [scrollEl] : [])){
    if (!h) continue;
    h.addEventListener('pointerdown', down);
    h.addEventListener('pointermove', move);
    h.addEventListener('pointerup', up);
    h.addEventListener('pointercancel', up);
  }
}

/* ---------- 每個人在做什麼 ---------- */
function renderDetail(){
  const comp = play.comp || currentComp();
  const st = play.steps[play.i], lu = (st && st.lu) || comp.lu;
  const ul = $('detList'); ul.innerHTML = '';
  for (const r of ROLES){
    const li = document.createElement('li');
    const who = document.createElement('span'); who.className = 'who'; who.style.background = GROUP_COLOR[groupOf(r, lu)];
    who.textContent = `${ROLE_INFO[r].name}・${lu[r].zone}`;
    const tx = document.createElement('span'); tx.textContent = curNotes[r] || '';
    li.append(who, tx); ul.appendChild(li);
  }
}

/* ---------- 使用說明、站位圖解（同一個左右切換的視窗） ---------- */
const HELP = [
  { id:'screen', title:'看懂畫面', cards:[
    { img:'help/screen-1.webp', h:'上面是對方，下面是我們', p:'上面淺色的是對方場地，粗黑線是網子，下面是我們的場地。淡淡的大數字是號位：網前 4、3、2，後排 5、6、1。' },
    { img:'help/screen-2.webp', h:'圓點是球員', p:'圓點裡寫角色：舉球、攔中、大砲、舉對、自由。顏色：前排藍、後排綠、舉球員橘、自由紫。右上的小數字是她現在的號位，圓點外的小三角形是她面向哪裡。' },
    { img:'help/screen-3.webp', h:'照 1～4 的順序學', p:'上面的「1 輪轉、2 接發球、3 防扣球、4 防吊球」是學習順序。一課看完，下一課的按鈕會出現小圓點。' },
  ]},
  { id:'rot', title:'1 輪轉站位', cards:[
    { img:'help/rot-1.webp', h:'每一輪誰站哪裡', p:'6 個人站在這一輪的號位。下面的說明寫出前排、後排是誰，舉球員在幾號位。' },
    { img:'help/rot-2.webp', h:'按 ↻ 換下一輪', p:'按輪次旁邊的 ↻，大家順時針轉一格（2→1→6→5→4→3），轉到 1 號位的人發球。後排的攔中會換成自由（攔中發球時除外）。' },
    { img:'help/rot-3.webp', h:'按 ▶ 看我們發球怎麼換位', p:'按播放：發球員走到底線後面，其他人先站到方便換位的地方（紅色箭頭是要換去的位置），發球一出手就換到防守位置。選「隊上的站法」時，照教練畫的圖。' },
    { coach:true, img:'help/sit-1.webp', h:'換單舉、雙輔舉、雙舉', p:'點下面的「設定」，選進攻系統和接發球隊形。「隊上的站法」是教練畫的單舉；學姐跑雙輔舉時，切換一下就能看怎麼站。' },
  ]},
  { id:'recv', title:'2 接發球', cards:[
    { img:'help/recv-1.webp', h:'發球前怎麼站', p:'標「不接」的人不接發球。細虛線連起來的兩個人，發球那一刻不能前後或左右交換（站位規則）；有箭頭的虛線是舉球員發球後要跑的路線。圈圈是每個接發球的人負責的範圍。' },
    { img:'help/recv-2.webp', h:'拖球看誰接發球', p:'把黃色的球拖到我們的場地（或直接點），會看到誰接、旁邊的人怎麼讓開、舉球員跑去哪裡。上面紅色的「發」可以左右拖，換發球的位置。' },
    { img:'help/recv-3.webp', h:'接起來之後', p:'自動播放：接發球 → 傳到舉球員 → 舉球・保護 → 換到防守位置。說明會寫出怎麼移動、哪隻腳在前、怎麼接。' },
  ]},
  { id:'learn', title:'3～4 防扣球、防吊球', cards:[
    { img:'help/learn-1.webp', h:'紅色和橘色斜線', p:'紅色是扣球打得到的地方，橘色斜線是只能吊球的地方：攔網擋住的陰影，和網子前面扣球打不到的地方。攔網的人越多，紅色越少。' },
    { img:'help/learn-2.webp', h:'拖紅色的「攻」', p:'紅色的「攻」是對方的攻擊手。拖到左邊、中間、右邊，我們的人會跟著換到防守位置，攔網也會跟過去。' },
    { img:'help/learn-3.webp', h:'拖球看誰接、為什麼', p:'把黃球拖到我們場上放開（也可以直接點）。接球的人標「接」，跟到她後面的人標「補位」。說明會寫出為什麼是她、怎麼接，還有依據。' },
    { img:'help/learn-4.webp', h:'一步一步看接起來之後', p:'自動播放：接球 → 送到舉球位置 → 舉球・保護 → 回防。球在空中時不會停下來；想看每一步的說明，按暫停或用 ‹ › 前後看（設定也可以改成每一步停下來）。「每個人在做什麼」列出這一步每個人的工作。' },
  ]},
  { id:'view3d', title:'立體畫面', cards:[
    { img:'help/3d-1.webp', h:'切到「立體」', p:'球場右上角切到「立體」，可以看到攔網跳起來、球怎麼飛、大家往哪裡跑。點地板，球就會打到那裡。' },
    { img:'help/3d-2.webp', h:'用接球的人的眼睛看', p:'「視角」選「接球的人」，就是用接這一球的人的眼睛看出去：扣球會慢慢飛過來、越來越大，最後接進自己的雙手。立體畫面會自動放慢。也可以固定看某一個人，或選看台。' },
  ]},
  { id:'situation', title:'設定', cards:[
    { img:'help/sit-1.webp', h:'點「設定」打開', p:'手機直放時，設定從下面打開，上面的球場還看得到；手機橫放、平板橫放和電腦，設定從右邊打開。改了馬上看得到結果。' },
    { coach:true, img:'help/sit-2.webp', h:'誰會攔網、攔網碰到球', p:'「誰會攔網」可以複選；隊上舉球員、舉對不攔，所以只勾大砲和攔中。「攔網碰到球的時候」預設是碰手變小球，可以看攔網後面誰去接；也可以選攔死或沒攔到。' },
  ]},
  { id:'free', title:'自己擺站位', cards:[
    { img:'help/free-1.webp', h:'按「自己擺」', p:'在「3 防扣球」或「4 防吊球」按「自己擺」，6 個人都可以拖。前排拉到網前就算攔網，後排拉到網前也不能攔。' },
    { img:'help/free-2.webp', h:'看圈圈有沒有空檔', p:'圈圈一樣大。沒有圈圈蓋到的地方就是空檔；兩個圈重疊的地方，要先講好誰接。' },
    { img:'help/free-3.webp', h:'擺好再拖球試試', p:'擺好後一樣可以拖球，看誰會去接。站位會自動存起來；按「回到隊形」可以重來。' },
  ]},
  { id:'install', title:'安裝到手機', cards:[
    { art:'ios', h:'iPhone、iPad', p:'用 Safari 打開這個網頁 → 點下方的「分享」（方框加向上箭頭）→「加入主畫面」。之後從主畫面打開，沒有網路也能用。' },
    { art:'android', h:'Android', p:'用 Chrome 打開 → 點右上角「⋮」→「安裝應用程式」或「加到主畫面」。' },
    { art:'pc', h:'電腦、Chromebook', p:'用 Chrome 或 Edge 打開 → 網址列右邊的安裝圖示 → 安裝。Mac 的 Safari：檔案 →「加入 Dock」。' },
    { art:'line', h:'從 LINE 打開的時候', p:'LINE 裡面的瀏覽器不能安裝。點右上角的選單，選「用預設瀏覽器開啟」，再照上面的方法安裝。' },
  ]},
];
const HELP_ART = {
  ios:'<svg viewBox="0 0 160 120" aria-hidden="true"><rect x="45" y="6" width="70" height="108" rx="12" fill="none" stroke="currentColor" stroke-width="4"/><path d="M80 52V30M71 39l9-9 9 9" fill="none" stroke="currentColor" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/><rect x="66" y="46" width="28" height="26" rx="4" fill="none" stroke="currentColor" stroke-width="4"/><rect x="58" y="86" width="44" height="14" rx="5" fill="currentColor" opacity=".25"/></svg>',
  android:'<svg viewBox="0 0 160 120" aria-hidden="true"><rect x="45" y="6" width="70" height="108" rx="12" fill="none" stroke="currentColor" stroke-width="4"/><circle cx="103" cy="22" r="3.2" fill="currentColor"/><circle cx="103" cy="32" r="3.2" fill="currentColor"/><circle cx="103" cy="42" r="3.2" fill="currentColor"/><rect x="58" y="86" width="44" height="14" rx="5" fill="currentColor" opacity=".25"/></svg>',
  pc:'<svg viewBox="0 0 160 120" aria-hidden="true"><rect x="22" y="14" width="116" height="74" rx="8" fill="none" stroke="currentColor" stroke-width="4"/><path d="M10 100h140" stroke="currentColor" stroke-width="5" stroke-linecap="round"/><rect x="30" y="22" width="100" height="12" rx="4" fill="currentColor" opacity=".25"/><path d="M118 25v6M115 28l3 3 3-3" stroke="currentColor" stroke-width="2.5" fill="none" stroke-linecap="round"/></svg>',
  line:'<svg viewBox="0 0 160 120" aria-hidden="true"><rect x="45" y="6" width="70" height="108" rx="12" fill="none" stroke="currentColor" stroke-width="4"/><rect x="52" y="16" width="56" height="14" rx="4" fill="currentColor" opacity=".25"/><path d="M96 56h12M96 64h12M96 72h12" stroke="currentColor" stroke-width="4" stroke-linecap="round"/></svg>',
};
let cardSet = 'help', helpTopic = null, helpIdx = 0, DIAG = null;
function diagApi(){
  return {
    S, ROLES, ROLE_INFO, groupOf, rt, TARGET, ZC, HIT, GROUP_COLOR, setLibOff, useLib:() => S.useLib,
    defense(set, attacker){
      const keys = ['formation','canOH','canMB','canR','mbLate','libero','rot','system'], keep = {};
      for (const k2 of keys) keep[k2] = S[k2];
      Object.assign(S, { system:'51', rot:1, formation:'up', canOH:true, canMB:true, canR:true, mbLate:false, libero:5 }, set || {});
      try{ return compute(attacker || { x:8.2, y:-1.3 }); } finally { Object.assign(S, keep); }
    },
    zones(att, comp){ return attackZones(att, comp); },
    cover(H){ return coverSpots(H); },
  };
}
const COACH_TOPICS = ['recvforms', 'r51', 'r62', 'r42', 'defense'];
function cardTopics(){
  if (cardSet !== 'diag') return simple ? HELP.map(t => Object.assign({}, t, { cards:t.cards.filter(c => !c.coach) })).filter(t => t.cards.length) : HELP;
  if (!DIAG) DIAG = VBDiag.topics(diagApi());
  return simple ? DIAG.filter(t => !COACH_TOPICS.includes(t.id)) : DIAG;
}
function buildHelpToc(){
  const toc = $('helpToc'); toc.innerHTML = '';
  if (cardSet === 'diag'){ const p = document.createElement('p'); p.className = 'toc-lead'; p.textContent = '專業隊伍常用的站位方案，先看圖了解，再到練習畫面拖拖看。'; toc.appendChild(p); }
  for (const t of cardTopics()){
    const b = document.createElement('button'); b.className = 'card-link';
    b.innerHTML = `<span class="cl-text"><b></b><small></small></span><span class="cl-go">打開 ›</span>`;
    b.querySelector('b').textContent = t.title; b.querySelector('small').textContent = t.sub ? `${t.sub}・${t.cards.length} 張` : `${t.cards.length} 張`;
    b.addEventListener('click', () => openHelpTopic(t.id, 0));
    toc.appendChild(b);
  }
}
function openCards(set, topicId){
  cardSet = set; if (set === 'diag') DIAG = null; buildHelpToc();
  openOverlay('help');
  if (topicId) openHelpTopic(topicId, 0); else showHelpToc();
}
function openHelp(topicId){ openCards('help', topicId); }
function showHelpToc(){
  helpTopic = null;
  $('helpToc').hidden = false; $('helpTopic').hidden = true; $('helpBack').style.visibility = 'hidden';
  $('helpTitle').textContent = cardSet === 'diag' ? '站位圖解' : '使用說明';
  $('helpToc').scrollTop = 0;
}
function openHelpTopic(id, idx){
  const t = cardTopics().find(x => x.id === id); if (!t) return;
  helpTopic = t;
  $('helpToc').hidden = true; $('helpTopic').hidden = false; $('helpBack').style.visibility = 'visible';
  $('helpTitle').textContent = t.title;
  const tr = $('helpTrack'); tr.innerHTML = '';
  for (const c of t.cards){
    const d = document.createElement('div'); d.className = 'hcard';
    if (c.img){
      const box = document.createElement('div'); box.className = 'shot-box';
      const im = document.createElement('img'); im.className = 'shot'; im.loading = 'lazy'; im.alt = c.h; im.src = c.img; im.decoding = 'async';
      im.onerror = () => { box.remove(); };
      box.appendChild(im); d.appendChild(box);
    } else if (c.art){ const a = document.createElement('div'); a.className = 'art'; a.innerHTML = HELP_ART[c.art]; d.appendChild(a); }
    else if (c.svg){ const a = document.createElement('div'); a.className = 'diag-box'; try{ a.innerHTML = c.svg(); }catch(err){ a.textContent = '這張圖畫不出來'; } d.appendChild(a); }
    const h = document.createElement('h3'); h.textContent = c.h; d.appendChild(h);
    const p = document.createElement('p'); p.textContent = c.p; d.appendChild(p);
    if (c.src){ const s = document.createElement('p'); s.className = 'src'; s.textContent = c.src; d.appendChild(s); }
    tr.appendChild(d);
  }
  helpGo(idx || 0, true);
}
function helpGo(i, instant){
  if (!helpTopic) return;
  helpIdx = clamp(i, 0, helpTopic.cards.length - 1);
  const tr = $('helpTrack');
  if (instant){ tr.classList.add('dragging'); }
  tr.style.transform = `translateX(${-helpIdx * 100}%)`;
  if (instant){ tr.getBoundingClientRect(); tr.classList.remove('dragging'); }
  $('helpCount').textContent = `${helpIdx + 1} / ${helpTopic.cards.length}`;
  const last = helpIdx >= helpTopic.cards.length - 1;
  $('helpPrev').setAttribute('aria-disabled', String(helpIdx === 0));
  $('helpNext').textContent = last ? '完成' : '下一張 ›';
}
function helpSwipe(){
  const vp = $('helpViewport'), tr = $('helpTrack');
  let st = null;
  vp.addEventListener('pointerdown', e => { st = { x:e.clientX, y:e.clientY, id:e.pointerId, dir:null, dx:0 }; });
  vp.addEventListener('pointermove', e => {
    if (!st || e.pointerId !== st.id) return;
    const dx = e.clientX - st.x, dy = e.clientY - st.y;
    if (!st.dir){ if (Math.abs(dx) < 8 && Math.abs(dy) < 8) return; st.dir = Math.abs(dx) > Math.abs(dy) ? 'x' : 'y'; if (st.dir === 'x') try{ vp.setPointerCapture(e.pointerId); }catch(err){} }
    if (st.dir !== 'x') return;
    st.dx = dx; tr.classList.add('dragging');
    tr.style.transform = `translateX(calc(${-helpIdx * 100}% + ${dx}px))`;
  });
  const end = () => {
    if (!st) return; const s = st; st = null; tr.classList.remove('dragging');
    if (s.dir === 'x'){ const w = vp.clientWidth || 1; if (s.dx < -w * .18) helpGo(helpIdx + 1); else if (s.dx > w * .18) helpGo(helpIdx - 1); else helpGo(helpIdx); }
  };
  vp.addEventListener('pointerup', end); vp.addEventListener('pointercancel', end);
}
function helpTopicForStep(){
  if (v3.on) return 'view3d';
  if (S.step === 'rot') return 'rot';
  if (S.step === 'recv') return 'recv';
  return S.mode === 'free' ? 'free' : 'learn';
}

/* ---------- 小提示 ---------- */
let toastTimer = 0;
function toast(text, actLabel, actFn, ms){
  const t = $('toast'); $('toastText').textContent = text;
  const b = $('toastAct');
  if (actLabel){ b.hidden = false; b.textContent = actLabel; b.onclick = () => { t.hidden = true; actFn && actFn(); }; } else b.hidden = true;
  t.hidden = false; clearTimeout(toastTimer); toastTimer = setTimeout(() => { t.hidden = true; }, ms || (actLabel ? 5000 : 2600));
}

/* ---------- 綁定 ---------- */
function goHome(kind){ if (histOK && history.state && history.state.s === kind){ try{ history.back(); return; }catch(e){} } showScreen('home', false); }
function bind(){
  $('btnStart').addEventListener('click', () => showScreen('main', true));
  $('btnFree').addEventListener('click', () => {
    if (!isDefStep()){ S.step = 'spike'; S.attackType = 'spike'; }
    S.mode = 'free'; if (!custom){ custom = clonePos(compute(S.attacker).pos); saveCustom(); }
    saveSettings(); showScreen('main', true);
  });
  $('btnDiag').addEventListener('click', () => openCards('diag'));
  $('btnKnow').addEventListener('click', () => showScreen('know', true));
  $('btnHelpHome').addEventListener('click', () => openHelp(null));
  $('btnReport').addEventListener('click', () => openOverlay('report'));
  $('btnMainHome').addEventListener('click', () => goHome('main'));
  $('btnKnowHome').addEventListener('click', () => goHome('know'));
  $('btnMainHelp').addEventListener('click', () => openHelp(helpTopicForStep()));
  $('btnKnowHelp').addEventListener('click', () => openHelp('screen'));
  $('btnKnowDiag').addEventListener('click', () => openCards('diag'));
  document.querySelectorAll('#stepper button').forEach(b => b.addEventListener('click', () => setStep(b.dataset.step)));
  $('btnRotPrev').addEventListener('click', () => rotate(-1));
  $('btnRotNext').addEventListener('click', () => rotate(1));
  $('btnFreeToggle').addEventListener('click', () => setMode(S.mode === 'free' ? 'learn' : 'free'));
  $('btnResetFree').addEventListener('click', () => {
    const old = custom ? clonePos(custom) : null;
    custom = clonePos(compute(S.attacker).pos); saveCustom();
    resetPlay(false, 350);
    toast('已回到隊形站位', '復原', () => { if (old){ custom = old; saveCustom(); resetPlay(false, 350); } });
  });
  document.querySelectorAll('.seg-view button').forEach(b => b.addEventListener('click', () => { if ((b.dataset.view === '3d') !== v3.on) set3D(b.dataset.view === '3d'); }));
  $('camSel').addEventListener('change', e => { if (CAMS.includes(e.target.value)){ S.cam = e.target.value; saveSettings(); v3.cam = null; } });
  document.querySelectorAll('.chips[data-key]').forEach(c => c.querySelectorAll('button').forEach(b => b.addEventListener('click', () => onChip(c.dataset.key, b.dataset.v))));
  document.querySelectorAll('#modeChips button').forEach(b => b.addEventListener('click', () => setSimple(b.dataset.v === 'team')));
  $('btnShareTeam').addEventListener('click', shareTeamLink);
  document.querySelectorAll('.chips-multi button').forEach(b => b.addEventListener('click', () => onChip(b.dataset.k)));
  $('btnSit').addEventListener('click', () => openSheet('sitSheet'));
  $('btnDetail').addEventListener('click', () => { renderDetail(); openSheet('detSheet'); });
  $('btnStance').addEventListener('click', () => { closeSheet('detSheet'); openCards('diag', 'stance'); });
  $('btnHintOk').addEventListener('click', () => { markHintSeen(); showIdleCaption(play.comp || currentComp()); });
  $('btnPlay').addEventListener('click', onPlay);
  $('btnPrev').addEventListener('click', onPrev);
  $('btnNext').addEventListener('click', onNext);
  document.querySelectorAll('[data-close]').forEach(b => b.addEventListener('click', () => {
    const host = b.closest('.sheet, .overlay'); if (!host) return;
    if (host.classList.contains('sheet')) closeSheet(host.id); else closeOverlay(host.id);
  }));
  $('helpClose').addEventListener('click', () => closeOverlay('help'));
  $('helpBack').addEventListener('click', () => showHelpToc());
  $('helpPrev').addEventListener('click', () => helpGo(helpIdx - 1));
  $('helpNext').addEventListener('click', () => { if (helpTopic && helpIdx >= helpTopic.cards.length - 1) closeOverlay('help'); else helpGo(helpIdx + 1); });
  $('help').addEventListener('click', e => { if (e.target === $('help')) closeOverlay('help'); });
  $('report').addEventListener('click', e => { if (e.target === $('report')) closeOverlay('report'); });
  for (const id of ['sitSheet', 'detSheet']){
    const sh = $(id);
    swipeClose(sh, [sh.querySelector('.sheet-grab'), sh.querySelector('.sheet-head')], sh.querySelector('.sheet-body'), () => closeSheet(id));
  }
  swipeClose($('helpCard'), [$('helpCard').querySelector('.sheet-grab'), $('helpCard').querySelector('.ov-head')], null, () => closeOverlay('help'));
  const rc = $('report').querySelector('.ov-card');
  swipeClose(rc, [rc.querySelector('.sheet-grab'), rc.querySelector('.ov-head')], null, () => closeOverlay('report'));
  helpSwipe();
  svg.addEventListener('pointerdown', onDown);
  svg.addEventListener('pointermove', onMove);
  svg.addEventListener('pointerup', onUp);
  svg.addEventListener('pointercancel', onCancel);
  svg.addEventListener('contextmenu', e => e.preventDefault());
  cv.addEventListener('pointerdown', e => { v3.down = { x:e.clientX, y:e.clientY, id:e.pointerId }; });
  cv.addEventListener('pointerup', e => {
    const d = v3.down; v3.down = null;
    if (!d || d.id !== e.pointerId || Math.hypot(e.clientX - d.x, e.clientY - d.y) > 8) return;
    if (S.step === 'rot'){ toast('按播放看我們發球時怎麼換位，按 ↻ 換下一輪'); return; }
    const p = v3.r && v3.r.pick(e.clientX, e.clientY);
    if (!p || p[1] < .05 || p[1] > 9.65 || p[0] < -.4 || p[0] > 9.4){ toast('點我們場地的地板，球就會打到那裡'); return; }
    startSim([p[0], p[1]]);
  });
  cv.addEventListener('contextmenu', e => e.preventDefault());
  const onResize = () => { if (screen === 'main') layout(); };
  window.addEventListener('resize', onResize);
  try{ mqWide.addEventListener('change', onResize); }catch(e){ try{ mqWide.addListener(onResize); }catch(e2){} }
  try{ darkMQ.addEventListener('change', () => { v3.colors = colors3(); }); }catch(e){}
  if (window.ResizeObserver) new ResizeObserver(() => layout()).observe($('courtbox'));
  document.addEventListener('visibilitychange', () => { if (document.hidden && play.auto){ play.auto = false; stopTimer(); updateButtons(); } });
  window.addEventListener('pagehide', () => { saveSettings(); if (custom) saveCustom(); });
}

/* ---------- 開始 ---------- */
function init(){
  for (const id of ['verHome', 'verKnow']) $(id).textContent = VERSION_TEXT;
  $('verHelp').textContent = `排球站位 ${VERSION_TEXT}　${COPY}`;
  $('verReport').textContent = VERSION_TEXT;
  document.querySelectorAll('.copy').forEach(n => { n.textContent = COPY; });
  buildCourt();
  refreshSitUI();
  bind();
  const last = sess.get(KEY.screen);
  if (last === 'main' || last === 'know'){ showScreen(last, false); if (histOK) try{ history.replaceState({ s:'home' }, ''); history.pushState({ s:last }, ''); }catch(e){} }
  else showScreen('home', false);
  let inFrame = true; try{ inFrame = window.self !== window.top; }catch(e){ inFrame = true; }
  if ('serviceWorker' in navigator && location.protocol === 'https:' && !inFrame){
    navigator.serviceWorker.register('sw.js').catch(() => {});
  }
}
init();

// 給截圖和測試用
window.VB = {
  S, compute, decide, decideRecv, recvComp, rotComp, buildSteps, buildRecvSteps, buildServeSteps, currentComp, startSim, resetPlay, applyStep, showScreen,
  openHelp, openCards, openHelpTopic, helpGo, setMode, setStep, rotate, set3D, attackZones, posNow, ball3,
  get play(){ return play; }, get custom(){ return custom; }, set custom(v){ custom = v; }, get v3(){ return v3; },
  setSettings(o){
    const m = sanitizeSettings(Object.assign({ sv:4 }, o)); if (o.mode) m.mode = o.mode; if (o.step) m.step = o.step;
    Object.assign(S, m); if (m.attacker) S.attacker = Object.assign({}, m.attacker);
    if (isDefStep()) S.attackType = S.step;
    document.body.classList.toggle('mode-free', S.mode === 'free' && isDefStep());
    saveSettings(); refreshSitUI(); refreshStepUI(); resetPlay(false, 0); placeAttacker(); applyK();
  },
  sanitizeSettings, openSheet, closeTop, markHintSeen, version:APP_VERSION,
  toClient(x, y){ const m = svg.getScreenCTM(); const p = svg.createSVGPoint(); p.x = x; p.y = y; const q = p.matrixTransform(m); return [q.x, q.y]; },
};
})();
