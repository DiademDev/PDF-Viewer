import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import * as pdfjsLib from 'pdfjs-dist';
import pdfWorker from 'pdfjs-dist/build/pdf.worker.min.mjs?url';

// --- PDF.js worker ---
pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorker;

// ----- Constants -----
const PDF_START_SCALE = 0.9;
const RATIO = 4 / 2.8;
const FADE_SPEED = 0.1;
const PDF_FILE = './pdfs/TGHO2436-CD.pdf';
const HDRI_PATH = './hdri/HDRI_Lighting.hdr';
const HDRI_INTENSITY = 200.0;
const DRAG_SPEED = 0.005;
const DAMP = 0.93;
const frustumSize = 10; // orthographic size

const MODEL_1 = './models/ID1f-CDB.glb';
const MODEL_2 = './models/ID1f-CD.glb';

// ----- PDF Setup -----
let pdfDoc = null;
let pageNum = 1;
let scale = PDF_START_SCALE;

const pdfCanvas = document.getElementById("pdfCanvas");
const pdfCtx = pdfCanvas.getContext("2d");
const overlay2D = document.getElementById("overlay2D");
const ctx2D = overlay2D.getContext("2d");

pdfjsLib.getDocument(PDF_FILE).promise.then(pdf => {
  pdfDoc = pdf;
  renderPage(pageNum);
});

// ----- Three.js Setup -----
const threeDiv = document.getElementById("overlay3D");
threeDiv.style.display = "none"; // 3D layer OFF
const scene = new THREE.Scene();

// Orthographic Camera
let aspect = window.innerWidth / window.innerHeight;
const camera = new THREE.OrthographicCamera(
  -frustumSize * aspect / 2,
   frustumSize * aspect / 2,
   frustumSize / 2,
  -frustumSize / 2,
   0.1,
   1000
);
camera.position.set(0, 0, 10);
camera.lookAt(0, 0, 0);

const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true });
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
threeDiv.appendChild(renderer.domElement);

// ----- Lights -----
const point = new THREE.PointLight(0xffffff, 400, 100);
point.castShadow = true;
point.shadow.mapSize.width = 2048;
point.shadow.mapSize.height = 2048;
point.position.set(-10, 5, 3);

// --- Fill light
const fillLight = new THREE.DirectionalLight(0xffffff, 0.3);
fillLight.position.set(5, 2, -3);
scene.add(fillLight);

scene.add(point);
scene.add(new THREE.AmbientLight(0xffffff, 0.5));


// Shadow Catcher
const shadowPlaneGeo = new THREE.PlaneGeometry(200, 200);
const shadowPlaneMat = new THREE.ShadowMaterial({ opacity: 0.15 });
const shadowPlane = new THREE.Mesh(shadowPlaneGeo, shadowPlaneMat);
shadowPlane.rotation.x = -Math.PI / 2;
shadowPlane.position.set(0, -4, 0);
shadowPlane.receiveShadow = true;
scene.add(shadowPlane);

renderer.shadowMap.enabled = false;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;

// ----- Models -----
const animObjects = [];
const loader = new GLTFLoader();
let gltfModel1 = null, gltfModel2 = null;

loader.load(MODEL_1, gltf => {
  gltfModel1 = gltf.scene;
  gltfModel1.traverse(obj => {
    if (obj.isMesh) { obj.castShadow = true; obj.receiveShadow = true; }
  });
    gltfModel1.position.set(-5, 0, 0);
    gltfModel1.scale.set(1.5, 1.5, 1.5);
    gltfModel1.visible = false;
    scene.add(gltfModel1);
    animObjects.push({ mesh: gltfModel1, fadeTarget: 0, rotate: false, rotateSpeed: 0.001 });
  },  
  xhr => console.log(`Loaded ${(xhr.loaded / xhr.total) * 100}%`),
  err => console.error('GLTF load error:', err)  // must be a function
);

loader.load(MODEL_2, gltf => {
  gltfModel2 = gltf.scene;
  gltfModel2.traverse(obj => {
    if (obj.isMesh) { obj.castShadow = true; obj.receiveShadow = true; }
  });
    gltfModel2.position.set(-5, 0, 0);
    gltfModel2.scale.set(1.5, 1.5, 1.5);
    gltfModel2.visible = false;
    scene.add(gltfModel2);
    animObjects.push({ mesh: gltfModel2, fadeTarget: 0, rotate: false, rotateSpeed: 0.001 });
  },  
  xhr => console.log(`Loaded ${(xhr.loaded / xhr.total) * 100}%`),
  err => console.error('GLTF load error:', err)  // must be a function
);

// ----- Animation -----
let isDragging = false, prevMouseX = 0, prevMouseY = 0, velocityX = 0, velocityY = 0;
const dragSpeed = DRAG_SPEED, damping = DAMP;
let autoRotateEnabled = true;

threeDiv.addEventListener('mousedown', e => { isDragging = true; [prevMouseX, prevMouseY] = [e.clientX, e.clientY]; velocityX = 0; velocityY = 0; });
threeDiv.addEventListener('mousemove', e => {
  if (!isDragging) return;
  const deltaX = e.clientX - prevMouseX;
  const deltaY = e.clientY - prevMouseY;
  const visibleObj = animObjects.find(o => o.mesh.visible);
  if (visibleObj) { visibleObj.mesh.rotation.y += deltaX * dragSpeed; visibleObj.mesh.rotation.x += deltaY * dragSpeed; }
  velocityX = deltaX * dragSpeed; velocityY = deltaY * dragSpeed;
  [prevMouseX, prevMouseY] = [e.clientX, e.clientY];
});
threeDiv.addEventListener('mouseup', () => { isDragging = false; });
threeDiv.addEventListener('mouseleave', () => { isDragging = false; });

// Mouse wheel zoom for Orthographic
let targetZoom = scale;
threeDiv.addEventListener('wheel', e => {
  e.preventDefault();
  targetZoom *= e.deltaY < 0 ? 1.1 : 0.9;
}, { passive: false });

function updateCameraZoom() {
  camera.zoom += (targetZoom - camera.zoom) * 0.1;
  camera.updateProjectionMatrix();
}

// Animate loop
function animate() {
  requestAnimationFrame(animate);
  
  // Drag momentum
  const visibleObj = animObjects.find(o => o.mesh.visible);
  if (visibleObj && !isDragging) {
    visibleObj.mesh.rotation.y += velocityX;
    visibleObj.mesh.rotation.x += velocityY;
    velocityX *= damping; velocityY *= damping;
  }

  // Fade / rotate
  animObjects.forEach(o => {
    if (!o.mesh) return;
    o.mesh.traverse(child => {
      if (!child.isMesh || !child.material) return;
      child.material.opacity += (o.fadeTarget - (child.material.opacity || 0)) * FADE_SPEED;
      if (child.material.opacity < 0.01 && o.fadeTarget === 0) o.mesh.visible = false;
      if (o.rotate && o.mesh.visible && autoRotateEnabled) o.mesh.rotation.y += o.rotateSpeed;
    });
  });

  updateCameraZoom();
  renderer.render(scene, camera);
}
animate();

// ----- 2D Drawing -----
let drawing = false, drawMode = false, lastX = 0, lastY = 0;
document.getElementById("drawToggle").onclick = () => {
  drawMode = !drawMode;
  overlay2D.style.pointerEvents = drawMode ? "auto" : "none";
  document.getElementById("drawToggle").textContent = drawMode ? "🖐 Stop" : "✏️ Draw";
};
overlay2D.addEventListener("mousedown", e => { if(drawMode){drawing=true;[lastX,lastY]=[e.offsetX,e.offsetY];} });
overlay2D.addEventListener("mousemove", e => {
  if(!drawing) return;
  ctx2D.strokeStyle = "rgba(0,191,255,1)"; ctx2D.lineWidth = 5;
  ctx2D.beginPath(); ctx2D.moveTo(lastX,lastY); ctx2D.lineTo(e.offsetX,e.offsetY); ctx2D.stroke();
  [lastX,lastY]=[e.offsetX,e.offsetY];
});
overlay2D.addEventListener("mouseup", () => drawing=false);
overlay2D.addEventListener("mouseout", () => drawing=false);

// ----- PDF Helpers -----
function getCanvasSize4by3(winW, winH, scaleFactor) {
  const h = winH * scaleFactor;
  const w = h * RATIO;
  return { width: w, height: h };
}

function updateCanvasPositions() {
  const { width, height } = getCanvasSize4by3(window.innerWidth, window.innerHeight, scale);
  pdfCanvas.width = width; overlay2D.width = width;
  pdfCanvas.height = height; overlay2D.height = height;
  renderer.setSize(width, height);

  aspect = width / height;
  camera.left = -frustumSize * aspect / 2;
  camera.right = frustumSize * aspect / 2;
  camera.top = frustumSize / 2;
  camera.bottom = -frustumSize / 2;
  camera.zoom = scale;
  camera.updateProjectionMatrix();

  const offsetX = (window.innerWidth - width)/2;
  const offsetY = (window.innerHeight - height)/2;
  [pdfCanvas, overlay2D, threeDiv].forEach(el => { el.style.left = offsetX+'px'; el.style.top = offsetY+'px'; });
}

// ----- Page Control -----
function handlePageChange(num) {
  animObjects.forEach(o => { o.fadeTarget=0; o.rotate=false; o.mesh.visible=false; });
  switch(num){
    case 8: if(gltfModel2) { gltfModel2.visible=true; animObjects[1].fadeTarget=1; animObjects[1].rotate=true; } break;
    case 10: if(gltfModel1) { gltfModel1.visible=true; animObjects[0].fadeTarget=1; animObjects[0].rotate=true; } break;
  }
}

// ----- PDF Rendering -----
function renderPage(num){
  pdfDoc.getPage(num).then(page=>{
    updateCanvasPositions();
    const viewport = page.getViewport({ scale: 1 });
    const pdfScale = pdfCanvas.width / viewport.width;
    const scaledViewport = page.getViewport({ scale: pdfScale });
    page.render({ canvasContext: pdfCtx, viewport: scaledViewport });
    handlePageChange(num);
  });
}

// ----- Controls -----
document.getElementById("prev").onclick = ()=>{ if(pageNum>1) renderPage(--pageNum); };
document.getElementById("next").onclick = ()=>{ if(pageNum<pdfDoc.numPages) renderPage(++pageNum); };
document.getElementById("zoomIn").onclick = ()=>{ scale*=1.1; renderPage(pageNum); };
document.getElementById("zoomOut").onclick = ()=>{ scale/=1.1; renderPage(pageNum); };

// ----- Layer Toggles -----
document.getElementById("togglePDF").onchange = e => pdfCanvas.style.display = e.target.checked ? "block":"none";
document.getElementById("toggle2D").onchange = e => overlay2D.style.display = e.target.checked ? "block":"none";

// ===== 3D Layer Toggle =====
const threeToggle = document.getElementById("toggle3D");
threeToggle.checked = false; // ensure unchecked on load
threeToggle.onchange = e => {
    const isOn = e.target.checked;
    threeDiv.style.display = isOn ? "block" : "none";
    animObjects.forEach(o => o.fadeTarget = isOn ? 1 : 0); 
    if (isOn && pdfDoc) handlePageChange(pageNum);
};

// ----- Shadows & Rotate -----
document.getElementById("toggleShadows").onchange = e=>{
  const enabled = e.target.checked;
  renderer.shadowMap.enabled = enabled;
  scene.traverse(obj=>{ if(obj.isMesh){ obj.castShadow=enabled; obj.receiveShadow=enabled; }});
};

document.getElementById("toggleRotate").onchange = e=>{ autoRotateEnabled=e.target.checked; };

// ----- Resize -----
window.addEventListener("resize", ()=>{ if(pdfDoc) renderPage(pageNum); });
