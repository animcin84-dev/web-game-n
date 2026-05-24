import express from 'express';
import { WebSocketServer, WebSocket } from 'ws';
import { createServer } from 'http';
import path from 'path';
import { PlayerState, GameSnapshot, PlayerInput, BulletState, ZombieState, ItemState, ChunkData, TILE_SIZE, CHUNK_SIZE, SoundEvent, RECIPES, ItemType } from '@survival/shared';
import { ModManager } from './modding.js';

const app = express();
const server = createServer(app);
const wss = new WebSocketServer({ server });

// Serve client build as static files
const clientDist = path.join(import.meta.dirname, '../../client/dist');
app.use(express.static(clientDist));
app.get('*', (_req, res) => {
  res.sendFile(path.join(clientDist, 'index.html'));
});

const PORT = process.env.PORT || 54070;
const TICK_RATE = 20;
const PLAYER_SPEED = 200;
const BULLET_SPEED = 800;
const ZOMBIE_SPEED = 120;
const PLAYER_RADIUS = 20;
const ZOMBIE_RADIUS = 20;
const PICKUP_RADIUS = 50;
const VISION_RANGE = 250;
const VISION_ANGLE = Math.PI * 0.6;
const HEARING_RANGE_GUNSHOT = 600;

class ChunkManager {
  chunks = new Map<string, ChunkData>();

  private getHash(cx: number, cy: number) {
    return `${cx},${cy}`;
  }

  private pseudoRandom(x: number, y: number) {
    let n = Math.sin(x * 12.9898 + y * 78.233) * 43758.5453123;
    return n - Math.floor(n);
  }

  getChunk(cx: number, cy: number): ChunkData {
    const hash = this.getHash(cx, cy);
    if (this.chunks.has(hash)) return this.chunks.get(hash)!;

    const tiles: number[][] = [];
    for (let y = 0; y < CHUNK_SIZE; y++) {
      const row: number[] = [];
      for (let x = 0; x < CHUNK_SIZE; x++) {
        const worldX = cx * CHUNK_SIZE + x;
        const worldY = cy * CHUNK_SIZE + y;
        const val = this.pseudoRandom(worldX, worldY);
        row.push(val > 0.95 ? 1 : 0);
      }
      tiles.push(row);
    }

    const chunkData = { x: cx, y: cy, tiles };
    this.chunks.set(hash, chunkData);
    return chunkData;
  }

  getTile(worldX: number, worldY: number): number {
    const tileX = Math.floor(worldX / TILE_SIZE);
    const tileY = Math.floor(worldY / TILE_SIZE);
    const cx = Math.floor(tileX / CHUNK_SIZE);
    const cy = Math.floor(tileY / CHUNK_SIZE);
    const localX = tileX - cx * CHUNK_SIZE;
    const localY = tileY - cy * CHUNK_SIZE;
    const chunk = this.getChunk(cx, cy);
    return chunk.tiles[localY][localX];
  }

  setTile(worldX: number, worldY: number, val: number): ChunkData | null {
    const tileX = Math.floor(worldX / TILE_SIZE);
    const tileY = Math.floor(worldY / TILE_SIZE);
    const cx = Math.floor(tileX / CHUNK_SIZE);
    const cy = Math.floor(tileY / CHUNK_SIZE);
    const localX = tileX - cx * CHUNK_SIZE;
    const localY = tileY - cy * CHUNK_SIZE;
    const chunk = this.getChunk(cx, cy);
    if (chunk.tiles[localY][localX] !== val) {
      chunk.tiles[localY][localX] = val;
      return chunk;
    }
    return null;
  }
}

const chunkManager = new ChunkManager();
const modManager = new ModManager(path.join(process.cwd(), 'mods'));

const players: Record<string, PlayerState> = {};
let bullets: Record<string, BulletState> = {};
let zombies: Record<string, ZombieState> = {};
let items: Record<string, ItemState> = {};
let sounds: SoundEvent[] = [];
let worldTime = 8.0;
const inputQueues = new Map<string, PlayerInput[]>();
const playerSockets = new Map<string, WebSocket>();
const playerLoadedChunks = new Map<string, Set<string>>();
const zombieWander = new Map<string, { x: number; y: number }>();

let bulletIdCounter = 0;
let zombieIdCounter = 0;
let itemIdCounter = 0;

for (let i = 0; i < 40; i++) {
  zombies[`z_${zombieIdCounter++}`] = {
    id: `z_${zombieIdCounter}`,
    x: Math.random() * 6000 - 3000,
    y: Math.random() * 6000 - 3000,
    rotation: 0,
    health: 50,
    targetId: null,
  };
}

const itemTypes: ItemType[] = ['health', 'ammo', 'cloth', 'food', 'water', 'weapon', 'pistol', 'shotgun', 'bat', 'axe', 'crowbar', 'knife', 'medkit'];
for (let i = 0; i < 200; i++) {
  const type = itemTypes[Math.floor(Math.random() * itemTypes.length)];
  // Cluster items in groups for "loot points"
  const clusterX = (Math.random() - 0.5) * 5000;
  const clusterY = (Math.random() - 0.5) * 5000;
  const offsetX = (Math.random() - 0.5) * 100;
  const offsetY = (Math.random() - 0.5) * 100;
  items[`i_${itemIdCounter}`] = {
    id: `i_${itemIdCounter}`,
    x: clusterX + offsetX,
    y: clusterY + offsetY,
    type,
  };
  itemIdCounter++;
}

const isWall = (x: number, y: number) => chunkManager.getTile(x, y) === 1;

const checkCollision = (x: number, y: number, radius: number) => {
  return isWall(x - radius, y - radius) ||
         isWall(x + radius, y - radius) ||
         isWall(x - radius, y + radius) ||
         isWall(x + radius, y + radius);
};

function hasLineOfSight(x1: number, y1: number, x2: number, y2: number): boolean {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const dist = Math.hypot(dx, dy);
  const steps = Math.max(Math.ceil(dist / (TILE_SIZE / 2)), 1);
  for (let i = 1; i < steps; i++) {
    const t = i / steps;
    if (chunkManager.getTile(x1 + dx * t, y1 + dy * t) === 1) return false;
  }
  return true;
}

const sendChunksToPlayer = (id: string, px: number, py: number) => {
  const ws = playerSockets.get(id);
  const loaded = playerLoadedChunks.get(id);
  if (!ws || !loaded) return;

  const cx = Math.floor(px / (CHUNK_SIZE * TILE_SIZE));
  const cy = Math.floor(py / (CHUNK_SIZE * TILE_SIZE));
  const viewRadius = 2;

  const chunksToSend: ChunkData[] = [];
  for (let y = cy - viewRadius; y <= cy + viewRadius; y++) {
    for (let x = cx - viewRadius; x <= cx + viewRadius; x++) {
      const hash = `${x},${y}`;
      if (!loaded.has(hash)) {
        loaded.add(hash);
        chunksToSend.push(chunkManager.getChunk(x, y));
      }
    }
  }

  if (chunksToSend.length > 0) {
    ws.send(JSON.stringify({ type: 'chunks', chunks: chunksToSend }));
  }
};

wss.on('connection', (ws: WebSocket) => {
  const id = Math.random().toString(36).substring(7);
  playerSockets.set(id, ws);
  playerLoadedChunks.set(id, new Set());

  let spawnX = 0;
  let spawnY = 0;

  players[id] = {
    id,
    x: spawnX,
    y: spawnY,
    rotation: 0,
    health: 100,
    hunger: 100,
    thirst: 100,
    temperature: 36.6,
    lastProcessedInput: 0,
    inventory: { items: [], currentWeight: 0, maxWeight: 20 }
  };
  inputQueues.set(id, []);

  modManager.emit('playerJoin', players[id]);

  ws.send(JSON.stringify({ type: 'init', id }));
  sendChunksToPlayer(id, spawnX, spawnY);

  ws.on('message', (message: Buffer) => {
    try {
      const input = JSON.parse(message.toString()) as PlayerInput;
      const queue = inputQueues.get(id);
      if (queue) queue.push(input);
    } catch (e) {}
  });

  ws.on('close', () => {
    delete players[id];
    inputQueues.delete(id);
    playerSockets.delete(id);
    playerLoadedChunks.delete(id);
  });
});

setInterval(() => {
  const dt = 1 / TICK_RATE;

  for (const id in players) {
    const player = players[id];
    const queue = inputQueues.get(id);
    if (!queue) continue;

    let shotThisTick = false;

    while (queue.length > 0) {
      const input = queue.shift();
      if (!input) continue;

      let dx = 0; let dy = 0;
      if (input.up) dy -= 1;
      if (input.down) dy += 1;
      if (input.left) dx -= 1;
      if (input.right) dx += 1;

      if (dx !== 0 && dy !== 0) {
        const length = Math.sqrt(dx * dx + dy * dy);
        dx /= length; dy /= length;
      }

      const nextX = player.x + dx * PLAYER_SPEED * dt;
      if (!checkCollision(nextX, player.y, PLAYER_RADIUS)) player.x = nextX;

      const nextY = player.y + dy * PLAYER_SPEED * dt;
      if (!checkCollision(player.x, nextY, PLAYER_RADIUS)) player.y = nextY;

      player.rotation = Math.atan2(input.mouseY - player.y, input.mouseX - player.x);

      if (input.isShooting && !shotThisTick) {
        shotThisTick = true;
        const bId = `b_${id}_${bulletIdCounter++}`;
        bullets[bId] = {
          id: bId,
          x: player.x,
          y: player.y,
          vx: Math.cos(player.rotation) * BULLET_SPEED,
          vy: Math.sin(player.rotation) * BULLET_SPEED,
          ownerId: id,
          distanceTraveled: 0,
          maxRange: 1500
        };
        sounds.push({ x: player.x, y: player.y, radius: HEARING_RANGE_GUNSHOT, ticksRemaining: 15 });
      }

      if (input.isInteracting) {
        for (const iId in items) {
          const item = items[iId];
          if (Math.hypot(player.x - item.x, player.y - item.y) < PICKUP_RADIUS) {
            const itemWeight = item.type === 'weapon' ? 5 : 1;
            if (player.inventory.currentWeight + itemWeight <= player.inventory.maxWeight) {
              player.inventory.items.push({ id: item.id, type: item.type, weight: itemWeight });
              player.inventory.currentWeight += itemWeight;
              delete items[iId];
            }
          }
        }
      }

      if (input.isBuilding) {
        if (Math.hypot(player.x - input.buildTargetX, player.y - input.buildTargetY) < 150) {
          const updatedChunk = chunkManager.setTile(input.buildTargetX, input.buildTargetY, 1);
          if (updatedChunk) {
            const cx = updatedChunk.x;
            const cy = updatedChunk.y;
            playerSockets.forEach((ws, pId) => {
              const loaded = playerLoadedChunks.get(pId);
              if (loaded && loaded.has(`${cx},${cy}`) && ws.readyState === WebSocket.OPEN) {
                ws.send(JSON.stringify({ type: 'chunks', chunks: [updatedChunk] }));
              }
            });
          }
        }
      }

      if (input.isCrafting && input.craftRecipeId) {
        const recipe = RECIPES.find((r: any) => r.id === input.craftRecipeId);
        if (recipe) {
          const canCraft = recipe.ingredients.every((ing: any) => {
            const count = player.inventory.items.filter(i => i.type === ing.type).length;
            return count >= ing.count;
          });
          if (canCraft) {
            for (const ing of recipe.ingredients) {
              let remaining = ing.count;
              player.inventory.items = player.inventory.items.filter(i => {
                if (i.type === ing.type && remaining > 0) {
                  remaining--;
                  player.inventory.currentWeight -= i.weight;
                  return false;
                }
                return true;
              });
            }
            for (let i = 0; i < recipe.result.count; i++) {
              const weight = recipe.result.type === 'weapon' ? 5 : 1;
              if (player.inventory.currentWeight + weight <= player.inventory.maxWeight) {
                const rId = `r_${itemIdCounter++}`;
                player.inventory.items.push({ id: rId, type: recipe.result.type, weight });
                player.inventory.currentWeight += weight;
              }
            }
          }
        }
      }

      if (input.isDroppingItem && input.dropItemId) {
        const itemIndex = player.inventory.items.findIndex(i => i.id === input.dropItemId);
        if (itemIndex > -1) {
          const dropped = player.inventory.items[itemIndex];
          player.inventory.items.splice(itemIndex, 1);
          player.inventory.currentWeight -= dropped.weight;
          items[dropped.id] = {
            id: dropped.id,
            type: dropped.type as ItemType,
            x: player.x + (Math.random() - 0.5) * 50,
            y: player.y + (Math.random() - 0.5) * 50,
          };
        }
      }

      if (input.isUsingItem && input.useItemId) {
        const itemIndex = player.inventory.items.findIndex(i => i.id === input.useItemId);
        if (itemIndex > -1) {
          const item = player.inventory.items[itemIndex];
          if (item.type === 'health') {
            player.inventory.items.splice(itemIndex, 1);
            player.inventory.currentWeight -= item.weight;
            player.health = Math.min(100, player.health + 15);
          } else if (item.type === 'medkit') {
            player.inventory.items.splice(itemIndex, 1);
            player.inventory.currentWeight -= item.weight;
            player.health = Math.min(100, player.health + 50);
          } else if (item.type === 'food') {
            player.inventory.items.splice(itemIndex, 1);
            player.inventory.currentWeight -= item.weight;
            player.hunger = Math.min(100, player.hunger + 30);
          } else if (item.type === 'water') {
            player.inventory.items.splice(itemIndex, 1);
            player.inventory.currentWeight -= item.weight;
            player.thirst = Math.min(100, player.thirst + 30);
          }
        }
      }

      player.lastProcessedInput = input.seq;
    }

    sendChunksToPlayer(id, player.x, player.y);
  }

  // === STEALTH AI: Vision Cone + Sound Propagation ===
  for (const zId in zombies) {
    const z = zombies[zId];

    if (z.health <= 0) {
      delete zombies[zId];
      continue;
    }

    let activeTarget: { x: number; y: number; isPlayer: boolean; playerId?: string } | null = null;

    // Check sound events (hearing)
    for (const sound of sounds) {
      const distToSound = Math.hypot(z.x - sound.x, z.y - sound.y);
      if (distToSound < sound.radius) {
        activeTarget = { x: sound.x, y: sound.y, isPlayer: false };
        break;
      }
    }

    // Check vision cone (line of sight) — only if no sound attracted
    if (!activeTarget) {
      for (const pId in players) {
        const p = players[pId];
        const dist = Math.hypot(p.x - z.x, p.y - z.y);
        if (dist < VISION_RANGE) {
          const angleToPlayer = Math.atan2(p.y - z.y, p.x - z.x);
          const diff = angleToPlayer - z.rotation;
          const normalizedDiff = Math.atan2(Math.sin(diff), Math.cos(diff));
          if (Math.abs(normalizedDiff) <= VISION_ANGLE / 2) {
            if (hasLineOfSight(z.x, z.y, p.x, p.y)) {
              activeTarget = { x: p.x, y: p.y, isPlayer: true, playerId: pId };
              break;
            }
          }
        }
      }
    }

    if (activeTarget) {
      const angle = Math.atan2(activeTarget.y - z.y, activeTarget.x - z.x);
      z.rotation = angle;
      z.targetId = activeTarget.isPlayer ? activeTarget.playerId! : null;

      const nextX = z.x + Math.cos(angle) * ZOMBIE_SPEED * dt;
      if (!checkCollision(nextX, z.y, ZOMBIE_RADIUS)) z.x = nextX;

      const nextY = z.y + Math.sin(angle) * ZOMBIE_SPEED * dt;
      if (!checkCollision(z.x, nextY, ZOMBIE_RADIUS)) z.y = nextY;

      if (activeTarget.isPlayer) {
        const target = players[activeTarget.playerId!];
        if (target && Math.hypot(target.x - z.x, target.y - z.y) < ZOMBIE_RADIUS + PLAYER_RADIUS) {
          target.health -= 5;
          if (target.health <= 0) {
            modManager.emit('playerDeath', target);
            target.x = 0; target.y = 0; target.health = 100;
            target.hunger = 100; target.thirst = 100;
            target.inventory = { items: [], currentWeight: 0, maxWeight: 20 };
          }
        }
      }
    } else {
      z.targetId = null;
      // Idle wandering
      let wander = zombieWander.get(zId);
      if (!wander || Math.hypot(z.x - wander.x, z.y - wander.y) < 20) {
        wander = { x: z.x + (Math.random() - 0.5) * 200, y: z.y + (Math.random() - 0.5) * 200 };
        zombieWander.set(zId, wander);
      }
      const angle = Math.atan2(wander.y - z.y, wander.x - z.x);
      z.rotation = angle;
      const nextX = z.x + Math.cos(angle) * ZOMBIE_SPEED * 0.3 * dt;
      if (!checkCollision(nextX, z.y, ZOMBIE_RADIUS)) z.x = nextX;
      const nextY = z.y + Math.sin(angle) * ZOMBIE_SPEED * 0.3 * dt;
      if (!checkCollision(z.x, nextY, ZOMBIE_RADIUS)) z.y = nextY;
    }
  }

  for (const bId in bullets) {
    const bullet = bullets[bId];
    bullet.x += bullet.vx * dt;
    bullet.y += bullet.vy * dt;
    bullet.distanceTraveled += BULLET_SPEED * dt;

    if (bullet.distanceTraveled > bullet.maxRange || isWall(bullet.x, bullet.y)) {
      delete bullets[bId];
      continue;
    }

    let hit = false;
    for (const pId in players) {
      const player = players[pId];
      if (bullet.ownerId !== pId && Math.hypot(player.x - bullet.x, player.y - bullet.y) < PLAYER_RADIUS + 10) {
        player.health -= 10;
        delete bullets[bId];
        hit = true;
        if (player.health <= 0) {
          modManager.emit('playerDeath', player);
          player.x = 0; player.y = 0; player.health = 100;
          player.hunger = 100; player.thirst = 100;
          player.inventory = { items: [], currentWeight: 0, maxWeight: 20 };
        }
        break;
      }
    }

    if (hit) continue;

    for (const zId in zombies) {
      const zombie = zombies[zId];
      if (Math.hypot(zombie.x - bullet.x, zombie.y - bullet.y) < ZOMBIE_RADIUS + 10) {
        zombie.health -= 25;
        delete bullets[bId];
        if (zombie.health <= 0) {
          modManager.emit('zombieDeath', zombie);
          delete zombies[zId];
          zombieWander.delete(zId);
          setTimeout(() => {
            const newId = `z_${zombieIdCounter++}`;
            zombies[newId] = { id: newId, x: Math.random() * 4000 - 2000, y: Math.random() * 4000 - 2000, rotation: 0, health: 50, targetId: null };
          }, 3000);
        }
        break;
      }
    }
  }

  // Clean up expired sounds
  for (let i = sounds.length - 1; i >= 0; i--) {
    sounds[i].ticksRemaining--;
    if (sounds[i].ticksRemaining <= 0) {
      sounds.splice(i, 1);
    }
  }

  const snapshot: GameSnapshot = {
    time: Date.now(),
    worldTime,
    players,
    bullets,
    zombies,
    items,
    sounds: [...sounds],
  };

  const payload = JSON.stringify({ type: 'snapshot', snapshot });
  wss.clients.forEach(client => {
    if (client.readyState === WebSocket.OPEN) client.send(payload);
  });
}, 1000 / TICK_RATE);

setInterval(() => {
  worldTime += 0.002;
  if (worldTime >= 24) worldTime -= 24;

  for (const id in players) {
    const player = players[id];
    player.hunger = Math.max(0, player.hunger - 0.2);
    player.thirst = Math.max(0, player.thirst - 0.4);

    if (player.hunger === 0 || player.thirst === 0) {
      player.health -= 2;
    }

    if (player.health <= 0) {
      modManager.emit('playerDeath', player);
      player.x = 0; player.y = 0; player.health = 100;
      player.hunger = 100; player.thirst = 100;
      player.inventory = { items: [], currentWeight: 0, maxWeight: 20 };
    }
  }
}, 1000);

modManager.loadMods({
  getPlayers: () => players as any,
  spawnItem: (x, y, type) => {
    items[`i_${itemIdCounter}`] = { id: `i_${itemIdCounter}`, x, y, type: type as ItemType };
    itemIdCounter++;
  }
}).then(() => {
  server.listen(PORT, () => {
    console.log(`Server listening on port ${PORT}`);
  });
});
