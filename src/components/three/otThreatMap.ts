/**
 * "OT Threat Map" entrance — lightweight Three.js scene.
 * See vault/DESIGN-IDEAS.md for the concept + performance/a11y budget.
 *
 * Layers (4 draw calls): OT signal grid (shader plane), topology nodes (Points),
 * links (LineSegments), packet pulses (Points, GPU-advanced). All motion runs in
 * shaders; the JS loop only lerps camera/scan targets. Pauses on tab blur and when
 * scrolled off-screen. Not initialised at all under prefers-reduced-motion.
 */
import * as THREE from 'three';

export interface ThreatMap {
  launch: () => Promise<void>;
  destroy: () => void;
}

const CYAN = new THREE.Color('#35e6d4');
const ANOMALY = new THREE.Color('#ff4d5e');

export function initThreatMap(container: HTMLElement): ThreatMap | null {
  let renderer: THREE.WebGLRenderer;
  try {
    renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'low-power' });
  } catch {
    return null; // WebGL unavailable → keep the CSS stand-in
  }

  const pixelRatio = Math.min(window.devicePixelRatio || 1, 2);
  renderer.setPixelRatio(pixelRatio);
  renderer.setClearColor(0x000000, 0);
  container.appendChild(renderer.domElement);
  container.classList.add('webgl-active');
  Object.assign(renderer.domElement.style, { position: 'absolute', inset: '0', width: '100%', height: '100%' });

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(55, 1, 0.1, 200);
  const camBase = new THREE.Vector3(0, 7, 21);
  camera.position.copy(camBase);
  const lookTarget = new THREE.Vector3(0, 3.5, -4);

  // ---- Grid floor ---------------------------------------------------------
  const gridUniforms = {
    uTime: { value: 0 },
    uScan: { value: 0 },
    uBase: { value: new THREE.Color('#0b1524') },
    uLine: { value: CYAN },
  };
  const grid = new THREE.Mesh(
    new THREE.PlaneGeometry(150, 150, 90, 90),
    new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      uniforms: gridUniforms,
      vertexShader: /* glsl */ `
        uniform float uTime;
        varying vec2 vUv;
        varying float vElev;
        void main() {
          vUv = uv;
          vec3 p = position;
          float e = sin(p.x * 0.18 + uTime * 0.6) * 0.7
                  + cos(p.y * 0.22 + uTime * 0.45) * 0.55
                  + sin((p.x + p.y) * 0.12 - uTime * 0.3) * 0.4;
          p.z += e;               // local +z becomes world up (mesh is rotated flat)
          vElev = e;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
        }
      `,
      fragmentShader: /* glsl */ `
        precision highp float;
        uniform vec3 uBase;
        uniform vec3 uLine;
        uniform float uScan;
        varying vec2 vUv;
        varying float vElev;
        void main() {
          vec2 gc = vUv * 70.0;
          vec2 g = abs(fract(gc) - 0.5) / fwidth(gc);
          float line = 1.0 - min(min(g.x, g.y), 1.0);
          float d = distance(vUv, vec2(0.5));
          float ring = smoothstep(0.018, 0.0, abs(d - uScan));
          float fade = smoothstep(0.72, 0.12, d);
          vec3 col = mix(uBase, uLine, line);
          col += uLine * ring * 1.3;
          col += uLine * clamp(vElev * 0.14, 0.0, 0.35);
          float alpha = (0.09 + line * 0.5 + ring * 0.65) * fade;
          gl_FragColor = vec4(col, alpha);
        }
      `,
    })
  );
  grid.rotation.x = -Math.PI / 2;
  grid.position.y = -0.5;
  scene.add(grid);

  // ---- Node graph ---------------------------------------------------------
  const NODE_COUNT = 72;
  const nodePos: THREE.Vector3[] = [];
  for (let i = 0; i < NODE_COUNT; i++) {
    nodePos.push(new THREE.Vector3(
      (Math.random() - 0.5) * 64,
      2 + Math.random() * 9,
      -34 + Math.random() * 40
    ));
  }
  const anomalyIndex = Math.floor(Math.random() * NODE_COUNT);

  const nPos = new Float32Array(NODE_COUNT * 3);
  const nPhase = new Float32Array(NODE_COUNT);
  const nSize = new Float32Array(NODE_COUNT);
  const nColor = new Float32Array(NODE_COUNT * 3);
  nodePos.forEach((v, i) => {
    nPos.set([v.x, v.y, v.z], i * 3);
    nPhase[i] = Math.random() * Math.PI * 2;
    nSize[i] = 6 + Math.random() * 6;
    const c = i === anomalyIndex ? ANOMALY : CYAN;
    nColor.set([c.r, c.g, c.b], i * 3);
  });
  if (anomalyIndex >= 0) nSize[anomalyIndex] = 14;

  const nodeGeo = new THREE.BufferGeometry();
  nodeGeo.setAttribute('position', new THREE.BufferAttribute(nPos, 3));
  nodeGeo.setAttribute('aPhase', new THREE.BufferAttribute(nPhase, 1));
  nodeGeo.setAttribute('aSize', new THREE.BufferAttribute(nSize, 1));
  nodeGeo.setAttribute('aColor', new THREE.BufferAttribute(nColor, 3));

  const pointFrag = /* glsl */ `
    precision highp float;
    varying vec3 vColor;
    varying float vFade;
    void main() {
      vec2 c = gl_PointCoord - 0.5;
      float d = length(c);
      if (d > 0.5) discard;
      float glow = smoothstep(0.5, 0.0, d);
      gl_FragColor = vec4(vColor, glow * glow * vFade);
    }
  `;

  const nodes = new THREE.Points(nodeGeo, new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    uniforms: { uTime: { value: 0 }, uPix: { value: pixelRatio } },
    vertexShader: /* glsl */ `
      attribute float aPhase;
      attribute float aSize;
      attribute vec3 aColor;
      uniform float uTime;
      uniform float uPix;
      varying vec3 vColor;
      varying float vFade;
      void main() {
        vec4 mv = modelViewMatrix * vec4(position, 1.0);
        float pulse = 0.55 + 0.45 * sin(uTime * 2.0 + aPhase);
        vColor = aColor * pulse;
        vFade = clamp((42.0 + mv.z) / 40.0, 0.0, 1.0);
        gl_PointSize = aSize * uPix * (300.0 / max(-mv.z, 1.0));
        gl_Position = projectionMatrix * mv;
      }
    `,
    fragmentShader: pointFrag,
  }));
  scene.add(nodes);

  // ---- Links + packets ----------------------------------------------------
  const edges: [number, number][] = [];
  const seen = new Set<string>();
  for (let i = 0; i < NODE_COUNT; i++) {
    const dists = nodePos
      .map((v, j) => ({ j, d: nodePos[i].distanceTo(v) }))
      .filter((o) => o.j !== i)
      .sort((a, b) => a.d - b.d)
      .slice(0, 3);
    for (const { j, d } of dists) {
      if (d > 22) continue;
      const key = i < j ? `${i}-${j}` : `${j}-${i}`;
      if (seen.has(key)) continue;
      seen.add(key);
      edges.push([i, j]);
    }
  }

  const linkPos = new Float32Array(edges.length * 6);
  const linkCol = new Float32Array(edges.length * 6);
  edges.forEach(([a, b], e) => {
    const va = nodePos[a], vb = nodePos[b];
    linkPos.set([va.x, va.y, va.z, vb.x, vb.y, vb.z], e * 6);
    const c = a === anomalyIndex || b === anomalyIndex ? ANOMALY : CYAN;
    linkCol.set([c.r, c.g, c.b, c.r, c.g, c.b], e * 6);
  });
  const linkGeo = new THREE.BufferGeometry();
  linkGeo.setAttribute('position', new THREE.BufferAttribute(linkPos, 3));
  linkGeo.setAttribute('color', new THREE.BufferAttribute(linkCol, 3));
  const links = new THREE.LineSegments(linkGeo, new THREE.LineBasicMaterial({
    vertexColors: true, transparent: true, opacity: 0.16,
    blending: THREE.AdditiveBlending, depthWrite: false,
  }));
  scene.add(links);

  // Packets: ~2 per edge, advanced along the edge in the vertex shader.
  const PACKETS = Math.min(edges.length * 2, 260);
  const pStart = new Float32Array(PACKETS * 3);
  const pEnd = new Float32Array(PACKETS * 3);
  const pOff = new Float32Array(PACKETS);
  const pCol = new Float32Array(PACKETS * 3);
  for (let i = 0; i < PACKETS; i++) {
    const [a, b] = edges[i % edges.length];
    const va = nodePos[a], vb = nodePos[b];
    pStart.set([va.x, va.y, va.z], i * 3);
    pEnd.set([vb.x, vb.y, vb.z], i * 3);
    pOff[i] = Math.random();
    const c = a === anomalyIndex || b === anomalyIndex ? ANOMALY : CYAN;
    pCol.set([c.r, c.g, c.b], i * 3);
  }
  const pkGeo = new THREE.BufferGeometry();
  // position attribute is required by three; we override it in the shader from aStart/aEnd
  pkGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(PACKETS * 3), 3));
  pkGeo.setAttribute('aStart', new THREE.BufferAttribute(pStart, 3));
  pkGeo.setAttribute('aEnd', new THREE.BufferAttribute(pEnd, 3));
  pkGeo.setAttribute('aOff', new THREE.BufferAttribute(pOff, 1));
  pkGeo.setAttribute('aColor', new THREE.BufferAttribute(pCol, 3));

  const packetUniforms = { uTime: { value: 0 }, uPix: { value: pixelRatio }, uSpeed: { value: 0.12 } };
  const packets = new THREE.Points(pkGeo, new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    uniforms: packetUniforms,
    vertexShader: /* glsl */ `
      attribute vec3 aStart;
      attribute vec3 aEnd;
      attribute float aOff;
      attribute vec3 aColor;
      uniform float uTime;
      uniform float uPix;
      uniform float uSpeed;
      varying vec3 vColor;
      varying float vFade;
      void main() {
        float t = fract(uTime * uSpeed + aOff);
        vec3 p = mix(aStart, aEnd, t);
        vec4 mv = modelViewMatrix * vec4(p, 1.0);
        float head = sin(t * 3.14159);           // dim at both ends of the run
        vColor = aColor * (0.6 + 0.4 * head);
        vFade = clamp((42.0 + mv.z) / 40.0, 0.0, 1.0) * head;
        gl_PointSize = 3.2 * uPix * (300.0 / max(-mv.z, 1.0));
        gl_Position = projectionMatrix * mv;
      }
    `,
    fragmentShader: pointFrag,
  }));
  scene.add(packets);

  // ---- Interaction + loop -------------------------------------------------
  const mouse = { x: 0, y: 0 };
  const onMove = (e: MouseEvent) => {
    mouse.x = (e.clientX / window.innerWidth) * 2 - 1;
    mouse.y = (e.clientY / window.innerHeight) * 2 - 1;
  };
  window.addEventListener('mousemove', onMove, { passive: true });

  // Pause-safe elapsed timer (avoids deprecated THREE.Clock; no time jump after a pause).
  let elapsed = 0;
  let lastTs = 0;
  let launching = false;
  let dolly = 0; // 0 = idle framing, 1 = fully launched

  function resize() {
    const w = container.clientWidth || 1;
    const h = container.clientHeight || 1;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  }
  const ro = new ResizeObserver(resize);
  ro.observe(container);
  resize();

  let rafId = 0;
  let running = false;
  function frame() {
    const now = performance.now();
    elapsed += (now - lastTs) / 1000;
    lastTs = now;
    const t = elapsed;
    gridUniforms.uTime.value = t;
    (nodes.material as THREE.ShaderMaterial).uniforms.uTime.value = t;
    packetUniforms.uTime.value = t;

    // repeating scan wave (0 → 0.8), plus a burst while launching
    gridUniforms.uScan.value = (t * 0.06 + dolly * 0.5) % 0.82;
    packetUniforms.uSpeed.value = 0.12 + dolly * 0.9;

    // camera: idle parallax, or dive forward AND up while launching so we sweep
    // past the title and over the horizon (not just a straight zoom).
    const ease = 0.06 + dolly * 0.14;
    const targetX = camBase.x + mouse.x * 2.2;
    const targetY = camBase.y - mouse.y * 1.2 + dolly * 4.5;
    const targetZ = camBase.z - dolly * 30;
    camera.position.x += (targetX - camera.position.x) * 0.05;
    camera.position.y += (targetY - camera.position.y) * ease;
    camera.position.z += (targetZ - camera.position.z) * ease;
    lookTarget.y = 3.5 + dolly * 7.0; // tilt the gaze upward through the launch
    camera.lookAt(lookTarget);

    renderer.render(scene, camera);
    rafId = requestAnimationFrame(frame);
  }
  function start() {
    if (running) return;
    running = true;
    lastTs = performance.now();
    rafId = requestAnimationFrame(frame);
  }
  function stop() {
    running = false;
    cancelAnimationFrame(rafId);
  }

  // Pause when off-screen or tab hidden.
  const io = new IntersectionObserver(
    ([entry]) => { if (entry.isIntersecting && !document.hidden) start(); else stop(); },
    { threshold: 0.05 }
  );
  io.observe(container);
  const onVis = () => { if (document.hidden) stop(); else start(); };
  document.addEventListener('visibilitychange', onVis);

  function launch(): Promise<void> {
    if (launching) return Promise.resolve();
    launching = true;
    start();
    return new Promise((resolve) => {
      const startT = performance.now();
      const dur = 1000;
      const tick = () => {
        const k = Math.min((performance.now() - startT) / dur, 1);
        dolly = k * k; // ease-in
        if (k < 1) requestAnimationFrame(tick);
        else resolve();
      };
      requestAnimationFrame(tick);
    });
  }

  function destroy() {
    stop();
    io.disconnect();
    ro.disconnect();
    window.removeEventListener('mousemove', onMove);
    document.removeEventListener('visibilitychange', onVis);
    scene.traverse((o) => {
      const any = o as unknown as { geometry?: THREE.BufferGeometry; material?: THREE.Material };
      any.geometry?.dispose();
      any.material?.dispose();
    });
    renderer.dispose();
    renderer.domElement.remove();
    container.classList.remove('webgl-active');
  }

  return { launch, destroy };
}
