// Sky Ranger — the world the plane flies over.
// One file, one job: procedural valleys, rivers, runways, clouds, rings
// and peaks, all derived from the mission seed so they never change.

import { makeRandom, clamp } from './random.js';
import { VIEW } from './config.js';

// A valley is a sum of slow sine hills plus seeded bumps.
export class Terrain {
  constructor(mission) {
    this.mission = mission;
    this.rng = makeRandom(mission.seed);
    this.hills = [];
    for (let i = 0; i < 7; i++) {
      this.hills.push({
        amp: this.rng.range(4, 14),
        freq: this.rng.range(0.0016, 0.004),
        phase: this.rng.range(0, Math.PI * 2),
      });
    }
    this.fieldBands = [];
    let z = 0;
    while (z < this.worldLength()) {
      this.fieldBands.push({ z, length: this.rng.range(90, 260), tone: this.rng.int(0, 3) });
      z += this.fieldBands[this.fieldBands.length - 1].length;
    }
    this.riverAt = this.rng.range(500, this.worldLength() - 600);
    this.clouds = [];
    for (let i = 0; i < 26; i++) {
      this.clouds.push({
        z: this.rng.range(100, this.worldLength()),
        x: this.rng.range(-90, 90),
        y: this.rng.range(55, 120),
        size: this.rng.range(18, 46),
        speed: this.rng.range(0.4, 1.4),
      });
    }
    // Scattered trees so the ground reads as land, not a green slab.
    this.trees = [];
    const treeRng = makeRandom(mission.seed + 55);
    for (let i = 0; i < 140; i++) {
      const z = treeRng.range(240, this.worldLength() - 100);
      if (this.isRunway(z)) continue;
      this.trees.push({
        z,
        x: treeRng.range(-58, 58),
        height: treeRng.range(4, 8),
      });
    }
  }

  worldLength() {
    const m = this.mission;
    return m.firstRingAt + m.rings * m.ringSpacing + 700;
  }

  runwayEndZ() {
    const m = this.mission;
    return m.firstRingAt + m.rings * m.ringSpacing + 260;
  }

  // Ground elevation at distance z (world units ahead of the start line).
  heightAt(z) {
    if (z < 0) return 0;
    let h = 2;
    for (const hill of this.hills) {
      h += hill.amp * Math.sin(z * hill.freq + hill.phase) * 0.5 + hill.amp * 0.5;
    }
    // The runway strips are flat.
    if (z < 220 || (z > this.runwayEndZ() - 40 && z < this.runwayEndZ() + 240)) {
      return 2;
    }
    return Math.max(0, h);
  }

  // Which ground tone a strip at distance z gets. The tone alternates in
  // short patches along the valley so the near ground is never one flat slab.
  fieldTone(z) {
    if (z < 220 || (z > this.runwayEndZ() - 40 && z < this.runwayEndZ() + 240)) return 'runway';
    if (Math.abs(z - this.riverAt) < 26) return 'river';
    let tone = 0;
    for (const band of this.fieldBands) {
      if (z >= band.z && z < band.z + band.length) { tone = band.tone; break; }
    }
    const flip = Math.floor(z / 26) % 2 === 0 ? 0 : 1;
    return (tone + flip) % 4;
  }

  isRunway(z) {
    return z < 220 || (z > this.runwayEndZ() - 40 && z < this.runwayEndZ() + 240);
  }

  // Golden rings the pilot must fly through, laid out along the valley.
  buildRings() {
    const rng = makeRandom(this.mission.seed + 77);
    const rings = [];
    let x = 0;
    for (let i = 0; i < this.mission.rings; i++) {
      const z = this.mission.firstRingAt + i * this.mission.ringSpacing;
      x = clamp(x + rng.range(-26, 26), -40, 40);
      const ground = this.heightAt(z);
      const y = ground + rng.range(10, 26);
      rings.push({ z, x, y, radius: 7.5, passed: false, index: i });
    }
    return rings;
  }

  // Stone peaks in the canyon and storm missions.
  buildObstacles() {
    const rng = makeRandom(this.mission.seed + 31);
    const peaks = [];
    for (let i = 0; i < this.mission.obstacles; i++) {
      const z = this.mission.firstRingAt + 60 + rng.range(0, this.mission.rings * this.mission.ringSpacing);
      peaks.push({
        z,
        x: rng.range(-48, 48),
        height: rng.range(18, 42),
        width: rng.range(10, 20),
        hit: false,
      });
    }
    return peaks.sort((a, b) => a.z - b.z);
  }

  // Project a world point (distance d ahead, lateral lx, height hy)
  // to screen space, given the camera's height and lateral position.
  project(d, lx, hy, camY, camX = 0) {
    const scale = VIEW.focal / Math.max(6, d);
    return {
      x: VIEW.width / 2 + (lx - camX) * scale,
      y: VIEW.horizonY - (hy - camY) * scale,
      scale,
    };
  }
}
