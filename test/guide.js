import * as THREE from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';

export async function createGuide(container) {
  const renderer = new THREE.WebGLRenderer({alpha: true, antialias: true});
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.domElement.setAttribute('aria-hidden', 'true');
  container.append(renderer.domElement);

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(35, 1, .01, 1000);
  scene.add(new THREE.HemisphereLight(0xffffff, 0x756c48, 2.5));
  const light = new THREE.DirectionalLight(0xffffff, 3);
  light.position.set(3, 5, 6);
  scene.add(light);

  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  const clock = new THREE.Clock(false);
  let model = null, mixer = null, resizeObserver = null;
  let center = null, size = null, disposed = false, wanted = false, running = false;

  function render() {
    if (disposed || !model) return;
    if (running) mixer.update(Math.min(clock.getDelta(), .05));
    renderer.render(scene, camera);
  }

  function syncPlayback() {
    if (disposed) return;
    const shouldRun = wanted && !document.hidden && !reducedMotion.matches && !!model;
    if (shouldRun !== running) {
      running = shouldRun;
      if (running) clock.start(); else clock.stop();
      renderer.setAnimationLoop(running ? render : null);
    }
    if (!document.hidden) render();
  }

  function resize() {
    if (disposed || !center) return;
    const width = container.clientWidth, height = container.clientHeight;
    // A hidden view has no meaningful aspect ratio; retain the last framing.
    if (!width || !height) return;
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
    renderer.setSize(width, height, false);
    camera.aspect = width / height;
    const extent = Math.max(size.y, size.x / camera.aspect, .0001);
    const distance = extent / (2 * Math.tan(THREE.MathUtils.degToRad(camera.fov / 2))) * 1.38;
    camera.position.set(center.x, center.y, center.z + distance + size.z / 2);
    camera.lookAt(center);
    camera.near = Math.max(distance / 100, .00001);
    camera.far = Math.max(distance * 20, camera.near + size.z * 2 + 1);
    camera.updateProjectionMatrix();
    render();
  }

  function releaseModel(root) {
    if (!root) return;
    const geometries = new Set(), materials = new Set(), textures = new Set(), skeletons = new Set();
    root.traverse(object => {
      if (object.geometry) geometries.add(object.geometry);
      if (object.skeleton) skeletons.add(object.skeleton);
      for (const material of Array.isArray(object.material) ? object.material : [object.material]) {
        if (!material) continue;
        materials.add(material);
        for (const value of Object.values(material)) if (value?.isTexture) textures.add(value);
      }
    });
    for (const geometry of geometries) geometry.dispose();
    for (const material of materials) material.dispose();
    for (const texture of textures) texture.dispose();
    for (const skeleton of skeletons) skeleton.dispose();
    scene.remove(root);
  }

  function dispose() {
    if (disposed) return;
    disposed = true;
    wanted = false;
    running = false;
    renderer.setAnimationLoop(null);
    clock.stop();
    resizeObserver?.disconnect();
    window.removeEventListener('resize', resize);
    window.removeEventListener('pagehide', onPageHide);
    document.removeEventListener('visibilitychange', syncPlayback);
    reducedMotion.removeEventListener('change', syncPlayback);
    if (model) {
      mixer?.stopAllAction();
      mixer?.uncacheRoot(model);
      releaseModel(model);
    }
    model = null;
    mixer = null;
    renderer.dispose();
    renderer.domElement.remove();
  }

  // Keep a paused instance for back/forward cache; release it on a full unload.
  function onPageHide(event) {
    if (!event.persisted) dispose();
    else {
      running = false;
      renderer.setAnimationLoop(null);
      clock.stop();
    }
  }

  window.addEventListener('pagehide', onPageHide);
  document.addEventListener('visibilitychange', syncPlayback);
  reducedMotion.addEventListener('change', syncPlayback);

  try {
    const gltf = await new GLTFLoader().loadAsync('./assets/guide.glb');
    if (disposed) {
      releaseModel(gltf.scene);
      throw new DOMException('The guide was closed while loading.', 'AbortError');
    }
    model = gltf.scene;
    scene.add(model);
    mixer = new THREE.AnimationMixer(model);
    if (gltf.animations.length) mixer.clipAction(gltf.animations[0]).play();

    // Include animated poses in the framing without changing the character.
    const box = new THREE.Box3();
    for (let frame = 0; frame < 16; frame++) {
      mixer.setTime((gltf.animations[0]?.duration || 0) * frame / 16);
      model.updateMatrixWorld(true);
      model.traverse(object => { if (object.isSkinnedMesh) object.computeBoundingBox(); });
      box.union(new THREE.Box3().setFromObject(model));
    }
    mixer.setTime(0);
    model.updateMatrixWorld(true);
    center = box.getCenter(new THREE.Vector3());
    size = box.getSize(new THREE.Vector3());
    container.querySelector('#guide-loading')?.setAttribute('hidden', '');
    resize();
    if (window.ResizeObserver) {
      resizeObserver = new ResizeObserver(resize);
      resizeObserver.observe(container);
    }
    window.addEventListener('resize', resize);
    return {
      play() { if (!disposed) { wanted = true; resize(); syncPlayback(); } },
      pause() { wanted = false; syncPlayback(); },
      dispose
    };
  } catch (error) {
    dispose();
    throw error;
  }
}
