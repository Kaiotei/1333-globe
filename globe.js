// Holographic globe (from the 13 <33 Covenant landing page).
// One draw call each for land, halo, grid, arcs and city nodes; no per-city lights;
// the ocean is cut in the shader; the loop stops while the tab is hidden.
// Needs #globeContainer > #globeCanvas in the page. AGPL-3.0.

import * as THREE from 'https://unpkg.com/three@0.185.1/build/three.module.js';

const container = document.getElementById('globeContainer');
const canvas = document.getElementById('globeCanvas');

function initGlobe() {
    const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
    const renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true, powerPreference: 'low-power' });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
    renderer.setClearColor(0x000000, 0);

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(42, 1, 0.1, 100);

    const R = 2;
    const tilt = new THREE.Group();   // axial tilt + pointer parallax
    const globe = new THREE.Group();  // spins on its own axis
    tilt.rotation.x = 0.28;
    tilt.add(globe);
    scene.add(tilt);

    const tmpA = new THREE.Vector3(), tmpB = new THREE.Vector3();
    function ll(lat, lng, r, out = new THREE.Vector3()) {
        const phi = (90 - lat) * Math.PI / 180;
        const theta = (lng + 180) * Math.PI / 180;
        return out.set(-r * Math.sin(phi) * Math.cos(theta), r * Math.cos(phi), r * Math.sin(phi) * Math.sin(theta));
    }

    /* ── earth: lavender land, glassy ocean, fresnel rim ── */
    const earthMat = new THREE.ShaderMaterial({
        transparent: true,
        uniforms: {
            map: { value: null }, hasMap: { value: 0 },
            lightDir: { value: new THREE.Vector3(0.55, 0.45, 0.7).normalize() },
            land: { value: new THREE.Color(0xe0ccf8) },
            shade: { value: new THREE.Color(0x322036) },
            ocean: { value: new THREE.Color(0x9B6CD8) },
            rim: { value: new THREE.Color(0xc4a8e8) }
        },
        vertexShader: `
            varying vec2 vUv; varying vec3 vN; varying vec3 vV;
            void main() {
                vUv = uv;
                vec4 mv = modelViewMatrix * vec4(position, 1.0);
                vN = normalize(normalMatrix * normal);
                vV = normalize(-mv.xyz);
                gl_Position = projectionMatrix * mv;
            }`,
        fragmentShader: `
            uniform sampler2D map; uniform float hasMap;
            uniform vec3 lightDir, land, shade, ocean, rim;
            varying vec2 vUv; varying vec3 vN; varying vec3 vV;
            void main() {
                vec3 n = normalize(vN);
                float fres = pow(1.0 - max(dot(n, normalize(vV)), 0.0), 2.5);
                float diff = max(dot(n, lightDir), 0.0) * 0.7 + 0.3;
                vec3 tex = texture2D(map, vUv).rgb;
                /* ocean = blue-dominant (the old CPU test); near-white ice stays land */
                float isOcean = 1.0 - hasMap * (1.0 - step(tex.r * 1.12, tex.b) * step(tex.g * 0.9, tex.b) * step(0.176, tex.b));
                float lum = dot(tex, vec3(0.299, 0.587, 0.114));
                vec3 landCol = mix(shade, land, clamp(0.45 + lum * 1.1, 0.0, 1.0)) * diff;
                vec3 col = mix(landCol, mix(ocean, rim, fres), isOcean) + rim * fres * 0.45;
                float a = mix(0.96, 0.08 + fres * 0.55, isOcean);
                gl_FragColor = vec4(col, a);
                #include <colorspace_fragment>
            }`
    });
    const earth = new THREE.Mesh(new THREE.SphereGeometry(R, 96, 64), earthMat);
    earth.renderOrder = 0;
    globe.add(earth);

    const TEX = [
        'https://unpkg.com/three-globe/example/img/earth-day.jpg',
        'https://upload.wikimedia.org/wikipedia/commons/thumb/c/cd/Land_ocean_ice_2048.jpg/1024px-Land_ocean_ice_2048.jpg'
    ];
    const loader = new THREE.TextureLoader();
    loader.setCrossOrigin('anonymous');
    (function loadTex(i) {
        if (i >= TEX.length) return;
        loader.load(TEX[i], (tex) => {
            tex.anisotropy = Math.min(4, renderer.capabilities.getMaxAnisotropy());
            earthMat.uniforms.map.value = tex;
            earthMat.uniforms.hasMap.value = 1;
        }, undefined, () => loadTex(i + 1));
    })(0);

    /* ── halo: back-face shell, additive ── */
    const halo = new THREE.Mesh(
        new THREE.SphereGeometry(R * 1.14, 64, 48),
        new THREE.ShaderMaterial({
            side: THREE.BackSide, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
            uniforms: { color: { value: new THREE.Color(0xc4a8e8) } },
            vertexShader: `
                varying vec3 vN; varying vec3 vV;
                void main() {
                    vec4 mv = modelViewMatrix * vec4(position, 1.0);
                    vN = normalize(normalMatrix * normal);
                    vV = normalize(-mv.xyz);
                    gl_Position = projectionMatrix * mv;
                }`,
            fragmentShader: `
                uniform vec3 color; varying vec3 vN; varying vec3 vV;
                void main() {
                    float k = pow(clamp(0.72 + dot(normalize(vN), normalize(vV)), 0.0, 1.0), 3.0);
                    gl_FragColor = vec4(color, k * 0.9);
                    #include <colorspace_fragment>
                }`
        })
    );
    halo.renderOrder = 1;
    tilt.add(halo);

    /* ── lat/lng grid: one LineSegments ── */
    const GR = R * 1.01, grid = [];
    const seg = (la1, lo1, la2, lo2) => {
        ll(la1, lo1, GR, tmpA); ll(la2, lo2, GR, tmpB);
        grid.push(tmpA.x, tmpA.y, tmpA.z, tmpB.x, tmpB.y, tmpB.z);
    };
    for (let la = -75; la <= 75; la += 15) for (let lo = -180; lo < 180; lo += 4) seg(la, lo, la, lo + 4);
    for (let lo = -180; lo < 180; lo += 15) for (let la = -90; la < 90; la += 3) seg(la, lo, la + 3, lo);
    const gridGeo = new THREE.BufferGeometry();
    gridGeo.setAttribute('position', new THREE.Float32BufferAttribute(grid, 3));
    const GRID_COLOR = 0xc4a8e8;
    const gridMat = new THREE.LineBasicMaterial({ color: GRID_COLOR, transparent: true, opacity: 0.4, depthWrite: false });
    const gridLines = new THREE.LineSegments(gridGeo, gridMat);
    gridLines.renderOrder = 2;
    globe.add(gridLines);

    /* ── cities ── */
    const cities = [
        { name: 'PITTSBURGH',   lat: 40.44, lng: -79.99  },
        { name: 'COLUMBUS',     lat: 39.96, lng: -82.99  },
        { name: 'NEW YORK',     lat: 40.71, lng: -74.01  },
        { name: 'DALLAS',       lat: 32.78, lng: -96.80  },
        { name: 'LOS ANGELES',  lat: 34.05, lng: -118.24 },
        { name: 'SEATTLE',      lat: 47.61, lng: -122.33 },
        { name: 'MIAMI',        lat: 25.77, lng: -80.19  },
        { name: 'N. CAROLINA',  lat: 35.63, lng: -79.80  },
        { name: 'TORONTO',      lat: 43.65, lng: -79.38  },
        { name: 'MEXICO',       lat: 23.63, lng: -102.55 },
        { name: 'HONDURAS',     lat: 15.20, lng: -86.24  },
        { name: 'MADEIRA',      lat: 32.65, lng: -16.90  },
        { name: 'NIGERIA',      lat:  9.08, lng:   8.67  },
        { name: 'GERMANY',      lat: 51.16, lng:  10.45  },
        { name: 'SWITZERLAND',  lat: 46.82, lng:   8.23  },
        { name: 'TURKEY',       lat: 38.96, lng:  35.24  },
        { name: 'SAUDI ARABIA', lat: 23.89, lng:  45.08  },
        { name: 'THAILAND',     lat: 15.87, lng: 100.99  },
        { name: 'UK',           lat: 51.51, lng:  -0.13  },
        { name: 'FRANCE',       lat: 46.23, lng:   2.21  },
        { name: 'ITALY',        lat: 41.87, lng:  12.57  },
        { name: 'SINGAPORE',    lat:  1.35, lng: 103.82  },
        { name: 'JAPAN',        lat: 36.20, lng: 138.25  },
        { name: 'AUSTRALIA',    lat: -25.27, lng: 133.78 }
    ];
    const NODE_R = R * 1.025;
    const cityPos = cities.map(c => ll(c.lat, c.lng, NODE_R));

    /* ── arcs from home (Pittsburgh) to every city, one LineSegments;
          a light pulse travels each arc in the shader ── */
    const arcPos = [], arcT = [], arcOff = [];
    const STEPS = 40;
    const home = cityPos[0].clone().normalize();
    for (let i = 1; i < cityPos.length; i++) {
        const to = cityPos[i].clone().normalize();
        const lift = 0.04 + 0.32 * home.angleTo(to) / Math.PI;
        const off = Math.random();
        let prev = null;
        for (let s = 0; s <= STEPS; s++) {
            const t = s / STEPS;
            const p = tmpA.copy(home).lerp(to, t).normalize().multiplyScalar(R * (1.02 + lift * Math.sin(Math.PI * t)));
            if (prev) {
                arcPos.push(prev.x, prev.y, prev.z, p.x, p.y, p.z);
                arcT.push((s - 1) / STEPS, t);
                arcOff.push(off, off);
            }
            prev = p.clone();
        }
    }
    const arcGeo = new THREE.BufferGeometry();
    arcGeo.setAttribute('position', new THREE.Float32BufferAttribute(arcPos, 3));
    arcGeo.setAttribute('aT', new THREE.Float32BufferAttribute(arcT, 1));
    arcGeo.setAttribute('aOff', new THREE.Float32BufferAttribute(arcOff, 1));
    const arcMat = new THREE.ShaderMaterial({
        transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
        uniforms: { uTime: { value: 0 }, base: { value: new THREE.Color(0xe0ccf8) }, head: { value: new THREE.Color(0x84c4c4) } },
        vertexShader: `
            attribute float aT; attribute float aOff; varying float vT; varying float vOff;
            void main() { vT = aT; vOff = aOff; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
        fragmentShader: `
            uniform float uTime; uniform vec3 base, head; varying float vT; varying float vOff;
            void main() {
                float h = fract(uTime * 0.22 + vOff) * 1.4 - 0.2;
                float pulse = smoothstep(0.16, 0.0, abs(vT - h));
                gl_FragColor = vec4(mix(base, head, pulse), 0.16 + pulse * 0.8);
                #include <colorspace_fragment>
            }`
    });
    const arcs = new THREE.LineSegments(arcGeo, arcMat);
    arcs.renderOrder = 3;
    globe.add(arcs);

    /* ── city nodes: one Points draw, pulse per node in the shader ── */
    const nodeGeo = new THREE.BufferGeometry().setFromPoints(cityPos);
    nodeGeo.setAttribute('aPhase', new THREE.Float32BufferAttribute(cities.map(() => Math.random() * 6.283), 1));
    const nodeMat = new THREE.ShaderMaterial({
        transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
        uniforms: { uTime: { value: 0 }, uScale: { value: 1 }, color: { value: new THREE.Color(0x84c4c4) } },
        vertexShader: `
            attribute float aPhase; uniform float uTime, uScale; varying float vP;
            void main() {
                vec4 mv = modelViewMatrix * vec4(position, 1.0);
                vP = 0.7 + 0.3 * sin(uTime * 2.2 + aPhase);
                gl_PointSize = uScale * (14.0 + 10.0 * vP) * (6.0 / -mv.z);
                gl_Position = projectionMatrix * mv;
            }`,
        fragmentShader: `
            uniform vec3 color; varying float vP;
            void main() {
                float d = length(gl_PointCoord - 0.5);
                float core = smoothstep(0.16, 0.04, d);
                float a = core + smoothstep(0.5, 0.0, d) * 0.6 * vP;
                if (a < 0.01) discard;
                gl_FragColor = vec4(mix(color, vec3(1.0), core * 0.75), a);
                #include <colorspace_fragment>
            }`
    });
    const nodes = new THREE.Points(nodeGeo, nodeMat);
    nodes.renderOrder = 4;
    globe.add(nodes);

    /* ── HTML labels, moved by transform only ── */
    const frag = document.createDocumentFragment();
    const labels = cities.map(c => {
        const el = document.createElement('div');
        el.className = 'globe-city-label';
        el.textContent = c.name;
        el.style.opacity = '0';
        frag.appendChild(el);
        return el;
    });
    container.appendChild(frag);

    let W = 1, H = 1;
    function resize() {
        W = container.clientWidth || window.innerWidth;
        H = container.clientHeight || window.innerHeight;
        renderer.setSize(W, H, false);
        camera.aspect = W / H;
        /* pull back on a portrait phone so the globe is not cropped */
        camera.position.z = Math.max(6, 4.6 / camera.aspect);
        camera.updateProjectionMatrix();
        nodeMat.uniforms.uScale.value = renderer.getPixelRatio() * H / 900;
    }
    resize();
    new ResizeObserver(resize).observe(container);

    const world = new THREE.Vector3(), normal = new THREE.Vector3(), toCam = new THREE.Vector3();
    function updateLabels() {
        for (let i = 0; i < cities.length; i++) {
            world.copy(cityPos[i]).applyMatrix4(globe.matrixWorld);
            normal.copy(world).normalize();
            toCam.copy(camera.position).sub(world).normalize();
            const facing = normal.dot(toCam);
            const el = labels[i];
            if (facing < 0.12) {
                if (el.style.opacity !== '0') el.style.opacity = '0';
                continue;
            }
            world.project(camera);
            const x = (world.x * 0.5 + 0.5) * W;
            const y = (-world.y * 0.5 + 0.5) * H - 16;
            el.style.opacity = Math.min(1, (facing - 0.12) * 4).toFixed(2);
            el.style.transform = `translate3d(${x.toFixed(1)}px, ${y.toFixed(1)}px, 0) translateX(-50%)`;
        }
    }

    /* pointer parallax: a few degrees of lean toward the cursor */
    let px = 0, py = 0;
    window.addEventListener('pointermove', (e) => {
        px = e.clientX / window.innerWidth - 0.5;
        py = e.clientY / window.innerHeight - 0.5;
    }, { passive: true });

    /* grid flicker, time based so it does not depend on frame rate */
    let nextGlitch = performance.now() + 3000;

    const SPIN = reduceMotion ? 0.025 : 0.108; // rad/s, the old 0.0018 per frame at 60fps
    const clock = new THREE.Clock();
    function tick() {
        const dt = Math.min(clock.getDelta(), 0.1);
        const t = clock.elapsedTime;
        globe.rotation.y += SPIN * dt;
        const ease = Math.min(1, dt * 3);
        tilt.rotation.x += (0.28 + py * 0.18 - tilt.rotation.x) * ease;
        tilt.rotation.y += (px * 0.25 - tilt.rotation.y) * ease;
        nodeMat.uniforms.uTime.value = t;
        arcMat.uniforms.uTime.value = reduceMotion ? 0 : t;

        const now = performance.now();
        if (!reduceMotion && now > nextGlitch) {
            gridMat.color.setHex(Math.random() < 0.5 ? 0x84c4c4 : 0xe0ccf8);
            setTimeout(() => gridMat.color.setHex(GRID_COLOR), 60 + Math.random() * 110);
            nextGlitch = now + 2500 + Math.random() * 6000;
        }

        scene.updateMatrixWorld();
        updateLabels();
        renderer.render(scene, camera);
    }

    renderer.setAnimationLoop(tick);
    document.addEventListener('visibilitychange', () => {
        if (document.hidden) { renderer.setAnimationLoop(null); }
        else { clock.getDelta(); renderer.setAnimationLoop(tick); }
    });
}

try { initGlobe(); } catch (e) { container.style.display = 'none'; }
