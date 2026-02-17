import { Container, Graphics, Text, TextStyle } from "pixi.js";
import {
  REEL_ITEM_WIDTH,
  REEL_ITEM_HEIGHT,
  RARITY_CONFIG,
} from "./constants";
import type { ReelItem } from "./constants";

const CORNER_RADIUS = 12;
const GLOW_PAD = 8;
const BORDER_WIDTH = 2;

export class ReelItemTile extends Container {
  readonly item: ReelItem;
  readonly nameText: Text;
  readonly fillColor: number;
  readonly tileWidth = REEL_ITEM_WIDTH;
  readonly tileHeight = REEL_ITEM_HEIGHT;

  private glow: Graphics;
  private badge: Text;

  constructor(item: ReelItem) {
    super();
    this.item = item;

    const config = RARITY_CONFIG[item.rarity];
    this.fillColor = config.bgColor;

    // Glow (hidden by default)
    this.glow = new Graphics();
    this.glow.roundRect(
      -GLOW_PAD,
      -GLOW_PAD,
      REEL_ITEM_WIDTH + GLOW_PAD * 2,
      REEL_ITEM_HEIGHT + GLOW_PAD * 2,
      CORNER_RADIUS + 4
    );
    this.glow.fill({ color: config.glowColor, alpha: config.glowAlpha });
    this.glow.visible = false;
    this.addChild(this.glow);

    // Main background
    const bg = new Graphics();
    bg.roundRect(0, 0, REEL_ITEM_WIDTH, REEL_ITEM_HEIGHT, CORNER_RADIUS);
    bg.fill(config.bgColor);
    bg.stroke({ color: config.glowColor, width: BORDER_WIDTH });
    this.addChild(bg);

    // Item color swatch (centered circle)
    const swatch = new Graphics();
    swatch.circle(REEL_ITEM_WIDTH / 2, REEL_ITEM_HEIGHT / 2 - 10, 36);
    swatch.fill(item.color);
    this.addChild(swatch);

    // Item name
    this.nameText = new Text({
      text: item.name,
      style: new TextStyle({
        fontSize: 16,
        fill: 0xffffff,
        fontFamily: "sans-serif",
        align: "center",
        fontWeight: "bold",
      }),
    });
    this.nameText.anchor.set(0.5, 0);
    this.nameText.x = REEL_ITEM_WIDTH / 2;
    this.nameText.y = REEL_ITEM_HEIGHT - 50;
    this.addChild(this.nameText);

    // Rarity badge
    this.badge = new Text({
      text: config.label,
      style: new TextStyle({
        fontSize: 11,
        fill: config.glowColor,
        fontFamily: "sans-serif",
        align: "center",
      }),
    });
    this.badge.anchor.set(0.5, 0);
    this.badge.x = REEL_ITEM_WIDTH / 2;
    this.badge.y = REEL_ITEM_HEIGHT - 28;
    this.addChild(this.badge);
  }

  get glowVisible(): boolean {
    return this.glow.visible;
  }

  highlight() {
    this.glow.visible = true;
  }

  unhighlight() {
    this.glow.visible = false;
  }
}
