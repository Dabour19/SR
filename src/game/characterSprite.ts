/**
 * Draws the themed hero sprite (same visual style as the in-game player)
 * at the current canvas origin (0,0 = feet center). Reused by lobby hub.
 */
import type { CharacterTheme } from '../types';

export interface HeroPose {
  theme: CharacterTheme;
  walkCycle: number;
  time: number;
  facingLeft: boolean;
  isMoving: boolean;
}

export function drawHeroSprite(ctx: CanvasRenderingContext2D, pose: HeroPose, scale = 1.6) {
  const { theme: T, walkCycle, time, facingLeft, isMoving } = pose;
  ctx.save();
  ctx.scale(scale, scale);

  const bob = isMoving ? Math.sin(walkCycle) * 3 : Math.sin(time * 3) * 1.2;
  const legSwing = isMoving ? Math.sin(walkCycle) * 6 : 0;

  // Drop shadow
  ctx.fillStyle = 'rgba(0, 0, 0, 0.55)';
  ctx.beginPath();
  ctx.ellipse(0, 16, 18, 6.5, 0, 0, Math.PI * 2);
  ctx.fill();

  if (facingLeft) ctx.scale(-1, 1);

  // Cape
  ctx.save();
  const capeFlutter = isMoving ? Math.sin(walkCycle * 1.5) * 5 : Math.sin(time * 4) * 2;
  ctx.fillStyle = T.cape;
  ctx.beginPath();
  ctx.moveTo(-6, bob - 2);
  ctx.quadraticCurveTo(-16 - (isMoving ? 8 : 2), bob + 10 + capeFlutter, -14 - (isMoving ? 12 : 3), bob + 20 + capeFlutter);
  ctx.lineTo(-4, bob + 18 + capeFlutter * 0.5);
  ctx.lineTo(2, bob + 4);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = T.trim;
  ctx.lineWidth = 1.5;
  ctx.stroke();
  ctx.restore();

  // Legs & boots
  ctx.fillStyle = '#1e293b';
  ctx.fillRect(-7, bob + 9 - legSwing * 0.4, 5, 8 + legSwing * 0.5);
  ctx.fillRect(2, bob + 9 + legSwing * 0.4, 5, 8 - legSwing * 0.5);
  ctx.fillStyle = T.boot;
  ctx.fillRect(-8, bob + 14 - legSwing * 0.4, 6, 2.5);
  ctx.fillRect(1, bob + 14 + legSwing * 0.4, 6, 2.5);

  // Torso
  ctx.save();
  ctx.shadowColor = T.glow;
  ctx.shadowBlur = 12;
  ctx.fillStyle = T.cape;
  ctx.beginPath();
  ctx.roundRect(-10, bob - 6, 20, 16, 4);
  ctx.fill();
  ctx.strokeStyle = T.boot;
  ctx.lineWidth = 1.5;
  ctx.stroke();

  ctx.fillStyle = T.accent;
  ctx.beginPath();
  ctx.arc(-11, bob - 4, 4.5, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.arc(11, bob - 4, 4.5, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = T.trim;
  ctx.beginPath();
  ctx.moveTo(0, bob - 4);
  ctx.lineTo(4, bob);
  ctx.lineTo(0, bob + 4);
  ctx.lineTo(-4, bob);
  ctx.closePath();
  ctx.fill();

  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  ctx.arc(0, bob, 1.6, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  // Hood & visor
  ctx.save();
  ctx.fillStyle = T.cape;
  ctx.beginPath();
  ctx.arc(0, bob - 10, 11, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#334155';
  ctx.fillRect(-6, bob - 12, 12, 6);
  ctx.fillStyle = T.trim;
  ctx.shadowColor = T.glow;
  ctx.shadowBlur = 10;
  ctx.fillRect(1, bob - 11, 6, 2.5);
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(4, bob - 11, 2, 2.5);
  ctx.restore();

  // Sword
  ctx.save();
  const swordSwing = isMoving ? Math.sin(walkCycle) * 0.2 : 0;
  ctx.translate(11, bob + 2);
  ctx.rotate(0.35 + swordSwing);
  ctx.fillStyle = '#f59e0b';
  ctx.fillRect(-4, -1, 8, 2.5);
  ctx.fillStyle = '#78350f';
  ctx.fillRect(-1.5, 1.5, 3, 5);
  ctx.fillStyle = '#f59e0b';
  ctx.beginPath();
  ctx.arc(0, 7.5, 2, 0, Math.PI * 2);
  ctx.fill();
  ctx.shadowColor = T.boot;
  ctx.shadowBlur = 10;
  ctx.fillStyle = '#e0f2fe';
  ctx.beginPath();
  ctx.moveTo(-2.5, -1);
  ctx.lineTo(0, -22);
  ctx.lineTo(2.5, -1);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = T.accent;
  ctx.fillRect(-0.8, -16, 1.6, 14);
  ctx.fillStyle = T.boot;
  ctx.fillRect(-0.4, -14, 0.8, 10);
  ctx.restore();

  ctx.restore();
}
