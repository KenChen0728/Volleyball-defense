/* 排球防守站位 v1.1.0
 * 座標：公尺。x 0~9 由左到右（站在我們底線往網子看），y 0~9 由網子往我們底線；對方場地 y < 0。
 */
(() => {
'use strict';

const APP_VERSION = '1.1.0';
const BUILD_DATE = '2026-11-16';
const VERSION_TEXT = `v${APP_VERSION}（${BUILD_DATE}）`;
const KEY = { settings:'vbdef.settings.v1', custom:'vbdef.custom.v1', hint:'vbdef.hint.drag.v1', screen:'vbdef.screen' };
const NS = 'http://www.w3.org/2000/svg';
const VB = { x:-0.45, y:-3.55, w:9.9, h:13.25 };
const TARGET = [4.8, 2.6];                       // 防起來要送到的目標區：場中間、離網兩三公尺
const HIT = { OH1:[0.9,0.75], MB:[3.9,0.75], OPP:[8.1,0.75] };
const APPROACH = { OH1:[0.7,3.8], MB:[3.2,3.4], OPP:[8.3,3.8] };
const READY = { 5:[1.6,5.8], 6:[4.5,6.8], 1:[7.4,5.8] };
const ROLES = ['OH1','MB','OPP','S','OH2','L'];
const ROLE_INFO = {
  OH1:{ tok:'大砲', name:'前排大砲' }, MB:{ tok:'攔中', name:'攔中' }, OPP:{ tok:'輔舉', name:'輔舉' },
  S:{ tok:'舉', name:'舉球員' }, OH2:{ tok:'大砲', name:'後排大砲' }, L:{ tok:'自由', name:'自由' },
};
const GROUP_COLOR = { front:'var(--front)', back:'var(--back)', set:'var(--setter)', lib:'var(--lib)' };
const FORM_NAME = { up:'心跟進', rot:'邊跟進', per:'心後', ours:'舉球留網前' };
const SETTER_NAME = { back:'舉在後排', front:'舉在前排' };
const FORM_DESC = {
  up:'一個人站在攔網後面專守吊球，兩邊站深。對手吊球、推球多時適合。',
  rot:'攔網那一側的後排往前守吊球，6 號位轉去守直線深球。',
  per:'後排三個人靠邊線、底線站，重扣最好接；吊球靠 1 號位（或 5 號位）往前和退下來的前排。',
  ours:'舉球員（後排）留在右邊網前守短球、隨時舉球；輔舉退到 1 號位防守。通常搭配只有攔中攔網。',
};

/* ---------- 小工具 ---------- */
function clamp(v, a, b){ return Math.max(a, Math.min(b, v)); }
function dist(p, q){ return Math.hypot(p[0]-q[0], p[1]-q[1]); }
function lerp(p, q, t){ return [p[0]+(q[0]-p[0])*t, p[1]+(q[1]-p[1])*t]; }
function unit(v){ const n = Math.hypot(v[0], v[1]) || 1; return [v[0]/n, v[1]/n]; }
function clonePos(P){ const o = {}; for (const r in P) o[r] = P[r].slice(); return o; }
function clampCourt(p){ return [clamp(p[0], -0.25, 9.25), clamp(p[1], 0.2, 9.5)]; }
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

/* ---------- 狀態 ---------- */
const DEFAULTS = { formation:'up', canOH:true, canMB:true, canR:true, mbLate:false, setter:'back', libero:5, radius:2, speed:'normal', attackType:'spike', mode:'learn', attacker:{ x:8.2, y:-1.3 } };
function sanitizeSettings(o){
  const r = {};
  if (!o || typeof o !== 'object') return r;
  if (['up','rot','per','ours'].includes(o.formation)) r.formation = o.formation;
  // v1.0 的舊設定（攔網四選一、舉球員三選一）換成 v1.1 的「誰會攔網」
  const OLD = { double:[1,1,1,0], single:[1,1,1,1], mb:[0,1,0,0], none:[0,0,0,0] };
  if (OLD[o.block]){ const [a, b, c, d] = OLD[o.block]; r.canOH = !!a; r.canMB = !!b; r.canR = !!c; r.mbLate = !!d; }
  if (o.setter === 'frontBlock') r.setter = 'front';
  if (o.setter === 'frontNo'){ r.setter = 'front'; r.canR = false; }
  if (['back','front'].includes(o.setter)) r.setter = o.setter;
  for (const key of ['canOH','canMB','canR','mbLate']) if (typeof o[key] === 'boolean') r[key] = o[key];
  if ([5,6].includes(+o.libero)) r.libero = +o.libero;
  if ([1.2,1.6,2,2.4].includes(+o.radius)) r.radius = +o.radius;
  if (['normal','slow'].includes(o.speed)) r.speed = o.speed;
  if (['spike','tip'].includes(o.attackType)) r.attackType = o.attackType;
  if (['learn','free'].includes(o.mode)) r.mode = o.mode;
  if (o.attacker && isFinite(o.attacker.x) && isFinite(o.attacker.y)) r.attacker = { x:clamp(+o.attacker.x, .3, 8.7), y:clamp(+o.attacker.y, -3.2, -.6) };
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
S.attacker = Object.assign({}, S.attacker);
let custom = sanitizeCustom(store.get(KEY.custom, null));
function saveSettings(){
  store.set(KEY.settings, { formation:S.formation, canOH:S.canOH, canMB:S.canMB, canR:S.canR, mbLate:S.mbLate, setter:S.setter, libero:S.libero, radius:S.radius,
    speed:S.speed, attackType:S.attackType, mode:S.mode, attacker:{ x:+S.attacker.x.toFixed(2), y:+S.attacker.y.toFixed(2) } });
}
function saveCustom(){ if (custom) store.set(KEY.custom, custom); }

/* ---------- 誰站哪裡 ---------- */
function lineup(){
  const sb = S.setter === 'back';
  const lu = {
    OH1:{ zone:4, front:true }, MB:{ zone:3, front:true },
    OPP: sb ? { zone:2, front:true } : { zone:1, front:false },
    S:   sb ? { zone:1, front:false } : { zone:2, front:true },
    L:{ zone:S.libero, front:false }, OH2:{ zone:S.libero === 5 ? 6 : 5, front:false },
  };
  if (S.formation === 'ours' && sb){ lu.S.zone = 2; lu.OPP.zone = 1; }
  return lu;
}
function groupOf(role, lu){ if (role === 'S') return 'set'; if (role === 'L') return 'lib'; return lu[role].front ? 'front' : 'back'; }
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
  if (tip === 'S') extra += '舉球員接了吊球，就要喊「修正」換人舉。';
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
function currentComp(){ return S.mode === 'free' ? computeFree(S.attacker) : compute(S.attacker); }

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
  if (type === 'spike' && comp.shadow && inPoly(L, comp.shadow)) return { kind:'blocked' };
  const cands = ROLES.filter(r => !comp.blockers.includes(r)).map(r => ({ r, d:dist(comp.pos[r], L), e:effort(comp.pos[r], L, A) }));
  const mk = (digger, rule, backup, extra) => Object.assign({ kind:'dig', digger, rule, backup:backup || null }, extra || {});
  if (!cands.length) return { kind:'nobody' };
  // 吊球交給負責吊球的人；但如果有別人（不是舉球員）就站在球旁邊、明顯比較近，就給她
  if (type === 'tip' && comp.tip && !comp.blockers.includes(comp.tip)){
    const t = cands.find(c => c.r === comp.tip);
    const closer = cands.some(c => c.r !== comp.tip && c.r !== 'S' && c.d <= R && c.d + 1.0 < (t ? t.d : Infinity));
    if (t && t.d <= R * 1.6 && L[1] <= 4.6 && !closer) return mk(t.r, 'tip');
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
    case 'tip': return `吊球：這個情境由${nm(dec.digger)}守吊球，她往前接。`;
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
    case 'seam': return '依據：兩人之間，離球最近、往前比往後容易的人接，另一個人補位（教練慣例）。';
    case 'yield': return '依據：舉球員能不接第一球就不接（教練慣例）。';
    case 'gap': return '圈圈是每個人一兩步內接得到的範圍；圈外的球很難接。';
  }
  return '';
}

/* ---------- 一球的過程 ---------- */
function backupSetter(dec, comp, P1){
  const pool = ['L','OH2','OPP'].filter(r => r !== dec.digger && !comp.lu[r].front);
  if (!pool.length) return 'L';
  pool.sort((p, q) => dist(P1[p], TARGET) - dist(P1[q], TARGET));
  return pool[0];
}
function chooseHitter(d, L, comp){
  const lu = comp.lu;
  if (lu.OH1.front && !(d === 'OH1' && L[1] > 4)) return 'OH1';
  if (lu.OPP.front && d !== 'OPP' && !(S.formation === 'ours' && S.setter === 'back')) return 'OPP';
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
function speedK(){ return S.speed === 'slow' ? 1.8 : 1; }

function buildSteps(L, type, comp, dec, att){
  const lu = comp.lu, nm = r => roleName(r, lu), short = r => ROLE_INFO[r].name;
  const A = [att.x, att.y], hand = ballHome(att);
  const P0 = clonePos(comp.pos);
  const allNotes = (fn) => { const o = {}; for (const r of ROLES) o[r] = fn(r); return o; };
  const steps = [{ key:'read', title:'讀球站位', pos:P0, ball:{ to:hand }, cap:comp.summary, notes:comp.notes, marks:{} }];
  if (dec.kind === 'out'){
    steps.push({ key:'out', title:'出界', pos:P0, ball:{ from:hand, to:L, dur:520, arc:.15 }, marks:{ out:L },
      cap:'出界：球落在界外，大家不要碰。站在邊線、底線內側一點，腰以上的高度朝妳飛來的球，通常會出界（攔網碰過的除外）。',
      rule:'依據：站在線內，讓出界的球過去（教練慣例）。', notes:allNotes(() => '看球，確定會出界就不要碰') });
    return steps;
  }
  if (dec.kind === 'blocked'){
    const bp = [clamp(L[0], comp.seg[0] + .1, comp.seg[1] - .1), .05];
    steps.push({ key:'blocked', title:'被攔網擋住', pos:P0, marks:{},
      ball:{ from:hand, to:bp, dur:330, arc:.08, then:{ to:[bp[0], -2.7], dur:480, arc:.45 } },
      cap:'這球打進攔網陰影（灰色），被攔網擋回去。陰影裡不用站人，後排要站在陰影兩邊。',
      rule:'攔網陰影只畫到離網 4 公尺：比較深的球會從攔網上面飛過去。',
      notes:allNotes(r => comp.blockers.includes(r) ? '攔網：把球擋回去' : '看球，準備接彈回來的球') });
    return steps;
  }
  if (dec.kind === 'nobody'){
    steps.push({ key:'nobody', title:'沒有人可以接', pos:P0, marks:{}, ball:{ from:hand, to:L, dur:520, arc:.15 }, cap:'場上的人都去攔網了，沒有人能接這一球。', notes:comp.notes });
    return steps;
  }
  // 1. 攻擊・接球：最近的人上前接，另一個人跟到她後面保護，旁邊的人往她空出來的地方移
  const d = dec.digger;
  const away = unit([L[0] - A[0], L[1] - A[1]]);
  const P1 = clonePos(P0);
  P1[d] = clampCourt([L[0] + away[0]*.25, L[1] + away[1]*.25]);
  const busy = new Set([d, ...comp.blockers]);
  const setterGoes = d !== 'S' && !comp.blockers.includes('S');
  if (setterGoes) busy.add('S');
  let backup = dec.backup;
  if (backup === 'S' && setterGoes) backup = null;
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
  const setterRole = d === 'S' ? backupSetter(dec, comp, P1) : 'S';
  if (setterGoes) P1.S = lerp(P0.S, TARGET, .35);
  let cap1 = reasonText(dec, lu);
  if (backup && backup !== dec.backup) cap1 += `${short(backup)}跟過去站在她後面，球接飛了可以救。`;
  if (fillers.length) cap1 += `${fillers.map(short).join('、')}往她空出來的地方移一點。`;
  if (leaners.length) cap1 += '其他人往球的方向靠一步，眼睛跟著球。';
  if (setterGoes) cap1 += '舉球員看到別人接，就往目標區跑。';
  const rules1 = [ruleText(dec)];
  if (backup || fillers.length) rules1.push('補位：最近的隊友跟到接球的人後面保護，旁邊的人往空出來的地方移（教練慣例）。');
  steps.push({ key:'dig', title: type === 'tip' ? '吊球・接球' : '攻擊・接球', pos:P1,
    ball:{ from:hand, to:L, dur: type === 'tip' ? 900 : 480, arc: type === 'tip' ? .7 : .1 },
    cap:cap1, rule:rules1.filter(Boolean).join(' '), marks:{ dig:d, backup, fillers, gap: dec.rule === 'gap' },
    notes:allNotes(r => r === d ? '接球：把球高高接到場中間' : r === backup ? '補位：跟到接球的人後面，球接飛了可以救'
      : fillers.includes(r) ? '補空位：往接球的人空出來的地方移一點'
      : leaners.includes(r) ? '往球的方向靠一步，準備救接飛的球'
      : (r === 'S' && setterGoes) ? '往目標區跑，準備舉球' : comp.blockers.includes(r) ? '攔網落地，轉身看球' : '原地準備，眼睛跟著球') });
  // 2. 送到目標區
  const P2 = clonePos(P1);
  const moved = new Set([setterRole]);
  P2[setterRole] = [TARGET[0] + .15, TARGET[1] + .3];
  const attackers = ['OH1','MB','OPP'].filter(r => lu[r].front && r !== setterRole && !(r === d && L[1] > 5));
  for (const r of attackers){ P2[r] = APPROACH[r].slice(); moved.add(r); }
  if (!moved.has(d)){ P2[d] = lerp(P1[d], TARGET, .2); moved.add(d); }
  for (const r of ROLES) if (!moved.has(r) && !lu[r].front) P2[r] = (READY[lu[r].zone] || P2[r]).slice();
  let cap2 = `${short(d)}把球高高接到場中間、離網兩三公尺的目標區。`;
  if (d === 'S'){
    cap2 += `舉球員接了第一球，喊「修正」，由最近的${short(setterRole)}來舉，高高送到 4 號位。`;
    if (setterRole === 'L') cap2 += '自由在三米線前用手舉的話，攻擊手不能在網子上方打，所以要用下手舉，或退到三米線後面舉。';
  } else cap2 += '舉球員跑到球下面準備舉。';
  cap2 += '前排攻擊手退到起跑點' + (comp.blockers.length ? '，攔網的人落地轉身退開' : '') + '。';
  steps.push({ key:'pass', title:'送到目標區', pos:P2, ball:{ from:L, to:TARGET, dur:900, arc:1.1 }, cap:cap2,
    rule: d === 'S' ? '依據：舉球員接第一球時，由自由或輔舉舉第二球；自由在前區用手舉有限制（規則）。' : '依據：防起來的球要高、離網、往場中間。',
    marks:{ set:setterRole, target:true },
    notes:allNotes(r => r === setterRole ? '跑到目標區，準備舉球' : attackers.includes(r) ? '退到起跑點，準備助跑' : r === d ? '接完球往中間靠，準備保護' : '回到後排，準備保護') });
  // 3. 舉球・保護
  const hitter = chooseHitter(d, L, comp);
  const H = HIT[hitter];
  const P3 = clonePos(P2);
  P3[hitter] = [H[0], H[1] + .2];
  const others = ROLES.filter(r => r !== hitter).sort((p, q) => dist(P2[p], H) - dist(P2[q], H));
  const close = others.slice(0, 3), deep = others.slice(3);
  const sp = coverSpots(H);
  assignSpots(close, sp.close, P2, P3); assignSpots(deep, sp.deep, P2, P3);
  const over = [H[0] < 4.5 ? H[0] + 2.6 : H[0] - 2.6, -2.8];
  const toSide = hitter === 'OH1' ? '4 號位' : (hitter === 'OPP' ? '2 號位' : '中間');
  steps.push({ key:'set', title:'舉球・保護', pos:P3, ball:{ from:TARGET, to:H, dur:900, arc:1.0, then:{ to:over, dur:300, arc:.1 } },
    cap:`${short(setterRole)}舉高球到${toSide}給${short(hitter)}攻擊。離攻擊手最近的三個人（${close.map(short).join('、')}）蹲低靠近保護，另外兩個人站後面一點：球被攔回來才接得到。`,
    rule:'依據：離攻擊手最近的三個人近距離保護，最遠的兩個人守後面（教練慣例）。',
    marks:{ hit:hitter, target:true },
    notes:allNotes(r => r === hitter ? '助跑攻擊' : close.includes(r) ? '靠近攻擊手、蹲低保護' : '站後面一點，保護比較遠的球') });
  // 4. 回防
  steps.push({ key:'reset', title:'回防', pos:clonePos(comp.base), ball:null,
    cap:'球過網後，大家回到基本站位，看對方舉給誰，再移動到防守位置。', marks:{},
    notes:allNotes(() => '回到基本站位') });
  return steps;
}

/* ---------- 畫球場 ---------- */
const svg = $('court');
const G = {};
const plG = {}, rgG = {}, tgG = {};
let k = 1;                 // 球員圖示的放大倍數（畫面小時放大，字才看得清楚）
let ballPos = [0, 0], ballScale = 1, ballRAF = 0, ballSeqToken = 0;
function ballHome(att){ return [clamp(att.x + .5, .2, 8.8), att.y + .5]; }

function buildCourt(){
  svg.innerHTML = '';
  const defs = el('defs', null, svg);
  const lg = el('linearGradient', { id:'shg', x1:'0', y1:'0', x2:'0', y2:'1' }, defs);
  const s1 = el('stop', { offset:'0' }, lg); s1.style.stopColor = 'var(--sh-c)'; s1.style.stopOpacity = 'var(--sh-o)';
  const s2 = el('stop', { offset:'1' }, lg); s2.style.stopColor = 'var(--sh-c)'; s2.style.stopOpacity = '0';
  const cp = el('clipPath', { id:'clipCourt' }, defs); el('rect', { x:0, y:0, width:9, height:9 }, cp);
  G.bg = el('g', null, svg);
  const r1 = el('rect', { x:0, y:VB.y, width:9, height:-VB.y }, G.bg); r1.style.fill = 'var(--opp-court)';
  const r2 = el('rect', { x:0, y:0, width:9, height:9 }, G.bg); r2.style.fill = 'var(--court)';
  const r3 = el('rect', { x:0, y:0, width:9, height:3 }, G.bg); r3.style.fill = 'var(--court-front)';
  const lines = el('g', null, G.bg); lines.style.stroke = 'var(--courtline)'; lines.style.fill = 'none';
  el('rect', { x:0, y:0, width:9, height:9, 'stroke-width':.07 }, lines);
  el('line', { x1:0, y1:3, x2:9, y2:3, 'stroke-width':.06 }, lines);
  el('line', { x1:0, y1:-3, x2:9, y2:-3, 'stroke-width':.05, 'stroke-opacity':.6 }, lines);
  el('line', { x1:0, y1:VB.y, x2:0, y2:0, 'stroke-width':.05, 'stroke-opacity':.6 }, lines);
  el('line', { x1:9, y1:VB.y, x2:9, y2:0, 'stroke-width':.05, 'stroke-opacity':.6 }, lines);
  const zn = [[4,1.5,1.5],[3,4.5,1.5],[2,7.5,1.5],[5,1.5,6],[6,4.5,6],[1,7.5,6]];
  for (const [n, x, y] of zn){ const t = el('text', { x, y, class:'zn' }, G.bg); t.textContent = n; }
  G.labels = el('g', null, G.bg);
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
  G.oppLabel = el('text', { x:4.5, y:-3.18, 'text-anchor':'middle', 'font-size':.32 }, G.bg); G.oppLabel.style.fill = 'var(--muted)';
  G.oppLabel.textContent = '對方場地';
  buildPlayers();
}
function buildPlayers(){
  G.players.innerHTML = ''; G.ranges.innerHTML = ''; G.tagLayer.innerHTML = '';
  for (const r of ROLES){
    const rg = el('g', { class:'rg', 'data-role':r }, G.ranges);
    el('circle', { r:S.radius }, rg);
    rgG[r] = rg;
    const g = el('g', { class:'pl', 'data-role':r, 'data-drag':'player' }, G.players);
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
    tgG[r] = tg;
    plG[r] = g;
  }
  refreshPlayerLooks(currentComp());
}
function refreshPlayerLooks(comp){
  for (const r of ROLES){
    const g = plG[r], grp = groupOf(r, comp.lu), col = GROUP_COLOR[grp];
    g.querySelector('.body').style.fill = col;
    const t = g.querySelector('.t'); t.textContent = ROLE_INFO[r].tok; t.setAttribute('font-size', ROLE_INFO[r].tok.length > 1 ? .33 : .38);
    g.querySelector('.badge text').textContent = comp.lu[r].zone;
    g.setAttribute('aria-label', roleName(r, comp.lu));
    const c = rgG[r].querySelector('circle');
    c.setAttribute('r', S.radius); c.style.fill = col; c.style.stroke = col; c.style.fillOpacity = .14; c.style.strokeOpacity = .55;
  }
}
function setMoveDur(ms){ svg.style.setProperty('--mv', `${Math.round(ms)}ms`); }
function placePlayers(P, blockers){
  for (const r of ROLES){
    const p = P[r]; if (!p) continue;
    const tf = `translate(${p[0].toFixed(3)}px, ${p[1].toFixed(3)}px)`;
    plG[r].style.transform = tf; rgG[r].style.transform = tf; if (tgG[r]) tgG[r].style.transform = tf;
    rgG[r].classList.toggle('off', !!(blockers && blockers.includes(r)));
  }
}
function placeAttacker(){ G.att.setAttribute('transform', `translate(${S.attacker.x.toFixed(3)} ${S.attacker.y.toFixed(3)})`); }
function drawBall(p, s){
  ballPos = p.slice(); ballScale = s || 1;
  G.ballG.setAttribute('transform', `translate(${p[0].toFixed(3)} ${p[1].toFixed(3)})`);
  G.ballTok.setAttribute('transform', `scale(${(k * ballScale).toFixed(3)})`);
}
function drawShadow(comp){
  G.shadow.innerHTML = ''; G.block.innerHTML = '';
  if (!comp.seg) return;
  if (comp.shadow){ const pg = el('polygon', { points:comp.shadow.map(p => p.join(',')).join(' '), fill:'url(#shg)' }, G.shadow); pg.setAttribute('data-shadow', '1'); }
  const w = el('rect', { x:comp.seg[0], y:-.09, width:comp.seg[1] - comp.seg[0], height:.18, rx:.08 }, G.block);
  w.style.fill = 'var(--ink)'; w.style.opacity = .85;
}
function clearPaths(){ G.paths.innerHTML = ''; }
function drawTarget(){
  const c = el('circle', { cx:TARGET[0], cy:TARGET[1], r:.9, class:'target' }, G.paths);
  const t = el('text', { x:TARGET[0], y:TARGET[1] + .12, class:'target-t' }, G.paths); t.textContent = '目標區';
  t.setAttribute('font-size', (.33 * k).toFixed(3)); return c;
}
function setMarks(m, comp){
  for (const r of ROLES){
    const g = plG[r]; g.classList.remove('is-dig', 'is-backup');
    const tag = tgG[r].querySelector('.tag-svg'); tag.setAttribute('visibility', 'hidden');
  }
  const showTag = (r, text, below) => {
    const tag = tgG[r].querySelector('.tag-svg'); tag.querySelector('text').textContent = text;
    tag.setAttribute('transform', below ? 'translate(0 .95)' : 'translate(0 -.95)');
    const w = .26 * text.length + .32; const rc = tag.querySelector('rect'); rc.setAttribute('x', -w/2); rc.setAttribute('width', w);
    tag.setAttribute('visibility', 'visible');
  };
  if (!m) return;
  if (m.dig){ plG[m.dig].classList.add('is-dig'); showTag(m.dig, m.gap ? '衝！' : '接'); }
  if (m.backup){ plG[m.backup].classList.add('is-backup'); showTag(m.backup, '補位', true); }
  if (m.fillers) for (const r of m.fillers){ plG[r].classList.add('is-backup'); showTag(r, '補空位'); }
  if (m.set){ showTag(m.set, '舉'); }
  if (m.hit){ showTag(m.hit, '攻擊'); }
}
function applyK(){
  const r = svg.getBoundingClientRect();
  if (!r.width || !r.height) return;
  const ppm = Math.min(r.width / VB.w, r.height / VB.h);
  k = clamp(37 / ppm, .8, document.body.classList.contains('sit-open') ? 1.65 : 1.45);
  svg.querySelectorAll('.tok').forEach(t => t.setAttribute('transform', `scale(${k.toFixed(3)})`));
  G.attTok.setAttribute('transform', `scale(${k.toFixed(3)})`);
  G.ballTok.setAttribute('transform', `scale(${(k * ballScale).toFixed(3)})`);
  G.oppLabel.setAttribute('font-size', (.33 * Math.max(1, k)).toFixed(3));
  svg.querySelectorAll('.target-t').forEach(t => t.setAttribute('font-size', (.33 * k).toFixed(3)));
}

/* ---------- 球的動畫 ---------- */
function animateBall(seg, onDone){
  const token = ++ballSeqToken;
  cancelAnimationFrame(ballRAF);
  const run = (s, done) => {
    const from = s.from ? s.from.slice() : ballPos.slice(), to = s.to;
    const dur = (s.dur || 500) * speedK();
    if (reduceMotion.matches || dur <= 0){ drawBall(to, 1); done(); return; }
    const t0 = performance.now();
    const frame = now => {
      if (token !== ballSeqToken) return;
      const t = Math.min(1, (now - t0) / dur);
      const e = s.arc > .4 ? (t < .5 ? 2*t*t : 1 - Math.pow(-2*t + 2, 2) / 2) : t;
      drawBall([from[0] + (to[0] - from[0]) * e, from[1] + (to[1] - from[1]) * e], 1 + (s.arc || 0) * .9 * Math.sin(Math.PI * t));
      if (t < 1) ballRAF = requestAnimationFrame(frame); else done();
    };
    ballRAF = requestAnimationFrame(frame);
  };
  run(seg, () => { if (seg.then && token === ballSeqToken) run(Object.assign({ from:seg.to }, seg.then), () => onDone && onDone()); else if (onDone) onDone(); });
}
function ballEnd(b){ if (!b) return null; return b.then ? b.then.to : b.to; }

/* ---------- 播放 ---------- */
const play = { steps:[], i:-1, auto:false, timer:0, comp:null, landing:null };
function stopTimer(){ clearTimeout(play.timer); play.timer = 0; }
function resetPlay(keepCaption, dur){
  stopTimer(); ballSeqToken++; cancelAnimationFrame(ballRAF);
  play.steps = []; play.i = -1; play.auto = false; play.landing = null;
  clearPaths(); setMarks(null);
  const comp = currentComp(); play.comp = comp;
  refreshPlayerLooks(comp);
  setMoveDur(reduceMotion.matches ? 0 : (dur == null ? 250 : dur));
  placePlayers(comp.pos, comp.blockers);
  drawShadow(comp);
  G.shadow.style.display = ''; G.block.style.display = '';
  placeAttacker();
  drawBall(ballHome(S.attacker), 1);
  if (!keepCaption) showIdleCaption(comp);
  updateButtons();
  return comp;
}
function showIdleCaption(comp){
  $('stepTitle').textContent = S.mode === 'free' ? '自己擺' : '讀球站位';
  let t = comp.summary;
  const hintOn = !hintSeen() && S.mode === 'learn';
  $('btnHintOk').hidden = !hintOn; $('btnDetail').hidden = hintOn;
  if (hintOn) t = '提示：把黃色的球拖到我們的場地，或直接點場上任一點，就會看到誰去接。拖紅色的「攻」可以改變對方從哪裡打。';
  $('caption').textContent = t;
  $('ruleLine').hidden = true;
  curNotes = comp.notes;
}
let curNotes = {};
function stepDur(st){
  if (st.key === 'dig' || st.key === 'out' || st.key === 'blocked') return (st.ball ? (st.ball.dur || 500) + (st.ball.then ? st.ball.then.dur : 0) : 500);
  return 800;
}
function applyStep(i, animate){
  const st = play.steps[i]; if (!st) return;
  play.i = i;
  const comp = play.comp;
  const mv = animate && !reduceMotion.matches ? stepDur(st) * speedK() : 0;
  setMoveDur(mv);
  placePlayers(st.pos, (st.key === 'read' || st.key === 'dig' || st.key === 'out' || st.key === 'blocked' || st.key === 'nobody') ? comp.blockers : []);
  setMarks(st.marks, comp);
  const blockShown = !['pass','set','reset'].includes(st.key);
  G.shadow.style.display = blockShown ? '' : 'none'; G.block.style.display = blockShown ? '' : 'none';
  clearPaths();
  if (st.marks && st.marks.target) drawTarget();
  if (play.landing && i >= 1 && (st.key === 'dig' || st.key === 'out' || st.key === 'nobody' || st.key === 'gap')){
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
    if (animate && st.ball.from) animateBall(st.ball);
    else { const e = ballEnd(st.ball); if (e) drawBall(e, 1); }
  } else if (st.key === 'reset') drawBall(ballHome(S.attacker), 1);
  updateButtons();
}
function scheduleNext(){
  stopTimer();
  if (!play.auto) return;
  if (play.i >= play.steps.length - 1){ play.auto = false; updateButtons(); return; }
  const st = play.steps[play.i];
  const read = clamp(900 + st.cap.length * 45, 1600, 5200);
  play.timer = setTimeout(() => { applyStep(play.i + 1, true); scheduleNext(); }, (stepDur(st) + read) * speedK());
}
function startSim(L){
  markHintSeen();
  const comp = resetPlay(true);
  const dec = decide(L, S.attackType, comp, S.attacker);
  play.landing = L.slice();
  play.steps = buildSteps(L, S.attackType, comp, dec, S.attacker);
  play.dec = dec;
  applyStep(0, false);
  play.auto = true;
  applyStep(1, true);
  scheduleNext();
}
function demoBall(){
  const side = sideOf(S.attacker.x);
  const L = side === 'R' ? [1.3, 6.3] : (side === 'L' ? [7.7, 6.3] : [2.0, 6.8]);
  startSim(L);
}
function updateButtons(){
  const has = play.steps.length > 0;
  const prev = $('btnPrev'), next = $('btnNext'), pl = $('btnPlay');
  prev.setAttribute('aria-disabled', String(!has || play.i <= 0));
  next.setAttribute('aria-disabled', String(!has || play.i >= play.steps.length - 1));
  let state = 'play', label = '示範一球';
  if (has){
    if (play.auto){ state = 'pause'; label = '暫停'; }
    else if (play.i >= play.steps.length - 1){ state = 'replay'; label = '重播這一球'; }
    else { state = 'play'; label = '繼續播放'; }
  }
  pl.dataset.state = state; pl.setAttribute('aria-label', label); pl.title = label;
}
function onPlay(){
  if (!play.steps.length){ demoBall(); return; }
  if (play.auto){ play.auto = false; stopTimer(); updateButtons(); return; }
  if (play.i >= play.steps.length - 1){ const L = play.landing; if (L) startSim(L); return; }
  play.auto = true; applyStep(play.i + 1, true); scheduleNext();
}
function onPrev(){
  if (!play.steps.length){ toast('先把球拖到我們的場地，或按播放看示範'); return; }
  if (play.i <= 0){ toast('已經是第一步'); return; }
  play.auto = false; stopTimer(); ballSeqToken++;
  applyStep(play.i - 1, false);
}
function onNext(){
  if (!play.steps.length){ toast('先把球拖到我們的場地，或按播放看示範'); return; }
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
  if (kind === 'player' && S.mode !== 'free') kind = null;
  drag = { kind, id:e.pointerId, start:p, sx:e.clientX, sy:e.clientY, moved:false, role: kind === 'player' ? t.dataset.role : null };
  try{ svg.setPointerCapture(e.pointerId); }catch(err){}
  if (kind){
    e.preventDefault();
    if (play.steps.length && kind !== 'ball') resetPlay();
    if (kind === 'ball'){ resetPlay(true); G.ballG.classList.add('dragging'); hideHint(); }
    if (kind === 'attacker') G.att.classList.add('dragging');
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
    placePlayers(comp.pos, comp.blockers);
    refreshPlayerLooks(comp);
    drawShadow(comp);
    drawBall(ballHome(S.attacker), 1);
    showIdleCaption(comp);
  } else if (drag.kind === 'ball'){
    const q = [clamp(p[0], -.4, 9.4), clamp(p[1], VB.y + .2, 9.65)];
    drawBall(q, 1);
    previewBall(q);
  } else if (drag.kind === 'player'){
    const q = [clamp(p[0], -.25, 9.25), clamp(p[1], .2, 9.5)];
    custom[drag.role] = q;
    const comp = currentComp(); play.comp = comp;
    setMoveDur(0); placePlayers(comp.pos, comp.blockers); drawShadow(comp);
    curNotes = comp.notes;
  }
}
function previewBall(q){
  clearPaths();
  const h = ballHome(S.attacker);
  el('line', { x1:h[0], y1:h[1], x2:q[0], y2:q[1], class:'prev-line' }, G.paths);
  for (const r of ROLES) rgG[r].classList.remove('hot');
  G.tags.innerHTML = '';
  if (q[1] <= .05) return;
  const comp = play.comp || currentComp();
  const dec = decide(q, S.attackType, comp, S.attacker);
  let text = '';
  if (dec.kind === 'out') text = '出界';
  else if (dec.kind === 'blocked') text = '會被攔網擋住';
  else if (dec.kind === 'dig'){ rgG[dec.digger].classList.add('hot'); text = `${ROLE_INFO[dec.digger].tok}接` + (dec.rule === 'gap' ? '（空檔）' : ''); }
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
  G.ballG.classList.remove('dragging'); G.att.classList.remove('dragging');
  for (const r of ROLES){ plG[r].classList.remove('dragging'); rgG[r].classList.remove('dragging', 'hot'); tgG[r].classList.remove('dragging'); }
  G.tags.innerHTML = '';
  const p = d.cur || d.start;
  if (d.kind === 'ball'){
    if (d.moved && p[1] > .05){ startSim([clamp(p[0], -.4, 9.4), clamp(p[1], .06, 9.65)]); }
    else { clearPaths(); drawBall(ballHome(S.attacker), 1); if (!d.moved) toast('按住黃色的球，拖到我們的場地'); }
    return;
  }
  if (d.kind === 'attacker'){ saveSettings(); return; }
  if (d.kind === 'player'){ saveCustom(); return; }
  if (!d.kind && !d.moved && p[1] > .05 && p[1] < 9.65 && p[0] > -.4 && p[0] < 9.4){ startSim([p[0], p[1]]); }
}
function onCancel(e){
  if (!drag || e.pointerId !== drag.id) return;
  drag = null; resetPlay();
}

/* ---------- 第一次的拖拉提示 ---------- */
function hintSeen(){ return !!store.get(KEY.hint, false); }
function markHintSeen(){ if (!hintSeen()) store.set(KEY.hint, true); hideHint(); $('btnHintOk').hidden = true; $('btnDetail').hidden = false; }
function hideHint(){ G.hint.innerHTML = ''; }
function showHint(){
  hideHint();
  if (hintSeen() || S.mode !== 'learn') return;
  const h = ballHome(S.attacker), to = [4.5, 5.6];
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
  if (id === 'main'){ layout(); setMode(S.mode, true); requestAnimationFrame(() => { applyK(); drawBall(ballPos, ballScale); }); }
  window.scrollTo(0, 0);
}
function setMode(m, silent){
  S.mode = m;
  document.querySelectorAll('.seg-mode button').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.mode === m)));
  document.body.classList.toggle('mode-free', m === 'free');
  $('btnResetFree').hidden = m !== 'free';
  if (m === 'free' && !custom){ custom = clonePos(compute(S.attacker).pos); saveCustom(); }
  if (!silent) saveSettings();
  if (m === 'free') hideHint();
  resetPlay(false, silent ? 0 : 350);
  refreshSitUI();
  if (m === 'learn') showHint();
}
const mqWide = window.matchMedia('(orientation: landscape) and (min-width: 600px), (min-width: 980px)');
function layout(){
  const wide = mqWide.matches, form = $('sitForm');
  if (wide){
    if (form.parentNode !== $('panelSit')) $('panelSit').appendChild(form);
    $('panelSit').hidden = false; $('btnSit').hidden = true;
    if (!$('sitSheet').hidden) closeSheet('sitSheet', true);
  } else {
    if (form.parentNode !== $('sitSheetBody')) $('sitSheetBody').appendChild(form);
    $('panelSit').hidden = true; $('btnSit').hidden = false;
  }
  applyK();
}
function sitSummary(){
  return S.mode === 'free' ? `自己擺・${blockSummary()}・${SETTER_NAME[S.setter]}` : `${FORM_NAME[S.formation]}・${blockSummary()}・${SETTER_NAME[S.setter]}`;
}
function rName(){ return S.setter === 'back' ? '輔舉' : '舉球員'; }
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
  if (!S.canR) parts.push(`${rName()}不攔：對方從右邊打時退下來守吊球`);
  return parts.length ? parts.join('；') + '。' : '能攔的人都攔，邊線兩人攔、中間攔中加旁邊的人。';
}
function refreshSitUI(){
  $('sitText').textContent = sitSummary();
  document.querySelectorAll('.chips[data-key]').forEach(c => {
    const key = c.dataset.key; if (key === 'mbLate') return;
    c.querySelectorAll('button').forEach(b => b.setAttribute('aria-pressed', String(String(S[key]) === b.dataset.v)));
  });
  $('formDesc').textContent = FORM_DESC[S.formation];
  $('setterDesc').textContent = S.formation === 'ours' && S.setter !== 'back' ? '舉球員在前排時本來就在網前，「舉球留網前」跟心後一樣。' : '';
  document.querySelectorAll('.chips-multi button').forEach(b => b.setAttribute('aria-pressed', String(!!S[b.dataset.k])));
  $('chipR').textContent = rName();
  $('blockDesc').textContent = blockDesc();
  document.querySelectorAll('.chips[data-key="mbLate"] button').forEach(b => { b.setAttribute('aria-pressed', String((S.mbLate ? '1' : '0') === b.dataset.v)); b.setAttribute('aria-disabled', String(!S.canMB)); });
  document.querySelectorAll('.seg-type button').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.type === S.attackType)));
}
function onChip(key, v){
  const prev = { canOH:S.canOH, canMB:S.canMB, canR:S.canR };
  if (key === 'mbLate'){ if (!S.canMB){ toast('攔中設定成不攔網，不用選這一項'); return; } S.mbLate = v === '1'; }
  else if (key === 'libero') S.libero = +v;
  else if (key === 'radius') S.radius = +v;
  else if (key.startsWith('can')) S[key] = !S[key];
  else S[key] = v;
  let msg = null;
  if (key === 'formation' && v === 'ours' && S.setter === 'back' && S.canOH){
    S.canOH = false; msg = '「舉球留網前」通常是只有攔中攔網，已把大砲改成不攔';
  }
  saveSettings(); refreshSitUI();
  resetPlay(false, 400);
  if (msg) toast(msg, '復原', () => { Object.assign(S, prev); saveSettings(); refreshSitUI(); resetPlay(false, 400); });
}

/* ---------- 底部面板、說明 ---------- */
const overlayStack = [];
function detOpen(){ return !$('detSheet').hidden; }
function openSheet(id){
  const sh = $(id); if (!sh.hidden) return;
  sh.hidden = false; sh.classList.add('closing'); sh.getBoundingClientRect(); sh.classList.remove('closing');
  if (id === 'sitSheet'){ document.documentElement.style.setProperty('--sheet-h', `${Math.ceil(sh.getBoundingClientRect().height)}px`); document.body.classList.add('sit-open'); requestAnimationFrame(applyK); }
  overlayStack.push(id);
  if (histOK){ try{ history.pushState({ s:screen, ov:id }, ''); }catch(e){} }
  const f = sh.querySelector('[data-close]'); if (f) setTimeout(() => f.focus({ preventScroll:true }), 50);
}
function closeSheet(id, noHist){
  const sh = $(id); if (sh.hidden) return;
  const i = overlayStack.lastIndexOf(id); if (i >= 0) overlayStack.splice(i, 1);
  sh.classList.add('closing');
  if (id === 'sitSheet'){ document.body.classList.remove('sit-open'); requestAnimationFrame(applyK); }
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
function closeAllSheets(noHist){ while (overlayStack.length){ const id = overlayStack.pop(); const n = $(id); n.hidden = true; n.classList.remove('closing'); } document.body.classList.remove('sit-open'); }
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
  const ul = $('detList'); ul.innerHTML = '';
  for (const r of ROLES){
    const li = document.createElement('li');
    const who = document.createElement('span'); who.className = 'who'; who.style.background = GROUP_COLOR[groupOf(r, comp.lu)];
    who.textContent = `${ROLE_INFO[r].name}・${comp.lu[r].zone}`;
    const tx = document.createElement('span'); tx.textContent = curNotes[r] || '';
    li.append(who, tx); ul.appendChild(li);
  }
}

/* ---------- 使用說明 ---------- */
const HELP = [
  { id:'screen', title:'看懂畫面', cards:[
    { img:'help/screen-1.webp', h:'上面是對方，下面是我們', p:'上面淺色的是對方場地，粗黑線是網子，下面是我們的場地。場上淡淡的數字是號位：網前 4、3、2，後排 5、6、1。' },
    { img:'help/screen-2.webp', h:'圓點是球員', p:'圓點裡寫角色：舉、攔中、大砲、輔舉、自由。顏色：前排藍、後排綠、舉球員橘、自由紫。右上的小數字是她固定守的號位。' },
    { img:'help/screen-3.webp', h:'圈圈是防守範圍', p:'每個人的圈圈一樣大，是她一兩步接得到的地方。灰色是攔網陰影：重扣打不進去，後排不用站在裡面。' },
  ]},
  { id:'learn', title:'拖球看誰接', cards:[
    { img:'help/learn-1.webp', h:'拖紅色的「攻」', p:'紅色的「攻」是對方的攻擊手。拖到左邊、中間、右邊，我們的人會跟著換到防守位置，攔網也會跟過去。' },
    { img:'help/learn-2.webp', h:'把黃色的球拖到我們場上', p:'按住黃球拖到我們場地任何地方放開（也可以直接點場上）。拖的時候會先顯示誰會接。' },
    { img:'help/learn-3.webp', h:'看誰去接、為什麼', p:'接球的人會標「接」。最近的隊友跟到她後面標「補位」，往她空出來的地方移的人標「補空位」。下面的說明寫出為什麼是她，還有依據。' },
    { img:'help/learn-4.webp', h:'一步一步看接起來之後', p:'自動播放：接球 → 送到目標區 → 舉球・保護 → 回防。用 ‹ › 可以前後看，「每個人在做什麼」列出這一步每個人的工作。' },
  ]},
  { id:'situation', title:'換情境', cards:[
    { img:'help/sit-1.webp', h:'點「情境」打開設定', p:'手機直放時，點下面的「情境」會從下方打開設定，上面的球場還看得到。手機橫放或平板、電腦，設定直接在右邊。' },
    { img:'help/sit-2.webp', h:'隊形、誰會攔網、舉球員', p:'隊形有心跟進、邊跟進、心後，和「舉球留網前」。「誰會攔網」可以複選大砲、攔中、輔舉；不夠高的人取消勾選，就會看到她退下來守哪裡。攔中跟不上邊線時選「來不及」。' },
    { img:'help/sit-3.webp', h:'扣球和吊球', p:'球場下面可以選扣球或吊球。吊球比較慢，會由這個隊形負責吊球的人去接；扣球打進攔網陰影會被擋住。' },
  ]},
  { id:'free', title:'自己擺站位', cards:[
    { img:'help/free-1.webp', h:'切到「自己擺」', p:'上面切到「自己擺」，6 個人都可以拖。前排拉到網前就算攔網，後排拉到網前也不能攔。' },
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
let helpTopic = null, helpIdx = 0;
function buildHelpToc(){
  const toc = $('helpToc'); toc.innerHTML = '';
  for (const t of HELP){
    const b = document.createElement('button'); b.className = 'card-link';
    b.innerHTML = `<span class="cl-text"><b></b><small></small></span><span class="cl-go">打開 ›</span>`;
    b.querySelector('b').textContent = t.title; b.querySelector('small').textContent = `${t.cards.length} 張`;
    b.addEventListener('click', () => openHelpTopic(t.id, 0, true));
    toc.appendChild(b);
  }
}
function openHelp(topicId){
  openOverlay('help');
  if (topicId) openHelpTopic(topicId, 0, false); else showHelpToc();
}
function showHelpToc(){
  helpTopic = null;
  $('helpToc').hidden = false; $('helpTopic').hidden = true; $('helpBack').style.visibility = 'hidden';
  $('helpTitle').textContent = '使用說明';
}
function openHelpTopic(id, idx){
  const t = HELP.find(x => x.id === id); if (!t) return;
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
    const h = document.createElement('h3'); h.textContent = c.h; d.appendChild(h);
    const p = document.createElement('p'); p.textContent = c.p; d.appendChild(p);
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

/* ---------- 小提示 ---------- */
let toastTimer = 0;
function toast(text, actLabel, actFn, ms){
  const t = $('toast'); $('toastText').textContent = text;
  const b = $('toastAct');
  if (actLabel){ b.hidden = false; b.textContent = actLabel; b.onclick = () => { t.hidden = true; actFn && actFn(); }; } else b.hidden = true;
  t.hidden = false; clearTimeout(toastTimer); toastTimer = setTimeout(() => { t.hidden = true; }, ms || (actLabel ? 5000 : 2600));
}

/* ---------- 綁定 ---------- */
function bind(){
  $('btnStart').addEventListener('click', () => { S.mode = 'learn'; showScreen('main', true); });
  $('btnFree').addEventListener('click', () => { S.mode = 'free'; showScreen('main', true); });
  $('btnKnow').addEventListener('click', () => showScreen('know', true));
  $('btnHelpHome').addEventListener('click', () => openHelp(null));
  $('btnReport').addEventListener('click', () => openOverlay('report'));
  $('btnMainHome').addEventListener('click', () => { if (histOK && history.state && history.state.s === 'main'){ try{ history.back(); return; }catch(e){} } showScreen('home', false); });
  $('btnKnowHome').addEventListener('click', () => { if (histOK && history.state && history.state.s === 'know'){ try{ history.back(); return; }catch(e){} } showScreen('home', false); });
  $('btnMainHelp').addEventListener('click', () => openHelp(S.mode === 'free' ? 'free' : 'learn'));
  $('btnKnowHelp').addEventListener('click', () => openHelp('screen'));
  document.querySelectorAll('.seg-mode button').forEach(b => b.addEventListener('click', () => { if (S.mode !== b.dataset.mode) setMode(b.dataset.mode); refreshSitUI(); }));
  document.querySelectorAll('.seg-type button').forEach(b => b.addEventListener('click', () => {
    S.attackType = b.dataset.type; saveSettings(); refreshSitUI();
    if (play.landing && play.steps.length){ startSim(play.landing); }
  }));
  document.querySelectorAll('.chips[data-key]').forEach(c => c.querySelectorAll('button').forEach(b => b.addEventListener('click', () => onChip(c.dataset.key, b.dataset.v))));
  document.querySelectorAll('.chips-multi button').forEach(b => b.addEventListener('click', () => onChip(b.dataset.k)));
  $('btnSit').addEventListener('click', () => openSheet('sitSheet'));
  $('btnDetail').addEventListener('click', () => { renderDetail(); openSheet('detSheet'); });
  $('btnHintOk').addEventListener('click', () => { markHintSeen(); showIdleCaption(play.comp || currentComp()); });
  $('btnResetFree').addEventListener('click', () => {
    const old = custom ? clonePos(custom) : null;
    custom = clonePos(compute(S.attacker).pos); saveCustom();
    resetPlay(false, 350);
    toast('已回到隊形站位', '復原', () => { if (old){ custom = old; saveCustom(); resetPlay(false, 350); } });
  });
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
  const onResize = () => { if (screen === 'main'){ layout(); } };
  window.addEventListener('resize', onResize);
  try{ mqWide.addEventListener('change', onResize); }catch(e){ try{ mqWide.addListener(onResize); }catch(e2){} }
  if (window.ResizeObserver) new ResizeObserver(() => applyK()).observe($('courtbox'));
  document.addEventListener('visibilitychange', () => { if (document.hidden && play.auto){ play.auto = false; stopTimer(); updateButtons(); } });
  window.addEventListener('pagehide', () => { saveSettings(); if (custom) saveCustom(); });
}

/* ---------- 開始 ---------- */
function init(){
  for (const id of ['verHome', 'verKnow']) $(id).textContent = VERSION_TEXT;
  $('verHelp').textContent = `排球防守站位 ${VERSION_TEXT}　© 2026 陳則翰`;
  $('verReport').textContent = VERSION_TEXT;
  buildCourt();
  buildHelpToc();
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
  S, compute, decide, buildSteps, currentComp, startSim, resetPlay, applyStep, showScreen, openHelp, openHelpTopic, helpGo, setMode,
  get play(){ return play; }, get custom(){ return custom; }, set custom(v){ custom = v; },
  setSettings(o){ const m = sanitizeSettings(o); for (const k2 of ['mode']) if (o[k2]) m[k2] = o[k2]; Object.assign(S, m); if (m.attacker) S.attacker = Object.assign({}, m.attacker); saveSettings(); refreshSitUI(); resetPlay(false, 0); placeAttacker(); applyK(); },
  sanitizeSettings,
  openSheet, closeTop, markHintSeen, version:APP_VERSION,
  toClient(x, y){ const m = svg.getScreenCTM(); const p = svg.createSVGPoint(); p.x = x; p.y = y; const q = p.matrixTransform(m); return [q.x, q.y]; },
};
})();
