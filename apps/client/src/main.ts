import './style.css';
import { Application, Graphics, Texture, Sprite, Container } from 'pixi.js';
import { Viewport } from 'pixi-viewport';
import { TILE_SIZE, CHUNK_SIZE, RECIPES } from '@survival/shared';
import type { GameSnapshot, PlayerInput, PlayerState, ChunkData } from '@survival/shared';
import {
  generateCharacterTexture,
  generateZombieTexture,
  generateTileTexture,
  generateItemTexture,
  generateTreeTexture,
  generateBushTexture,
  generateFurnitureTexture,
  generateFenceTexture,
  generateRockTexture,
} from './spriteGen';
import type { TileVariant } from './spriteGen';

const app = new Application();
await app.init({
  width: window.innerWidth,
  height: window.innerHeight,
  backgroundColor: 0x1a1a1a,
  resizeTo: window,
  antialias: true
});
document.querySelector<HTMLDivElement>('#app')!.appendChild(app.canvas);

const viewport = new Viewport({
  screenWidth: window.innerWidth,
  screenHeight: window.innerHeight,
  worldWidth: 15000,
  worldHeight: 15000,
  events: app.renderer.events
});
app.stage.addChild(viewport);
viewport.drag().pinch().wheel().decelerate();

// Layer containers for z-ordering
const groundLayer = new Container();
groundLayer.sortableChildren = false;
viewport.addChild(groundLayer);

const objectLayer = new Container();
viewport.addChild(objectLayer);

const bloodLayer = new Graphics();
bloodLayer.alpha = 0.8;
viewport.addChild(bloodLayer);

const entityLayer = new Container();
entityLayer.sortableChildren = true;
viewport.addChild(entityLayer);

const darknessLayer = new Container();
viewport.addChild(darknessLayer);

// Ground tile textures cache
const tileTexCache = new Map<string, Texture>();

function getTileTexture(variant: TileVariant, seed: number): Texture {
  const key = `${variant}_${seed % 12}`;
  if (tileTexCache.has(key)) return tileTexCache.get(key)!;
  const tex = generateTileTexture(variant, seed);
  tileTexCache.set(key, tex);
  return tex;
}

function getFloorVariant(cx: number, cy: number, lx: number, ly: number): TileVariant {
  const seed = cx * 100000 + cy * 1000 + lx * 10 + ly;
  const r = ((seed * 9301 + 49297) % 100) / 100;
  const worldX = cx * CHUNK_SIZE + lx;
  const worldY = cy * CHUNK_SIZE + ly;
  const distFromCenter = Math.hypot(worldX, worldY);

  if (distFromCenter < 5) return 'road';
  if (distFromCenter < 8) return 'pavement';
  if (distFromCenter < 12) return 'dirt';
  if (r < 0.08) return 'dirt';
  if (r < 0.12) return 'gravel';
  if (r < 0.18) return 'woodfloor';
  return 'grass';
}

function getWallVariant(seed: number): TileVariant {
  const r = ((seed * 9301 + 49297) % 100) / 100;
  if (r < 0.4) return 'wall_brick';
  if (r < 0.7) return 'wall_wood';
  return 'wall_concrete';
}

const loadedChunks = new Map<string, Container>();

// Tree/bush texture caches
const treeTexCache = new Map<number, { trunk: Texture; foliage: Texture; width: number; height: number }>();
const bushTexCache = new Map<number, Texture>();
const treeSprites = new Map<string, Container>();
const bushSprites = new Map<string, Container>();

// World object texture caches
const furnitureTexCache = new Map<string, Texture>();
const fenceTexCache = new Map<string, Texture>();
let rockTex: Texture | null = null;

function getCachedFurniture(type: string): Texture {
  if (furnitureTexCache.has(type)) return furnitureTexCache.get(type)!;
  const tex = generateFurnitureTexture(type);
  furnitureTexCache.set(type, tex);
  return tex;
}

function getCachedFence(horizontal: boolean): Texture {
  const key = horizontal ? 'h' : 'v';
  if (fenceTexCache.has(key)) return fenceTexCache.get(key)!;
  const tex = generateFenceTexture(horizontal);
  fenceTexCache.set(key, tex);
  return tex;
}

function getCachedRock(): Texture {
  if (rockTex) return rockTex;
  rockTex = generateRockTexture();
  return rockTex;
}

function getCachedTreeTexture(seed: number) {
  const key = ((seed * 9301 + 49297) | 0) % 4;
  if (treeTexCache.has(key)) return treeTexCache.get(key)!;
  const tex = generateTreeTexture(key);
  treeTexCache.set(key, tex);
  return tex;
}

function getCachedBushTexture(seed: number) {
  const key = ((seed * 9301 + 49297) | 0) % 2;
  if (bushTexCache.has(key)) return bushTexCache.get(key)!;
  const tex = generateBushTexture(key);
  bushTexCache.set(key, tex);
  return tex;
}

function generateWorldObjects(cx: number, cy: number) {
  const seed = cx * 100000 + cy * 1000;
  const rng = ((seed * 9301 + 49297) % 1000) / 1000;

  // Trees (up to 3 per chunk, fewer for faster loading)
  const treeCount = Math.floor(rng * 3) + 1;
  for (let i = 0; i < treeCount; i++) {
    const subSeed = seed + i * 137;
    const lx = ((subSeed * 9301 + 49297) % 1000) / 1000;
    const ly = ((subSeed * 49297 + 9301) % 1000) / 1000;
    const wx = (cx * CHUNK_SIZE + lx * CHUNK_SIZE) * TILE_SIZE;
    const wy = (cy * CHUNK_SIZE + ly * CHUNK_SIZE) * TILE_SIZE;
    const key = `${cx},${cy},t${i}`;

    const tex = getCachedTreeTexture(subSeed);
    const foliage = new Sprite(tex.foliage);
    foliage.anchor.set(0.5, 1);
    foliage.x = wx;
    foliage.y = wy - tex.height + tex.foliage.height;

    const trunk = new Sprite(tex.trunk);
    trunk.anchor.set(0.5, 1);
    trunk.x = wx;
    trunk.y = wy;

    const container = new Container();
    container.addChild(trunk);
    container.addChild(foliage);
    objectLayer.addChild(container);
    treeSprites.set(key, container);
  }

  // Bushes
  const bushCount = Math.floor(rng * 2);
  for (let i = 0; i < bushCount; i++) {
    const subSeed = seed + i * 73 + 50;
    const lx = ((subSeed * 9301 + 49297) % 1000) / 1000;
    const ly = ((subSeed * 49297 + 9301) % 1000) / 1000;
    const wx = (cx * CHUNK_SIZE + lx * CHUNK_SIZE) * TILE_SIZE;
    const wy = (cy * CHUNK_SIZE + ly * CHUNK_SIZE) * TILE_SIZE;
    const key = `${cx},${cy},b${i}`;

    const bush = new Sprite(getCachedBushTexture(subSeed));
    bush.anchor.set(0.5, 1);
    bush.x = wx;
    bush.y = wy;
    objectLayer.addChild(bush);
    bushSprites.set(key, bush);
  }

  // Rocks
  const rockCount = Math.floor(rng * 3) + 1;
  for (let i = 0; i < rockCount; i++) {
    const subSeed = seed + i * 97 + 33;
    const lx = ((subSeed * 9301 + 49297) % 1000) / 1000;
    const ly = ((subSeed * 49297 + 9301) % 1000) / 1000;
    const wx = (cx * CHUNK_SIZE + lx * CHUNK_SIZE) * TILE_SIZE;
    const wy = (cy * CHUNK_SIZE + ly * CHUNK_SIZE) * TILE_SIZE;

    const rock = new Sprite(getCachedRock());
    rock.anchor.set(0.5, 1);
    rock.x = wx;
    rock.y = wy;
    objectLayer.addChild(rock);
  }

  // Furniture in buildings (indoor tiles)
  if (rng > 0.7) {
    const furnTypes = ['table', 'chair', 'shelf', 'counter'];
    const furnType = furnTypes[Math.floor(rng * furnTypes.length) % furnTypes.length];
    const subSeed = seed + 41;
    const lx = ((subSeed * 9301 + 49297) % 800 + 100) / 1000;
    const ly = ((subSeed * 49297 + 9301) % 800 + 100) / 1000;
    const wx = (cx * CHUNK_SIZE + lx * CHUNK_SIZE) * TILE_SIZE;
    const wy = (cy * CHUNK_SIZE + ly * CHUNK_SIZE) * TILE_SIZE;

    const furn = new Sprite(getCachedFurniture(furnType));
    furn.anchor.set(0.5, 1);
    furn.x = wx;
    furn.y = wy;
    objectLayer.addChild(furn);
  }

  // Fences along edges near roads
  if (rng > 0.85) {
    const fSeed = seed + 59;
    const fCount = 2 + Math.floor(((fSeed * 9301 + 49297) % 100) / 25);
    for (let i = 0; i < fCount; i++) {
      const subSeed = fSeed + i * 61;
      const lx = ((subSeed * 9301 + 49297) % 1000) / 1000;
      const ly = ((subSeed * 49297 + 9301) % 1000) / 1000;
      const wx = (cx * CHUNK_SIZE + lx * CHUNK_SIZE) * TILE_SIZE;
      const wy = (cy * CHUNK_SIZE + ly * CHUNK_SIZE) * TILE_SIZE;
      const horiz = (subSeed % 2) === 0;

      const fence = new Sprite(getCachedFence(horiz));
      fence.anchor.set(0.5, 1);
      fence.x = wx;
      fence.y = wy;
      objectLayer.addChild(fence);
    }
  }
}

function renderChunk(chunk: ChunkData) {
  const hash = `${chunk.x},${chunk.y}`;
  if (loadedChunks.has(hash)) return;

  const container = new Container();
  for (let y = 0; y < CHUNK_SIZE; y++) {
    for (let x = 0; x < CHUNK_SIZE; x++) {
      const worldX = chunk.x * CHUNK_SIZE + x;
      const worldY = chunk.y * CHUNK_SIZE + y;
      const px = worldX * TILE_SIZE;
      const py = worldY * TILE_SIZE;

      if (chunk.tiles[y][x] === 1) {
        const variant = getWallVariant(worldX * 31 + worldY * 17);
        const sprite = new Sprite(getTileTexture(variant, worldX * 31 + worldY * 17));
        sprite.x = px;
        sprite.y = py;
        container.addChild(sprite);
      } else {
        const variant = getFloorVariant(chunk.x, chunk.y, x, y);
        const sprite = new Sprite(getTileTexture(variant, worldX * 31 + worldY * 17));
        sprite.x = px;
        sprite.y = py;
        container.addChild(sprite);
      }
    }
  }

  groundLayer.addChild(container);
  loadedChunks.set(hash, container);
  generateWorldObjects(chunk.x, chunk.y);
}

// Character texture cache
const characterTexCache = new Map<string, Texture>();
const zombieTexCache = new Map<string, Texture>();

function getCharacterTexture(color: number): Texture {
  const key = `${color}`;
  if (characterTexCache.has(key)) return characterTexCache.get(key)!;
  const tex = generateCharacterTexture(color);
  characterTexCache.set(key, tex);
  return tex;
}

function getZombieTexture(id: string): Texture {
  if (zombieTexCache.has(id)) return zombieTexCache.get(id)!;
  const variant = Math.abs(hashCode(id)) % 8;
  const tex = generateZombieTexture(variant);
  zombieTexCache.set(id, tex);
  return tex;
}

function hashCode(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) {
    h = ((h << 5) - h) + s.charCodeAt(i);
    h |= 0;
  }
  return h;
}

function createPlayerSprite(id: string): Container {
  const container = new Container();
  viewport.addChild(container);
  playerSprites.set(id, container);

  const hb = new Graphics();
  viewport.addChild(hb);
  healthBars.set(id, hb);

  return container;
}

function updatePlayerSprite(container: Container, x: number, y: number, rotation: number, isLocal: boolean) {
  if (!(container as any).bodySprite) {
    const color = isLocal ? 0x22aa22 : 0xaa2222;
    const tex = getCharacterTexture(color);
    const sprite = new Sprite(tex);
    sprite.anchor.set(0.5, 0.75);
    sprite.x = 0;
    sprite.y = 0;
    container.addChild(sprite);
    (container as any).bodySprite = sprite;
  } else {
    (container as any).bodySprite.rotation = rotation + Math.PI / 4;
  }
  container.x = x;
  container.y = y;
}

function createZombieSprite(id: string): Container {
  const container = new Container();
  entityLayer.addChild(container);
  zombieSprites.set(id, container);

  const hb = new Graphics();
  entityLayer.addChild(hb);
  healthBars.set(id, hb);

  return container;
}

function updateZombieSprite(container: Container, id: string, x: number, y: number, rotation: number) {
  if (!(container as any).bodySprite) {
    const tex = getZombieTexture(id);
    const sprite = new Sprite(tex);
    sprite.anchor.set(0.5, 0.75);
    sprite.rotation = rotation + Math.PI / 4;
    container.addChild(sprite);
    (container as any).bodySprite = sprite;
  } else {
    (container as any).bodySprite.rotation = rotation + Math.PI / 4;
  }
  container.x = x;
  container.y = y;
}

// Flashlight/Vision Darkness overlay
const lightCanvas = document.createElement('canvas');
lightCanvas.width = 2000;
lightCanvas.height = 2000;
const lctx = lightCanvas.getContext('2d')!;
lctx.fillStyle = 'rgba(0, 0, 0, 0.98)';
lctx.fillRect(0, 0, 2000, 2000);
lctx.globalCompositeOperation = 'destination-out';
const grd = lctx.createRadialGradient(1000, 1000, 100, 1000, 1000, 800);
grd.addColorStop(0, 'rgba(255, 255, 255, 1)');
grd.addColorStop(1, 'rgba(255, 255, 255, 0)');
lctx.fillStyle = grd;
lctx.beginPath();
lctx.arc(1000, 1000, 800, 0, 2 * Math.PI);
lctx.fill();

const lightTex = Texture.from(lightCanvas);
const lightSprite = new Sprite(lightTex);
lightSprite.anchor.set(0.5);
lightSprite.blendMode = 'multiply';

const outerDarkness = new Graphics();
outerDarkness.rect(-50000, -50000, 150000, 150000).fill('rgba(0, 0, 0, 0.98)');
outerDarkness.rect(-1000, -1000, 2000, 2000).cut();
lightSprite.addChild(outerDarkness);

darknessLayer.addChild(lightSprite);

// Rain particle system (screen-space)
const rainContainer = new Container();
app.stage.addChild(rainContainer);

interface RainDrop {
  g: Graphics;
  speed: number;
}

const raindrops: RainDrop[] = [];
const MAX_RAIN = 400;

for (let i = 0; i < MAX_RAIN; i++) {
  const g = new Graphics();
  g.moveTo(0, 0);
  g.lineTo(0, 10 + Math.random() * 18);
  g.stroke({ width: 1, color: 0x88aaff, alpha: 0.15 + Math.random() * 0.2 });
  g.x = Math.random() * (window.innerWidth + 200) - 100;
  g.y = Math.random() * (window.innerHeight + 200) - 100;
  rainContainer.addChild(g);
  raindrops.push({ g, speed: 400 + Math.random() * 400 });
}

let rainIntensity = 0;

// Gunshot flash overlay
const flashOverlay = new Graphics();
flashOverlay.rect(0, 0, window.innerWidth, window.innerHeight).fill({ color: 0xffffff, alpha: 0 });
app.stage.addChild(flashOverlay);
let flashAlpha = 0;





const playerSprites = new Map<string, Container>();
const bulletSprites = new Map<string, Container>();
const zombieSprites = new Map<string, Container>();
const itemSprites = new Map<string, Sprite>();
const healthBars = new Map<string, Graphics>();
const itemLabelEls = new Map<string, HTMLDivElement>();

// Item texture cache
const itemTexCache = new Map<string, Texture>();

function getItemTexture(type: string): Texture {
  if (itemTexCache.has(type)) return itemTexCache.get(type)!;
  const tex = generateItemTexture(type);
  itemTexCache.set(type, tex);
  return tex;
}

function getBulletSprite(id: string): Container {
  if (bulletSprites.has(id)) return bulletSprites.get(id)!;
  const container = new Container();

  const shadow = new Graphics();
  shadow.ellipse(0, 15, 8, 4).fill({ color: 0x000000, alpha: 0.3 });
  container.addChild(shadow);

  const g = new Graphics();
  g.circle(0, 0, 3).fill(0xffffaa);
  g.circle(0, 0, 5).fill({ color: 0xffaa00, alpha: 0.5 });
  container.addChild(g);

  entityLayer.addChild(container);
  bulletSprites.set(id, container);
  return container;
}

function getItemSprite(id: string, type: string): Sprite {
  if (itemSprites.has(id)) return itemSprites.get(id)!;
  const sprite = new Sprite(getItemTexture(type));
  sprite.anchor.set(0.5, 0.5);
  entityLayer.addChild(sprite);
  itemSprites.set(id, sprite);

  const label = document.createElement('div');
  label.className = 'item-label';
  const displayName = type.charAt(0).toUpperCase() + type.slice(1);
  label.textContent = displayName;
  document.getElementById('app')!.appendChild(label);
  itemLabelEls.set(id, label);

  return sprite;
}

function getDayNightAlpha(worldTime: number): number {
  const noonDist = Math.abs(worldTime - 12);
  const normalized = noonDist / 12;
  const smooth = normalized * normalized * (3 - 2 * normalized);
  return 0.12 + smooth * 0.85;
}

function formatTime(worldTime: number): string {
  const hours = Math.floor(worldTime);
  const minutes = Math.floor((worldTime - hours) * 60);
  return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;
}

const ws = new WebSocket(`ws://${window.location.host}`);
let localPlayerId = '';

const SERVER_TICK_RATE = 20;
const INTERPOLATION_DELAY = 1000 / SERVER_TICK_RATE * 2;

const snapshots: GameSnapshot[] = [];
let pendingInputs: PlayerInput[] = [];
let localState: PlayerState | null = null;

let inputSeq = 0;
const input: Omit<PlayerInput, 'seq'> = {
  up: false, down: false, left: false, right: false,
  mouseX: 0, mouseY: 0,
  isShooting: false, isInteracting: false,
  isBuilding: false, buildTargetX: 0, buildTargetY: 0,
  isCrafting: false, craftRecipeId: '',
  isDroppingItem: false, dropItemId: '',
  isUsingItem: false, useItemId: '',
};

// Store chunk tile data for collision
const chunkTileData = new Map<string, ChunkData>();

ws.onmessage = (event) => {
  const data = JSON.parse(event.data);
  if (data.type === 'init') {
    localPlayerId = data.id;
  } else if (data.type === 'chunks') {
    const chunks = data.chunks as ChunkData[];
    chunks.forEach(chunk => {
      chunkTileData.set(`${chunk.x},${chunk.y}`, chunk);
      renderChunk(chunk);
    });
  } else if (data.type === 'snapshot') {
    const snapshot = data.snapshot as GameSnapshot;
    snapshots.push(snapshot);
    if (snapshots.length > 10) snapshots.shift();

    if (localPlayerId && snapshot.players[localPlayerId]) {
      const serverState = snapshot.players[localPlayerId];
      pendingInputs = pendingInputs.filter(i => i.seq > serverState.lastProcessedInput);
      localState = { ...serverState };
      const PLAYER_SPEED = 200;
      const dt = 1 / SERVER_TICK_RATE;
      for (const i of pendingInputs) {
        let dx = 0; let dy = 0;
        if (i.up) dy -= 1;
        if (i.down) dy += 1;
        if (i.left) dx -= 1;
        if (i.right) dx += 1;
        if (dx !== 0 && dy !== 0) { const l = Math.sqrt(dx * dx + dy * dy); dx /= l; dy /= l; }
        const nextX = localState.x + dx * PLAYER_SPEED * dt;
        if (!checkCollision2(nextX, localState.y)) localState.x = nextX;
        const nextY = localState.y + dy * PLAYER_SPEED * dt;
        if (!checkCollision2(localState.x, nextY)) localState.y = nextY;
      }
    }

    document.getElementById('hud-time')!.textContent = formatTime(snapshot.worldTime);
    document.getElementById('vit-time')!.textContent = formatTime(snapshot.worldTime);

    const darknessAlpha = getDayNightAlpha(snapshot.worldTime);
    outerDarkness.alpha = darknessAlpha;
    rainIntensity = darknessAlpha > 0.5 ? darknessAlpha * 0.8 : 0.3;

    if (snapshot.sounds && snapshot.sounds.length > 0 && localState) {
      const nearbyShot = snapshot.sounds.find(s => {
        return Math.hypot(s.x - localState!.x, s.y - localState!.y) < 600;
      });
      if (nearbyShot) flashAlpha = 0.15;
    }
  }
};

const PLAYER_RADIUS = 20;

function checkCollision2(x: number, y: number): boolean {
  const r = PLAYER_RADIUS;
  return isWall2(x - r, y - r) || isWall2(x + r, y - r) ||
         isWall2(x - r, y + r) || isWall2(x + r, y + r);
}

function isWall2(worldX: number, worldY: number): boolean {
  const tileX = Math.floor(worldX / TILE_SIZE);
  const tileY = Math.floor(worldY / TILE_SIZE);
  const cx = Math.floor(tileX / CHUNK_SIZE);
  const cy = Math.floor(tileY / CHUNK_SIZE);
  const localX = tileX - cx * CHUNK_SIZE;
  const localY = tileY - cy * CHUNK_SIZE;
  const chunk = chunkTileData.get(`${cx},${cy}`);
  if (!chunk) return false;
  if (localY < 0 || localY >= CHUNK_SIZE || localX < 0 || localX >= CHUNK_SIZE) return false;
  return chunk.tiles[localY][localX] === 1;
}

let uiOpen = false;
const uiLayer = document.getElementById('ui-layer')!;

window.addEventListener('keydown', e => {
  if (e.code === 'Tab') { e.preventDefault(); uiOpen = !uiOpen; uiLayer.style.opacity = uiOpen ? '1' : '0'; if (uiOpen) populateCrafting(); }
  if (e.code === 'KeyW') input.up = true;
  if (e.code === 'KeyS') input.down = true;
  if (e.code === 'KeyA') input.left = true;
  if (e.code === 'KeyD') input.right = true;
  if (e.code === 'KeyE') input.isInteracting = true;
  if (e.code === 'KeyB') { input.isBuilding = true; input.buildTargetX = input.mouseX; input.buildTargetY = input.mouseY; }
});
window.addEventListener('keyup', e => {
  if (e.code === 'KeyW') input.up = false;
  if (e.code === 'KeyS') input.down = false;
  if (e.code === 'KeyA') input.left = false;
  if (e.code === 'KeyD') input.right = false;
  if (e.code === 'KeyE') input.isInteracting = false;
});
window.addEventListener('mousemove', e => {
  const worldPos = viewport.toWorld(e.clientX, e.clientY);
  input.mouseX = worldPos.x;
  input.mouseY = worldPos.y;
});
let screenShake = 0;
let recoilTimer = 0;

window.addEventListener('mousedown', e => { if (e.button === 0) { input.isShooting = true; screenShake = 15; recoilTimer = 10; } });
window.addEventListener('mouseup', e => { if (e.button === 0) input.isShooting = false; });

// Auto-play button
let autoPlay = false;
const autoPlayBtn = document.getElementById('auto-play-btn');
if (autoPlayBtn) {
  autoPlayBtn.addEventListener('click', () => {
    autoPlay = !autoPlay;
    autoPlayBtn.textContent = autoPlay ? 'Stop Demo' : 'Auto Demo';
    if (autoPlay) {
      input.isShooting = false;
      input.isInteracting = false;
    }
  });
}

// Tab switching
document.querySelectorAll('.tab-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    const tab = btn.getAttribute('data-tab');
    document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    document.querySelectorAll('.tab-content').forEach(c => (c as HTMLElement).style.display = 'none');
    const target = document.querySelector(`.tab-content[data-tab="${tab}"]`) as HTMLElement;
    if (target) target.style.display = 'block';
    if (tab === 'crafting') populateCrafting();
    if (tab === 'inventory') populateInventory();
  });
});

function populateCrafting() {
  const list = document.getElementById('craft-list')!;
  if (!localState) { list.innerHTML = '<div style="color:#666;">Dead</div>'; return; }
  list.innerHTML = '';
  for (const recipe of RECIPES) {
    const canCraft = recipe.ingredients.every(ing => localState!.inventory.items.filter(i => i.type === ing.type).length >= ing.count);
    const el = document.createElement('div');
    el.className = 'craft-item';
    el.innerHTML = `
      <div class="craft-info">
        <div class="craft-name">${recipe.name}</div>
        <div class="craft-desc">${recipe.description}</div>
        <div class="craft-ingredients">${recipe.ingredients.map(i => `${i.count}x ${i.type}`).join(', ')}</div>
      </div>
      <button class="craft-btn" data-recipe="${recipe.id}" ${canCraft ? '' : 'disabled'}>${canCraft ? 'Craft' : 'Need mats'}</button>
    `;
    list.appendChild(el);
    el.querySelector('.craft-btn')!.addEventListener('click', () => {
      input.isCrafting = true;
      input.craftRecipeId = recipe.id;
    });
  }
}

function populateInventory() {
  const list = document.getElementById('inv-list')!;
  if (!localState) { list.innerHTML = '<div style="color:#666;">Dead</div>'; return; }
  const grouped: Record<string, { id: string; type: string; weight: number }[]> = {};
  for (const item of localState.inventory.items) {
    if (!grouped[item.type]) grouped[item.type] = [];
    grouped[item.type].push(item);
  }
  list.innerHTML = '';
  const usableTypes = ['health', 'medkit', 'food', 'water'];
  for (const [type, typeItems] of Object.entries(grouped)) {
    const firstItem = typeItems[0];
    const el = document.createElement('div');
    el.className = 'inv-item';
    el.innerHTML = `
      <div><span class="inv-item-name">${type}</span><span class="inv-item-count">x${typeItems.length}</span></div>
      <div class="inv-item-actions">
        ${usableTypes.includes(type) ? `<button class="inv-btn use">Use</button>` : ''}
        <button class="inv-btn drop">Drop</button>
      </div>
    `;
    list.appendChild(el);
    const dropBtn = el.querySelector('.inv-btn.drop')!;
    dropBtn.addEventListener('click', () => {
      input.isDroppingItem = true;
      input.dropItemId = firstItem.id;
    });
    const useBtn = el.querySelector('.inv-btn.use');
    if (useBtn) {
      useBtn.addEventListener('click', () => {
        input.isUsingItem = true;
        input.useItemId = firstItem.id;
      });
    }
  }
  if (Object.keys(grouped).length === 0) list.innerHTML = '<div style="color:#666;">Empty</div>';
}

let lastInputSend = 0;
let autoPlayTime = 0;
app.ticker.add(() => {
  const now = Date.now();
  const time = now / 1000;

  // Auto-play overrides
  if (autoPlay && localState) {
    autoPlayTime += app.ticker.deltaMS / 1000;
    const angle = autoPlayTime * 0.4;
    const sideAngle = angle + Math.PI / 2;
    input.up = Math.sin(angle) < -0.3;
    input.down = Math.sin(angle) > 0.3;
    input.left = Math.cos(sideAngle) < -0.3;
    input.right = Math.cos(sideAngle) > 0.3;
    input.isShooting = Math.sin(autoPlayTime * 0.5) > 0.85;
    const aimAngle = autoPlayTime * 0.7;
    input.mouseX = localState.x + Math.cos(aimAngle) * 300;
    input.mouseY = localState.y + Math.sin(aimAngle) * 300;
  }

  if (localPlayerId && ws.readyState === WebSocket.OPEN && now - lastInputSend > 1000 / SERVER_TICK_RATE) {
    inputSeq++;
    const currentInput: PlayerInput = { ...input, seq: inputSeq };
    ws.send(JSON.stringify(currentInput));
    pendingInputs.push(currentInput);

    input.isBuilding = false;
    input.isCrafting = false;
    input.craftRecipeId = '';
    input.isDroppingItem = false;
    input.dropItemId = '';
    input.isUsingItem = false;
    input.useItemId = '';

    if (localState) {
      let dx = 0; let dy = 0;
      if (currentInput.up) dy -= 1;
      if (currentInput.down) dy += 1;
      if (currentInput.left) dx -= 1;
      if (currentInput.right) dx += 1;
      if (dx !== 0 && dy !== 0) { const l = Math.sqrt(dx * dx + dy * dy); dx /= l; dy /= l; }
      const dt = 1 / SERVER_TICK_RATE;
      const nextX = localState.x + dx * 200 * dt;
      if (!checkCollision2(nextX, localState.y)) localState.x = nextX;
      const nextY = localState.y + dy * 200 * dt;
      if (!checkCollision2(localState.x, nextY)) localState.y = nextY;
      localState.rotation = Math.atan2(input.mouseY - localState.y, input.mouseX - localState.x);
    }
    lastInputSend = now;
  }

  if (screenShake > 0) {
    viewport.x += (Math.random() - 0.5) * screenShake;
    viewport.y += (Math.random() - 0.5) * screenShake;
    screenShake *= 0.8;
    if (screenShake < 0.5) screenShake = 0;
  }
  if (recoilTimer > 0) recoilTimer--;

  lightSprite.alpha = 0.95 + Math.random() * 0.05;

  if (flashAlpha > 0) {
    flashOverlay.clear();
    flashOverlay.rect(0, 0, window.innerWidth, window.innerHeight).fill({ color: 0xffffff, alpha: flashAlpha });
    flashAlpha *= 0.85;
    if (flashAlpha < 0.01) flashAlpha = 0;
  }

  const dt = app.ticker.deltaMS / 1000;
  for (const drop of raindrops) {
    drop.g.y += drop.speed * dt;
    drop.g.x += 30 * dt;
    if (drop.g.y > window.innerHeight + 20) {
      drop.g.y = -20;
      drop.g.x = Math.random() * (window.innerWidth + 200) - 100;
    }
    drop.g.alpha = (0.15 + Math.random() * 0.2) * rainIntensity;
  }

  if (localPlayerId && localState) {
    let container = playerSprites.get(localPlayerId);
    if (!container) container = createPlayerSprite(localPlayerId);
    updatePlayerSprite(container, localState.x, localState.y, localState.rotation, true);

    const bodySprite = (container as any).bodySprite;
    if (bodySprite) {
      bodySprite.x = 0;
      bodySprite.y = Math.sin(time * 3) * 1.5;
    }

    viewport.follow(container);

    const hb = healthBars.get(localPlayerId)!;
    if (hb) {
      hb.clear();
      hb.rect(localState.x - 25, localState.y - 40, 50, 6).fill(0x000000);
      hb.rect(localState.x - 25, localState.y - 40, 50 * (localState.health / 100), 6).fill(0x00ff00);
    }

    lightSprite.x = localState.x;
    lightSprite.y = localState.y;

    document.getElementById('hud-health')!.textContent = Math.round(localState.health).toString();
    document.getElementById('hud-hunger')!.textContent = Math.round(localState.hunger).toString();
    document.getElementById('hud-thirst')!.textContent = Math.round(localState.thirst).toString();
    document.getElementById('hud-temp')!.textContent = localState.temperature.toFixed(1);

    document.getElementById('vit-health')!.innerText = Math.round(localState.health).toString();
    document.getElementById('vit-health-bar')!.style.width = `${Math.max(0, Math.min(100, localState.health))}%`;
    document.getElementById('vit-hunger')!.innerText = Math.round(localState.hunger).toString();
    document.getElementById('vit-hunger-bar')!.style.width = `${Math.max(0, Math.min(100, localState.hunger))}%`;
    document.getElementById('vit-thirst')!.innerText = Math.round(localState.thirst).toString();
    document.getElementById('vit-thirst-bar')!.style.width = `${Math.max(0, Math.min(100, localState.thirst))}%`;
    document.getElementById('vit-temp')!.innerText = localState.temperature.toFixed(1);

    document.getElementById('inv-weight')!.innerText = localState.inventory.currentWeight.toString();
    document.getElementById('inv-max')!.innerText = localState.inventory.maxWeight.toString();

    if (uiOpen) {
      const active = document.querySelector('.tab-btn.active');
      if (active && active.getAttribute('data-tab') === 'inventory') populateInventory();
    }
  }

  const renderTime = now - INTERPOLATION_DELAY;
  while (snapshots.length >= 2 && snapshots[1].time <= renderTime) snapshots.shift();

  if (snapshots.length >= 2) {
    const s0 = snapshots[0];
    const s1 = snapshots[1];
    let ratio = (renderTime - s0.time) / (s1.time - s0.time);
    ratio = Math.max(0, Math.min(1, ratio));

    for (const id in s1.players) {
      if (id === localPlayerId) continue;
      const p1 = s1.players[id];
      const p0 = s0.players[id] || p1;
      let container = playerSprites.get(id);
      if (!container) container = createPlayerSprite(id);
      updatePlayerSprite(container, p0.x + (p1.x - p0.x) * ratio, p0.y + (p1.y - p0.y) * ratio, p0.rotation, false);

      const bodySprite = (container as any).bodySprite;
      if (bodySprite) {
        bodySprite.x = 0;
        bodySprite.y = Math.sin(time * 3 + hashCode(id) * 0.01) * 1.5;
      }

      const hb = healthBars.get(id)!;
      if (hb) {
        const sx = p0.x + (p1.x - p0.x) * ratio;
        const sy = p0.y + (p1.y - p0.y) * ratio;
        hb.clear();
        hb.rect(sx - 25, sy - 40, 50, 6).fill(0x000000);
        hb.rect(sx - 25, sy - 40, 50 * (p1.health / 100), 6).fill(0x00ff00);
      }
    }

    for (const id in s1.bullets) {
      const b1 = s1.bullets[id];
      const b0 = s0.bullets[id] || b1;
      const sprite = getBulletSprite(id);
      sprite.x = b0.x + (b1.x - b0.x) * ratio;
      sprite.y = b0.y + (b1.y - b0.y) * ratio;
    }

    for (const id in s1.zombies) {
      const z1 = s1.zombies[id];
      const z0 = s0.zombies[id] || z1;
      let container = zombieSprites.get(id);
      if (!container) container = createZombieSprite(id);
      updateZombieSprite(container, id, z0.x + (z1.x - z0.x) * ratio, z0.y + (z1.y - z0.y) * ratio, z0.rotation);

      const sprite = (container as any).bodySprite;
      if (sprite) {
        sprite.rotation = z0.rotation + Math.PI / 4 + Math.sin(time * 2 + hashCode(id) * 0.01) * 0.04;
      }

      if (sprite && z1.health < z0.health) {
        bloodLayer.circle(sprite.x + (Math.random() - 0.5) * 30 + container.x, sprite.y + (Math.random() - 0.5) * 30 + container.y - 10, 3 + Math.random() * 8).fill({ color: 0x660000, alpha: 0.7 });
      }

      const hb = healthBars.get(id)!;
      if (hb) {
        const sx = z0.x + (z1.x - z0.x) * ratio;
        const sy = z0.y + (z1.y - z0.y) * ratio;
        hb.clear();
        hb.rect(sx - 25, sy - 40, 50, 6).fill(0x000000);
        hb.rect(sx - 25, sy - 40, 50 * (z1.health / 50), 6).fill(0xff0000);
      }
    }

    for (const id in s1.items) {
      const i1 = s1.items[id];
      const sprite = getItemSprite(id, i1.type);
      sprite.x = i1.x;
      sprite.y = i1.y;

      const label = itemLabelEls.get(id);
      if (label) {
        const screenPos = viewport.toScreen(i1.x, i1.y - 25);
        label.style.left = `${screenPos.x}px`;
        label.style.top = `${screenPos.y}px`;
        label.style.display = 'block';
      }
    }

    for (const [id, label] of itemLabelEls) {
      if (!s1.items[id]) label.style.display = 'none';
    }

    // Cleanup removed entities
    for (const id of playerSprites.keys()) {
      if (id !== localPlayerId && !s1.players[id]) {
        entityLayer.removeChild(playerSprites.get(id)!);
        entityLayer.removeChild(healthBars.get(id)!);
        playerSprites.get(id)!.destroy({ children: true });
        healthBars.get(id)!.destroy();
        playerSprites.delete(id);
        healthBars.delete(id);
      }
    }
    for (const id of zombieSprites.keys()) {
      if (!s1.zombies[id]) {
        entityLayer.removeChild(zombieSprites.get(id)!);
        entityLayer.removeChild(healthBars.get(id)!);
        zombieSprites.get(id)!.destroy({ children: true });
        healthBars.get(id)!.destroy();
        zombieSprites.delete(id);
        healthBars.delete(id);
      }
    }
    for (const id of bulletSprites.keys()) {
      if (!s1.bullets[id]) {
        entityLayer.removeChild(bulletSprites.get(id)!);
        bulletSprites.get(id)!.destroy({ children: true });
        bulletSprites.delete(id);
      }
    }
    for (const id of itemSprites.keys()) {
      if (!s1.items[id]) {
        entityLayer.removeChild(itemSprites.get(id)!);
        itemSprites.get(id)!.destroy();
        itemSprites.delete(id);
        const label = itemLabelEls.get(id);
        if (label) { label.remove(); itemLabelEls.delete(id); }
      }
    }
  }
});
