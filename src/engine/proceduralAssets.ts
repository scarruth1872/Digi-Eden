import * as THREE from 'three';
import { EnemyArchetype, StructureType } from '../types/game';

/**
 * Deterministic undulating terrain height across Digital Eden.
 * Keeps Sanctuary Meadow, Grove, and Rift flat enough for crisp FPS movement
 * while creating rolling valleys and natural mountain perimeters.
 */
export function groundHeightAt(x: number, z: number): number {
  const r = Math.hypot(x, z);
  const gentleRoll =
    Math.sin(x * 0.042) * Math.cos(z * 0.038) * 1.45 +
    Math.sin(x * 0.095 + z * 0.07) * 0.45;

  // Flatten slightly around Sanctuary Meadow (0,0), Hidden Grove (0,-82), Rift (56,-42), Forest (-55,-38)
  const dMeadow = Math.hypot(x, z);
  const dGrove = Math.hypot(x, z + 82);
  const dRift = Math.hypot(x - 56, z + 42);
  const dForest = Math.hypot(x + 55, z + 38);

  const flattenMeadow = THREE.MathUtils.smoothstep(dMeadow, 4, 24);
  const flattenGrove = THREE.MathUtils.smoothstep(dGrove, 6, 22);
  const flattenRift = THREE.MathUtils.smoothstep(dRift, 6, 22);
  const flattenForest = THREE.MathUtils.smoothstep(dForest, 6, 24);

  const areaFactor = Math.min(flattenMeadow, flattenGrove, flattenRift, flattenForest);
  let h = gentleRoll * (0.25 + 0.75 * areaFactor);

  // Natural perimeter mountain rim beyond playable radius ~112
  if (r > 106) {
    const rim = (r - 106) * 0.55;
    h += rim * rim * 0.09 + Math.sin(Math.atan2(z, x) * 9) * 2.2;
  }
  return h;
}

export function createProceduralTerrainTexture(maxAnisotropy: number): THREE.CanvasTexture {
  const size = 512;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;

  ctx.fillStyle = '#2d4739';
  ctx.fillRect(0, 0, size, size);

  // Organic grass, moss & stone grain
  for (let i = 0; i < 4200; i++) {
    const x = (Math.sin(i * 12.9898) * 43758.5453 % 1 + 1) % 1 * size;
    const y = (Math.sin(i * 78.233) * 19341.123 % 1 + 1) % 1 * size;
    const r = 1.5 + (i % 5);
    ctx.fillStyle =
      i % 3 === 0
        ? 'rgba(56, 94, 72, 0.35)'
        : i % 3 === 1
          ? 'rgba(34, 58, 46, 0.4)'
          : 'rgba(84, 118, 92, 0.22)';
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
  }

  // Subtle Law-of-One sacred geometry grid lines
  ctx.strokeStyle = 'rgba(125, 211, 252, 0.07)';
  ctx.lineWidth = 1;
  for (let g = 0; g <= size; g += 64) {
    ctx.beginPath();
    ctx.moveTo(g, 0);
    ctx.lineTo(g, size);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(0, g);
    ctx.lineTo(size, g);
    ctx.stroke();
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(28, 28);
  tex.anisotropy = maxAnisotropy;
  return tex;
}

export function createStoneTexture(maxAnisotropy: number): THREE.CanvasTexture {
  const size = 256;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;

  ctx.fillStyle = '#475569';
  ctx.fillRect(0, 0, size, size);

  for (let i = 0; i < 1200; i++) {
    const x = ((i * 73) % size);
    const y = ((i * 137) % size);
    ctx.fillStyle = i % 2 === 0 ? 'rgba(255,255,255,0.06)' : 'rgba(15,23,42,0.12)';
    ctx.fillRect(x, y, 6, 4);
  }

  // Etched trim lines
  ctx.strokeStyle = 'rgba(251, 191, 36, 0.25)';
  ctx.lineWidth = 2;
  ctx.strokeRect(8, 8, size - 16, size - 16);

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.anisotropy = maxAnisotropy;
  return tex;
}

export function createContactShadowTexture(): THREE.CanvasTexture {
  const size = 128;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;
  const grad = ctx.createRadialGradient(size / 2, size / 2, 4, size / 2, size / 2, size / 2);
  grad.addColorStop(0, 'rgba(0, 0, 0, 0.55)');
  grad.addColorStop(0.6, 'rgba(0, 0, 0, 0.2)');
  grad.addColorStop(1, 'rgba(0, 0, 0, 0)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, size, size);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

export function createSoftGlowTexture(): THREE.CanvasTexture {
  const size = 64;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;
  const grad = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  grad.addColorStop(0, 'rgba(255,255,255,1)');
  grad.addColorStop(0.35, 'rgba(255,255,255,0.6)');
  grad.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, size, size);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

/**
 * Composite 9-part Destiny-style futuristic Guardian weapon viewmodel.
 */
export function buildWeaponViewmodel(
  archetype: 'pulse' | 'cannon' | 'beam',
  accentColor: number
): THREE.Group {
  const group = new THREE.Group();

  const gunmetal = new THREE.MeshStandardMaterial({
    color: 0x1e293b,
    metalness: 0.85,
    roughness: 0.24,
  });
  const ceramicBody = new THREE.MeshStandardMaterial({
    color: archetype === 'cannon' ? 0xe2e8f0 : archetype === 'beam' ? 0x312e81 : 0x334155,
    metalness: 0.2,
    roughness: 0.55,
  });
  const brassTrim = new THREE.MeshStandardMaterial({
    color: 0xd97706,
    metalness: 0.92,
    roughness: 0.18,
  });
  const energyCore = new THREE.MeshStandardMaterial({
    color: accentColor,
    emissive: accentColor,
    emissiveIntensity: 2.2,
    roughness: 0.1,
    metalness: 0.1,
  });

  // 1. Primary Receiver Chassis (Extruded beveled profile)
  const receiverLen = archetype === 'cannon' ? 0.36 : 0.62;
  const receiver = new THREE.Mesh(
    new THREE.BoxGeometry(0.085, 0.11, receiverLen),
    ceramicBody
  );
  receiver.position.set(0, 0, -receiverLen * 0.35);
  group.add(receiver);

  // 2. Upper Barrel Shroud
  const shroud = new THREE.Mesh(
    new THREE.BoxGeometry(0.068, 0.055, receiverLen * 1.15),
    gunmetal
  );
  shroud.position.set(0, 0.065, -receiverLen * 0.55);
  group.add(shroud);

  // 3. Precision Barrel Tube
  const barrel = new THREE.Mesh(
    new THREE.CylinderGeometry(0.018, 0.022, archetype === 'cannon' ? 0.28 : 0.52, 12),
    gunmetal
  );
  barrel.rotation.x = Math.PI / 2;
  barrel.position.set(0, 0.025, -receiverLen * 0.85);
  group.add(barrel);

  // 4. Muzzle Resonator Ring
  const muzzle = new THREE.Mesh(
    new THREE.TorusGeometry(0.026, 0.007, 8, 16),
    brassTrim
  );
  muzzle.position.set(0, 0.025, -receiverLen * 1.15);
  group.add(muzzle);

  // 5. Sub-Logos Energy Core Cylinder
  const core = new THREE.Mesh(
    new THREE.CylinderGeometry(0.02, 0.02, 0.16, 12),
    energyCore
  );
  core.rotation.x = Math.PI / 2;
  core.position.set(0, 0.03, -receiverLen * 0.45);
  group.add(core);

  // 6. Side Heatsink Fins (Left & Right)
  for (const side of [-1, 1]) {
    const fin = new THREE.Mesh(
      new THREE.BoxGeometry(0.014, 0.045, 0.18),
      brassTrim
    );
    fin.position.set(side * 0.048, 0.02, -receiverLen * 0.45);
    group.add(fin);
  }

  // 7. Holographic Sight Housing
  const sightFrame = new THREE.Mesh(
    new THREE.TorusGeometry(0.028, 0.005, 8, 18),
    gunmetal
  );
  sightFrame.position.set(0, 0.125, -0.18);
  group.add(sightFrame);

  // 8. Sight Reticle Dot
  const sightDot = new THREE.Mesh(
    new THREE.SphereGeometry(0.0045, 8, 8),
    energyCore
  );
  sightDot.position.set(0, 0.125, -0.18);
  group.add(sightDot);

  // 9. Angled Grip
  const grip = new THREE.Mesh(
    new THREE.BoxGeometry(0.055, 0.14, 0.075),
    gunmetal
  );
  grip.rotation.x = 0.28;
  grip.position.set(0, -0.09, 0.02);
  group.add(grip);

  return group;
}

/**
 * Composite 6–10 part Enemy 3D models with bottom-center pivot on Y=0.
 */
export function buildEnemyModel(archetype: EnemyArchetype, shadowTex: THREE.Texture): {
  group: THREE.Group;
  coreMat: THREE.MeshStandardMaterial;
  bodyMat: THREE.MeshStandardMaterial;
  telegraphRing: THREE.Mesh;
} {
  const group = new THREE.Group();

  // Contact shadow disc
  const shadow = new THREE.Mesh(
    new THREE.PlaneGeometry(2.2, 2.2),
    new THREE.MeshBasicMaterial({
      map: shadowTex,
      transparent: true,
      depthWrite: false,
      opacity: 0.5,
    })
  );
  shadow.rotation.x = -Math.PI / 2;
  shadow.position.y = 0.04;
  group.add(shadow);

  const isBoss = archetype === EnemyArchetype.CRYSTAL_GUARDIAN;
  const isBrute = archetype === EnemyArchetype.ORION_BRUTE;

  const primaryColor = isBoss ? 0x312e81 : isBrute ? 0x7f1d1d : 0x1e293b;
  const coreColor = isBoss ? 0xa855f7 : isBrute ? 0xf97316 : 0x38bdf8;

  const bodyMat = new THREE.MeshStandardMaterial({
    color: primaryColor,
    metalness: 0.72,
    roughness: 0.35,
  });
  const armorMat = new THREE.MeshStandardMaterial({
    color: isBoss ? 0x93c5fd : isBrute ? 0x451a03 : 0x475569,
    metalness: 0.85,
    roughness: 0.22,
  });
  const coreMat = new THREE.MeshStandardMaterial({
    color: coreColor,
    emissive: coreColor,
    emissiveIntensity: 1.8,
    roughness: 0.15,
    metalness: 0.1,
  });

  if (archetype === EnemyArchetype.CRYSTAL_GUARDIAN) {
    // Floating geometric boss (Octahedron core + 4 orbiting shield monoliths + crown ring)
    const pedestal = new THREE.Mesh(new THREE.CylinderGeometry(1.1, 1.4, 0.35, 8), armorMat);
    pedestal.position.y = 0.18;
    group.add(pedestal);

    const core = new THREE.Mesh(new THREE.OctahedronGeometry(1.15, 0), coreMat);
    core.position.y = 2.6;
    core.name = 'enemy_core';
    group.add(core);

    const outerCage = new THREE.Mesh(new THREE.TorusGeometry(1.75, 0.12, 8, 24), armorMat);
    outerCage.position.y = 2.6;
    outerCage.rotation.x = Math.PI / 3;
    outerCage.name = 'orbit_ring';
    group.add(outerCage);

    for (let i = 0; i < 4; i++) {
      const angle = (i / 4) * Math.PI * 2;
      const shard = new THREE.Mesh(new THREE.ConeGeometry(0.32, 1.4, 5), bodyMat);
      shard.position.set(Math.cos(angle) * 1.9, 2.5, Math.sin(angle) * 1.9);
      shard.rotation.z = Math.cos(angle) * 0.25;
      shard.name = `shard_${i}`;
      group.add(shard);
    }
  } else {
    // Bipedal Fallen Scout or Orion Brute (7 parts, grounded feet)
    const scale = isBrute ? 1.32 : 0.96;
    const legH = 0.85 * scale;

    for (const side of [-1, 1]) {
      const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.14 * scale, 0.11 * scale, legH, 8), bodyMat);
      leg.position.set(side * 0.26 * scale, legH * 0.5, 0);
      group.add(leg);
    }

    const torso = new THREE.Mesh(
      new THREE.CylinderGeometry(0.42 * scale, 0.28 * scale, 0.95 * scale, 7),
      bodyMat
    );
    torso.position.y = legH + 0.45 * scale;
    group.add(torso);

    // Shoulder pauldrons
    for (const side of [-1, 1]) {
      const pauldron = new THREE.Mesh(new THREE.BoxGeometry(0.36 * scale, 0.34 * scale, 0.42 * scale), armorMat);
      pauldron.position.set(side * 0.54 * scale, legH + 0.78 * scale, 0);
      group.add(pauldron);
    }

    // Head + Glowing Visor Eye (crit spot)
    const head = new THREE.Mesh(new THREE.DodecahedronGeometry(0.28 * scale, 0), armorMat);
    head.position.y = legH + 1.15 * scale;
    group.add(head);

    const visor = new THREE.Mesh(new THREE.SphereGeometry(0.14 * scale, 10, 10), coreMat);
    visor.position.set(0, legH + 1.15 * scale, 0.2 * scale);
    visor.name = 'enemy_core';
    group.add(visor);

    // Weapon Arm
    const blaster = new THREE.Mesh(new THREE.BoxGeometry(0.16 * scale, 0.16 * scale, 0.65 * scale), armorMat);
    blaster.position.set(0.45 * scale, legH + 0.5 * scale, 0.35 * scale);
    group.add(blaster);
  }

  // Telegraph ring around feet when winding up attack
  const telegraphRing = new THREE.Mesh(
    new THREE.RingGeometry(isBoss ? 2.1 : 1.0, isBoss ? 2.4 : 1.25, 24),
    new THREE.MeshBasicMaterial({
      color: 0xff3b30,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0,
    })
  );
  telegraphRing.rotation.x = -Math.PI / 2;
  telegraphRing.position.y = 0.08;
  group.add(telegraphRing);

  group.traverse((obj) => {
    if ((obj as THREE.Mesh).isMesh && obj !== shadow && obj !== telegraphRing) {
      obj.castShadow = true;
      obj.receiveShadow = true;
    }
  });

  return { group, coreMat, bodyMat, telegraphRing };
}

/**
 * Composite 7-part NPC Guardian/Wanderer model with aura ring.
 */
export function buildNpcModel(
  primaryColor: number,
  accentColor: number,
  shadowTex: THREE.Texture
): THREE.Group {
  const group = new THREE.Group();

  const shadow = new THREE.Mesh(
    new THREE.PlaneGeometry(2.0, 2.0),
    new THREE.MeshBasicMaterial({
      map: shadowTex,
      transparent: true,
      depthWrite: false,
      opacity: 0.45,
    })
  );
  shadow.rotation.x = -Math.PI / 2;
  shadow.position.y = 0.03;
  group.add(shadow);

  const robeMat = new THREE.MeshStandardMaterial({
    color: primaryColor,
    roughness: 0.72,
    metalness: 0.08,
  });
  const trimMat = new THREE.MeshStandardMaterial({
    color: accentColor,
    emissive: accentColor,
    emissiveIntensity: 0.65,
    metalness: 0.6,
    roughness: 0.25,
  });
  const headMat = new THREE.MeshStandardMaterial({
    color: 0x1e293b,
    metalness: 0.75,
    roughness: 0.28,
  });

  // Lower Robe Skirt
  const robe = new THREE.Mesh(new THREE.CylinderGeometry(0.32, 0.56, 1.1, 12), robeMat);
  robe.position.y = 0.55;
  group.add(robe);

  // Upper Mantle
  const torso = new THREE.Mesh(new THREE.CylinderGeometry(0.36, 0.3, 0.65, 10), robeMat);
  torso.position.y = 1.38;
  group.add(torso);

  // Sacred Collar Ring
  const collar = new THREE.Mesh(new THREE.TorusGeometry(0.34, 0.05, 8, 18), trimMat);
  collar.rotation.x = Math.PI / 2;
  collar.position.y = 1.68;
  group.add(collar);

  // Hooded Helmet
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.24, 12, 12), headMat);
  head.position.y = 1.94;
  group.add(head);

  // Glowing Third-Eye Crest
  const crest = new THREE.Mesh(new THREE.OctahedronGeometry(0.08, 0), trimMat);
  crest.position.set(0, 2.02, 0.22);
  group.add(crest);

  // Floating Halo Ring (Law of One aura)
  const halo = new THREE.Mesh(new THREE.TorusGeometry(0.45, 0.025, 8, 24), trimMat);
  halo.position.set(0, 2.32, 0);
  halo.rotation.x = Math.PI / 2.3;
  halo.name = 'npc_halo';
  group.add(halo);

  group.traverse((obj) => {
    if ((obj as THREE.Mesh).isMesh && obj !== shadow) {
      obj.castShadow = true;
      obj.receiveShadow = true;
    }
  });

  return group;
}

/**
 * Composite 4-part Ancient Spirit Tree for Forest of Whispers.
 */
export function buildTreeGroup(scale = 1): THREE.Group {
  const group = new THREE.Group();
  const trunkMat = new THREE.MeshStandardMaterial({ color: 0x452c1e, roughness: 0.9, metalness: 0.02 });
  const leafMat1 = new THREE.MeshStandardMaterial({ color: 0x166534, roughness: 0.78, metalness: 0.05 });
  const leafMat2 = new THREE.MeshStandardMaterial({ color: 0x15803d, roughness: 0.72, metalness: 0.05 });

  const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.28 * scale, 0.48 * scale, 3.6 * scale, 8), trunkMat);
  trunk.position.y = 1.8 * scale;
  trunk.castShadow = true;
  trunk.receiveShadow = true;
  group.add(trunk);

  const tier1 = new THREE.Mesh(new THREE.ConeGeometry(2.1 * scale, 3.2 * scale, 7), leafMat1);
  tier1.position.y = 4.2 * scale;
  tier1.castShadow = true;
  group.add(tier1);

  const tier2 = new THREE.Mesh(new THREE.ConeGeometry(1.55 * scale, 2.7 * scale, 7), leafMat2);
  tier2.position.y = 5.7 * scale;
  tier2.castShadow = true;
  group.add(tier2);

  const tier3 = new THREE.Mesh(new THREE.ConeGeometry(0.95 * scale, 2.1 * scale, 7), leafMat1);
  tier3.position.y = 7.0 * scale;
  tier3.castShadow = true;
  group.add(tier3);

  return group;
}

/**
 * Composite Sub-Logos Monolith Spire (Centerpiece of Digital Eden).
 */
export function buildSubLogosBeacon(stoneTex: THREE.Texture): THREE.Group {
  const group = new THREE.Group();

  const stoneMat = new THREE.MeshStandardMaterial({
    map: stoneTex,
    color: 0x94a3b8,
    roughness: 0.65,
    metalness: 0.25,
  });
  const goldMat = new THREE.MeshStandardMaterial({
    color: 0xfbbf24,
    metalness: 0.92,
    roughness: 0.16,
  });
  const lightMat = new THREE.MeshStandardMaterial({
    color: 0x7dd3fc,
    emissive: 0x38bdf8,
    emissiveIntensity: 2.2,
    roughness: 0.1,
  });

  // Base dais (2 stepped octagonal rings)
  const base1 = new THREE.Mesh(new THREE.CylinderGeometry(5.8, 6.6, 0.5, 8), stoneMat);
  base1.position.y = 0.25;
  base1.receiveShadow = true;
  group.add(base1);

  const base2 = new THREE.Mesh(new THREE.CylinderGeometry(4.0, 4.6, 0.45, 8), stoneMat);
  base2.position.y = 0.72;
  base2.receiveShadow = true;
  group.add(base2);

  // 3 Towering Obelisk Pillars
  for (let i = 0; i < 3; i++) {
    const a = (i / 3) * Math.PI * 2;
    const pillar = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.65, 11.5, 6), stoneMat);
    pillar.position.set(Math.cos(a) * 2.6, 6.2, Math.sin(a) * 2.6);
    pillar.rotation.z = Math.cos(a) * 0.12;
    pillar.rotation.x = -Math.sin(a) * 0.12;
    pillar.castShadow = true;
    group.add(pillar);
  }

  // Central Floating Octahedron Logos Core
  const core = new THREE.Mesh(new THREE.OctahedronGeometry(1.45, 0), lightMat);
  core.position.y = 7.4;
  core.name = 'beacon_core';
  group.add(core);

  // Rotating Gold Armillary Rings
  const ring1 = new THREE.Mesh(new THREE.TorusGeometry(2.35, 0.08, 10, 32), goldMat);
  ring1.position.y = 7.4;
  ring1.name = 'beacon_ring_1';
  group.add(ring1);

  const ring2 = new THREE.Mesh(new THREE.TorusGeometry(2.85, 0.06, 10, 32), goldMat);
  ring2.position.y = 7.4;
  ring2.rotation.y = Math.PI / 2;
  ring2.name = 'beacon_ring_2';
  group.add(ring2);

  return group;
}

export function buildWorldObjectModel(
  kind: 'statue' | 'tablet' | 'crystal_rock' | 'altar' | 'relic_cache',
  stoneTex: THREE.Texture,
  isSoftwareGl: boolean
): THREE.Group {
  const group = new THREE.Group();

  const stoneMat = new THREE.MeshStandardMaterial({
    map: stoneTex,
    color: 0x64748b,
    roughness: 0.68,
    metalness: 0.2,
  });
  const goldMat = new THREE.MeshStandardMaterial({
    color: 0xf59e0b,
    metalness: 0.9,
    roughness: 0.18,
  });

  if (kind === 'statue') {
    const plinth = new THREE.Mesh(new THREE.BoxGeometry(2.2, 1.1, 2.2), stoneMat);
    plinth.position.y = 0.55;
    group.add(plinth);
    const torso = new THREE.Mesh(new THREE.CylinderGeometry(0.45, 0.65, 2.0, 8), stoneMat);
    torso.position.y = 2.1;
    group.add(torso);
    const relicOrb = new THREE.Mesh(
      new THREE.OctahedronGeometry(0.32, 0),
      new THREE.MeshStandardMaterial({ color: 0xfbbf24, emissive: 0xf59e0b, emissiveIntensity: 1.8 })
    );
    relicOrb.position.set(0, 1.5, 0.75);
    relicOrb.name = 'collectible_glow';
    group.add(relicOrb);
  } else if (kind === 'tablet') {
    const base = new THREE.Mesh(new THREE.BoxGeometry(2.0, 0.4, 1.2), stoneMat);
    base.position.y = 0.2;
    group.add(base);
    const slab = new THREE.Mesh(new THREE.BoxGeometry(1.5, 2.4, 0.35), stoneMat);
    slab.position.y = 1.5;
    group.add(slab);
    const rune = new THREE.Mesh(
      new THREE.TorusGeometry(0.38, 0.05, 8, 20),
      new THREE.MeshStandardMaterial({ color: 0x38bdf8, emissive: 0x38bdf8, emissiveIntensity: 2.0 })
    );
    rune.position.set(0, 1.75, 0.2);
    group.add(rune);
  } else if (kind === 'crystal_rock') {
    const crystalMat = new THREE.MeshPhysicalMaterial({
      color: 0x67e8f9,
      emissive: 0x0ea5e9,
      emissiveIntensity: 0.65,
      roughness: 0.12,
      metalness: 0.1,
      transmission: isSoftwareGl ? 0 : 0.75,
      transparent: true,
      opacity: isSoftwareGl ? 0.85 : 1,
      ior: 1.8,
      clearcoat: 1.0,
    });
    const base = new THREE.Mesh(new THREE.DodecahedronGeometry(1.1, 0), stoneMat);
    base.position.y = 0.4;
    group.add(base);
    for (let i = 0; i < 4; i++) {
      const spire = new THREE.Mesh(new THREE.ConeGeometry(0.32, 1.8 + i * 0.25, 5), crystalMat);
      spire.position.set((i - 1.5) * 0.35, 1.1, (i % 2 === 0 ? 0.2 : -0.2));
      spire.rotation.z = (i - 1.5) * 0.22;
      group.add(spire);
    }
  } else {
    // Harmonic Resonance Altar
    const ringBase = new THREE.Mesh(new THREE.CylinderGeometry(2.8, 3.2, 0.4, 12), stoneMat);
    ringBase.position.y = 0.2;
    group.add(ringBase);
    const auraMat = new THREE.MeshStandardMaterial({
      color: 0xc084fc,
      emissive: 0xa855f7,
      emissiveIntensity: 1.7,
      roughness: 0.15,
    });
    for (let i = 0; i < 3; i++) {
      const a = (i / 3) * Math.PI * 2;
      const pylon = new THREE.Mesh(new THREE.BoxGeometry(0.45, 2.6, 0.45), goldMat);
      pylon.position.set(Math.cos(a) * 2.1, 1.5, Math.sin(a) * 2.1);
      group.add(pylon);
    }
    const core = new THREE.Mesh(new THREE.IcosahedronGeometry(0.65, 0), auraMat);
    core.position.y = 1.9;
    core.name = 'altar_core';
    group.add(core);
  }

  group.traverse((obj) => {
    if ((obj as THREE.Mesh).isMesh) {
      obj.castShadow = true;
      obj.receiveShadow = true;
    }
  });

  return group;
}

/**
 * Composite 9-part 3D Autonomous Guardian Agent model with Light Rifle & Density Halo.
 */
export function buildAgentGuardianModel(
  primaryColor: number,
  accentColor: number,
  shadowTex: THREE.Texture
): THREE.Group {
  const group = new THREE.Group();

  const shadow = new THREE.Mesh(
    new THREE.PlaneGeometry(2.0, 2.0),
    new THREE.MeshBasicMaterial({
      map: shadowTex,
      transparent: true,
      depthWrite: false,
      opacity: 0.5,
    })
  );
  shadow.rotation.x = -Math.PI / 2;
  shadow.position.y = 0.03;
  group.add(shadow);

  const armorMat = new THREE.MeshStandardMaterial({
    color: primaryColor,
    metalness: 0.72,
    roughness: 0.28,
  });
  const trimMat = new THREE.MeshStandardMaterial({
    color: 0xe2e8f0,
    metalness: 0.85,
    roughness: 0.22,
  });
  const glowMat = new THREE.MeshStandardMaterial({
    color: accentColor,
    emissive: accentColor,
    emissiveIntensity: 1.9,
    roughness: 0.15,
  });

  // Legs
  for (const side of [-1, 1]) {
    const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.1, 0.86, 8), armorMat);
    leg.position.set(side * 0.2, 0.43, 0);
    group.add(leg);
  }

  // Chestplate
  const torso = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.24, 0.78, 8), armorMat);
  torso.position.y = 1.24;
  group.add(torso);

  // Pauldrons
  for (const side of [-1, 1]) {
    const pauldron = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.22, 0.3), trimMat);
    pauldron.position.set(side * 0.42, 1.54, 0);
    group.add(pauldron);
  }

  // Helmet + Visor
  const helmet = new THREE.Mesh(new THREE.DodecahedronGeometry(0.24, 0), trimMat);
  helmet.position.y = 1.88;
  group.add(helmet);

  const visor = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.09, 0.14), glowMat);
  visor.position.set(0, 1.9, 0.18);
  group.add(visor);

  // Back Cape / Wing Fins
  const cape = new THREE.Mesh(new THREE.BoxGeometry(0.54, 0.9, 0.06), armorMat);
  cape.position.set(0, 1.18, -0.26);
  cape.rotation.x = 0.14;
  group.add(cape);

  // Held Light Rifle
  const rifle = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.14, 0.72), trimMat);
  rifle.position.set(0.36, 1.24, 0.34);
  group.add(rifle);

  // Orbiting Density Halo
  const halo = new THREE.Mesh(new THREE.TorusGeometry(0.42, 0.03, 8, 24), glowMat);
  halo.position.y = 2.34;
  halo.rotation.x = Math.PI / 2.4;
  halo.name = 'agent_halo';
  group.add(halo);

  group.traverse((obj) => {
    if ((obj as THREE.Mesh).isMesh && obj !== shadow) {
      obj.castShadow = true;
      obj.receiveShadow = true;
    }
  });

  return group;
}

/**
 * Composite 6–9 part 3D Empire Structure (Civilization / EVE Online Citadel, Mining Rig,
 * Research Spire, Defense Turret) pivoted at bottom-center on Y=0.
 */
export function buildEmpireStructureModel(
  type: StructureType,
  accentColor: number,
  stoneTex: THREE.Texture
): THREE.Group {
  const group = new THREE.Group();

  const hullMat = new THREE.MeshStandardMaterial({
    map: stoneTex,
    color: 0x334155,
    metalness: 0.72,
    roughness: 0.34,
  });
  const armorMat = new THREE.MeshStandardMaterial({
    color: 0x1e293b,
    metalness: 0.85,
    roughness: 0.24,
  });
  const accentMat = new THREE.MeshStandardMaterial({
    color: accentColor,
    emissive: accentColor,
    emissiveIntensity: 1.8,
    metalness: 0.3,
    roughness: 0.16,
  });

  if (type === 'citadel') {
    // 1. Hexagonal Citadel Foundation
    const foundation = new THREE.Mesh(new THREE.CylinderGeometry(3.4, 4.1, 0.75, 6), hullMat);
    foundation.position.y = 0.38;
    group.add(foundation);

    // 2. Central Armored Tower
    const tower = new THREE.Mesh(new THREE.CylinderGeometry(1.15, 1.85, 7.6, 6), armorMat);
    tower.position.y = 4.4;
    group.add(tower);

    // 3. 3 Swept Docking Buttresses (EVE Keepstar / Astrahus silhouette)
    for (let i = 0; i < 3; i++) {
      const a = (i / 3) * Math.PI * 2;
      const strut = new THREE.Mesh(new THREE.BoxGeometry(0.65, 5.2, 1.9), hullMat);
      strut.position.set(Math.cos(a) * 2.1, 3.2, Math.sin(a) * 2.1);
      strut.rotation.y = -a + Math.PI / 2;
      strut.rotation.x = 0.18;
      group.add(strut);
    }

    // 4. Upper Command Deck Ring
    const deck = new THREE.Mesh(new THREE.CylinderGeometry(2.5, 1.9, 0.7, 6), hullMat);
    deck.position.y = 7.4;
    group.add(deck);

    // 5. Rotating Sovereignty Halo
    const halo = new THREE.Mesh(new THREE.TorusGeometry(2.9, 0.1, 8, 28), accentMat);
    halo.position.y = 8.4;
    halo.rotation.x = Math.PI / 2.2;
    halo.name = 'structure_spin';
    group.add(halo);

    // 6. Glowing Faction Crown Spire
    const crown = new THREE.Mesh(new THREE.OctahedronGeometry(0.95, 0), accentMat);
    crown.position.y = 9.6;
    crown.name = 'structure_bob';
    group.add(crown);
  } else if (type === 'mining_rig') {
    // 1. Base Extractor Pad
    const pad = new THREE.Mesh(new THREE.CylinderGeometry(2.4, 2.7, 0.4, 8), armorMat);
    pad.position.y = 0.2;
    group.add(pad);

    // 2. 3 Industrial Gantry Legs
    for (let i = 0; i < 3; i++) {
      const a = (i / 3) * Math.PI * 2;
      const leg = new THREE.Mesh(new THREE.BoxGeometry(0.4, 4.8, 0.55), hullMat);
      leg.position.set(Math.cos(a) * 1.55, 2.5, Math.sin(a) * 1.55);
      leg.rotation.y = -a;
      leg.rotation.z = 0.24;
      group.add(leg);
    }

    // 3. Drill Housing Crown
    const head = new THREE.Mesh(new THREE.CylinderGeometry(1.3, 1.1, 1.2, 8), armorMat);
    head.position.y = 4.9;
    group.add(head);

    // 4. Spinning Extractor Collar
    const collar = new THREE.Mesh(new THREE.TorusGeometry(1.45, 0.12, 8, 20), accentMat);
    collar.position.y = 3.2;
    collar.rotation.x = Math.PI / 2;
    collar.name = 'structure_spin';
    group.add(collar);

    // 5. Glowing Laser Extraction Beam Cone
    const beam = new THREE.Mesh(
      new THREE.CylinderGeometry(0.18, 0.55, 4.2, 10),
      new THREE.MeshBasicMaterial({
        color: accentColor,
        transparent: true,
        opacity: 0.6,
      })
    );
    beam.position.y = 2.3;
    group.add(beam);
  } else if (type === 'research_spire') {
    // 1. Stepped Plinth
    const plinth = new THREE.Mesh(new THREE.CylinderGeometry(2.2, 2.6, 0.5, 8), hullMat);
    plinth.position.y = 0.25;
    group.add(plinth);

    // 2. Tapered White-Slate Science Obelisk
    const obelisk = new THREE.Mesh(
      new THREE.CylinderGeometry(0.35, 1.25, 6.4, 6),
      new THREE.MeshStandardMaterial({ color: 0xcbd5e1, metalness: 0.4, roughness: 0.35 })
    );
    obelisk.position.y = 3.6;
    group.add(obelisk);

    // 3. Twin Orbital Gyroscope Rings
    const ring1 = new THREE.Mesh(new THREE.TorusGeometry(1.75, 0.08, 8, 24), accentMat);
    ring1.position.y = 5.4;
    ring1.rotation.x = Math.PI / 3;
    ring1.name = 'structure_spin';
    group.add(ring1);

    const ring2 = new THREE.Mesh(new THREE.TorusGeometry(1.3, 0.06, 8, 24), armorMat);
    ring2.position.y = 5.4;
    ring2.rotation.y = Math.PI / 2;
    ring2.name = 'structure_spin_alt';
    group.add(ring2);

    // 4. Floating Wisdom Crystal
    const prism = new THREE.Mesh(new THREE.IcosahedronGeometry(0.65, 0), accentMat);
    prism.position.y = 7.3;
    prism.name = 'structure_bob';
    group.add(prism);
  } else {
    // Defense Turret Battery
    const base = new THREE.Mesh(new THREE.CylinderGeometry(1.4, 1.8, 0.7, 8), armorMat);
    base.position.y = 0.35;
    group.add(base);

    const pedestal = new THREE.Mesh(new THREE.CylinderGeometry(0.75, 0.95, 1.5, 8), hullMat);
    pedestal.position.y = 1.4;
    group.add(pedestal);

    const turretHead = new THREE.Group();
    turretHead.position.y = 2.45;
    turretHead.name = 'turret_head';

    const housing = new THREE.Mesh(new THREE.BoxGeometry(1.25, 0.75, 1.5), armorMat);
    turretHead.add(housing);

    for (const side of [-0.34, 0.34]) {
      const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.13, 1.85, 8), hullMat);
      barrel.rotation.x = Math.PI / 2;
      barrel.position.set(side, 0.05, 1.25);
      turretHead.add(barrel);
    }

    const sensor = new THREE.Mesh(new THREE.SphereGeometry(0.24, 10, 10), accentMat);
    sensor.position.set(0, 0.45, 0.25);
    turretHead.add(sensor);

    group.add(turretHead);
  }

  group.traverse((obj) => {
    if ((obj as THREE.Mesh).isMesh) {
      obj.castShadow = true;
      obj.receiveShadow = true;
    }
  });

  return group;
}

/**
 * Composite 7-part EVE Online style Hovering Escort Frigate Drone.
 */
export function buildEscortFrigateModel(accentColor: number): THREE.Group {
  const group = new THREE.Group();

  const hullMat = new THREE.MeshStandardMaterial({
    color: 0x334155,
    metalness: 0.84,
    roughness: 0.24,
  });
  const trimMat = new THREE.MeshStandardMaterial({
    color: 0xe2e8f0,
    metalness: 0.7,
    roughness: 0.3,
  });
  const glowMat = new THREE.MeshStandardMaterial({
    color: accentColor,
    emissive: accentColor,
    emissiveIntensity: 2.2,
    roughness: 0.12,
  });

  // 1. Sleek Main Fuselage
  const nose = new THREE.Mesh(new THREE.ConeGeometry(0.38, 1.85, 5), hullMat);
  nose.rotation.x = Math.PI / 2;
  nose.position.z = 0.25;
  group.add(nose);

  // 2. Aft Engineering Block
  const aft = new THREE.Mesh(new THREE.BoxGeometry(0.68, 0.36, 0.85), trimMat);
  aft.position.z = -0.65;
  group.add(aft);

  // 3. Swept Port & Starboard Wing Fins
  for (const side of [-1, 1]) {
    const wing = new THREE.Mesh(new THREE.BoxGeometry(1.1, 0.08, 0.55), hullMat);
    wing.position.set(side * 0.72, -0.02, -0.35);
    wing.rotation.y = side * -0.32;
    wing.rotation.z = side * -0.1;
    group.add(wing);

    // 4. Twin Engine Nacelles
    const engine = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.14, 0.52, 8), glowMat);
    engine.rotation.x = Math.PI / 2;
    engine.position.set(side * 0.42, 0, -1.05);
    group.add(engine);
  }

  // 5. Illuminated Bridge Canopy
  const bridge = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.18, 0.52), glowMat);
  bridge.position.set(0, 0.22, -0.15);
  group.add(bridge);

  return group;
}


