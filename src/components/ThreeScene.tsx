
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
  startMobileMotion: () => Promise<boolean>;
}

const THEME_COLOR = 0xE2725B;
const NEMESIS_COLOR = 0x6a0dad;
const GOLD_COLOR = 0xffd700;
const MAX_TOTAL_MUSHROOMS = 5;

const SKY_COLOR = 0x5B4B8A;
const LEAF_COLOR = 0x2F5D50;
const FLOOR_COLOR = 0x2F5D50;
const MIST_COLOR = 0x7A6BAA;

// Scales
const DEFAULT_SCALE = 0.03; 
// 0.03 * 20 = 0.6
const GIANT_SCALE = 0.6;    

const ThreeScene = forwardRef<ThreeSceneHandle, ThreeSceneProps>(({ isDarkMode, externalModelUrl, onMushroomCollect, initialMushroomCount = 0 }, ref) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const charGroupRef = useRef<THREE.Group | null>(null);
  const mushroomsRef = useRef<THREE.Group[]>([]);
  const nemesisMushroomsRef = useRef<THREE.Group[]>([]);
  const goldMushroomRef = useRef<THREE.Group | null>(null);
  const mistGroupRef = useRef<THREE.Group | null>(null);
  
  const keysPressed = useRef<Set<string>>(new Set());
  const moveStartTime = useRef<number>(0);
  const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
  
  const [hasImmunity, setHasImmunity] = useState(false);
  const hasEverHadImmunity = useRef(false);
  const collectedCount = useRef(initialMushroomCount);

  const velocity = useRef(new THREE.Vector3());
  const mouseRotation = useRef({ yaw: 0, pitch: 0.3 });
  const targetRotation = useRef({ yaw: 0, pitch: 0.3 });
  const gyroSteer = useRef(0);
  const isDragging = useRef(false);
  const lastMousePos = useRef({ x: 0, y: 0 });

  const mixerRef = useRef<THREE.AnimationMixer | null>(null);
  const animations = useRef<{ survey: THREE.AnimationAction | null, walk: THREE.AnimationAction | null, run: THREE.AnimationAction | null }>({
    survey: null, walk: null, run: null
  });
  const currentAction = useRef<THREE.AnimationAction | null>(null);
  
  const gltfLoader = new GLTFLoader();

  const resetInternal = () => {
    collectedCount.current = 0;
    setHasImmunity(false);
    hasEverHadImmunity.current = false;
    if (charGroupRef.current) {
      charGroupRef.current.position.set(0, 0, 0);
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
      spawnMushrooms(sceneRef.current);
    }
    if (onMushroomCollect) onMushroomCollect(0);
  };

  useImperativeHandle(ref, () => ({
    resetGame: resetInternal,
    startMobileMotion: async () => {
      if (typeof (DeviceOrientationEvent as any).requestPermission === 'function') {
        try {
          const response = await (DeviceOrientationEvent as any).requestPermission();
          return response === 'granted';
        } catch (e) { return false; }
      }
      return true;
    }
  }));

  const fadeTo = (action: THREE.AnimationAction | null, duration: number = 0.4) => {
    if (!action || action === currentAction.current) return;
    if (currentAction.current) {
      currentAction.current.fadeOut(duration);
    }
    action.reset().fadeIn(duration).play();
    currentAction.current = action;
  };

  const createMist = (scene: THREE.Scene) => {
    const mistGroup = new THREE.Group();
    const geometry = new THREE.PlaneGeometry(150, 150);
    const canvas = document.createElement('canvas');
    canvas.width = 128; canvas.height = 128;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      const g = ctx.createRadialGradient(64, 64, 0, 64, 64, 64);
      g.addColorStop(0, 'rgba(255, 255, 255, 0.2)');
      g.addColorStop(1, 'rgba(255, 255, 255, 0)');
      ctx.fillStyle = g; ctx.fillRect(0, 0, 128, 128);
    }
    const texture = new THREE.CanvasTexture(canvas);
    for (let i = 0; i < 60; i++) {
      const material = new THREE.MeshBasicMaterial({ map: texture, transparent: true, opacity: 0.1, depthWrite: false, side: THREE.DoubleSide, color: MIST_COLOR });
      const mesh = new THREE.Mesh(geometry, material);
      mesh.position.set((Math.random() - 0.5) * 2000, Math.random() * 15 + 2, (Math.random() - 0.5) * 2000);
      mesh.rotation.x = -Math.PI / 2;
      mistGroup.add(mesh);
    }
    scene.add(mistGroup);
    mistGroupRef.current = mistGroup;
  };

  const createMushroomModel = (color: number) => {
    const group = new THREE.Group();
    const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.2, 0.6, 8), new THREE.MeshStandardMaterial({ color: 0xffffff }));
    stem.position.y = 0.3; group.add(stem);
    const cap = new THREE.Mesh(new THREE.SphereGeometry(0.6, 12, 12, 0, Math.PI * 2, 0, Math.PI / 2), new THREE.MeshStandardMaterial({ color: color, flatShading: true }));
    cap.position.y = 0.5; cap.scale.y = 0.7; group.add(cap);
    return group;
  };

  const spawnMushrooms = (scene: THREE.Scene) => {
    // GRAND ARTWORK SPIRAL LOGIC
    if (hasEverHadImmunity.current) {
        if (mushroomsRef.current.length < 80) { 
            const count = mushroomsRef.current.length;
            const angle = count * 0.45; // Golden spiral-ish
            const radius = 20 + count * 5.5; 
            
            const color = count % 3 === 0 ? GOLD_COLOR : THEME_COLOR;
            const m = createMushroomModel(color);
            
            if (charGroupRef.current) {
                m.position.set(
                    charGroupRef.current.position.x + Math.cos(angle) * radius,
                    0,
                    charGroupRef.current.position.z + Math.sin(angle) * radius
                );
            }
            
            m.scale.set(3.5, 3.5, 3.5);
            scene.add(m);
            mushroomsRef.current.push(m);
        }
        return;
    }

    if (collectedCount.current >= MAX_TOTAL_MUSHROOMS) {
      if (!goldMushroomRef.current && !hasEverHadImmunity.current) {
        const gold = createMushroomModel(GOLD_COLOR);
        const angle = Math.random() * Math.PI * 2;
        gold.position.set(Math.cos(angle) * 120, 0, Math.sin(angle) * 120);
        gold.scale.set(2, 2, 2);
        scene.add(gold);
        goldMushroomRef.current = gold;
      }
      return;
    }

    const active = mushroomsRef.current.length;
    const needed = Math.max(0, (MAX_TOTAL_MUSHROOMS - collectedCount.current) - active);
    for (let k = 0; k < needed; k++) {
      const m = createMushroomModel(THEME_COLOR);
      const angle = Math.random() * Math.PI * 2;
      const dist = 60 + Math.random() * 80;
      m.position.set(Math.cos(angle) * dist, 0, Math.sin(angle) * dist);
      scene.add(m); mushroomsRef.current.push(m);
    }
  };

  const spawnNemesis = (scene: THREE.Scene) => {
    const n = createMushroomModel(NEMESIS_COLOR);
    n.scale.set(2.5, 2.5, 2.5);
    const angle = Math.random() * Math.PI * 2;
    // Spawn nemesis slightly further out to account for higher speed
    const offset = new THREE.Vector3(Math.cos(angle) * 100, 0, Math.sin(angle) * 100);
    if (charGroupRef.current) {
      n.position.copy(charGroupRef.current.position).add(offset);
    } else {
      n.position.set(offset.x, 0, offset.z);
    }
    scene.add(n); nemesisMushroomsRef.current.push(n);
  };

  useEffect(() => {
    if (!containerRef.current) return;
    const scene = new THREE.Scene();
    sceneRef.current = scene;
    scene.background = new THREE.Color(SKY_COLOR);
    scene.fog = new THREE.FogExp2(SKY_COLOR, 0.002);
    
    const camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 5000);
    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.shadowMap.enabled = true;
    containerRef.current.appendChild(renderer.domElement);

    scene.add(new THREE.AmbientLight(0xffffff, 0.8));
    const sun = new THREE.DirectionalLight(0xffffff, 1.2);
    sun.position.set(100, 300, 100); sun.castShadow = true;
    scene.add(sun);

    const floor = new THREE.Mesh(new THREE.PlaneGeometry(8000, 8000), new THREE.MeshStandardMaterial({ color: FLOOR_COLOR }));
    floor.rotation.x = -Math.PI / 2; floor.receiveShadow = true;
    scene.add(floor);

    createMist(scene);

    for (let i = 0; i < 400; i++) {
      const tree = new THREE.Group();
      const trunkH = 10 + Math.random() * 10;
      const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.8, 1.2, trunkH), new THREE.MeshStandardMaterial({ color: 0x3d2b1f }));
      trunk.position.y = trunkH / 2; tree.add(trunk);
      const leaves = new THREE.Mesh(new THREE.ConeGeometry(8, trunkH * 2, 8), new THREE.MeshStandardMaterial({ color: LEAF_COLOR }));
      leaves.position.y = trunkH * 1.5; tree.add(leaves);
      const x = (Math.random() - 0.5) * 2000; const z = (Math.random() - 0.5) * 2000;
      if (Math.abs(x) > 50 || Math.abs(z) > 50) { tree.position.set(x, 0, z); scene.add(tree); }
    }

    const loadChar = async () => {
      try {
        const gltf = await gltfLoader.loadAsync(externalModelUrl);
        const model = gltf.scene;
        model.traverse(o => { if ((o as any).isMesh) o.castShadow = true; });
        
        if (gltf.animations?.length) {
          mixerRef.current = new THREE.AnimationMixer(model);
          animations.current.survey = mixerRef.current.clipAction(gltf.animations[0]);
          animations.current.walk = mixerRef.current.clipAction(gltf.animations[1]);
          animations.current.run = mixerRef.current.clipAction(gltf.animations[2]);
          fadeTo(animations.current.survey);
        }

        model.scale.set(DEFAULT_SCALE, DEFAULT_SCALE, DEFAULT_SCALE);
        charGroupRef.current = new THREE.Group();
        charGroupRef.current.add(model);
        scene.add(charGroupRef.current);
        spawnMushrooms(scene);
      } catch (e) { console.error(e); }
    };
    loadChar();

    const handleOrientation = (e: DeviceOrientationEvent) => {
      if (e.gamma !== null) gyroSteer.current = -(e.gamma / 45); 
    };
    if (isMobile) window.addEventListener('deviceorientation', handleOrientation);

    const clock = new THREE.Clock();
    const animate = () => {
      const delta = clock.getDelta();
      const elapsed = clock.getElapsedTime();
      requestAnimationFrame(animate);

      mouseRotation.current.yaw += (targetRotation.current.yaw - mouseRotation.current.yaw) * 0.1;
      mouseRotation.current.pitch += (targetRotation.current.pitch - mouseRotation.current.pitch) * 0.1;

      if (mistGroupRef.current) {
        mistGroupRef.current.children.forEach((m, i) => {
          m.position.x += Math.cos(elapsed * 0.1 + i) * 0.05;
          if (m instanceof THREE.Mesh) m.material.opacity = 0.08 + Math.sin(elapsed * 0.5 + i) * 0.04;
        });
      }

      if (charGroupRef.current) {
        const char = charGroupRef.current;
        const model = char.children[0];
        const keys = keysPressed.current;
        const isGiant = hasEverHadImmunity.current;

        const targetScale = isGiant ? GIANT_SCALE : DEFAULT_SCALE;
        if (model) {
            model.scale.lerp(new THREE.Vector3(targetScale, targetScale, targetScale), 0.05);
        }

        const inputDir = new THREE.Vector3();
        let isMoving = false;

        if (isMobile) {
          inputDir.z = 1; isMoving = true;
          targetRotation.current.yaw += gyroSteer.current * delta * 1.5;
        } else {
          if (keys.has('w')) { inputDir.z += 1; isMoving = true; }
          if (keys.has('s')) { inputDir.z -= 1; isMoving = true; }
          if (keys.has('a')) { inputDir.x += 1; isMoving = true; }
          if (keys.has('d')) { inputDir.x -= 1; isMoving = true; }
        }

        if (isMoving) {
          if (moveStartTime.current === 0) moveStartTime.current = Date.now();
          const holdDuration = Date.now() - moveStartTime.current;
          const maxSpeed = isGiant ? 600 : 180;
          const runThreshold = 400; 
          
          if (holdDuration > runThreshold) {
            fadeTo(animations.current.run);
            velocity.current.add(inputDir.clone().normalize().applyAxisAngle(new THREE.Vector3(0, 1, 0), mouseRotation.current.yaw).multiplyScalar(maxSpeed * 1.8 * delta));
          } else {
            fadeTo(animations.current.walk);
            velocity.current.add(inputDir.clone().normalize().applyAxisAngle(new THREE.Vector3(0, 1, 0), mouseRotation.current.yaw).multiplyScalar(maxSpeed * delta));
          }
          
          const targetRot = Math.atan2(inputDir.x, inputDir.z) + mouseRotation.current.yaw;
          char.rotation.y = THREE.MathUtils.lerp(char.rotation.y, targetRot, 0.15);
        } else {
          moveStartTime.current = 0;
          fadeTo(animations.current.survey);
        }

        velocity.current.multiplyScalar(0.9);
        char.position.add(velocity.current.clone().multiplyScalar(delta));

        if (mixerRef.current) mixerRef.current.update(delta);

        // NEMESIS PURSUIT LOGIC - ENHANCED DIFFICULTY
        const nemesisToRemove: number[] = [];
        const baseNemesisSpeed = 22;
        // Faster as you collect more mushrooms (difficulty scaling)
        const currentNemesisSpeed = baseNemesisSpeed * (1 + (collectedCount.current * 0.15));
        
        nemesisMushroomsRef.current.forEach((n, i) => {
          if (!isGiant) {
            const dir = char.position.clone().sub(n.position).normalize();
            n.position.add(dir.multiplyScalar(currentNemesisSpeed * delta));
            
            if (char.position.distanceTo(n.position) < 3.5) {
                if (collectedCount.current > 0) {
                    collectedCount.current--;
                    if (onMushroomCollect) onMushroomCollect(collectedCount.current);
                    nemesisToRemove.push(i);
                } else {
                    resetInternal();
                }
            }
          } else {
             // In giant mode, they flee even faster
             const dir = n.position.clone().sub(char.position).normalize();
             n.position.add(dir.multiplyScalar(60 * delta));
          }
        });

        nemesisToRemove.sort((a,b) => b-a).forEach(index => {
            const n = nemesisMushroomsRef.current[index];
            scene.remove(n);
            nemesisMushroomsRef.current.splice(index, 1);
        });

        // Collectibles & Artwork Animation
        const collectDist = isGiant ? 45 : 4.5;
        mushroomsRef.current.forEach((m, i) => {
          if (isGiant) {
              m.position.y = Math.sin(elapsed * 2 + i) * 0.5;
          } else if (char.position.distanceTo(m.position) < collectDist) {
            scene.remove(m); mushroomsRef.current.splice(i, 1);
            if (!hasEverHadImmunity.current) {
              collectedCount.current++; 
              if (onMushroomCollect) onMushroomCollect(collectedCount.current);
              spawnNemesis(scene);
            }
          }
        });

        // Gold Mushroom logic
        if (goldMushroomRef.current) {
          goldMushroomRef.current.rotation.y += delta * 2;
          if (char.position.distanceTo(goldMushroomRef.current.position) < collectDist) {
            scene.remove(goldMushroomRef.current);
            goldMushroomRef.current = null;
            hasEverHadImmunity.current = true;
            setHasImmunity(true);
            mushroomsRef.current.forEach(m => scene.remove(m));
            mushroomsRef.current = [];
            spawnMushrooms(scene);
          }
        }

        spawnMushrooms(scene);

        const camDist = isGiant ? 350 : 35;
        const camH = isGiant ? 180 : 18;
        const camOffset = new THREE.Vector3(0, camH + Math.sin(mouseRotation.current.pitch) * camDist * 0.5, -Math.cos(mouseRotation.current.pitch) * camDist).applyAxisAngle(new THREE.Vector3(0, 1, 0), mouseRotation.current.yaw);
        camera.position.lerp(char.position.clone().add(camOffset), 0.1);
        camera.lookAt(char.position.x, char.position.y + (isGiant ? 50 : 3), char.position.z);
      }
      renderer.render(scene, camera);
    };
    animate();

    const onKeyDown = (e: KeyboardEvent) => keysPressed.current.add(e.key.toLowerCase());
    const onKeyUp = (e: KeyboardEvent) => keysPressed.current.delete(e.key.toLowerCase());
    const onMouseDown = (e: MouseEvent) => { isDragging.current = true; lastMousePos.current = { x: e.clientX, y: e.clientY }; };
    const onMouseUp = () => isDragging.current = false;
    const onMouseMove = (e: MouseEvent) => {
      if (isDragging.current) {
        targetRotation.current.yaw -= (e.clientX - lastMousePos.current.x) * 0.008;
        targetRotation.current.pitch = Math.max(-0.4, Math.min(0.8, targetRotation.current.pitch - (e.clientY - lastMousePos.current.y) * 0.008));
        lastMousePos.current = { x: e.clientX, y: e.clientY };
      }
    };

    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    window.addEventListener('mousedown', onMouseDown);
    window.addEventListener('mouseup', onMouseUp);
    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('resize', () => { camera.aspect = window.innerWidth / window.innerHeight; camera.updateProjectionMatrix(); renderer.setSize(window.innerWidth, window.innerHeight); });

    return () => {
      window.removeEventListener('keydown', onKeyDown); window.removeEventListener('keyup', onKeyUp);
      window.removeEventListener('mousedown', onMouseDown); window.removeEventListener('mouseup', onMouseUp); window.removeEventListener('mousemove', onMouseMove);
      if (isMobile) window.removeEventListener('deviceorientation', handleOrientation);
      renderer.dispose();
    };
  }, []);

  return <div ref={containerRef} className="w-full h-full overflow-hidden cursor-move touch-none" />;
});

export default ThreeScene;
