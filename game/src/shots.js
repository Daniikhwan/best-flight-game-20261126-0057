// Sky Ranger — demo autopilot and screenshot hooks.
// One file, one job: fly the plane itself (attract mode) and set up
// deterministic scenes for the screenshots, e.g. ?shot=play&autoplay=1.

import { clamp } from './random.js';

export class Autopilot {
  constructor(game) {
    this.game = game;
    this.enabled = false;
  }

  // Steer toward the next ring: bank to match its lateral offset,
  // pitch to match its height, throttle to hold cruise speed.
  // With no rings left, fly the landing: gear down, throttle to idle,
  // settle onto the runway.
  control() {
    const game = this.game;
    const plane = game.plane;
    const ring = game.runner.nextRing;
    let steerX = 0;
    let steerY = 0;
    let throttleDelta = 0;
    let target = 0.72;

    if (ring) {
      const dx = ring.x - plane.x;
      const dy = ring.y - plane.alt;
      steerX = clamp(dx / 18, -1, 1);
      steerY = clamp(dy / 12, -1, 1);
    } else {
      const endZ = game.terrain.runwayEndZ();
      const ground = game.terrain.heightAt(plane.z);
      if (plane.z > endZ - 500) {
        plane.gearDown = true;
        target = 0.08;
        steerX = clamp((0 - plane.x) / 18, -1, 1);
        steerY = clamp((ground + 2.5 - plane.alt) / 10, -1, 1);
      } else {
        steerX = clamp((0 - plane.x) / 18, -1, 1);
        steerY = clamp((ground + 14 - plane.alt) / 10, -1, 1);
      }
    }

    throttleDelta = clamp((target - plane.throttle) * 2, -1, 1);
    return { steerX, steerY, throttleDelta };
  }
}

// Read the URL query once: ?shot=menu|play|landing|storm and ?autoplay=1.
export function readShotParams() {
  const q = new URLSearchParams(window.location.search);
  return {
    shot: q.get('shot') || '',
    autoplay: q.get('autoplay') === '1',
    mission: q.get('mission') ? parseInt(q.get('mission'), 10) : 0,
  };
}

// Place the plane into a photogenic state for a named shot.
export function applyShot(game, shot) {
  const plane = game.plane;
  const terrain = game.terrain;
  if (shot === 'play') {
    // Mid-mission: two rings already flown, a ring dead ahead, throttle up.
    plane.z = 650;
    plane.x = -6;
    plane.alt = terrain.heightAt(650) + 16;
    plane.speed = 84;
    plane.throttle = 0.72;
    plane.fuel = 78;
    game.runner.rings[0].passed = true;
    game.runner.rings[1].passed = true;
    game.runner.ringsPassed = 2;
    game.runner.score = 250;
    game.runner.combo = 1.5;
    game.runner.elapsed = 24;
    game.runner.nextRing = game.runner.rings[2];
    game.state = 'playing';
  } else if (shot === 'landing') {
    // Final approach: gear down, low over the fields, runway ahead.
    const endZ = terrain.runwayEndZ();
    plane.z = endZ - 180;
    plane.x = 2;
    plane.alt = terrain.heightAt(endZ - 180) + 14;
    plane.speed = 52;
    plane.throttle = 0.3;
    plane.gearDown = true;
    plane.fuel = 64;
    for (const r of game.runner.rings) r.passed = true;
    game.runner.ringsPassed = game.runner.rings.length;
    game.runner.score = 1250;
    game.runner.elapsed = 96;
    game.runner.nextRing = null;
    game.state = 'playing';
  } else if (shot === 'storm') {
    // Storm sortie, mid-flight, lightning in the sky.
    plane.z = 480;
    plane.x = 8;
    plane.alt = terrain.heightAt(480) + 20;
    plane.speed = 88;
    plane.throttle = 0.8;
    plane.fuel = 55;
    game.runner.rings[0].passed = true;
    game.runner.rings[1].passed = true;
    game.runner.rings[2].passed = true;
    game.runner.ringsPassed = 3;
    game.runner.score = 340;
    game.runner.combo = 1.75;
    game.runner.elapsed = 41;
    game.runner.nextRing = game.runner.rings[3];
    game.state = 'playing';
  } else {
    game.state = 'menu';
  }
}
