import * as THREE from 'three';
import {makeMat, edgesFor, wireLines, canvasTex} from './common.js';

const P = (o, pos, rot) => { if (pos) o.position.set(...pos); if (rot) o.rotation.set(...rot); return o; };
// Every prefab returns a Group. Sub-parts are registered as reg["<id>.<part>"] so storyboards can aim cameras / fx at them.
export function buildPrefab(name, spec, reg, id, build) {
  const g = new THREE.Group();
  const B = s => build(s);
  const add = (o, pos, rot) => { if (pos) o.position.set(...pos); if (rot) o.rotation.set(...rot); g.add(o); return o; };
  const part = (n, o) => { if (id) { reg[id + '.' + n] = o; o.userData.base = {pos: o.position.clone(), rot: o.rotation.clone(), scale: o.scale.clone()}; } return o; };
  const anchorAt = (n, x, y, z) => { const a = new THREE.Group(); a.position.set(x, y, z); g.add(a); return part(n, a); };
  const col = spec.color;
  const F = PREFABS[name]; if (!F) throw new Error('unknown prefab ' + name);
  F({g, B, add, part, anchorAt, spec, col, THREE, makeMat, edgesFor, wireLines, canvasTex});
  return g;
}

function screenTex(kind, text, canvasTex) {
  return canvasTex(256, 520, (c, w, h) => {
    const gr = c.createLinearGradient(0, 0, w, h); gr.addColorStop(0, '#16164f'); gr.addColorStop(1, '#3b1d7a'); c.fillStyle = kind === 'off' ? '#05050f' : gr; c.fillRect(0, 0, w, h);
    c.fillStyle = '#fff'; c.textAlign = 'center';
    if (kind === 'lock') { c.font = '800 72px Mont,Arial'; c.fillText('9:41', w / 2, 170); c.font = '600 20px Mont,Arial'; c.fillText('Tuesday', w / 2, 110); }
    else if (kind === 'airplane') { c.font = '120px DejaVu Sans,Arial'; c.fillText('✈', w / 2, 300); c.font = '800 28px Mont,Arial'; c.fillText('Airplane Mode', w / 2, 360); }
    else if (kind === 'wifi') { c.strokeStyle = '#fff'; c.lineWidth = 14; c.lineCap = 'round'; for (let i = 1; i <= 3; i++) { c.beginPath(); c.arc(w / 2, 330, 40 * i, -2.4, -0.74); c.stroke(); } c.fillStyle = '#fff'; c.beginPath(); c.arc(w / 2, 330, 12, 0, 7); c.fill(); }
    else if (kind === 'search') { c.fillStyle = '#fff'; c.font = '800 44px Mont,Arial'; c.fillText('Google', w / 2, 150); c.fillStyle = 'rgba(255,255,255,.95)'; c.beginPath(); c.roundRect(20, 190, w - 40, 54, 27); c.fill(); c.fillStyle = '#111'; c.font = '700 24px Mont,Arial'; c.fillText(text || '', w / 2, 227); }
    else if (kind === 'text') { c.font = '900 40px Mont,Arial'; c.fillText(text || '', w / 2, 270); }
    else if (kind === 'home') { for (let r = 0; r < 5; r++) for (let q = 0; q < 4; q++) { c.fillStyle = `hsl(${240 + (r * 4 + q) * 7},70%,${55 + (q % 2) * 8}%)`; c.beginPath(); c.roundRect(24 + q * 56, 70 + r * 78, 46, 46, 12); c.fill(); } }
    else if (kind === 'map') { c.strokeStyle = 'rgba(255,255,255,.35)'; c.lineWidth = 3; for (let i = 0; i < 9; i++) { c.beginPath(); c.moveTo(0, i * 60); c.lineTo(w, i * 60 + 30); c.stroke(); } c.fillStyle = '#ff3d6e'; c.beginPath(); c.arc(w / 2, 260, 22, 0, 7); c.fill(); c.fillStyle = '#fff'; c.beginPath(); c.arc(w / 2, 260, 8, 0, 7); c.fill(); }
  });
}

const PREFABS = {
  phone({g, B, add, part, anchorAt, spec, THREE, canvasTex, makeMat, edgesFor}) {
    const xray = spec.xray;
    const body = add(B({type: 'rbox', size: [0.42, 0.86, 0.05], radius: 0.05, mat: xray ? 'glass' : 'solid', color: '#2a2a9a', opacity: 0.5})); part('body', body);
    const scr = new THREE.Mesh(new THREE.PlaneGeometry(0.385, 0.8), new THREE.MeshBasicMaterial({map: screenTex(spec.screen || 'home', spec.text, canvasTex), transparent: true}));
    scr.material.userData = {kind: 'basic', baseOpacity: 1, baseColor: new THREE.Color('#fff')}; add(scr, [0, 0, 0.0265]); part('screen', scr);
    for (let i = 0; i < 3; i++) add(B({type: 'cyl', r: 0.028, h: 0.012, mat: 'solid', color: '#07071f'}), [-0.1 + (i % 2) * 0.1, 0.33 - Math.floor(i / 2) * 0.1, -0.03], [Math.PI / 2, 0, 0]);
    part('camera', anchorAt('camera_', -0.1, 0.33, -0.04));
    if (xray) {
      part('chip', add(B({type: 'box', size: [0.14, 0.14, 0.02], mat: 'glow', color: '#7a6bff'}), [0, 0.12, 0]));
      part('battery', add(B({type: 'box', size: [0.3, 0.3, 0.02], mat: 'glass', color: '#38e0b0', opacity: 0.3}), [0, -0.2, 0]));
      part('antenna', add(B({type: 'box', size: [0.34, 0.012, 0.012], mat: 'glow', color: '#ff6ad5'}), [0, 0.39, 0]));
    }
    part('top', anchorAt('top_', 0, 0.45, 0));
  },
  router({g, B, add, part, anchorAt}) {
    part('body', add(B({type: 'rbox', size: [0.9, 0.12, 0.55], radius: 0.04, mat: 'solid', color: '#1a1a66'}), [0, 0.06, 0]));
    const tips = [[-0.38, -0.2], [0, 0], [0.38, 0.2]];
    tips.forEach(([x, rz], i) => { const a = B({type: 'cyl', r: 0.016, h: 0.6, mat: 'solid', color: '#2a2aa0'}); add(a, [x, 0.4, -0.2], [0, 0, -rz]); part('antenna' + (i + 1), a); anchorAt('tip' + (i + 1), x + Math.sin(rz) * 0.3, 0.4 + Math.cos(rz) * 0.3, -0.2); });
    const leds = new THREE.Group(); for (let i = 0; i < 4; i++) leds.add(P(B({type: 'sphere', r: 0.018, mat: 'glow', color: i === 3 ? '#ff4fd8' : '#5cffb2'}), [-0.3 + i * 0.1, 0.125, 0.22])); add(leds); part('leds', leds);
  },
  airtag({g, B, add, part, anchorAt}) {
    add(B({type: 'cyl', r: 0.36, h: 0.09, seg: 64, mat: 'glass', color: '#9aa0ff', opacity: 0.2}), [0, 0.05, 0]);
    part('shell', g.children[0]);
    part('battery', add(B({type: 'cyl', r: 0.2, h: 0.04, seg: 48, mat: 'white'}), [0, 0.04, 0]));
    part('chip', add(B({type: 'box', size: [0.12, 0.012, 0.12], mat: 'glow', color: '#7a6bff'}), [0.17, 0.075, 0.12]));
    part('speaker', add(B({type: 'torus', r: 0.07, tube: 0.012, mat: 'glow', color: '#ff6ad5'}), [-0.2, 0.075, 0.05], [Math.PI / 2, 0, 0]));
    part('antenna', add(B({type: 'torus', r: 0.3, tube: 0.008, mat: 'glow', color: '#6ac1ff'}), [0, 0.075, 0], [Math.PI / 2, 0, 0]));
    part('top', anchorAt('top_', 0, 0.14, 0));
  },
  dishwasher({g, B, add, part, anchorAt, spec, THREE, wireLines}) {
    const rack = (w, d, h, y, n) => { const v = []; for (let i = 0; i <= n; i++) { const x = -w / 2 + (w * i) / n; v.push(x, 0, -d / 2, x, 0, d / 2); } for (let i = 0; i <= n; i++) { const z = -d / 2 + (d * i) / n; v.push(-w / 2, 0, z, w / 2, 0, z); }
      for (const [x, z] of [[-w / 2, -d / 2], [w / 2, -d / 2], [-w / 2, d / 2], [w / 2, d / 2]]) v.push(x, 0, z, x, h, z); v.push(-w / 2, h, -d / 2, w / 2, h, -d / 2, -w / 2, h, d / 2, w / 2, h, d / 2); const l = wireLines(v, '#d6d8ff', 0.55); l.position.y = y; return l; };
    part('body', add(B({type: 'box', size: [1.3, 1.5, 1.15], mat: 'glass', color: '#6c63ff', opacity: 0.07}), [0, 0.78, 0]));
    part('floor', add(B({type: 'box', size: [1.2, 0.05, 1.05], mat: 'solid', color: '#16165e'}), [0, 0.1, 0]));
    part('lowerRack', add(rack(1.1, 0.95, 0.32, 0.32, 10))); part('upperRack', add(rack(1.1, 0.95, 0.22, 0.88, 10)));
    const plates = new THREE.Group(); for (let i = 0; i < 7; i++) plates.add(P(B({type: 'cyl', r: 0.3, h: 0.018, seg: 48, mat: 'glass', color: '#aab0ff', opacity: 0.22}), [-0.42 + i * 0.14, 0.62, 0.0], [0, 0, Math.PI / 2]));
    add(plates); part('plates', plates);
    const mugs = new THREE.Group(); for (let i = 0; i < 5; i++) mugs.add(P(B({type: 'cyl', r: 0.075, h: 0.16, mat: 'glass', color: '#ffd1ff', opacity: 0.25}), [-0.4 + i * 0.2, 1.0, (i % 2) * 0.2 - 0.1])); add(mugs); part('mugs', mugs);
    const arm = new THREE.Group(); arm.add(B({type: 'rbox', size: [0.95, 0.035, 0.09], radius: 0.015, mat: 'white'})); const nz = new THREE.Group(); for (let i = -4; i <= 4; i++) if (i) nz.add(P(B({type: 'sphere', r: 0.012, mat: 'glow', color: '#ffffff'}), [i * 0.1, 0.022, 0])); arm.add(nz);
    add(arm, [0, 0.2, 0]); part('sprayArm', arm);
    part('hub', add(B({type: 'cyl', r: 0.08, h: 0.12, mat: 'glass', color: '#8f9bff', opacity: 0.35}), [0, 0.16, 0]));
    part('heater', add(B({type: 'torus', r: 0.42, tube: 0.018, mat: 'glow', color: '#ff4fd8'}), [0, 0.14, 0], [Math.PI / 2, 0, 0]));
    part('pump', add(B({type: 'cyl', r: 0.14, h: 0.1, mat: 'solid', color: '#2b2bb8'}), [0.62, 0.05, 0.3]));
    const door = new THREE.Group(); door.add(P(B({type: 'box', size: [1.3, 1.4, 0.07], mat: 'glass', color: '#6c63ff', opacity: 0.1}), [0, 0.7, 0]));
    add(door, [0, 0.1, 0.575], [spec.doorOpen ?? 0, 0, 0]); part('door', door);
    part('detergent', door.add(P(B({type: 'box', size: [0.22, 0.12, 0.05], mat: 'solid', color: '#ff9ad8'}), [0.35, 0.6, -0.05])) && door.children[1]);
    part('upperSpray', add(B({type: 'rbox', size: [0.7, 0.025, 0.07], radius: 0.01, mat: 'white'}), [0, 1.2, 0]));
  },
  person({g, B, add, part, spec}) {
    const skin = spec.skin || '#c9b8ee', cloth = spec.cloth || '#5b3fd0', sit = spec.sit;
    part('torso', add(B({type: 'capsule', r: 0.17, h: 0.36, mat: 'solid', color: cloth}), [0, sit ? 0.78 : 1.12, 0]));
    part('head', add(B({type: 'sphere', r: 0.15, mat: 'solid', color: skin}), [0, sit ? 1.22 : 1.58, 0]));
    part('eyes', add(B({type: 'box', size: [0.14, 0.02, 0.02], mat: 'glow', color: '#bfe0ff'}), [0, sit ? 1.24 : 1.6, 0.13]));
    for (const s of [-1, 1]) {
      add(B({type: 'capsule', r: 0.06, h: 0.34, mat: 'solid', color: cloth}), [s * 0.24, sit ? 0.76 : 1.1, sit ? 0.12 : 0], [sit ? 1.1 : 0.05, 0, s * 0.08]);
      part(s < 0 ? 'handL' : 'handR', add(B({type: 'sphere', r: 0.055, mat: 'solid', color: skin}), [s * 0.26, sit ? 0.55 : 0.82, sit ? 0.32 : 0]));
      add(B({type: 'capsule', r: 0.075, h: 0.4, mat: 'solid', color: '#1b1b4a'}), [s * 0.1, sit ? 0.5 : 0.45, sit ? 0.22 : 0], [sit ? 1.45 : 0, 0, 0]);
      if (sit) add(B({type: 'capsule', r: 0.07, h: 0.36, mat: 'solid', color: '#1b1b4a'}), [s * 0.1, 0.25, 0.46]);
    }
  },
  tower({g, B, add, part, anchorAt}) {
    part('mast', add(B({type: 'cyl', r: 0.22, r2: 0.05, h: 3.0, seg: 6, mat: 'glass', color: '#8f8cff', opacity: 0.12}), [0, 1.5, 0]));
    for (let i = 0; i < 3; i++) add(B({type: 'rbox', size: [0.16, 0.5, 0.06], radius: 0.02, mat: 'solid', color: '#2c2cc0'}), [Math.sin(i * 2.094) * 0.2, 2.8, Math.cos(i * 2.094) * 0.2], [0, i * 2.094, 0]);
    part('tip', add(B({type: 'sphere', r: 0.07, mat: 'glow', color: '#ff6ad5'}), [0, 3.08, 0])); anchorAt('top', 0, 2.9, 0);
  },
  server({g, B, add, part}) {
    const leds = new THREE.Group();
    for (let i = 0; i < 5; i++) { add(B({type: 'rbox', size: [0.7, 0.16, 0.5], radius: 0.02, mat: 'solid', color: '#1c1c78'}), [0, 0.1 + i * 0.19, 0]); leds.add(P(B({type: 'box', size: [0.1, 0.02, 0.02], mat: 'glow', color: i % 2 ? '#5cffb2' : '#6ac1ff'}), [0.2, 0.1 + i * 0.19, 0.26])); }
    add(leds); part('leds', leds); part('stack', g);
  },
  plane({g, B, add, part, anchorAt}) {
    part('body', add(B({type: 'capsule', r: 0.2, h: 1.9, mat: 'glass', color: '#9aa0ff', opacity: 0.2}), [0, 0, 0], [0, 0, Math.PI / 2]));
    part('wingL', add(B({type: 'box', size: [0.55, 0.03, 1.9], mat: 'glass', color: '#8f9bff', opacity: 0.2}), [0.1, 0, 0], [0, 0.0, 0]));
    part('tail', add(B({type: 'box', size: [0.3, 0.5, 0.03], mat: 'glass', color: '#8f9bff', opacity: 0.2}), [-1.0, 0.3, 0]));
    part('nose', anchorAt('nose_', 1.15, 0, 0)); part('engineL', add(B({type: 'cyl', r: 0.09, h: 0.32, mat: 'solid', color: '#3030c8'}), [0.2, -0.12, 0.6], [0, 0, Math.PI / 2])); part('engineR', add(B({type: 'cyl', r: 0.09, h: 0.32, mat: 'solid', color: '#3030c8'}), [0.2, -0.12, -0.6], [0, 0, Math.PI / 2]));
  },
  laptop({g, B, add, part}) {
    part('base', add(B({type: 'rbox', size: [0.9, 0.04, 0.62], radius: 0.015, mat: 'solid', color: '#1a1a66'}), [0, 0.02, 0]));
    const lid = new THREE.Group(); lid.add(P(B({type: 'rbox', size: [0.9, 0.58, 0.03], radius: 0.015, mat: 'solid', color: '#14145a'}), [0, 0.29, 0]));
    const s = new THREE.Mesh(new THREE.PlaneGeometry(0.84, 0.52), new THREE.MeshBasicMaterial({color: new THREE.Color('#3a3aff'), transparent: true})); s.material.userData = {kind: 'basic', baseOpacity: 1, baseColor: new THREE.Color('#fff')}; s.position.set(0, 0.29, 0.017); lid.add(s);
    add(lid, [0, 0.04, -0.3], [-0.25, 0, 0]); part('screen', s); part('lid', lid);
  },
  headphones({g, B, add, part, anchorAt}) {
    part('band', add(B({type: 'torus', r: 0.5, tube: 0.04, arc: Math.PI, mat: 'solid', color: '#2b2bc4'}), [0, 0.0, 0]));
    for (const s of [-1, 1]) {
      part(s < 0 ? 'cupL' : 'cupR', add(B({type: 'cyl', r: 0.24, h: 0.2, mat: 'solid', color: '#1d1d86'}), [s * 0.5, 0, 0], [0, 0, Math.PI / 2]));
      part(s < 0 ? 'micL' : 'micR', add(B({type: 'sphere', r: 0.035, mat: 'glow', color: '#6ac1ff'}), [s * 0.62, -0.05, 0.14]));
      part(s < 0 ? 'padL' : 'padR', add(B({type: 'torus', r: 0.2, tube: 0.05, mat: 'solid', color: '#3c3cd0'}), [s * 0.4, 0, 0], [0, Math.PI / 2, 0]));
    }
    anchorAt('ear', 0, 0, 0);
  },
  microwave({g, B, add, part, anchorAt}) {
    part('body', add(B({type: 'box', size: [1.25, 0.75, 0.9], mat: 'glass', color: '#6c63ff', opacity: 0.1}), [0, 0.4, 0]));
    part('turntable', add(B({type: 'cyl', r: 0.3, h: 0.02, mat: 'glass', color: '#aab0ff', opacity: 0.3}), [-0.12, 0.14, 0]));
    part('cup', add(B({type: 'cyl', r: 0.09, h: 0.16, mat: 'glass', color: '#6ac1ff', opacity: 0.35}), [-0.12, 0.24, 0]));
    part('water', add(B({type: 'cyl', r: 0.08, h: 0.1, mat: 'glow', color: '#4aa8ff', opacity: 0.6}), [-0.12, 0.21, 0]));
    part('magnetron', add(B({type: 'rbox', size: [0.2, 0.22, 0.18], radius: 0.03, mat: 'solid', color: '#a02ad0'}), [0.5, 0.55, 0]));
    part('door', add(B({type: 'box', size: [1.0, 0.7, 0.04], mat: 'glass', color: '#8f9bff', opacity: 0.12}), [-0.1, 0.4, 0.46]));
    anchorAt('mouth', 0.4, 0.55, 0);
  },
  globe({g, B, add, part}) {
    part('sphere', add(B({type: 'sphere', r: 0.7, mat: 'glass', color: '#6a8cff', opacity: 0.12}), [0, 0.8, 0]));
    for (let i = 0; i < 3; i++) add(B({type: 'torus', r: 0.7, tube: 0.006, mat: 'glow', color: '#7a8cff'}), [0, 0.8, 0], [Math.PI / 2, 0, i * 1.05]);
  },
  satellite({g, B, add, part}) {
    part('body', add(B({type: 'rbox', size: [0.3, 0.3, 0.3], radius: 0.04, mat: 'solid', color: '#3a3ad0'})));
    for (const s of [-1, 1]) add(B({type: 'box', size: [0.6, 0.02, 0.28], mat: 'glass', color: '#3ad0ff', opacity: 0.35}), [s * 0.5, 0, 0]);
    part('dish', add(B({type: 'cone', r: 0.14, h: 0.12, mat: 'solid', color: '#e0e0ff'}), [0, -0.2, 0], [Math.PI, 0, 0]));
  },
  cloud({g, B, add}) { for (const [x, y, r] of [[0, 0, 0.3], [0.3, -0.04, 0.24], [-0.3, -0.04, 0.22], [0.1, 0.18, 0.22]]) add(B({type: 'sphere', r, mat: 'glass', color: '#aab0ff', opacity: 0.22}), [x, y, 0]); },
  lock({g, B, add, part}) {
    part('body', add(B({type: 'rbox', size: [0.5, 0.4, 0.2], radius: 0.05, mat: 'solid', color: '#3b2fd0'}), [0, 0.2, 0]));
    part('shackle', add(B({type: 'torus', r: 0.14, tube: 0.035, arc: Math.PI, mat: 'solid', color: '#c9c9ff'}), [0, 0.4, 0]));
  },
  battery({g, B, add, part}) {
    part('body', add(B({type: 'cyl', r: 0.2, h: 0.7, mat: 'glass', color: '#38e0b0', opacity: 0.2}), [0, 0.35, 0]));
    add(B({type: 'cyl', r: 0.07, h: 0.07, mat: 'white'}), [0, 0.74, 0]); part('charge', add(B({type: 'cyl', r: 0.16, h: 0.36, mat: 'glow', color: '#38e0b0', opacity: 0.7}), [0, 0.22, 0]));
  },
  magnet({g, B, add, part}) {
    part('body', add(B({type: 'torus', r: 0.3, tube: 0.1, arc: Math.PI, mat: 'solid', color: '#e02a5a'}), [0, 0.3, 0], [0, 0, Math.PI]));
    add(B({type: 'box', size: [0.2, 0.12, 0.2], mat: 'white'}), [-0.3, 0.07, 0]); add(B({type: 'box', size: [0.2, 0.12, 0.2], mat: 'white'}), [0.3, 0.07, 0]);
  },
  bulb({g, B, add, part}) {
    part('glass', add(B({type: 'sphere', r: 0.3, mat: 'glass', color: '#ffe08a', opacity: 0.18}), [0, 0.55, 0]));
    add(B({type: 'cyl', r: 0.12, h: 0.2, mat: 'solid', color: '#8a8aff'}), [0, 0.2, 0]); part('filament', add(B({type: 'torus', r: 0.08, tube: 0.01, mat: 'glow', color: '#ffd45c'}), [0, 0.55, 0]));
  },
  gear({g, B, add, part}) {
    const body = add(B({type: 'cyl', r: 0.3, h: 0.1, mat: 'solid', color: '#4a4af0'})); for (let i = 0; i < 10; i++) { const a = i / 10 * Math.PI * 2; add(B({type: 'box', size: [0.12, 0.1, 0.1], mat: 'solid', color: '#4a4af0'}), [Math.cos(a) * 0.34, 0, Math.sin(a) * 0.34], [0, -a, 0]); }
    part('body', g);
  },
  sign({g, B, add, part, spec, canvasTex, THREE}) {
    const w = spec.w ?? 1.0, h = spec.h ?? 0.35;
    const tex = canvasTex(512, Math.round(512 * h / w), (c, cw, ch) => { c.fillStyle = 'rgba(20,20,70,.75)'; c.beginPath(); c.roundRect(2, 2, cw - 4, ch - 4, 24); c.fill(); c.strokeStyle = '#fff'; c.lineWidth = 5; c.stroke(); c.fillStyle = '#fff'; c.font = `900 ${Math.round(ch * 0.5)}px Mont,Arial`; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText(spec.text || '', cw / 2, ch / 2 + 4); });
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({map: tex, transparent: true, side: THREE.DoubleSide, depthWrite: false})); m.material.userData = {kind: 'basic', baseOpacity: 1, baseColor: new THREE.Color('#fff')}; add(m);
    if (spec.billboard !== false) m.userData.billboard = true; part('plane', m);
  },
  chip({g, B, add, part}) {
    part('body', add(B({type: 'rbox', size: [0.5, 0.06, 0.5], radius: 0.02, mat: 'solid', color: '#2a2aa8'}), [0, 0.03, 0]));
    part('core', add(B({type: 'box', size: [0.22, 0.02, 0.22], mat: 'glow', color: '#7a6bff'}), [0, 0.07, 0]));
    for (let i = 0; i < 8; i++) for (const s of [-1, 1]) add(B({type: 'box', size: [0.05, 0.02, 0.012], mat: 'white'}), [-0.175 + i * 0.05, 0.03, s * 0.26]);
  },
  coffee({g, B, add, part}) {
    part('cup', add(B({type: 'cyl', r: 0.22, r2: 0.26, h: 0.4, mat: 'glass', color: '#c9a0ff', opacity: 0.25}), [0, 0.2, 0]));
    part('liquid', add(B({type: 'cyl', r: 0.2, h: 0.3, mat: 'solid', color: '#6a3a1a'}), [0, 0.18, 0]));
  },
  mag({g, B, add, part}) { // magnifying glass
    part('lens', add(B({type: 'torus', r: 0.25, tube: 0.03, mat: 'white'}), [0, 0.3, 0])); part('glass', add(B({type: 'disc', r: 0.25, mat: 'glass', color: '#aab6ff', opacity: 0.2}), [0, 0.3, 0]));
    add(B({type: 'cyl', r: 0.025, h: 0.4, mat: 'white'}), [0.22, 0.0, 0], [0, 0, 0.7]);
  }
};
