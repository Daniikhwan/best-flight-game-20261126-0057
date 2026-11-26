// Sky Ranger — draws the world: sky, mountains, ground, runway, rings.
// One file, one job: everything the pilot sees except the plane and the HUD.

import { VIEW, COLOURS } from './config.js';
import { clamp } from './random.js';

const TONES = {
  0: COLOURS.groundFieldA,
  1: COLOURS.groundFieldB,
  2: COLOURS.groundFieldC,
  3: COLOURS.groundDry,
};

export class Renderer {
  constructor(ctx) {
    this.ctx = ctx;
    this.particles = [];
    this.flash = 0; // lightning flash, 0..1
    this.rain = [];
    for (let i = 0; i < 90; i++) {
      this.rain.push({ x: Math.random(), y: Math.random(), speed: 0.5 + Math.random() * 0.7 });
    }
  }

  burst(x, y, colour, count) {
    for (let i = 0; i < count; i++) {
      const a = Math.random() * Math.PI * 2;
      const v = 60 + Math.random() * 260;
      this.particles.push({
        x, y,
        vx: Math.cos(a) * v,
        vy: Math.sin(a) * v - 40,
        life: 0.5 + Math.random() * 0.6,
        age: 0,
        colour,
        size: 2 + Math.random() * 4,
      });
    }
  }

  updateParticles(dt) {
    for (const p of this.particles) {
      p.age += dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vy += 160 * dt;
    }
    this.particles = this.particles.filter((p) => p.age < p.life);
    if (this.flash > 0) this.flash = Math.max(0, this.flash - dt * 2.2);
  }

  drawSky(ctx, skyKind, time, sunX) {
    const w = VIEW.width;
    const h = VIEW.height;
    let top, mid, horizon;
    if (skyKind === 'storm') {
      top = COLOURS.skyStormTop; mid = COLOURS.skyStormMid; horizon = COLOURS.skyStormHorizon;
    } else if (skyKind === 'dusk') {
      top = COLOURS.skyDuskTop; mid = COLOURS.skyDuskMid; horizon = COLOURS.skyDuskHorizon;
    } else {
      top = COLOURS.skyDayTop; mid = COLOURS.skyDayMid; horizon = COLOURS.skyDayHorizon;
    }
    const g = ctx.createLinearGradient(0, 0, 0, VIEW.horizonY + 30);
    g.addColorStop(0, top);
    g.addColorStop(0.55, mid);
    g.addColorStop(1, horizon);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, VIEW.horizonY + 30);

    // Sun with a soft halo.
    const sx = sunX * w;
    const sy = 92;
    const halo = ctx.createRadialGradient(sx, sy, 4, sx, sy, 90);
    halo.addColorStop(0, 'rgba(255, 225, 120, 0.85)');
    halo.addColorStop(0.35, 'rgba(255, 210, 90, 0.28)');
    halo.addColorStop(1, 'rgba(255, 210, 90, 0)');
    ctx.fillStyle = halo;
    ctx.fillRect(sx - 95, sy - 95, 190, 190);
    ctx.fillStyle = COLOURS.sun;
    ctx.beginPath();
    ctx.arc(sx, sy, 26, 0, Math.PI * 2);
    ctx.fill();

    // Lightning flash washes the sky white for a beat.
    if (this.flash > 0) {
      ctx.fillStyle = `rgba(230, 238, 255, ${this.flash * 0.5})`;
      ctx.fillRect(0, 0, w, VIEW.horizonY + 30);
    }
    void time;
  }

  // Layered mountain ridges, parallaxed by the plane's lateral position.
  drawMountains(ctx, terrain, planeX, skyKind) {
    const layers = [
      { amp: 66, base: 0.42, colour: 'rgba(96, 116, 150, 0.85)', speed: 0.12 },
      { amp: 96, base: 0.6, colour: 'rgba(70, 90, 122, 0.9)', speed: 0.22 },
      { amp: 130, base: 0.8, colour: 'rgba(58, 74, 100, 0.95)', speed: 0.36 },
    ];
    for (const layer of layers) {
      ctx.fillStyle = layer.colour;
      ctx.beginPath();
      ctx.moveTo(0, VIEW.horizonY + 2);
      for (let x = 0; x <= VIEW.width; x += 16) {
        const wx = (x / VIEW.width) * 6 - planeX * layer.speed * 0.02;
        const y =
          VIEW.horizonY -
          (Math.abs(Math.sin(wx * 1.7 + layer.base * 9)) * 0.6 +
            Math.abs(Math.sin(wx * 3.1 + 2.2)) * 0.4) *
            layer.amp;
        ctx.lineTo(x, y);
      }
      ctx.lineTo(VIEW.width, VIEW.horizonY + 2);
      ctx.closePath();
      ctx.fill();
    }
    void terrain;
    void skyKind;
  }

  drawClouds(ctx, terrain, planeZ, time, camX) {
    for (const c of terrain.clouds) {
      const d = c.z - planeZ;
      if (d < 8 || d > VIEW.farDistance) continue;
      const drift = ((time * c.speed * 2) % 40) - 20;
      const p = terrain.project(d, c.x + drift, c.y, 0, camX);
      const r = c.size * p.scale;
      if (r < 2) continue;
      ctx.fillStyle = 'rgba(255, 255, 255, 0.85)';
      ctx.beginPath();
      ctx.ellipse(p.x, p.y, r, r * 0.42, 0, 0, Math.PI * 2);
      ctx.ellipse(p.x - r * 0.55, p.y + r * 0.08, r * 0.6, r * 0.3, 0, 0, Math.PI * 2);
      ctx.ellipse(p.x + r * 0.55, p.y + r * 0.08, r * 0.6, r * 0.3, 0, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  // The ground: receding horizontal strips, coloured by field tone.
  drawGround(ctx, terrain, planeZ, camY, camX) {
    const step = VIEW.groundStep;
    // Far to near so near strips paint over far ones.
    for (let d = VIEW.farDistance; d > step; d -= step) {
      const zFar = planeZ + d;
      const zNear = planeZ + d - step;
      const yFar = this.groundY(terrain, zFar, camY, d);
      const yNear = this.groundY(terrain, zNear, camY, d - step);
      if (yNear <= VIEW.horizonY && yFar <= VIEW.horizonY) continue;
      const tone = terrain.fieldTone(zFar);
      ctx.fillStyle = tone === 'river' ? COLOURS.river : tone === 'runway' ? COLOURS.runway : TONES[tone] || TONES[0];
      ctx.fillRect(0, Math.max(VIEW.horizonY, yFar), VIEW.width, Math.max(1, yNear - Math.max(VIEW.horizonY, yFar)));
    }
    this.drawRunway(ctx, terrain, planeZ, camY, camX);
    this.drawTrees(ctx, terrain, planeZ, camY, camX);
  }

  // Scattered trees, near to far.
  drawTrees(ctx, terrain, planeZ, camY, camX) {
    const sorted = [...terrain.trees].sort((a, b) => b.z - a.z);
    for (const tree of sorted) {
      const d = tree.z - planeZ;
      if (d < 12 || d > 700) continue;
      const base = terrain.project(d, tree.x, terrain.heightAt(tree.z), camY, camX);
      const h = tree.height * base.scale;
      if (h < 2) continue;
      ctx.fillStyle = '#2c5a2e';
      ctx.beginPath();
      ctx.moveTo(base.x, base.y - h);
      ctx.lineTo(base.x - h * 0.45, base.y);
      ctx.lineTo(base.x + h * 0.45, base.y);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = '#3f7a37';
      ctx.beginPath();
      ctx.moveTo(base.x, base.y - h * 1.25);
      ctx.lineTo(base.x - h * 0.32, base.y - h * 0.45);
      ctx.lineTo(base.x + h * 0.32, base.y - h * 0.45);
      ctx.closePath();
      ctx.fill();
    }
  }

  groundY(terrain, z, camY, d) {
    const h = terrain.heightAt(z);
    const p = terrain.project(Math.max(6, d), 0, h, camY);
    return p.y;
  }

  // The runway: a grey strip with a dashed centre line, converging ahead.
  drawRunway(ctx, terrain, planeZ, camY, camX) {
    const half = 9;
    const step = VIEW.groundStep;
    for (let d = VIEW.farDistance; d > step; d -= step) {
      const zFar = planeZ + d;
      if (!terrain.isRunway(zFar)) continue;
      const zNear = planeZ + d - step;
      const leftFar = terrain.project(d, -half, terrain.heightAt(zFar), camY, camX);
      const rightFar = terrain.project(d, half, terrain.heightAt(zFar), camY, camX);
      const leftNear = terrain.project(d - step, -half, terrain.heightAt(zNear), camY, camX);
      const rightNear = terrain.project(d - step, half, terrain.heightAt(zNear), camY, camX);
      if (leftNear.y <= VIEW.horizonY && leftFar.y <= VIEW.horizonY) continue;
      ctx.fillStyle = '#4c5158';
      ctx.beginPath();
      ctx.moveTo(leftFar.x, leftFar.y);
      ctx.lineTo(rightFar.x, rightFar.y);
      ctx.lineTo(rightNear.x, rightNear.y);
      ctx.lineTo(leftNear.x, leftNear.y);
      ctx.closePath();
      ctx.fill();
      // Centre dashes, one per strip.
      const midFar = terrain.project(d, 0, terrain.heightAt(zFar), camY, camX);
      const midNear = terrain.project(d - step, 0, terrain.heightAt(zNear), camY, camX);
      const dashW = Math.max(1, (rightFar.x - leftFar.x) * 0.06);
      ctx.fillStyle = COLOURS.runwayLine;
      ctx.fillRect(midFar.x - dashW / 2, midFar.y, dashW, Math.max(1, midNear.y - midFar.y) * 0.6);
      // Edge lights.
      ctx.fillStyle = '#ffd94d';
      ctx.fillRect(leftFar.x - 1, leftFar.y, 2, Math.max(1, leftNear.y - leftFar.y));
      ctx.fillRect(rightFar.x - 1, rightFar.y, 2, Math.max(1, rightNear.y - rightFar.y));
    }
  }

  drawRings(ctx, terrain, rings, planeZ, camY, time, camX) {
    // Far to near so nearer rings paint over farther ones.
    const sorted = [...rings].sort((a, b) => b.z - a.z);
    for (const ring of sorted) {
      if (ring.passed) continue;
      const d = ring.z - planeZ;
      if (d < 4 || d > VIEW.farDistance) continue;
      const p = terrain.project(d, ring.x, ring.y, camY, camX);
      const r = ring.radius * p.scale;
      if (r < 1.5) continue;
      const pulse = 1 + Math.sin(time * 3 + ring.index) * 0.06;
      ctx.save();
      ctx.shadowColor = COLOURS.ringGlow;
      ctx.shadowBlur = 18;
      ctx.strokeStyle = COLOURS.ringOuter;
      ctx.lineWidth = Math.max(2, r * 0.16);
      ctx.beginPath();
      ctx.ellipse(p.x, p.y, r * pulse, r * 0.86 * pulse, 0, 0, Math.PI * 2);
      ctx.stroke();
      ctx.shadowBlur = 0;
      ctx.strokeStyle = COLOURS.ringInner;
      ctx.lineWidth = Math.max(1, r * 0.06);
      ctx.beginPath();
      ctx.ellipse(p.x, p.y, r * 0.78 * pulse, r * 0.67 * pulse, 0, 0, Math.PI * 2);
      ctx.stroke();
      // The next ring gets a beacon arrow above it.
      if (ring === rings.find((x) => !x.passed)) {
        ctx.fillStyle = COLOURS.ringOuter;
        const bob = Math.sin(time * 4) * 4;
        ctx.beginPath();
        ctx.moveTo(p.x, p.y - r - 26 + bob);
        ctx.lineTo(p.x - 9, p.y - r - 40 + bob);
        ctx.lineTo(p.x + 9, p.y - r - 40 + bob);
        ctx.closePath();
        ctx.fill();
      }
      ctx.restore();
    }
  }

  drawPeaks(ctx, terrain, peaks, planeZ, camY, camX) {
    for (const peak of peaks) {
      const d = peak.z - planeZ;
      if (d < 4 || d > VIEW.farDistance) continue;
      const base = terrain.project(d, peak.x, terrain.heightAt(peak.z), camY, camX);
      const top = terrain.project(d, peak.x, terrain.heightAt(peak.z) + peak.height, camY, camX);
      const halfW = peak.width * base.scale;
      if (halfW < 1) continue;
      const grad = ctx.createLinearGradient(base.x, top.y, base.x, base.y);
      grad.addColorStop(0, '#7a6a58');
      grad.addColorStop(1, '#4a4038');
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.moveTo(base.x - halfW, base.y);
      ctx.lineTo(top.x, top.y);
      ctx.lineTo(base.x + halfW, base.y);
      ctx.closePath();
      ctx.fill();
      // Snow cap.
      ctx.fillStyle = 'rgba(245, 248, 252, 0.9)';
      ctx.beginPath();
      ctx.moveTo(top.x - halfW * 0.28, top.y + (base.y - top.y) * 0.22);
      ctx.lineTo(top.x, top.y);
      ctx.lineTo(top.x + halfW * 0.28, top.y + (base.y - top.y) * 0.22);
      ctx.closePath();
      ctx.fill();
      // Warning chevron when the peak is close.
      if (d < 220) {
        ctx.fillStyle = COLOURS.hudRed;
        ctx.font = `bold ${Math.max(12, 22 * base.scale)}px sans-serif`;
        ctx.textAlign = 'center';
        ctx.fillText('▲', top.x, top.y - 12);
      }
    }
  }

  drawParticles(ctx) {
    for (const p of this.particles) {
      const a = 1 - p.age / p.life;
      ctx.globalAlpha = a;
      ctx.fillStyle = p.colour;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size * a + 0.5, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  drawRain(ctx, skyKind) {
    if (skyKind !== 'storm') return;
    ctx.strokeStyle = 'rgba(190, 205, 225, 0.4)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (const drop of this.rain) {
      const x = drop.x * VIEW.width;
      const y = ((drop.y + 0.35) % 1) * VIEW.height;
      ctx.moveTo(x, y);
      ctx.lineTo(x - 4, y + 14);
    }
    ctx.stroke();
  }
}
