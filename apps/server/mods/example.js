export function register(api) {
  api.on('playerJoin', (player) => {
    console.log(`[Mod: GodMode] Player joined! Granting infinite health and ammo to ${player.id}`);
    player.health = 99999;
    player.inventory.ammo = 5000;
  });

  api.on('zombieDeath', (zombie) => {
    console.log(`[Mod: GodMode] Zombie ${zombie.id} died! Spawning a health pack.`);
    api.spawnItem(zombie.x, zombie.y, 'health');
  });
}
