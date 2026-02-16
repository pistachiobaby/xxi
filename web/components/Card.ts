import { Container, Graphics, Text, TextStyle, FederatedPointerEvent } from "pixi.js";
import { SnapArea } from "./SnapArea";

export const CARD_WIDTH = 80;
export const CARD_HEIGHT = 120;

export class Card extends Container {
  private bg: Graphics;
  private dragging = false;
  private dragOffset = { x: 0, y: 0 };

  constructor(public readonly label: string, color: number = 0xffffff) {
    super();
    this.eventMode = "static";
    this.cursor = "pointer";

    // Card background
    this.bg = new Graphics();
    this.bg.roundRect(0, 0, CARD_WIDTH, CARD_HEIGHT, 8);
    this.bg.fill(color);
    this.bg.stroke({ color: 0x333333, width: 2 });
    this.addChild(this.bg);

    // Card label
    const text = new Text({
      text: label,
      style: new TextStyle({
        fontSize: 16,
        fill: 0x000000,
        fontFamily: "sans-serif",
        align: "center",
      }),
    });
    text.x = CARD_WIDTH / 2 - text.width / 2;
    text.y = CARD_HEIGHT / 2 - text.height / 2;
    this.addChild(text);

    this.on("pointerdown", this.onDragStart, this);
    this.on("pointerup", this.onDragEnd, this);
    this.on("pointerupoutside", this.onDragEnd, this);
    this.on("globalpointermove", this.onDragMove, this);
  }

  private onDragStart(e: FederatedPointerEvent) {
    this.dragging = true;
    this.alpha = 0.8;
    const pos = e.getLocalPosition(this.parent);
    this.dragOffset.x = pos.x - this.x;
    this.dragOffset.y = pos.y - this.y;
    // Bring to front
    this.parent?.setChildIndex(this, this.parent.children.length - 1);
  }

  private onDragMove(e: FederatedPointerEvent) {
    if (!this.dragging) return;
    const pos = e.getLocalPosition(this.parent);
    this.x = pos.x - this.dragOffset.x;
    this.y = pos.y - this.dragOffset.y;
  }

  private onDragEnd() {
    this.dragging = false;
    this.alpha = 1;
    const area = SnapArea.nearest(this.x + CARD_WIDTH / 2, this.y + CARD_HEIGHT / 2);
    if (area) area.addCard(this);
  }
}
