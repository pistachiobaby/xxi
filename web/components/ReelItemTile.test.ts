import { describe, it, expect, afterEach, beforeEach } from "vitest";
import { Application } from "pixi.js";
import { mount, waitFrames, snapshot } from "../test-helpers";
import { ReelItemTile } from "./ReelItemTile";
import {
  Rarity,
  RARITY_CONFIG,
  REEL_ITEM_WIDTH,
  REEL_ITEM_HEIGHT,
  PLACEHOLDER_ITEMS,
} from "./constants";
import type { ReelItem } from "./constants";

describe("ReelItemTile", () => {
  let app: Application;

  beforeEach(async () => {
    app = new Application();
    await app.init({
      width: 300,
      height: 300,
      background: "#0a0a14",
      antialias: true,
    });
    mount(app);
  });

  afterEach(() => {
    app.destroy(true, { children: true });
  });

  it("renders at expected dimensions", async () => {
    const item = PLACEHOLDER_ITEMS[0];
    const tile = new ReelItemTile(item);
    tile.x = 50;
    tile.y = 50;
    app.stage.addChild(tile);

    await waitFrames(app, 2);
    snapshot(app, "tile dimensions");

    expect(tile.tileWidth).toBe(REEL_ITEM_WIDTH);
    expect(tile.tileHeight).toBe(REEL_ITEM_HEIGHT);
  });

  it("displays item name", async () => {
    const item = PLACEHOLDER_ITEMS[0];
    const tile = new ReelItemTile(item);
    app.stage.addChild(tile);

    await waitFrames(app, 2);
    snapshot(app, `tile: ${item.name}`);

    expect(tile.nameText.text).toBe(item.name);
  });

  it("each rarity has distinct fill color", async () => {
    const rarities = [Rarity.Common, Rarity.Rare, Rarity.Epic, Rarity.Legendary];
    const colors: number[] = [];

    for (const rarity of rarities) {
      const item: ReelItem = { id: "test", name: "Test", rarity, color: 0xffffff };
      const tile = new ReelItemTile(item);
      tile.x = colors.length * 70;
      app.stage.addChild(tile);
      colors.push(tile.fillColor);
    }

    await waitFrames(app, 2);
    snapshot(app, "all rarities");

    // Each rarity should use its config bgColor
    for (let i = 0; i < rarities.length; i++) {
      expect(colors[i]).toBe(RARITY_CONFIG[rarities[i]].bgColor);
    }

    // All colors should be distinct
    const unique = new Set(colors);
    expect(unique.size).toBe(rarities.length);
  });

  it("highlight() shows glow, unhighlight() hides it", async () => {
    const item = PLACEHOLDER_ITEMS.find((i) => i.rarity === Rarity.Legendary)!;
    const tile = new ReelItemTile(item);
    tile.x = 50;
    tile.y = 50;
    app.stage.addChild(tile);

    await waitFrames(app, 2);
    expect(tile.glowVisible).toBe(false);
    snapshot(app, "no glow");

    tile.highlight();
    await waitFrames(app, 2);
    expect(tile.glowVisible).toBe(true);
    snapshot(app, "with glow");

    tile.unhighlight();
    await waitFrames(app, 2);
    expect(tile.glowVisible).toBe(false);
    snapshot(app, "glow removed");
  });
});
