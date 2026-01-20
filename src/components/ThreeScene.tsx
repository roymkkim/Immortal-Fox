
import React, { useEffect, useRef, useState, useImperativeHandle, forwardRef } from 'react';
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';

interface ThreeSceneProps {
  isDarkMode: boolean;
  externalModelUrl: string;
  onMushroomCollect?: (count: number) => void;
  initialMushroomCount?: number;
}

export interface ThreeSceneHandle {
  resetGame: () => void;
}

const THEME_COLOR = 0xE2725B; // Terracotta
const NEMESIS_COLOR = 0x6a0dad; // Deep Purple
const GOLD_COLOR = 0xffd700;   // Gold
const MAX_TOTAL_MUSHROOMS = 5;

const ThreeScene = forwardRef<ThreeSceneHandle, ThreeSceneProps>(({ isDarkMode, externalModelUrl, onMushroomCollect, initialMushroomCount = 0 }, ref) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const charGroupRef = useRef<THREE.Group | null>(null);
  const mushroomsRef = useRef<THREE.Group[]>([]);
  const nemesisMushroomsRef = useRef<THREE.Group[]>([]);
  const goldMushroomRef = useRef<THREE.Group | null>(null);
  const speechBubbleRef = useRef<THREE.Group | null>(null);
  
  const keysPressed = useRef<Set<string>>(new Set());
  const [isLoading, setIsLoading] = useState(false);
  
  // IMMUNITY STATE
  const [hasImmunity, setHasImmunity] = useState(false);
  const hasEverHadImmunity = useRef(false); // The permanent lock
  const collectedCount = useRef(initialMushroomCount);

  const velocity = useRef(new THREE.Vector3());
  const mouseRotation = useRef({ yaw: 0, pitch: 0.3 });
  const targetRotation = useRef({ yaw: 0, pitch: 0.3 });
  const isDragging = useRef(false);
  const lastMousePos = useRef({ x: 0, y: 0 });
  const mixerRef = useRef<THREE.AnimationMixer | null>(null);
  const activeAction = useRef<THREE.AnimationAction | null>(null);
  
  const gltfLoader = new GLTFLoader();

  useImperativeHandle(ref, () => ({
    resetGame: () => {
      collectedCount.current = 0;
      setHasImmunity(false);
      hasEverHadImmunity.current = false;
      if (charGroupRef.current) {
        charGroupRef.current.position.set(0, 0, 0);
        const model = charGroupRef.current.children[0];
        if (model) model.scale.set(0.015, 0.015, 0.015);
        velocity.current.set(0, 0, 0);
      }
      if (sceneRef.current) {
        nemesisMushroomsRef.current.forEach(n => sceneRef.current?.remove(n));
        nemesisMushroomsRef.current = [];
        mushroomsRef.current.forEach(m => sceneRef.current?.remove(m));
        mushroomsRef.current = [];
        if (goldMushroomRef.current) {
          sceneRef.current.remove(goldMushroomRef.current);
          goldMushroomRef.current = null;
        }
        if (speechBubbleRef.current) {
          sceneRef.current.remove(speechBubbleRef.current);
          speechBubbleRef.current = null;
        }
        spawnMushrooms(sceneRef.current);
      }
      if (onMushroomCollect) onMushroomCollect(0);
    }
  }));

  const createMushroomModel = (color: number) => {
    const group = new THREE.Group();
    const stemGeo = new THREE.CylinderGeometry(0.15, 0.2, 0.6, 8);
    const stemMat = new THREE.MeshStandardMaterial({ color: 0xffffff });
    const stem = new THREE.Mesh(stemGeo, stemMat);
    stem.position.y = 0.3;
    group.add(stem);

    const capGeo = new THREE.SphereGeometry(0.6, 12, 12, 0, Math.PI * 2, 0, Math.PI / 2);
    const capMat = new THREE.MeshStandardMaterial({ color: color, flatShading: true });
    const cap = new THREE.Mesh(capGeo, capMat);
    cap.position.y = 0.5;
    cap.scale.y = 0.7;
    group.add(cap);

    for (let i = 0; i < 6; i++) {
      const dotGeo = new THREE.SphereGeometry(0.08, 6, 6);
      const dotMat = new THREE.MeshStandardMaterial({ color: 0xffffff });
      const dot = new THREE.Mesh(dotGeo, dotMat);
      const phi = Math.random() * Math.PI / 2.2;
      const theta = Math.random() * Math.PI * 2;
      dot.position.setFromSphericalCoords(0.58, phi, theta);
      dot.position.y += 0.5;
      group.add(dot);
    }
    return group;
  };

  const createSpeechBubble = () => {
    const group = new THREE.Group();
    const shape = new THREE.Shape();
    const w = 8, h = 3, r = 1; 
    shape.moveTo(-w/2 + r, -h/2);
    shape.lineTo(w/2 - r, -h/2);
    shape.quadraticCurveTo(w/2, -h/2, w/2, -h/2 + r);
    shape.lineTo(w/2, h/2 - r);
    shape.quadraticCurveTo(w/2, h/2, w/2 - r, h/2);
    shape.lineTo(-w/2 + r, h/2);
    shape.quadraticCurveTo(-w/2, h/2, -w/2, h/2 - r);
    shape.lineTo(-w/2, -h/2 + r);
    shape.quadraticCurveTo(-w/2, -h/2, -w/2 + r, -h/2);
    
    shape.moveTo(-0.6, -h/2);
    shape.lineTo(0, -h/2 - 1.2);
    shape.lineTo(0.6, -h/2);

    const geometry = new THREE.ShapeGeometry(shape);
    const material = new THREE.MeshBasicMaterial({ color: 0xffffff, side: THREE.DoubleSide });
    const bubble = new THREE.Mesh(geometry, material);
    group.add(bubble);

    const canvas = document.createElement('canvas');
    canvas.width = 512; canvas.height = 128;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.fillStyle = '#ffffff'; 
      ctx.fillRect(0, 0, 512, 128);
      ctx.font = 'bold 70px Arial, sans-serif'; 
      ctx.fillStyle = '#000000';
      ctx.textAlign = 'center'; 
      ctx.textBaseline = 'middle';
      ctx.fillText('IMMUNITY', 256, 64);
    }
    const texture = new THREE.CanvasTexture(canvas);
    const textMesh = new THREE.Mesh(
      new THREE.PlaneGeometry(7.5, 1.8), 
      new THREE.MeshBasicMaterial({ map: texture, transparent: false })
    );
    textMesh.position.z = 0.06;
    group.add(textMesh);
    return group;
  };

  const spawnMushrooms = (scene: THREE.Scene) => {
    const activeRed = mushroomsRef.current.length;
    // We only need mushrooms if we haven't hit the cap, OR we can keep them spawning for fun even if immune
    const needed = Math.max(0, (MAX_TOTAL_MUSHROOMS - collectedCount.current) - activeRed);
    // If we have immunity, just keep 3 red mushrooms on the board for "eating"
    const targetCount = hasEverHadImmunity.current ? 3 : needed;
    
    for (let k = 0; k < targetCount; k++) {
      const m = createMushroomModel(THEME_COLOR);
      const angle = Math.random() * Math.PI * 2;
      const isGiant = collectedCount.current >= 5 || hasEverHadImmunity.current;
      const dist = (isGiant ? 180 : 60) + Math.random() * 80;
      m.position.set(Math.cos(angle) * dist, 0, Math.sin(angle) * dist);
      scene.add(m);
      mushroomsRef.current.push(m);
    }
  };

  const spawnNemesis = (scene: THREE.Scene) => {
    const n = createMushroomModel(NEMESIS_COLOR);
    const isGiant = collectedCount.current >= 5 || hasEverHadImmunity.current;
    n.scale.set(isGiant ? 5 : 2, isGiant ? 5 : 2, isGiant ? 5 : 2);
    const angle = Math.random() * Math.PI * 2;
    const dist = isGiant ? 350 : 150;
    n.position.set(Math.cos(angle) * dist, 0, Math.sin(angle) * dist);
    scene.add(n);
    nemesisMushroomsRef.current.push(n);
  };

  const createEnvironment = (scene: THREE.Scene) => {
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(5000, 5000), new THREE.MeshStandardMaterial({ color: 0x1a2a1a }));
    floor.rotation.x = -Math.PI / 2; floor.receiveShadow = true;
    scene.add(floor);

    for (let i = 0; i < 400; i++) {
      const tree = new THREE.Group();
      const trunkH = 10 + Math.random() * 10;
      const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.8, 1.2, trunkH), new THREE.MeshStandardMaterial({ color: 0x3d2b1f }));
      trunk.position.y = trunkH / 2; tree.add(trunk);
      const leaves = new THREE.Mesh(new THREE.ConeGeometry(8, trunkH * 2, 8), new THREE.MeshStandardMaterial({ color: 0x2d4c2d }));
      leaves.position.y = trunkH + (trunkH / 2); tree.add(leaves);
      const x = (Math.random() - 0.5) * 2000;
      const z = (Math.random() - 0.5) * 2000;
      if (Math.abs(x) > 50 || Math.abs(z) > 50) {
        tree.position.set(x, 0, z);
        scene.add(tree);
      }
    }
  };

  useEffect(() => {
    if (!containerRef.current) return;
    const scene = new THREE.Scene();
    sceneRef.current = scene;
    scene.background = new THREE.Color(0x88ccff);
    scene.fog = new THREE.FogExp2(0x88ccff, 0.0012);
    
    const camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 4000);
    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.shadowMap.enabled = true;
    containerRef.current.appendChild(renderer.domElement);

    scene.add(new THREE.AmbientLight(0xffffff, 0.6));
    const sun = new THREE.DirectionalLight(0xffffff, 1.2);
    sun.position.set(100, 300, 100); sun.castShadow = true;
    scene.add(sun);

    createEnvironment(scene);

    const loadChar = async () => {
      setIsLoading(true);
      try {
        const gltf = await gltfLoader.loadAsync(externalModelUrl);
        const model = gltf.scene;
        if (gltf.animations?.length) {
          mixerRef.current = new THREE.AnimationMixer(model);
          activeAction.current = mixerRef.current.clipAction(gltf.animations[2] || gltf.animations[1]);
          activeAction.current.play();
        }
        model.scale.set(0.015, 0.015, 0.015);
        charGroupRef.current = new THREE.Group();
        charGroupRef.current.add(model);
        scene.add(charGroupRef.current);
        spawnMushrooms(scene);
      } catch (e) { console.error(e); }
      setIsLoading(false);
    };
    loadChar();

    const onMouseDown = (e: MouseEvent) => { isDragging.current = true; lastMousePos.current = { x: e.clientX, y: e.clientY }; };
    const onMouseUp = () => isDragging.current = false;
    const onMouseMove = (e: MouseEvent) => {
      if (isDragging.current) {
        const dx = e.clientX - lastMousePos.current.x;
        const dy = e.clientY - lastMousePos.current.y;
        targetRotation.current.yaw -= dx * 0.008;
        targetRotation.current.pitch -= dy * 0.008;
        targetRotation.current.pitch = Math.max(-0.4, Math.min(0.8, targetRotation.current.pitch));
        lastMousePos.current = { x: e.clientX, y: e.clientY };
      }
    };

    window.addEventListener('mousedown', onMouseDown);
    window.addEventListener('mouseup', onMouseUp);
    window.addEventListener('mousemove', onMouseMove);

    const clock = new THREE.Clock();
    const animate = () => {
      const delta = clock.getDelta();
      const elapsed = clock.getElapsedTime();
      requestAnimationFrame(animate);

      mouseRotation.current.yaw += (targetRotation.current.yaw - mouseRotation.current.yaw) * 0.1;
      mouseRotation.current.pitch += (targetRotation.current.pitch - mouseRotation.current.pitch) * 0.1;

      if (charGroupRef.current) {
        const char = charGroupRef.current;
        const model = char.children[0];
        const keys = keysPressed.current;
        
        // GIANT RULE: 5 mushrooms OR hasEverHadImmunity
        const isGiant = collectedCount.current >= 5 || hasEverHadImmunity.current;

        const targetScale = isGiant ? 0.3 : 0.015;
        if (model) {
          model.scale.lerp(new THREE.Vector3(targetScale, targetScale, targetScale), 0.05);
        }

        const inputDir = new THREE.Vector3();
        if (keys.has('w')) inputDir.z += 1;
        if (keys.has('s')) inputDir.z -= 1;
        if (keys.has('a')) inputDir.x += 1;
        if (keys.has('d')) inputDir.x -= 1;

        const moveSpeed = isGiant ? 600 : 180;
        if (inputDir.length() > 0) {
          inputDir.normalize().applyAxisAngle(new THREE.Vector3(0, 1, 0), mouseRotation.current.yaw);
          const targetRot = Math.atan2(inputDir.x, inputDir.z);
          char.rotation.y = THREE.MathUtils.lerp(char.rotation.y, targetRot, 0.15);
          velocity.current.add(inputDir.multiplyScalar(moveSpeed * delta));
        }
        
        velocity.current.multiplyScalar(0.92);
        char.position.add(velocity.current.clone().multiplyScalar(delta));

        if (mixerRef.current && activeAction.current) {
          const speed = velocity.current.length();
          if (speed < 1.0) {
            activeAction.current.timeScale = THREE.MathUtils.lerp(activeAction.current.timeScale, 0, 0.1);
          } else {
            const animationFactor = isGiant ? 0.015 : 0.08;
            activeAction.current.timeScale = THREE.MathUtils.lerp(activeAction.current.timeScale, speed * animationFactor, 0.1);
          }
          mixerRef.current.update(delta);
        }

        // UNIQUE GOLDEN MUSHROOM SPAWN:
        // Only if (5 mushrooms) AND (never had immunity before) AND (one isn't already sitting on the map)
        if (collectedCount.current >= 5 && !hasEverHadImmunity.current && !goldMushroomRef.current) {
          const gm = createMushroomModel(GOLD_COLOR);
          gm.scale.set(12, 12, 12);
          const angle = Math.random() * Math.PI * 2;
          // Spawn it ahead of the player
          const spawnDist = 180;
          gm.position.set(char.position.x + Math.cos(angle) * spawnDist, 0, char.position.z + Math.sin(angle) * spawnDist);
          scene.add(gm);
          goldMushroomRef.current = gm;
        }

        // Despawn logic ONLY if we lose mushrooms before eating the gold one
        if (collectedCount.current < 5 && !hasEverHadImmunity.current && goldMushroomRef.current) {
          scene.remove(goldMushroomRef.current);
          goldMushroomRef.current = null;
        }

        if (goldMushroomRef.current) {
          goldMushroomRef.current.rotation.y += delta * 3;
          if (char.position.distanceTo(goldMushroomRef.current.position) < 18) {
            scene.remove(goldMushroomRef.current);
            goldMushroomRef.current = null;
            
            // LOCK THE IMMUNITY
            setHasImmunity(true);
            hasEverHadImmunity.current = true;
            
            const bubble = createSpeechBubble();
            scene.add(bubble);
            speechBubbleRef.current = bubble;
          }
        }

        if (speechBubbleRef.current) {
          speechBubbleRef.current.position.set(char.position.x, char.position.y + 28, char.position.z);
          speechBubbleRef.current.lookAt(camera.position);
          speechBubbleRef.current.position.y += Math.sin(elapsed * 5) * 0.8;
        }

        // COLLECTION
        const collectDist = isGiant ? 12 : 3.5;
        mushroomsRef.current.forEach((m, i) => {
          if (char.position.distanceTo(m.position) < collectDist) {
            scene.remove(m); 
            mushroomsRef.current.splice(i, 1);
            if (!hasEverHadImmunity.current) {
              collectedCount.current++;
              if (onMushroomCollect) onMushroomCollect(collectedCount.current);
              spawnNemesis(scene);
            }
          }
        });
        
        spawnMushrooms(scene);

        // ENEMIES
        const hitDist = isGiant ? 15 : 4.5;
        nemesisMushroomsRef.current.forEach((n, i) => {
          const dir = new THREE.Vector3().subVectors(char.position, n.position).normalize();
          const nemesisSpeed = isGiant ? 25 : 10;
          n.position.addScaledVector(dir, nemesisSpeed * delta);
          
          if (char.position.distanceTo(n.position) < hitDist) {
            scene.remove(n); 
            nemesisMushroomsRef.current.splice(i, 1);
            
            // IMMUNITY CHECK: No penalty if immunity is active
            if (!hasEverHadImmunity.current) {
              collectedCount.current = Math.max(0, collectedCount.current - 1);
              if (onMushroomCollect) onMushroomCollect(collectedCount.current);
              spawnMushrooms(scene);
            }
          }
        });

        // CAMERA
        const baseDist = isGiant ? 140 : 35;
        const baseHeight = isGiant ? 70 : 18;
        const h = baseHeight + Math.sin(mouseRotation.current.pitch) * baseDist * 0.5;
        const camZ = Math.cos(mouseRotation.current.pitch) * baseDist;
        const camOffset = new THREE.Vector3(0, h, -camZ).applyAxisAngle(new THREE.Vector3(0, 1, 0), mouseRotation.current.yaw);
        
        camera.position.lerp(char.position.clone().add(camOffset), 0.12);
        camera.lookAt(char.position.x, char.position.y + (isGiant ? 12 : 2.5), char.position.z);
      }
      renderer.render(scene, camera);
    };
    animate();

    const handleResize = () => {
      camera.aspect = window.innerWidth / window.innerHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(window.innerWidth, window.innerHeight);
    };
    window.addEventListener('resize', handleResize);

    const onKeyDown = (e: KeyboardEvent) => keysPressed.current.add(e.key.toLowerCase());
    const onKeyUp = (e: KeyboardEvent) => keysPressed.current.delete(e.key.toLowerCase());
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);

    return () => {
      window.removeEventListener('resize', handleResize);
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
      window.removeEventListener('mousedown', onMouseDown);
      window.removeEventListener('mouseup', onMouseUp);
      window.removeEventListener('mousemove', onMouseMove);
      renderer.dispose();
    };
  }, []);

  return <div ref={containerRef} className="w-full h-full overflow-hidden cursor-move" />;
});

export default ThreeScene;
