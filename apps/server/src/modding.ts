import fs from 'fs';
import path from 'path';

export type ModAPI = {
  on: (event: string, callback: (...args: any[]) => void) => void;
  getPlayers: () => Map<string, any>;
  spawnItem: (x: number, y: number, type: string) => void;
};

export class ModManager {
  private hooks = new Map<string, Function[]>();
  private modsDir: string;

  constructor(modsDir: string) {
    this.modsDir = modsDir;
    if (!fs.existsSync(this.modsDir)) {
      fs.mkdirSync(this.modsDir, { recursive: true });
    }
  }

  public async loadMods(apiObj: Omit<ModAPI, 'on'>) {
    const api: ModAPI = {
      ...apiObj,
      on: (event: string, callback: Function) => {
        if (!this.hooks.has(event)) this.hooks.set(event, []);
        this.hooks.get(event)!.push(callback);
        console.log(`[ModManager] Hook registered: ${event}`);
      }
    };

    const files = fs.readdirSync(this.modsDir).filter(f => f.endsWith('.js'));
    for (const file of files) {
      try {
        const modPath = path.resolve(this.modsDir, file);
        const mod = await import(`file://${modPath}`);
        if (mod.register) {
          mod.register(api);
          console.log(`[ModManager] Loaded mod: ${file}`);
        }
      } catch (err) {
        console.error(`[ModManager] Failed to load mod: ${file}`, err);
      }
    }
  }

  public emit(event: string, ...args: any[]) {
    const callbacks = this.hooks.get(event);
    if (callbacks) {
      for (const cb of callbacks) {
        try {
          cb(...args);
        } catch (e) {
          console.error(`[ModManager] Error in mod hook for event: ${event}`, e);
        }
      }
    }
  }
}
