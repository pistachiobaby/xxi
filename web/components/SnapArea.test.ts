import { describe, it, expect, afterEach, beforeEach } from "vitest";
import { Application } from "pixi.js";
import { mount, waitFrames, drag, snapshot, readPixel, pointerEvent } from "../test-helpers";
import { SnapArea, SNAP_AREA_WIDTH, SNAP_AREA_HEIGHT } from "./SnapArea";
import { Card, CARD_WIDTH, CARD_HEIGHT } from "./Card";

describe("SnapArea", () => {
  let app: Application;

  beforeEach(async () => {
    app = new Application();
    await app.init({
      width: 640,
      height: 400,
      background: "#1a472a",
      antialias: true,
    });
    mount(app);
  });

  afterEach(() => {
    SnapArea.clearAll();
    app.destroy(true, { children: true });
  });

  it("renders a labeled area with expected dimensions", async () => {
    const area = new SnapArea("Hand");
    area.x = 50;
    area.y = 50;
    app.stage.addChild(area);

    await waitFrames(app, 2);
    snapshot(app, "snap area labeled 'Hand'");

    expect(area.width).toBeGreaterThanOrEqual(SNAP_AREA_WIDTH);
    expect(area.height).toBeGreaterThanOrEqual(SNAP_AREA_HEIGHT);
  });

  it("nearest() returns the closer area to a point", () => {
    const areaA = new SnapArea("A");
    areaA.x = 0;
    areaA.y = 0;

    const areaB = new SnapArea("B");
    areaB.x = 400;
    areaB.y = 0;

    // Point near area A
    expect(SnapArea.nearest(50, 50)).toBe(areaA);
    // Point near area B
    expect(SnapArea.nearest(450, 50)).toBe(areaB);
  });

  it("nearest() returns null when no areas registered", () => {
    expect(SnapArea.nearest(100, 100)).toBeNull();
  });

  it("card snaps to nearest area on release", async () => {
    const area = new SnapArea("Table");
    area.x = 300;
    area.y = 100;
    app.stage.addChild(area);

    const card = new Card("A♠");
    card.x = 50;
    card.y = 50;
    app.stage.addChild(card);

    await waitFrames(app, 2);
    snapshot(app, "before snap");

    // Drag card toward the snap area
    const startX = 50 + CARD_WIDTH / 2;
    const startY = 50 + CARD_HEIGHT / 2;
    const endX = 320;
    const endY = 150;

    await drag(app, startX, startY, endX, endY);
    await waitFrames(app, 2);
    snapshot(app, "after snap to Table");

    expect(area.cardCount).toBe(1);
  });

  it("multiple cards stack with offset within an area", async () => {
    const area = new SnapArea("Hand");
    area.x = 100;
    area.y = 50;
    app.stage.addChild(area);

    const card1 = new Card("A♠");
    const card2 = new Card("K♥");
    const card3 = new Card("Q♦");
    app.stage.addChild(card1, card2, card3);

    area.addCard(card1);
    area.addCard(card2);
    area.addCard(card3);

    await waitFrames(app, 2);
    snapshot(app, "3 cards stacked in Hand");

    expect(area.cardCount).toBe(3);
    // Each card is offset by 4px from the previous
    expect(card2.x - card1.x).toBe(4);
    expect(card2.y - card1.y).toBe(4);
    expect(card3.x - card2.x).toBe(4);
    expect(card3.y - card2.y).toBe(4);
  });

  it("card transfers between areas on re-drag", async () => {
    const areaA = new SnapArea("A");
    areaA.x = 50;
    areaA.y = 50;

    const areaB = new SnapArea("B");
    areaB.x = 400;
    areaB.y = 50;

    app.stage.addChild(areaA, areaB);

    const card = new Card("J♣");
    card.x = 60;
    card.y = 60;
    app.stage.addChild(card);

    await waitFrames(app, 2);

    // Drag to area A
    await drag(app, 100, 120, 100, 120);
    snapshot(app, "card in area A");

    expect(areaA.cardCount).toBe(1);
    expect(areaB.cardCount).toBe(0);

    // Drag card from area A to area B
    const cardCenterX = card.x + CARD_WIDTH / 2;
    const cardCenterY = card.y + CARD_HEIGHT / 2;
    await drag(app, cardCenterX, cardCenterY, 450, 150);
    await waitFrames(app, 2);
    snapshot(app, "card transferred to area B");

    expect(areaA.cardCount).toBe(0);
    expect(areaB.cardCount).toBe(1);
  });

  it("nearest() prefers area whose padded bounds contain the point", () => {
    // Area A is closer by center distance, but has no padding
    const areaA = new SnapArea("A");
    areaA.x = 200;
    areaA.y = 0;

    // Area B is farther by center, but has padding that covers the point
    const areaB = new SnapArea("B", { snapPadding: 100 });
    areaB.x = 400;
    areaB.y = 0;

    // Point at (350, 150) — inside B's padded bounds, closer to A's center
    expect(SnapArea.nearest(350, 150)).toBe(areaB);
  });

  it("nearest() falls back to nearest when outside all padded bounds", () => {
    const areaA = new SnapArea("A", { snapPadding: 20 });
    areaA.x = 0;
    areaA.y = 0;

    const areaB = new SnapArea("B", { snapPadding: 20 });
    areaB.x = 400;
    areaB.y = 0;

    // Point at (200, 500) — outside both padded bounds, closer to A by center
    expect(SnapArea.nearest(100, 500)).toBe(areaA);
  });

  it("containsPoint respects snapPadding", () => {
    const area = new SnapArea("P", { snapPadding: 50 });
    area.x = 100;
    area.y = 100;

    // Inside the visual rect
    expect(area.containsPoint(150, 150)).toBe(true);
    // Inside the padding but outside the visual rect
    expect(area.containsPoint(60, 150)).toBe(true);
    // Outside the padding
    expect(area.containsPoint(40, 150)).toBe(false);
  });

  it("containsPoint returns false when no snapPadding set", () => {
    const area = new SnapArea("NoPad");
    area.x = 100;
    area.y = 100;

    // Even a point inside the visual rect returns false — no snap zone defined
    expect(area.containsPoint(150, 150)).toBe(false);
  });

  it("creates zone graphic when snapPadding is set", () => {
    const area = new SnapArea("Zone", { snapPadding: 40 });
    // 3 children: zone graphic, bg graphic, label text
    expect(area.children.length).toBe(3);
  });

  it("does not create zone graphic without snapPadding", () => {
    const area = new SnapArea("Plain");
    // 2 children: bg graphic, label text (no zone)
    expect(area.children.length).toBe(2);
  });

  it("zone indicator is hidden by default", async () => {
    const area = new SnapArea("Hidden", { snapPadding: 60 });
    area.x = 200;
    area.y = 100;
    app.stage.addChild(area);

    await waitFrames(app, 2);
    snapshot(app, "zone hidden by default");

    // The zone child exists but is not visible
    const zone = area.children[0];
    expect(zone.visible).toBe(false);
  });

  it("highlightNearest highlights the drop target area", () => {
    const areaA = new SnapArea("A", { snapPadding: 30 });
    areaA.x = 0;
    areaA.y = 0;
    const areaB = new SnapArea("B", { snapPadding: 30 });
    areaB.x = 400;
    areaB.y = 0;

    // Point near A — only A highlighted
    SnapArea.highlightNearest(50, 50);
    expect(areaA.highlighted).toBe(true);
    expect(areaB.highlighted).toBe(false);

    // Move near B — switches
    SnapArea.highlightNearest(450, 50);
    expect(areaA.highlighted).toBe(false);
    expect(areaB.highlighted).toBe(true);
  });

  it("highlightNearest works on areas without snapPadding", () => {
    const area = new SnapArea("NoPad");
    area.x = 100;
    area.y = 100;

    expect(area.highlighted).toBe(false);
    SnapArea.highlightNearest(200, 200);
    expect(area.highlighted).toBe(true);
  });

  it("highlightNearest shows zone graphic on target with padding", () => {
    const area = new SnapArea("Zoned", { snapPadding: 50 });
    area.x = 100;
    area.y = 100;

    const zone = area.children[0];
    expect(zone.visible).toBe(false);

    SnapArea.highlightNearest(150, 150);
    expect(zone.visible).toBe(true);
  });

  it("clearHighlight resets all areas", () => {
    const areaA = new SnapArea("A", { snapPadding: 50 });
    areaA.x = 0;
    areaA.y = 0;
    const areaB = new SnapArea("B");
    areaB.x = 400;
    areaB.y = 0;

    SnapArea.highlightNearest(50, 50);
    expect(areaA.highlighted).toBe(true);

    SnapArea.clearHighlight();
    expect(areaA.highlighted).toBe(false);
    expect(areaB.highlighted).toBe(false);
    // Zone also hidden
    expect(areaA.children[0].visible).toBe(false);
  });

  it("dragging a card highlights the target area and clears on drop", async () => {
    const areaA = new SnapArea("A", { snapPadding: 40 });
    areaA.x = 50;
    areaA.y = 50;
    const areaB = new SnapArea("B", { snapPadding: 40 });
    areaB.x = 400;
    areaB.y = 50;
    app.stage.addChild(areaA, areaB);

    const card = new Card("A♠");
    card.x = 60;
    card.y = 60;
    app.stage.addChild(card);
    await waitFrames(app, 2);

    expect(areaA.highlighted).toBe(false);
    expect(areaB.highlighted).toBe(false);
    snapshot(app, "before drag — nothing highlighted");

    // Start dragging near area A
    pointerEvent(app, "pointerdown", 100, 120);
    await waitFrames(app, 1);
    pointerEvent(app, "pointermove", 100, 120);
    await waitFrames(app, 1);

    expect(areaA.highlighted).toBe(true);
    expect(areaB.highlighted).toBe(false);
    snapshot(app, "dragging near A — A highlighted");

    // Move toward area B
    pointerEvent(app, "pointermove", 450, 150);
    await waitFrames(app, 1);

    expect(areaA.highlighted).toBe(false);
    expect(areaB.highlighted).toBe(true);
    snapshot(app, "dragging near B — B highlighted");

    // Drop
    pointerEvent(app, "pointerup", 450, 150);
    await waitFrames(app, 1);

    expect(areaA.highlighted).toBe(false);
    expect(areaB.highlighted).toBe(false);
    snapshot(app, "after drop — nothing highlighted");
  });

  it("clearAll() empties the registry", () => {
    new SnapArea("X");
    new SnapArea("Y");
    expect(SnapArea.all.length).toBe(2);

    SnapArea.clearAll();
    expect(SnapArea.all.length).toBe(0);
    expect(SnapArea.nearest(0, 0)).toBeNull();
  });
});
