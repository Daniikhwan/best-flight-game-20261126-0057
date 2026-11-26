// Sky Ranger — mission flow: rings, scoring, landing, level completion.
// One file, one job: the rules that turn flying into a score.

import { PLANE, SCORE } from './config.js';
import { clamp } from './random.js';

export class MissionRunner {
  constructor(game) {
    this.game = game;
    this.reset();
  }

  reset() {
    this.rings = [];
    this.peaks = [];
    this.ringsPassed = 0;
    this.combo = 1;
    this.score = 0;
    this.elapsed = 0;
    this.landed = false;
    this.levelDone = false;
    this.message = '';
    this.messageUntil = 0;
    this.nextRing = null;
  }

  startLevel(mission) {
    this.mission = mission;
    this.rings = this.game.terrain.buildRings();
    this.peaks = this.game.terrain.buildObstacles();
    this.ringsPassed = 0;
    this.combo = 1;
    this.elapsed = 0;
    this.landed = false;
    this.levelDone = false;
    this.nextRing = this.rings[0];
    this.showMessage(mission.briefing, 4.5);
  }

  showMessage(text, seconds) {
    this.message = text;
    this.messageUntil = this.elapsed + seconds;
  }

  // Returns events for the main loop to react to: 'ring', 'hit', 'landed', 'done'.
  update(dt) {
    const game = this.game;
    const plane = game.plane;
    const events = [];
    this.elapsed += dt;

    // Ring passing: plane crosses the ring's z while inside its circle.
    for (const ring of this.rings) {
      if (ring.passed) continue;
      const dz = ring.z - plane.z;
      if (dz > PLANE.passWindow || dz < -PLANE.passWindow) continue;
      const dx = plane.x - ring.x;
      const dy = plane.alt - ring.y;
      const dist = Math.hypot(dx, dy);
      if (dist < ring.radius + 2.5) {
        ring.passed = true;
        this.ringsPassed++;
        const gained = Math.round(SCORE.ringBase * this.combo);
        this.score += gained;
        plane.fuel = clamp(plane.fuel + PLANE.fuelPerRing, 0, PLANE.fuelCapacity);
        this.combo = Math.min(4, this.combo + SCORE.comboStep);
        this.nextRing = this.rings.find((r) => !r.passed) || null;
        events.push({ type: 'ring', ring, gained, combo: this.combo });
      }
    }

    // Terrain collision: flying into the ground. A gentle touchdown on the
    // runway (or a slow roll on grass) is safe; diving in or hitting a
    // hillside at speed is not.
    const ground = game.terrain.heightAt(plane.z);
    if (plane.alt <= ground + 0.6) {
      const verticalSpeed = Math.sin(plane.pitch) * plane.speed;
      if (!game.terrain.isRunway(plane.z) && (verticalSpeed < -8 || plane.speed > 70)) {
        if (plane.takeDamage(PLANE.terrainHitDamage)) {
          this.combo = 1;
          plane.alt = ground + 4;
          events.push({ type: 'hit', kind: 'terrain' });
        }
      }
      // Rest on the ground instead of sinking through it.
      if (plane.alt < ground + 0.5) plane.alt = ground + 0.5;
    }

    // Peak collision.
    for (const peak of this.peaks) {
      if (peak.hit) continue;
      const dz = peak.z - plane.z;
      if (Math.abs(dz) > 8) continue;
      const groundAtPeak = game.terrain.heightAt(peak.z);
      if (Math.abs(plane.x - peak.x) < peak.width * 0.7 && plane.alt < groundAtPeak + peak.height) {
        peak.hit = true;
        if (plane.takeDamage(PLANE.obstacleHitDamage)) {
          this.combo = 1;
          events.push({ type: 'hit', kind: 'peak' });
        }
      }
    }

    // Landing: over the runway, slow, low, gear down.
    const endZ = game.terrain.runwayEndZ();
    if (
      !this.landed &&
      plane.z > endZ - 40 &&
      plane.z < endZ + 240 &&
      plane.alt < 5 &&
      plane.speed < 42 &&
      plane.gearDown
    ) {
      this.landed = true;
      this.levelDone = true;
      const timeBonus = Math.max(0, Math.round((SCORE.parTimeSeconds - this.elapsed) * SCORE.levelTimeBonusPerSecond));
      this.score += SCORE.landingBonus + timeBonus;
      events.push({ type: 'landed', timeBonus });
    }

    // Flying past the runway without landing: the sortie ends at the fence.
    if (!this.levelDone && plane.z > endZ + 260) {
      this.levelDone = true;
      events.push({ type: 'done', reason: 'overshot' });
    }

    // All rings flown: the runway is the finish line.
    if (!this.levelDone && this.ringsPassed === this.rings.length) {
      this.showMessage('ALL RINGS CLEAR — LAND ON THE RUNWAY AHEAD (press G for gear)', 5);
    }

    return events;
  }

  get clockText() {
    const m = Math.floor(this.elapsed / 60);
    const s = Math.floor(this.elapsed % 60);
    return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  }
}
