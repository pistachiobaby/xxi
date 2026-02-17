import { Application, Container, Graphics, Sprite, Texture, Ticker } from "pixi.js";
import { ReelItemTile } from "./ReelItemTile";
import {
  REEL_ITEM_WIDTH,
  REEL_ITEM_HEIGHT,
  SPIN_SPEED,
  SPIN_DURATION,
  DECEL_DURATION,
  LANDING_DURATION,
} from "./constants";
import type { ReelItem } from "./constants";
import { RevealEffect } from "./RevealEffect";

export enum ReelState {
  IDLE = "IDLE",
  SPINNING = "SPINNING",
  DECELERATING = "DECELERATING",
  LANDING = "LANDING",
}

const TILE_GAP = 12;
const TILE_STRIDE = REEL_ITEM_WIDTH + TILE_GAP;
const BUFFER_TILES = 3;
const FADE_WIDTH = 120;
// Smooth-stop hermite: initial slope (m0). Must be ≤ 3 for monotonic (no overshoot).
const SMOOTH_STOP_M0 = 2;
// Damped spring settle during landing
const SPRING_AMPLITUDE = 25; // px
const SPRING_DECAY = 5;      // damping rate
const SPRING_FREQ = 14;      // rad/s (~2 visible oscillations)
// Background color for fade overlays (matches canvas bg #0a0a14)
const BG_R = 10;
const BG_G = 10;
const BG_B = 20;

/** Mulberry32 — deterministic 32-bit PRNG. Returns a function that yields [0, 1). */
function mulberry32(seed: number): () => number {
  let s = seed | 0;
  return () => {
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export class SpotlightReel extends Container {
  state: ReelState = ReelState.IDLE;
  onReveal: ((item: ReelItem) => void) | null = null;

  readonly viewportWidth: number;
  readonly viewportHeight = REEL_ITEM_HEIGHT;
  private strip: Container;
  private clipMask: Graphics;
  private tiles: ReelItemTile[] = [];
  private items: ReelItem[];
  private app: Application;
  private tickerCallback: ((ticker: Ticker) => void) | null = null;

  private elapsed = 0;
  private targetItem: ReelItem | null = null;
  private winnerTileIndex = -1;

  // Seeded PRNG for deterministic item stream
  private rng: (() => number) | null = null;

  // Cumulative scroll offset (increases as we scroll left)
  /** @internal exposed for testing */
  _scrollOffset = 0;
  /** @internal exposed for testing */
  _decelStartOffset = 0;
  /** @internal exposed for testing */
  _decelTargetOffset = 0;
  /** @internal Computed so initial decel velocity matches SPIN_SPEED */
  _effectiveDecelDuration = DECEL_DURATION;
  /** @internal Back-ease-out derivative at t=0, exposed for testing */
  readonly _easingDerivAtZero: number;
  /** @internal Spring displacement during landing (px), exposed for testing */
  _springOffset = 0;

  constructor(app: Application, width: number, items: ReelItem[]) {
    super();
    this.app = app;
    this.items = [...items];
    this._easingDerivAtZero = SMOOTH_STOP_M0;

    // Viewport fills the given width, or defaults to screen width
    this.viewportWidth = width ?? app.screen.width;

    // Compute how many tiles are visible + buffers on each side
    const visibleTiles = Math.ceil(this.viewportWidth / TILE_STRIDE) + 1;
    const totalTiles = visibleTiles + BUFFER_TILES * 2;

    // Clipping mask
    this.clipMask = new Graphics();
    this.clipMask.rect(0, 0, this.viewportWidth, REEL_ITEM_HEIGHT);
    this.clipMask.fill(0xffffff);
    this.addChild(this.clipMask);

    // Strip container (masked)
    this.strip = new Container();
    this.strip.mask = this.clipMask;
    this.addChild(this.strip);

    // Create initial tiles laid out horizontally
    const centerIdx = BUFFER_TILES + Math.floor(visibleTiles / 2);
    for (let i = 0; i < totalTiles; i++) {
      const item = this.items[i % this.items.length];
      const tile = new ReelItemTile(item);
      tile.x = i * TILE_STRIDE;
      tile.y = 0;
      this.strip.addChild(tile);
      this.tiles.push(tile);
    }

    // Position strip so the center tile is centered in viewport
    this._scrollOffset =
      centerIdx * TILE_STRIDE -
      (this.viewportWidth / 2 - REEL_ITEM_WIDTH / 2);
    this.applyScroll();

    // Fade overlays (on top of strip, not masked)
    this.addChild(this.createFade(true));  // left fade
    this.addChild(this.createFade(false)); // right fade

    this.tickerCallback = this.update.bind(this);
    app.ticker.add(this.tickerCallback);
  }

  get stripX(): number {
    return this.strip.x;
  }

  /** Start a spin. The backend picks the winner; seed drives visual filler only. */
  spin(seed: number, winner: ReelItem) {
    if (this.state !== ReelState.IDLE) return;

    this.rng = mulberry32(seed);
    this.targetItem = winner;

    this.elapsed = 0;
    this.state = ReelState.SPINNING;
  }

  getWinnerTile(): ReelItemTile | null {
    if (this.winnerTileIndex >= 0 && this.winnerTileIndex < this.tiles.length) {
      return this.tiles[this.winnerTileIndex];
    }
    return null;
  }

  /** Pull the next item from the seeded PRNG stream. */
  private nextStreamItem(): ReelItem {
    return this.items[Math.floor(this.rng!() * this.items.length)];
  }

  private createFade(left: boolean): Sprite {
    const canvas = document.createElement("canvas");
    canvas.width = FADE_WIDTH;
    canvas.height = REEL_ITEM_HEIGHT;
    const ctx = canvas.getContext("2d")!;
    const grad = ctx.createLinearGradient(0, 0, FADE_WIDTH, 0);
    if (left) {
      grad.addColorStop(0, `rgba(${BG_R},${BG_G},${BG_B},1)`);
      grad.addColorStop(1, `rgba(${BG_R},${BG_G},${BG_B},0)`);
    } else {
      grad.addColorStop(0, `rgba(${BG_R},${BG_G},${BG_B},0)`);
      grad.addColorStop(1, `rgba(${BG_R},${BG_G},${BG_B},1)`);
    }
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, FADE_WIDTH, REEL_ITEM_HEIGHT);

    const sprite = new Sprite(Texture.from(canvas));
    sprite.x = left ? 0 : this.viewportWidth - FADE_WIDTH;
    sprite.y = 0;
    return sprite;
  }

  private applyScroll() {
    this.strip.x = -(this._scrollOffset + this._springOffset);
  }

  private update(ticker: Ticker) {
    const dt = ticker.deltaMS / 1000;

    switch (this.state) {
      case ReelState.SPINNING:
        this.elapsed += dt;
        this._scrollOffset += SPIN_SPEED * dt;
        this.recycleTiles();
        this.applyScroll();

        if (this.elapsed >= SPIN_DURATION) {
          this.beginDeceleration();
        }
        break;

      case ReelState.DECELERATING: {
        this.elapsed += dt;
        const t = Math.min(this.elapsed / this._effectiveDecelDuration, 1);
        const eased = this.smoothStop(t);
        this._scrollOffset =
          this._decelStartOffset +
          (this._decelTargetOffset - this._decelStartOffset) * eased;
        this.applyScroll();

        if (t >= 1) {
          this._scrollOffset = this._decelTargetOffset;
          this.applyScroll();
          this.beginLanding();
        }
        break;
      }

      case ReelState.LANDING:
        this.elapsed += dt;
        // Damped spring oscillation around the target
        this._springOffset =
          SPRING_AMPLITUDE *
          Math.exp(-SPRING_DECAY * this.elapsed) *
          Math.sin(SPRING_FREQ * this.elapsed);
        this.applyScroll();

        if (this.elapsed >= LANDING_DURATION) {
          this._springOffset = 0;
          this.applyScroll();
          this.state = ReelState.IDLE;
          if (this.onReveal && this.targetItem) {
            this.onReveal(this.targetItem);
          }
        }
        break;
    }
  }

  private beginDeceleration() {
    this.state = ReelState.DECELERATING;
    this.elapsed = 0;
    this._decelStartOffset = this._scrollOffset;

    // --- Pre-place planned tiles ahead (off-screen right) ---
    // Don't touch any currently visible tiles.

    // Find the current rightmost tile position
    let maxX = -Infinity;
    for (const t of this.tiles) {
      if (t.x > maxX) maxX = t.x;
    }

    // We need enough tiles ahead so the winner scrolls in naturally.
    // Plan: viewportWidth * 1.5 of travel, winner roughly in the center.
    // Add extra tiles past the winner for the spring settle visual buffer.
    const travelPx = this.viewportWidth * 1.5;
    const planCount = Math.ceil(travelPx / TILE_STRIDE) + BUFFER_TILES;
    const winnerPos = Math.floor(planCount * 0.55);

    // Place planned tiles extending from current rightmost
    for (let i = 0; i < planCount; i++) {
      maxX += TILE_STRIDE;
      const item = i === winnerPos ? this.targetItem! : this.nextStreamItem();
      const tile = new ReelItemTile(item);
      tile.x = maxX;
      tile.y = 0;
      this.strip.addChild(tile);
      this.tiles.push(tile);

      if (i === winnerPos) {
        this.winnerTileIndex = this.tiles.length - 1;
      }
    }

    // Target scroll so the winner tile's center aligns with viewport center
    const winnerTile = this.tiles[this.winnerTileIndex];
    const viewportCenter = this.viewportWidth / 2;
    this._decelTargetOffset =
      winnerTile.x + REEL_ITEM_WIDTH / 2 - viewportCenter;

    // Compute decel duration so initial velocity matches SPIN_SPEED.
    // smoothStop'(0) = SMOOTH_STOP_M0
    const decelDistance = this._decelTargetOffset - this._decelStartOffset;
    this._effectiveDecelDuration =
      (decelDistance * this._easingDerivAtZero) / SPIN_SPEED;
  }

  private beginLanding() {
    this.state = ReelState.LANDING;
    this.elapsed = 0;

    const winner = this.getWinnerTile();
    if (winner) {
      winner.highlight();
    }

    // Clean up tiles that scrolled far off-screen left
    this.pruneOffscreenTiles();

    // Play reveal effect
    const effect = new RevealEffect(
      this.viewportWidth,
      REEL_ITEM_HEIGHT,
      LANDING_DURATION
    );
    this.addChild(effect);
    effect.play();
  }

  /** Remove tiles far off the left side of the viewport to keep the strip lean. */
  private pruneOffscreenTiles() {
    const leftEdge = this._scrollOffset - this.viewportWidth;
    const toRemove: number[] = [];
    for (let i = 0; i < this.tiles.length; i++) {
      if (this.tiles[i].x + REEL_ITEM_WIDTH < leftEdge) {
        toRemove.push(i);
      }
    }
    // Remove in reverse to preserve indices
    for (let i = toRemove.length - 1; i >= 0; i--) {
      const idx = toRemove[i];
      const tile = this.tiles[idx];
      this.strip.removeChild(tile);
      tile.destroy();
      this.tiles.splice(idx, 1);
      // Adjust winnerTileIndex if needed
      if (idx < this.winnerTileIndex) {
        this.winnerTileIndex--;
      }
    }
  }

  /** Recycle tiles that scroll off the left to the right with stream items. */
  private recycleTiles() {
    let maxX = -Infinity;
    for (const t of this.tiles) {
      if (t.x > maxX) maxX = t.x;
    }

    for (let i = 0; i < this.tiles.length; i++) {
      const tile = this.tiles[i];
      const screenX = tile.x - this._scrollOffset;
      if (screenX + REEL_ITEM_WIDTH < -TILE_STRIDE) {
        maxX += TILE_STRIDE;

        const item = this.rng ? this.nextStreamItem() : this.items[0];
        this.strip.removeChild(tile);
        tile.destroy();

        const newTile = new ReelItemTile(item);
        newTile.x = maxX;
        newTile.y = 0;
        this.strip.addChild(newTile);
        this.tiles[i] = newTile;
      }
    }
  }

  /** Smooth-stop hermite cubic: monotonic deceleration, no overshoot.
   *  f(t) = (m-2)t³ + (3-2m)t² + mt  where m = SMOOTH_STOP_M0
   *  With m=2 this simplifies to -t² + 2t (uniform deceleration). */
  private smoothStop(t: number): number {
    const m = SMOOTH_STOP_M0;
    return (m - 2) * t * t * t + (3 - 2 * m) * t * t + m * t;
  }

  destroy(options?: any) {
    if (this.tickerCallback) {
      try {
        this.app.ticker.remove(this.tickerCallback);
      } catch {
        // Ticker may already be destroyed
      }
      this.tickerCallback = null;
    }
    super.destroy(options);
  }
}
