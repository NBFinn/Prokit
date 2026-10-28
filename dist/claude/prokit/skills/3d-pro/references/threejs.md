# Three.js (3D im Browser)

## Hochwertiges Grundgerüst
```js
import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { RoomEnvironment } from "three/addons/environments/RoomEnvironment.js";

const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));        // nie höher als 2
renderer.setSize(innerWidth, innerHeight);
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
document.body.appendChild(renderer.domElement);

const scene = new THREE.Scene();
// Realistisches Licht ohne HDR-Datei: Umgebung aus RoomEnvironment
const pmrem = new THREE.PMREMGenerator(renderer);
scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;

const camera = new THREE.PerspectiveCamera(35, innerWidth / innerHeight, 0.1, 100);
camera.position.set(3, 2, 4);
const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;

const sun = new THREE.DirectionalLight(0xffffff, 1.5);
sun.position.set(3, 5, 2);
sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048);
scene.add(sun);

new GLTFLoader().load("modell.glb", ({ scene: model }) => {
  // Modell zentrieren und auf Einheitsgröße bringen
  const box = new THREE.Box3().setFromObject(model);
  const size = box.getSize(new THREE.Vector3()).length();
  model.position.sub(box.getCenter(new THREE.Vector3()));
  model.scale.setScalar(2 / size);
  model.traverse((o) => { if (o.isMesh) { o.castShadow = o.receiveShadow = true; } });
  scene.add(model);
});

addEventListener("resize", () => {
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
});
renderer.setAnimationLoop(() => { controls.update(); renderer.render(scene, camera); });
```
Ohne Bundler per Import-Map:
```html
<script type="importmap">{ "imports": {
  "three": "https://cdn.jsdelivr.net/npm/three@0.170.0/build/three.module.js",
  "three/addons/": "https://cdn.jsdelivr.net/npm/three@0.170.0/examples/jsm/" } }</script>
```

## Qualität
- **Materialien:** `MeshStandardMaterial`/`MeshPhysicalMaterial` mit `roughness` 0,3–0,7. Metall: `metalness 1` + Umgebung, sonst wirkt es schwarz.
- **Licht:** Umgebung (PMREM) + 1 Richtungslicht für Schatten. Mehr Lichter sind selten nötig.
- **Boden:** `ShadowMaterial({ opacity: 0.15 })` auf einer Ebene, damit das Objekt nicht schwebt.
- **Kamera:** Brennweite 30–40° FOV wirkt hochwertiger als 75°.

## Performance
- Modelle als **GLB mit Draco/Meshopt** komprimieren (`gltf-transform optimize in.glb out.glb`).
- Geometrien und Materialien wiederverwenden. Viele gleiche Objekte über `InstancedMesh`.
- Nicht mehr benötigte Objekte freigeben: `geometry.dispose()`, `material.dispose()`, `texture.dispose()`.
- Pixelratio maximal 2, Schatten-Map nicht größer als nötig.
- Bei React: `@react-three/fiber` + `@react-three/drei` (`<Environment>`, `<ContactShadows>`, `<useGLTF>`).

## Prüfen
Seite mit Playwright öffnen und einen Screenshot machen, dann ansehen. WebGL braucht im Headless-Modus ggf. `--use-gl=swiftshader` bzw. `--enable-unsafe-swiftshader`.
