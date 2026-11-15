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
  team:{ name:'隊上的站法', short:'隊上', spots:[], passer: () => true, desc:'教練畫的單舉站法：大多是四個人接（前排攔中和舉球員不接，舉球員在 6 號位時三個人接）；我們發球時怎麼換位也照教練的圖。只有單舉有，雙輔舉、雙舉會用五人 W。' },
  w5:{ name:'五人 W 型', short:'五人W', spots:[[1.4,4.2],[4.5,3.9],[7.6,4.2],[2.9,7.0],[6.1,7.0]],
       passer: r => r !== 'S', desc:'舉球員以外的五個人排成 W：前面三個、後面兩個站在縫上。新手最常用，每個人負責的範圍小。' },
  p4:{ name:'四人接', short:'四人', spots:[[1.3,5.0],[3.4,6.3],[5.6,6.3],[7.8,5.0]],
       passer: r => r !== 'S' && r !== 'MB', desc:'舉球員和前排攔中不接，攔中可以專心準備快攻。' },
  p3:{ name:'三人接（大砲＋自由）', short:'三人', spots:[[1.6,6.0],[4.5,6.4],[7.4,6.0]],
       passer: r => r === 'OH1' || r === 'OH2' || r === 'L', desc:'只有兩個大砲和自由接，其他人躲開。每人範圍大，適合比較會接的隊伍。' },
};

// 隊上的單舉站法（教練畫的圖），照舉球員所在的號位。座標：x 由左到右、y 離網多遠（公尺）
const TEAM = {
  recv:{
    1:{ pos:{ MB:[4.5,1.1], OPP:[1.0,4.2], OH1:[7.2,4.2], S:[8.35,5.5], OH2:[2.8,6.7], L:[6.0,6.7] }, hidden:['S','MB'],
        moves:[['S',[6.5,1.0]]], swap:['OPP','OH1'], note:'前排的舉對和大砲，第一波攻擊打完再交換：舉對到右邊、大砲到左邊。' },
    6:{ pos:{ OPP:[4.4,1.1], MB:[6.4,2.0], S:[4.9,2.5], OH1:[1.35,4.9], OH2:[7.6,5.7], L:[3.7,7.1] }, hidden:['S','MB','OPP'],
        moves:[['OPP',[8.5,2.0]], ['S',[6.5,1.0]]], note:'只有三個人接：兩個大砲和後排攔中（自由）。舉對發球後往右移到 2 號位準備攻擊。' },
    5:{ pos:{ MB:[0.9,1.1], S:[1.6,2.5], OH1:[1.85,4.5], OPP:[7.2,4.8], OH2:[3.1,6.5], L:[6.0,6.5] }, hidden:['S','MB'],
        moves:[['MB',[4.0,2.75]], ['S',[6.5,1.0]]], note:'舉球員躲在左前攔中的後面，發球後沿著網子跑到右邊；攔中往中間移，準備快攻。' },
    4:{ pos:{ S:[0.85,0.85], MB:[1.2,2.4], OH1:[1.75,4.45], OPP:[7.6,4.95], OH2:[3.2,6.7], L:[5.9,6.7] }, hidden:['S','MB'],
        moves:[['S',[6.5,1.0]], ['MB',[4.8,3.4]]], note:'前排三個人都疊在左邊：舉球員沿著網子跑到右邊，攔中往中間移，大砲在左邊接球後直接攻擊。' },
    3:{ pos:{ S:[4.95,0.9], MB:[6.2,2.1], OH1:[1.5,4.65], OH2:[7.6,4.45], L:[3.2,7.1], OPP:[6.0,7.1] }, hidden:['S','MB'],
        moves:[['S',[6.5,1.0]]], note:'舉球員本來就在網前中間，攔中靠右；四個人接。' },
    2:{ pos:{ MB:[0.8,0.9], S:[6.6,0.9], OH1:[1.7,4.65], L:[7.4,4.65], OPP:[3.2,6.9], OH2:[6.0,6.9] }, hidden:['S','MB'],
        moves:[], note:'攔中靠左邊網前，舉球員本來就在右邊網前；四個人接。' },
  },
  // 我們發球：at 是發球前站的位置（發球員另外站到底線後面），noLib 代表發球的是後排攔中，自由還不能上場
  serve:{
    4:{ server:'OPP', at:{ MB:[4.55,.85], S:[3.45,2.05], OH1:[5.65,3.4], L:[4.55,5.7], OH2:[4.0,7.3] },
        note:'舉球員站在攔中左後方、大砲站在右邊靠中間，發球後兩個人交叉：舉球員到 2 號位、大砲到 4 號位。自由從中間移到 5 號位，後排大砲守 6 號位。' },
    2:{ server:'L', noLib:true, at:{ MB:[4.3,.95], OH1:[5.05,2.4], S:[7.3,1.5], OPP:[3.85,4.7], OH2:[4.45,6.3] },
        note:'發球的是後排攔中，自由還不能上場：攔中發完球守 6 號位，後排大砲到 5 號位，舉對到 1 號位。前排大砲從中間往左到 4 號位。' },
    3:{ server:'OH2', at:{ OH1:[1.6,1.5], MB:[5.05,.95], S:[4.0,2.45], L:[1.55,5.75], OPP:[7.4,5.9] },
        note:'舉球員在網前中間，發球後往右到 2 號位；攔中到中間。後排大砲發完球守 6 號位，自由守 5 號位。' },
    1:{ server:'S', at:{ MB:[4.55,.85], OH1:[5.05,2.4], OPP:[3.7,2.95], L:[5.35,6.0], OH2:[4.45,7.45] },
        note:'舉球員發球：發完球直接跑到網前 2 號位；前排的舉對退到 1 號位防守，大砲到 4 號位，自由到 5 號位。' },
    6:{ server:'OH2', at:{ OH1:[1.55,1.5], MB:[5.1,.9], OPP:[4.4,2.3], L:[1.55,5.6], S:[7.8,4.3] },
        note:'舉球員（後排）站在右邊，發球後往前到網前 2 號位；前排的舉對退到 1 號位防守，自由守 5 號位。' },
    5:{ server:'L', noLib:true, at:{ MB:[3.8,.9], OH1:[4.45,2.3], OPP:[7.4,1.5], S:[3.85,4.05], OH2:[4.5,6.3] },
        note:'發球的是後排攔中，自由還不能上場：舉球員往右前到 2 號位，舉對退到 1 號位，後排大砲到 5 號位，攔中發完球守 6 號位。' },
  },
  // 防守的基本站位：舉球員一律在 2 號位、舉對在 1 號位
  base:{ lib:{ OH1:[1.6,1.7], MB:[4.5,.85], S:[7.4,1.7], L:[1.65,5.7], OH2:[4.5,7.45], OPP:[7.4,5.9] },
         noLib:{ OH1:[1.6,1.7], MB:[4.5,.85], S:[7.4,1.7], OH2:[1.5,5.7], L:[4.5,7.5], OPP:[7.4,5.9] } },
  baseZone:{ lib:{ OH1:4, MB:3, S:2, L:5, OH2:6, OPP:1 }, noLib:{ OH1:4, MB:3, S:2, OH2:5, L:6, OPP:1 } },
  target:[6.5, 1.0],
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
function teamOK(system, form){ return form === 'team' && system === '51'; }
function receive(system, rot, form){
  const R = rotation(system, rot);
  if (teamOK(system, form)){
    const t = TEAM.recv[R.roleZone.S], pos = {};
    for (const r in t.pos) pos[r] = t.pos[r].slice();
    const passers = Object.keys(R.roleZone).filter(r => !t.hidden.includes(r));
    return { pos, passers, hidden:t.hidden.slice(), R, legal: violations(pos, R.roleZone).length === 0, note:t.note, moves:t.moves, swap:t.swap || null, team:true };
  }
  if (form === 'team') form = 'w5';
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
  return { pos:best, passers, hidden, R, legal: violations(best, R.roleZone).length === 0, note:'', moves:[], swap:null, team:false };
}
// 我們發球：發球前怎麼站、發球員是誰、發球後換到哪裡（隊上的單舉照圖；其他用輪轉的號位）
function serveSeq(system, rot, form){
  const R = rotation(system, rot);
  const at = {}; for (const r in R.roleZone) at[R.roleZone[r]] = r;
  const server = at[1];
  if (teamOK(system, form)){
    const t = TEAM.serve[R.roleZone.S];
    const pos = {}; for (const r in t.at) pos[r] = t.at[r].slice();
    pos[server] = [7.5, 9.45];
    return { R, server, at:pos, noLib:!!t.noLib, note:t.note, team:true };
  }
  const ZC = { 4:[1.5,1.6], 3:[4.5,1.6], 2:[7.5,1.6], 5:[1.5,6.3], 6:[4.5,6.3], 1:[7.5,6.3] };
  const pos = {}; for (const r in R.roleZone) pos[r] = ZC[R.roleZone[r]].slice();
  pos[server] = [7.5, 9.45];
  return { R, server, at:pos, noLib: server === 'L', note:'', team:false };
}
// 某個人要注意的站位規則（給畫面說明用）
function rulesFor(role, roleZone){
  const at = {}; for (const r in roleZone) at[roleZone[r]] = r;
  const z = roleZone[role], out = [];
  for (const [f, b] of FB_PAIRS){ if (f === z) out.push({ rel:'前面', other:at[b], oz:b }); if (b === z) out.push({ rel:'後面', other:at[f], oz:f }); }
  for (const [l, r] of LR_PAIRS){ if (l === z) out.push({ rel:'左邊', other:at[r], oz:r }); if (r === z) out.push({ rel:'右邊', other:at[l], oz:l }); }
  return out;
}

window.VBRot = { SYSTEMS, FORMS, FB_PAIRS, LR_PAIRS, TEAM, rotation, receive, serveSeq, teamOK, violations, rulesFor, FRONT };
})();
