import { Container, Graphics, Text, TextStyle } from "pixi.js";
import { CARD_WIDTH, CARD_HEIGHT, SNAP_AREA_WIDTH, SNAP_AREA_HEIGHT } from "./constants";

export { SNAP_AREA_WIDTH, SNAP_AREA_HEIGHT };

const LABEL_HEIGHT = 30;
const STACK_OFFSET = 4;

export interface SnapAreaOptions {
  snapPadding?: number;
}

export class SnapArea extends Container {
  private static registry: SnapArea[] = [];

  private cards: Container[] = [];
  private readonly _snapPadding: number | undefined;
  private readonly _zone: Graphics | null = null;
  private readonly _bg: Graphics;
  private _highlighted = false;

  static get all(): readonly SnapArea[] {
    return this.registry;
  }

  static nearest(x: number, y: number): SnapArea | null {
    if (this.registry.length === 0) return null;

    // First pass: areas whose padded bounds contain the point
    const containing: SnapArea[] = [];
    for (const area of this.registry) {
      if (area.containsPoint(x, y)) {
        containing.push(area);
      }
    }

    // If any contain the point, pick the nearest among those
    const candidates = containing.length > 0 ? containing : this.registry;

    let best: SnapArea | null = null;
    let bestDist = Infinity;

    for (const area of candidates) {
      const d = area.distanceTo(x, y);
      if (d < bestDist) {
        bestDist = d;
        best = area;
      }
    }

    return best;
  }

  static highlightNearest(x: number, y: number) {
    const target = this.nearest(x, y);
    for (const area of this.registry) {
      area.setHighlighted(area === target);
    }
  }

  static clearHighlight() {
    for (const area of this.registry) {
      area.setHighlighted(false);
    }
  }

  static clearAll() {
    this.registry.length = 0;
  }

  constructor(label: string, options?: SnapAreaOptions) {
    super();

    this._snapPadding = options?.snapPadding;

    // Snap zone indicator (drawn behind everything, only if padding is set)
    if (this._snapPadding != null) {
      const zone = new Graphics();
      const p = this._snapPadding;
      zone.roundRect(-p, -p, SNAP_AREA_WIDTH + p * 2, SNAP_AREA_HEIGHT + p * 2, 16);
      zone.fill({ color: 0xffffff, alpha: 0.03 });
      zone.stroke({ color: 0xffffff, alpha: 0.1, width: 1 });
      zone.visible = false;
      this._zone = zone;
      this.addChild(zone);
    }

    // Background
    this._bg = new Graphics();
    this.drawBg(false);
    this.addChild(this._bg);

    // Label
    const text = new Text({
      text: label,
      style: new TextStyle({
        fontSize: 14,
        fill: 0xcccccc,
        fontFamily: "sans-serif",
        align: "center",
      }),
    });
    text.x = SNAP_AREA_WIDTH / 2 - text.width / 2;
    text.y = 8;
    this.addChild(text);
    SnapArea.registry.push(this);
  }

  get highlighted(): boolean {
    return this._highlighted;
  }

  private setHighlighted(on: boolean) {
    if (this._highlighted === on) return;
    this._highlighted = on;
    if (this._zone) this._zone.visible = on;
    this.drawBg(on);
  }

  private drawBg(highlighted: boolean) {
    this._bg.clear();
    this._bg.roundRect(0, 0, SNAP_AREA_WIDTH, SNAP_AREA_HEIGHT, 12);
    if (highlighted) {
      this._bg.fill({ color: 0xffffff, alpha: 0.15 });
      this._bg.stroke({ color: 0xffffff, width: 1.5, alpha: 0.6 });
    } else {
      this._bg.fill({ color: 0xffffff, alpha: 0.08 });
      this._bg.stroke({ color: 0xaaaaaa, width: 1, alpha: 0.4 });
    }
  }

  containsPoint(x: number, y: number): boolean {
    if (this._snapPadding == null) return false;
    const p = this._snapPadding;
    return (
      x >= this.x - p &&
      x <= this.x + SNAP_AREA_WIDTH + p &&
      y >= this.y - p &&
      y <= this.y + SNAP_AREA_HEIGHT + p
    );
  }

  get centerX(): number {
    return this.x + SNAP_AREA_WIDTH / 2;
  }

  get centerY(): number {
    return this.y + SNAP_AREA_HEIGHT / 2;
  }

  get cardCount(): number {
    return this.cards.length;
  }

  distanceTo(x: number, y: number): number {
    const dx = x - this.centerX;
    const dy = y - this.centerY;
    return Math.sqrt(dx * dx + dy * dy);
  }

  addCard(card: Container) {
    // Remove from any other area first
    for (const area of SnapArea.registry) {
      if (area !== this) {
        area.removeCard(card);
      }
    }

    // Avoid duplicates in this area
    if (!this.cards.includes(card)) {
      this.cards.push(card);
    }

    this.layoutCards();
  }

  removeCard(card: Container) {
    const idx = this.cards.indexOf(card);
    if (idx !== -1) {
      this.cards.splice(idx, 1);
    }
  }

  private layoutCards() {
    const startX = this.x + (SNAP_AREA_WIDTH - CARD_WIDTH) / 2;
    const startY = this.y + LABEL_HEIGHT;

    for (let i = 0; i < this.cards.length; i++) {
      this.cards[i].x = startX + i * STACK_OFFSET;
      this.cards[i].y = startY + i * STACK_OFFSET;
    }
  }

  destroy(options?: any) {
    const idx = SnapArea.registry.indexOf(this);
    if (idx !== -1) {
      SnapArea.registry.splice(idx, 1);
    }
    super.destroy(options);
  }
}
