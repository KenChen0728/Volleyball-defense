/* 排球站位：站位圖解（純教學的示意圖，執行時畫成 SVG） */
(function(){
'use strict';
const COL = { front:'var(--front)', back:'var(--back)', set:'var(--setter)', lib:'var(--lib)', opp:'var(--oppfill)', ghost:'var(--muted)' };
const ZC = { 4:[1.5,1.5], 3:[4.5,1.5], 2:[7.5,1.5], 5:[1.5,6], 6:[4.5,6], 1:[7.5,6] };
const f2 = v => (+v).toFixed(2);
function esc(s){ return String(s).replace(/[&<>"]/g, c => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;' }[c])); }
function arrow(a, b, o){
  o = o || {};
  const col = o.c || 'var(--ink)', w = o.w || .07, dash = o.dash ? ` stroke-dasharray="${o.dash}"` : '';
  const v = [b[0]-a[0], b[1]-a[1]], n = Math.hypot(v[0], v[1]) || 1, u = [v[0]/n, v[1]/n], s = o.head || .28;
  const pn = [-u[1], u[0]], bend = o.bend || 0;
  const mid = [(a[0]+b[0])/2 + pn[0]*bend, (a[1]+b[1])/2 + pn[1]*bend];
  const du = bend ? (() => { const d = [b[0]-mid[0], b[1]-mid[1]], m = Math.hypot(d[0], d[1]) || 1; return [d[0]/m, d[1]/m]; })() : u, dn = [-du[1], du[0]];
  const path = bend ? `M${f2(a[0])} ${f2(a[1])} Q${f2(mid[0])} ${f2(mid[1])} ${f2(b[0])} ${f2(b[1])}` : `M${f2(a[0])} ${f2(a[1])} L${f2(b[0])} ${f2(b[1])}`;
  const head = `M${f2(b[0]-du[0]*s+dn[0]*s*.75)} ${f2(b[1]-du[1]*s+dn[1]*s*.75)} L${f2(b[0])} ${f2(b[1])} L${f2(b[0]-du[0]*s-dn[0]*s*.75)} ${f2(b[1]-du[1]*s-dn[1]*s*.75)}`;
  return `<path d="${path}" fill="none" style="stroke:${col}" stroke-width="${w}" stroke-linecap="round"${dash} opacity="${o.op || .85}"/><path d="${head}" fill="none" style="stroke:${col}" stroke-width="${w}" stroke-linecap="round" stroke-linejoin="round" opacity="${o.op || .85}"/>`;
}
function shorten(a, b, s1, s2){ const v = [b[0]-a[0], b[1]-a[1]], n = Math.hypot(v[0], v[1]) || 1; return [[a[0] + v[0]/n*s1, a[1] + v[1]/n*s1], [b[0] - v[0]/n*s2, b[1] - v[1]/n*s2]]; }
function token(p){
  const c = COL[p.g] || p.c || COL.front, r = p.r || .46;
  let s = '';
  if (p.ring) s += `<circle cx="${f2(p.x)}" cy="${f2(p.y)}" r="${f2(r + .16)}" fill="none" style="stroke:var(--ink)" stroke-width=".08"${p.ring === 'dash' ? ' stroke-dasharray=".14 .1"' : ''}/>`;
  if (p.ghost) s += `<circle cx="${f2(p.x)}" cy="${f2(p.y)}" r="${f2(r)}" style="fill:var(--surface);stroke:${c}" stroke-width=".07" stroke-dasharray=".14 .1"/>`;
  else s += `<circle cx="${f2(p.x)}" cy="${f2(p.y)}" r="${f2(r)}" style="fill:${c}" stroke="#fff" stroke-width=".05"/>`;
  const t = p.t || '', fs = t.length > 2 ? .26 : (t.length > 1 ? .32 : .38);
  s += `<text x="${f2(p.x)}" y="${f2(p.y + .02)}" font-size="${fs}" font-weight="700" text-anchor="middle" dominant-baseline="central" style="fill:${p.ghost ? c : '#fff'}">${esc(t)}</text>`;
  if (p.z){ s += `<circle cx="${f2(p.x + .42)}" cy="${f2(p.y - .42)}" r=".24" style="fill:var(--surface);stroke:var(--ink)" stroke-width=".035"/><text x="${f2(p.x + .42)}" y="${f2(p.y - .4)}" font-size=".3" font-weight="700" text-anchor="middle" dominant-baseline="central" style="fill:var(--ink)">${p.z}</text>`; }
  if (p.tag){ const w = .25 * p.tag.length + .3, ty = p.tagBelow ? p.y + .88 : p.y - .88;
    s += `<rect x="${f2(p.x - w/2)}" y="${f2(ty - .22)}" width="${f2(w)}" height=".44" rx=".13" style="fill:var(--ink)"/><text x="${f2(p.x)}" y="${f2(ty + .02)}" font-size=".3" font-weight="700" text-anchor="middle" dominant-baseline="central" style="fill:var(--bg)">${esc(p.tag)}</text>`; }
  return s;
}
// 畫一個場地：o.players、o.arrows、o.polys、o.circles、o.texts、o.lines
function court(o){
  const vb = o.vb || [-0.6, -2.1, 10.2, 11.9];
  let s = `<svg viewBox="${vb.join(' ')}" role="img" aria-label="${esc(o.label || '站位示意圖')}" xmlns="http://www.w3.org/2000/svg">`;
  s += '<defs><pattern id="dhatch" width=".3" height=".3" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><rect width=".3" height=".3" style="fill:var(--tipfill)"/><line x1=".08" y1="0" x2=".08" y2=".3" style="stroke:var(--tip)" stroke-width=".08"/></pattern>' +
       '<clipPath id="dclip"><rect x="0" y="0" width="9" height="9"/></clipPath></defs>';
  s += `<rect x="0" y="${vb[1]}" width="9" height="${-vb[1]}" style="fill:var(--opp-court)"/><rect x="0" y="0" width="9" height="9" style="fill:var(--court)"/><rect x="0" y="0" width="9" height="3" style="fill:var(--court-front)"/>`;
  s += '<g clip-path="url(#dclip)">';
  for (const p of o.polys || []){
    const pts = p.pts.map(q => q.map(f2).join(',')).join(' ');
    if (p.hatch) s += `<polygon points="${pts}" style="fill:var(--court)" opacity=".85"/><polygon points="${pts}" fill="url(#dhatch)"${p.stroke ? ' style="stroke:var(--tip)" stroke-width=".04" stroke-dasharray=".12 .08"' : ''}/>`;
    else s += `<polygon points="${pts}" style="fill:${p.fill || 'var(--spike)'}" opacity="${p.op || .16}"/>`;
  }
  s += '</g>';
  s += '<g style="stroke:var(--courtline)" fill="none"><rect x="0" y="0" width="9" height="9" stroke-width=".07"/><line x1="0" y1="3" x2="9" y2="3" stroke-width=".06"/></g>';
  if (o.zones !== false) for (const z in ZC){ const c = ZC[z]; s += `<text x="${c[0]}" y="${c[1]}" font-size="1.15" font-weight="700" text-anchor="middle" dominant-baseline="central" style="fill:var(--zone-num)">${z}</text>`; }
  for (const c of o.circles || []) s += `<circle cx="${f2(c.x)}" cy="${f2(c.y)}" r="${f2(c.r)}" style="fill:${c.c};stroke:${c.c}" fill-opacity="${c.fo || .13}" stroke-opacity=".5" stroke-width=".04"${c.dash ? ' stroke-dasharray=".14 .1"' : ''}/>`;
  for (const l of o.lines || []) s += `<line x1="${f2(l[0][0])}" y1="${f2(l[0][1])}" x2="${f2(l[1][0])}" y2="${f2(l[1][1])}" style="stroke:${l[2] || 'var(--ink)'}" stroke-width="${l[3] || .045}" stroke-dasharray=".16 .12" opacity=".5"/>`;
  s += '<line x1="-.35" y1="0" x2="9.35" y2="0" style="stroke:var(--ink)" stroke-width=".12" stroke-linecap="round"/>';
  if (o.block) s += `<rect x="${f2(o.block[0])}" y="-.09" width="${f2(o.block[1] - o.block[0])}" height=".18" rx=".08" style="fill:var(--ink)" opacity=".85"/>`;
  for (const t of o.target ? [o.target] : []) s += `<circle cx="${f2(t[0])}" cy="${f2(t[1])}" r=".8" style="fill:var(--target);stroke:var(--target)" fill-opacity=".12" stroke-width=".04" stroke-dasharray=".14 .1"/>`;
  for (const a of o.arrows || []) s += arrow(a.from, a.to, a);
  for (const p of o.opp || []) s += token(Object.assign({ g:'opp' }, p));
  for (const p of o.players || []) s += token(p);
  for (const t of o.texts || []) s += `<text x="${f2(t.x)}" y="${f2(t.y)}" font-size="${t.size || .36}" font-weight="${t.bold === false ? 500 : 700}" text-anchor="${t.anchor || 'middle'}" dominant-baseline="central" style="fill:${t.c || 'var(--ink)'}">${esc(t.t)}</text>`;
  return s + '</svg>';
}

function topics(api){
  const { ROLE_INFO, groupOf } = api;
  const RT = api.rt();
  const R = window.VBRot;
  const S = api.S || { recv:'w5', system:'51', serveX:1.6 };
  const form = R.FORMS[S.recv] && S.recv !== 'team' ? S.recv : 'w5', F = R.FORMS[form];
  const short = r => ROLE_INFO[r].name;
  const withLib = (noLib, fn) => { api.setLibOff(noLib); try{ return fn(); } finally { api.setLibOff(!api.useLib()); } };
  const pl = (pos, lu, extra) => api.ROLES.map(r => Object.assign({ x:pos[r][0], y:pos[r][1], t:ROLE_INFO[r].tok, g:groupOf(r, lu), z:lu[r].zone }, (extra && extra[r]) || {}));
  const luOf = Rr => { const lu = {}; for (const r of api.ROLES) lu[r] = { zone:Rr.roleZone[r], front:R.FRONT(Rr.roleZone[r]) }; return lu; };
  const radiusOf = f => f === 'p3' ? 2.6 : (f === 'p4' ? 2.3 : 2.0);
  // 接發球一張圖
  function recvCard(sys, rot, f, title){
    const rc = R.receive(sys, rot, f), lu = luOf(rc.R), at = {};
    for (const r of api.ROLES) at[lu[r].zone] = r;
    const ex = {}; for (const r of rc.hidden) ex[r] = { tag:'不接' };
    const circles = rc.passers.map(r => ({ x:rc.pos[r][0], y:rc.pos[r][1], r:radiusOf(f), c:'var(--' + ({ front:'front', back:'back', set:'setter', lib:'lib' })[groupOf(r, lu)] + ')' }));
    const sp = rc.pos.S, ends = shorten(sp, [RT[0] + .1, RT[1] + .25], .55, .2);
    const lines = [];
    for (const [a, b] of R.FB_PAIRS.concat(R.LR_PAIRS)) lines.push([rc.pos[at[a]], rc.pos[at[b]]]);
    const setterTxt = lu.S.front ? `舉球員在前排（${lu.S.zone} 號位），發球後沿著網子移到目標區。` : `舉球員在後排（${lu.S.zone} 號位），躲在前面的人後面，發球員一擊球就插上到目標區。`;
    return { h:title, svg:() => court({ label:title, players:pl(rc.pos, lu, ex), circles, lines, target:[RT[0], RT[1]], arrows:[{ from:ends[0], to:ends[1], c:'var(--setter)', dash:'.18 .12', w:.08 }],
      opp:[{ x:S.serveX || 1.6, y:-1.45, t:'發' }], texts:[{ x:4.5, y:-.75, t:'虛線：發球前不能前後、左右交換的兩個人', size:.3, bold:false, c:'var(--muted)' }] }),
      p:`${setterTxt}不接發球：${rc.hidden.map(short).join('、')}。前排：${[4,3,2].map(z => short(at[z])).join('、')}；後排：${[5,6,1].map(z => short(at[z])).join('、')}。` };
  }
  const sysCards = (sys, rots) => rots.map(rot => { const ri = R.rotation(sys, rot); return recvCard(sys, rot, form, `舉球員在 ${ri.roleZone.S} 號位`); });
  // 防守一張圖
  function defCard(set, att, h, p){
    const comp = api.defense(set, att);
    const z = api.zones(att, comp);
    const ex = {};
    for (const r of comp.blockers) ex[r] = { tag:'攔網' };
    if (comp.tip && !comp.blockers.includes(comp.tip)) ex[comp.tip] = { tag:'守吊球' };
    const arrows = [];
    for (const r of api.ROLES){ const a = comp.base[r], b = comp.pos[r]; if (!a || !b || Math.hypot(a[0]-b[0], a[1]-b[1]) < .5) continue; const e = shorten(a, b, .15, .55); arrows.push({ from:e[0], to:e[1], c:'var(--muted)', dash:'.16 .1', w:.06 }); }
    const polys = [{ pts:z.spike, fill:'var(--spike)', op:.16 }, { pts:z.band, hatch:true }];
    if (z.shadow) polys.push({ pts:z.shadow, hatch:true, stroke:true });
    return { h, p, svg:() => court({ label:h, polys, block:comp.seg, players:pl(comp.pos, comp.lu, ex), arrows, opp:[{ x:att.x, y:att.y, t:'攻' }] }) };
  }
  const att = { x:8.2, y:-1.3 };
  const baseComp = api.defense({}, att);
  // 隊上的單舉（教練畫的圖）
  const TM = R.TEAM;
  function teamRecvCard(rot){
    const rc = R.receive('51', rot, 'team'), lu = luOf(rc.R), at = {};
    for (const r of api.ROLES) at[lu[r].zone] = r;
    const ex = {}; for (const r of rc.hidden) ex[r] = { tag:'不接' };
    const lines = R.FB_PAIRS.concat(R.LR_PAIRS).map(([a, b]) => [rc.pos[at[a]], rc.pos[at[b]]]);
    const arrows = rc.moves.map(([r, to]) => { const e = shorten(rc.pos[r], to, .55, .12); return { from:e[0], to:e[1], dash:'.18 .12', c: r === 'S' ? 'var(--setter)' : 'var(--ink)', w:.07 }; });
    if (rc.swap){ const a = rc.pos[rc.swap[0]], b = rc.pos[rc.swap[1]], e = shorten(a, b, .6, .6); arrows.push({ from:e[0], to:e[1], c:'var(--opp)', dash:'.16 .1', w:.06 }); arrows.push({ from:e[1], to:e[0], c:'var(--opp)', dash:'.16 .1', w:.06 }); }
    const texts = rc.swap ? [{ x:(rc.pos[rc.swap[0]][0] + rc.pos[rc.swap[1]][0]) / 2, y:rc.pos[rc.swap[0]][1] - .55, t:'第一波打完交換', size:.32, c:'var(--opp)' }] : [];
    texts.push({ x:4.5, y:-.75, t:'虛線：發球前不能前後、左右交換的兩個人', size:.3, bold:false, c:'var(--muted)' });
    return { h:`接發球：舉球員在 ${rot} 號位`, p:`${rc.note}接發球：${rc.passers.map(short).join('、')}。`,
      svg:() => withLib(!api.useLib(), () => court({ label:`隊上接發球：舉球員在 ${rot} 號位`, players:pl(rc.pos, lu, ex), lines, arrows, texts, target:RT, opp:[{ x:1.6, y:-1.45, t:'發' }] })) };
  }
  function teamServeCard(rot){
    const sq = R.serveSeq('51', rot, 'team'), noLib = sq.noLib || !api.useLib(), lu = luOf(sq.R), kk = noLib ? 'noLib' : 'lib', base = TM.base[kk];
    const arrows = api.ROLES.filter(r => Math.hypot(sq.at[r][0] - base[r][0], sq.at[r][1] - base[r][1]) > .5).map(r => { const e = shorten(sq.at[r], base[r], .55, .15); return { from:e[0], to:e[1], c:'var(--opp)', w:.07 }; });
    const ghosts = api.ROLES.map(r => ({ x:base[r][0], y:base[r][1], t:'', ghost:true, g:groupOf(r, lu), r:.3 }));
    return { h:`我們發球：舉球員在 ${rot} 號位`, p:sq.note + '紅色箭頭是發球後要換去的位置（虛線圈）。',
      svg:() => withLib(noLib, () => court({ vb:[-0.6, -1.4, 10.2, 11.75], label:`我們發球：舉球員在 ${rot} 號位`, players:ghosts.concat(pl(sq.at, lu, { [sq.server]:{ tag:'發球', tagBelow:false } })), arrows })) };
  }
  const T = [];
  T.push({ id:'basics', title:'號位和站位規則', sub:'先看這個', cards:[
    { h:'號位和輪轉方向', p:'網前從左到右是 4、3、2，後排是 5、6、1（站在自己底線看網子）。發球的人在 1 號位，到底線後面發球。贏回發球權時，大家順時針轉一格：2→1、1→6、6→5、5→4、4→3、3→2。',
      svg:() => court({ label:'號位和輪轉方向', zones:true, arrows:[[2,1],[1,6],[6,5],[5,4],[4,3],[3,2]].map(([a, b]) => { const e = shorten(ZC[a], ZC[b], .9, .9); return { from:e[0], to:e[1], bend:.45, c:'var(--muted)', w:.08 }; }),
        texts:[{ x:7.5, y:8.5, t:'發球的人', size:.34 }] }) },
    { h:'發球那一刻：照輪轉的順序站', p:'接發球的隊伍，前排要比同一直排的後排靠網（4 比 5、3 比 6、2 比 1），同一排左右順序不能換（4 在 3 左邊、3 在 2 左邊；5、6、1 也一樣）。只比相鄰的兩個人，所以可以斜著站。發球員一擊球，就可以到處移動。',
      src:'根據：排球規則 7.4（2025～2028 中文排球規則）', svg:() => court({ label:'站位規則', players:[4,3,2,5,6,1].map(z => ({ x:ZC[z][0], y:ZC[z][1], t:String(z), g: z >= 2 && z <= 4 ? 'front' : 'back' })),
        lines:R.FB_PAIRS.concat(R.LR_PAIRS).map(([a, b]) => [ZC[a], ZC[b], 'var(--ink)', .06]),
        texts:[{ x:1.5, y:3.75, t:'4 要在 5 前面', size:.3, bold:false }, { x:3, y:.55, t:'4 在 3 左邊', size:.3, bold:false }] }) },
    { h:'可以斜著站：舉球員躲起來', p:'例：單舉、舉球員在 1 號位。她只要比 2 號位的人靠後、比 6 號位的人靠右，就可以躲在 2 號位的人後面，發球後最快跑到網前。2025～2028 新規則：發球的那一隊，發球那一刻可以自由站。',
      src:'根據：排球規則 7.4、7.4.4', svg:() => { const rc = R.receive('51', 1, 'w5'), lu = luOf(rc.R); const at = {}; for (const r of api.ROLES) at[lu[r].zone] = r;
        return court({ label:'舉球員躲起來', players:pl(rc.pos, lu, { S:{ ring:true, tag:'躲' } }), lines:[[rc.pos[at[2]], rc.pos[at[1]], 'var(--ink)', .07], [rc.pos[at[6]], rc.pos[at[1]], 'var(--ink)', .07]], target:RT,
          arrows:[{ from:shorten(rc.pos.S, RT, .55, .3)[0], to:shorten(rc.pos.S, RT, .55, .3)[1], c:'var(--setter)', dash:'.18 .12', w:.08 }] }); } },
  ]});
  T.push({ id:'team-recv', title:'隊上單舉：接發球', sub:'教練畫的六輪', cards:[1,6,5,4,3,2].map(teamRecvCard) });
  T.push({ id:'team-serve', title:'隊上單舉：我們發球怎麼換位', sub:'教練畫的六輪', cards:[1,6,5,4,3,2].map(teamServeCard) });
  T.push({ id:'recvforms', title:'接發球隊形', sub:'五人W、四人、三人', cards:[
    Object.assign(recvCard('51', 1, 'w5', '五人 W 型（新手最常用）'), { p:'舉球員以外的五個人排成 W：前面三個、後面兩個站在前面兩人的縫後面。每個人負責的範圍小，適合剛開始的隊伍；後面的人負責比較深的球。缺點是接的人多、縫也多，要先講好誰接。', src:'根據：USA Volleyball《Volleyball Systems & Strategies》' }),
    Object.assign(recvCard('51', 1, 'p4', '四人接'), { p:'舉球員和前排攔中不接，攔中可以專心準備快攻；其他四個人排成一排或淺 U 型。比五人 W 少一點縫，每個人的範圍大一點。', src:'根據：Sportplan、Coaching Volleyball' }),
    Object.assign(recvCard('51', 1, 'p3', '三人接（大砲＋自由）'), { p:'只有兩個大砲和自由接，其他人躲開、準備進攻。縫最少、溝通最簡單，但每個人範圍大，適合比較會接的隊伍。大部分高水準的隊伍用這個。', src:'根據：Hoopsking、Sportplan' }),
  ]});
  T.push({ id:'r51', title:'單舉（5-1）六輪', sub:`${F.short}接發`, cards:sysCards('51', [1,6,5,4,3,2]) });
  T.push({ id:'r62', title:'雙輔舉（6-2）三種輪', sub:`${F.short}接發`, cards:sysCards('62', [1,6,5]).map(c => Object.assign(c, { p:c.p + '另一位舉球員在前排當舉對攻擊，所以前排一直有三個攻擊手。' })) });
  T.push({ id:'r42', title:'雙舉（4-2）三種輪', sub:`${F.short}接發`, cards:sysCards('42', [4,3,2]).map(c => Object.assign(c, { p:c.p + '前排的舉球員舉球，前排只剩兩個攻擊手，但舉球員本來就在網前，比較簡單。' })) });
  T.push({ id:'defense', title:'防守隊形', sub:'對方從我們右邊打', cards:[
    { h:'基本站位：先站好再看', p:'對方還沒舉球時，前排靠網準備攔網，後排站在自己的區域。看對方舉給誰，再移動到防守位置。', svg:() => court({ label:'基本站位', players:pl(baseComp.base, baseComp.lu), opp:[{ x:4.5, y:-1.3, t:'舉' }] }) },
    defCard({ formation:'ours', canR:false }, att, '舉球留網前（隊上）', '舉球員和舉對都不攔網。舉球員一律守 2 號位，接 2 號位前面的短球；比較長的球給後面 1 號位的舉對。有自由時大砲守 6、自由守 5 的斜線；沒有自由時攔中守 6、大砲守 5。紅色是扣球打得到的地方，橘色斜線是只能吊球的地方。'),
    defCard({ formation:'up' }, att, '後中靠前（心跟進）', '6 號位（或舉球員）站到攔網後面、三米線附近專守吊球，兩邊的後排站深。對手吊球、推球多時適合。紅色是扣球打得到的地方，橘色斜線是只能吊球的地方。'),
    defCard({ formation:'rot' }, att, '邊上的人往前（邊跟進）', '攔網那一側的後排（1 號位）往前守吊球，6 號位轉到直線深球，5 號位守斜線。'),
    defCard({ formation:'per' }, att, '後中靠後（心後）', '後排三個人靠邊線、底線站，重扣最好接；吊球靠 1 號位往前和退下來的前排，離得比較遠。'),
    defCard({ formation:'up', canOH:false, canR:false }, att, '只有攔中會攔網', '大砲、舉對不夠高時：攔中自己攔，邊上的前排退到三米線附近守吊球和小斜線。紅色變多，因為攔網擋住的地方變少了。'),
    defCard({ formation:'up', canOH:false, canMB:false, canR:false }, att, '沒有人攔網', '前排三個人平均分開、離網兩公尺左右蹲低，不要擋到後排看球；後排站深、站開。紅色最多，對方可以打任何地方。'),
  ]});
  // 保護攻擊手
  const H = api.HIT.OH1, cs = api.cover(H);
  T.push({ id:'cover', title:'保護和補位', cards:[
    { h:'保護攻擊手：3 近 2 遠', p:'舉球出去後，離攻擊手最近的三個人蹲低靠近（像一個半圓），另外兩個人站後面一點。球被攔回來時，才接得到。', src:'根據：Coaching Volleyball（Hitter coverage）',
      svg:() => court({ label:'保護攻擊手', players:[{ x:H[0], y:H[1] + .2, t:'攻', g:'front', tag:'攻擊' }].concat(cs.close.map(p => ({ x:p[0], y:p[1], t:'近', g:'back' })), cs.deep.map(p => ({ x:p[0], y:p[1], t:'遠', g:'lib' }))), block:[.4, 1.6] }) },
    { h:'有人接球時，其他人做什麼', p:'最近的人上前接（標「接」），另一個人跟到她後面保護（補位），旁邊的人往她空出來的地方移一點；舉球員往網前的舉球位置跑，大家都把球往那裡接。球接起來後，大家往前移動，不要往後退。',
      svg:() => court({ label:'補位', players:[{ x:1.6, y:6.2, t:'接', g:'lib', ring:true }, { x:2.6, y:7.6, t:'補', g:'back', ring:'dash', tag:'補位', tagBelow:true }, { x:4.0, y:6.6, t:'移', g:'back' }, { x:6.7, y:2.6, t:'舉', g:'set' }],
        arrows:[{ from:[2.4, 4.4], to:[1.75, 5.7], c:'var(--opp)', w:.07 }, { from:[7.6, 4.4], to:[6.8, 3.0], c:'var(--setter)', dash:'.16 .1' }], target:api.rt() }) },
  ]});
  T.push({ id:'stance', title:'準備姿勢和步法', cards:STANCE });
  return T;
}

/* ---------- 姿勢圖（側面、腳的位置） ---------- */
function fig(o){
  // 側面的人：o.knee 膝蓋彎的程度（0 直立～1 很低），o.arms 'low' | 'front' | 'wide'
  const k2 = o.knee, hipY = 70 + k2 * 18, kneeX = 92 + k2 * 10, kneeY = 96 + k2 * 6, footY = 124;
  const sh = [86 + k2 * 6, 40 + k2 * 16], head = [sh[0] + 6, sh[1] - 13];
  const hip = [78, hipY];
  const arm = o.arms === 'front' ? `M${sh[0]} ${sh[1] + 4} L${sh[0] + 22} ${sh[1] + 24} L${sh[0] + 30} ${sh[1] + 30}` : `M${sh[0]} ${sh[1] + 4} L${sh[0] + 14} ${sh[1] + 30} L${sh[0] + 20} ${sh[1] + 40}`;
  return `<g fill="none" stroke="currentColor" stroke-width="5" stroke-linecap="round" stroke-linejoin="round">` +
    `<circle cx="${head[0]}" cy="${head[1]}" r="9" fill="currentColor" stroke="none"/>` +
    `<path d="M${sh[0]} ${sh[1]} L${hip[0]} ${hip[1]}"/>` +
    `<path d="M${hip[0]} ${hip[1]} L${kneeX} ${kneeY} L${kneeX - 6} ${footY}"/>` +
    `<path d="M${hip[0]} ${hip[1]} L${kneeX - 14} ${kneeY + 2} L${kneeX - 22} ${footY}" opacity=".55"/>` +
    `<path d="${arm}"/>` +
    `<path d="M${kneeX - 14} ${footY + 2} L${kneeX + 6} ${footY + 2}" opacity=".5"/></g>`;
}
function feet(o){
  // 從上面看兩隻腳：o.stagger 右腳往前多少，o.wide 寬度
  const w = o.wide || 34, st = o.stagger || 0, cx = 70;
  const foot = (x, y) => `<path d="M${x} ${y} c-6 0 -8 -10 -7 -18 c1 -8 5 -12 8 -12 c4 0 7 4 7 12 c0 8 -2 18 -8 18z" fill="currentColor" opacity=".8"/>`;
  return foot(cx - w, 96) + foot(cx + w, 96 - st);
}
function stanceSvg(inner, label){ return `<svg viewBox="0 0 280 150" role="img" aria-label="${esc(label)}" style="color:var(--ink)" xmlns="http://www.w3.org/2000/svg">${inner}</svg>`; }
const STANCE = [
  { h:'接發球的準備姿勢', p:'兩腳比肩膀寬一點，膝蓋彎、屁股往後坐，上身往前傾，重心在前腳掌；手先放在膝蓋前面，還不用合起來。面向發球員，眼睛看發球員的手。兩腳可以平行，也可以一腳稍微在前，照自己習慣，重點是雙手前臂（平台）要對準舉球員。',
    src:'根據：Volleyball Canada（Basic Passing）、Coaching Volleyball',
    svg:() => stanceSvg(`<g transform="translate(10 0)">${fig({ knee:.45, arms:'low' })}</g><text x="20" y="144" font-size="13" fill="currentColor">側面</text>` +
      `<g transform="translate(140 10)">${feet({ wide:26, stagger:10 })}<path d="M70 52 V22 M62 30 l8 -8 8 8" stroke="currentColor" stroke-width="4" fill="none" stroke-linecap="round" stroke-linejoin="round"/><text x="70" y="14" font-size="13" text-anchor="middle" fill="currentColor">面向發球員</text><text x="70" y="128" font-size="13" text-anchor="middle" fill="currentColor">從上面看（右腳稍微在前）</text></g>`, '接發球的準備姿勢') },
  { h:'防守的準備姿勢（防扣球）', p:'比接發球更低、更寬，重心在前腳掌，雙手放在身體前面、手掌朝上，面向攻擊手。對方攻擊手擊球前，雙腳輕輕一跳停住（小跳步），這樣往哪個方向都能馬上動。',
    src:'根據：Volleyball Canada（Basic Defense）、Coaches Insider',
    svg:() => stanceSvg(`<g transform="translate(10 6)">${fig({ knee:.85, arms:'front' })}</g><text x="20" y="144" font-size="13" fill="currentColor">低、寬、手在前面</text>` +
      `<g transform="translate(150 20)"><path d="M20 70 q30 -40 60 0" fill="none" stroke="currentColor" stroke-width="3" stroke-dasharray="6 5"/><circle cx="50" cy="86" r="10" fill="currentColor"/><text x="50" y="118" font-size="13" text-anchor="middle" fill="currentColor">對方擊球前</text><text x="50" y="134" font-size="13" text-anchor="middle" fill="currentColor">小跳步停住</text></g>`, '防守的準備姿勢') },
  { h:'移動：先到球的後面再停', p:'近的球用側併步（兩腳不交叉）；遠的球先用交叉步跑，最後一步停好。停的時候兩腳煞車，靠近目標（舉球員）的那隻腳在前面，重心移到前腳，再把球送出去。「比球先到」，不要邊跑邊接。',
    src:'根據：Volleyball Ireland（LTPD Pass card）',
    svg:() => stanceSvg(`<g fill="currentColor"><text x="20" y="22" font-size="13">近：側併步</text><text x="20" y="92" font-size="13">遠：交叉步，最後停好</text></g>` +
      `<g fill="currentColor" opacity=".8"><ellipse cx="40" cy="48" rx="7" ry="12"/><ellipse cx="70" cy="48" rx="7" ry="12" opacity=".5"/><ellipse cx="100" cy="48" rx="7" ry="12"/><ellipse cx="130" cy="48" rx="7" ry="12" opacity=".5"/></g>` +
      `<path d="M30 70 H150" stroke="currentColor" stroke-width="3" fill="none" marker-end="none"/><path d="M142 64 l8 6 -8 6" stroke="currentColor" stroke-width="3" fill="none"/>` +
      `<g fill="currentColor" opacity=".8"><ellipse cx="40" cy="118" rx="7" ry="12"/><ellipse cx="78" cy="112" rx="7" ry="12" transform="rotate(-20 78 112)"/><ellipse cx="118" cy="120" rx="7" ry="12"/></g><path d="M50 132 H150" stroke="currentColor" stroke-width="3"/><path d="M142 126 l8 6 -8 6" stroke="currentColor" stroke-width="3" fill="none"/>` +
      `<g transform="translate(180 30)"><ellipse cx="22" cy="70" rx="8" ry="14" fill="currentColor" opacity=".8"/><ellipse cx="58" cy="54" rx="8" ry="14" fill="currentColor"/><path d="M58 30 L84 8 M74 8 h10 v10" stroke="var(--setter)" stroke-width="4" fill="none" stroke-linecap="round"/><text x="40" y="106" font-size="13" text-anchor="middle" fill="currentColor">煞車：靠近</text><text x="40" y="122" font-size="13" text-anchor="middle" fill="currentColor">舉球員的腳在前</text></g>`, '移動步法') },
  { h:'扣球來了：不是朝妳來就要動', p:'扣球很快。球不是朝妳的身體來，就要往球的方向跨一步（靠近球的那隻腳先跨，另一隻腳推）；就算朝妳來，也要往前踩一步迎球，球才不會太低、才接得高。吊球比較慢：看到對方手放軟就往前衝。',
    src:'根據：Volleyball Ireland（LTPD Defence card）、The Art of Coaching Volleyball（first step）',
    svg:() => stanceSvg(`<circle cx="140" cy="100" r="16" fill="currentColor"/><text x="140" y="140" font-size="13" text-anchor="middle" fill="currentColor">防守的人</text>` +
      `<path d="M140 10 L140 72" stroke="var(--oppfill)" stroke-width="4" stroke-dasharray="7 5"/><text x="150" y="30" font-size="13" fill="currentColor">朝妳來：往前踩一步</text>` +
      `<path d="M120 10 L66 96" stroke="var(--oppfill)" stroke-width="4" stroke-dasharray="7 5"/><path d="M122 100 L84 100" stroke="currentColor" stroke-width="4"/><path d="M92 92 l-8 8 8 8" stroke="currentColor" stroke-width="4" fill="none"/><text x="8" y="126" font-size="13" fill="currentColor">在旁邊：跨一步過去</text>` +
      `<path d="M170 10 L264 88" stroke="var(--oppfill)" stroke-width="4" stroke-dasharray="7 5"/><text x="196" y="118" font-size="13" fill="currentColor">很遠：先動，</text><text x="196" y="134" font-size="13" fill="currentColor">碰起來就好</text>`, '扣球來了怎麼移動') },
];

window.VBDiag = { topics, court };
})();
