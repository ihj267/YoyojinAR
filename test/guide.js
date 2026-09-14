import * as THREE from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
export async function createGuide(container){
  const renderer=new THREE.WebGLRenderer({alpha:true,antialias:true});renderer.setPixelRatio(Math.min(devicePixelRatio,1.5));renderer.setSize(container.clientWidth,container.clientHeight);renderer.outputColorSpace=THREE.SRGBColorSpace;container.append(renderer.domElement);
  const scene=new THREE.Scene(),camera=new THREE.PerspectiveCamera(35,container.clientWidth/container.clientHeight,.01,1000);
  scene.add(new THREE.HemisphereLight(0xffffff,0x756c48,2.5));const light=new THREE.DirectionalLight(0xffffff,3);light.position.set(3,5,6);scene.add(light);
  const loader=new GLTFLoader();let gltf;
  try{gltf=await loader.loadAsync('./assets/guide.glb');}catch(e){renderer.dispose();renderer.domElement.remove();throw e;}
  const model=gltf.scene;scene.add(model);
  const mixer=new THREE.AnimationMixer(model);if(gltf.animations.length)mixer.clipAction(gltf.animations[0]).play();
  // Fit the animated poses as well as the rest pose: skin animation can move
  // independently of the scene root and otherwise fill the view with one part.
  const box=new THREE.Box3();
  for(let frame=0;frame<16;frame++){
    mixer.setTime((gltf.animations[0]?.duration||0)*frame/16);model.updateMatrixWorld(true);
    model.traverse(o=>{if(o.isSkinnedMesh)o.computeBoundingBox();});
    box.union(new THREE.Box3().setFromObject(model));
  }
  mixer.setTime(0);model.updateMatrixWorld(true);
  const center=box.getCenter(new THREE.Vector3()),size=box.getSize(new THREE.Vector3());
  const max=Math.max(size.y,size.x/camera.aspect),distance=max/(2*Math.tan(THREE.MathUtils.degToRad(camera.fov/2)))*1.38;
  camera.position.set(center.x,center.y,center.z+distance+size.z/2);camera.lookAt(center);camera.near=distance/100;camera.far=distance*20;camera.updateProjectionMatrix();
  container.querySelector('#guide-loading').hidden=true;const clock=new THREE.Clock();let active=false;
  const reduced=matchMedia('(prefers-reduced-motion: reduce)').matches;
  const render=()=>{mixer.update(Math.min(clock.getDelta(),.05));renderer.render(scene,camera);};
  renderer.render(scene,camera);
  return{play(){if(active)return;active=true;clock.start();if(!reduced)renderer.setAnimationLoop(render);},pause(){active=false;renderer.setAnimationLoop(null);clock.stop();}};
}
