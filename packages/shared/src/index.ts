export type PlayerState = {
  id: string;
  x: number;
  y: number;
  rotation: number;
  health: number;
  hunger: number;
  thirst: number;
  temperature: number;
  lastProcessedInput: number;
  inventory: {
    items: { id: string; type: string; weight: number }[];
    currentWeight: number;
    maxWeight: number;
  };
};

export type BulletState = {
  id: string;
  x: number;
  y: number;
  vx: number;
  vy: number;
  ownerId: string;
  distanceTraveled: number;
  maxRange: number;
};

export type ZombieState = {
  id: string;
  x: number;
  y: number;
  rotation: number;
  health: number;
  targetId: string | null;
};

export type ItemType = 'health' | 'ammo' | 'weapon' | 'cloth' | 'medkit' | 'food' | 'water' | 'pistol' | 'shotgun' | 'bat' | 'axe' | 'crowbar' | 'knife';

export type ItemState = {
  id: string;
  x: number;
  y: number;
  type: ItemType;
};

export type SoundEvent = {
  x: number;
  y: number;
  radius: number;
  ticksRemaining: number;
};

export type GameSnapshot = {
  time: number;
  worldTime: number;
  players: Record<string, PlayerState>;
  bullets: Record<string, BulletState>;
  zombies: Record<string, ZombieState>;
  items: Record<string, ItemState>;
  sounds: SoundEvent[];
};

export type PlayerInput = {
  seq: number;
  up: boolean;
  down: boolean;
  left: boolean;
  right: boolean;
  mouseX: number;
  mouseY: number;
  isShooting: boolean;
  isInteracting: boolean;
  isBuilding: boolean;
  buildTargetX: number;
  buildTargetY: number;
  isCrafting: boolean;
  craftRecipeId: string;
  isDroppingItem: boolean;
  dropItemId: string;
  isUsingItem: boolean;
  useItemId: string;
};

export type CraftRecipe = {
  id: string;
  name: string;
  description: string;
  ingredients: { type: string; count: number }[];
  result: { type: string; count: number };
};

export const RECIPES: CraftRecipe[] = [
  { id: 'medkit', name: 'Medkit', description: 'Heal 50 HP', ingredients: [{ type: 'health', count: 2 }], result: { type: 'medkit', count: 1 } },
  { id: 'bandage', name: 'Bandage', description: 'Heal 25 HP', ingredients: [{ type: 'cloth', count: 2 }], result: { type: 'health', count: 1 } },
  { id: 'meal', name: 'Cooked Meal', description: 'Restore 50 hunger', ingredients: [{ type: 'food', count: 2 }], result: { type: 'food', count: 1 } },
];

export const TILE_SIZE = 50;
export const CHUNK_SIZE = 16;

export type ChunkData = {
  x: number;
  y: number;
  tiles: number[][];
};

export type ModEvent = {
  type: string;
  payload: any;
};
