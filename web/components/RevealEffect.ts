import { Container, Graphics } from "pixi.js";

export class RevealEffect extends Container {
  onComplete: (() => void) | null = null;

  private flash: Graphics;
  private duration: number;
  private elapsed = 0;
  private playing = false;
  private rafId = 0;

  constructor(width: number, height: number, duration: number) {
    super();
    this.duration = duration;

    // White flash overlay
    this.flash = new Graphics();
    this.flash.rect(0, 0, width, height);
    this.flash.fill({ color: 0xffffff, alpha: 1 });
    this.flash.alpha = 0;
    this.flash.visible = false;
    this.addChild(this.flash);
  }

  get flashAlpha(): number {
    return this.flash.alpha;
  }

  get flashVisible(): boolean {
    return this.flash.visible;
  }

  play() {
    this.playing = true;
    this.elapsed = 0;
    this.flash.visible = true;
    this.flash.alpha = 0.6;
    this.rafId = requestAnimationFrame(this.tick);
  }

  private tick = () => {
    if (!this.playing || this.destroyed) return;

    this.elapsed += 1 / 60;
    const t = Math.min(this.elapsed / this.duration, 1);

    // Flash fades over first 25%
    const flashT = Math.min(t / 0.25, 1);
    this.flash.alpha = 0.6 * (1 - flashT);

    if (t >= 1) {
      this.playing = false;
      this.flash.visible = false;
      this.flash.alpha = 0;
      if (this.onComplete) this.onComplete();
      if (!this.destroyed) {
        this.parent?.removeChild(this);
        this.destroy();
      }
      return;
    }

    this.rafId = requestAnimationFrame(this.tick);
  };

  destroy(options?: any) {
    this.playing = false;
    if (this.rafId) {
      cancelAnimationFrame(this.rafId);
      this.rafId = 0;
    }
    super.destroy(options);
  }
}
