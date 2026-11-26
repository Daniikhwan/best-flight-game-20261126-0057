// Sky Ranger — the aircraft: flight model and how it is drawn.
// One file, one job: throttle, pitch, bank, fuel, damage and the plane sprite.

import { PLANE } from './config.js';
import { clamp, lerp } from './random.js';

export class Plane {
  constructor() {
    this.reset();
  }

  reset() {
    this.z = 0; // distance along the valley
    this.x = 0; // lateral offset, -55..55
    this.alt = 2; // altitude above sea level (ground is ~2 at the runway)
    this.speed = 0;
    this.throttle = 0;
    this.pitch = 0; // radians, + is nose up
    this.bank = 0; // radians, + is banking right
    this.heading = 0; // degrees of drift from straight ahead
    this.fuel = 100;
    this.damage = 0;
    this.gearDown = false;
    this.propAngle = 0;
    this.invulnerable = 0; // seconds of grace after a hit
    this.stalled = false;
  }

  // dt in seconds. steerX/steerY are -1..1, throttleDelta is -1..1 per second.
  update(dt, steerX, steerY, throttleDelta, wind, terrain) {
    // Throttle.
    this.throttle = clamp(this.throttle + throttleDelta * 0.55 * dt, 0, 1);

    // Speed chases its throttle target; drag pulls it back.
    const targetSpeed = PLANE.minSpeed + this.throttle * (PLANE.maxSpeed - PLANE.minSpeed);
    this.speed = lerp(this.speed, targetSpeed, 1 - Math.exp(-PLANE.drag * dt));
    if (this.speed < 1 && this.throttle < 0.05) this.speed = 0;

    // Bank follows the stick, then bleeds back toward level.
    const bankTarget = steerX * PLANE.maxBank;
    this.bank = lerp(this.bank, bankTarget, 1 - Math.exp(-PLANE.bankRate * dt));
    if (Math.abs(steerX) < 0.05) this.bank *= Math.exp(-1.6 * dt);

    // Pitch follows the stick; a slow plane stalls and the nose drops.
    this.stalled = this.speed < PLANE.stallSpeed && this.pitch > 0.12;
    const pitchTarget = this.stalled ? -0.22 : steerY * 0.38;
    this.pitch = lerp(this.pitch, pitchTarget, 1 - Math.exp(-3.2 * dt));

    // Lateral drift from bank, plus wind gusts pushing the plane.
    this.x += (this.bank / PLANE.maxBank) * PLANE.lateralSpeed * dt;
    this.x += wind * 6 * dt;
    this.x = clamp(this.x, -PLANE.lateralLimit, PLANE.lateralLimit);
    this.heading = clamp(this.bank * 28, -32, 32);

    // Altitude: climb with pitch, sink with speed loss.
    const climb = Math.sin(this.pitch) * this.speed * 0.42;
    this.alt += climb * dt;
    if (this.speed < PLANE.stallSpeed) this.alt -= PLANE.sinkRate * 0.35 * dt;
    this.alt = Math.max(0.5, this.alt);

    // Forward motion.
    this.z += this.speed * dt;
    this.propAngle += dt * (4 + this.throttle * 26);

    // Fuel burn; empty tanks mean the engine dies and the plane glides down.
    this.fuel -= (PLANE.fuelBurnIdle + this.throttle * PLANE.fuelBurnFull) * dt;
    if (this.fuel <= 0) {
      this.fuel = 0;
      this.throttle = 0;
    }

    if (this.invulnerable > 0) this.invulnerable -= dt;
  }

  takeDamage(amount) {
    if (this.invulnerable > 0) return false;
    this.damage += amount;
    this.invulnerable = 1.6;
    // A hit knocks the plane up and slows it, so the pilot feels it.
    this.alt += 3;
    this.speed *= 0.82;
    return true;
  }

  get health() {
    return Math.max(0, PLANE.maxDamage - this.damage);
  }

  get crashed() {
    return this.damage >= PLANE.maxDamage;
  }

  get outOfFuel() {
    return this.fuel <= 0;
  }

  // Draw the plane in chase view: big, centred low, banking with the turn.
  // screenX/screenY is where the fuselage sits; scale grows as speed rises.
  draw(ctx, screenX, screenY, scale, time) {
    ctx.save();
    ctx.translate(screenX, screenY);
    ctx.rotate(this.bank * 0.55);
    ctx.scale(scale, scale);

    // Soft shadow blob beneath, on the "ground" far below (drawn by render).
    // Propeller blur disc.
    ctx.save();
    ctx.translate(0, -6);
    ctx.fillStyle = 'rgba(40, 48, 60, 0.28)';
    ctx.beginPath();
    ctx.ellipse(0, 0, 26, 30, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = 'rgba(220, 228, 240, 0.5)';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.ellipse(0, 0, 22, 26, 0, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();

    // Tail fin.
    ctx.fillStyle = '#c23b2e';
    ctx.beginPath();
    ctx.moveTo(-4, -34);
    ctx.lineTo(4, -34);
    ctx.lineTo(10, -58);
    ctx.lineTo(-10, -58);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = '#f4f6f8';
    ctx.font = 'bold 11px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('SR', 0, -44);

    // Fuselage: a sleek dart, nose down-screen.
    const body = ctx.createLinearGradient(0, -58, 0, 46);
    body.addColorStop(0, '#f8fafc');
    body.addColorStop(0.55, '#dfe7ef');
    body.addColorStop(1, '#9fb2c4');
    ctx.fillStyle = body;
    ctx.beginPath();
    ctx.moveTo(0, 48);
    ctx.quadraticCurveTo(13, 22, 11, -12);
    ctx.quadraticCurveTo(10, -40, 0, -58);
    ctx.quadraticCurveTo(-10, -40, -11, -12);
    ctx.quadraticCurveTo(-13, 22, 0, 48);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = '#5a6b7d';
    ctx.lineWidth = 1;
    ctx.stroke();

    // Canopy: lit glass with a warm glint.
    ctx.fillStyle = '#1d4e89';
    ctx.beginPath();
    ctx.ellipse(0, -26, 7, 15, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = 'rgba(180, 220, 255, 0.85)';
    ctx.beginPath();
    ctx.ellipse(-2, -30, 2.5, 6, -0.3, 0, Math.PI * 2);
    ctx.fill();

    // Main wings, swept back.
    ctx.fillStyle = '#c23b2e';
    ctx.beginPath();
    ctx.moveTo(-8, -6);
    ctx.lineTo(-64, 26);
    ctx.lineTo(-62, 34);
    ctx.lineTo(-8, 16);
    ctx.closePath();
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(8, -6);
    ctx.lineTo(64, 26);
    ctx.lineTo(62, 34);
    ctx.lineTo(8, 16);
    ctx.closePath();
    ctx.fill();
    // Wing tips, white.
    ctx.fillStyle = '#f4f6f8';
    ctx.fillRect(-64, 26, 8, 8);
    ctx.fillRect(56, 26, 8, 8);

    // Tail wings.
    ctx.fillStyle = '#a33327';
    ctx.beginPath();
    ctx.moveTo(-6, 30);
    ctx.lineTo(-30, 44);
    ctx.lineTo(-28, 49);
    ctx.lineTo(-6, 40);
    ctx.closePath();
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(6, 30);
    ctx.lineTo(30, 44);
    ctx.lineTo(28, 49);
    ctx.lineTo(6, 40);
    ctx.closePath();
    ctx.fill();

    // Navigation lights, blinking.
    const blink = Math.sin(time * 5) > 0;
    if (blink) {
      ctx.fillStyle = '#ff3b30';
      ctx.beginPath();
      ctx.arc(-64, 30, 3, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#35e05a';
      ctx.beginPath();
      ctx.arc(64, 30, 3, 0, Math.PI * 2);
      ctx.fill();
    }
    // Landing light when the gear is down.
    if (this.gearDown) {
      ctx.fillStyle = 'rgba(255, 240, 180, 0.9)';
      ctx.beginPath();
      ctx.arc(0, 44, 4, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }
}
