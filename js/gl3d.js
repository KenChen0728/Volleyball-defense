/* 排球站位：立體畫面（WebGL2，自己寫的，不用外部套件也不用網路）
 * 世界座標：x 0~9 由左到右，y 由網子往我們底線為正（對方場地為負），z 往上（公尺）。
 * 人用頭、身體、手腳拼成，姿勢（準備、防守、接球、舉球、攔網、扣球、發球、跑步）會慢慢轉換。
 */
(function(){
'use strict';
const sub = (a, b) => [a[0]-b[0], a[1]-b[1], a[2]-b[2]];
const add = (a, b) => [a[0]+b[0], a[1]+b[1], a[2]+b[2]];
const mul = (a, s) => [a[0]*s, a[1]*s, a[2]*s];
const dot = (a, b) => a[0]*b[0] + a[1]*b[1] + a[2]*b[2];
const cross = (a, b) => [a[1]*b[2]-a[2]*b[1], a[2]*b[0]-a[0]*b[2], a[0]*b[1]-a[1]*b[0]];
const norm = a => { const n = Math.hypot(a[0], a[1], a[2]) || 1; return [a[0]/n, a[1]/n, a[2]/n]; };
const D2R = Math.PI / 180;
function hex(c, a){
  const m = /^#?([0-9a-f]{6})$/i.exec(String(c || '').trim());
  if (!m) return [.5, .5, .5, a == null ? 1 : a];
  const v = parseInt(m[1], 16);
  return [(v >> 16 & 255) / 255, (v >> 8 & 255) / 255, (v & 255) / 255, a == null ? 1 : a];
}

const VS = `#version 300 es
layout(location=0) in vec3 aPos; layout(location=1) in vec3 aNor; layout(location=2) in vec4 aCol;
uniform mat4 uVP; uniform mat4 uM; uniform mat3 uN; uniform vec4 uTint;
out vec3 vN; out vec4 vC; out vec3 vW;
void main(){ vec4 w = uM * vec4(aPos, 1.0); vW = w.xyz; vN = uN * aNor; vC = aCol * uTint; gl_Position = uVP * w; }`;
const FS = `#version 300 es
precision highp float;
in vec3 vN; in vec4 vC; in vec3 vW;
uniform vec3 uL; uniform vec3 uEye; uniform vec3 uSky; uniform vec3 uGnd; uniform vec3 uFog; uniform vec2 uFogR; uniform float uLit;
out vec4 o;
void main(){
  vec3 n = normalize(vN);
  vec3 v = normalize(uEye - vW);
  if (dot(n, v) < 0.0) n = -n;
  vec3 amb = mix(uGnd, uSky, n.z * 0.5 + 0.5);
  float d = max(dot(n, uL), 0.0);
  float sp = pow(max(dot(n, normalize(uL + v)), 0.0), 36.0) * 0.16;
  vec3 lit = vC.rgb * (amb * 0.58 + d * 0.62) + sp * uLit;
  vec3 c = mix(vC.rgb, lit, uLit);
  float f = clamp((length(uEye - vW) - uFogR.x) / (uFogR.y - uFogR.x), 0.0, 1.0);
  o = vec4(mix(c, uFog, f * 0.8), vC.a);
}`;

class Geo {
  constructor(){ this.v = []; this.i = []; }
  vert(p, n, c){ this.v.push(p[0], p[1], p[2], n[0], n[1], n[2], c[0], c[1], c[2], c[3]); return this.v.length / 10 - 1; }
  quad(p0, p1, p2, p3, n, c){ const a = this.vert(p0, n, c), b = this.vert(p1, n, c), d = this.vert(p2, n, c), e = this.vert(p3, n, c); this.i.push(a, b, d, a, d, e); }
  rect(x0, y0, x1, y1, z, c){ this.quad([x0, y0, z], [x1, y0, z], [x1, y1, z], [x0, y1, z], [0, 0, 1], c); }
}
function upload(gl, g){
  const big = g.v.length / 10 > 65535;
  const vao = gl.createVertexArray(); gl.bindVertexArray(vao);
  const vb = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, vb); gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(g.v), gl.STATIC_DRAW);
  const ib = gl.createBuffer(); gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, ib); gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, big ? new Uint32Array(g.i) : new Uint16Array(g.i), gl.STATIC_DRAW);
  gl.enableVertexAttribArray(0); gl.vertexAttribPointer(0, 3, gl.FLOAT, false, 40, 0);
  gl.enableVertexAttribArray(1); gl.vertexAttribPointer(1, 3, gl.FLOAT, false, 40, 12);
  gl.enableVertexAttribArray(2); gl.vertexAttribPointer(2, 4, gl.FLOAT, false, 40, 24);
  gl.bindVertexArray(null);
  return { vao, vb, ib, n:g.i.length, type: big ? gl.UNSIGNED_INT : gl.UNSIGNED_SHORT };
}
function sphereGeo(lat, lon, colorFn){
  const g = new Geo(), W = [1, 1, 1, 1];
  for (let i = 0; i <= lat; i++){
    const th = i / lat * Math.PI;
    for (let j = 0; j <= lon; j++){
      const ph = j / lon * Math.PI * 2;
      const p = [Math.sin(th) * Math.cos(ph), Math.sin(th) * Math.sin(ph), Math.cos(th)];
      g.vert(p, p, colorFn ? colorFn(p) : W);
    }
  }
  for (let i = 0; i < lat; i++) for (let j = 0; j < lon; j++){
    const a = i * (lon + 1) + j, b = a + lon + 1;
    g.i.push(a, b, a + 1, a + 1, b, b + 1);
  }
  return g;
}
function cylGeo(seg){
  const g = new Geo(), W = [1, 1, 1, 1];
  for (let j = 0; j <= seg; j++){
    const a = j / seg * Math.PI * 2, n = [Math.cos(a), 0, Math.sin(a)];
    g.vert([n[0], 0, n[2]], n, W); g.vert([n[0], 1, n[2]], n, W);
  }
  for (let j = 0; j < seg; j++){ const a = j * 2; g.i.push(a, a + 1, a + 2, a + 2, a + 1, a + 3); }
  for (const h of [0, 1]){
    const c = g.vert([0, h, 0], [0, h ? 1 : -1, 0], W);
    const s = g.v.length / 10;
    for (let j = 0; j <= seg; j++){ const a = j / seg * Math.PI * 2; g.vert([Math.cos(a), h, Math.sin(a)], [0, h ? 1 : -1, 0], W); }
    for (let j = 0; j < seg; j++) g.i.push(c, s + j, s + j + 1);
  }
  return g;
}
function discGeo(seg){
  const g = new Geo();
  const c = g.vert([0, 0, 0], [0, 0, 1], [0, 0, 0, 1]);
  for (let j = 0; j <= seg; j++){ const a = j / seg * Math.PI * 2; g.vert([Math.cos(a), Math.sin(a), 0], [0, 0, 1], [0, 0, 0, 0]); }
  for (let j = 0; j < seg; j++) g.i.push(c, c + 1 + j, c + 2 + j);
  return g;
}
function ringGeo(seg, r0, r1){
  const g = new Geo(), W = [1, 1, 1, 1];
  for (let j = 0; j <= seg; j++){ const a = j / seg * Math.PI * 2, cs = Math.cos(a), sn = Math.sin(a); g.vert([cs * r0, sn * r0, 0], [0, 0, 1], W); g.vert([cs * r1, sn * r1, 0], [0, 0, 1], W); }
  for (let j = 0; j < seg; j++){ const a = j * 2; g.i.push(a, a + 1, a + 2, a + 2, a + 1, a + 3); }
  return g;
}
// 球：黃、藍兩色的旋轉條紋
const ballColor = p => (Math.sin(3 * Math.atan2(p[1], p[0]) + 3.2 * p[2]) > .25 ? [.12, .36, .78, 1] : [.98, .82, .16, 1]);

/* ---------- 人的姿勢（角度：度） ----------
 * lean 上身前傾；hip 大腿往前抬；knee 膝蓋彎；sh 手臂往前抬（0 垂下、90 向前、180 舉高）；abd 手臂往外張；el 手肘彎（負的往後彎）
 * 陣列是 [左, 右]；wide 兩腳距離；stag 右腳往前多少 */
const POSES = {
  stand:     { lean:4,  hip:[6,6],   knee:[10,10], sh:[12,12],   abd:[9,9],    el:[18,18],  wide:.22, stag:0 },
  ready:     { lean:26, hip:[40,40], knee:[64,64], sh:[36,36],   abd:[12,12],  el:[30,30],  wide:.36, stag:.12 },
  defense:   { lean:34, hip:[52,52], knee:[84,84], sh:[52,52],   abd:[26,26],  el:[34,34],  wide:.42, stag:.08 },
  dig:       { lean:30, hip:[50,50], knee:[80,80], sh:[64,64],   abd:[-19,-19], el:[0,0],   wide:.40, stag:.14 },
  set:       { lean:2,  hip:[14,14], knee:[24,24], sh:[150,150], abd:[30,30],  el:[30,30],  wide:.30, stag:.14, ik:'set' },
  block:     { lean:0,  hip:[10,10], knee:[22,22], sh:[172,172], abd:[6,6],    el:[4,4],    wide:.24, stag:0 },
  blockReady:{ lean:4,  hip:[16,16], knee:[30,30], sh:[110,110], abd:[22,22],  el:[30,30],  wide:.30, stag:0, ik:'blockReady' },
  spike:     { lean:-6, hip:[16,30], knee:[30,52], sh:[150,168], abd:[20,26],  el:[40,-105], wide:.22, stag:0 },
  serve:     { lean:6,  hip:[8,8],   knee:[14,14], sh:[160,120], abd:[16,30],  el:[10,-95], wide:.28, stag:-.22 },
  // 跨步壓低接球：右腳跨出去、膝蓋接近地板，雙手平台伸向球（左腳在前時整個左右對調）
  lunge:     { lean:38, hip:[18,80], knee:[44,104], sh:[64,64],   abd:[-19,-19], el:[0,0],   wide:.78, stag:.48 },
  // 撲救：身體往前倒、手伸長
  dive:      { lean:64, hip:[8,72],  knee:[18,64], sh:[104,104], abd:[-12,-12], el:[0,0],   wide:.52, stag:.62 },
  // 側併步：重心低、兩腳一開一合
  shuffle:   { lean:28, hip:[46,46], knee:[74,74], sh:[42,42],   abd:[14,14],  el:[30,30],  wide:.52, stag:.06 },
};
// 跑步：放開手擺臂（不抱著手跑）；amp 是快慢，慢跑擺幅小
// 兩段手臂（上臂 .29、前臂 .27）：肩膀到目標，手肘往外、往下彎
function armIK(S0, T, sd){
  const a = .29, c = .27;
  let v = [T[0] - S0[0], T[1] - S0[1], T[2] - S0[2]];
  let d = Math.hypot(v[0], v[1], v[2]) || 1e-3;
  const u = [v[0] / d, v[1] / d, v[2] / d];
  d = Math.min(a + c - .002, Math.max(Math.abs(a - c) + .02, d));
  let p = [sd, 0, -.5]; const pr = p[0] * u[0] + p[1] * u[1] + p[2] * u[2];
  p = [p[0] - u[0] * pr, p[1] - u[1] * pr, p[2] - u[2] * pr];
  const pl = Math.hypot(p[0], p[1], p[2]) || 1; p = [p[0] / pl, p[1] / pl, p[2] / pl];
  const ca = (a * a + d * d - c * c) / (2 * a * d), sa = Math.sqrt(Math.max(0, 1 - ca * ca));
  const elb = [S0[0] + u[0] * a * ca + p[0] * a * sa, S0[1] + u[1] * a * ca + p[1] * a * sa, S0[2] + u[2] * a * ca + p[2] * a * sa];
  return [elb, [S0[0] + u[0] * d, S0[1] + u[1] * d, S0[2] + u[2] * d]];
}
function runPose(ph, amp){
  const a = amp == null ? 1 : amp, s = Math.sin(ph) * a, c = Math.cos(ph);
  return { lean:10 + 10 * a, hip:[32 * s + 10, -32 * s + 10], knee:[30 + 40 * a * Math.max(0, -c), 30 + 40 * a * Math.max(0, c)],
           sh:[34 - 40 * s, 34 + 40 * s], abd:[10, 10], el:[80, 80], wide:.18, stag:0 };
}
function shufflePose(ph){
  const o = Object.assign({}, POSES.shuffle); for (const k of ['hip','knee','sh','abd','el']) o[k] = POSES.shuffle[k].slice();
  o.wide = .36 + .2 * Math.abs(Math.sin(ph)); return o;
}
// 左腳在前：左右手腳對調
function mirrorPose(p){
  const o = { lean:p.lean, wide:p.wide, stag:-p.stag };
  for (const k of ['hip','knee','sh','abd','el']) o[k] = [p[k][1], p[k][0]];
  return o;
}
const KEYS = ['lean', 'wide', 'stag'], PAIRS = ['hip', 'knee', 'sh', 'abd', 'el'];
function copyPose(p){ const o = { lean:p.lean, wide:p.wide, stag:p.stag }; for (const k of PAIRS) o[k] = p[k].slice(); return o; }
function easePose(cur, tgt, a){
  for (const k of KEYS) cur[k] += (tgt[k] - cur[k]) * a;
  for (const k of PAIRS){ cur[k][0] += (tgt[k][0] - cur[k][0]) * a; cur[k][1] += (tgt[k][1] - cur[k][1]) * a; }
}

function create(canvas, overlay){
  const gl = canvas.getContext('webgl2', { antialias:true, alpha:false, preserveDrawingBuffer:false });
  if (!gl) return null;
  const ctx = overlay ? overlay.getContext('2d') : null;
  const sh = (type, src) => { const s = gl.createShader(type); gl.shaderSource(s, src); gl.compileShader(s); if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s)); return s; };
  const prog = gl.createProgram();
  gl.attachShader(prog, sh(gl.VERTEX_SHADER, VS)); gl.attachShader(prog, sh(gl.FRAGMENT_SHADER, FS)); gl.linkProgram(prog);
  if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(prog));
  gl.useProgram(prog);
  const U = {}; for (const n of ['uVP','uM','uN','uTint','uL','uEye','uSky','uGnd','uFog','uFogR','uLit']) U[n] = gl.getUniformLocation(prog, n);
  const mesh = {
    sphere: upload(gl, sphereGeo(12, 18)),
    ball: upload(gl, sphereGeo(16, 24, ballColor)),
    cyl: upload(gl, cylGeo(14)),
    disc: upload(gl, discGeo(24)),
    ring: upload(gl, ringGeo(48, .74, .86)),
  };
  let world = null, worldDark = null, zoneBuf = null, lastZoneKey = null;
  // 場地、網子、牆（不會動的東西先做好）
  function buildWorld(dark){
    const k = dark ? .82 : 1, C = (h, a) => { const c = hex(h, a); return [c[0] * k, c[1] * k, c[2] * k, c[3]]; };
    const floor = new Geo();
    floor.rect(-14, -26, 23, 26, 0, C('#8a6a48'));
    floor.rect(-3, -12, 12, 12, .004, C('#5f86a6'));
    floor.rect(0, -9, 9, 9, .008, C('#e2c08f'));
    floor.rect(0, -3, 9, 3, .010, C('#d7ad74'));
    const L = C('#ffffff'), w = .05, z = .014;
    for (const y of [-9, -3, 0, 3, 9]) floor.rect(-.0, y - w / 2, 9, y + w / 2, z, L);
    floor.rect(-w / 2, -9, w / 2, 9, z, L); floor.rect(9 - w / 2, -9, 9 + w / 2, 9, z, L);
    // 網子：一條一條的細線
    const net = new Geo(), N = C('#1f2328', .55), B = C('#f4f4f2');
    for (let x = -.5; x <= 9.51; x += .1) net.quad([x - .006, 0, 1.24], [x + .006, 0, 1.24], [x + .006, 0, 2.24], [x - .006, 0, 2.24], [0, 1, 0], N);
    for (let zz = 1.24; zz <= 2.241; zz += .1) net.quad([-.5, 0, zz - .006], [9.5, 0, zz - .006], [9.5, 0, zz + .006], [-.5, 0, zz + .006], [0, 1, 0], N);
    net.quad([-.5, 0, 2.17], [9.5, 0, 2.17], [9.5, 0, 2.25], [-.5, 0, 2.25], [0, 1, 0], B);
    net.quad([-.5, 0, 1.22], [9.5, 0, 1.22], [9.5, 0, 1.27], [-.5, 0, 1.27], [0, 1, 0], B);
    // 牆和天花板（往內看）
    const wall = new Geo(), Wc = C(dark ? '#3b4048' : '#cfd6dc'), Wl = C(dark ? '#2f343b' : '#b9c2ca'), Ce = C(dark ? '#2a2e34' : '#e4e8ec');
    const X0 = -14, X1 = 23, Y0 = -26, Y1 = 26, H = 10;
    wall.quad([X0, Y0, 0], [X1, Y0, 0], [X1, Y0, H], [X0, Y0, H], [0, 1, 0], Wc);
    wall.quad([X0, Y1, 0], [X1, Y1, 0], [X1, Y1, H], [X0, Y1, H], [0, -1, 0], Wc);
    wall.quad([X0, Y0, 0], [X0, Y1, 0], [X0, Y1, H], [X0, Y0, H], [1, 0, 0], Wl);
    wall.quad([X1, Y0, 0], [X1, Y1, 0], [X1, Y1, H], [X1, Y0, H], [-1, 0, 0], Wl);
    wall.quad([X0, Y0, H], [X1, Y0, H], [X1, Y1, H], [X0, Y1, H], [0, 0, -1], Ce);
    return { floor:upload(gl, floor), net:upload(gl, net), wall:upload(gl, wall) };
  }
  let W = 0, H = 0, dpr = 1;
  const cam = { eye:[4.5, 15, 4], f:[0, -1, 0], r:[1, 0, 0], u:[0, 0, 1], fov:60, VP:null };
  function resize(){
    const r = canvas.getBoundingClientRect();
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    W = Math.max(1, Math.round(r.width)); H = Math.max(1, Math.round(r.height));
    canvas.width = Math.round(W * dpr); canvas.height = Math.round(H * dpr);
    if (overlay){ overlay.width = Math.round(W * dpr); overlay.height = Math.round(H * dpr); }
  }
  function setCamera(c){
    const f = norm(sub(c.target, c.eye));
    // 場地座標（x 往右、y 往我們底線、z 往上）是左手系：面向網子時右手邊是 +x，
    // 所以右邊要用 z × f，不能用 f × z（那樣左右會顛倒，像照鏡子）
    let r = cross([0, 0, 1], f); if (Math.hypot(r[0], r[1], r[2]) < 1e-5) r = [1, 0, 0];
    r = norm(r); const u = cross(f, r);
    cam.eye = c.eye; cam.f = f; cam.r = r; cam.u = u; cam.fov = c.fov || 60;
    const e = c.eye;
    const view = new Float32Array([r[0], u[0], -f[0], 0, r[1], u[1], -f[1], 0, r[2], u[2], -f[2], 0, -dot(r, e), -dot(u, e), dot(f, e), 1]);
    const near = .04, far = 90, t = 1 / Math.tan(cam.fov * D2R / 2), asp = W / H, nf = 1 / (near - far);
    const P = new Float32Array([t / asp, 0, 0, 0, 0, t, 0, 0, 0, 0, (far + near) * nf, -1, 0, 0, 2 * far * near * nf, 0]);
    const VP = new Float32Array(16);
    for (let cc = 0; cc < 4; cc++) for (let rr = 0; rr < 4; rr++){ let s = 0; for (let kk = 0; kk < 4; kk++) s += P[kk * 4 + rr] * view[cc * 4 + kk]; VP[cc * 4 + rr] = s; }
    cam.VP = VP;
    gl.uniformMatrix4fv(U.uVP, false, VP);
    gl.uniform3fv(U.uEye, e);
  }
  const IDM = new Float32Array([1,0,0,0, 0,1,0,0, 0,0,1,0, 0,0,0,1]), IDN = new Float32Array([1,0,0, 0,1,0, 0,0,1]);
  const mM = new Float32Array(16), mN = new Float32Array(9);
  function draw(m, X, Y, Z, T, color, lit){
    mM[0] = X[0]; mM[1] = X[1]; mM[2] = X[2]; mM[3] = 0; mM[4] = Y[0]; mM[5] = Y[1]; mM[6] = Y[2]; mM[7] = 0;
    mM[8] = Z[0]; mM[9] = Z[1]; mM[10] = Z[2]; mM[11] = 0; mM[12] = T[0]; mM[13] = T[1]; mM[14] = T[2]; mM[15] = 1;
    gl.uniformMatrix4fv(U.uM, false, mM);
    const a = dot(X, X) || 1, b = dot(Y, Y) || 1, c = dot(Z, Z) || 1;
    mN[0] = X[0] / a; mN[1] = X[1] / a; mN[2] = X[2] / a; mN[3] = Y[0] / b; mN[4] = Y[1] / b; mN[5] = Y[2] / b; mN[6] = Z[0] / c; mN[7] = Z[1] / c; mN[8] = Z[2] / c;
    gl.uniformMatrix3fv(U.uN, false, mN);
    gl.uniform4fv(U.uTint, color);
    gl.uniform1f(U.uLit, lit == null ? 1 : lit);
    gl.bindVertexArray(m.vao); gl.drawElements(gl.TRIANGLES, m.n, m.type, 0);
  }
  function drawStatic(m, color, lit){
    gl.uniformMatrix4fv(U.uM, false, IDM); gl.uniformMatrix3fv(U.uN, false, IDN);
    gl.uniform4fv(U.uTint, color || [1, 1, 1, 1]); gl.uniform1f(U.uLit, lit == null ? 1 : lit);
    gl.bindVertexArray(m.vao); gl.drawElements(gl.TRIANGLES, m.n, m.type, 0);
  }
  const sphere = (c, r, col, lit) => draw(mesh.sphere, [r, 0, 0], [0, r, 0], [0, 0, r], c, col, lit);
  const ellip = (c, a1, a2, a3, col) => draw(mesh.sphere, a1, a2, a3, c, col);
  function limb(A, B, r, col){
    const Y = sub(B, A); if (Math.hypot(Y[0], Y[1], Y[2]) < 1e-4) return;
    let X = cross(Y, [0, 0, 1]); if (Math.hypot(X[0], X[1], X[2]) < 1e-4) X = cross(Y, [1, 0, 0]);
    X = mul(norm(X), r); const Z = mul(norm(cross(X, Y)), r);
    draw(mesh.cyl, X, Y, Z, A, col);
  }
  function shadow(x, y, r, a){ draw(mesh.disc, [r, 0, 0], [0, r * .82, 0], [0, 0, 1], [x, y, .02], [0, 0, 0, a], 0); }

  /* ---------- 人 ---------- */
  const people = new Map();
  const SKIN = hex('#efc7a4'), HAIR = hex('#2a1d17'), SHORTS = hex('#1f2430'), PAD = hex('#17191d'), SOCK = hex('#f3f4f6'), SHOE = hex('#e5e7eb');
  function personState(p, dt){
    let s = people.get(p.id);
    let tgt = p.pose === 'run' ? runPose(p.phase || 0, p.runAmp) : p.pose === 'shuffle' ? shufflePose(p.phase || 0) : (POSES[p.pose] || POSES.ready);
    if (p.foot < 0) tgt = mirrorPose(tgt);
    if (!s){ s = { pose:copyPose(tgt), yaw:p.yaw || 0 }; people.set(p.id, s); }
    // 姿勢慢慢過渡，不要一下子換掉；跑步、側併步跟著步伐，反應快一點
    const fast = ['dig','lunge','dive','block','spike'].includes(p.pose) ? 12 : (p.pose === 'run' || p.pose === 'shuffle' ? 16 : 6);
    const a = 1 - Math.exp(-dt * fast);
    easePose(s.pose, tgt, a);
    // 舉球、攔網準備：手直接放到額頭前上方／肩膀前上方（用兩段手臂去接，手肘自然往外），慢慢切換
    if (tgt.ik) s.ikKind = tgt.ik;
    s.ikW = (s.ikW || 0) + ((tgt.ik ? 1 : 0) - (s.ikW || 0)) * a;
    let dy = (p.yaw || 0) - s.yaw; while (dy > Math.PI) dy -= 2 * Math.PI; while (dy < -Math.PI) dy += 2 * Math.PI;
    s.yaw += dy * (1 - Math.exp(-dt * 6));
    return s;
  }
  function drawPerson(p, s){
    const P = s.pose, yaw = s.yaw;
    const F = [Math.sin(yaw), -Math.cos(yaw), 0], R = [Math.cos(yaw), Math.sin(yaw), 0], Z = [0, 0, 1];
    const base = [p.x, p.y, 0];
    const L = (r, f, u) => add(add(add(base, mul(R, r)), mul(F, f)), mul(Z, u + (p.z || 0)));
    const thigh = .44, shin = .43, ankleH = .11;
    const legDown = i => thigh * Math.cos(P.hip[i] * D2R) + shin * Math.cos((P.hip[i] - P.knee[i]) * D2R);
    const hipZ = Math.max(legDown(0), legDown(1)) + ankleH;
    const lean = P.lean * D2R, spine = [0, Math.sin(lean), Math.cos(lean)];
    const pf = -Math.sin(lean) * .1;
    const pel = [0, pf, hipZ];
    const pt = v => L(v[0], v[1], v[2]);
    const jersey = hex(p.color), col = jersey;
    // 腿
    const knees = [], ankles = [];
    for (let i = 0; i < 2; i++){
      const sd = i ? 1 : -1, spread = Math.max(0, P.wide / 2 - .09), st = (i ? .5 : -.5) * P.stag;
      const hip = [sd * .09, pf, hipZ - .04];
      const h = P.hip[i] * D2R, kn = (P.hip[i] - P.knee[i]) * D2R;
      const knee = [hip[0] + sd * spread * .5, hip[1] + thigh * Math.sin(h) + st * .5, hip[2] - thigh * Math.cos(h)];
      const ank = [knee[0] + sd * spread * .5, knee[1] + shin * Math.sin(kn) + st * .5, knee[2] - shin * Math.cos(kn)];
      knees.push(knee); ankles.push(ank);
      const H0 = pt(hip), K = pt(knee), A0 = pt(ank);
      limb(H0, add(H0, mul(sub(K, H0), .42)), .085, SHORTS);
      limb(H0, K, .066, SKIN);
      sphere(add(K, mul(F, .035)), .068, PAD);
      limb(K, A0, .05, SKIN);
      limb(add(K, mul(sub(A0, K), .6)), A0, .054, SOCK);
      ellip(add(A0, add(mul(F, .07), [0, 0, -.035])), mul(R, .05), mul(F, .125), [0, 0, .045], SHOE);
    }
    // 身體、頭
    const chest = add(pel, mul(spine, .5));
    const C0 = pt(pel), C1 = pt(chest);
    const sp = norm(sub(C1, C0)), fw = norm(cross(R, sp));
    ellip(pt(add(pel, mul(spine, .04))), mul(R, .17), mul(sp, .13), mul(fw, .12), SHORTS);
    ellip(pt(add(pel, mul(spine, .27))), mul(R, .175), mul(sp, .27), mul(fw, .115), col);
    const neckTop = add(chest, mul(spine, .08));
    limb(C1, pt(neckTop), .042, SKIN);
    const headC = pt(add(neckTop, [0, .02, .1]));
    sphere(headC, .108, SKIN);
    sphere(add(headC, add(mul(F, -.03), [0, 0, .025])), .113, HAIR);
    sphere(add(headC, add(mul(F, -.13), [0, 0, -.02])), .052, HAIR);
    // 手
    for (let i = 0; i < 2; i++){
      const sd = i ? 1 : -1;
      const shl = [sd * .19, pel[1] + spine[1] * .45, pel[2] + spine[2] * .45];
      const th = P.sh[i] * D2R, ab = P.abd[i] * D2R, el = P.el[i] * D2R;
      const up = [sd * Math.sin(ab), Math.sin(th) * Math.cos(ab), -Math.cos(th) * Math.cos(ab)];
      let b = [0, 1, .6]; const pr = dot(b, up); b = norm(sub(b, mul(up, pr)));
      const fore = norm(add(mul(up, Math.cos(el)), mul(b, Math.sin(el))));
      let elb = add(shl, mul(up, .29)), wr = add(elb, mul(fore, .27));
      if (s.ikW > .01 && s.ikKind){
        const head = add(add(add(pel, mul(spine, .58)), [0, .02, .1]), [0, 0, 0]);
        const T = s.ikKind === 'set' ? add(head, [sd * .1, .2, .2]) : add(shl, [sd * .05, .16, .32]);
        const ik = armIK(shl, T, sd);
        elb = add(elb, mul(sub(ik[0], elb), s.ikW)); wr = add(wr, mul(sub(ik[1], wr), s.ikW));
      }
      const S0 = pt(shl), E0 = pt(elb), W0 = pt(wr);
      sphere(S0, .062, col);
      limb(S0, add(S0, mul(sub(E0, S0), .45)), .058, col);
      limb(S0, E0, .042, SKIN);
      sphere(E0, .041, SKIN);
      limb(E0, W0, .036, SKIN);
      sphere(add(W0, mul(norm(sub(W0, E0)), .04)), .044, SKIN);
    }
    return add(headC, [0, 0, .2]);
  }
  // 第一人稱：自己的兩隻手（雙手前臂合起來，球接進手裡）
  // 第一人稱的手：只畫前臂和手（上臂、肩膀太靠近眼睛，畫出來會變成擋住畫面的大柱子）
  function drawArms(a){
    const e = cam.eye, r = cam.r, Zu = [0, 0, 1];
    const fh = norm([cam.f[0], cam.f[1], 0]);              // 水平的前方
    const fore = (elb, h) => { limb(elb, h, .032, SKIN); };
    if (a.pose === 'set'){
      // 舉球：雙手在額頭前上方張開成三角形，手肘往外、往下；球來了手迎到球下面
      let c = add(add(e, mul(Zu, .3)), mul(fh, .26));
      if (a.at){ const b = a.at; c = [b[0] - fh[0] * .04, b[1] - fh[1] * .04, b[2] - .12]; }
      for (const sd of [-1, 1]){
        const h = add(c, mul(r, sd * .085));
        const elb = add(add(add(h, mul(Zu, -.26)), mul(r, sd * .17)), mul(fh, -.06));
        fore(elb, h);
        ellip(h, mul(r, .035), mul(fh, .03), mul(Zu, .055), SKIN);
      }
      return;
    }
    let hand = add(add(e, mul(fh, .6)), mul(Zu, -.6));
    if (a.at){
      // 接球：雙手併攏成平台，迎到球的下面
      const d = sub(a.at, e), L = Math.hypot(d[0], d[1], d[2]) || 1, kk = Math.max(.5, Math.min(.85, L)) / L;
      hand = add(add(e, mul(d, kk)), mul(Zu, -.08));
    }
    // 前臂從手往身體方向（往後、往下、稍微往外）
    const toBody = norm(sub(add(e, mul(Zu, -.45)), hand));
    for (const sd of [-1, 1]){
      const h = add(hand, mul(r, sd * .035));
      const elb = add(add(h, mul(toBody, .27)), mul(r, sd * .07));
      fore(elb, h);
      ellip(h, mul(r, .03), mul(fh, .05), mul(Zu, .022), SKIN);
    }
  }
  /* ---------- 畫一張 ---------- */
  let lastT = 0;
  function render(scene){
    const now = performance.now(), dt = lastT ? Math.min(.1, (now - lastT) / 1000) : 1 / 60; lastT = now;
    if (!W) resize();
    const dark = !!scene.dark;
    if (!world || worldDark !== dark){ world = buildWorld(dark); worldDark = dark; }
    gl.viewport(0, 0, canvas.width, canvas.height);
    const bg = dark ? [.13, .14, .16] : [.80, .84, .87];
    gl.clearColor(bg[0], bg[1], bg[2], 1);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    gl.enable(gl.DEPTH_TEST); gl.depthFunc(gl.LEQUAL); gl.disable(gl.CULL_FACE);
    gl.enable(gl.BLEND); gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
    gl.uniform3fv(U.uL, norm([.35, .55, 1]));
    gl.uniform3fv(U.uSky, dark ? [.62, .64, .68] : [.95, .96, .98]);
    gl.uniform3fv(U.uGnd, dark ? [.30, .26, .22] : [.52, .44, .36]);
    gl.uniform3fv(U.uFog, bg);
    gl.uniform2fv(U.uFogR, [22, 48]);
    setCamera(scene.camera);
    // 1. 地板上的東西（不寫深度，照順序畫）
    gl.depthMask(false);
    drawStatic(world.floor, [1, 1, 1, 1], .35);
    const zkey = scene.zones && scene.zones.length ? scene.zones.map(zn => zn.pts.map(q => q[0].toFixed(2) + ',' + q[1].toFixed(2)).join(';') + zn.color.join(',')).join('|') : '';
    if (zkey !== lastZoneKey){
      lastZoneKey = zkey;
      if (zoneBuf){ gl.deleteVertexArray(zoneBuf.vao); gl.deleteBuffer(zoneBuf.vb); gl.deleteBuffer(zoneBuf.ib); zoneBuf = null; }
      const g = new Geo();
      for (const zn of (zkey ? scene.zones : [])){
        const c = zn.color, pts = zn.pts; if (!pts || pts.length < 3) continue;
        const b0 = g.vert([pts[0][0], pts[0][1], .016], [0, 0, 1], c);
        for (let i = 1; i < pts.length - 1; i++){ const b1 = g.vert([pts[i][0], pts[i][1], .016], [0, 0, 1], c), b2 = g.vert([pts[i + 1][0], pts[i + 1][1], .016], [0, 0, 1], c); g.i.push(b0, b1, b2); }
      }
      if (g.i.length) zoneBuf = upload(gl, g);
    }
    if (zoneBuf) drawStatic(zoneBuf, [1, 1, 1, 1], 0);
    if (scene.target) draw(mesh.ring, [1, 0, 0], [0, 1, 0], [0, 0, 1], [scene.target[0], scene.target[1], .018], [.05, .45, .56, .85], 0);
    const ppl = scene.people || [];
    for (const p of ppl) if (!p.hidden) shadow(p.x, p.y, .34 * Math.max(.6, 1 - (p.z || 0) * .6), .28 * Math.max(.3, 1 - (p.z || 0)));
    if (scene.ball) shadow(scene.ball.x, scene.ball.y, .13, Math.max(.06, .35 - scene.ball.z * .06));
    gl.depthMask(true);
    // 2. 牆、柱子、人、球
    drawStatic(world.wall, [1, 1, 1, 1], .25);
    const post = hex(dark ? '#9aa3ad' : '#59626c');
    for (const x of [-1, 10]) limb([x, 0, 0], [x, 0, 2.5], .05, post);
    for (const x of [0, 9]) for (let k = 0; k < 9; k++){ const z0 = 1.24 + k * .2; limb([x, 0, z0], [x, 0, Math.min(3.04, z0 + .2)], .012, hex(k % 2 ? '#ffffff' : '#dc2626')); }
    const heads = [];
    for (const p of ppl){
      if (p.hidden){ personState(p, dt); continue; }
      const s = personState(p, dt);
      heads.push({ p, top:drawPerson(p, s) });
    }
    if (scene.ball){ const b = scene.ball, sp = (b.spin || 0); const c = Math.cos(sp), sn = Math.sin(sp), r = .105;
      draw(mesh.ball, [c * r, sn * r, 0], [-sn * r, c * r, 0], [0, 0, r], [b.x, b.y, b.z], [1, 1, 1, 1]); }
    if (scene.arms && scene.arms.on) drawArms(scene.arms);
    // 3. 半透明的網子最後畫
    gl.depthMask(false);
    drawStatic(world.net, [1, 1, 1, 1], .2);
    gl.depthMask(true);
    // 4. 名牌和說明字（2D 疊在上面）
    if (ctx){
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0); ctx.clearRect(0, 0, W, H);
      const lab = [];
      for (const h of heads){
        if (!h.p.label) continue;
        const q = project(h.top); if (!q) continue;
        lab.push({ x:q[0], y:q[1], d:q[2], p:h.p });
      }
      lab.sort((a, b) => b.d - a.d);
      for (const l of lab){
        const fs = Math.max(12, Math.min(19, 30 / Math.max(.8, l.d) * 1.6));
        ctx.font = `700 ${fs}px system-ui, -apple-system, "PingFang TC", "Noto Sans TC", sans-serif`;
        const tw = ctx.measureText(l.p.label).width + fs * .7, th = fs * 1.35;
        ctx.globalAlpha = l.p.labelDim ? .72 : 1;
        ctx.fillStyle = l.p.tagBg || 'rgba(28,31,35,.82)';
        const x0 = l.x - tw / 2, y0 = l.y - th;
        ctx.beginPath(); if (ctx.roundRect) ctx.roundRect(x0, y0, tw, th, th * .3); else ctx.rect(x0, y0, tw, th); ctx.fill();
        ctx.fillStyle = '#fff'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(l.p.label, l.x, y0 + th / 2 + 1);
      }
      ctx.globalAlpha = 1;
      if (scene.hud){
        ctx.font = '700 14px system-ui, -apple-system, "PingFang TC", "Noto Sans TC", sans-serif';
        const tw = ctx.measureText(scene.hud).width + 16;
        ctx.fillStyle = dark ? 'rgba(21,23,27,.78)' : 'rgba(255,255,255,.82)';
        ctx.beginPath(); if (ctx.roundRect) ctx.roundRect(8, 8, tw, 26, 8); else ctx.rect(8, 8, tw, 26); ctx.fill();
        ctx.fillStyle = dark ? '#ebe8e3' : '#1c1f23'; ctx.textAlign = 'left'; ctx.textBaseline = 'middle'; ctx.fillText(scene.hud, 16, 21);
      }
    }
  }
  function project(p){
    const m = cam.VP; if (!m) return null;
    const x = m[0] * p[0] + m[4] * p[1] + m[8] * p[2] + m[12];
    const y = m[1] * p[0] + m[5] * p[1] + m[9] * p[2] + m[13];
    const w = m[3] * p[0] + m[7] * p[1] + m[11] * p[2] + m[15];
    if (w < .1) return null;
    return [(x / w * .5 + .5) * W, (1 - (y / w * .5 + .5)) * H, w];
  }
  // 點畫面上的地板：回傳場上座標
  function pick(clientX, clientY){
    const r = canvas.getBoundingClientRect();
    const sx = (clientX - r.left) / W * 2 - 1, sy = 1 - (clientY - r.top) / H * 2;
    const t = Math.tan(cam.fov * D2R / 2), asp = W / H;
    const dir = norm(add(add(cam.f, mul(cam.r, sx * t * asp)), mul(cam.u, sy * t)));
    if (dir[2] >= -1e-4) return null;
    const k = -cam.eye[2] / dir[2];
    return [cam.eye[0] + dir[0] * k, cam.eye[1] + dir[1] * k];
  }
  function forget(id){ people.delete(id); }
  return { resize, render, pick, forget, webgl:true };
}
window.VBGL = { create, POSES };
})();
