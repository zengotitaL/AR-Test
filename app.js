import * as THREE from 'three';
import { detect, homography } from './tracker.js';

const $ = id => document.getElementById(id);
const status = $('status');
const video = $('video');
const stage = $('stage');

let stream;
let running = false;
const preview = new URLSearchParams(location.search).has('preview');

const renderer = new THREE.WebGLRenderer({
  alpha: true,
  antialias: true
});
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
stage.append(renderer.domElement);

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(50, 1, 0.001, 10);
const anchor = new THREE.Group();
const frog = new THREE.Group();

scene.add(anchor);
anchor.add(frog);
anchor.visible = false;

scene.add(new THREE.HemisphereLight(0xffffff, 0x687a63, 2.3));

const light = new THREE.DirectionalLight(0xffffff, 2.3);
light.position.set(-1, 2, 3);
scene.add(light);

const sample = document.createElement('canvas');
const ctx = sample.getContext('2d', { willReadFrequently: true });
let ready = false;

function resize(w, h) {
  const scale = Math.min(innerWidth / w, innerHeight / h);
  stage.style.width = w * scale + 'px';
  stage.style.height = h * scale + 'px';
  renderer.setSize(w, h, false);
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
}

addEventListener('resize', () => {
  resize(video.videoWidth || 640, video.videoHeight || 480);
});

function modelSize() {
  frog.scale.setScalar(Number($('size').value) / 100);
  $('cm').textContent = $('size').value + ' cm';
}

$('size').oninput = modelSize;

try {
  const [meta, buf] = await Promise.all([
    fetch('./frog.json').then(r => {
      if (!r.ok) throw Error('Missing frog.json');
      return r.json();
    }),
    fetch('./frog.bin').then(r => {
      if (!r.ok) throw Error('Missing frog.bin');
      return r.arrayBuffer();
    })
  ]);

  for (const group of meta.groups) {
    const geometry = new THREE.BufferGeometry();

    geometry.setAttribute(
      'position',
      new THREE.BufferAttribute(
        new Float32Array(buf, group.offset, group.count * 3),
        3
      )
    );

    geometry.computeVertexNormals();

    const material = new THREE.MeshStandardMaterial({
      color: group.color,
      roughness: 0.72,
      metalness: 0.05,
      side: THREE.DoubleSide
    });

    frog.add(new THREE.Mesh(geometry, material));
  }

  const box = new THREE.Box3().setFromObject(frog);
  const extent = box.getSize(new THREE.Vector3());
  const center = box.getCenter(new THREE.Vector3());
  const scale = 1 / Math.max(extent.x, extent.y);

  for (const mesh of frog.children) {
    mesh.geometry.translate(-center.x, -center.y, -box.min.z);
    mesh.geometry.scale(scale, scale, scale);
  }

  modelSize();
  ready = true;
} catch (error) {
  status.textContent =
    'Could not load the frog. Check frog.json and frog.bin. ' +
    error.message;
}

// Smooth movement between camera detections.
const targetPosition = new THREE.Vector3();
const targetRotation = new THREE.Quaternion();

let poseReady = false;
let lastSeen = 0;
let lastRender = 0;

function smoothPose(now) {
  const dt = Math.min((now - lastRender) / 1000 || 1 / 60, 0.05);
  lastRender = now;

  if (!poseReady) return;

  // Briefly hold the last pose during a missed detection.
  if (now - lastSeen > 180) {
    anchor.visible = false;
    poseReady = false;
    return;
  }

  anchor.position.lerp(
    targetPosition,
    1 - Math.exp(-dt / 0.16)
  );

  anchor.quaternion.slerp(
    targetRotation,
    1 - Math.exp(-dt / 0.24)
  );

  anchor.visible = true;
}

function applyPose(corners, w, h) {
  const H = homography(corners);
  if (!H) return;

  const focal =
    h / (2 * Math.tan(THREE.MathUtils.degToRad(camera.fov) / 2));

  const inverseCamera = (x, y, z) =>
    new THREE.Vector3(
      (x - w * 0.5 * z) / focal,
      (y - h * 0.5 * z) / focal,
      z
    );

  const a = inverseCamera(H[0], H[3], H[6]);
  const b = inverseCamera(H[1], H[4], H[7]);

  const translation = inverseCamera(
    H[2] + 0.5 * H[0] + 0.5 * H[1],
    H[5] + 0.5 * H[3] + 0.5 * H[4],
    1 + 0.5 * H[6] + 0.5 * H[7]
  );

  // Printed black square is 10 cm wide.
  const scale = 0.1 / ((a.length() + b.length()) * 0.5);
  translation.multiplyScalar(scale);

  a.normalize();
  b.addScaledVector(a, -a.dot(b)).normalize();

  const c = new THREE.Vector3().crossVectors(a, b);
  const convert = vector =>
    vector.set(vector.x, -vector.y, -vector.z);

  convert(a);
  convert(b).negate();
  convert(c).negate();
  convert(translation);

  const matrix = new THREE.Matrix4().makeBasis(a, b, c);

  targetPosition.copy(translation);
  targetRotation.setFromRotationMatrix(matrix);

  if (!poseReady) {
    anchor.position.copy(targetPosition);
    anchor.quaternion.copy(targetRotation);
    poseReady = true;
  }

  lastSeen = performance.now();
  anchor.visible = true;
}

let lastDetection = 0;

function frame(now) {
  if (!running) return;
  requestAnimationFrame(frame);

  if (preview) {
    anchor.rotation.y = now * 0.0002;
    renderer.render(scene, camera);
    return;
  }

  smoothPose(now);
  renderer.render(scene, camera);

  if (now - lastDetection < 70 || video.readyState < 2) return;
  lastDetection = now;

  try {
    const w = sample.width;
    const h = sample.height;

    ctx.drawImage(video, 0, 0, w, h);

    const pixels = ctx.getImageData(0, 0, w, h).data;
    const gray = new Uint8Array(w * h);

    for (let i = 0; i < gray.length; i++) {
      gray[i] = (
        pixels[4 * i] * 77 +
        pixels[4 * i + 1] * 150 +
        pixels[4 * i + 2] * 29
      ) >> 8;
    }

    const tag = detect(gray, w, h);

    if (tag) {
      applyPose(tag.corners, w, h);
      status.textContent = 'Frog found! Move slowly around the tag.';
    } else {
      status.textContent =
        'Point at AprilTag 0. Keep its white margin visible.';
    }
  } catch (error) {
    running = false;
    anchor.visible = false;
    status.textContent = 'Tracking stopped: ' + error.message;
    stream?.getTracks().forEach(track => track.stop());
    $('start').style.display = 'inline-block';
    $('start').disabled = false;
  }
}

$('start').onclick = async () => {
  if (!ready) {
    status.textContent =
      'Wait for the frog to finish loading, then try again.';
    return;
  }

  $('start').disabled = true;

  try {
    if (!navigator.mediaDevices?.getUserMedia) {
      throw Error('Open the HTTPS GitHub Pages link in Safari.');
    }

    stream = await navigator.mediaDevices.getUserMedia({
      audio: false,
      video: {
        facingMode: { ideal: 'environment' },
        width: { ideal: 1280 },
        height: { ideal: 720 }
      }
    });

    video.srcObject = stream;
    await video.play();

    await new Promise(resolve => {
      if (video.videoWidth) resolve();
      else video.onloadedmetadata = resolve;
    });

    sample.width = 640;
    sample.height = Math.round(
      640 * video.videoHeight / video.videoWidth
    );

    resize(640, sample.height);

    $('start').style.display = 'none';
    $('controls').style.display = 'block';

    poseReady = false;
    running = true;
    requestAnimationFrame(frame);
  } catch (error) {
    stream?.getTracks().forEach(track => track.stop());
    status.textContent =
      'Camera could not start. Allow camera access in Safari. ' +
      error.message;
    $('start').disabled = false;
  }
};

if (preview && ready) {
  resize(640, 480);
  camera.position.set(0, 0.16, 0.25);
  camera.lookAt(0, 0, 0);
  frog.rotation.x = -Math.PI / 2;
  anchor.visible = true;
  $('start').style.display = 'none';
  $('controls').style.display = 'block';
  status.textContent =
    'Model preview. Open the main link to use the camera.';
  running = true;
  requestAnimationFrame(frame);
}

addEventListener('pagehide', () => {
  running = false;
  stream?.getTracks().forEach(track => track.stop());
});
