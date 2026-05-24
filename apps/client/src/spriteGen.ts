import { Texture } from 'pixi.js';

// ========================================================================
// Color helpers
// ========================================================================
function hexToCSS(color: number): string {
  return '#' + color.toString(16).padStart(6, '0');
}

function lerpColor(a: number, b: number, t: number): number {
  const ar = (a >> 16) & 0xff, ag = (a >> 8) & 0xff, ab = a & 0xff;
  const br = (b >> 16) & 0xff, bg = (b >> 8) & 0xff, bb = b & 0xff;
  const r = Math.round(ar + (br - ar) * t);
  const g = Math.round(ag + (bg - ag) * t);
  const b2 = Math.round(ab + (bb - ab) * t);
  return (r << 16) | (g << 8) | b2;
}

function createCanvasTexture(width: number, height: number, draw: (ctx: CanvasRenderingContext2D) => void): Texture {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d')!;
  draw(ctx);
  return Texture.from(canvas);
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}

// ========================================================================
// Character drawing — Project Zomboid inspired
// ========================================================================

interface CharColors {
  skin: string; skinShadow: string; skinHighlight: string;
  shirt: string; shirtShadow: string; shirtHighlight: string;
  pants: string; pantsShadow: string;
  shoes: string; shoesShadow: string;
  hair: string; hairHighlight: string; hairShadow: string;
  backpack: string; backpackShadow: string;
  belt: string; beltBuckle: string;
}

const SKIN_TONES: string[] = ['#e8b88a', '#d4a88a', '#f0c8a0', '#c89870', '#e0b090'];
const HAIR_COLORS: string[] = ['#5a3a2a', '#2a1a0a', '#8a6a3a', '#3a2a1a', '#4a3a2a'];

function getCharColors(bodyColor: number, seed?: number): CharColors {
  const s = seed ?? bodyColor;
  const skinIdx = ((s * 7) % 100) % SKIN_TONES.length;
  const hairIdx = ((s * 13) % 100) % HAIR_COLORS.length;
  const skinBase = SKIN_TONES[Math.abs(skinIdx)];
  const hairBase = HAIR_COLORS[Math.abs(hairIdx)];
  const baseNum = bodyColor;
  const baseHex = hexToCSS(baseNum);

  return {
    skin: skinBase,
    skinShadow: hexToCSS(lerpColor(parseInt(skinBase.replace('#',''), 16), 0x000000, 0.3)),
    skinHighlight: hexToCSS(lerpColor(parseInt(skinBase.replace('#',''), 16), 0xffffff, 0.2)),
    shirt: baseHex,
    shirtShadow: hexToCSS(lerpColor(baseNum, 0x000000, 0.35)),
    shirtHighlight: hexToCSS(lerpColor(baseNum, 0xffffff, 0.15)),
    pants: '#3a4a5a',
    pantsShadow: '#2a3a4a',
    shoes: '#2a2a2a',
    shoesShadow: '#1a1a1a',
    hair: hairBase,
    hairHighlight: hexToCSS(lerpColor(parseInt(hairBase.replace('#',''), 16), 0xffffff, 0.2)),
    hairShadow: hexToCSS(lerpColor(parseInt(hairBase.replace('#',''), 16), 0x000000, 0.3)),
    backpack: '#5a6a3a',
    backpackShadow: '#4a5a2a',
    belt: '#3a2a1a',
    beltBuckle: '#ccaa44',
  };
}

function drawGroundShadow(ctx: CanvasRenderingContext2D, cx: number, cy: number, rx: number, ry: number) {
  ctx.save();
  ctx.shadowColor = 'rgba(0,0,0,0.4)';
  ctx.shadowBlur = 14;
  ctx.fillStyle = 'rgba(0,0,0,0.15)';
  ctx.beginPath();
  ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function drawOutlinedEllipse(ctx: CanvasRenderingContext2D, cx: number, cy: number, rx: number, ry: number, fill: string | CanvasGradient) {
  ctx.fillStyle = fill;
  ctx.beginPath();
  ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = 'rgba(0,0,0,0.25)';
  ctx.lineWidth = 1;
  ctx.stroke();
}

// ========================================================================
// CHARACTER TEXTURE
// ========================================================================
export function generateCharacterTexture(bodyColor: number): Texture {
  return createCanvasTexture(128, 144, (ctx) => {
    const cx = 64;
    const c = getCharColors(bodyColor);

    // Ground shadow
    drawGroundShadow(ctx, cx, 138, 34, 10);

    // ============= BACKPACK =============
    ctx.fillStyle = c.backpackShadow;
    roundRect(ctx, cx - 24, 40, 14, 28, 4);
    ctx.fill();
    ctx.fillStyle = c.backpack;
    roundRect(ctx, cx - 23, 41, 12, 26, 3);
    ctx.fill();
    // Backpack pocket
    ctx.fillStyle = c.backpackShadow;
    roundRect(ctx, cx - 22, 46, 10, 8, 2);
    ctx.fill();
    ctx.fillStyle = c.backpack;
    roundRect(ctx, cx - 21, 47, 8, 6, 1);
    ctx.fill();
    // Straps visible over shoulders
    ctx.strokeStyle = c.backpackShadow;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(cx - 14, 42);
    ctx.lineTo(cx - 4, 50);
    ctx.stroke();

    // ============= LEGS =============
    // Left leg shadow
    const llGrad = ctx.createLinearGradient(cx - 16, 90, cx - 4, 130);
    llGrad.addColorStop(0, c.pantsShadow);
    llGrad.addColorStop(0.4, c.pants);
    llGrad.addColorStop(1, c.pantsShadow);
    roundRect(ctx, cx - 16, 90, 12, 38, 4);
    ctx.fillStyle = llGrad;
    ctx.fill();
    ctx.strokeStyle = 'rgba(0,0,0,0.2)';
    ctx.lineWidth = 1;
    ctx.stroke();
    // Left leg pocket
    ctx.fillStyle = 'rgba(0,0,0,0.12)';
    roundRect(ctx, cx - 15, 96, 10, 8, 1);
    ctx.fill();
    ctx.strokeStyle = 'rgba(0,0,0,0.15)';
    ctx.lineWidth = 0.5;
    ctx.strokeRect(cx - 14, 96, 8, 7);

    // Right leg shadow
    const rlGrad = ctx.createLinearGradient(cx + 4, 90, cx + 16, 130);
    rlGrad.addColorStop(0, c.pantsShadow);
    rlGrad.addColorStop(0.4, c.pants);
    rlGrad.addColorStop(1, c.pantsShadow);
    roundRect(ctx, cx + 4, 90, 12, 38, 4);
    ctx.fillStyle = rlGrad;
    ctx.fill();
    ctx.stroke();
    // Right leg pocket
    ctx.fillStyle = 'rgba(0,0,0,0.12)';
    roundRect(ctx, cx + 5, 96, 10, 8, 1);
    ctx.fill();
    ctx.strokeStyle = 'rgba(0,0,0,0.15)';
    ctx.lineWidth = 0.5;
    ctx.strokeRect(cx + 6, 96, 8, 7);

    // Knee details
    ctx.fillStyle = 'rgba(0,0,0,0.08)';
    roundRect(ctx, cx - 15, 108, 10, 4, 1);
    ctx.fill();
    roundRect(ctx, cx + 5, 108, 10, 4, 1);
    ctx.fill();

    // ============= SHOES =============
    ctx.fillStyle = c.shoesShadow;
    roundRect(ctx, cx - 18, 126, 14, 8, 3);
    ctx.fill();
    roundRect(ctx, cx + 4, 126, 14, 8, 3);
    ctx.fill();
    ctx.fillStyle = c.shoes;
    roundRect(ctx, cx - 17, 126, 12, 7, 2);
    ctx.fill();
    roundRect(ctx, cx + 5, 126, 12, 7, 2);
    ctx.fill();
    // Sole highlight
    ctx.fillStyle = 'rgba(80,80,80,0.3)';
    roundRect(ctx, cx - 17, 131, 12, 2, 1);
    ctx.fill();
    roundRect(ctx, cx + 5, 131, 12, 2, 1);
    ctx.fill();

    // ============= TORSO =============
    const torsoGrad = ctx.createLinearGradient(cx - 20, 48, cx + 20, 90);
    torsoGrad.addColorStop(0, c.shirtHighlight);
    torsoGrad.addColorStop(0.2, c.shirt);
    torsoGrad.addColorStop(0.8, c.shirt);
    torsoGrad.addColorStop(1, c.shirtShadow);
    roundRect(ctx, cx - 20, 48, 40, 40, 6);
    ctx.fillStyle = torsoGrad;
    ctx.fill();
    ctx.strokeStyle = 'rgba(0,0,0,0.2)';
    ctx.lineWidth = 1;
    ctx.stroke();

    // Collar
    ctx.fillStyle = c.shirtShadow;
    ctx.beginPath();
    ctx.moveTo(cx - 8, 48);
    ctx.lineTo(cx, 54);
    ctx.lineTo(cx + 8, 48);
    ctx.closePath();
    ctx.fill();

    // Buttons
    ctx.fillStyle = 'rgba(0,0,0,0.25)';
    for (let i = 0; i < 4; i++) {
      const by = 54 + i * 7;
      ctx.beginPath();
      ctx.arc(cx, by, 1.5, 0, Math.PI * 2);
      ctx.fill();
    }

    // Left chest pocket
    ctx.strokeStyle = 'rgba(0,0,0,0.15)';
    ctx.lineWidth = 0.5;
    roundRect(ctx, cx - 16, 54, 10, 8, 1);
    ctx.stroke();

    // ============= BELT =============
    ctx.fillStyle = c.belt;
    roundRect(ctx, cx - 18, 86, 36, 5, 1);
    ctx.fill();
    // Belt buckle
    ctx.fillStyle = c.beltBuckle;
    roundRect(ctx, cx - 3, 86, 6, 5, 1);
    ctx.fill();

    // ============= ARMS =============
    // Left arm
    const laGrad = ctx.createLinearGradient(cx - 22, 48, cx - 10, 90);
    laGrad.addColorStop(0, c.shirtShadow);
    laGrad.addColorStop(0.3, c.shirt);
    laGrad.addColorStop(0.5, c.shirt);
    laGrad.addColorStop(1, c.skinShadow);
    roundRect(ctx, cx - 22, 48, 10, 38, 4);
    ctx.fillStyle = laGrad;
    ctx.fill();
    ctx.strokeStyle = 'rgba(0,0,0,0.2)';
    ctx.lineWidth = 1;
    ctx.stroke();

    // Right arm
    const raGrad = ctx.createLinearGradient(cx + 12, 48, cx + 24, 90);
    raGrad.addColorStop(0, c.shirtShadow);
    raGrad.addColorStop(0.3, c.shirt);
    raGrad.addColorStop(0.5, c.shirt);
    raGrad.addColorStop(1, c.skinShadow);
    roundRect(ctx, cx + 12, 48, 10, 38, 4);
    ctx.fillStyle = raGrad;
    ctx.fill();
    ctx.stroke();

    // Hands
    const handGradL = ctx.createRadialGradient(cx - 17, 88, 2, cx - 17, 88, 6);
    handGradL.addColorStop(0, c.skinHighlight);
    handGradL.addColorStop(0.5, c.skin);
    handGradL.addColorStop(1, c.skinShadow);
    drawOutlinedEllipse(ctx, cx - 17, 88, 5, 6, handGradL);

    const handGradR = ctx.createRadialGradient(cx + 17, 88, 2, cx + 17, 88, 6);
    handGradR.addColorStop(0, c.skinHighlight);
    handGradR.addColorStop(0.5, c.skin);
    handGradR.addColorStop(1, c.skinShadow);
    drawOutlinedEllipse(ctx, cx + 17, 88, 5, 6, handGradR);

    // ============= NECK =============
    const neckGrad = ctx.createRadialGradient(cx, 42, 2, cx, 44, 8);
    neckGrad.addColorStop(0, c.skinHighlight);
    neckGrad.addColorStop(0.6, c.skin);
    neckGrad.addColorStop(1, c.skinShadow);
    ctx.fillStyle = neckGrad;
    roundRect(ctx, cx - 6, 40, 12, 10, 3);
    ctx.fill();
    ctx.strokeStyle = 'rgba(0,0,0,0.15)';
    ctx.lineWidth = 0.5;
    ctx.stroke();

    // ============= HEAD =============
    const headGrad = ctx.createRadialGradient(cx - 4, 24, 3, cx, 28, 16);
    headGrad.addColorStop(0, c.skinHighlight);
    headGrad.addColorStop(0.4, c.skin);
    headGrad.addColorStop(0.8, c.skin);
    headGrad.addColorStop(1, c.skinShadow);
    drawOutlinedEllipse(ctx, cx, 28, 14, 16, headGrad);

    // Jawline shadow
    ctx.fillStyle = 'rgba(0,0,0,0.08)';
    ctx.beginPath();
    ctx.ellipse(cx + 1, 36, 10, 6, 0, 0, Math.PI * 2);
    ctx.fill();

    // ============= FACIAL FEATURES =============
    // Eyes
    ctx.fillStyle = c.skinShadow;
    ctx.fillRect(cx - 6, 25, 4, 3);
    ctx.fillRect(cx + 2, 25, 4, 3);
    // Eye whites
    ctx.fillStyle = '#f0f0f0';
    ctx.fillRect(cx - 5, 25, 2, 2);
    ctx.fillRect(cx + 3, 25, 2, 2);
    // Pupils
    ctx.fillStyle = '#2a2a2a';
    ctx.fillRect(cx - 5, 25, 1, 2);
    ctx.fillRect(cx + 3, 25, 1, 2);

    // Eyebrows
    ctx.strokeStyle = c.hair;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(cx - 7, 22);
    ctx.lineTo(cx - 3, 21);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(cx + 7, 22);
    ctx.lineTo(cx + 3, 21);
    ctx.stroke();

    // Nose
    ctx.fillStyle = c.skinShadow;
    ctx.beginPath();
    ctx.moveTo(cx - 1, 28);
    ctx.lineTo(cx + 1, 28);
    ctx.lineTo(cx, 31);
    ctx.closePath();
    ctx.fill();

    // Mouth
    ctx.fillStyle = c.skinShadow;
    ctx.fillRect(cx - 3, 34, 6, 1.5);
    ctx.fillStyle = '#c97';
    ctx.fillRect(cx - 3, 34, 6, 0.5);

    // ============= HAIR =============
    // Base hair
    ctx.fillStyle = c.hair;
    ctx.beginPath();
    ctx.arc(cx, 16, 16, Math.PI, 0);
    ctx.fill();
    ctx.fillRect(cx - 16, 14, 32, 8);
    // Sides
    ctx.fillRect(cx - 16, 14, 6, 10);
    ctx.fillRect(cx + 10, 14, 6, 10);

    // Hair detail - strands
    ctx.fillStyle = c.hairShadow;
    ctx.fillRect(cx - 10, 8, 3, 8);
    ctx.fillRect(cx - 2, 6, 3, 10);
    ctx.fillRect(cx + 6, 8, 3, 8);

    // Hair highlight
    ctx.fillStyle = c.hairHighlight;
    ctx.fillRect(cx - 8, 10, 2, 6);
    ctx.fillRect(cx + 2, 8, 2, 8);
    ctx.fillRect(cx + 8, 10, 2, 6);

    // ============= EQUIPMENT: Weapon (pistol in right hand) =============
    ctx.fillStyle = '#333';
    roundRect(ctx, cx + 20, 76, 14, 4, 2);
    ctx.fill();
    ctx.fillStyle = '#555';
    roundRect(ctx, cx + 22, 78, 8, 6, 2);
    ctx.fill();
    ctx.fillStyle = '#222';
    roundRect(ctx, cx + 26, 85, 4, 4, 1);
    ctx.fill();
  });
}

// ========================================================================
// ZOMBIE TEXTURES — 8 variants with gore and decay
// ========================================================================

interface ZombieVariant {
  skin: string;
  shirt: string;
  pants: string;
  hair: string;
  hairStyle: 'bald' | 'messy' | 'long' | 'mohawk' | 'short';
  gore: number; // 0-3
  special: 'none' | 'military' | 'missing_arm' | 'hazmat' | 'firefighter' | 'prisoner';
  glowColor: string;
}

const ZOMBIE_VARIANTS: ZombieVariant[] = [
  { skin: '#9aab8a', shirt: '#6a4a3a', pants: '#4a3a2a', hair: '#3a2a1a', hairStyle: 'messy', gore: 1, special: 'none', glowColor: '#ffaa33' },
  { skin: '#8a9a7a', shirt: '#5a3a2a', pants: '#3a3a2a', hair: '#2a1a0a', hairStyle: 'bald', gore: 2, special: 'military', glowColor: '#ff6644' },
  { skin: '#7a8a6a', shirt: '#7a5a3a', pants: '#5a4a3a', hair: '#4a2a1a', hairStyle: 'long', gore: 3, special: 'missing_arm', glowColor: '#aaff44' },
  { skin: '#5a6a4a', shirt: '#4a2a1a', pants: '#3a2a1a', hair: '#1a0a0a', hairStyle: 'mohawk', gore: 2, special: 'hazmat', glowColor: '#44ff88' },
  { skin: '#9a8a7a', shirt: '#3a4a3a', pants: '#2a3a2a', hair: '#3a2a1a', hairStyle: 'short', gore: 1, special: 'firefighter', glowColor: '#ff8844' },
  { skin: '#8a7a6a', shirt: '#5a4a3a', pants: '#4a3a3a', hair: '#2a1a0a', hairStyle: 'messy', gore: 3, special: 'none', glowColor: '#44ccff' },
  { skin: '#7a6a5a', shirt: '#6a3a2a', pants: '#4a2a2a', hair: '#1a0a0a', hairStyle: 'bald', gore: 2, special: 'prisoner', glowColor: '#ff4444' },
  { skin: '#6a5a4a', shirt: '#3a3a4a', pants: '#2a2a3a', hair: '#2a1a0a', hairStyle: 'long', gore: 1, special: 'none', glowColor: '#ffaa88' },
];

export function generateZombieTexture(variant: number = 0): Texture {
  const v = ZOMBIE_VARIANTS[variant % ZOMBIE_VARIANTS.length];
  const skinNum = parseInt(v.skin.replace('#', ''), 16);
  const shirtNum = parseInt(v.shirt.replace('#', ''), 16);

  return withSeededRandom(variant * 7919 + 1, () => createCanvasTexture(128, 144, (ctx) => {
    const cx = 64;

    // Ground shadow (lighter for zombies - they're lighter)
    drawGroundShadow(ctx, cx, 138, 30, 8);

    // ============= LEGS (torn) =============
    // Left leg
    const llGrad = ctx.createLinearGradient(cx - 16, 90, cx - 4, 130);
    llGrad.addColorStop(0, v.pants);
    llGrad.addColorStop(1, hexToCSS(lerpColor(parseInt(v.pants.replace('#',''), 16), 0x000000, 0.4)));
    roundRect(ctx, cx - 16, 90, 12, 38, 4);
    ctx.fillStyle = llGrad;
    ctx.fill();

    // Torn holes in pants
    ctx.fillStyle = hexToCSS(lerpColor(parseInt(v.pants.replace('#',''), 16), 0x000000, 0.6));
    if (v.gore >= 2) {
      ctx.fillRect(cx - 14, 100, 4, 3);
      ctx.fillRect(cx - 10, 115, 3, 4);
    }

    // Right leg
    const rlGrad = ctx.createLinearGradient(cx + 4, 90, cx + 16, 130);
    rlGrad.addColorStop(0, v.pants);
    rlGrad.addColorStop(1, hexToCSS(lerpColor(parseInt(v.pants.replace('#',''), 16), 0x000000, 0.4)));
    roundRect(ctx, cx + 4, 90, 12, 38, 4);
    ctx.fillStyle = rlGrad;
    ctx.fill();

    if (v.gore >= 2) {
      ctx.fillRect(cx + 6, 106, 4, 3);
      ctx.fillRect(cx + 10, 120, 3, 4);
    }

    // Torn pants outline
    ctx.strokeStyle = 'rgba(0,0,0,0.3)';
    ctx.lineWidth = 1;
    ctx.strokeRect(cx - 16, 90, 12, 38);
    ctx.strokeRect(cx + 4, 90, 12, 38);

    // ============= SHOES (worn) =============
    ctx.fillStyle = '#2a2a2a';
    roundRect(ctx, cx - 18, 126, 14, 8, 3);
    ctx.fill();
    roundRect(ctx, cx + 4, 126, 14, 8, 3);
    ctx.fill();
    ctx.fillStyle = '#3a3a3a';
    roundRect(ctx, cx - 17, 126, 12, 7, 2);
    ctx.fill();
    roundRect(ctx, cx + 5, 126, 12, 7, 2);
    ctx.fill();

    // ============= ARMS =============
    const armGradL = ctx.createLinearGradient(cx - 22, 48, cx - 10, 88);
    armGradL.addColorStop(0, v.shirt);
    armGradL.addColorStop(0.5, v.shirt);
    armGradL.addColorStop(1, v.skin);

    if (v.special === 'missing_arm') {
      // Left arm is missing - just a stump
      roundRect(ctx, cx - 22, 48, 10, 12, 4);
      ctx.fillStyle = armGradL;
      ctx.fill();
      // Blood on stump
      ctx.fillStyle = '#6a1a1a';
      ctx.beginPath();
      ctx.arc(cx - 17, 60, 5, 0, Math.PI * 2);
      ctx.fill();
    } else {
      roundRect(ctx, cx - 22, 48, 10, 38, 4);
      ctx.fillStyle = armGradL;
      ctx.fill();
      ctx.strokeStyle = 'rgba(0,0,0,0.25)';
      ctx.lineWidth = 1;
      ctx.stroke();
    }

    // Right arm
    const armGradR = ctx.createLinearGradient(cx + 12, 48, cx + 24, 88);
    armGradR.addColorStop(0, v.shirt);
    armGradR.addColorStop(0.5, v.shirt);
    armGradR.addColorStop(1, v.skin);
    roundRect(ctx, cx + 12, 48, 10, 38, 4);
    ctx.fillStyle = armGradR;
    ctx.fill();
    ctx.stroke();

    // Hands (pale, skeletal)
    const handGradL = ctx.createRadialGradient(cx - 17, 88, 2, cx - 17, 88, 6);
    handGradL.addColorStop(0, v.skin);
    handGradL.addColorStop(1, hexToCSS(lerpColor(skinNum, 0x000000, 0.4)));
    if (v.special !== 'missing_arm') {
      drawOutlinedEllipse(ctx, cx - 17, 88, 5, 6, handGradL);
    }
    const handGradR = ctx.createRadialGradient(cx + 17, 88, 2, cx + 17, 88, 6);
    handGradR.addColorStop(0, v.skin);
    handGradR.addColorStop(1, hexToCSS(lerpColor(skinNum, 0x000000, 0.4)));
    drawOutlinedEllipse(ctx, cx + 17, 88, 5, 6, handGradR);

    // ============= TORSO (tattered) =============
    const torsoGrad = ctx.createLinearGradient(cx - 20, 48, cx + 20, 90);
    torsoGrad.addColorStop(0, hexToCSS(lerpColor(shirtNum, 0xffffff, 0.1)));
    torsoGrad.addColorStop(0.3, v.shirt);
    torsoGrad.addColorStop(0.8, v.shirt);
    torsoGrad.addColorStop(1, hexToCSS(lerpColor(shirtNum, 0x000000, 0.3)));
    roundRect(ctx, cx - 20, 48, 40, 40, 6);
    ctx.fillStyle = torsoGrad;
    ctx.fill();
    ctx.stroke();

    // Special clothing
    if (v.special === 'military') {
      // Molle vest
      ctx.fillStyle = 'rgba(50,70,30,0.6)';
      roundRect(ctx, cx - 19, 50, 38, 26, 4);
      ctx.fill();
      // Pockets on vest
      ctx.fillStyle = 'rgba(60,80,40,0.5)';
      roundRect(ctx, cx - 16, 54, 12, 8, 2);
      ctx.fill();
      roundRect(ctx, cx + 4, 54, 12, 8, 2);
      ctx.fill();
    } else if (v.special === 'hazmat') {
      // Hazmat suit (bright)
      ctx.fillStyle = 'rgba(200,200,80,0.4)';
      roundRect(ctx, cx - 19, 48, 38, 40, 5);
      ctx.fill();
      ctx.strokeStyle = 'rgba(200,200,80,0.6)';
      ctx.lineWidth = 1;
      roundRect(ctx, cx - 19, 48, 38, 40, 5);
      ctx.stroke();
    } else if (v.special === 'firefighter') {
      // Firefighter jacket
      ctx.fillStyle = 'rgba(200,80,40,0.5)';
      roundRect(ctx, cx - 19, 48, 38, 36, 5);
      ctx.fill();
      // Reflective stripes
      ctx.fillStyle = 'rgba(255,255,200,0.5)';
      ctx.fillRect(cx - 16, 60, 32, 2);
      ctx.fillRect(cx - 16, 74, 32, 2);
    } else if (v.special === 'prisoner') {
      // Prisoner stripes
      ctx.fillStyle = 'rgba(255,255,255,0.1)';
      for (let i = 0; i < 6; i++) {
        ctx.fillRect(cx - 18 + i * 7, 50, 3, 36);
      }
    }

    // Torn holes in shirt
    if (v.gore >= 1) {
      ctx.fillStyle = hexToCSS(lerpColor(shirtNum, 0x000000, 0.5));
      ctx.fillRect(cx - 8, 56, 4, 3);
      ctx.fillRect(cx + 4, 64, 3, 4);
    }
    if (v.gore >= 2) {
      ctx.fillRect(cx - 12, 70, 3, 5);
      ctx.fillRect(cx + 6, 54, 3, 4);
    }

    // ============= NECK =============
    const neckGrad = ctx.createRadialGradient(cx, 42, 2, cx, 44, 8);
    neckGrad.addColorStop(0, v.skin);
    neckGrad.addColorStop(1, hexToCSS(lerpColor(skinNum, 0x000000, 0.3)));
    ctx.fillStyle = neckGrad;
    roundRect(ctx, cx - 6, 40, 12, 10, 3);
    ctx.fill();
    ctx.strokeStyle = 'rgba(0,0,0,0.2)';
    ctx.lineWidth = 0.5;
    ctx.stroke();

    // ============= HEAD =============
    const headGrad = ctx.createRadialGradient(cx - 3, 24, 3, cx, 28, 16);
    headGrad.addColorStop(0, v.skin);
    headGrad.addColorStop(0.5, v.skin);
    headGrad.addColorStop(1, hexToCSS(lerpColor(skinNum, 0x000000, 0.3)));
    drawOutlinedEllipse(ctx, cx, 28, 14, 16, headGrad);

    // Sunken cheeks
    ctx.fillStyle = hexToCSS(lerpColor(skinNum, 0x000000, 0.3));
    ctx.fillRect(cx - 12, 28, 4, 6);
    ctx.fillRect(cx + 8, 28, 4, 6);

    // ============= HAIR =============
    ctx.fillStyle = v.hair;
    if (v.hairStyle === 'bald') {
      // Patchy bald
      ctx.fillStyle = hexToCSS(lerpColor(skinNum, 0x000000, 0.2));
      ctx.beginPath();
      ctx.arc(cx, 16, 15, Math.PI, 0);
      ctx.fill();
    } else if (v.hairStyle === 'messy') {
      ctx.beginPath();
      ctx.arc(cx, 16, 16, Math.PI, 0);
      ctx.fill();
      ctx.fillRect(cx - 16, 14, 32, 8);
      // Messy strands
      ctx.fillStyle = hexToCSS(lerpColor(parseInt(v.hair.replace('#',''), 16), 0x000000, 0.3));
      for (let i = 0; i < 6; i++) {
        const sx = cx - 12 + i * 5 + Math.random() * 3;
        ctx.fillRect(sx, 4 + Math.random() * 4, 2, 10 + Math.random() * 6);
      }
    } else if (v.hairStyle === 'long') {
      ctx.beginPath();
      ctx.arc(cx, 16, 16, Math.PI, 0);
      ctx.fill();
      ctx.fillRect(cx - 16, 14, 32, 8);
      // Long strands down sides
      ctx.fillRect(cx - 16, 18, 4, 16);
      ctx.fillRect(cx + 12, 18, 4, 16);
      ctx.fillRect(cx - 14, 20, 3, 12);
      ctx.fillRect(cx + 11, 20, 3, 12);
    } else if (v.hairStyle === 'mohawk') {
      // Mohawk
      ctx.fillRect(cx - 4, 4, 8, 22);
      ctx.fillRect(cx - 6, 8, 12, 4);
      ctx.fillRect(cx - 5, 4, 10, 4);
    } else if (v.hairStyle === 'short') {
      ctx.beginPath();
      ctx.arc(cx, 18, 14, Math.PI, 0);
      ctx.fill();
    }

    // ============= FACE =============
    // Sunken eyes (dark hollows)
    ctx.fillStyle = '#1a1a0a';
    ctx.fillRect(cx - 7, 24, 5, 4);
    ctx.fillRect(cx + 2, 24, 5, 4);
    // Glowing eyes
      ctx.fillStyle = v.glowColor;
    const glow = ctx.shadowColor;
    ctx.save();
    ctx.shadowColor = v.glowColor;
    ctx.shadowBlur = 6;
    ctx.fillRect(cx - 5, 25, 2, 2);
    ctx.fillRect(cx + 3, 25, 2, 2);
    ctx.restore();
    ctx.shadowColor = glow;

    // Open mouth wound
    ctx.fillStyle = '#3a1a0a';
    ctx.fillRect(cx - 4, 33, 8, 3);
    ctx.fillStyle = '#5a2a1a';
    ctx.fillRect(cx - 3, 34, 6, 1);

    // ============= GORE =============
    if (v.gore >= 1) {
      // Blood splatters on body
      ctx.fillStyle = 'rgba(138, 26, 26, 0.6)';
      ctx.fillRect(cx - 14, 50, 6, 2);
      ctx.fillRect(cx + 8, 58, 5, 2);
      ctx.fillRect(cx - 10, 68, 4, 3);
      ctx.fillRect(cx + 4, 76, 3, 2);
    }
    if (v.gore >= 2) {
      // More blood
      ctx.fillStyle = 'rgba(138, 26, 26, 0.8)';
      ctx.beginPath();
      ctx.arc(cx - 6, 62, 4, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillRect(cx + 6, 70, 6, 3);
      ctx.fillRect(cx - 16, 78, 4, 2);
      ctx.fillStyle = 'rgba(100, 20, 20, 0.5)';
      ctx.fillRect(cx - 4, 100, 8, 2);
    }
    if (v.gore >= 3) {
      // Heavy gore
      ctx.fillStyle = '#6a1a1a';
      ctx.beginPath();
      ctx.arc(cx + 2, 56, 6, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillRect(cx - 18, 62, 6, 4);
      ctx.fillRect(cx + 12, 64, 4, 6);
      ctx.fillStyle = 'rgba(100, 20, 20, 0.6)';
      ctx.beginPath();
      ctx.arc(cx - 10, 82, 5, 0, Math.PI * 2);
      ctx.fill();
    }
  }));
}

// ========================================================================
// TILE TEXTURES
// ========================================================================
const TILE_SIZE = 50;

export type TileVariant = 'grass' | 'dirt' | 'pavement' | 'road' | 'woodfloor' | 'carpet' | 'wall_wood' | 'wall_brick' | 'wall_concrete' | 'gravel';

function withSeededRandom<T>(seed: number, fn: () => T): T {
  const orig = Math.random;
  let state = ((seed * 1664525 + 1013904223) | 0) >>> 0;
  Math.random = function () {
    state = (state * 1664525 + 1013904223) >>> 0;
    return state / 4294967296;
  } as typeof Math.random;
  try { return fn(); }
  finally { Math.random = orig; }
}

function addNoise(ctx: CanvasRenderingContext2D, count: number, color: string, maxSize: number) {
  ctx.fillStyle = color;
  for (let i = 0; i < count; i++) {
    const s = 1 + Math.random() * maxSize;
    ctx.fillRect(Math.random() * TILE_SIZE, Math.random() * TILE_SIZE, s, s * 0.5);
  }
}

function drawGrassTile(ctx: CanvasRenderingContext2D, variant: number) {
  const baseColors = ['#3a5a2a', '#4a6a2a', '#2a4a1a', '#3a6a2a', '#4a5a3a'];
  const base = baseColors[((variant % baseColors.length) + baseColors.length) % baseColors.length];
  const baseNum = parseInt(base.replace('#',''), 16);

  // Base with slight gradient
  const grd = ctx.createLinearGradient(0, 0, TILE_SIZE, TILE_SIZE);
  grd.addColorStop(0, base);
  grd.addColorStop(0.5, hexToCSS(lerpColor(baseNum, 0x88aa44, 0.1)));
  grd.addColorStop(1, hexToCSS(lerpColor(baseNum, 0x000000, 0.1)));
  ctx.fillStyle = grd;
  ctx.fillRect(0, 0, TILE_SIZE, TILE_SIZE);

  // Grass blades
  ctx.strokeStyle = hexToCSS(lerpColor(baseNum, 0x88cc44, 0.3));
  ctx.lineWidth = 1;
  for (let i = 0; i < 50; i++) {
    const x = Math.random() * TILE_SIZE;
    const y = Math.random() * TILE_SIZE;
    const h = 2 + Math.random() * 5;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.quadraticCurveTo(x + (Math.random() - 0.5) * 3, y - h * 0.6, x + (Math.random() - 0.5) * 2, y - h);
    ctx.stroke();
  }

  // Dark grass patches
  ctx.fillStyle = 'rgba(0,0,0,0.06)';
  for (let i = 0; i < 8; i++) {
    const px = Math.random() * TILE_SIZE;
    const py = Math.random() * TILE_SIZE;
    ctx.beginPath();
    ctx.ellipse(px, py, 3 + Math.random() * 6, 2 + Math.random() * 4, 0, 0, Math.PI * 2);
    ctx.fill();
  }

  // Flowers
  if (variant % 3 === 0) {
    const fx = Math.random() * TILE_SIZE;
    const fy = Math.random() * TILE_SIZE;
    const fc = ['#ff6', '#f88', '#8ff', '#f8f', '#ff8'][((variant % 5) + 5) % 5];
    ctx.fillStyle = fc;
    ctx.beginPath();
    ctx.arc(fx, fy, 1.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(fx + 2, fy + 1, 1.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(fx + 1, fy - 1, 1.5, 0, Math.PI * 2);
    ctx.fill();
  }

  // Edge vignette
  borderVignette(ctx);
}

function drawDirtTile(ctx: CanvasRenderingContext2D, variant: number) {
  const colors = ['#6a5a3a', '#7a6a4a', '#5a4a2a'];
  const base = colors[((variant % colors.length) + colors.length) % colors.length];
  const baseNum = parseInt(base.replace('#',''), 16);

  const grd = ctx.createRadialGradient(TILE_SIZE * 0.3, TILE_SIZE * 0.3, 2, TILE_SIZE / 2, TILE_SIZE / 2, TILE_SIZE / 2);
  grd.addColorStop(0, hexToCSS(lerpColor(baseNum, 0xffffff, 0.08)));
  grd.addColorStop(0.5, base);
  grd.addColorStop(1, hexToCSS(lerpColor(baseNum, 0x000000, 0.15)));
  ctx.fillStyle = grd;
  ctx.fillRect(0, 0, TILE_SIZE, TILE_SIZE);

  // Pebbles
  for (let i = 0; i < 12; i++) {
    const shade = hexToCSS(lerpColor(baseNum, Math.random() > 0.5 ? 0xffffff : 0x000000, 0.15 + Math.random() * 0.2));
    ctx.fillStyle = shade;
    const s = 1 + Math.random() * 2.5;
    const px = Math.random() * TILE_SIZE;
    const py = Math.random() * TILE_SIZE;
    ctx.beginPath();
    ctx.ellipse(px, py, s, s * 0.6, Math.random() * Math.PI, 0, Math.PI * 2);
    ctx.fill();
  }

  addNoise(ctx, 15, 'rgba(0,0,0,0.05)', 3);
  borderVignette(ctx);
}

function drawPavementTile(ctx: CanvasRenderingContext2D, _variant: number) {
  ctx.fillStyle = '#6a6a6a';
  ctx.fillRect(0, 0, TILE_SIZE, TILE_SIZE);
  addNoise(ctx, 10, 'rgba(80,80,80,0.3)', 8);
  addNoise(ctx, 15, 'rgba(100,100,100,0.2)', 4);

  // Cracks
  ctx.strokeStyle = '#5a5a5a';
  ctx.lineWidth = 1;
  for (let i = 0; i < 4; i++) {
    const sx = Math.random() * TILE_SIZE;
    const sy = Math.random() * TILE_SIZE;
    ctx.beginPath();
    ctx.moveTo(sx, sy);
    for (let j = 0; j < 3; j++) {
      ctx.lineTo(sx + (Math.random() - 0.5) * 15, sy + (Math.random() - 0.5) * 15 + j * 5);
    }
    ctx.stroke();
  }

  // Expansion line
  ctx.strokeStyle = '#5a5a5a';
  ctx.lineWidth = 0.5;
  ctx.setLineDash([2, 8]);
  ctx.beginPath();
  ctx.moveTo(Math.random() > 0.5 ? TILE_SIZE / 2 : 0, 0);
  ctx.lineTo(Math.random() > 0.5 ? TILE_SIZE / 2 : 0, TILE_SIZE);
  ctx.stroke();
  ctx.setLineDash([]);

  borderVignette(ctx);
}

function drawRoadTile(ctx: CanvasRenderingContext2D) {
  const grd = ctx.createLinearGradient(0, 0, 0, TILE_SIZE);
  grd.addColorStop(0, '#4a4a4a');
  grd.addColorStop(0.5, '#555');
  grd.addColorStop(1, '#4a4a4a');
  ctx.fillStyle = grd;
  ctx.fillRect(0, 0, TILE_SIZE, TILE_SIZE);
  addNoise(ctx, 20, 'rgba(60,60,60,0.3)', 6);

  // Road center line (dashed)
  ctx.fillStyle = '#888';
  ctx.fillRect(TILE_SIZE / 2 - 1, 0, 2, TILE_SIZE * 0.4);
  ctx.fillRect(TILE_SIZE / 2 - 1, TILE_SIZE * 0.6, 2, TILE_SIZE * 0.4);

  borderVignette(ctx);
}

function drawWoodFloorTile(ctx: CanvasRenderingContext2D, variant: number) {
  const colors = ['#8a7a5a', '#9a8a6a', '#7a6a4a'];
  const base = colors[((variant % colors.length) + colors.length) % colors.length];
  const baseNum = parseInt(base.replace('#',''), 16);

  ctx.fillStyle = base;
  ctx.fillRect(0, 0, TILE_SIZE, TILE_SIZE);

  // Plank lines
  ctx.strokeStyle = hexToCSS(lerpColor(baseNum, 0x000000, 0.25));
  ctx.lineWidth = 1;
  for (let i = 0; i < 4; i++) {
    const y = i * 12 + 6;
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(TILE_SIZE, y);
    ctx.stroke();
  }

  // Wood grain
  ctx.strokeStyle = hexToCSS(lerpColor(baseNum, 0x000000, 0.1));
  ctx.lineWidth = 0.5;
  for (let i = 0; i < 12; i++) {
    const x = Math.random() * TILE_SIZE;
    const y = Math.random() * TILE_SIZE;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.quadraticCurveTo(x + 5 + Math.random() * 10, y + (Math.random() - 0.5) * 3, x + 10 + Math.random() * 15, y + (Math.random() - 0.5) * 3);
    ctx.stroke();
  }

  // Nails
  ctx.fillStyle = '#666';
  for (let i = 0; i < 8; i++) {
    const nx = (i % 4) * 12 + 4 + (Math.random() - 0.5) * 2;
    const ny = Math.floor(i / 4) * 24 + 10 + (Math.random() - 0.5) * 2;
    ctx.beginPath();
    ctx.arc(nx, ny, 1, 0, Math.PI * 2);
    ctx.fill();
  }

  borderVignette(ctx);
}

function drawCarpetTile(ctx: CanvasRenderingContext2D, variant: number) {
  const colors = ['#6a3a4a', '#3a4a6a', '#4a6a3a', '#6a5a3a'];
  const base = colors[((variant % colors.length) + colors.length) % colors.length];
  const baseNum = parseInt(base.replace('#',''), 16);

  ctx.fillStyle = base;
  ctx.fillRect(0, 0, TILE_SIZE, TILE_SIZE);

  // Carpet texture
  addNoise(ctx, 30, hexToCSS(lerpColor(baseNum, 0xffffff, 0.15)), 2);

  // Border pattern
  ctx.strokeStyle = hexToCSS(lerpColor(baseNum, 0xffffff, 0.2));
  ctx.lineWidth = 1;
  ctx.strokeRect(4, 4, TILE_SIZE - 8, TILE_SIZE - 8);
  ctx.strokeRect(8, 8, TILE_SIZE - 16, TILE_SIZE - 16);

  // Corner decorations
  const corners = [[6,6], [TILE_SIZE-8,6], [6,TILE_SIZE-8], [TILE_SIZE-8,TILE_SIZE-8]];
  ctx.fillStyle = hexToCSS(lerpColor(baseNum, 0xffffff, 0.15));
  for (const [cx, cy] of corners) {
    ctx.beginPath();
    ctx.arc(cx, cy, 3, 0, Math.PI * 2);
    ctx.fill();
  }

  borderVignette(ctx);
}

function drawGravelTile(ctx: CanvasRenderingContext2D, _variant: number) {
  const grd = ctx.createLinearGradient(0, 0, TILE_SIZE, TILE_SIZE);
  grd.addColorStop(0, '#8a8a7a');
  grd.addColorStop(0.5, '#9a9a8a');
  grd.addColorStop(1, '#7a7a6a');
  ctx.fillStyle = grd;
  ctx.fillRect(0, 0, TILE_SIZE, TILE_SIZE);

  // Gravel stones
  for (let i = 0; i < 30; i++) {
    const shade = 60 + Math.random() * 60;
    ctx.fillStyle = `rgb(${shade + 20},${shade + 10},${shade - 10})`;
    const s = 1.5 + Math.random() * 3;
    const px = Math.random() * TILE_SIZE;
    const py = Math.random() * TILE_SIZE;
    ctx.beginPath();
    ctx.ellipse(px, py, s, s * 0.7, Math.random() * Math.PI, 0, Math.PI * 2);
    ctx.fill();
  }

  borderVignette(ctx);
}

function borderVignette(ctx: CanvasRenderingContext2D) {
  const grd = ctx.createRadialGradient(TILE_SIZE / 2, TILE_SIZE / 2, 10, TILE_SIZE / 2, TILE_SIZE / 2, TILE_SIZE / 2 + 5);
  grd.addColorStop(0, 'rgba(0,0,0,0)');
  grd.addColorStop(1, 'rgba(0,0,0,0.08)');
  ctx.fillStyle = grd;
  ctx.fillRect(0, 0, TILE_SIZE, TILE_SIZE);
}

export function generateTileTexture(variant: TileVariant, seed: number = 0): Texture {
  return withSeededRandom(seed, () => createCanvasTexture(TILE_SIZE, TILE_SIZE, (ctx) => {
    switch (variant) {
      case 'grass': drawGrassTile(ctx, seed); break;
      case 'dirt': drawDirtTile(ctx, seed); break;
      case 'pavement': drawPavementTile(ctx, seed); break;
      case 'road': drawRoadTile(ctx); break;
      case 'woodfloor': drawWoodFloorTile(ctx, seed); break;
      case 'carpet': drawCarpetTile(ctx, seed); break;
      case 'gravel': drawGravelTile(ctx, seed); break;
      case 'wall_wood':
        ctx.fillStyle = '#6a4a2a';
        ctx.fillRect(0, 0, TILE_SIZE, TILE_SIZE);
        // Wood grain
        ctx.strokeStyle = '#5a3a1a';
        ctx.lineWidth = 1.5;
        for (let i = 0; i < 6; i++) {
          ctx.beginPath();
          ctx.moveTo(0, i * 9 + 2);
          ctx.quadraticCurveTo(TILE_SIZE / 2, i * 9 + 4 + Math.sin(i) * 2, TILE_SIZE, i * 9 + 2);
          ctx.stroke();
        }
        // Vertical planks
        ctx.strokeStyle = '#5a3a1a';
        ctx.lineWidth = 2;
        for (let i = 0; i < 4; i++) {
          const x = i * 13 + 2;
          ctx.beginPath();
          ctx.moveTo(x, 0);
          ctx.lineTo(x, TILE_SIZE);
          ctx.stroke();
        }
        // Nail heads
        ctx.fillStyle = '#555';
        for (let i = 0; i < 8; i++) {
          ctx.fillRect((i % 4) * 13 + 3 + (Math.random() - 0.5) * 2, Math.floor(i / 4) * 25 + 5 + (Math.random() - 0.5) * 2, 2, 2);
        }
        break;
      case 'wall_brick':
        ctx.fillStyle = '#8a3a2a';
        ctx.fillRect(0, 0, TILE_SIZE, TILE_SIZE);
        ctx.strokeStyle = '#6a2a1a';
        ctx.lineWidth = 1.5;
        for (let y = 0; y < 6; y++) {
          const offset = y % 2 === 0 ? 0 : 12;
          for (let x = 0; x < 3; x++) {
            ctx.strokeRect(x * 18 + offset + 0.5, y * 9 + 0.5, 17, 8);
          }
        }
        // Brick texture
        addNoise(ctx, 10, 'rgba(60,20,10,0.2)', 3);
        break;
      case 'wall_concrete':
        ctx.fillStyle = '#5a5a5a';
        ctx.fillRect(0, 0, TILE_SIZE, TILE_SIZE);
        addNoise(ctx, 20, 'rgba(70,70,70,0.3)', 8);
        addNoise(ctx, 10, 'rgba(50,50,50,0.2)', 4);
        // Cracks
        ctx.strokeStyle = '#4a4a4a';
        ctx.lineWidth = 0.5;
        for (let i = 0; i < 3; i++) {
          const sx = Math.random() * TILE_SIZE;
          const sy = Math.random() * TILE_SIZE;
          ctx.beginPath();
          ctx.moveTo(sx, sy);
          ctx.quadraticCurveTo(sx + 5, sy + 8, sx + (Math.random() - 0.5) * 10, sy + 15);
          ctx.stroke();
        }
        break;
    }
  }));
}

// ========================================================================
// ITEM TEXTURES — improved with gradients
// ========================================================================
export function generateItemTexture(type: string): Texture {
  return createCanvasTexture(28, 28, (ctx) => {
    const cx = 14, cy = 14;
    switch (type) {
      case 'health': {
        // Bandage
        ctx.fillStyle = '#ddd';
        roundRect(ctx, 2, 6, 24, 14, 3);
        ctx.fill();
        ctx.strokeStyle = '#bbb';
        ctx.lineWidth = 1;
        ctx.stroke();
        ctx.fillStyle = '#f88';
        ctx.beginPath();
        ctx.arc(cx, cy, 7, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#fff';
        ctx.font = 'bold 10px sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('+', cx, cy + 1);
        break;
      }
      case 'ammo': {
        const ag = ctx.createLinearGradient(4, 6, 20, 18);
        ag.addColorStop(0, '#ccaa00');
        ag.addColorStop(0.5, '#ffdd33');
        ag.addColorStop(1, '#aa8800');
        roundRect(ctx, 4, 6, 20, 14, 2);
        ctx.fillStyle = ag;
        ctx.fill();
        ctx.strokeStyle = '#886600';
        ctx.lineWidth = 1;
        ctx.stroke();
        ctx.fillStyle = '#fff';
        ctx.fillRect(7, 9, 14, 2);
        ctx.fillRect(7, 13, 14, 2);
        ctx.fillRect(7, 17, 14, 2);
        break;
      }
      case 'weapon':
      case 'pistol': {
        ctx.fillStyle = '#333';
        roundRect(ctx, 4, 8, 18, 5, 2);
        ctx.fill();
        roundRect(ctx, 10, 13, 12, 7, 2);
        ctx.fill();
        ctx.fillStyle = '#555';
        ctx.fillRect(6, 10, 2, 8);
        ctx.fillStyle = '#222';
        ctx.beginPath();
        ctx.arc(20, 15, 2, 0, Math.PI * 2);
        ctx.fill();
        break;
      }
      case 'shotgun': {
        ctx.fillStyle = '#444';
        roundRect(ctx, 18, 8, 6, 4, 1);
        ctx.fill();
        roundRect(ctx, 2, 10, 22, 6, 2);
        ctx.fill();
        roundRect(ctx, 8, 16, 12, 5, 2);
        ctx.fill();
        ctx.fillStyle = '#222';
        roundRect(ctx, 4, 11, 16, 4, 1);
        ctx.fill();
        break;
      }
      case 'bat': {
        const bg = ctx.createLinearGradient(8, 2, 12, 24);
        bg.addColorStop(0, '#9a7a4a');
        bg.addColorStop(0.5, '#b89a6a');
        bg.addColorStop(1, '#7a5a2a');
        roundRect(ctx, 8, 2, 5, 22, 2);
        ctx.fillStyle = bg;
        ctx.fill();
        ctx.fillStyle = '#6a4a2a';
        roundRect(ctx, 5, 18, 11, 7, 2);
        ctx.fill();
        ctx.strokeStyle = '#5a3a1a';
        ctx.lineWidth = 0.5;
        ctx.strokeRect(8, 2, 5, 22);
        break;
      }
      case 'axe': {
        ctx.fillStyle = '#7a5a2a';
        roundRect(ctx, 10, 2, 4, 20, 1);
        ctx.fill();
        const ag2 = ctx.createLinearGradient(2, 4, 16, 12);
        ag2.addColorStop(0, '#999');
        ag2.addColorStop(0.5, '#bbb');
        ag2.addColorStop(1, '#777');
        ctx.beginPath();
        ctx.moveTo(2, 6);
        ctx.lineTo(16, 2);
        ctx.lineTo(16, 12);
        ctx.closePath();
        ctx.fillStyle = ag2;
        ctx.fill();
        ctx.strokeStyle = '#555';
        ctx.lineWidth = 0.5;
        ctx.stroke();
        break;
      }
      case 'crowbar': {
        ctx.fillStyle = '#888';
        roundRect(ctx, 11, 2, 4, 20, 1);
        ctx.fill();
        ctx.fillStyle = '#aaa';
        ctx.beginPath();
        ctx.moveTo(4, 18);
        ctx.lineTo(16, 18);
        ctx.lineTo(13, 23);
        ctx.lineTo(4, 23);
        ctx.closePath();
        ctx.fill();
        ctx.strokeStyle = '#666';
        ctx.lineWidth = 0.5;
        ctx.stroke();
        break;
      }
      case 'knife': {
        ctx.fillStyle = '#ccc';
        roundRect(ctx, 11, 2, 4, 16, 1);
        ctx.fill();
        ctx.fillStyle = '#666';
        roundRect(ctx, 10, 18, 6, 7, 1);
        ctx.fill();
        ctx.fillStyle = '#eee';
        ctx.fillRect(12, 3, 2, 10);
        break;
      }
      case 'cloth': {
        ctx.fillStyle = '#ddd';
        roundRect(ctx, 3, 3, 22, 22, 2);
        ctx.fill();
        ctx.strokeStyle = '#bbb';
        ctx.lineWidth = 1;
        ctx.stroke();
        ctx.fillStyle = '#eee';
        ctx.strokeStyle = '#ccc';
        ctx.lineWidth = 0.5;
        ctx.strokeRect(7, 7, 14, 14);
        break;
      }
      case 'medkit': {
        const mg = ctx.createLinearGradient(2, 2, 22, 22);
        mg.addColorStop(0, '#ff4444');
        mg.addColorStop(0.5, '#ff6666');
        mg.addColorStop(1, '#cc2222');
        roundRect(ctx, 2, 2, 24, 24, 4);
        ctx.fillStyle = mg;
        ctx.fill();
        ctx.strokeStyle = '#aa1111';
        ctx.lineWidth = 1;
        ctx.stroke();
        ctx.fillStyle = '#fff';
        ctx.font = 'bold 14px sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('+', cx, cy + 1);
        break;
      }
      case 'food': {
        const fg = ctx.createRadialGradient(cx - 2, cy - 2, 2, cx, cy, 11);
        fg.addColorStop(0, '#eebb55');
        fg.addColorStop(0.6, '#cc8833');
        fg.addColorStop(1, '#aa6622');
        ctx.beginPath();
        ctx.arc(cx, cy + 1, 11, 0, Math.PI * 2);
        ctx.fillStyle = fg;
        ctx.fill();
        ctx.strokeStyle = '#885522';
        ctx.lineWidth = 0.5;
        ctx.stroke();
        ctx.fillStyle = '#ffee88';
        ctx.beginPath();
        ctx.arc(cx - 2, cy - 1, 8, 0, Math.PI * 2);
        ctx.fill();
        break;
      }
      case 'water': {
        const wg = ctx.createLinearGradient(6, 2, 20, 24);
        wg.addColorStop(0, '#5599dd');
        wg.addColorStop(0.5, '#77bbff');
        wg.addColorStop(1, '#3377bb');
        roundRect(ctx, 6, 2, 16, 24, 3);
        ctx.fillStyle = wg;
        ctx.fill();
        ctx.strokeStyle = '#2266aa';
        ctx.lineWidth = 0.5;
        ctx.stroke();
        ctx.fillStyle = '#aaddff';
        roundRect(ctx, 9, 6, 10, 12, 2);
        ctx.fill();
        ctx.fillStyle = '#fff';
        ctx.fillRect(12, 10, 4, 6);
        break;
      }
      default: {
        ctx.fillStyle = '#888';
        roundRect(ctx, 4, 4, 20, 20, 3);
        ctx.fill();
        ctx.fillStyle = '#aaa';
        roundRect(ctx, 6, 6, 16, 16, 2);
        ctx.fill();
        break;
      }
    }
  });
}

// ========================================================================
// TREE TEXTURE
// ========================================================================
export function generateTreeTexture(seed: number = 0): { trunk: Texture; foliage: Texture; width: number; height: number } {
  const trunkW = 12, trunkH = 48;
  const foliageR = 34;

  const trunk = createCanvasTexture(trunkW, trunkH, (ctx) => {
    const tg = ctx.createLinearGradient(0, 0, trunkW, 0);
    tg.addColorStop(0, '#4a2a0a');
    tg.addColorStop(0.3, '#6a4a2a');
    tg.addColorStop(0.5, '#7a5a3a');
    tg.addColorStop(0.7, '#6a4a2a');
    tg.addColorStop(1, '#3a1a0a');
    roundRect(ctx, 1, 0, 10, trunkH, 3);
    ctx.fillStyle = tg;
    ctx.fill();
    ctx.strokeStyle = 'rgba(0,0,0,0.15)';
    ctx.lineWidth = 0.5;
    ctx.stroke();
    // Bark texture
    ctx.strokeStyle = 'rgba(0,0,0,0.1)';
    ctx.lineWidth = 0.5;
    for (let i = 0; i < 8; i++) {
      const y = i * 6 + 3;
      ctx.beginPath();
      ctx.moveTo(2, y);
      ctx.quadraticCurveTo(trunkW / 2, y + 1, trunkW - 2, y);
      ctx.stroke();
    }
  });

  const foliage = withSeededRandom(seed * 13 + 1, () => createCanvasTexture(foliageR * 2, foliageR * 2, (ctx) => {
    const c = foliageR;

    // Shadow
    ctx.fillStyle = 'rgba(0,0,0,0.12)';
    ctx.beginPath();
    ctx.arc(c + 3, c + 3, foliageR - 2, 0, Math.PI * 2);
    ctx.fill();

    // Base foliage
    const fg = ctx.createRadialGradient(c - 5, c - 5, 5, c, c, foliageR);
    fg.addColorStop(0, '#4a8a3a');
    fg.addColorStop(0.4, '#3a7a2a');
    fg.addColorStop(0.8, '#2a5a1a');
    fg.addColorStop(1, '#1a4a0a');
    ctx.fillStyle = fg;
    ctx.beginPath();
    ctx.arc(c, c, foliageR - 2, 0, Math.PI * 2);
    ctx.fill();

    // Highlight layer
    ctx.fillStyle = '#5a9a4a';
    ctx.beginPath();
    ctx.arc(c - 6, c - 6, foliageR - 10, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = '#6aaa5a';
    ctx.beginPath();
    ctx.arc(c - 4, c - 8, foliageR - 16, 0, Math.PI * 2);
    ctx.fill();

    // Dark spots (depth)
    ctx.fillStyle = '#1a4a0a';
    ctx.beginPath();
    ctx.arc(c + 8, c - 3, 6, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(c - 10, c + 6, 5, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(c + 4, c + 10, 4, 0, Math.PI * 2);
    ctx.fill();

    // Leaf highlights
    ctx.fillStyle = 'rgba(100,180,80,0.15)';
    for (let i = 0; i < 6; i++) {
      const angle = (i / 6) * Math.PI * 2;
      const r = foliageR - 8 + Math.random() * 6;
      ctx.beginPath();
      ctx.arc(c + Math.cos(angle) * r, c + Math.sin(angle) * r, 3 + Math.random() * 4, 0, Math.PI * 2);
      ctx.fill();
    }
  }));

  return { trunk, foliage, width: foliageR * 2, height: trunkH + foliageR };
}

// ========================================================================
// FURNITURE TEXTURES
// ========================================================================
export function generateFurnitureTexture(type: string): Texture {
  switch (type) {
    case 'table':
      return createCanvasTexture(48, 48, (ctx) => {
        // Top surface
        const tg = ctx.createLinearGradient(0, 0, 48, 12);
        tg.addColorStop(0, '#8a6a4a');
        tg.addColorStop(0.5, '#9a7a5a');
        tg.addColorStop(1, '#7a5a3a');
        roundRect(ctx, 2, 6, 44, 6, 2);
        ctx.fillStyle = tg;
        ctx.fill();
        ctx.strokeStyle = 'rgba(0,0,0,0.15)';
        ctx.lineWidth = 0.5;
        ctx.stroke();
        // Legs
        ctx.fillStyle = '#5a3a1a';
        ctx.fillRect(4, 12, 4, 34);
        ctx.fillRect(40, 12, 4, 34);
        ctx.fillRect(22, 12, 4, 34);
        // Shadow under table
        ctx.fillStyle = 'rgba(0,0,0,0.06)';
        ctx.fillRect(2, 16, 44, 4);
      });
    case 'chair':
      return createCanvasTexture(32, 40, (ctx) => {
        // Seat
        ctx.fillStyle = '#7a5a3a';
        roundRect(ctx, 4, 26, 24, 6, 2);
        ctx.fill();
        ctx.strokeStyle = 'rgba(0,0,0,0.1)';
        ctx.lineWidth = 0.5;
        ctx.stroke();
        // Legs
        ctx.fillStyle = '#5a3a1a';
        ctx.fillRect(6, 32, 3, 8);
        ctx.fillRect(23, 32, 3, 8);
        // Backrest
        const bg = ctx.createLinearGradient(4, 4, 28, 26);
        bg.addColorStop(0, '#8a6a4a');
        bg.addColorStop(1, '#6a4a2a');
        roundRect(ctx, 4, 4, 24, 22, 2);
        ctx.fillStyle = bg;
        ctx.fill();
        ctx.strokeStyle = 'rgba(0,0,0,0.1)';
        ctx.lineWidth = 0.5;
        ctx.stroke();
      });
    case 'shelf':
      return createCanvasTexture(48, 36, (ctx) => {
        const sg = ctx.createLinearGradient(0, 0, 48, 0);
        sg.addColorStop(0, '#7a5a3a');
        sg.addColorStop(0.5, '#8a6a4a');
        sg.addColorStop(1, '#6a4a2a');
        ctx.fillStyle = sg;
        roundRect(ctx, 0, 0, 48, 36, 2);
        ctx.fill();
        ctx.strokeStyle = 'rgba(0,0,0,0.15)';
        ctx.lineWidth = 0.5;
        ctx.stroke();
        // Shelves
        ctx.fillStyle = '#6a4a2a';
        ctx.fillRect(2, 16, 44, 3);
        ctx.fillRect(2, 2, 44, 3);
        // Items on shelf
        ctx.fillStyle = '#5599dd';
        roundRect(ctx, 8, 6, 6, 10, 1);
        ctx.fill();
        ctx.fillStyle = '#ff5555';
        roundRect(ctx, 20, 6, 6, 10, 1);
        ctx.fill();
        ctx.fillStyle = '#ddbb33';
        roundRect(ctx, 32, 6, 6, 10, 1);
        ctx.fill();
      });
    case 'bed':
      return createCanvasTexture(64, 52, (ctx) => {
        // Frame
        ctx.fillStyle = '#555';
        roundRect(ctx, 2, 26, 60, 24, 4);
        ctx.fill();
        ctx.strokeStyle = 'rgba(0,0,0,0.2)';
        ctx.lineWidth = 0.5;
        ctx.stroke();
        // Mattress
        const mg = ctx.createLinearGradient(2, 2, 62, 26);
        mg.addColorStop(0, '#446');
        mg.addColorStop(0.5, '#557');
        mg.addColorStop(1, '#335');
        roundRect(ctx, 2, 2, 60, 26, 4);
        ctx.fillStyle = mg;
        ctx.fill();
        ctx.strokeStyle = 'rgba(255,255,255,0.05)';
        ctx.lineWidth = 0.5;
        ctx.stroke();
        // Pillow
        ctx.fillStyle = '#667';
        roundRect(ctx, 6, 4, 18, 12, 3);
        ctx.fill();
        ctx.fillStyle = '#778';
        roundRect(ctx, 8, 6, 14, 8, 2);
        ctx.fill();
        // Sheet crease
        ctx.strokeStyle = 'rgba(255,255,255,0.08)';
        ctx.lineWidth = 0.5;
        ctx.beginPath();
        ctx.moveTo(30, 4);
        ctx.quadraticCurveTo(34, 14, 30, 24);
        ctx.stroke();
      });
    case 'counter':
      return createCanvasTexture(48, 36, (ctx) => {
        const cg = ctx.createLinearGradient(0, 0, 0, 36);
        cg.addColorStop(0, '#aaa');
        cg.addColorStop(0.2, '#ccc');
        cg.addColorStop(1, '#888');
        roundRect(ctx, 2, 2, 44, 32, 3);
        ctx.fillStyle = cg;
        ctx.fill();
        ctx.strokeStyle = 'rgba(0,0,0,0.15)';
        ctx.lineWidth = 0.5;
        ctx.stroke();
        // Top surface
        ctx.fillStyle = '#bbb';
        roundRect(ctx, 4, 4, 40, 6, 2);
        ctx.fill();
        // Drawers/doors
        ctx.strokeStyle = 'rgba(0,0,0,0.1)';
        ctx.lineWidth = 0.5;
        ctx.strokeRect(8, 14, 14, 18);
        ctx.strokeRect(26, 14, 14, 18);
        // Handle
        ctx.fillStyle = '#999';
        ctx.fillRect(13, 22, 4, 1);
        ctx.fillRect(31, 22, 4, 1);
      });
    default:
      return generateItemTexture(type);
  }
}

// ========================================================================
// FENCE TEXTURE
// ========================================================================
export function generateFenceTexture(horizontal: boolean): Texture {
  const w = horizontal ? 64 : 32;
  const h = horizontal ? 32 : 64;
  return createCanvasTexture(w, h, (ctx) => {
    // Wood posts
    ctx.fillStyle = '#7a5a3a';
    if (horizontal) {
      // Rails
      roundRect(ctx, 0, 4, 64, 5, 1);
      ctx.fill();
      roundRect(ctx, 0, 22, 64, 5, 1);
      ctx.fill();
      // Posts
      ctx.fillStyle = '#6a4a2a';
      roundRect(ctx, 6, 0, 5, 32, 1);
      ctx.fill();
      roundRect(ctx, 26, 0, 5, 32, 1);
      ctx.fill();
      roundRect(ctx, 48, 0, 5, 32, 1);
      ctx.fill();
      // Pointed tops
      ctx.beginPath();
      ctx.moveTo(6, 0); ctx.lineTo(8.5, -4); ctx.lineTo(11, 0); ctx.closePath();
      ctx.fill();
      ctx.beginPath();
      ctx.moveTo(26, 0); ctx.lineTo(28.5, -4); ctx.lineTo(31, 0); ctx.closePath();
      ctx.fill();
      ctx.beginPath();
      ctx.moveTo(48, 0); ctx.lineTo(50.5, -4); ctx.lineTo(53, 0); ctx.closePath();
      ctx.fill();
    } else {
      // Vertical fence
      ctx.fillStyle = '#6a4a2a';
      roundRect(ctx, 13, 0, 5, 64, 1);
      ctx.fill();
      // Rails
      ctx.fillStyle = '#7a5a3a';
      roundRect(ctx, 4, 8, 24, 4, 1);
      ctx.fill();
      roundRect(ctx, 4, 28, 24, 4, 1);
      ctx.fill();
      roundRect(ctx, 4, 48, 24, 4, 1);
      ctx.fill();
      // Pointed top
      ctx.beginPath();
      ctx.moveTo(13, 0); ctx.lineTo(15.5, -4); ctx.lineTo(18, 0); ctx.closePath();
      ctx.fill();
    }
    // Wood grain
    ctx.strokeStyle = 'rgba(0,0,0,0.08)';
    ctx.lineWidth = 0.5;
    for (let i = 0; i < 4; i++) {
      const y = i * 8 + 6;
      ctx.beginPath();
      ctx.moveTo(horizontal ? 0 : 6, horizontal ? y : (i * 16 + 10));
      ctx.lineTo(horizontal ? 64 : 26, horizontal ? y + 2 : (i * 16 + 12));
      ctx.stroke();
    }
  });
}

// ========================================================================
// BUSH TEXTURE
// ========================================================================
export function generateBushTexture(_seed: number = 0): Texture {
  return createCanvasTexture(48, 40, (ctx) => {
    // Shadow
    ctx.fillStyle = 'rgba(0,0,0,0.1)';
    ctx.beginPath();
    ctx.ellipse(24, 24, 22, 18, 0, 0, Math.PI * 2);
    ctx.fill();

    // Base bush
    const bg = ctx.createRadialGradient(20, 16, 4, 24, 20, 22);
    bg.addColorStop(0, '#4a7a3a');
    bg.addColorStop(0.5, '#3a6a2a');
    bg.addColorStop(1, '#2a5a1a');
    ctx.fillStyle = bg;
    ctx.beginPath();
    ctx.arc(24, 22, 20, 0, Math.PI * 2);
    ctx.fill();

    // Highlight clumps
    ctx.fillStyle = '#5a8a4a';
    ctx.beginPath();
    ctx.arc(16, 16, 14, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = '#6a9a5a';
    ctx.beginPath();
    ctx.arc(28, 14, 10, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = '#7aaa6a';
    ctx.beginPath();
    ctx.arc(20, 12, 8, 0, Math.PI * 2);
    ctx.fill();

    // Dark spots
    ctx.fillStyle = '#2a4a1a';
    ctx.beginPath();
    ctx.arc(32, 24, 4, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(14, 26, 3, 0, Math.PI * 2);
    ctx.fill();
  });
}

// ========================================================================
// ROCK TEXTURE
// ========================================================================
export function generateRockTexture(): Texture {
  return createCanvasTexture(28, 22, (ctx) => {
    // Shadow
    ctx.fillStyle = 'rgba(0,0,0,0.12)';
    ctx.beginPath();
    ctx.ellipse(14, 20, 14, 4, 0, 0, Math.PI * 2);
    ctx.fill();

    // Rock body
    const rg = ctx.createRadialGradient(10, 8, 3, 14, 12, 14);
    rg.addColorStop(0, '#999');
    rg.addColorStop(0.5, '#888');
    rg.addColorStop(1, '#666');
    ctx.fillStyle = rg;
    ctx.beginPath();
    ctx.moveTo(6, 18);
    ctx.lineTo(3, 10);
    ctx.lineTo(8, 4);
    ctx.lineTo(16, 2);
    ctx.lineTo(22, 6);
    ctx.lineTo(24, 14);
    ctx.lineTo(20, 18);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = 'rgba(0,0,0,0.15)';
    ctx.lineWidth = 0.5;
    ctx.stroke();

    // Highlight
    ctx.fillStyle = '#aaa';
    ctx.beginPath();
    ctx.moveTo(8, 14);
    ctx.lineTo(6, 10);
    ctx.lineTo(12, 6);
    ctx.lineTo(18, 7);
    ctx.lineTo(20, 12);
    ctx.lineTo(16, 16);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.1)';
    ctx.lineWidth = 0.5;
    ctx.stroke();
  });
}

// ========================================================================
// DEAD BODY TEXTURE
// ========================================================================
export function generateDeadBodyTexture(): Texture {
  return createCanvasTexture(48, 30, (ctx) => {
    // Blood pool
    ctx.fillStyle = 'rgba(80, 10, 10, 0.5)';
    ctx.beginPath();
    ctx.ellipse(24, 26, 22, 6, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = 'rgba(100, 15, 15, 0.3)';
    ctx.beginPath();
    ctx.ellipse(24, 26, 18, 4, 0, 0, Math.PI * 2);
    ctx.fill();

    // Shadow
    ctx.fillStyle = 'rgba(0,0,0,0.3)';
    ctx.beginPath();
    ctx.ellipse(24, 27, 20, 5, 0, 0, Math.PI * 2);
    ctx.fill();

    // Body (torso)
    const bg = ctx.createLinearGradient(8, 8, 40, 22);
    bg.addColorStop(0, '#7a6a5a');
    bg.addColorStop(0.5, '#8a7a6a');
    bg.addColorStop(1, '#6a5a4a');
    roundRect(ctx, 8, 8, 32, 14, 5);
    ctx.fillStyle = bg;
    ctx.fill();
    ctx.strokeStyle = 'rgba(0,0,0,0.15)';
    ctx.lineWidth = 0.5;
    ctx.stroke();

    // Head
    const hg = ctx.createRadialGradient(14, 6, 2, 16, 7, 8);
    hg.addColorStop(0, '#8a7a6a');
    hg.addColorStop(1, '#6a5a4a');
    ctx.beginPath();
    ctx.arc(16, 7, 8, 0, Math.PI * 2);
    ctx.fillStyle = hg;
    ctx.fill();
    ctx.stroke();

    // Arms
    roundRect(ctx, 2, 10, 8, 12, 3);
    ctx.fillStyle = '#7a6a5a';
    ctx.fill();
    roundRect(ctx, 38, 10, 8, 12, 3);
    ctx.fill();

    // Blood on body
    ctx.fillStyle = '#6a1a1a';
    ctx.fillRect(12, 16, 24, 3);
    ctx.fillRect(8, 19, 10, 2);
    ctx.fillRect(30, 18, 8, 2);
    ctx.fillRect(10, 8, 4, 2);

    // Blood splatter around
    ctx.fillStyle = 'rgba(100, 15, 15, 0.6)';
    for (let i = 0; i < 8; i++) {
      const sx = 4 + Math.random() * 40;
      const sy = 20 + Math.random() * 8;
      ctx.beginPath();
      ctx.arc(sx, sy, 1 + Math.random() * 3, 0, Math.PI * 2);
      ctx.fill();
    }
  });
}

// ========================================================================
// MISC: Blood splat on ground
// ========================================================================
export function generateBloodSplatTexture(size: number = 32): Texture {
  return createCanvasTexture(size, size, (ctx) => {
    const cx = size / 2, cy = size / 2;
    const r = size / 2 - 2;

    // Main pool
    ctx.fillStyle = 'rgba(80, 10, 10, 0.6)';
    ctx.beginPath();
    ctx.ellipse(cx, cy + 2, r - 2, r * 0.4, 0, 0, Math.PI * 2);
    ctx.fill();

    // Dark center
    ctx.fillStyle = 'rgba(60, 5, 5, 0.5)';
    ctx.beginPath();
    ctx.ellipse(cx, cy + 2, r * 0.6, r * 0.25, 0, 0, Math.PI * 2);
    ctx.fill();

    // Splatter drops
    ctx.fillStyle = 'rgba(100, 15, 15, 0.5)';
    for (let i = 0; i < 5; i++) {
      const angle = (i / 5) * Math.PI * 2 + Math.random() * 0.5;
      const dist = r * 0.7 + Math.random() * r * 0.5;
      const ds = 1 + Math.random() * 3;
      ctx.beginPath();
      ctx.arc(cx + Math.cos(angle) * dist, cy + Math.sin(angle) * dist + 2, ds, 0, Math.PI * 2);
      ctx.fill();
    }
  });
}
