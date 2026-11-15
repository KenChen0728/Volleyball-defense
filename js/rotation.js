/* 排球防守站位：輪轉與接發球站位
 * 座標和 app.js 相同：x 0~9 由左到右，y 0~9 由網子往底線（公尺）。
 * 號位（zone）：前排 4 3 2，後排 5 6 1。
 */
(function(){
'use strict';

// 進攻系統與上場順序（1 號位開始，依輪轉方向排）
const SYSTEMS = {
  '51': { name:'單舉（5-1）', short:'單舉', order:['S','OH1','MB1','OPP','OH2','MB2'],
          desc:'一位舉球員六輪都舉；她在前排時只有兩個前排攻擊手。' },
  '62': { name:'雙輔舉（6-2）', short:'雙輔舉', order:['S1','OH1','MB1','S2','OH2','MB2'],
          desc:'兩位舉球員對角站：後排的那位插上舉球，前排的那位當輔舉攻擊。' },
  '42': { name:'雙舉（4-2）', short:'雙舉', order:['S1','OH1','MB1','S2','OH2','MB2'],
          desc:'兩位舉球員對角站：前排的那位舉球，後排的那位當一般後排防守。' },
};
const FRONT = z => z === 2 || z === 3 || z === 4;
const FB_PAIRS = [[4,5],[3,6],[2,1]];          // 前排要在對應後排的前面
const LR_PAIRS = [[4,3],[3,2],[5,6],[6,1]];     // 同一排左右順序不能換
const MARGIN = 0.3;

// rot：上場順序第一位（S 或 S1）所在的號位；輪轉方向 1→6→5→4→3→2
function rotation(system, rot){
  const sys = SYSTEMS[system] || SYSTEMS['51'];
  const id2zone = {};
  sys.order.forEach((id, i) => { id2zone[id] = ((rot - 1 + i) % 6) + 1; });
  const front = id => FRONT(id2zone[id]);
  const roleOf = {};
  roleOf[['OH1','OH2'].find(front)] = 'OH1';
  roleOf[['OH1','OH2'].find(i => !front(i))] = 'OH2';
  roleOf[['MB1','MB2'].find(front)] = 'MB';
  roleOf[['MB1','MB2'].find(i => !front(i))] = 'L';      // 後排的攔中換自由
  if (system === '62'){ roleOf[['S1','S2'].find(i => !front(i))] = 'S'; roleOf[['S1','S2'].find(front)] = 'OPP'; }
  else if (system === '42'){ roleOf[['S1','S2'].find(front)] = 'S'; roleOf[['S1','S2'].find(i => !front(i))] = 'OPP'; }
  else { roleOf.S = 'S'; roleOf.OPP = 'OPP'; }
  const roleZone = {};
  for (const id in roleOf) roleZone[roleOf[id]] = id2zone[id];
  return { roleZone, roleOf, id2zone, setterFront: FRONT(roleZone.S), system, rot };
}

// 接發球隊形：誰接、站哪裡
const FORMS = {
  w5:{ name:'五人 W 型', short:'五人W', spots:[[1.4,4.2],[4.5,3.9],[7.6,4.2],[2.9,7.0],[6.1,7.0]],
       passer: r => r !== 'S', desc:'舉球員以外的五個人排成 W：前面三個、後面兩個站在縫上。新手最常用，每個人負責的範圍小。' },
  p4:{ name:'四人接', short:'四人', spots:[[1.3,5.0],[3.4,6.3],[5.6,6.3],[7.8,5.0]],
       passer: r => r !== 'S' && r !== 'MB', desc:'舉球員和前排攔中不接，攔中可以專心準備快攻。' },
  p3:{ name:'三人接（大砲＋自由）', short:'三人', spots:[[1.6,6.0],[4.5,6.4],[7.4,6.0]],
       passer: r => r === 'OH1' || r === 'OH2' || r === 'L', desc:'只有兩個大砲和自由接，其他人躲開。每人範圍大，適合比較會接的隊伍。' },
};

function prefHidden(role, zone){
  if (role === 'S') return FRONT(zone) ? [6.2, 0.8] : ({1:[7.7,1.5], 6:[5.4,1.6], 5:[2.8,1.6]}[zone]);
  if (role === 'MB') return [4.5, 0.8];
  if (role === 'OPP') return FRONT(zone) ? [8.0, 0.8] : [8.4, 3.4];
  return [4.5, 0.8];
}
function permutations(arr){
  if (arr.length <= 1) return [arr.slice()];
  const out = [];
  arr.forEach((v, i) => { for (const p of permutations(arr.slice(0, i).concat(arr.slice(i + 1)))) out.push([v].concat(p)); });
  return out;
}
// 依號位找出誰違反站位規則
function violations(pos, roleZone){
  const at = {}; for (const r in roleZone) at[roleZone[r]] = r;
  const out = [];
  for (const [f, b] of FB_PAIRS){ const pf = pos[at[f]], pb = pos[at[b]]; if (pf[1] + MARGIN * .5 > pb[1]) out.push({ type:'fb', a:at[f], b:at[b], za:f, zb:b }); }
  for (const [l, r] of LR_PAIRS){ const pl = pos[at[l]], pr = pos[at[r]]; if (pl[0] + MARGIN * .5 > pr[0]) out.push({ type:'lr', a:at[l], b:at[r], za:l, zb:r }); }
  return out;
}
// 把站位推到合法：每條規則差多少就把兩個人各推開一些（躲著的人推多一點）
function repair(pos, roleZone, weight){
  const at = {}; for (const r in roleZone) at[roleZone[r]] = r;
  for (let it = 0; it < 80; it++){
    let ok = true;
    for (const [f, b] of FB_PAIRS){
      const a = at[f], c = at[b], d = pos[a][1] + MARGIN - pos[c][1];
      if (d > 0){ ok = false; const wa = weight[a], wc = weight[c], s = wa + wc; pos[a][1] -= d * wa / s; pos[c][1] += d * wc / s; }
    }
    for (const [l, r] of LR_PAIRS){
      const a = at[l], c = at[r], d = pos[a][0] + MARGIN - pos[c][0];
      if (d > 0){ ok = false; const wa = weight[a], wc = weight[c], s = wa + wc; pos[a][0] -= d * wa / s; pos[c][0] += d * wc / s; }
    }
    for (const k in pos){ pos[k][0] = Math.max(0.3, Math.min(8.7, pos[k][0])); pos[k][1] = Math.max(0.5, Math.min(8.6, pos[k][1])); }
    if (ok) break;
  }
  return pos;
}
function receive(system, rot, form){
  const R = rotation(system, rot);
  const F = FORMS[form] || FORMS.w5;
  const roles = Object.keys(R.roleZone);
  const passers = roles.filter(F.passer);
  const hidden = roles.filter(r => !passers.includes(r));
  const spots = F.spots.slice(0, passers.length);
  const weight = {}; for (const r of roles) weight[r] = passers.includes(r) ? .25 : 1;
  let best = null, bestCost = Infinity;
  for (const perm of permutations(passers)){
    const pos = {};
    perm.forEach((r, i) => { pos[r] = spots[i].slice(); });
    for (const r of hidden) pos[r] = prefHidden(r, R.roleZone[r]).slice();
    repair(pos, R.roleZone, weight);
    const v = violations(pos, R.roleZone).length;
    let cost = v * 100;
    perm.forEach((r, i) => { cost += Math.hypot(pos[r][0] - spots[i][0], pos[r][1] - spots[i][1]); });
    for (const r of hidden){ const p = prefHidden(r, R.roleZone[r]); cost += .6 * Math.hypot(pos[r][0] - p[0], pos[r][1] - p[1]); }
    // 讓自由、大砲多站後面的位置（最會接的人守大的範圍）
    perm.forEach((r, i) => { if ((r === 'L' || r === 'OH2') && spots[i][1] < 5 && form === 'w5') cost += .4; });
    if (cost < bestCost){ bestCost = cost; best = pos; }
  }
  // 兩個人太靠近時稍微分開（不能破壞規則）
  const ks = Object.keys(best);
  for (let it = 0; it < 40; it++){
    let moved = false;
    for (let i = 0; i < ks.length; i++) for (let j = i + 1; j < ks.length; j++){
      const a = best[ks[i]], b = best[ks[j]], dx = b[0] - a[0], dy = b[1] - a[1], d = Math.hypot(dx, dy);
      if (d < .95){ moved = true; const push = (.95 - d) / 2, ux = d ? dx / d : 1, uy = d ? dy / d : 0;
        const wa = weight[ks[i]], wb = weight[ks[j]], s = wa + wb;
        a[0] -= ux * push * 2 * wa / s; a[1] -= uy * push * 2 * wa / s; b[0] += ux * push * 2 * wb / s; b[1] += uy * push * 2 * wb / s; }
    }
    repair(best, R.roleZone, weight);
    if (!moved) break;
  }
  return { pos:best, passers, hidden, R, legal: violations(best, R.roleZone).length === 0 };
}
// 某個人要注意的站位規則（給畫面說明用）
function rulesFor(role, roleZone){
  const at = {}; for (const r in roleZone) at[roleZone[r]] = r;
  const z = roleZone[role], out = [];
  for (const [f, b] of FB_PAIRS){ if (f === z) out.push({ rel:'前面', other:at[b], oz:b }); if (b === z) out.push({ rel:'後面', other:at[f], oz:f }); }
  for (const [l, r] of LR_PAIRS){ if (l === z) out.push({ rel:'左邊', other:at[r], oz:r }); if (r === z) out.push({ rel:'右邊', other:at[l], oz:l }); }
  return out;
}

window.VBRot = { SYSTEMS, FORMS, FB_PAIRS, LR_PAIRS, rotation, receive, violations, rulesFor, FRONT };
})();
