import { describe, it, expect, afterEach, beforeEach, vi } from "vitest";
import { Application } from "pixi.js";
import { mount, waitFrames, snapshot } from "../test-helpers";
import { RevealEffect } from "./RevealEffect";

describe("RevealEffect", () => {
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

  it("flash starts visible and fades to 0", async () => {
    const effect = new RevealEffect(200, 200, 0.5);
    app.stage.addChild(effect);

    effect.play();

    // Immediately after play, flash should be visible
    expect(effect.flashVisible).toBe(true);
    expect(effect.flashAlpha).toBeCloseTo(0.6, 1);
    snapshot(app, "flash start");

    // Wait a bit — flash should fade
    await waitFrames(app, 15);
    snapshot(app, "flash fading");

    expect(effect.flashAlpha).toBeLessThan(0.6);
  });

  it("onComplete fires after effect duration", async () => {
    const onComplete = vi.fn();
    const effect = new RevealEffect(200, 200, 0.3);
    app.stage.addChild(effect);
    effect.onComplete = onComplete;

    effect.play();

    // Wait long enough for the effect to complete (~0.3s = ~18 frames)
    for (let i = 0; i < 60; i++) {
      await waitFrames(app, 1);
      if (onComplete.mock.calls.length > 0) break;
    }

    expect(onComplete).toHaveBeenCalledTimes(1);
  });
});
