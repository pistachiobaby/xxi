import { Container, Graphics, Text, TextStyle } from "pixi.js";
import type { Card } from "./Card";
import { CARD_WIDTH, CARD_HEIGHT } from "./Card";

export const SNAP_AREA_WIDTH = 200;
export const SNAP_AREA_HEIGHT = 300;

const LABEL_HEIGHT = 30;
const STACK_OFFSET = 4;

export interface SnapAreaOptions {
  snapPadding?: number;
}

export class SnapArea extends Container {
  private static registry: SnapArea[] = [];

  private cards: Card[] = [];
  private readonly _snapPadding: number | undefined;

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

  static clearAll() {
    this.registry.length = 0;
  }

  constructor(label: string, options?: SnapAreaOptions) {
    super();

    // Background
    const bg = new Graphics();
    bg.roundRect(0, 0, SNAP_AREA_WIDTH, SNAP_AREA_HEIGHT, 12);
    bg.fill({ color: 0xffffff, alpha: 0.08 });
    bg.stroke({ color: 0xaaaaaa, width: 1 });
    this.addChild(bg);

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

    this._snapPadding = options?.snapPadding;
    SnapArea.registry.push(this);
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

  addCard(card: Card) {
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

  removeCard(card: Card) {
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
