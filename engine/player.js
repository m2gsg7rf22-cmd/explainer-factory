import * as THREE from 'three';
import {EffectComposer} from 'three/addons/postprocessing/EffectComposer.js';
import {RenderPass} from 'three/addons/postprocessing/RenderPass.js';
import {UnrealBloomPass} from 'three/addons/postprocessing/UnrealBloomPass.js';
import {OutputPass} from 'three/addons/postprocessing/OutputPass.js';
import {RoundedBoxGeometry} from 'three/addons/geometries/RoundedBoxGeometry.js';
import {buildPrefab} from './prefabs.js';
import {makeMat, edgesFor, setFade, setTint, V3, ease, clamp, lerp} from './common.js';

const W = 720, H = 1280;
const canvas = document.getElementById('c');
const renderer = new THREE.WebGLRenderer({canvas, antialias: true, preserveDrawingBuffer: true});
renderer.setPixelRatio(1); renderer.setSize(W, H, false);
renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 0.95;
const scene = new THREE.Scene();
{ const cv = document.createElement('canvas'); cv.width = 4; cv.height = 512; const cx = cv.getContext('2d'); const g = cx.createLinearGradient(0, 0, 0, 512);
  g.addColorStop(0, '#04041a'); g.addColorStop(0.45, '#0c0c45'); g.addColorStop(0.7, '#14146a'); g.addColorStop(1, '#060622'); cx.fillStyle = g; cx.fillRect(0, 0, 4, 512);
  const tx = new THREE.CanvasTexture(cv); tx.colorSpace = THREE.SRGBColorSpace; scene.background = tx; }
scene.fog = new THREE.FogExp2(0x0a0a38, 0.04);
const camera = new THREE.PerspectiveCamera(40, W / H, 0.05, 120);
const composer = new EffectComposer(renderer);
composer.setSize(W, H);
composer.addPass(new RenderPass(scene, camera));
const bloom = new UnrealBloomPass(new THREE.Vector2(W / 2, H / 2), 0.55, 0.5, 0.42);
composer.addPass(bloom);
composer.addPass(new OutputPass());

// lights + floor
scene.add(new THREE.AmbientLight(0x4a4aa8, 0.55));
const l1 = new THREE.PointLight(0x7a5cff, 16, 18, 1.6); l1.position.set(-3, 4, 3); scene.add(l1);
const l2 = new THREE.PointLight(0x3b7bff, 12, 18, 1.6); l2.position.set(3, 2.5, 2); scene.add(l2);
const l3 = new THREE.PointLight(0xb08cff, 7, 14, 1.6); l3.position.set(0, 3, -4); scene.add(l3);
const grid = new THREE.GridHelper(80, 80, 0x3b3bff, 0x17176a);
grid.material.transparent = true; grid.material.opacity = 0.7; grid.position.y = -0.001; scene.add(grid);
const floor = new THREE.Mesh(new THREE.PlaneGeometry(80, 80), new THREE.MeshStandardMaterial({color: 0x0a0a30, roughness: 0.5, metalness: 0.5}));
floor.rotation.x = -Math.PI / 2; floor.position.y = -0.01; scene.add(floor);

const world = new THREE.Group(); scene.add(world);
// floating dust for depth
const DUST_N = 260; const dustPos = new Float32Array(DUST_N * 3); const dustSeed = []; { let sd = 11; const r = () => { sd = (sd * 9301 + 49297) % 233280; return sd / 233280; }; for (let i = 0; i < DUST_N; i++) dustSeed.push([(r() - 0.5) * 16, r() * 7, (r() - 0.5) * 16 - 2, r()]); }
const dustGeo = new THREE.BufferGeometry(); dustGeo.setAttribute('position', new THREE.BufferAttribute(dustPos, 3));
const dust = new THREE.Points(dustGeo, new THREE.PointsMaterial({color: 0x9d9dff, size: 0.045, transparent: true, opacity: 0.55, blending: THREE.AdditiveBlending, depthWrite: false})); scene.add(dust);
function updateDust(t) { dustSeed.forEach((d, i) => { dustPos[i * 3] = d[0] + Math.sin(t * 0.3 + d[3] * 9) * 0.3; dustPos[i * 3 + 1] = (d[1] + t * 0.12 * (0.4 + d[3])) % 7; dustPos[i * 3 + 2] = d[2] + Math.cos(t * 0.25 + d[3] * 7) * 0.3; }); dustGeo.attributes.position.needsUpdate = true; }
const reg = {};            // id -> Object3D
let SB = null, TL = null;  // storyboard + timeline
let tracks = {};           // objId -> prop -> [{t0,t1,from,to}]
let fxs = [];              // active effect descriptors
let spins = [];
const labelsEl = document.getElementById('labels');
const capEl = document.getElementById('cap');
const statEl = document.getElementById('stat');
const fxGroup = new THREE.Group(); scene.add(fxGroup);

// ---------- object building ----------
function prim(spec) {
  let g;
  const s = spec;
  switch (s.type) {
    case 'box': g = new THREE.BoxGeometry(...s.size); break;
    case 'rbox': g = new RoundedBoxGeometry(s.size[0], s.size[1], s.size[2], 4, s.radius ?? 0.04); break;
    case 'cyl': g = new THREE.CylinderGeometry(s.r2 ?? s.r, s.r, s.h, s.seg ?? 40); break;
    case 'sphere': g = new THREE.SphereGeometry(s.r, 40, 24); break;
    case 'torus': g = new THREE.TorusGeometry(s.r, s.tube ?? 0.02, 14, 64, s.arc ?? Math.PI * 2); break;
    case 'cone': g = new THREE.ConeGeometry(s.r, s.h, 28); break;
    case 'capsule': g = new THREE.CapsuleGeometry(s.r, s.h, 8, 20); break;
    case 'plane': g = new THREE.PlaneGeometry(...s.size); break;
    case 'disc': g = new THREE.CircleGeometry(s.r, 48); break;
    default: throw new Error('unknown prim ' + s.type);
  }
  const grp = new THREE.Group();
  const mesh = new THREE.Mesh(g, makeMat(s.mat || 'glass', s.color || '#6a63ff', s.opacity));
  grp.add(mesh);
  if ((s.mat || 'glass') === 'glass' && s.edges !== false) grp.add(edgesFor(g, s.edgeColor || '#c9c4ff'));
  return grp;
}
export function build(spec, parentId) {
  let o;
  if (spec.prefab) o = buildPrefab(spec.prefab, spec, reg, spec.id, build);
  else if (spec.type === 'group') {
    o = new THREE.Group();
    for (const c of spec.children || []) o.add(build(c));
  } else o = prim(spec);
  if (spec.pos) o.position.set(...spec.pos);
  if (spec.rot) o.rotation.set(...spec.rot);
  if (spec.scale != null) Array.isArray(spec.scale) ? o.scale.set(...spec.scale) : o.scale.setScalar(spec.scale);
  if (spec.id) { reg[spec.id] = o; o.userData.base = {pos: o.position.clone(), rot: o.rotation.clone(), scale: o.scale.clone()}; }
  if (spec.hidden) setFade(o, 0);
  return o;
}

// ---------- anchors ----------
const _v = new THREE.Vector3();
function anchor(a, out = new THREE.Vector3()) {
  if (Array.isArray(a)) return out.set(...a);
  if (typeof a === 'string') {
    const o = reg[a]; if (!o) throw new Error('unknown anchor ' + a);
    o.updateWorldMatrix(true, true);
    const bb = new THREE.Box3().setFromObject(o);
    if (bb.isEmpty()) return out.setFromMatrixPosition(o.matrixWorld);
    return bb.getCenter(out);
  }
  if (a && a.on) { anchor(a.on, out); if (a.off) out.add(_v.set(...a.off)); return out; }
  return out.set(0, 0, 0);
}

// ---------- storyboard loading ----------
window.loadStoryboard = function (sb, timeline) {
  SB = sb; TL = timeline;
  for (const k in reg) delete reg[k];
  while (world.children.length) world.remove(world.children[0]);
  for (const spec of sb.objects || []) world.add(build(spec));
  world.updateMatrixWorld(true);
  tracks = {}; fxs = []; spins = [];
  const prevEnd = {};
  const T = timeline.beats;
  sb.beats.forEach((b, i) => {
    const bt = T[i];
    for (const f of b.fx || []) {
      const at = bt.start + (f.at ?? 0);
      const dur = f.dur ?? Math.max(0.2, bt.end - at);
      const fx = {...f, t0: at, t1: at + dur, beat: i};
      if (['move', 'rot', 'scale', 'fade', 'color'].includes(f.t)) addTrack(fx);
      else if (f.t === 'spin') spins.push({obj: f.obj, rps: f.rps ?? 0.5, t0: at, t1: f.until != null ? at + f.until : 1e9});
      else fxs.push(fx);
    }
  });
  const cs = document.getElementById('ctaName'); cs.textContent = (sb.channel && sb.channel.name) || '';
  document.getElementById('ctaSub').textContent = (sb.channel && sb.channel.sub) || '';
  const av = document.getElementById('ctaAv');
  if (sb.channel && sb.channel.avatar) av.innerHTML = `<img src="${sb.channel.avatar}">`; else av.textContent = ((sb.channel && sb.channel.name) || 'X').slice(0, 1).toUpperCase();
  document.getElementById('ctaPill').textContent = (sb.channel && sb.channel.cta) || 'Follow for more.';
  return true;
};

const readers = {
  move: o => o.position.toArray(), rot: o => [o.rotation.x, o.rotation.y, o.rotation.z],
  scale: o => o.scale.toArray(), fade: o => [o.userData.fade ?? 1], color: o => [1]
};
function addTrack(fx) {
  const id = fx.obj; const prop = fx.t;
  tracks[id] = tracks[id] || {}; const arr = tracks[id][prop] = tracks[id][prop] || [];
  const o = reg[id]; if (!o) throw new Error('unknown obj ' + id);
  const b = o.userData.base;
  let init = prop === 'move' ? b.pos.toArray() : prop === 'rot' ? [b.rot.x, b.rot.y, b.rot.z] : prop === 'scale' ? b.scale.toArray() : prop === 'fade' ? [o.userData.fade0 ?? 1] : null;
  const from = arr.length ? arr[arr.length - 1].to : init;
  let to = fx.to;
  if (prop === 'rot' && fx.by) to = from.map((v, i) => v + fx.by[i]);
  if (prop === 'move' && fx.by) to = from.map((v, i) => v + fx.by[i]);
  if (prop === 'scale' && !Array.isArray(to)) to = [to, to, to];
  if (prop === 'fade' && !Array.isArray(to)) to = [to];
  if (prop === 'color') { to = new THREE.Color(fx.to); }
  arr.push({t0: fx.t0, t1: fx.t1, from: prop === 'color' ? (arr.length ? arr[arr.length - 1].to : null) : from, to});
}
function evalTracks(t) {
  for (const id in tracks) {
    const o = reg[id]; const tr = tracks[id];
    for (const prop in tr) {
      const arr = tr[prop];
      // find value at t
      let val = null;
      for (const k of arr) {
        if (t >= k.t1) { val = k.to; continue; }
        if (t >= k.t0) {
          const e = ease((t - k.t0) / (k.t1 - k.t0));
          if (prop === 'color') { val = (k.from || new THREE.Color('#ffffff')).clone().lerp(k.to, e); } else val = k.from.map((v, i) => lerp(v, k.to[i], e));
        }
        break;
      }
      if (val == null) { if (prop === 'color') setTint(o, null); else if (prop === 'move') o.position.copy(o.userData.base.pos); else if (prop === 'rot') o.rotation.copy(o.userData.base.rot); else if (prop === 'scale') o.scale.copy(o.userData.base.scale); else if (prop === 'fade') setFade(o, arr[0].from[0]); continue; }
      if (prop === 'move') o.position.set(...val); else if (prop === 'rot') o.rotation.set(...val);
      else if (prop === 'scale') o.scale.set(...val); else if (prop === 'fade') setFade(o, val[0]); else if (prop === 'color') setTint(o, val);
    }
  }
}

// ---------- camera ----------
function shotPose(b, t01, bt) {
  const c = b.cam || {};
  const look = anchor(c.look ?? [0, 0.8, 0]);
  const az = (c.az ?? 25) + (c.orbit ?? 12) * t01;
  const el = c.el ?? 16;
  const dist = ((c.dist ?? 4) - (c.dolly ?? 0.4) * t01) * (SB.camScale ?? 1.45);
  return {look, az, el, dist, fov: c.fov ?? 40, roll: c.roll ?? 0};
}
function poseCam(p) {
  const a = p.az * Math.PI / 180, e = p.el * Math.PI / 180;
  camera.position.set(p.look.x + p.dist * Math.cos(e) * Math.sin(a), p.look.y + p.dist * Math.sin(e), p.look.z + p.dist * Math.cos(e) * Math.cos(a));
  camera.up.set(Math.sin(p.roll * Math.PI / 180), Math.cos(p.roll * Math.PI / 180), 0);
  camera.lookAt(p.look); camera.fov = p.fov; camera.updateProjectionMatrix();
}
function camAt(t) {
  const T = TL.beats; let i = 0;
  while (i < T.length - 1 && t >= T[i + 1].start) i++;
  const bt = T[i], b = SB.beats[i];
  const t01 = clamp((t - bt.start) / Math.max(0.01, bt.end - bt.start), 0, 1);
  const cur = shotPose(b, t01, bt);
  const trans = Math.min(b.cam?.trans ?? 0.9, (bt.end - bt.start) * 0.9);
  if (i > 0 && t - bt.start < trans) {
    const pb = shotPose(SB.beats[i - 1], 1, T[i - 1]);
    const e = ease((t - bt.start) / trans);
    return {look: pb.look.clone().lerp(cur.look, e), az: lerp(pb.az, cur.az, e), el: lerp(pb.el, cur.el, e), dist: lerp(pb.dist, cur.dist, e), fov: lerp(pb.fov, cur.fov, e), roll: lerp(pb.roll, cur.roll, e)};
  }
  return cur;
}

// ---------- fx rendering ----------
const pool = {rings: [], arrows: [], tubes: [], pts: []};
const glowMat = (c, op = 1) => new THREE.MeshBasicMaterial({color: new THREE.Color(c).multiplyScalar(1.3), transparent: true, opacity: op, blending: THREE.AdditiveBlending, depthWrite: false});
const ptsMat = (c, size) => new THREE.PointsMaterial({color: new THREE.Color(c).multiplyScalar(1.3), size, sizeAttenuation: true, transparent: true, opacity: 0.95, blending: THREE.AdditiveBlending, depthWrite: false});
function rnd(seed) { let s = seed * 9301 + 49297; return () => { s = (s * 9301 + 49297) % 233280; return s / 233280; }; }
const curveOf = (a, b, arc) => { const m = a.clone().lerp(b, 0.5); m.y += arc; return new THREE.QuadraticBezierCurve3(a, m, b); };

function clearFx() { while (fxGroup.children.length) { const c = fxGroup.children[0]; fxGroup.remove(c); c.traverse(n => { n.geometry && n.geometry.dispose(); }); } }
function drawFx(t) {
  clearFx(); labelsEl.innerHTML = ''; statEl.style.display = 'none';
  for (const f of fxs) {
    if (t < f.t0 || t > f.t1 + 0.35) continue;
    const p = clamp((t - f.t0) / Math.max(0.01, f.t1 - f.t0), 0, 1);
    const fadeOut = t > f.t1 ? 1 - (t - f.t1) / 0.35 : 1;
    const fadeIn = clamp((t - f.t0) / 0.25, 0, 1);
    const vis = Math.min(fadeIn, fadeOut);
    const col = f.color || '#9d8cff';
    if (f.t === 'ring') {
      const c = anchor(f.on); const n = f.n ?? 3;
      for (let k = 0; k < n; k++) {
        const ph = ((t - f.t0) * (f.speed ?? 0.7) + k / n) % 1;
        const m = new THREE.Mesh(new THREE.TorusGeometry((f.r ?? 0.6) * (0.2 + ph), 0.012, 8, 64), glowMat(col, (1 - ph) * vis));
        m.position.copy(c); if (f.face === 'cam') m.lookAt(camera.position); else m.rotation.x = Math.PI / 2; fxGroup.add(m);
      }
    } else if (f.t === 'pulse') {
      const o = reg[f.on]; if (o) { const s = 1 + 0.07 * Math.sin(p * Math.PI * (f.beats ?? 3)) * vis; o.scale.copy(o.userData.base.scale).multiplyScalar(s); }
      const c = anchor(f.on); const m = new THREE.Mesh(new THREE.SphereGeometry(f.r ?? 0.18, 20, 14), glowMat(col, 0.35 * vis * (0.6 + 0.4 * Math.sin(p * 20)))); m.position.copy(c); fxGroup.add(m);
    } else if (f.t === 'arrow') {
      const a = anchor(f.from), b = anchor(f.to); const e = ease(clamp(p * 3, 0, 1)); const end = a.clone().lerp(b, e);
      const dir = end.clone().sub(a); const len = dir.length(); if (len < 0.02) continue;
      const cyl = new THREE.Mesh(new THREE.CylinderGeometry(0.014, 0.014, len * 0.85, 10), glowMat('#ffffff', vis));
      const cone = new THREE.Mesh(new THREE.ConeGeometry(0.045, 0.12, 14), glowMat('#ffffff', vis));
      const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.clone().normalize());
      cyl.quaternion.copy(q); cyl.position.copy(a).addScaledVector(dir.clone().normalize(), len * 0.425);
      cone.quaternion.copy(q); cone.position.copy(end).addScaledVector(dir.clone().normalize(), -0.05);
      fxGroup.add(cyl, cone);
    } else if (f.t === 'beam') {
      const a = anchor(f.from), b = anchor(f.to); const crv = curveOf(a, b, f.arc ?? 0.5); const e = ease(clamp(p * 2.2, 0, 1));
      const segs = 80; const pts = crv.getPoints(segs).slice(0, Math.max(2, Math.floor(segs * e) + 1));
      const tube = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 60, f.w ?? 0.018, 8), glowMat(col, vis)); fxGroup.add(tube);
      const head = new THREE.Mesh(new THREE.SphereGeometry(0.06, 12, 10), glowMat('#ffffff', vis)); head.position.copy(pts[pts.length - 1]); fxGroup.add(head);
    } else if (f.t === 'flow') {
      const a = anchor(f.from), b = anchor(f.to); const n = f.n ?? 50; const R = rnd(f.seed ?? 7);
      const pos = new Float32Array(n * 3); const sp = f.spread ?? 0.25; const crv = curveOf(a, b, f.arc ?? 0.0);
      for (let k = 0; k < n; k++) {
        const ph = ((t * (f.speed ?? 0.55)) + R()) % 1; const pt = crv.getPoint(ph);
        const jx = (R() - 0.5) * sp * Math.sin(ph * Math.PI), jy = (R() - 0.5) * sp * Math.sin(ph * Math.PI), jz = (R() - 0.5) * sp * Math.sin(ph * Math.PI);
        pos.set([pt.x + jx, pt.y + jy, pt.z + jz], k * 3);
      }
      const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
      const m = ptsMat(col, f.size ?? 0.05); m.opacity = 0.95 * vis; fxGroup.add(new THREE.Points(g, m));
    } else if (f.t === 'sparkle') {
      const c = anchor(f.on); const n = f.n ?? 40; const R = rnd(f.seed ?? 3); const pos = new Float32Array(n * 3); const rad = f.r ?? 0.6;
      for (let k = 0; k < n; k++) { const ph = (t * 0.5 + R()) % 1; const th = R() * 6.283, ph2 = Math.acos(2 * R() - 1); const rr = rad * (0.3 + 0.7 * ph);
        pos.set([c.x + rr * Math.sin(ph2) * Math.cos(th), c.y + rr * Math.cos(ph2) * (f.flat ? 0.2 : 1) + ph * 0.2, c.z + rr * Math.sin(ph2) * Math.sin(th)], k * 3); }
      const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
      const m = ptsMat(col, f.size ?? 0.045); m.opacity = 0.9 * vis; fxGroup.add(new THREE.Points(g, m));
    } else if (f.t === 'rain') {
      const c = anchor(f.on); const n = f.n ?? 60; const R = rnd(f.seed ?? 5); const w = f.w ?? 1.0; const h = f.h ?? 1.2; const verts = [];
      for (let k = 0; k < n; k++) { const ph = (t * (f.speed ?? 1.4) + R()) % 1; const x = (R() - 0.5) * w, z = (R() - 0.5) * w; const y = c.y + h * (1 - ph);
        verts.push(c.x + x, y, c.z + z, c.x + x, y - 0.07, c.z + z); }
      const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(verts, 3));
      fxGroup.add(new THREE.LineSegments(g, new THREE.LineBasicMaterial({color: new THREE.Color(col).multiplyScalar(1.6), transparent: true, opacity: 0.9 * vis, blending: THREE.AdditiveBlending})));
    } else if (f.t === 'wave') {
      const a = anchor(f.from), b = anchor(f.to); const n = 90, pts = []; const amp = (f.amp ?? 0.18) * vis, fr = f.freq ?? 5, inv = f.inv ? -1 : 1;
      const len = b.clone().sub(a); const up = new THREE.Vector3(0, 1, 0);
      for (let i = 0; i <= n; i++) { const u = i / n; const p0 = a.clone().lerp(b, u); p0.addScaledVector(up, inv * amp * Math.sin(u * fr * 6.283 - t * (f.speed ?? 6))); pts.push(p0); }
      fxGroup.add(new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 120, f.w ?? 0.014, 6), glowMat(col, vis)));
    } else if (f.t === 'label') {
      const s = anchor(f.on || f.at); const v = s.clone().project(camera); if (v.z > 1) continue;
      const x = (v.x * 0.5 + 0.5) * W, y = (-v.y * 0.5 + 0.5) * H;
      const d = document.createElement('div'); d.className = 'chip'; d.innerHTML = f.text + (f.sub ? `<small>${f.sub}</small>` : '');
      const dx = (f.dx ?? 0), dy = (f.dy ?? -90); d.style.opacity = vis; d.style.transform = `translate(-50%,-100%) scale(${0.85 + 0.15 * vis})`;
      d.style.left = Math.max(110, Math.min(W - 110, x + dx)) + 'px'; d.style.top = (y + dy) + 'px';
      const st = document.createElement('div'); st.className = 'stem'; st.style.left = x + 'px'; st.style.top = (y + dy) + 'px'; st.style.height = Math.abs(dy) + 'px'; st.style.opacity = vis * 0.8;
      labelsEl.append(st, d);
      const dot = document.createElement('div'); dot.className = 'stem'; dot.style.cssText = `left:${x - 6}px;top:${y - 6}px;width:12px;height:12px;border-radius:50%;background:#fff;opacity:${vis};box-shadow:0 0 12px #fff`; labelsEl.append(dot);
    } else if (f.t === 'stat') {
      statEl.style.display = 'block'; statEl.style.opacity = vis; statEl.style.top = (f.y ?? 27) + '%';
      statEl.style.transform = `translate(-50%,-50%) scale(${0.8 + 0.2 * ease(clamp((t - f.t0) / 0.3, 0, 1))})`;
      statEl.innerHTML = `<b>${f.value}</b><span>${f.sub || ''}</span>`;
    }
  }
}

// ---------- captions + cta ----------
function drawCaption(t) {
  const T = TL.beats; let bi = -1;
  for (let i = 0; i < T.length; i++) if (t >= T[i].start && t < T[i].end) bi = i;
  const cta = t >= TL.ctaStart;
  if (bi < 0 || cta) { capEl.style.display = 'none'; return; }
  const bt = T[bi];
  const phrases = bt.caps;
  let cur = phrases[0];
  for (const ph of phrases) if (t - bt.start >= (ph.at ?? 0)) cur = ph;
  const local = t - bt.start - (cur.at ?? 0);
  let html = cur.text; const hl = cur.hl;
  if (hl) html = html.replace(hl, `<span class="hl">${hl}</span>`);
  capEl.innerHTML = html; capEl.style.display = 'block';
  const s = 0.86 + 0.14 * ease(clamp(local / 0.16, 0, 1));
  capEl.style.opacity = clamp(local / 0.1, 0, 1);
  capEl.style.transform = `translate(-50%,-50%) scale(${s})`;
}
function drawCta(t) {
  const cardEl = document.getElementById('card'); const ctaEl = document.getElementById('cta');
  const p = ease(clamp((t - TL.ctaStart) / 0.7, 0, 1));
  if (p <= 0) { cardEl.style.transform = ''; cardEl.style.borderRadius = '0'; ctaEl.style.opacity = 0; cardEl.style.boxShadow = 'none'; return; }
  cardEl.style.transform = `translateY(${-190 * p}px) scale(${1 - 0.45 * p})`;
  cardEl.style.borderRadius = (30 * p) + 'px'; cardEl.style.boxShadow = `0 0 0 ${3 * p}px rgba(140,100,255,${0.7 * p})`;
  ctaEl.style.opacity = clamp((t - TL.ctaStart - 0.3) / 0.4, 0, 1);
}

// ---------- main ----------
window.renderFrame = function (t) {
  for (const id in reg) { /* reset pulse scale each frame handled via tracks/base */ }
  for (const k in reg) { const o = reg[k]; if (!tracks[k] || !tracks[k].scale) o.scale.copy(o.userData.base.scale); }
  evalTracks(t);
  for (const s of spins) { const o = reg[s.obj]; if (o && t >= s.t0) o.rotation.y = o.userData.base.rot.y + (Math.min(t, s.t1) - s.t0) * s.rps * Math.PI * 2; }
  world.updateMatrixWorld(true);
  const p = camAt(t); poseCam(p); camera.updateMatrixWorld(true);
  world.traverse(n => { if (n.userData.billboard) n.quaternion.copy(camera.quaternion); });
  updateDust(t); drawFx(t); drawCaption(t); drawCta(t);
  composer.render();
  return true;
};
window.__ready = true;
