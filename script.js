// script.js — para el globo 3D con three.js (usa el THREE global cargado desde index.html)

const dataMuseos = [
  {
    pais: "Bélgica",
    museo: "Museo Real de África Central (Tervuren)",
    descripcion: "Reabierto en 2018 para ofrecer una mirada crítica a su pasado colonial, contrastando la propaganda original con obras de artistas congoleños contemporáneos.",
    lat: 50.84,
    lng: 4.47
  },
  {
    pais: "Nueva Zelanda",
    museo: "Te Papa Tongarewa",
    descripcion: "Fundado en un principio bicultural (Maorí y Pākehā). La curaduría y repatriación de tesoros (taonga) se gestiona en asociación con las tribus (iwi) Maorí.",
    lat: -41.29,
    lng: 174.78
  },
  {
    pais: "Alemania / Nigeria",
    museo: "Foro Humboldt (Berlín) y otros",
    descripcion: "Líder en la restitución física de los 'Bronces de Benín' a Nigeria, artefactos saqueados en 1897, reconociendo el robo colonial.",
    lat: 6.33,
    lng: 5.62
  },
  {
    pais: "México",
    museo: "Red de Museos Comunitarios de Oaxaca",
    descripcion: "Un modelo de descolonización 'desde abajo', donde las propias comunidades indígenas gestionan sus museos y controlan su propia narrativa histórica.",
    lat: 17.07,
    lng: -96.72
  },
  {
    pais: "EE.UU. / Perú",
    museo: "Museo Nacional del Indígena Americano",
    descripcion: "Ejemplo de repatriación activa, incluyendo la devolución a Perú de objetos simbólicos como el 'Sol de Echenique' y miles de otros artefactos.",
    lat: -12.04,
    lng: -77.04
  }
];

// Scene, camera, renderer
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 1000);
camera.position.set(0, 0, 12);

const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
document.body.appendChild(renderer.domElement);

// Controles simples: arrastrar para rotar el globo, rueda para hacer zoom
let isPointerDown = false;
let pointerMoved = false;
let lastPointer = { x: 0, y: 0 };
let earthMesh = null; // referencia a la malla del globo (se asigna al crear la esfera)
let isFocusAnimating = false;

function onPointerMoveRotate(event) {
  if (isFocusAnimating) return;
  if (!isPointerDown || !earthMesh) return;
  pointerMoved = true;
  // debug: uncomment to inspect pointer move events
  // console.log('[pointer] move', event.clientX, event.clientY);
  const rect = renderer.domElement.getBoundingClientRect();
  const x = event.clientX - rect.left;
  const y = event.clientY - rect.top;
  const dx = x - lastPointer.x;
  const dy = y - lastPointer.y;
  earthMesh.rotation.y += dx * 0.005;
  earthMesh.rotation.x += dy * 0.005;
  earthMesh.rotation.x = Math.max(Math.min(earthMesh.rotation.x, Math.PI / 2), -Math.PI / 2);
  lastPointer.x = x;
  lastPointer.y = y;
}

function onWheel(event) {
  event.preventDefault();
  const delta = Math.sign(event.deltaY);
  camera.position.z += delta * 0.6;
  camera.position.z = Math.max(6, Math.min(30, camera.position.z));
}

// Lights
const ambient = new THREE.AmbientLight(0xffffff, 0.6);
scene.add(ambient);
const dir = new THREE.DirectionalLight(0xffffff, 0.8);
dir.position.set(5, 3, 5);
scene.add(dir);

const RADIUS = 5;
// (quick access removed) no se guardan grupos separados para la UI

// Starfield (subtle points for depth)
{
  const starsGeo = new THREE.BufferGeometry();
  const count = 800;
  const positions = new Float32Array(count * 3);
  for (let i = 0; i < count; i++) {
    const r = 60 + Math.random() * 120;
    const theta = Math.random() * Math.PI * 2;
    const phi = Math.acos(2 * Math.random() - 1);
    positions[i * 3] = r * Math.sin(phi) * Math.cos(theta);
    positions[i * 3 + 1] = r * Math.sin(phi) * Math.sin(theta);
    positions[i * 3 + 2] = r * Math.cos(phi);
  }
  starsGeo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  const starsMat = new THREE.PointsMaterial({ color: 0xffffff, size: 0.8, transparent: true, opacity: 0.6 });
  const stars = new THREE.Points(starsGeo, starsMat);
  scene.add(stars);
}

// Load earth texture
const loader = new THREE.TextureLoader();
const earthTextureUrl = 'https://threejs.org/examples/textures/land_ocean_ice_cloud_2048.jpg';
loader.load(
  earthTextureUrl,
  (texture) => {
    const geometry = new THREE.SphereGeometry(RADIUS, 64, 64);
    // dark/minimal earth material
    const material = new THREE.MeshStandardMaterial({
      map: texture,
      roughness: 0.95,
      metalness: 0.05,
      color: 0xeeeeff,
    });
    const earth = new THREE.Mesh(geometry, material);
    earth.name = 'earth';
    earthMesh = earth;
    scene.add(earth);

    // atmosphere glow (subtle)
    const atmMat = new THREE.MeshBasicMaterial({ color: 0x66aaff, side: THREE.BackSide, transparent: true, opacity: 0.06, blending: THREE.AdditiveBlending });
    const atm = new THREE.Mesh(new THREE.SphereGeometry(RADIUS * 1.03, 64, 64), atmMat);
    scene.add(atm);

    // Add markers as children of the earth so they 'rotan' con él
    const markersGroup = new THREE.Group();
    markersGroup.name = 'markersGroup';
    earth.add(markersGroup);

    // Minimalista: marcador azul claro, más visible sobre fondo blanco
    const markerGeom = new THREE.SphereGeometry(0.10, 20, 20);
    dataMuseos.forEach((d, i) => {
      const v = latLngToVector3(d.lat, d.lng, RADIUS + 0.10);
      const mat = new THREE.MeshStandardMaterial({ color: 0x3cf6ff, transparent: true, opacity: 0.92, emissive: 0x3cf6ff, emissiveIntensity: 0.7, metalness: 0.2, roughness: 0.5 });
      const marker = new THREE.Mesh(markerGeom, mat);
      const g = new THREE.Group();
      g.position.copy(v);
      marker.position.set(0, 0, 0);
      g.add(marker);
      g.userData = { index: i, data: d, markerMesh: marker };
      markersGroup.add(g);
    });


    animate();
  },
  undefined,
  (err) => {
    console.error('Error cargando la textura de la Tierra:', err);
  }
);

function latLngToVector3(lat, lng, radius) {
  const phi = (90 - lat) * (Math.PI / 180);
  const theta = (lng + 180) * (Math.PI / 180);
  const x = -radius * Math.sin(phi) * Math.cos(theta);
  const y = radius * Math.cos(phi);
  const z = radius * Math.sin(phi) * Math.sin(theta);
  return new THREE.Vector3(x, y, z);
}

// Raycasting para clicks en marcadores (se ejecuta en pointerup si no hubo arrastre)
const raycaster = new THREE.Raycaster();
const mouse = new THREE.Vector2();

function worldToScreenPosition(pos, camera) {
  const vector = pos.clone().project(camera);
  const x = (vector.x * 0.5 + 0.5) * window.innerWidth;
  const y = (-vector.y * 0.5 + 0.5) * window.innerHeight;
  return { x, y, z: vector.z };
}

function doRaycastAndShow(clientX, clientY) {
  const rect = renderer.domElement.getBoundingClientRect();
  mouse.x = ((clientX - rect.left) / rect.width) * 2 - 1;
  mouse.y = -((clientY - rect.top) / rect.height) * 2 + 1;
  raycaster.setFromCamera(mouse, camera);
  const intersects = raycaster.intersectObjects(scene.children, true);
  if (intersects.length > 0) {
    const hit = intersects.find(i => i.object && i.object.parent && i.object.parent.userData && i.object.parent.userData.data) ||
                intersects.find(i => i.object && i.object.userData && i.object.userData.data);
    if (hit) {
      // prefer group's userData (we attached data to group)
      const target = hit.object.parent && hit.object.parent.userData && hit.object.parent.userData.data ? hit.object.parent : hit.object;
      showPopup(target);
      return;
    }
  }
  hidePopup();
}

// --- Sidebar / UI: populate places list and focus logic ---
// quick access / focus-on-marker removed — interaction via clicks on markers (raycast) remains

// Sidebar tab logic: simple tab switching for Autor / Conclusión / Referencias
function setupSidebarTabs() {
  const tabButtons = document.querySelectorAll('.tab-btn');
  if (!tabButtons || tabButtons.length === 0) return;
  const panels = document.querySelectorAll('.tab-panel');
  tabButtons.forEach((btn) => {
    btn.addEventListener('click', (ev) => {
      ev.preventDefault();
      // deactivate all
      tabButtons.forEach(b => { b.classList.remove('active'); b.setAttribute('aria-selected', 'false'); });
      panels.forEach(p => p.style.display = 'none');
      // activate target
      btn.classList.add('active');
      btn.setAttribute('aria-selected', 'true');
      const target = document.getElementById(btn.dataset.target);
      if (target) target.style.display = 'block';
    });
  });
}

// Initialize tabs after DOM is ready (script is loaded at end of body so DOM exists)
try { setupSidebarTabs(); } catch (e) { /* ignore if sidebar absent */ }

// Pointer handlers: down -> start drag; move -> rotate; up -> if no move => click
renderer.domElement.addEventListener('pointerdown', (e) => {
  if (isFocusAnimating) return;
  isPointerDown = true;
  pointerMoved = false;
  // debug pointer down
  // console.log('[pointer] down', { x: e.clientX, y: e.clientY });
  const rect = renderer.domElement.getBoundingClientRect();
  lastPointer.x = e.clientX - rect.left;
  lastPointer.y = e.clientY - rect.top;
  renderer.domElement.setPointerCapture?.(e.pointerId);
});

window.addEventListener('pointermove', onPointerMoveRotate);
window.addEventListener('pointerup', (e) => {
  if (!isPointerDown) return;
  isPointerDown = false;
  renderer.domElement.releasePointerCapture?.(e.pointerId);
  if (!pointerMoved) {
    // click
    doRaycastAndShow(e.clientX, e.clientY);
  }
});

renderer.domElement.addEventListener('wheel', onWheel, { passive: false });

let activePopupTarget = null;

function showPopup(target) {
  // target: either object with userData.data or group with userData.data
  const data = target.userData && target.userData.data ? target.userData.data : (target.userData || {}).data;
  if (!data) return;
  activePopupTarget = target;
  const popup = document.getElementById('infoPopup');
  popup.innerHTML = '';
  const closeBtn = document.createElement('button');
  closeBtn.id = 'closePopup';
  closeBtn.textContent = '×';
  closeBtn.addEventListener('click', () => (popup.style.display = 'none'));
  const title = document.createElement('h3');
  title.textContent = data.museo;
  const pPais = document.createElement('p');
  pPais.className = 'pais';
  pPais.innerHTML = `${escapeHtml(data.pais)}`;
  const pDesc = document.createElement('p');
  pDesc.textContent = data.descripcion;
  popup.appendChild(closeBtn);
  popup.appendChild(title);
  popup.appendChild(pPais);
  popup.appendChild(pDesc);
  popup.style.display = 'block';
  // evitar que clicks dentro del popup se propaguen y asegurar que el cierre limpie el estado
  popup.addEventListener('pointerdown', (ev) => ev.stopPropagation());
  closeBtn.addEventListener('click', hidePopup);
  // position next to marker
  updatePopupPosition();
}

function hidePopup() {
  const popup = document.getElementById('infoPopup');
  if (popup) popup.style.display = 'none';
  activePopupTarget = null;
}

function escapeHtml(str) {
  return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

// Resize
window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

// Animación
function animate() {
  requestAnimationFrame(animate);
  // update popup position to follow marker
  if (activePopupTarget) updatePopupPosition();
  renderer.render(scene, camera);
}

function updatePopupPosition() {
  if (!activePopupTarget) return;
  const popup = document.getElementById('infoPopup');
  const worldPos = new THREE.Vector3();
  activePopupTarget.getWorldPosition(worldPos);
  const screen = worldToScreenPosition(worldPos, camera);
  // clamp to viewport with margins
  const margin = 16;
  let x = Math.max(margin, Math.min(window.innerWidth - margin, screen.x));
  let y = Math.max(margin, Math.min(window.innerHeight - margin, screen.y));
  popup.style.left = x + 'px';
  popup.style.top = y + 'px';
}
