import * as THREE from 'three';
export const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
export const lerp = (a, b, t) => a + (b - a) * t;
export const ease = t => { t = clamp(t, 0, 1); return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2; };
export const V3 = (...a) => new THREE.Vector3(...a);

const GLASS_VS = `varying vec3 vN; varying vec3 vV; void main(){ vec4 mv=modelViewMatrix*vec4(position,1.); vN=normalize(normalMatrix*normal); vV=normalize(-mv.xyz); gl_Position=projectionMatrix*mv; }`;
const GLASS_FS = `uniform vec3 c; uniform float op; uniform float k; varying vec3 vN; varying vec3 vV;
void main(){ float f=pow(1.-abs(dot(normalize(vN),normalize(vV))),2.0); float a=(op+f*0.5)*k; gl_FragColor=vec4(c*(0.30+f*0.85),a); }`;

export function makeMat(kind, color = '#6a63ff', opacity) {
  const col = new THREE.Color(color);
  let m;
  if (kind === 'glass') {
    m = new THREE.ShaderMaterial({transparent: true, depthWrite: false, side: THREE.DoubleSide, uniforms: {c: {value: col.clone()}, op: {value: opacity ?? 0.12}, k: {value: 1}}, vertexShader: GLASS_VS, fragmentShader: GLASS_FS});
  } else if (kind === 'glow') {
    m = new THREE.MeshBasicMaterial({color: col.clone().multiplyScalar(1.25), transparent: true, opacity: opacity ?? 1, blending: THREE.AdditiveBlending, depthWrite: false});
  } else if (kind === 'white') {
    m = new THREE.MeshStandardMaterial({color: new THREE.Color('#e8e8ff'), roughness: 0.35, metalness: 0.1, emissive: new THREE.Color('#9a9aff'), emissiveIntensity: 0.28, transparent: true});
  } else { // solid
    m = new THREE.MeshStandardMaterial({color: col.clone(), roughness: 0.42, metalness: 0.35, emissive: col.clone(), emissiveIntensity: 0.14, transparent: true});
  }
  m.userData = {kind, baseColor: col.clone(), baseOpacity: m.opacity ?? 1};
  return m;
}
export function edgesFor(geom, color = '#c9c4ff', angle = 28) {
  const l = new THREE.LineSegments(new THREE.EdgesGeometry(geom, angle), new THREE.LineBasicMaterial({color: new THREE.Color(color).multiplyScalar(0.8), transparent: true, opacity: 0.75}));
  l.material.userData = {kind: 'line', baseOpacity: 0.75, baseColor: new THREE.Color(color)};
  return l;
}
export function wireLines(verts, color = '#cfd0ff', opacity = 0.7) {
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(verts, 3));
  const l = new THREE.LineSegments(g, new THREE.LineBasicMaterial({color: new THREE.Color(color), transparent: true, opacity}));
  l.material.userData = {kind: 'line', baseOpacity: opacity, baseColor: new THREE.Color(color)};
  return l;
}
export function setFade(o, v) {
  o.userData.fade = v;
  o.traverse(n => {
    const m = n.material; if (!m) return;
    const u = m.userData || {};
    if (m.isShaderMaterial) m.uniforms.k.value = v; else { m.opacity = (u.baseOpacity ?? 1) * v; m.transparent = true; }
    n.visible = v > 0.01;
  });
}
export function setTint(o, color) {
  o.traverse(n => {
    const m = n.material; if (!m || !m.userData || m.userData.kind === 'line') return;
    const u = m.userData; const c = color || u.baseColor;
    if (m.isShaderMaterial) m.uniforms.c.value.copy(c);
    else if (m.emissive && u.kind === 'solid') { m.color.copy(c); m.emissive.copy(c); }
    else if (u.kind === 'glow') m.color.copy(c).multiplyScalar(1.25);
  });
}
export function canvasTex(w, h, draw) {
  const cv = document.createElement('canvas'); cv.width = w; cv.height = h; const ctx = cv.getContext('2d'); draw(ctx, w, h);
  const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; return t;
}
