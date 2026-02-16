import { describe, it, expect, afterEach, beforeEach } from "vitest";
import { Application } from "pixi.js";
import { mount, waitFrames, pointerEvent, drag, snapshot } from "../test-helpers";
import { Card, CARD_WIDTH, CARD_HEIGHT } from "./Card";
import { SnapArea } from "./SnapArea";

describe("Card interactions", () => {
  let app: Application;

  beforeEach(async () => {
    app = new Application();
    await app.init({
      width: 480,
      height: 360,
      background: "#1a472a",
      antialias: true,
    });
    mount(app);
  });

  afterEach(() => {
    SnapArea.clearAll();
    app.destroy(true, { children: true });
  });

  it("renders a card at a given position", async () => {
    const card = new Card("A♠");
    card.x = 100;
    card.y = 50;
    app.stage.addChild(card);

    await waitFrames(app, 2);
    snapshot(app, "card at (100, 50)");

    expect(card.x).toBe(100);
    expect(card.y).toBe(50);
    expect(card.width).toBeGreaterThanOrEqual(CARD_WIDTH);
    expect(card.height).toBeGreaterThanOrEqual(CARD_HEIGHT);
  });

  it("can be dragged to a new position", async () => {
    const card = new Card("K♥");
    card.x = 50;
    card.y = 50;
    app.stage.addChild(card);
    await waitFrames(app, 2);
    snapshot(app, "before drag");

    const startX = 50 + CARD_WIDTH / 2;
    const startY = 50 + CARD_HEIGHT / 2;
    const endX = 250;
    const endY = 200;

    await drag(app, startX, startY, endX, endY);
    snapshot(app, "after drag");

    const cardCenterX = card.x + CARD_WIDTH / 2;
    const cardCenterY = card.y + CARD_HEIGHT / 2;
    expect(cardCenterX).toBeCloseTo(endX, -1);
    expect(cardCenterY).toBeCloseTo(endY, -1);
  });

  it("becomes semi-transparent while dragging", async () => {
    const card = new Card("Q♦");
    card.x = 100;
    card.y = 100;
    app.stage.addChild(card);
    await waitFrames(app, 2);

    expect(card.alpha).toBe(1);

    pointerEvent(app, "pointerdown", 140, 160);
    await waitFrames(app, 1);
    snapshot(app, "while dragging (alpha 0.8)");

    expect(card.alpha).toBe(0.8);

    pointerEvent(app, "pointerup", 140, 160);
    await waitFrames(app, 1);
    snapshot(app, "after release (alpha 1.0)");

    expect(card.alpha).toBe(1);
  });

  it("brings dragged card to front (z-order)", async () => {
    const cardA = new Card("A♣");
    cardA.x = 50;
    cardA.y = 50;

    const cardB = new Card("2♣");
    cardB.x = 100;
    cardB.y = 80;

    app.stage.addChild(cardA, cardB);
    await waitFrames(app, 2);
    snapshot(app, "2♣ on top initially");

    expect(app.stage.getChildIndex(cardB)).toBeGreaterThan(
      app.stage.getChildIndex(cardA)
    );

    pointerEvent(app, "pointerdown", 70, 70);
    await waitFrames(app, 1);
    snapshot(app, "A♣ brought to front");

    expect(app.stage.getChildIndex(cardA)).toBeGreaterThan(
      app.stage.getChildIndex(cardB)
    );

    pointerEvent(app, "pointerup", 70, 70);
  });

  it("does not move cards that are not clicked", async () => {
    const card = new Card("3♠");
    card.x = 200;
    card.y = 150;
    app.stage.addChild(card);
    await waitFrames(app, 2);
    snapshot(app, "card at (200, 150)");

    await drag(app, 10, 10, 100, 100);
    snapshot(app, "after drag on empty space — card unmoved");

    expect(card.x).toBe(200);
    expect(card.y).toBe(150);
  });

  it("can drag multiple cards independently", async () => {
    const cardA = new Card("J♥");
    cardA.x = 50;
    cardA.y = 100;

    const cardB = new Card("10♠");
    cardB.x = 250;
    cardB.y = 100;

    app.stage.addChild(cardA, cardB);
    await waitFrames(app, 2);
    snapshot(app, "two cards initial");

    await drag(app, 90, 160, 200, 160);
    snapshot(app, "after dragging J♥ right");

    const aNewX = cardA.x;

    await drag(app, 290, 160, 100, 250);
    snapshot(app, "after dragging 10♠ left");

    const bNewX = cardB.x;

    expect(aNewX).not.toBe(50);
    expect(bNewX).not.toBe(250);
    expect(cardA.x).toBe(aNewX);
  });
});
