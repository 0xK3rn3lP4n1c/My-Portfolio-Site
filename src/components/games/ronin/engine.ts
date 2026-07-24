/**
 * Road of the Ronin — 2-player HTML5 Canvas fighting demo.
 * Ported from the legacy `ronin/` (classes.js + functions.js + index.js) into a single
 * self-contained module. Changes from the original:
 *   - No globals: canvas/context/gravity are module-local, set per game instance.
 *   - GSAP dropped — health bars animate via CSS width transitions instead.
 *   - Assets served from /games/ronin/img/ ; loop pauses when off-screen.
 * Sprites by LuizMelo; based on ChrisCourses' fighting-game tutorial.
 */

const BASE = '/games/ronin/img';
const GRAVITY = 0.7;
const GROUND_Y = 361;

type Vec = { x: number; y: number };
interface SpriteDef { imageSrc: string; framesMax: number; image?: HTMLImageElement }

export interface RoninHandles {
  elements: {
    canvas: HTMLCanvasElement;
    playerHealth: HTMLElement;
    enemyHealth: HTMLElement;
    timer: HTMLElement;
    displayText: HTMLElement;
  };
}

export interface RoninGame {
  start: () => void;
  destroy: () => void;
}

class Sprite {
  position: Vec;
  width = 50;
  height = 150;
  image = new Image();
  scale: number;
  framesMax: number;
  framesCurrent = 0;
  framesElapsed = 0;
  framesHold = 5;
  offset: Vec;
  protected c: CanvasRenderingContext2D;

  constructor(
    c: CanvasRenderingContext2D,
    { position, imageSrc, scale = 1, framesMax = 1, offset = { x: 0, y: 0 } }:
      { position: Vec; imageSrc: string; scale?: number; framesMax?: number; offset?: Vec }
  ) {
    this.c = c;
    this.position = position;
    this.image.src = imageSrc;
    this.scale = scale;
    this.framesMax = framesMax;
    this.offset = offset;
  }

  draw() {
    this.c.drawImage(
      this.image,
      this.framesCurrent * (this.image.width / this.framesMax),
      0,
      this.image.width / this.framesMax,
      this.image.height,
      this.position.x - this.offset.x,
      this.position.y - this.offset.y,
      (this.image.width / this.framesMax) * this.scale,
      this.image.height * this.scale
    );
  }

  animateFrames() {
    this.framesElapsed++;
    if (this.framesElapsed % this.framesHold === 0) {
      if (this.framesCurrent < this.framesMax - 1) this.framesCurrent++;
      else this.framesCurrent = 0;
    }
  }

  update() {
    this.draw();
    this.animateFrames();
  }
}

class Fighter extends Sprite {
  velocity: Vec;
  lastKey?: string;
  attackBox: { position: Vec; offset: Vec; width: number; height: number };
  color: string;
  isAttacking = false;
  health = 100;
  sprites: Record<string, SpriteDef>;
  dead = false;
  private canvasHeight: number;

  constructor(
    c: CanvasRenderingContext2D,
    canvasHeight: number,
    opts: {
      position: Vec; velocity: Vec; color?: string; imageSrc: string; scale?: number;
      framesMax?: number; offset?: Vec; sprites: Record<string, SpriteDef>;
      attackBox: { offset: Vec; width: number; height: number };
    }
  ) {
    super(c, { position: opts.position, imageSrc: opts.imageSrc, scale: opts.scale, framesMax: opts.framesMax, offset: opts.offset });
    this.canvasHeight = canvasHeight;
    this.velocity = opts.velocity;
    this.color = opts.color ?? 'red';
    this.attackBox = {
      position: { x: this.position.x, y: this.position.y },
      offset: opts.attackBox.offset,
      width: opts.attackBox.width,
      height: opts.attackBox.height,
    };
    this.sprites = opts.sprites;
    for (const key in this.sprites) {
      const img = new Image();
      img.src = this.sprites[key].imageSrc;
      this.sprites[key].image = img;
    }
  }

  override update() {
    this.draw();
    if (!this.dead) this.animateFrames();
    this.attackBox.position.x = this.position.x + this.attackBox.offset.x;
    this.attackBox.position.y = this.position.y + this.attackBox.offset.y;
    this.position.x += this.velocity.x;
    this.position.y += this.velocity.y;
    if (this.position.y + this.height + this.velocity.y >= this.canvasHeight - 65) {
      this.velocity.y = 0;
      this.position.y = GROUND_Y;
    } else {
      this.velocity.y += GRAVITY;
    }
  }

  attack() {
    this.switchSprite('attack1');
    this.isAttacking = true;
  }

  takeHit() {
    this.health -= 20;
    if (this.health <= 0) this.switchSprite('death');
    else this.switchSprite('takeHit');
  }

  switchSprite(sprite: string) {
    if (this.image === this.sprites.death.image) {
      if (this.framesCurrent === this.sprites.death.framesMax - 1) this.dead = true;
      return;
    }
    if (this.image === this.sprites.attack1.image && this.framesCurrent < this.sprites.attack1.framesMax - 1) return;
    if (this.image === this.sprites.takeHit.image && this.framesCurrent < this.sprites.takeHit.framesMax - 1) return;

    const def = this.sprites[sprite];
    if (def && this.image !== def.image) {
      this.image = def.image!;
      this.framesMax = def.framesMax;
      this.framesCurrent = 0;
    }
  }
}

function rectangularCollision(r1: Fighter, r2: Fighter) {
  return (
    r1.attackBox.position.x + r1.attackBox.width >= r2.position.x &&
    r1.attackBox.position.x <= r2.position.x + r2.width &&
    r1.attackBox.position.y + r1.attackBox.height >= r2.position.y &&
    r1.attackBox.position.y <= r2.position.y + r2.height
  );
}

export function createRoninGame(h: RoninHandles): RoninGame {
  const { canvas, playerHealth, enemyHealth, timer, displayText } = h.elements;
  const c = canvas.getContext('2d')!;
  canvas.width = 1024;
  canvas.height = 576;

  const background = new Sprite(c, { position: { x: 0, y: 0 }, imageSrc: `${BASE}/rotr-bg.png` });
  const fire = new Sprite(c, { position: { x: 708, y: 165 }, imageSrc: `${BASE}/fireEffect.png`, scale: 8.7, framesMax: 8 });

  const player = new Fighter(c, canvas.height, {
    position: { x: 0, y: 0 }, velocity: { x: 0, y: 0 }, imageSrc: `${BASE}/RoninTakashi/Idle.png`,
    framesMax: 8, scale: 3.5, offset: { x: 300, y: 285 },
    sprites: {
      idle: { imageSrc: `${BASE}/RoninTakashi/Idle.png`, framesMax: 8 },
      run: { imageSrc: `${BASE}/RoninTakashi/Run.png`, framesMax: 8 },
      jump: { imageSrc: `${BASE}/RoninTakashi/Jump.png`, framesMax: 2 },
      fall: { imageSrc: `${BASE}/RoninTakashi/Fall.png`, framesMax: 2 },
      attack1: { imageSrc: `${BASE}/RoninTakashi/Attack1.png`, framesMax: 6 },
      takeHit: { imageSrc: `${BASE}/RoninTakashi/Take Hit - white silhouette.png`, framesMax: 4 },
      death: { imageSrc: `${BASE}/RoninTakashi/Death.png`, framesMax: 6 },
    },
    attackBox: { offset: { x: 100, y: 0 }, width: 260, height: 50 },
  });

  const enemy = new Fighter(c, canvas.height, {
    position: { x: 974, y: 0 }, velocity: { x: 0, y: 0 }, color: 'Green', imageSrc: `${BASE}/OnmyojiAshura/Idle.png`,
    framesMax: 8, scale: 3.2, offset: { x: 403, y: 390 },
    sprites: {
      idle: { imageSrc: `${BASE}/OnmyojiAshura/Idle.png`, framesMax: 8 },
      run: { imageSrc: `${BASE}/OnmyojiAshura/Run.png`, framesMax: 8 },
      jump: { imageSrc: `${BASE}/OnmyojiAshura/Jump.png`, framesMax: 2 },
      fall: { imageSrc: `${BASE}/OnmyojiAshura/Fall.png`, framesMax: 2 },
      attack1: { imageSrc: `${BASE}/OnmyojiAshura/Attack1.png`, framesMax: 8 },
      takeHit: { imageSrc: `${BASE}/OnmyojiAshura/Take hit.png`, framesMax: 3 },
      death: { imageSrc: `${BASE}/OnmyojiAshura/Death.png`, framesMax: 7 },
    },
    attackBox: { offset: { x: -330, y: -50 }, width: 270, height: 70 },
  });

  const keys = {
    a: { pressed: false }, d: { pressed: false },
    ArrowRight: { pressed: false }, ArrowLeft: { pressed: false },
  };

  let timeLeft = 60;
  let timerId: ReturnType<typeof setTimeout> | undefined;
  let rafId = 0;
  let running = false;
  let finished = false;

  function decreaseTimer() {
    if (finished) return;
    if (timeLeft > 0) {
      timerId = setTimeout(decreaseTimer, 1000);
      timeLeft--;
      timer.innerHTML = String(timeLeft);
    }
    if (timeLeft === 0) determineWinner();
  }

  function determineWinner() {
    if (finished) return;
    finished = true;
    if (timerId) clearTimeout(timerId);
    displayText.style.display = 'flex';
    if (player.health === enemy.health) displayText.innerHTML = 'Berabere';
    else if (player.health > enemy.health) displayText.innerHTML = '1. Oyuncu Kazandı';
    else displayText.innerHTML = '2. Oyuncu Kazandı';
  }

  function loop() {
    rafId = requestAnimationFrame(loop);
    c.fillStyle = 'black';
    c.fillRect(0, 0, canvas.width, canvas.height);
    background.update();
    fire.update();
    c.fillStyle = 'rgba(255, 255, 255, 0.078)';
    c.fillRect(0, 0, canvas.width, canvas.height);
    player.update();
    enemy.update();

    player.velocity.x = 0;
    enemy.velocity.x = 0;

    if (keys.a.pressed && player.lastKey === 'a') { player.velocity.x = -7; player.switchSprite('run'); }
    else if (keys.d.pressed && player.lastKey === 'd') { player.velocity.x = 7; player.switchSprite('run'); }
    else player.switchSprite('idle');
    if (player.velocity.y < 0) player.switchSprite('jump');
    else if (player.velocity.y > 0) player.switchSprite('fall');

    if (keys.ArrowLeft.pressed && enemy.lastKey === 'ArrowLeft') { enemy.velocity.x = -7; enemy.switchSprite('run'); }
    else if (keys.ArrowRight.pressed && enemy.lastKey === 'ArrowRight') { enemy.velocity.x = 7; enemy.switchSprite('run'); }
    else enemy.switchSprite('idle');
    if (enemy.velocity.y < 0) enemy.switchSprite('jump');
    else if (enemy.velocity.y > 0) enemy.switchSprite('fall');

    if (rectangularCollision(player, enemy) && player.isAttacking && player.framesCurrent === 4) {
      enemy.takeHit(); player.isAttacking = false; enemyHealth.style.width = enemy.health + '%';
    }
    if (player.isAttacking && player.framesCurrent === 4) player.isAttacking = false;

    if (rectangularCollision(enemy, player) && enemy.isAttacking && enemy.framesCurrent === 4) {
      player.takeHit(); enemy.isAttacking = false; playerHealth.style.width = player.health + '%';
    }
    if (enemy.isAttacking && enemy.framesCurrent === 4) enemy.isAttacking = false;

    if (player.health <= 0 || enemy.health <= 0) determineWinner();
  }

  const onKeyDown = (e: KeyboardEvent) => {
    if (!player.dead) {
      switch (e.key) {
        case 'd': keys.d.pressed = true; player.lastKey = 'd'; break;
        case 'a': keys.a.pressed = true; player.lastKey = 'a'; break;
        case 'w': player.velocity.y = -20; break;
        case ' ': e.preventDefault(); player.attack(); break;
      }
    }
    if (!enemy.dead) {
      switch (e.key) {
        case 'ArrowRight': keys.ArrowRight.pressed = true; enemy.lastKey = 'ArrowRight'; break;
        case 'ArrowLeft': keys.ArrowLeft.pressed = true; enemy.lastKey = 'ArrowLeft'; break;
        case 'ArrowUp': e.preventDefault(); enemy.velocity.y = -20; break;
        case 'Enter': enemy.attack(); break;
      }
    }
    // stop the page from scrolling on the game control keys
    if ([' ', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key)) e.preventDefault();
  };

  const onKeyUp = (e: KeyboardEvent) => {
    switch (e.key) {
      case 'd': keys.d.pressed = false; break;
      case 'a': keys.a.pressed = false; break;
      case 'ArrowLeft': keys.ArrowLeft.pressed = false; break;
      case 'ArrowRight': keys.ArrowRight.pressed = false; break;
    }
  };

  function start() {
    if (running) return;
    running = true;
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    decreaseTimer();
    loop();
  }

  function destroy() {
    running = false;
    cancelAnimationFrame(rafId);
    if (timerId) clearTimeout(timerId);
    window.removeEventListener('keydown', onKeyDown);
    window.removeEventListener('keyup', onKeyUp);
  }

  return { start, destroy };
}
