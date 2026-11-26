// Sky Ranger — keyboard, mouse and touch input, in one place.
// One file, one job: the rest of the game reads plain booleans and axes.

export class Input {
  constructor(canvas) {
    this.keys = new Set();
    this.pressed = new Set(); // edge-triggered, cleared each frame
    this.mouse = { x: 0, y: 0, down: false, active: false };
    this.touch = { active: false, steerX: 0, steerY: 0, throttleUp: false, throttleDown: false };
    this.canvas = canvas;

    window.addEventListener('keydown', (e) => {
      if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', ' '].includes(e.key)) {
        e.preventDefault();
      }
      if (!e.repeat) this.pressed.add(e.key.toLowerCase());
      this.keys.add(e.key.toLowerCase());
    });
    window.addEventListener('keyup', (e) => this.keys.delete(e.key.toLowerCase()));

    canvas.addEventListener('mousemove', (e) => {
      const r = canvas.getBoundingClientRect();
      this.mouse.x = (e.clientX - r.left) / r.width;
      this.mouse.y = (e.clientY - r.top) / r.height;
      this.mouse.active = true;
    });
    canvas.addEventListener('mousedown', () => {
      this.mouse.down = true;
    });
    window.addEventListener('mouseup', () => {
      this.mouse.down = false;
    });
    canvas.addEventListener('wheel', (e) => {
      e.preventDefault();
      this.wheelDelta = (this.wheelDelta || 0) + (e.deltaY < 0 ? 1 : -1);
    }, { passive: false });

    canvas.addEventListener('touchstart', (e) => this.onTouch(e), { passive: false });
    canvas.addEventListener('touchmove', (e) => this.onTouch(e), { passive: false });
    canvas.addEventListener('touchend', () => {
      this.touch.active = false;
      this.touch.throttleUp = false;
      this.touch.throttleDown = false;
    });
  }

  onTouch(e) {
    e.preventDefault();
    const r = this.canvas.getBoundingClientRect();
    const t = e.touches[0];
    const x = (t.clientX - r.left) / r.width;
    const y = (t.clientY - r.top) / r.height;
    // Right-hand strip is the throttle: top half up, bottom half down.
    if (x > 0.86) {
      this.touch.throttleUp = y < 0.5;
      this.touch.throttleDown = y >= 0.5;
      this.touch.active = false;
    } else {
      this.touch.active = true;
      this.touch.steerX = (x - 0.43) / 0.43;
      this.touch.steerY = (y - 0.5) / 0.5;
    }
  }

  // Steering axis: -1 (full left/down) .. +1 (full right/up).
  steerX() {
    if (this.touch.active) return this.touch.steerX;
    let v = 0;
    if (this.keys.has('arrowleft') || this.keys.has('a')) v -= 1;
    if (this.keys.has('arrowright') || this.keys.has('d')) v += 1;
    if (v === 0 && this.mouse.active && this.mouse.down) {
      v = (this.mouse.x - 0.5) * 2.4;
    }
    return Math.max(-1, Math.min(1, v));
  }

  steerY() {
    if (this.touch.active) return -this.touch.steerY;
    let v = 0;
    if (this.keys.has('arrowup')) v += 1;
    if (this.keys.has('arrowdown')) v -= 1;
    if (v === 0 && this.mouse.active && this.mouse.down) {
      v = -(this.mouse.y - 0.5) * 2.4;
    }
    return Math.max(-1, Math.min(1, v));
  }

  throttleDelta() {
    let d = 0;
    if (this.keys.has('w')) d += 1;
    if (this.keys.has('s')) d -= 1;
    if (this.touch.throttleUp) d += 1;
    if (this.touch.throttleDown) d -= 1;
    if (this.wheelDelta) {
      d += this.wheelDelta * 0.12;
      this.wheelDelta = 0;
    }
    return d;
  }

  wasPressed(key) {
    return this.pressed.has(key.toLowerCase());
  }

  anyKeyPressed() {
    return this.pressed.size > 0 || this.mouse.down;
  }

  endFrame() {
    this.pressed.clear();
  }
}
