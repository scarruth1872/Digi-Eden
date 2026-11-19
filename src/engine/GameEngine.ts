import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import {
  AgentActionType,
  CameraMode,
  DensityLevel,
  EmpireStructure,
  EnemyArchetype,
  FactionId,
  FloatingDamage,
  GamePhase,
  InteractionTarget,
  SectorState,
} from '../types/game';
import { createInitialAgents, LOCATIONS, NPCS, WEAPONS, WORLD_OBJECTS } from '../data/worldData';
import {
  buildAgentGuardianModel,
  buildEmpireStructureModel,
  buildEnemyModel,
  buildEscortFrigateModel,
  buildNpcModel,
  buildSubLogosBeacon,
  buildTreeGroup,
  buildWeaponViewmodel,
  buildWorldObjectModel,
  createContactShadowTexture,
  createProceduralTerrainTexture,
  createSoftGlowTexture,
  createStoneTexture,
  groundHeightAt,
} from './proceduralAssets';
import { soundEngine } from '../audio/soundEngine';

// Pre-allocated scratch math helpers (zero GC in render loop)
const _v1 = new THREE.Vector3();
const _v2 = new THREE.Vector3();
const _v3 = new THREE.Vector3();
const _forward = new THREE.Vector3();
const _right = new THREE.Vector3();
const _projVec = new THREE.Vector3();
const _colTarget = new THREE.Color();
const _colFog3 = new THREE.Color(0x0c192c);
const _colFog4 = new THREE.Color(0x16122e);
const _colFog5 = new THREE.Color(0x1e2438);
const _colSky3 = new THREE.Color(0x162b46);
const _colSky4 = new THREE.Color(0x1b143b);
const _colSky5 = new THREE.Color(0x283149);

interface ActiveEnemy {
  id: string;
  name: string;
  archetype: EnemyArchetype;
  group: THREE.Group;
  coreMat: THREE.MeshStandardMaterial;
  bodyMat: THREE.MeshStandardMaterial;
  telegraphRing: THREE.Mesh;
  hp: number;
  maxHp: number;
  damage: number;
  speed: number;
  homePos: THREE.Vector3;
  patrolRadius: number;
  attackCooldown: number;
  windupTimer: number;
  isWindingUp: boolean;
  hitFlashTimer: number;
  respawnTimer: number;
  alive: boolean;
  xpReward: number;
  loveReward: number;
}

interface Projectile {
  active: boolean;
  fromPlayer: boolean;
  mesh: THREE.Mesh;
  pos: THREE.Vector3;
  vel: THREE.Vector3;
  damage: number;
  life: number;
  isCritPotential: boolean;
}

interface Particle {
  active: boolean;
  mesh: THREE.Sprite;
  pos: THREE.Vector3;
  vel: THREE.Vector3;
  life: number;
  maxLife: number;
  startScale: number;
}

interface ActiveAgent {
  id: string;
  name: string;
  group: THREE.Group;
  pos: THREE.Vector3;
  yaw: number;
  action: AgentActionType;
  targetId: string;
  targetPos: THREE.Vector3;
  density: DensityLevel;
  accentColor: number;
  fireCooldown: number;
  meditateBob: number;
  patrolAngle: number;
}

interface ActiveStructure {
  id: string;
  def: EmpireStructure;
  group: THREE.Group;
  colorInt: number;
  fireCooldown: number;
}

interface ActiveFrigate {
  factionId: FactionId;
  mesh: THREE.Group;
  orbitIndex: number;
  orbitSpeed: number;
  orbitRadius: number;
  heightOffset: number;
  colorInt: number;
  fireCooldown: number;
}

export interface EngineCallbacks {
  onPhaseChange?: (phase: GamePhase) => void;
  onPlayerDamaged: (amount: number) => void;
  onEnemyHit: (damage: number, isCrit: boolean, defeated: boolean, enemyName: string, archetype: EnemyArchetype, xp: number, love: number) => void;
  onLocationChanged: (locationId: string, locationName: string) => void;
  onInteractTargetChanged: (target: InteractionTarget | null) => void;
  onInteract: (target: InteractionTarget) => void;
  onActionKey: (action: 'heal' | 'super' | 'density3' | 'density4' | 'density5' | 'cycleWeapon' | 'codex' | 'pause' | 'agents' | 'spectateCycle' | 'orbitalCam' | 'empire') => void;
  onFloatingDamage: (items: FloatingDamage[]) => void;
  onPlayerPosition: (pos: [number, number, number], yaw: number) => void;
  onPointerLockChange: (locked: boolean) => void;
  onDashUsed: () => boolean; // returns true if allowed
  onAgentsSync?: (agents: Array<{ id: string; position: [number, number, number]; locationId: string; locationName: string }>) => void;
}

export class GameEngine {
  private container: HTMLElement;
  private callbacks: EngineCallbacks;
  private renderer: THREE.WebGLRenderer;
  private scene: THREE.Scene;
  private camera: THREE.PerspectiveCamera;
  private isSoftwareGl: boolean;
  private frameId = 0;
  private disposed = false;

  private phase: GamePhase = 'title';
  private density: DensityLevel = 3;
  private currentWeaponId = 'lumen_pulse';
  private weaponGroup: THREE.Group | null = null;
  private weaponModels: Record<string, THREE.Group> = {};
  private weaponRecoil = 0;
  private fireCooldown = 0;

  // Lighting
  private keyLight!: THREE.DirectionalLight;
  private hemiLight!: THREE.HemisphereLight;
  private fog!: THREE.FogExp2;
  private beaconGroup!: THREE.Group;

  // Player kinematics
  private playerPos = new THREE.Vector3(0, 0, 14);
  private playerVel = new THREE.Vector3();
  private playerYaw = 0;
  private playerPitch = 0;
  private isGrounded = true;
  private coyoteTimer = 0;
  private jumpBufferTimer = 0;
  private dashTimer = 0;
  private dashCooldown = 0;
  private hitstopTimer = 0;
  private shakeIntensity = 0;
  private walkBobTime = 0;

  // Input state
  private heldKeys = new Set<string>();
  private mouseDown = false;
  private draggingLook = false;
  private lastPointerX = 0;
  private lastPointerY = 0;
  private pointerLocked = false;

  // Entities & Pools
  private enemies: ActiveEnemy[] = [];
  private agents: Map<string, ActiveAgent> = new Map();
  private spectateAgentId: string | null = null;
  private cameraMode: CameraMode = 'fps';
  private orbitalAngle = 0.45;
  private orbitalCamPos = new THREE.Vector3(0, 68, 52);
  private spectateCamPos = new THREE.Vector3();
  private spectateLookPos = new THREE.Vector3();
  private agentSyncTimer = 0;
  private npcMeshes: Map<string, THREE.Group> = new Map();
  private objectMeshes: Map<string, THREE.Group> = new Map();
  private sectorRings: Map<string, THREE.Mesh> = new Map();
  private structureMeshes: Map<string, ActiveStructure> = new Map();
  private warpLanesGroup = new THREE.Group();
  private fleetDrones: ActiveFrigate[] = [];
  private stoneTexture!: THREE.Texture;
  private projectiles: Projectile[] = [];
  private particles: Particle[] = [];
  private floatingDamages: FloatingDamage[] = [];
  private nextDmgId = 1;
  private currentLocationId = 'starting_area';
  private currentInteractTarget: InteractionTarget | null = null;
  private lastTime = performance.now();
  private elapsed = 0;
  private positionReportTimer = 0;
  private glowTexture!: THREE.Texture;
  private shadowTexture!: THREE.Texture;
  private densityMotes!: THREE.Points;

  constructor(container: HTMLElement, callbacks: EngineCallbacks) {
    this.container = container;
    this.callbacks = callbacks;

    // Detect software WebGL
    this.isSoftwareGl = (() => {
      const gl = document.createElement('canvas').getContext('webgl2');
      if (!gl) return true;
      const ext = gl.getExtension('WEBGL_debug_renderer_info');
      const param = ext ? ext.UNMASKED_RENDERER_WEBGL : gl.RENDERER;
      const gpu = String(gl.getParameter(param));
      gl.getExtension('WEBGL_lose_context')?.loseContext();
      return /SwiftShader|llvmpipe|softpipe|Software|Basic Render/i.test(gpu);
    })();

    this.renderer = new THREE.WebGLRenderer({
      antialias: !this.isSoftwareGl,
      powerPreference: 'high-performance',
    });
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.12;
    this.renderer.setPixelRatio(this.isSoftwareGl ? 1 : Math.min(window.devicePixelRatio, 2));
    this.renderer.setSize(container.clientWidth || window.innerWidth, container.clientHeight || window.innerHeight);
    this.renderer.shadowMap.enabled = !this.isSoftwareGl;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.domElement.style.display = 'block';
    this.renderer.domElement.style.width = '100%';
    this.renderer.domElement.style.height = '100%';
    container.appendChild(this.renderer.domElement);

    this.scene = new THREE.Scene();
    this.scene.background = _colSky3.clone();
    this.fog = new THREE.FogExp2(_colFog3.getHex(), 0.0085);
    this.scene.fog = this.fog;

    const aspect = (container.clientWidth || window.innerWidth) / (container.clientHeight || window.innerHeight);
    this.camera = new THREE.PerspectiveCamera(72, aspect, 0.1, 280);
    this.camera.rotation.order = 'YXZ';
    this.scene.add(this.camera);

    // Mandatory studio environment map on every device
    const pmremGenerator = new THREE.PMREMGenerator(this.renderer);
    this.scene.environment = pmremGenerator.fromScene(new RoomEnvironment(), 0.04).texture;
    pmremGenerator.dispose();

    this.glowTexture = createSoftGlowTexture();
    this.shadowTexture = createContactShadowTexture();

    this.setupLighting();
    this.buildWorld();
    this.setupWeapons();
    this.spawnEnemies();
    this.spawnAgents();
    this.setupPools();
    this.bindEvents();

    // Place player grounded at Sanctuary Meadow
    this.playerPos.set(0, groundHeightAt(0, 14), 14);

    if (!this.isSoftwareGl) {
      this.renderer.compile(this.scene, this.camera);
    }

    this.lastTime = performance.now();
    this.tick();
  }

  private setupLighting() {
    this.hemiLight = new THREE.HemisphereLight(0x93c5fd, 0x1e293b, 0.72);
    this.scene.add(this.hemiLight);

    this.keyLight = new THREE.DirectionalLight(0xfff1d6, 1.85);
    this.keyLight.position.set(42, 68, 34);
    this.keyLight.castShadow = !this.isSoftwareGl;
    this.keyLight.shadow.mapSize.set(1024, 1024);
    this.keyLight.shadow.camera.near = 5;
    this.keyLight.shadow.camera.far = 160;
    const d = 65;
    this.keyLight.shadow.camera.left = -d;
    this.keyLight.shadow.camera.right = d;
    this.keyLight.shadow.camera.top = d;
    this.keyLight.shadow.camera.bottom = -d;
    this.keyLight.shadow.bias = -0.0005;
    this.keyLight.shadow.normalBias = 0.02;
    this.scene.add(this.keyLight);

    const rimLight = new THREE.DirectionalLight(0x60a5fa, 0.55);
    rimLight.position.set(-45, 30, -55);
    this.scene.add(rimLight);
  }

  private buildWorld() {
    const maxAniso = this.renderer.capabilities.getMaxAnisotropy();
    const terrainTex = createProceduralTerrainTexture(maxAniso);
    const stoneTex = createStoneTexture(maxAniso);
    this.stoneTexture = stoneTex;

    // 1. Undulating Natural Terrain (260x260 extending past playable rim)
    const size = 260;
    const segs = 128;
    const terrainGeo = new THREE.PlaneGeometry(size, size, segs, segs);
    terrainGeo.rotateX(-Math.PI / 2);

    const pos = terrainGeo.attributes.position;
    const colors = new Float32Array(pos.count * 3);
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i);
      const z = pos.getZ(i);
      const y = groundHeightAt(x, z);
      pos.setY(i, y);

      // Biome tinting
      const dRift = Math.hypot(x - 56, z + 42);
      const dForest = Math.hypot(x + 55, z + 38);
      const dGrove = Math.hypot(x, z + 82);

      let r = 0.72, g = 0.88, b = 0.74; // Meadow
      if (dRift < 38) {
        const t = 1 - dRift / 38;
        r = THREE.MathUtils.lerp(r, 0.45, t);
        g = THREE.MathUtils.lerp(g, 0.66, t);
        b = THREE.MathUtils.lerp(b, 0.98, t);
      } else if (dForest < 40) {
        const t = 1 - dForest / 40;
        r = THREE.MathUtils.lerp(r, 0.48, t);
        g = THREE.MathUtils.lerp(g, 0.72, t);
        b = THREE.MathUtils.lerp(b, 0.52, t);
      } else if (dGrove < 32) {
        const t = 1 - dGrove / 32;
        r = THREE.MathUtils.lerp(r, 0.92, t);
        g = THREE.MathUtils.lerp(g, 0.85, t);
        b = THREE.MathUtils.lerp(b, 0.65, t);
      }
      if (y > 4.5) {
        r *= 0.7; g *= 0.74; b *= 0.85;
      }
      colors[i * 3] = r;
      colors[i * 3 + 1] = g;
      colors[i * 3 + 2] = b;
    }
    terrainGeo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    terrainGeo.computeVertexNormals();

    const terrainMat = new THREE.MeshStandardMaterial({
      map: terrainTex,
      vertexColors: true,
      roughness: 0.86,
      metalness: 0.04,
    });
    const terrain = new THREE.Mesh(terrainGeo, terrainMat);
    terrain.receiveShadow = true;
    this.scene.add(terrain);

    // 2. Central Sub-Logos Beacon
    this.beaconGroup = buildSubLogosBeacon(stoneTex);
    this.beaconGroup.position.set(0, groundHeightAt(0, -14), -14);
    this.scene.add(this.beaconGroup);

    // 3. Natural Forest of Whispers Pine Trees (Composite Hero Trees + Instanced Pine Canopy/Trunks)
    for (let i = 0; i < 24; i++) {
      const angle = (i / 24) * Math.PI * 2 + (i % 3) * 0.25;
      const dist = 12 + (i % 5) * 6.2;
      const tx = -55 + Math.cos(angle) * dist;
      const tz = -38 + Math.sin(angle) * dist;
      const tree = buildTreeGroup(0.85 + (i % 4) * 0.22);
      tree.position.set(tx, groundHeightAt(tx, tz) - 0.1, tz);
      this.scene.add(tree);
    }

    // Perimeter trees framing horizon naturally
    const pineTrunkGeo = new THREE.CylinderGeometry(0.32, 0.55, 4.5, 6);
    const pineCrownGeo = new THREE.ConeGeometry(2.4, 6.2, 7);
    const trunkMat = new THREE.MeshStandardMaterial({ color: 0x3e2723, roughness: 0.9 });
    const crownMat = new THREE.MeshStandardMaterial({ color: 0x1b4d3e, roughness: 0.8 });

    const rimTreeCount = 85;
    const instTrunks = new THREE.InstancedMesh(pineTrunkGeo, trunkMat, rimTreeCount);
    const instCrowns = new THREE.InstancedMesh(pineCrownGeo, crownMat, rimTreeCount);
    const dummy = new THREE.Object3D();
    const tint = new THREE.Color();

    for (let i = 0; i < rimTreeCount; i++) {
      const a = (i / rimTreeCount) * Math.PI * 2;
      const rad = 92 + (i % 4) * 5.5;
      const x = Math.cos(a) * rad;
      const z = Math.sin(a) * rad;
      const y = groundHeightAt(x, z);
      const s = 0.85 + (i % 5) * 0.14;

      dummy.position.set(x, y + 2.1 * s, z);
      dummy.scale.set(s, s, s);
      dummy.rotation.y = a;
      dummy.updateMatrix();
      instTrunks.setMatrixAt(i, dummy.matrix);

      dummy.position.set(x, y + 6.2 * s, z);
      dummy.updateMatrix();
      instCrowns.setMatrixAt(i, dummy.matrix);

      tint.setHSL(0.38 + (i % 5) * 0.015, 0.45, 0.26 + (i % 3) * 0.04);
      instCrowns.setColorAt(i, tint);
    }
    instTrunks.instanceMatrix.needsUpdate = true;
    instCrowns.instanceMatrix.needsUpdate = true;
    if (instCrowns.instanceColor) instCrowns.instanceColor.needsUpdate = true;
    instTrunks.computeBoundingSphere();
    instCrowns.computeBoundingSphere();
    this.scene.add(instTrunks, instCrowns);

    // 4. Instanced Crystalline Rift Formations
    const crystalGeo = new THREE.ConeGeometry(0.95, 5.4, 5);
    const crystalMat = new THREE.MeshStandardMaterial({
      color: 0x38bdf8,
      emissive: 0x0284c7,
      emissiveIntensity: 0.45,
      roughness: 0.18,
      metalness: 0.35,
    });
    const crystalCount = 28;
    const instCrystals = new THREE.InstancedMesh(crystalGeo, crystalMat, crystalCount);
    for (let i = 0; i < crystalCount; i++) {
      const a = (i / crystalCount) * Math.PI * 2;
      const r = 10 + (i % 5) * 5.2;
      const x = 56 + Math.cos(a) * r;
      const z = -42 + Math.sin(a) * r;
      const y = groundHeightAt(x, z);
      const s = 0.7 + (i % 4) * 0.32;
      dummy.position.set(x, y + 2.0 * s, z);
      dummy.rotation.set(Math.sin(i) * 0.22, a, Math.cos(i) * 0.22);
      dummy.scale.set(s, s, s);
      dummy.updateMatrix();
      instCrystals.setMatrixAt(i, dummy.matrix);
      tint.setHSL(0.54 + (i % 4) * 0.04, 0.85, 0.62);
      instCrystals.setColorAt(i, tint);
    }
    instCrystals.instanceMatrix.needsUpdate = true;
    if (instCrystals.instanceColor) instCrystals.instanceColor.needsUpdate = true;
    instCrystals.computeBoundingSphere();
    this.scene.add(instCrystals);

    // 5. Hidden Grove Stone Archway Pillars
    const pillarMat = new THREE.MeshStandardMaterial({ map: stoneTex, color: 0xcbd5e1, roughness: 0.6, metalness: 0.2 });
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2;
      const x = Math.cos(a) * 16;
      const z = -82 + Math.sin(a) * 16;
      const y = groundHeightAt(x, z);
      const pillar = new THREE.Mesh(new THREE.CylinderGeometry(0.55, 0.72, 5.2, 8), pillarMat);
      pillar.position.set(x, y + 2.5, z);
      pillar.castShadow = true;
      pillar.receiveShadow = true;
      this.scene.add(pillar);
    }

    // 6. Place NPCs
    for (const npc of NPCS) {
      const model = buildNpcModel(npc.primaryColor, npc.accentColor, this.shadowTexture);
      const [nx, nz] = npc.position;
      model.position.set(nx, groundHeightAt(nx, nz), nz);
      // Face toward player's initial direction / center
      model.lookAt(0, model.position.y, 0);
      this.scene.add(model);
      this.npcMeshes.set(npc.id, model);
    }

    // 7. Place Interactive World Objects
    for (const obj of WORLD_OBJECTS) {
      const model = buildWorldObjectModel(obj.kind, stoneTex, this.isSoftwareGl);
      const [ox, oz] = obj.position;
      model.position.set(ox, groundHeightAt(ox, oz), oz);
      this.scene.add(model);
      this.objectMeshes.set(obj.id, model);
    }

    // 8. Atmospheric Floating Higher-Density Motes
    const moteCount = 320;
    const motePos = new Float32Array(moteCount * 3);
    for (let i = 0; i < moteCount; i++) {
      const a = Math.random() * Math.PI * 2;
      const r = Math.random() * 95;
      const mx = Math.cos(a) * r;
      const mz = Math.sin(a) * r - 25;
      motePos[i * 3] = mx;
      motePos[i * 3 + 1] = groundHeightAt(mx, mz) + 1.2 + Math.random() * 14;
      motePos[i * 3 + 2] = mz;
    }
    const moteGeo = new THREE.BufferGeometry();
    moteGeo.setAttribute('position', new THREE.BufferAttribute(motePos, 3));
    const moteMat = new THREE.PointsMaterial({
      color: 0x7dd3fc,
      map: this.glowTexture,
      size: 0.45,
      transparent: true,
      opacity: 0.65,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });
    this.densityMotes = new THREE.Points(moteGeo, moteMat);
    this.scene.add(this.densityMotes);

    // 9. Civilization Sector Sovereignty Rings & EVE Warp Lane Group
    for (const loc of LOCATIONS) {
      const ringGeo = new THREE.RingGeometry(loc.radius - 1.15, loc.radius, 48);
      const ringMat = new THREE.MeshBasicMaterial({
        color: 0x64748b,
        side: THREE.DoubleSide,
        transparent: true,
        opacity: 0.42,
        depthWrite: false,
        polygonOffset: true,
        polygonOffsetFactor: -1,
        polygonOffsetUnits: -1,
      });
      const ring = new THREE.Mesh(ringGeo, ringMat);
      ring.rotation.x = -Math.PI / 2;
      ring.position.set(loc.center[0], groundHeightAt(loc.center[0], loc.center[1]) + 0.32, loc.center[1]);
      this.scene.add(ring);
      this.sectorRings.set(loc.id, ring);
    }
    this.scene.add(this.warpLanesGroup);
  }

  private setupWeapons() {
    for (const [id, def] of Object.entries(WEAPONS)) {
      const vm = buildWeaponViewmodel(def.archetype, def.color);
      vm.position.set(0.26, -0.22, -0.42);
      vm.visible = id === this.currentWeaponId;
      this.camera.add(vm);
      this.weaponModels[id] = vm;
    }
    this.weaponGroup = this.weaponModels[this.currentWeaponId];
  }

  private spawnEnemies() {
    const configs: Array<{
      id: string;
      name: string;
      archetype: EnemyArchetype;
      pos: [number, number];
      hp: number;
      dmg: number;
      speed: number;
      xp: number;
      love: number;
    }> = [
      // Forest of Whispers patrols
      { id: 'scout_1', name: 'Fallen Dusk-Scout', archetype: EnemyArchetype.FALLEN_SCOUT, pos: [-45, -24], hp: 90, dmg: 10, speed: 5.5, xp: 45, love: 15 },
      { id: 'scout_2', name: 'Fallen Dusk-Scout', archetype: EnemyArchetype.FALLEN_SCOUT, pos: [-62, -32], hp: 90, dmg: 10, speed: 5.8, xp: 45, love: 15 },
      { id: 'scout_3', name: 'Fallen Dusk-Scout', archetype: EnemyArchetype.FALLEN_SCOUT, pos: [-54, -52], hp: 95, dmg: 11, speed: 5.8, xp: 45, love: 15 },
      { id: 'brute_1', name: 'Orion Brute', archetype: EnemyArchetype.ORION_BRUTE, pos: [-66, -44], hp: 180, dmg: 18, speed: 4.2, xp: 85, love: 25 },
      // Crystalline Rift patrols & Boss
      { id: 'scout_4', name: 'Fallen Dusk-Scout', archetype: EnemyArchetype.FALLEN_SCOUT, pos: [42, -26], hp: 105, dmg: 12, speed: 5.6, xp: 50, love: 15 },
      { id: 'brute_2', name: 'Orion Brute', archetype: EnemyArchetype.ORION_BRUTE, pos: [62, -30], hp: 190, dmg: 19, speed: 4.4, xp: 90, love: 25 },
      { id: 'guardian_boss', name: 'Crystal Guardian', archetype: EnemyArchetype.CRYSTAL_GUARDIAN, pos: [59, -48], hp: 420, dmg: 22, speed: 3.4, xp: 240, love: 45 },
      // Perimeter Meadow skirmisher
      { id: 'scout_5', name: 'Fallen Dusk-Scout', archetype: EnemyArchetype.FALLEN_SCOUT, pos: [-22, -22], hp: 80, dmg: 9, speed: 5.0, xp: 40, love: 12 },
    ];

    for (const c of configs) {
      const built = buildEnemyModel(c.archetype, this.shadowTexture);
      const y = groundHeightAt(c.pos[0], c.pos[1]);
      built.group.position.set(c.pos[0], y, c.pos[1]);
      this.scene.add(built.group);

      this.enemies.push({
        id: c.id,
        name: c.name,
        archetype: c.archetype,
        group: built.group,
        coreMat: built.coreMat,
        bodyMat: built.bodyMat,
        telegraphRing: built.telegraphRing,
        hp: c.hp,
        maxHp: c.hp,
        damage: c.dmg,
        speed: c.speed,
        homePos: new THREE.Vector3(c.pos[0], y, c.pos[1]),
        patrolRadius: 14,
        attackCooldown: 1.5 + Math.random(),
        windupTimer: 0,
        isWindingUp: false,
        hitFlashTimer: 0,
        respawnTimer: 0,
        alive: true,
        xpReward: c.xp,
        loveReward: c.love,
      });
    }
  }

  private spawnAgents() {
    const initial = createInitialAgents();
    for (const a of initial) {
      const group = buildAgentGuardianModel(a.primaryColor, a.accentColor, this.shadowTexture);
      const y = groundHeightAt(a.position[0], a.position[2]);
      group.position.set(a.position[0], y, a.position[2]);
      this.scene.add(group);
      this.agents.set(a.id, {
        id: a.id,
        name: a.name,
        group,
        pos: new THREE.Vector3(a.position[0], y, a.position[2]),
        yaw: 0,
        action: a.currentAction,
        targetId: a.targetId,
        targetPos: new THREE.Vector3(a.position[0], y, a.position[2]),
        density: a.density,
        accentColor: a.accentColor,
        fireCooldown: 0.8,
        meditateBob: Math.random() * Math.PI * 2,
        patrolAngle: Math.random() * Math.PI * 2,
      });
    }
  }

  private setupPools() {
    const boltGeo = new THREE.SphereGeometry(0.14, 8, 8);
    for (let i = 0; i < 48; i++) {
      const mat = new THREE.MeshBasicMaterial({ color: 0x38bdf8 });
      const mesh = new THREE.Mesh(boltGeo, mat);
      mesh.visible = false;
      this.scene.add(mesh);
      this.projectiles.push({
        active: false,
        fromPlayer: true,
        mesh,
        pos: new THREE.Vector3(),
        vel: new THREE.Vector3(),
        damage: 20,
        life: 0,
        isCritPotential: true,
      });
    }

    for (let i = 0; i < 90; i++) {
      const mat = new THREE.SpriteMaterial({
        map: this.glowTexture,
        color: 0xffffff,
        transparent: true,
        opacity: 0,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      });
      const sprite = new THREE.Sprite(mat);
      sprite.visible = false;
      this.scene.add(sprite);
      this.particles.push({
        active: false,
        mesh: sprite,
        pos: new THREE.Vector3(),
        vel: new THREE.Vector3(),
        life: 0,
        maxLife: 0.4,
        startScale: 0.5,
      });
    }
  }

  private bindEvents() {
    window.addEventListener('resize', this.handleResize);
    window.addEventListener('keydown', this.handleKeyDown);
    window.addEventListener('keyup', this.handleKeyUp);
    window.addEventListener('blur', this.handleBlur);
    document.addEventListener('pointerlockchange', this.handlePointerLockChange);

    const canvas = this.renderer.domElement;
    canvas.addEventListener('mousedown', this.handleMouseDown);
    window.addEventListener('mouseup', this.handleMouseUp);
    window.addEventListener('mousemove', this.handleMouseMove);
  }

  private handleResize = () => {
    if (this.disposed) return;
    const w = this.container.clientWidth || window.innerWidth;
    const h = this.container.clientHeight || window.innerHeight;
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(w, h);
  };

  private handleBlur = () => {
    this.heldKeys.clear();
    this.mouseDown = false;
    this.draggingLook = false;
  };

  private handlePointerLockChange = () => {
    this.pointerLocked = document.pointerLockElement === this.renderer.domElement;
    this.callbacks.onPointerLockChange(this.pointerLocked);
  };

  private handleKeyDown = (e: KeyboardEvent) => {
    if (this.phase === 'title') {
      if (e.code === 'Enter' || e.code === 'Space') {
        // Handled by TitleScreen UI button / listener
      }
      return;
    }

    if (e.code === 'Escape') {
      this.callbacks.onActionKey('pause');
      return;
    }
    if (e.code === 'Tab') {
      e.preventDefault();
      this.callbacks.onActionKey('codex');
      return;
    }

    const targetTag = (e.target as HTMLElement | null)?.tagName;
    if (targetTag === 'INPUT' || targetTag === 'TEXTAREA' || targetTag === 'SELECT') {
      return;
    }

    if (this.phase !== 'playing') return;

    this.heldKeys.add(e.code);

    if (e.code === 'Space') {
      this.jumpBufferTimer = 0.14;
    } else if (e.code === 'ShiftLeft' || e.code === 'ShiftRight') {
      this.tryDash();
    } else if (e.code === 'KeyE') {
      if (this.currentInteractTarget) {
        this.callbacks.onInteract(this.currentInteractTarget);
      }
    } else if (e.code === 'KeyQ') {
      this.callbacks.onActionKey('heal');
    } else if (e.code === 'KeyF') {
      this.callbacks.onActionKey('super');
    } else if (e.code === 'Digit1') {
      this.callbacks.onActionKey('density3');
    } else if (e.code === 'Digit2') {
      this.callbacks.onActionKey('density4');
    } else if (e.code === 'Digit3') {
      this.callbacks.onActionKey('density5');
    } else if (e.code === 'KeyR') {
      this.callbacks.onActionKey('cycleWeapon');
    } else if (e.code === 'KeyG') {
      this.callbacks.onActionKey('agents');
    } else if (e.code === 'KeyV') {
      this.callbacks.onActionKey('spectateCycle');
    } else if (e.code === 'KeyC') {
      this.callbacks.onActionKey('orbitalCam');
    } else if (e.code === 'KeyM') {
      this.callbacks.onActionKey('empire');
    }
  };

  private handleKeyUp = (e: KeyboardEvent) => {
    this.heldKeys.delete(e.code);
  };

  private handleMouseDown = (e: MouseEvent) => {
    if (this.phase !== 'playing') return;
    if (e.button === 0) {
      this.draggingLook = true;
      this.lastPointerX = e.clientX;
      this.lastPointerY = e.clientY;
      if (this.cameraMode === 'fps') {
        this.mouseDown = true;
        if (!this.pointerLocked && this.renderer.domElement.requestPointerLock) {
          try {
            this.renderer.domElement.requestPointerLock();
          } catch {
            // Fallback to drag-aiming silently if pointer lock is disallowed
          }
        }
      }
    }
  };

  private handleMouseUp = () => {
    this.mouseDown = false;
    this.draggingLook = false;
  };

  private handleMouseMove = (e: MouseEvent) => {
    if (this.phase !== 'playing') return;
    if (this.cameraMode === 'orbital') {
      if (this.draggingLook) {
        const dx = e.clientX - this.lastPointerX;
        this.lastPointerX = e.clientX;
        this.lastPointerY = e.clientY;
        this.orbitalAngle -= dx * 0.0055;
      }
      return;
    }
    if (this.pointerLocked) {
      this.playerYaw -= e.movementX * 0.0022;
      this.playerPitch = THREE.MathUtils.clamp(
        this.playerPitch - e.movementY * 0.0022,
        -1.32,
        1.32
      );
    } else if (this.draggingLook) {
      const dx = e.clientX - this.lastPointerX;
      const dy = e.clientY - this.lastPointerY;
      this.lastPointerX = e.clientX;
      this.lastPointerY = e.clientY;
      this.playerYaw -= dx * 0.004;
      this.playerPitch = THREE.MathUtils.clamp(this.playerPitch - dy * 0.004, -1.32, 1.32);
    }
  };

  public setPhase(phase: GamePhase) {
    this.phase = phase;
    this.heldKeys.clear();
    this.mouseDown = false;
    this.draggingLook = false;
    if (phase !== 'playing' && document.pointerLockElement === this.renderer.domElement) {
      document.exitPointerLock?.();
    }
    if (this.weaponGroup) {
      this.weaponGroup.visible = phase === 'playing' && this.cameraMode === 'fps';
    }
  }

  public setCameraMode(mode: CameraMode, spectateAgentId: string | null = null) {
    this.cameraMode = mode;
    this.spectateAgentId = mode === 'spectate' ? spectateAgentId : null;
    if (this.weaponGroup) {
      this.weaponGroup.visible = this.phase === 'playing' && this.cameraMode === 'fps';
    }
    if (mode !== 'fps') {
      this.mouseDown = false;
      if (document.pointerLockElement === this.renderer.domElement) {
        document.exitPointerLock?.();
      }
    }
    if (mode === 'spectate' && spectateAgentId) {
      const ag = this.agents.get(spectateAgentId);
      if (ag) {
        this.spectateCamPos.copy(this.camera.position);
        this.spectateLookPos.copy(ag.pos).add(_v1.set(0, 1.5, 0));
      }
    } else if (mode === 'orbital') {
      this.orbitalCamPos.copy(this.camera.position);
    }
  }

  public setSpectateAgentId(agentId: string | null) {
    this.setCameraMode(agentId ? 'spectate' : 'fps', agentId);
  }

  public syncEmpireVisuals(
    sectors: SectorState[],
    structures: EmpireStructure[],
    factionColors: Record<FactionId, number>,
    factionFleets: Record<FactionId, number>
  ) {
    // 1. Update Sector Sovereignty Ring Colors
    for (const sec of sectors) {
      const ring = this.sectorRings.get(sec.id);
      if (!ring) continue;
      const mat = ring.material as THREE.MeshBasicMaterial;
      if (sec.ownerId) {
        mat.color.setHex(factionColors[sec.ownerId]);
        mat.opacity = 0.52;
      } else {
        mat.color.setHex(0x64748b);
        mat.opacity = 0.25;
      }
    }

    // 2. Rebuild Warp / Trade Lane Arcs between owned sectors
    while (this.warpLanesGroup.children.length > 0) {
      const child = this.warpLanesGroup.children[0] as THREE.Line;
      this.warpLanesGroup.remove(child);
      child.geometry.dispose();
      (child.material as THREE.Material).dispose();
    }
    const ownedSectors = sectors.filter((s) => s.ownerId !== null);
    for (let i = 0; i < ownedSectors.length; i++) {
      for (let j = i + 1; j < ownedSectors.length; j++) {
        const a = ownedSectors[i];
        const b = ownedSectors[j];
        const start = new THREE.Vector3(a.center[0], groundHeightAt(a.center[0], a.center[1]) + 7.5, a.center[1]);
        const end = new THREE.Vector3(b.center[0], groundHeightAt(b.center[0], b.center[1]) + 7.5, b.center[1]);
        const mid = start.clone().lerp(end, 0.5);
        mid.y += 18;
        const curve = new THREE.QuadraticBezierCurve3(start, mid, end);
        const pts = curve.getPoints(24);
        const laneGeo = new THREE.BufferGeometry().setFromPoints(pts);
        const sameOwner = a.ownerId === b.ownerId;
        const laneColor = sameOwner && a.ownerId ? factionColors[a.ownerId] : 0x38bdf8;
        const laneMat = new THREE.LineBasicMaterial({
          color: laneColor,
          transparent: true,
          opacity: sameOwner ? 0.65 : 0.3,
        });
        this.warpLanesGroup.add(new THREE.Line(laneGeo, laneMat));
      }
    }

    // 3. Sync 3D Empire Structures (add newly constructed ones, remove destroyed/reset ones)
    const activeIds = new Set(structures.map((s) => s.id));
    for (const [id, entry] of this.structureMeshes.entries()) {
      if (!activeIds.has(id)) {
        this.scene.remove(entry.group);
        entry.group.traverse((obj) => {
          const m = obj as THREE.Mesh;
          if (m.geometry) m.geometry.dispose();
          if (m.material) {
            if (Array.isArray(m.material)) m.material.forEach((mm) => mm.dispose());
            else m.material.dispose();
          }
        });
        this.structureMeshes.delete(id);
      }
    }

    for (const s of structures) {
      if (!this.structureMeshes.has(s.id)) {
        const colorInt = factionColors[s.ownerId];
        const model = buildEmpireStructureModel(s.type, colorInt, this.stoneTexture);
        const y = groundHeightAt(s.position[0], s.position[1]);
        model.position.set(s.position[0], y, s.position[1]);
        this.scene.add(model);
        this.spawnBurst(new THREE.Vector3(s.position[0], y + 3.0, s.position[1]), colorInt, 20, 8);
        this.structureMeshes.set(s.id, {
          id: s.id,
          def: s,
          group: model,
          colorInt,
          fireCooldown: 1.0,
        });
      }
    }

    // 4. Sync EVE Escort Frigate Fleet Drones (up to 5 visible per faction)
    const desiredCountByFaction: Record<FactionId, number> = {
      player: Math.min(5, Math.max(0, factionFleets.player)),
      lyra: Math.min(5, Math.max(0, factionFleets.lyra)),
      kael: Math.min(5, Math.max(0, factionFleets.kael)),
      soren: Math.min(5, Math.max(0, factionFleets.soren)),
    };

    const factions: FactionId[] = ['player', 'lyra', 'kael', 'soren'];
    for (const fid of factions) {
      const current = this.fleetDrones.filter((f) => f.factionId === fid);
      const targetCount = desiredCountByFaction[fid];
      if (current.length < targetCount) {
        for (let k = current.length; k < targetCount; k++) {
          const colorInt = factionColors[fid];
          const mesh = buildEscortFrigateModel(colorInt);
          this.scene.add(mesh);
          this.fleetDrones.push({
            factionId: fid,
            mesh,
            orbitIndex: k,
            orbitSpeed: 0.45 + (k % 3) * 0.14,
            orbitRadius: 9 + (k % 3) * 4.5,
            heightOffset: 7.5 + (k % 4) * 2.2,
            colorInt,
            fireCooldown: 1.2 + Math.random(),
          });
        }
      } else if (current.length > targetCount) {
        const toRemove = current.slice(targetCount);
        for (const rem of toRemove) {
          this.scene.remove(rem.mesh);
          this.fleetDrones = this.fleetDrones.filter((f) => f !== rem);
        }
      }
    }
  }

  public getAgentWorldContext(agentId: string) {
    const ag = this.agents.get(agentId);
    if (!ag) return null;

    const nearbyEnemies = this.enemies
      .filter((e) => e.alive && e.group.position.distanceTo(ag.pos) < 42)
      .map((e) => ({
        id: e.id,
        name: e.name,
        hp: Math.round(e.hp),
        distance: Math.round(e.group.position.distanceTo(ag.pos)),
      }))
      .sort((a, b) => a.distance - b.distance)
      .slice(0, 4);

    const nearbyNpcs = NPCS.map((n) => {
      const d = Math.hypot(n.position[0] - ag.pos.x, n.position[1] - ag.pos.z);
      return { id: n.id, name: n.name, distance: Math.round(d) };
    })
      .filter((n) => n.distance < 36)
      .sort((a, b) => a.distance - b.distance);

    const nearbyObjects = WORLD_OBJECTS.map((o) => {
      const d = Math.hypot(o.position[0] - ag.pos.x, o.position[1] - ag.pos.z);
      return { id: o.id, name: o.name, distance: Math.round(d) };
    })
      .filter((o) => o.distance < 36)
      .sort((a, b) => a.distance - b.distance);

    const distToPlayer = Math.round(ag.pos.distanceTo(this.playerPos));
    return {
      nearbyEnemies,
      nearbyNpcs,
      nearbyObjects,
      distToPlayer,
    };
  }

  public applyAgentDecision(
    agentId: string,
    action: AgentActionType,
    targetId: string,
    targetDensity: DensityLevel
  ): string {
    const ag = this.agents.get(agentId);
    if (!ag) return '';
    ag.action = action;
    ag.targetId = targetId;

    let label = targetId;

    if (action === 'SHIFT_DENSITY') {
      ag.density = targetDensity;
      const col = targetDensity === 3 ? 0x7dd3fc : targetDensity === 4 ? 0xc084fc : 0xfbbf24;
      this.spawnBurst(ag.pos.clone().add(_v1.set(0, 1.4, 0)), col, 16, 6);
      label = `${targetDensity}th Density`;
    } else if (action === 'MEDITATE') {
      this.spawnBurst(ag.pos.clone().add(_v1.set(0, 1.2, 0)), ag.accentColor, 14, 4);
      label = 'Inner Reflection';
    } else if (action === 'HEAL_ALLY') {
      this.spawnBurst(ag.pos.clone().add(_v1.set(0, 1.2, 0)), 0x34d399, 20, 7);
      this.spawnBurst(this.playerPos.clone().add(_v1.set(0, 1.2, 0)), 0x34d399, 14, 5);
      label = 'Player Guardian';
    } else if (
      action === 'MOVE_TO_REGION' ||
      action === 'CLAIM_SECTOR' ||
      action === 'BUILD_STRUCTURE' ||
      action === 'MINE_RESOURCES'
    ) {
      const loc = LOCATIONS.find((l) => l.id === targetId) || LOCATIONS[0];
      const offsetAngle = ag.patrolAngle;
      const tx = loc.center[0] + Math.cos(offsetAngle) * 8;
      const tz = loc.center[1] + Math.sin(offsetAngle) * 8;
      ag.targetPos.set(tx, groundHeightAt(tx, tz), tz);
      this.spawnBurst(ag.pos.clone().add(_v1.set(0, 1.5, 0)), ag.accentColor, 14, 6);
      label = loc.name;
    } else if (action === 'MARKET_TRADE' || action === 'BUILD_FLEET' || action === 'RESEARCH_TECH' || action === 'DIPLOMACY') {
      this.spawnBurst(ag.pos.clone().add(_v1.set(0, 1.8, 0)), ag.accentColor, 12, 5);
      label = targetId || action;
    } else if (action === 'SPEAK_TO_NPC') {
      const npc = NPCS.find((n) => n.id === targetId);
      if (npc) {
        ag.targetPos.set(npc.position[0] + 2.5, groundHeightAt(npc.position[0] + 2.5, npc.position[1]), npc.position[1]);
        label = npc.name;
      }
    } else if (action === 'INSPECT_OBJECT') {
      const obj = WORLD_OBJECTS.find((o) => o.id === targetId);
      if (obj) {
        ag.targetPos.set(obj.position[0] + 2.5, groundHeightAt(obj.position[0] + 2.5, obj.position[1]), obj.position[1]);
        label = obj.name;
      }
    } else if (action === 'ENGAGE_ENEMY') {
      const enemy = this.enemies.find((e) => e.id === targetId && e.alive) || this.enemies.find((e) => e.alive);
      if (enemy) {
        ag.targetId = enemy.id;
        label = enemy.name;
      }
    }

    return label || action;
  }

  public setDensity(density: DensityLevel) {
    this.density = density;
    soundEngine.playDensityShift(density);
    this.spawnBurst(this.playerPos.clone().add(new THREE.Vector3(0, 1.2, 0)),
      density === 3 ? 0x7dd3fc : density === 4 ? 0xc084fc : 0xfbbf24,
      18,
      6.5
    );
  }

  public setEquippedWeapon(weaponId: string) {
    if (!WEAPONS[weaponId]) return;
    this.currentWeaponId = weaponId;
    for (const [id, model] of Object.entries(this.weaponModels)) {
      model.visible = id === weaponId && this.phase === 'playing' && this.cameraMode === 'fps';
    }
    this.weaponGroup = this.weaponModels[weaponId];
  }

  public triggerHealEffect() {
    soundEngine.playLoveHeal();
    const origin = this.playerPos.clone().add(new THREE.Vector3(0, 1.0, 0));
    this.spawnBurst(origin, 0x34d399, 22, 5.5);
  }

  public triggerSuperNova(bonusDamage = 180) {
    soundEngine.playSuperNova();
    this.shakeIntensity = 0.42;
    this.hitstopTimer = 0.055;
    const origin = this.playerPos.clone().add(new THREE.Vector3(0, 1.4, 0));
    this.spawnBurst(origin, 0xfbbf24, 34, 14);

    // AoE radial light damage around player
    for (const enemy of this.enemies) {
      if (!enemy.alive) continue;
      const dist = enemy.group.position.distanceTo(this.playerPos);
      if (dist < 18) {
        this.damageEnemy(enemy, bonusDamage, true);
      }
    }
  }

  public teleportToLocation(locationId: string) {
    const loc = LOCATIONS.find((l) => l.id === locationId);
    if (!loc) return;
    const [cx, cz] = loc.center;
    const spawnZ = cz + 12;
    this.playerPos.set(cx, groundHeightAt(cx, spawnZ), spawnZ);
    this.playerVel.set(0, 0, 0);
    this.playerYaw = 0;
  }

  public setPlayerTransform(pos: [number, number, number], yaw: number) {
    this.playerPos.set(pos[0], pos[1], pos[2]);
    this.playerYaw = yaw;
    this.playerVel.set(0, 0, 0);
  }

  public markObjectCollected(objectId: string) {
    const mesh = this.objectMeshes.get(objectId);
    if (mesh) {
      const glow = mesh.getObjectByName('collectible_glow');
      if (glow) glow.visible = false;
    }
  }

  private tryDash() {
    if (this.dashCooldown > 0) return;
    if (!this.callbacks.onDashUsed()) return;
    this.dashTimer = 0.18;
    this.dashCooldown = 1.35;
    soundEngine.playDash();
    this.shakeIntensity = Math.max(this.shakeIntensity, 0.08);
  }

  private spawnBurst(origin: THREE.Vector3, colorHex: number, count: number, speed: number) {
    let spawned = 0;
    for (const p of this.particles) {
      if (!p.active) {
        p.active = true;
        p.pos.copy(origin);
        p.vel.set(
          (Math.random() - 0.5) * speed * 2,
          Math.random() * speed * 1.2,
          (Math.random() - 0.5) * speed * 2
        );
        p.maxLife = 0.35 + Math.random() * 0.35;
        p.life = p.maxLife;
        p.startScale = 0.45 + Math.random() * 0.55;
        p.mesh.material.color.setHex(colorHex);
        p.mesh.material.opacity = 1;
        p.mesh.position.copy(origin);
        p.mesh.scale.setScalar(p.startScale);
        p.mesh.visible = true;
        spawned++;
        if (spawned >= count) break;
      }
    }
  }

  private fireWeapon() {
    const def = WEAPONS[this.currentWeaponId];
    if (!def) return;
    this.fireCooldown = 1 / def.fireRate;
    this.weaponRecoil = def.archetype === 'cannon' ? 0.16 : 0.07;
    this.shakeIntensity = Math.max(this.shakeIntensity, def.archetype === 'cannon' ? 0.07 : 0.025);
    soundEngine.playFire(def.archetype);

    const proj = this.projectiles.find((p) => !p.active);
    if (!proj) return;

    proj.active = true;
    proj.fromPlayer = true;
    const densityMult = def.densityBonus && def.densityBonus === this.density ? 1.35 : 1.0;
    proj.damage = Math.round(def.damage * densityMult);
    proj.life = 1.6;
    proj.isCritPotential = true;
    (proj.mesh.material as THREE.MeshBasicMaterial).color.setHex(def.color);

    _forward.set(0, 0, -1).applyQuaternion(this.camera.quaternion);
    _forward.x += (Math.random() - 0.5) * def.spread;
    _forward.y += (Math.random() - 0.5) * def.spread;
    _forward.z += (Math.random() - 0.5) * def.spread;
    _forward.normalize();

    proj.pos.copy(this.camera.position).addScaledVector(_forward, 0.85);
    proj.vel.copy(_forward).multiplyScalar(def.projectileSpeed);
    proj.mesh.position.copy(proj.pos);
    proj.mesh.scale.setScalar(def.archetype === 'cannon' ? 1.35 : 0.9);
    proj.mesh.visible = true;
  }

  private fireEnemyProjectile(enemy: ActiveEnemy) {
    const proj = this.projectiles.find((p) => !p.active);
    if (!proj) return;
    proj.active = true;
    proj.fromPlayer = false;
    proj.damage = enemy.damage;
    proj.life = 2.4;
    (proj.mesh.material as THREE.MeshBasicMaterial).color.setHex(
      enemy.archetype === EnemyArchetype.CRYSTAL_GUARDIAN ? 0xd946ef : 0xf97316
    );

    const startY = enemy.archetype === EnemyArchetype.CRYSTAL_GUARDIAN ? 2.5 : 1.45;
    proj.pos.copy(enemy.group.position).add(_v1.set(0, startY, 0));

    _v2.copy(this.playerPos).add(_v1.set(0, 1.35, 0)).sub(proj.pos).normalize();
    proj.vel.copy(_v2).multiplyScalar(enemy.archetype === EnemyArchetype.CRYSTAL_GUARDIAN ? 32 : 26);
    proj.mesh.position.copy(proj.pos);
    proj.mesh.scale.setScalar(1.45);
    proj.mesh.visible = true;
  }

  private damageEnemy(enemy: ActiveEnemy, amount: number, isCrit: boolean) {
    if (!enemy.alive) return;
    enemy.hp -= amount;
    enemy.hitFlashTimer = 0.1;
    soundEngine.playHit(isCrit);

    // Project floating damage
    _projVec.copy(enemy.group.position).add(_v1.set(0, 2.2, 0)).project(this.camera);
    if (_projVec.z < 1) {
      this.floatingDamages.push({
        id: this.nextDmgId++,
        x: (_projVec.x + 1) * 0.5,
        y: (-_projVec.y + 1) * 0.5,
        amount,
        isCrit,
        age: 0,
      });
    }

    const burstPos = enemy.group.position.clone().add(_v1.set(0, 1.4, 0));
    this.spawnBurst(burstPos, isCrit ? 0xfbbf24 : 0x38bdf8, isCrit ? 12 : 6, 6);

    const defeated = enemy.hp <= 0;
    if (defeated) {
      enemy.alive = false;
      enemy.group.visible = false;
      enemy.respawnTimer = enemy.archetype === EnemyArchetype.CRYSTAL_GUARDIAN ? 35 : 18;
      this.hitstopTimer = 0.048;
      this.shakeIntensity = Math.max(this.shakeIntensity, 0.22);
      soundEngine.playEnemyDefeat();
      this.spawnBurst(burstPos, 0xa855f7, 22, 9.5);
    } else if (isCrit) {
      this.hitstopTimer = Math.max(this.hitstopTimer, 0.025);
    }

    this.callbacks.onEnemyHit(
      amount,
      isCrit,
      defeated,
      enemy.name,
      enemy.archetype,
      enemy.xpReward,
      enemy.loveReward
    );
  }

  private tick = () => {
    if (this.disposed) return;

    const now = performance.now();
    const rawDt = (now - this.lastTime) / 1000;
    this.lastTime = now;
    const dt = Math.min(rawDt, 0.05);

    this.update(dt);
    this.renderer.render(this.scene, this.camera);

    if (this.isSoftwareGl) {
      this.afterDraw(this.tick);
    } else {
      this.frameId = requestAnimationFrame(this.tick);
    }
  };

  private afterDraw(cb: () => void) {
    const gl = this.renderer.getContext() as WebGL2RenderingContext;
    if (!gl || typeof gl.fenceSync !== 'function') {
      this.frameId = window.setTimeout(cb, 80);
      return;
    }
    const sync = gl.fenceSync(gl.SYNC_GPU_COMMANDS_COMPLETE, 0);
    gl.flush();
    const poll = () => {
      if (this.disposed) return;
      const state = sync && gl.getSyncParameter(sync, gl.SYNC_STATUS);
      if (state === gl.UNSIGNALED) {
        this.frameId = window.setTimeout(poll, 5);
      } else {
        if (sync) gl.deleteSync(sync);
        this.frameId = window.setTimeout(cb, 80);
      }
    };
    this.frameId = window.setTimeout(poll, 5);
  }

  private update(dt: number) {
    this.elapsed += dt;

    // Hitstop freeze frame for heavy impacts
    if (this.hitstopTimer > 0) {
      this.hitstopTimer -= dt;
      this.updateAtmosphere(dt);
      return;
    }

    this.updateAtmosphere(dt);
    this.animateWorldProps(dt);

    if (this.phase === 'title') {
      // Sweeping atmospheric orbit around Sanctuary Meadow & Sub-Logos Beacon
      const angle = this.elapsed * 0.14;
      const camX = Math.sin(angle) * 28;
      const camZ = -14 + Math.cos(angle) * 28;
      const camY = groundHeightAt(camX, camZ) + 9.5;
      this.camera.position.set(camX, camY, camZ);
      this.camera.lookAt(0, 6.2, -14);
      return;
    }

    if (this.phase !== 'playing') {
      return;
    }

    this.updatePlayerMovement(dt);
    this.updateWeapon(dt);
    this.updateAgents(dt);
    this.updateEmpireStructuresAndFleets(dt);
    this.updateEnemies(dt);
    this.updateProjectiles(dt);
    this.updateParticles(dt);
    this.updateFloatingDamage(dt);
    this.checkLocationAndInteraction();

    this.positionReportTimer += dt;
    if (this.positionReportTimer > 0.4) {
      this.positionReportTimer = 0;
      this.callbacks.onPlayerPosition(
        [this.playerPos.x, this.playerPos.y, this.playerPos.z],
        this.playerYaw
      );
    }

    this.agentSyncTimer += dt;
    if (this.agentSyncTimer > 0.5 && this.callbacks.onAgentsSync) {
      this.agentSyncTimer = 0;
      const synced: Array<{ id: string; position: [number, number, number]; locationId: string; locationName: string }> = [];
      for (const ag of this.agents.values()) {
        let closestLoc = LOCATIONS[0];
        let bestDist = Infinity;
        for (const loc of LOCATIONS) {
          const d = Math.hypot(ag.pos.x - loc.center[0], ag.pos.z - loc.center[1]);
          if (d < bestDist) {
            bestDist = d;
            closestLoc = loc;
          }
        }
        synced.push({
          id: ag.id,
          position: [ag.pos.x, ag.pos.y, ag.pos.z],
          locationId: closestLoc.id,
          locationName: closestLoc.name,
        });
      }
      this.callbacks.onAgentsSync(synced);
    }
  }

  private updateAtmosphere(dt: number) {
    const targetFog = this.density === 3 ? _colFog3 : this.density === 4 ? _colFog4 : _colFog5;
    const targetSky = this.density === 3 ? _colSky3 : this.density === 4 ? _colSky4 : _colSky5;
    this.fog.color.lerp(targetFog, 1 - Math.exp(-3.5 * dt));
    (this.scene.background as THREE.Color).lerp(targetSky, 1 - Math.exp(-3.5 * dt));

    const targetFov = this.dashTimer > 0 ? 84 : 72;
    this.camera.fov = THREE.MathUtils.damp(this.camera.fov, targetFov, 10, dt);
    this.camera.updateProjectionMatrix();

    // Update mote tint by density
    const moteMat = this.densityMotes.material as THREE.PointsMaterial;
    _colTarget.setHex(this.density === 3 ? 0x7dd3fc : this.density === 4 ? 0xc084fc : 0xfbbf24);
    moteMat.color.lerp(_colTarget, 1 - Math.exp(-4 * dt));
    this.densityMotes.rotation.y += dt * 0.012;
  }

  private animateWorldProps(dt: number) {
    if (this.beaconGroup) {
      const core = this.beaconGroup.getObjectByName('beacon_core');
      const r1 = this.beaconGroup.getObjectByName('beacon_ring_1');
      const r2 = this.beaconGroup.getObjectByName('beacon_ring_2');
      if (core) {
        core.rotation.y += dt * 0.7;
        core.position.y = 7.4 + Math.sin(this.elapsed * 1.6) * 0.35;
      }
      if (r1) r1.rotation.x += dt * 0.55;
      if (r2) r2.rotation.z += dt * 0.42;
    }

    for (const npcMesh of this.npcMeshes.values()) {
      const halo = npcMesh.getObjectByName('npc_halo');
      if (halo) {
        halo.rotation.z += dt * 0.85;
        halo.position.y = 2.32 + Math.sin(this.elapsed * 2.2) * 0.06;
      }
    }

    for (const objMesh of this.objectMeshes.values()) {
      const glow = objMesh.getObjectByName('collectible_glow');
      if (glow) {
        glow.rotation.y += dt * 1.4;
      }
      const altarCore = objMesh.getObjectByName('altar_core');
      if (altarCore) {
        altarCore.rotation.y += dt * 1.1;
        altarCore.rotation.x += dt * 0.6;
      }
    }
  }

  private updatePlayerMovement(dt: number) {
    // Allow Q/E-free arrow turning as backup
    if (this.heldKeys.has('ArrowLeft')) this.playerYaw += 1.9 * dt;
    if (this.heldKeys.has('ArrowRight')) this.playerYaw -= 1.9 * dt;

    const moveZ = (this.heldKeys.has('KeyW') || this.heldKeys.has('ArrowUp') ? 1 : 0) -
                  (this.heldKeys.has('KeyS') || this.heldKeys.has('ArrowDown') ? 1 : 0);
    const moveX = (this.heldKeys.has('KeyD') ? 1 : 0) - (this.heldKeys.has('KeyA') ? 1 : 0);

    _forward.set(-Math.sin(this.playerYaw), 0, -Math.cos(this.playerYaw));
    _right.set(Math.cos(this.playerYaw), 0, -Math.sin(this.playerYaw));

    _v1.set(0, 0, 0);
    _v1.addScaledVector(_forward, moveZ);
    _v1.addScaledVector(_right, moveX);
    if (_v1.lengthSq() > 0) _v1.normalize();

    if (this.dashCooldown > 0) this.dashCooldown -= dt;
    if (this.dashTimer > 0) this.dashTimer -= dt;

    const speed = this.dashTimer > 0 ? 32 : this.density === 5 ? 14.5 : 12.2;
    const targetVx = _v1.x * speed;
    const targetVz = _v1.z * speed;

    this.playerVel.x = THREE.MathUtils.damp(this.playerVel.x, targetVx, 14, dt);
    this.playerVel.z = THREE.MathUtils.damp(this.playerVel.z, targetVz, 14, dt);

    // Coyote time & jump buffer
    if (this.isGrounded) this.coyoteTimer = 0.12;
    else this.coyoteTimer -= dt;

    if (this.jumpBufferTimer > 0) this.jumpBufferTimer -= dt;

    if (this.jumpBufferTimer > 0 && this.coyoteTimer > 0) {
      this.playerVel.y = 9.4;
      this.isGrounded = false;
      this.coyoteTimer = 0;
      this.jumpBufferTimer = 0;
    }

    // Gravity (4th/5th density gives slightly lighter Destiny-style glide)
    const gravity = this.density >= 4 && this.playerVel.y < 0 ? 15 : 22;
    this.playerVel.y -= gravity * dt;

    this.playerPos.addScaledVector(this.playerVel, dt);

    // Keep inside natural valley perimeter (radius 102)
    const r = Math.hypot(this.playerPos.x, this.playerPos.z);
    if (r > 102) {
      const scale = 102 / r;
      this.playerPos.x *= scale;
      this.playerPos.z *= scale;
    }

    const groundY = groundHeightAt(this.playerPos.x, this.playerPos.z);
    if (this.playerPos.y <= groundY) {
      this.playerPos.y = groundY;
      this.playerVel.y = 0;
      this.isGrounded = true;
    } else {
      this.isGrounded = false;
    }

    // Walk bob & camera shake
    const horizSpeed = Math.hypot(this.playerVel.x, this.playerVel.z);
    if (this.isGrounded && horizSpeed > 1) {
      this.walkBobTime += dt * horizSpeed * 0.85;
    }
    const bobOffset = this.isGrounded ? Math.sin(this.walkBobTime) * 0.045 * Math.min(horizSpeed / 10, 1) : 0;

    this.shakeIntensity = THREE.MathUtils.damp(this.shakeIntensity, 0, 12, dt);
    const sx = (Math.random() - 0.5) * this.shakeIntensity;
    const sy = (Math.random() - 0.5) * this.shakeIntensity;

    if (this.cameraMode === 'orbital') {
      if (this.heldKeys.has('KeyA') || this.heldKeys.has('ArrowLeft')) this.orbitalAngle -= 0.9 * dt;
      if (this.heldKeys.has('KeyD') || this.heldKeys.has('ArrowRight')) this.orbitalAngle += 0.9 * dt;
      else if (!this.draggingLook) this.orbitalAngle += 0.045 * dt;

      const radius = 84;
      const targetX = Math.sin(this.orbitalAngle) * radius;
      const targetZ = -38 + Math.cos(this.orbitalAngle) * radius;
      _v1.set(targetX, 66, targetZ);
      this.orbitalCamPos.lerp(_v1, 1 - Math.exp(-4.5 * dt));
      this.camera.position.copy(this.orbitalCamPos);
      this.camera.lookAt(0, 2.5, -38);
      return;
    }

    if (this.cameraMode === 'spectate' && this.spectateAgentId) {
      const ag = this.agents.get(this.spectateAgentId);
      if (ag) {
        // Smooth third-person chase camera behind spectated agent
        const camBackX = -Math.sin(ag.yaw) * 6.5;
        const camBackZ = -Math.cos(ag.yaw) * 6.5;
        _v1.set(ag.pos.x + camBackX, ag.pos.y + 3.6, ag.pos.z + camBackZ);
        this.spectateCamPos.lerp(_v1, 1 - Math.exp(-5.5 * dt));
        _v2.set(ag.pos.x, ag.pos.y + 1.55, ag.pos.z);
        this.spectateLookPos.lerp(_v2, 1 - Math.exp(-7 * dt));
        this.camera.position.copy(this.spectateCamPos);
        this.camera.lookAt(this.spectateLookPos);
        return;
      }
    }

    this.camera.position.set(
      this.playerPos.x + sx,
      this.playerPos.y + 1.72 + bobOffset + sy,
      this.playerPos.z
    );
    this.camera.rotation.set(this.playerPitch, this.playerYaw, 0);
  }

  private updateAgents(dt: number) {
    for (const ag of this.agents.values()) {
      const halo = ag.group.getObjectByName('agent_halo');
      if (halo) {
        halo.rotation.z += dt * 1.4;
      }

      if (ag.fireCooldown > 0) ag.fireCooldown -= dt;

      if (ag.action === 'MEDITATE') {
        ag.meditateBob += dt * 2.2;
        const baseGround = groundHeightAt(ag.pos.x, ag.pos.z);
        ag.pos.y = baseGround + 0.45 + Math.sin(ag.meditateBob) * 0.22;
        ag.group.position.copy(ag.pos);
        ag.group.rotation.y += dt * 0.35;
        continue;
      }

      if (ag.action === 'ENGAGE_ENEMY') {
        const enemy =
          this.enemies.find((e) => e.id === ag.targetId && e.alive) ||
          this.enemies.find((e) => e.alive && e.group.position.distanceTo(ag.pos) < 38);

        if (enemy) {
          const dist = enemy.group.position.distanceTo(ag.pos);
          _v1.copy(enemy.group.position).sub(ag.pos);
          _v1.y = 0;
          if (_v1.lengthSq() > 0.01) {
            ag.yaw = Math.atan2(_v1.x, _v1.z);
          }

          if (dist > 14) {
            _v1.normalize();
            ag.pos.addScaledVector(_v1, 8.2 * dt);
          } else if (dist < 8) {
            _v1.normalize();
            ag.pos.addScaledVector(_v1, -5.0 * dt);
          }

          ag.pos.y = groundHeightAt(ag.pos.x, ag.pos.z);
          ag.group.position.copy(ag.pos);
          ag.group.rotation.y = ag.yaw;

          if (dist < 28 && ag.fireCooldown <= 0) {
            ag.fireCooldown = 0.65;
            this.fireAgentProjectile(ag, enemy);
          }
          continue;
        } else {
          ag.action = 'PATROL';
        }
      }

      if (ag.action === 'HEAL_ALLY') {
        _v1.copy(this.playerPos).sub(ag.pos);
        _v1.y = 0;
        const d = _v1.length();
        if (d > 4.5) {
          _v1.normalize();
          ag.yaw = Math.atan2(_v1.x, _v1.z);
          ag.pos.addScaledVector(_v1, 8.8 * dt);
        }
        ag.pos.y = groundHeightAt(ag.pos.x, ag.pos.z);
        ag.group.position.copy(ag.pos);
        ag.group.rotation.y = ag.yaw;
        continue;
      }

      if (ag.action === 'PATROL') {
        ag.patrolAngle += dt * 0.45;
        const loc = LOCATIONS.find((l) => l.id === ag.targetId) || LOCATIONS[0];
        const tx = loc.center[0] + Math.cos(ag.patrolAngle) * 11;
        const tz = loc.center[1] + Math.sin(ag.patrolAngle) * 11;
        ag.targetPos.set(tx, groundHeightAt(tx, tz), tz);
      }

      // Steer smoothly toward targetPos
      _v1.copy(ag.targetPos).sub(ag.pos);
      _v1.y = 0;
      const dist = _v1.length();
      if (dist > 1.2) {
        _v1.normalize();
        ag.yaw = Math.atan2(_v1.x, _v1.z);
        ag.pos.addScaledVector(_v1, 7.6 * dt);
      }
      ag.pos.y = groundHeightAt(ag.pos.x, ag.pos.z);
      ag.group.position.copy(ag.pos);
      ag.group.rotation.y = ag.yaw;
    }
  }

  private fireSupportProjectile(origin: THREE.Vector3, enemy: ActiveEnemy, colorInt: number, damage: number) {
    const proj = this.projectiles.find((p) => !p.active);
    if (!proj) return;
    proj.active = true;
    proj.fromPlayer = true;
    proj.damage = damage;
    proj.life = 1.4;
    proj.isCritPotential = false;
    (proj.mesh.material as THREE.MeshBasicMaterial).color.setHex(colorInt);

    proj.pos.copy(origin);
    const targetY = enemy.archetype === EnemyArchetype.CRYSTAL_GUARDIAN ? 2.4 : 1.3;
    _v2.copy(enemy.group.position).add(_v1.set(0, targetY, 0)).sub(proj.pos).normalize();
    proj.vel.copy(_v2).multiplyScalar(72);
    proj.mesh.position.copy(proj.pos);
    proj.mesh.scale.setScalar(1.0);
    proj.mesh.visible = true;
  }

  private updateEmpireStructuresAndFleets(dt: number) {
    // Animate Citadels, Mining Rigs, Research Spires, and active Defense Turrets
    for (const s of this.structureMeshes.values()) {
      const spin = s.group.getObjectByName('structure_spin');
      if (spin) spin.rotation.z += dt * 1.1;
      const spinAlt = s.group.getObjectByName('structure_spin_alt');
      if (spinAlt) spinAlt.rotation.x -= dt * 0.9;
      const bob = s.group.getObjectByName('structure_bob');
      if (bob) {
        bob.rotation.y += dt * 1.2;
      }

      if (s.def.type === 'defense_turret') {
        if (s.fireCooldown > 0) s.fireCooldown -= dt;
        const head = s.group.getObjectByName('turret_head');
        const target = this.enemies.find(
          (e) => e.alive && e.group.position.distanceTo(s.group.position) < 34
        );
        if (target && head) {
          _v1.copy(target.group.position).sub(s.group.position);
          head.rotation.y = Math.atan2(_v1.x, _v1.z);
          if (s.fireCooldown <= 0) {
            s.fireCooldown = 0.85;
            _v3.copy(s.group.position).add(_v1.set(0, 2.6, 0));
            this.fireSupportProjectile(_v3, target, s.colorInt, 22);
          }
        }
      }
    }

    // Orbit EVE Escort Frigate Drones around their faction leader (Player or Agent)
    for (const f of this.fleetDrones) {
      let anchorX = this.playerPos.x;
      let anchorZ = this.playerPos.z;
      if (f.factionId !== 'player') {
        const ag = this.agents.get(f.factionId);
        if (ag) {
          anchorX = ag.pos.x;
          anchorZ = ag.pos.z;
        }
      }
      const angle = this.elapsed * f.orbitSpeed + f.orbitIndex * 1.45;
      const fx = anchorX + Math.cos(angle) * f.orbitRadius;
      const fz = anchorZ + Math.sin(angle) * f.orbitRadius;
      const fy = groundHeightAt(fx, fz) + f.heightOffset + Math.sin(this.elapsed * 2 + f.orbitIndex) * 0.55;
      f.mesh.position.set(fx, fy, fz);
      f.mesh.rotation.y = -angle;
      f.mesh.rotation.z = 0.16;

      if (f.fireCooldown > 0) f.fireCooldown -= dt;
      if (f.fireCooldown <= 0) {
        const enemy = this.enemies.find(
          (e) => e.alive && e.group.position.distanceTo(f.mesh.position) < 30
        );
        if (enemy) {
          f.fireCooldown = 1.15;
          this.fireSupportProjectile(f.mesh.position, enemy, f.colorInt, 14);
        }
      }
    }
  }

  private fireAgentProjectile(ag: ActiveAgent, enemy: ActiveEnemy) {
    _v3.copy(ag.pos).add(_v1.set(0, 1.35, 0));
    this.fireSupportProjectile(_v3, enemy, ag.accentColor, 18);
  }

  private updateWeapon(dt: number) {
    if (this.cameraMode !== 'fps') return;
    if (this.fireCooldown > 0) this.fireCooldown -= dt;
    if (this.mouseDown && this.fireCooldown <= 0) {
      this.fireWeapon();
    }

    this.weaponRecoil = THREE.MathUtils.damp(this.weaponRecoil, 0, 16, dt);
    if (this.weaponGroup) {
      const swayX = Math.cos(this.walkBobTime * 0.5) * 0.008;
      const swayY = Math.abs(Math.sin(this.walkBobTime * 0.5)) * 0.008;
      this.weaponGroup.position.set(0.26 + swayX, -0.22 - swayY, -0.42 + this.weaponRecoil);
      this.weaponGroup.rotation.x = this.weaponRecoil * 0.85;
    }
  }

  private updateEnemies(dt: number) {
    for (const enemy of this.enemies) {
      if (!enemy.alive) {
        enemy.respawnTimer -= dt;
        if (enemy.respawnTimer <= 0) {
          enemy.alive = true;
          enemy.hp = enemy.maxHp;
          enemy.group.position.copy(enemy.homePos);
          enemy.group.visible = true;
          enemy.isWindingUp = false;
          enemy.windupTimer = 0;
        }
        continue;
      }

      // Hit flash decay
      if (enemy.hitFlashTimer > 0) {
        enemy.hitFlashTimer -= dt;
        enemy.bodyMat.emissive.setHex(0xffffff);
        enemy.bodyMat.emissiveIntensity = 0.85;
      } else {
        enemy.bodyMat.emissive.setHex(0x000000);
        enemy.bodyMat.emissiveIntensity = 0;
      }

      // Boss animation
      if (enemy.archetype === EnemyArchetype.CRYSTAL_GUARDIAN) {
        const core = enemy.group.getObjectByName('enemy_core');
        const ring = enemy.group.getObjectByName('orbit_ring');
        if (core) core.rotation.y += dt * 1.4;
        if (ring) ring.rotation.z -= dt * 1.1;
      }

      const distToPlayer = enemy.group.position.distanceTo(this.playerPos);

      if (distToPlayer < 34) {
        // Face player
        _v1.copy(this.playerPos);
        _v1.y = enemy.group.position.y;
        enemy.group.lookAt(_v1);

        // Chase / Strafe spacing
        const preferredDist = enemy.archetype === EnemyArchetype.ORION_BRUTE ? 5.5 : 13.5;
        if (distToPlayer > preferredDist && !enemy.isWindingUp) {
          _v2.copy(this.playerPos).sub(enemy.group.position);
          _v2.y = 0;
          _v2.normalize();
          enemy.group.position.addScaledVector(_v2, enemy.speed * dt);
          enemy.group.position.y = groundHeightAt(enemy.group.position.x, enemy.group.position.z);
        }

        // Attack windup telegraph
        if (enemy.isWindingUp) {
          enemy.windupTimer -= dt;
          const pulse = 0.45 + 0.45 * Math.sin(this.elapsed * 26);
          (enemy.telegraphRing.material as THREE.MeshBasicMaterial).opacity = pulse;
          enemy.coreMat.emissiveIntensity = 4.2;

          if (enemy.windupTimer <= 0) {
            enemy.isWindingUp = false;
            (enemy.telegraphRing.material as THREE.MeshBasicMaterial).opacity = 0;
            enemy.coreMat.emissiveIntensity = 1.8;
            enemy.attackCooldown = enemy.archetype === EnemyArchetype.CRYSTAL_GUARDIAN ? 1.5 : 2.1;

            if (enemy.archetype === EnemyArchetype.ORION_BRUTE && distToPlayer < 6.5) {
              this.callbacks.onPlayerDamaged(enemy.damage);
              this.shakeIntensity = Math.max(this.shakeIntensity, 0.25);
              soundEngine.playDamageTaken();
            } else {
              this.fireEnemyProjectile(enemy);
            }
          }
        } else {
          enemy.attackCooldown -= dt;
          if (enemy.attackCooldown <= 0 && distToPlayer < 28) {
            enemy.isWindingUp = true;
            enemy.windupTimer = 0.55; // Clear windup telegraph before attack
          }
        }
      } else {
        // Gentle idle patrol
        (enemy.telegraphRing.material as THREE.MeshBasicMaterial).opacity = 0;
        enemy.isWindingUp = false;
      }
    }
  }

  private updateProjectiles(dt: number) {
    for (const p of this.projectiles) {
      if (!p.active) continue;
      p.life -= dt;
      if (p.life <= 0) {
        p.active = false;
        p.mesh.visible = false;
        continue;
      }

      p.pos.addScaledVector(p.vel, dt);
      p.mesh.position.copy(p.pos);

      // Terrain collision
      if (p.pos.y <= groundHeightAt(p.pos.x, p.pos.z)) {
        this.spawnBurst(p.pos, p.fromPlayer ? 0x38bdf8 : 0xf97316, 4, 3);
        p.active = false;
        p.mesh.visible = false;
        continue;
      }

      if (p.fromPlayer) {
        for (const enemy of this.enemies) {
          if (!enemy.alive) continue;
          const centerY = enemy.archetype === EnemyArchetype.CRYSTAL_GUARDIAN ? 2.4 : 1.25;
          const hitRadius = enemy.archetype === EnemyArchetype.CRYSTAL_GUARDIAN ? 1.9 : 1.15;
          _v1.copy(enemy.group.position).add(_v2.set(0, centerY, 0));
          const dist = p.pos.distanceTo(_v1);
          if (dist < hitRadius) {
            // Crit if hitting near head/core
            const critY = enemy.group.position.y + (enemy.archetype === EnemyArchetype.CRYSTAL_GUARDIAN ? 2.5 : 1.85);
            const isCrit = Math.abs(p.pos.y - critY) < 0.45;
            const dmg = isCrit ? Math.round(p.damage * 1.65) : p.damage;
            this.damageEnemy(enemy, dmg, isCrit);
            p.active = false;
            p.mesh.visible = false;
            break;
          }
        }
      } else {
        _v1.copy(this.playerPos).add(_v2.set(0, 1.15, 0));
        if (p.pos.distanceTo(_v1) < 1.0) {
          this.callbacks.onPlayerDamaged(p.damage);
          this.shakeIntensity = Math.max(this.shakeIntensity, 0.18);
          soundEngine.playDamageTaken();
          p.active = false;
          p.mesh.visible = false;
        }
      }
    }
  }

  private updateParticles(dt: number) {
    for (const p of this.particles) {
      if (!p.active) continue;
      p.life -= dt;
      if (p.life <= 0) {
        p.active = false;
        p.mesh.visible = false;
        continue;
      }
      p.vel.y -= 9.8 * dt;
      p.pos.addScaledVector(p.vel, dt);
      p.mesh.position.copy(p.pos);
      const t = p.life / p.maxLife;
      p.mesh.material.opacity = t;
      p.mesh.scale.setScalar(p.startScale * (0.4 + 0.6 * t));
    }
  }

  private updateFloatingDamage(dt: number) {
    if (this.floatingDamages.length === 0) return;
    for (const d of this.floatingDamages) {
      d.age += dt;
      d.y -= dt * 0.08;
    }
    this.floatingDamages = this.floatingDamages.filter((d) => d.age < 0.75);
    this.callbacks.onFloatingDamage([...this.floatingDamages]);
  }

  private checkLocationAndInteraction() {
    // Determine nearest region
    let closestLoc = LOCATIONS[0];
    let bestDist = Infinity;
    for (const loc of LOCATIONS) {
      const d = Math.hypot(this.playerPos.x - loc.center[0], this.playerPos.z - loc.center[1]);
      if (d < bestDist) {
        bestDist = d;
        closestLoc = loc;
      }
    }
    if (closestLoc.id !== this.currentLocationId) {
      this.currentLocationId = closestLoc.id;
      this.callbacks.onLocationChanged(closestLoc.id, closestLoc.name);
    }

    // Check closest interactable NPC or WorldObject within 5.5m
    let bestTarget: InteractionTarget | null = null;
    let minTargetDist = 5.5;

    for (const npc of NPCS) {
      const mesh = this.npcMeshes.get(npc.id);
      if (!mesh) continue;
      const d = mesh.position.distanceTo(this.playerPos);
      if (d < minTargetDist) {
        minTargetDist = d;
        bestTarget = {
          type: 'npc',
          id: npc.id,
          name: npc.name,
          prompt: `Speak with ${npc.name}`,
          distance: d,
        };
      }
    }

    for (const obj of WORLD_OBJECTS) {
      const mesh = this.objectMeshes.get(obj.id);
      if (!mesh) continue;
      const d = mesh.position.distanceTo(this.playerPos);
      if (d < minTargetDist) {
        minTargetDist = d;
        const locked = obj.densityRequired && this.density < obj.densityRequired ? obj.densityRequired : undefined;
        bestTarget = {
          type: 'object',
          id: obj.id,
          name: obj.name,
          prompt: obj.isHarmonizeAltar
            ? locked
              ? `Requires ${locked}th Density [Press ${locked - 1}]`
              : `Harmonize with ${obj.name}`
            : `Examine ${obj.name}`,
          distance: d,
          densityLocked: locked,
        };
      }
    }

    if (
      bestTarget?.id !== this.currentInteractTarget?.id ||
      bestTarget?.densityLocked !== this.currentInteractTarget?.densityLocked
    ) {
      this.currentInteractTarget = bestTarget;
      this.callbacks.onInteractTargetChanged(bestTarget);
    }
  }

  public dispose() {
    this.disposed = true;
    cancelAnimationFrame(this.frameId);
    clearTimeout(this.frameId);
    window.removeEventListener('resize', this.handleResize);
    window.removeEventListener('keydown', this.handleKeyDown);
    window.removeEventListener('keyup', this.handleKeyUp);
    window.removeEventListener('blur', this.handleBlur);
    document.removeEventListener('pointerlockchange', this.handlePointerLockChange);
    this.renderer.domElement.removeEventListener('mousedown', this.handleMouseDown);
    window.removeEventListener('mouseup', this.handleMouseUp);
    window.removeEventListener('mousemove', this.handleMouseMove);

    this.scene.traverse((obj) => {
      const mesh = obj as THREE.Mesh;
      if (mesh.geometry) mesh.geometry.dispose();
      if (mesh.material) {
        if (Array.isArray(mesh.material)) mesh.material.forEach((m) => m.dispose());
        else mesh.material.dispose();
      }
    });
    this.renderer.dispose();
    if (this.renderer.domElement.parentNode === this.container) {
      this.container.removeChild(this.renderer.domElement);
    }
  }
}
