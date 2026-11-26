// Sky Ranger — the instruments: lit dials, gauges and warnings.
// One file, one job: everything on the HUD, drawn on the canvas.

import { VIEW, COLOURS, PLANE } from './config.js';
import { clamp } from './random.js';

function panel(ctx, x, y, w, h, radius = 10) {
  ctx.fillStyle = COLOURS.hudPanel;
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, radius);
  ctx.fill();
  ctx.strokeStyle = 'rgba(140, 190, 235, 0.35)';
  ctx.lineWidth = 1;
  ctx.stroke();
}

function dial(ctx, cx, cy, r, label, valueText, fraction, colour) {
  ctx.save();
  ctx.translate(cx, cy);
  // Face.
  ctx.fillStyle = 'rgba(6, 14, 26, 0.78)';
  ctx.beginPath();
  ctx.arc(0, 0, r, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = 'rgba(160, 200, 240, 0.5)';
  ctx.lineWidth = 2;
  ctx.stroke();
  // Tick marks.
  for (let i = 0; i <= 10; i++) {
    const a = -Math.PI * 0.75 + (i / 10) * Math.PI * 1.5;
    const major = i % 5 === 0;
    ctx.strokeStyle = major ? '#cfe4ff' : 'rgba(160, 200, 240, 0.55)';
    ctx.lineWidth = major ? 2.5 : 1;
    ctx.beginPath();
    ctx.moveTo(Math.cos(a) * (r - (major ? 10 : 6)), Math.sin(a) * (r - (major ? 10 : 6)));
    ctx.lineTo(Math.cos(a) * (r - 2), Math.sin(a) * (r - 2));
    ctx.stroke();
  }
  // Needle.
  const needleAngle = -Math.PI * 0.75 + clamp(fraction, 0, 1) * Math.PI * 1.5;
  ctx.strokeStyle = colour;
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.lineTo(Math.cos(needleAngle) * (r - 8), Math.sin(needleAngle) * (r - 8));
  ctx.stroke();
  ctx.fillStyle = colour;
  ctx.beginPath();
  ctx.arc(0, 0, 4, 0, Math.PI * 2);
  ctx.fill();
  // Label and value, lit.
  ctx.fillStyle = '#dceaff';
  ctx.font = 'bold 11px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(label, 0, r * 0.42);
  ctx.font = 'bold 19px monospace';
  ctx.fillStyle = colour;
  ctx.fillText(valueText, 0, r * 0.72);
  ctx.restore();
}

export class Hud {
  draw(ctx, game, time) {
    const plane = game.plane;
    const w = VIEW.width;
    const h = VIEW.height;

    // Top centre: heading compass tape.
    panel(ctx, w / 2 - 190, 14, 380, 46);
    ctx.save();
    ctx.beginPath();
    ctx.rect(w / 2 - 190, 14, 380, 46);
    ctx.clip();
    ctx.fillStyle = '#dceaff';
    ctx.font = 'bold 15px monospace';
    ctx.textAlign = 'center';
    const heading = ((Math.round(plane.heading) % 360) + 360) % 360;
    for (let d = -60; d <= 60; d += 15) {
      const hd = ((heading + d) % 360 + 360) % 360;
      const x = w / 2 + d * 2.4;
      const major = hd % 45 === 0;
      ctx.fillStyle = major ? '#ffffff' : 'rgba(200, 220, 245, 0.75)';
      ctx.fillRect(x - 1, 26, 2, major ? 14 : 8);
      ctx.fillText(String(hd).padStart(3, '0'), x, 52);
    }
    ctx.restore();
    // Centre caret.
    ctx.fillStyle = COLOURS.hudAmber;
    ctx.beginPath();
    ctx.moveTo(w / 2 - 7, 14);
    ctx.lineTo(w / 2 + 7, 14);
    ctx.lineTo(w / 2, 24);
    ctx.closePath();
    ctx.fill();

    // Top right: score, rings, combo.
    panel(ctx, w - 268, 14, 254, 82);
    ctx.textAlign = 'left';
    ctx.fillStyle = '#9fb8d8';
    ctx.font = 'bold 12px sans-serif';
    ctx.fillText('SCORE', w - 252, 36);
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 26px monospace';
    ctx.fillText(String(game.score).padStart(6, '0'), w - 252, 64);
    ctx.fillStyle = '#9fb8d8';
    ctx.font = 'bold 12px sans-serif';
    ctx.fillText('RINGS', w - 252, 86);
    ctx.fillStyle = COLOURS.ringOuter;
    ctx.font = 'bold 16px monospace';
    ctx.fillText(`${game.ringsPassed}/${game.rings.length}`, w - 196, 86);
    if (game.combo > 1) {
      ctx.fillStyle = COLOURS.hudAmber;
      ctx.font = 'bold 15px sans-serif';
      ctx.fillText(`COMBO x${game.combo.toFixed(2)}`, w - 120, 86);
    }

    // Top left: mission name + clock.
    panel(ctx, 14, 14, 300, 82);
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 16px sans-serif';
    ctx.fillText(game.mission.name, 28, 40);
    ctx.fillStyle = '#9fb8d8';
    ctx.font = '13px sans-serif';
    ctx.fillText(game.mission.subtitle, 28, 62);
    ctx.fillStyle = '#dceaff';
    ctx.font = 'bold 15px monospace';
    ctx.fillText(`TIME ${game.clockText()}`, 28, 86);

    // Bottom left: airspeed dial. Bottom right: altimeter dial.
    dial(ctx, 92, h - 92, 62, 'AIRSPEED', String(Math.round(plane.speed)), plane.speed / PLANE.maxSpeed, COLOURS.hudGreen);
    dial(ctx, w - 92, h - 92, 62, 'ALTITUDE', String(Math.round(plane.alt)), clamp(plane.alt / 60, 0, 1), '#7dc4ff');

    // Bottom centre-left: fuel gauge.
    panel(ctx, 176, h - 78, 220, 60);
    ctx.fillStyle = '#9fb8d8';
    ctx.font = 'bold 12px sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText('FUEL', 190, h - 56);
    const fuelFrac = plane.fuel / PLANE.fuelCapacity;
    const fuelColour = fuelFrac < 0.22 ? COLOURS.hudRed : fuelFrac < 0.45 ? COLOURS.hudAmber : COLOURS.hudGreen;
    ctx.fillStyle = 'rgba(255,255,255,0.14)';
    ctx.fillRect(190, h - 46, 192, 14);
    ctx.fillStyle = fuelColour;
    ctx.fillRect(190, h - 46, 192 * fuelFrac, 14);
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 13px monospace';
    ctx.fillText(`${Math.round(plane.fuel)}%`, 190, h - 26);

    // Bottom centre-right: throttle lever.
    panel(ctx, w - 396, h - 78, 220, 60);
    ctx.fillStyle = '#9fb8d8';
    ctx.font = 'bold 12px sans-serif';
    ctx.fillText('THROTTLE', w - 382, h - 56);
    ctx.fillStyle = 'rgba(255,255,255,0.14)';
    ctx.fillRect(w - 382, h - 46, 192, 14);
    ctx.fillStyle = '#ff9d3d';
    ctx.fillRect(w - 382, h - 46, 192 * plane.throttle, 14);
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 13px monospace';
    ctx.fillText(`${Math.round(plane.throttle * 100)}%`, w - 382, h - 26);

    // Damage bar under the throttle.
    if (plane.damage > 0) {
      ctx.fillStyle = '#9fb8d8';
      ctx.font = 'bold 11px sans-serif';
      ctx.fillText('HULL', w - 382, h - 88);
      ctx.fillStyle = 'rgba(255,255,255,0.14)';
      ctx.fillRect(w - 382, h - 84, 192, 6);
      ctx.fillStyle = COLOURS.hudRed;
      ctx.fillRect(w - 382, h - 84, 192 * (1 - plane.damage / PLANE.maxDamage), 6);
    }

    // Warnings, centre screen, flashing.
    const blink = Math.sin(time * 9) > 0;
    if (blink) {
      ctx.textAlign = 'center';
      ctx.font = 'bold 26px sans-serif';
      if (plane.fuel < 22 && plane.fuel > 0) {
        ctx.fillStyle = COLOURS.hudRed;
        ctx.fillText('⚠ LOW FUEL — FIND A GREEN RING', w / 2, 150);
      } else if (plane.stalled) {
        ctx.fillStyle = COLOURS.hudAmber;
        ctx.fillText('⚠ STALL — NOSE DOWN, ADD THROTTLE', w / 2, 150);
      } else if (plane.alt < terrainClearance(game)) {
        ctx.fillStyle = COLOURS.hudRed;
        ctx.fillText('⚠ PULL UP', w / 2, 150);
      }
    }

    // Gear indicator when down, just under the compass.
    if (plane.gearDown) {
      ctx.fillStyle = COLOURS.hudGreen;
      ctx.font = 'bold 13px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('GEAR DOWN — READY TO LAND', w / 2, 82);
    }
  }
}

function terrainClearance(game) {
  return game.terrain.heightAt(game.plane.z + 40) + 6;
}
