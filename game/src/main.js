// Sky Ranger — the game itself: loop, states, menus and wiring.
// One file, one job: own the canvas, run the frames, switch the screens.

import { VIEW, COLOURS, MISSIONS, PLANE } from './config.js';
import { Terrain } from './terrain.js';
import { Plane } from './plane.js';
import { Renderer } from './render.js';
import { Hud } from './hud.js';
import { MissionRunner } from './missions.js';
import { SoundEngine } from './audio.js';
import { Input } from './input.js';
import { Autopilot, readShotParams, applyShot } from './shots.js';
import { clamp } from './random.js';

export class Game {
  constructor(canvas) {
    this.canvas = canvas;
    this.canvas.width = VIEW.width;
    this.canvas.height = VIEW.height;
    this.ctx = canvas.getContext('2d');
    this.input = new Input(canvas);
    this.sound = new SoundEngine();
    this.renderer = new Renderer(this.ctx);
    this.hud = new Hud();
    this.autopilot = new Autopilot(this);
    this.plane = new Plane();
    this.state = 'menu';
    this.missionIndex = 0;
    this.mission = MISSIONS[0];
    this.terrain = new Terrain(this.mission);
    this.runner = new MissionRunner(this);
    this.time = 0;
    this.shake = 0;
    this.flashRed = 0;
    this.best = Number(window.localStorage.getItem('skyranger-best') || 0);
    this.overlay = null; // { title, lines[], footer }
    this.params = readShotParams();
    if (this.params.autoplay) this.autopilot.enabled = true;
    this.loadMission(0);
    if (this.params.shot) {
      // Screenshot mode: jump straight into a staged scene.
      this.missionIndex = this.params.mission || 0;
      this.loadMission(this.missionIndex);
      applyShot(this, this.params.shot);
    }
  }

  loadMission(index) {
    this.missionIndex = index;
    this.mission = MISSIONS[index];
    this.terrain = new Terrain(this.mission);
    this.plane = new Plane();
    this.plane.fuel = this.mission.fuelStart;
    this.runner = new MissionRunner(this);
    this.runner.startLevel(this.mission);
    this.runner.score = this.totalScore || 0;
  }

  get rings() {
    return this.runner.rings;
  }

  get ringsPassed() {
    return this.runner.ringsPassed;
  }

  get combo() {
    return this.runner.combo;
  }

  get score() {
    return this.runner.score;
  }

  clockText() {
    return this.runner.clockText;
  }

  startGame() {
    this.totalScore = 0;
    this.loadMission(this.missionIndex);
    this.state = 'briefing';
    this.briefUntil = this.time + 2.6;
    this.sound.unlock();
    this.sound.click();
  }

  nextLevel() {
    this.totalScore = this.runner.score;
    if (this.missionIndex + 1 >= MISSIONS.length) {
      this.state = 'victory';
      this.saveBest();
      return;
    }
    this.loadMission(this.missionIndex + 1);
    this.state = 'briefing';
    this.briefUntil = this.time + 2.6;
  }

  saveBest() {
    if (this.runner.score > this.best) {
      this.best = this.runner.score;
      window.localStorage.setItem('skyranger-best', String(this.best));
    }
  }

  frame(now) {
    const dt = Math.min(0.05, (now - (this.lastNow || now)) / 1000 || 0.016);
    this.lastNow = now;
    this.time += dt;
    this.update(dt);
    this.draw();
    this.input.endFrame();
    requestAnimationFrame((t) => this.frame(t));
  }

  update(dt) {
    // Global keys, whatever the state.
    if (this.input.wasPressed('m')) {
      this.sound.toggleMute();
    }
    if (this.state === 'menu') {
      if (this.input.wasPressed('1')) { this.missionIndex = 0; this.startGame(); }
      if (this.input.wasPressed('2')) { this.missionIndex = 1; this.startGame(); }
      if (this.input.wasPressed('3')) { this.missionIndex = 2; this.startGame(); }
      if (this.input.anyKeyPressed()) this.startGame();
      this.renderer.updateParticles(dt);
      return;
    }
    if (this.state === 'briefing') {
      if (this.time >= this.briefUntil || this.input.anyKeyPressed()) {
        this.state = 'playing';
      }
      return;
    }
    if (this.state === 'paused') {
      if (this.input.wasPressed('p') || this.input.wasPressed('escape')) this.state = 'playing';
      return;
    }
    if (this.state === 'crashed' || this.state === 'landed' || this.state === 'victory' || this.state === 'gameover') {
      if (this.input.wasPressed('enter') || this.input.wasPressed(' ')) {
        if (this.state === 'landed') this.nextLevel();
        else if (this.state === 'victory') this.state = 'menu';
        else this.startGame();
      }
      if (this.input.wasPressed('r')) this.startGame();
      if (this.input.wasPressed('escape')) this.state = 'menu';
      this.renderer.updateParticles(dt);
      return;
    }

    // Playing.
    if (this.input.wasPressed('p') || this.input.wasPressed('escape')) {
      this.state = 'paused';
      return;
    }
    if (this.input.wasPressed('g')) {
      this.plane.gearDown = !this.plane.gearDown;
      this.sound.click();
    }
    if (this.input.wasPressed('h')) this.showHelp = !this.showHelp;

    // Wind gusts in the storm mission.
    const wind = this.mission.wind * Math.sin(this.time * 0.7) * 1.4;
    let steerX = this.input.steerX();
    let steerY = this.input.steerY();
    let throttleDelta = this.input.throttleDelta();
    if (this.autopilot.enabled) {
      const auto = this.autopilot.control();
      steerX = auto.steerX;
      steerY = auto.steerY;
      throttleDelta = auto.throttleDelta;
    }

    this.plane.update(dt, steerX, steerY, throttleDelta, wind, this.terrain);
    const events = this.runner.update(dt);
    for (const ev of events) this.handleEvent(ev);

    // Lightning in the storm mission.
    if (this.mission.sky === 'storm' && Math.random() < dt * 0.55) {
      this.renderer.flash = 1;
    }
    this.sound.setFlight(this.plane.throttle, this.plane.speed, this.state === 'playing');

    // Crash and fuel-out endings.
    if (this.plane.crashed) {
      this.state = 'crashed';
      this.sound.thud();
      this.shake = 0.7;
      this.saveBest();
    } else if (this.plane.outOfFuel && this.plane.alt <= this.terrain.heightAt(this.plane.z) + 1.5 && this.plane.speed < 12) {
      this.state = 'gameover';
      this.saveBest();
    }
    if (this.shake > 0) this.shake = Math.max(0, this.shake - dt);
    if (this.flashRed > 0) this.flashRed = Math.max(0, this.flashRed - dt * 1.5);
    this.renderer.updateParticles(dt);
  }

  handleEvent(ev) {
    if (ev.type === 'ring') {
      this.sound.ringChime(ev.combo);
      const p = this.terrain.project(18, ev.ring.x, ev.ring.y, this.plane.alt + 5, this.plane.x);
      this.renderer.burst(p.x, p.y, COLOURS.ringOuter, 26);
      this.runner.showMessage(`RING ${ev.ring.index + 1}  +${ev.gained}`, 1.6);
    } else if (ev.type === 'hit') {
      this.sound.thud();
      this.shake = 0.5;
      this.flashRed = 0.6;
      this.runner.showMessage(ev.kind === 'peak' ? 'PEAK STRIKE — 32 DAMAGE' : 'TERRAIN STRIKE — 26 DAMAGE', 2);
    } else if (ev.type === 'landed') {
      this.sound.fanfare();
      this.state = 'landed';
      this.saveBest();
    } else if (ev.type === 'done') {
      this.state = 'gameover';
      this.saveBest();
    }
  }

  draw() {
    const ctx = this.ctx;
    ctx.save();
    if (this.shake > 0) {
      ctx.translate((Math.random() - 0.5) * this.shake * 22, (Math.random() - 0.5) * this.shake * 22);
    }
    const camY = this.plane.alt + 5;
    const camX = this.plane.x;
    const skyKind = this.mission.sky === 'storm' ? 'storm' : this.missionIndex === 2 ? 'storm' : 'day';
    const sunX = 0.72 - this.plane.x * 0.004;

    this.renderer.drawSky(ctx, skyKind, this.time, sunX);
    this.renderer.drawMountains(ctx, this.terrain, this.plane.x, skyKind);
    this.renderer.drawClouds(ctx, this.terrain, this.plane.z, this.time, camX);
    this.renderer.drawGround(ctx, this.terrain, this.plane.z, camY, camX);
    this.renderer.drawPeaks(ctx, this.terrain, this.runner.peaks, this.plane.z, camY, camX);
    this.renderer.drawRings(ctx, this.terrain, this.runner.rings, this.plane.z, camY, this.time, camX);

    // The plane's shadow on the ground below, fading as it climbs.
    const groundBelow = this.terrain.heightAt(this.plane.z + 8);
    const shadowAt = this.terrain.project(42, this.plane.x, groundBelow, camY, camX);
    const heightAbove = Math.max(0, this.plane.alt - groundBelow);
    const shadowStrength = clamp(1 - heightAbove / 60, 0.12, 1);
    ctx.fillStyle = `rgba(10, 22, 12, ${0.34 * shadowStrength})`;
    ctx.beginPath();
    ctx.ellipse(shadowAt.x, shadowAt.y, 52 * shadowStrength + 10, 11 * shadowStrength + 3, 0, 0, Math.PI * 2);
    ctx.fill();

    // The plane, low and centred, banking with the turn.
    const planeX = VIEW.width / 2 + this.plane.bank * 46;
    const planeY = VIEW.height - 148;
    this.plane.draw(ctx, planeX, planeY, 1.35, this.time);
    this.renderer.drawParticles(ctx);
    this.renderer.drawRain(ctx, skyKind);

    // Red flash on damage.
    if (this.flashRed > 0) {
      ctx.fillStyle = `rgba(255, 40, 30, ${this.flashRed * 0.22})`;
      ctx.fillRect(0, 0, VIEW.width, VIEW.height);
    }

    if (this.state === 'playing' || this.state === 'paused' || this.state === 'briefing') {
      this.hud.draw(ctx, this, this.time);
    }
    if (this.state === 'briefing') this.drawBriefing(ctx);
    if (this.state === 'menu') this.drawMenu(ctx);
    if (this.state === 'paused') this.drawPaused(ctx);
    if (this.state === 'crashed') this.drawEndScreen(ctx, 'AIRFRAME LOST', 'The Sky Ranger went down. The valley keeps the wreckage.', true);
    if (this.state === 'gameover') this.drawEndScreen(ctx, 'SORTIE OVER', 'Out of fuel, out of sky. The next pilot is already warming up.', true);
    if (this.state === 'landed') this.drawEndScreen(ctx, 'TOUCHDOWN — LEVEL CLEAR', `Landed clean. Score ${this.runner.score} — press ENTER for the next mission.`, false);
    if (this.state === 'victory') this.drawEndScreen(ctx, 'ALL THREE SORTIES FLOWN', `Final score ${this.runner.score}. Best ${this.best}. You own this sky.`, false);
    if (this.showHelp && this.state === 'playing') this.drawHelp(ctx);
    ctx.restore();
  }

  drawMenu(ctx) {
    const w = VIEW.width;
    const h = VIEW.height;
    ctx.fillStyle = 'rgba(6, 14, 28, 0.45)';
    ctx.fillRect(0, 0, w, h);
    ctx.textAlign = 'center';
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 84px sans-serif';
    ctx.fillText('SKY RANGER', w / 2, 190);
    ctx.fillStyle = COLOURS.ringOuter;
    ctx.font = 'bold 24px sans-serif';
    ctx.fillText('A CHASE-VIEW FLIGHT GAME', w / 2, 232);
    ctx.fillStyle = '#dceaff';
    ctx.font = '18px sans-serif';
    ctx.fillText('Fly the rings. Mind the fuel. Land the plane.', w / 2, 268);

    // Mission cards.
    const cardW = 320;
    const gap = 26;
    const totalW = cardW * 3 + gap * 2;
    const startX = (w - totalW) / 2;
    MISSIONS.forEach((m, i) => {
      const x = startX + i * (cardW + gap);
      const y = 310;
      ctx.fillStyle = 'rgba(8, 20, 38, 0.78)';
      ctx.beginPath();
      ctx.roundRect(x, y, cardW, 150, 12);
      ctx.fill();
      ctx.strokeStyle = i === this.missionIndex ? COLOURS.ringOuter : 'rgba(140, 190, 235, 0.4)';
      ctx.lineWidth = i === this.missionIndex ? 3 : 1;
      ctx.stroke();
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 19px sans-serif';
      ctx.fillText(m.name, x + cardW / 2, y + 42);
      ctx.fillStyle = '#9fb8d8';
      ctx.font = '15px sans-serif';
      ctx.fillText(m.subtitle, x + cardW / 2, y + 70);
      ctx.fillStyle = COLOURS.ringOuter;
      ctx.font = 'bold 15px sans-serif';
      ctx.fillText(`${m.rings} rings · press ${i + 1}`, x + cardW / 2, y + 108);
    });

    ctx.fillStyle = '#dceaff';
    ctx.font = '16px sans-serif';
    ctx.fillText('ARROWS steer · W/S throttle · G landing gear · P pause · M mute · H help', w / 2, 520);
    ctx.fillStyle = COLOURS.hudAmber;
    ctx.font = 'bold 20px sans-serif';
    ctx.fillText('PRESS ANY KEY TO FLY', w / 2, 566);
    if (this.best > 0) {
      ctx.fillStyle = '#9fb8d8';
      ctx.font = '15px sans-serif';
      ctx.fillText(`Best score: ${this.best}`, w / 2, 596);
    }
  }

  drawBriefing(ctx) {
    const w = VIEW.width;
    ctx.fillStyle = 'rgba(6, 14, 28, 0.55)';
    ctx.fillRect(0, 0, w, VIEW.height);
    ctx.textAlign = 'center';
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 44px sans-serif';
    ctx.fillText(this.mission.name, w / 2, 300);
    ctx.fillStyle = '#dceaff';
    ctx.font = '20px sans-serif';
    ctx.fillText(this.mission.briefing, w / 2, 344);
    ctx.fillStyle = COLOURS.hudAmber;
    ctx.font = 'bold 18px sans-serif';
    ctx.fillText('GET READY…', w / 2, 392);
  }

  drawPaused(ctx) {
    ctx.fillStyle = 'rgba(6, 14, 28, 0.6)';
    ctx.fillRect(0, 0, VIEW.width, VIEW.height);
    ctx.textAlign = 'center';
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 48px sans-serif';
    ctx.fillText('PAUSED', VIEW.width / 2, 340);
    ctx.fillStyle = '#dceaff';
    ctx.font = '18px sans-serif';
    ctx.fillText('Press P to keep flying', VIEW.width / 2, 384);
  }

  drawEndScreen(ctx, title, line, allowRetry) {
    ctx.fillStyle = 'rgba(6, 14, 28, 0.62)';
    ctx.fillRect(0, 0, VIEW.width, VIEW.height);
    ctx.textAlign = 'center';
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 46px sans-serif';
    ctx.fillText(title, VIEW.width / 2, 300);
    ctx.fillStyle = '#dceaff';
    ctx.font = '20px sans-serif';
    ctx.fillText(line, VIEW.width / 2, 346);
    ctx.fillStyle = COLOURS.hudAmber;
    ctx.font = 'bold 19px sans-serif';
    ctx.fillText(
      allowRetry ? 'ENTER — fly again · R — restart · ESC — menu' : 'ENTER — continue · ESC — menu',
      VIEW.width / 2,
      396,
    );
  }

  drawHelp(ctx) {
    ctx.fillStyle = 'rgba(6, 14, 28, 0.82)';
    ctx.beginPath();
    ctx.roundRect(VIEW.width / 2 - 260, 150, 520, 300, 14);
    ctx.fill();
    ctx.textAlign = 'left';
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 20px sans-serif';
    ctx.fillText('HOW TO FLY', VIEW.width / 2 - 230, 190);
    ctx.font = '16px sans-serif';
    ctx.fillStyle = '#dceaff';
    const lines = [
      '← → / A D — bank and turn',
      '↑ ↓ — pitch up / down',
      'W / S — throttle up / down (wheel works too)',
      'Mouse — hold and drag to steer',
      'G — landing gear (land slow, low, on the runway)',
      'P — pause · M — mute · H — close this help',
      'Golden rings refill fuel and build your combo.',
      'Green rings are worth the detour. Peaks are not.',
    ];
    lines.forEach((l, i) => ctx.fillText(l, VIEW.width / 2 - 230, 222 + i * 28));
  }
}
