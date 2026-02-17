import { describe, it, expect, afterEach, beforeEach, vi } from "vitest";
import { Application } from "pixi.js";
import { mount, waitFrames, snapshot } from "../test-helpers";
import { SpotlightReel, ReelState } from "./SpotlightReel";
import { REEL_ITEM_WIDTH, SPIN_SPEED, PLACEHOLDER_ITEMS } from "./constants";
import type { ReelItem } from "./constants";

/** Wait until the reel returns to IDLE, or timeout after maxFrames. */
async function waitForIdle(
  app: Application,
  reel: SpotlightReel,
  maxFrames = 1200
) {
  for (let i = 0; i < maxFrames; i++) {
    await waitFrames(app, 1);
    if (reel.state === ReelState.IDLE) return;
  }
}

describe("SpotlightReel", () => {
  let app: Application;

  beforeEach(async () => {
    app = new Application();
    await app.init({
      width: 800,
      height: 400,
      background: "#0a0a14",
      antialias: true,
    });
    mount(app);
  });

  afterEach(() => {
    app.destroy(true, { children: true });
  });

  it("starts in idle state", () => {
    const reel = new SpotlightReel(app, 700, PLACEHOLDER_ITEMS);
    app.stage.addChild(reel);

    expect(reel.state).toBe(ReelState.IDLE);
  });

  it("spin() transitions to spinning", async () => {
    const reel = new SpotlightReel(app, 700, PLACEHOLDER_ITEMS);
    app.stage.addChild(reel);

    reel.spin(42, PLACEHOLDER_ITEMS[0]);
    await waitFrames(app, 2);
    snapshot(app, "spinning");

    expect(reel.state).not.toBe(ReelState.IDLE);
  });

  it("completes full cycle back to idle", async () => {
    const reel = new SpotlightReel(app, 700, PLACEHOLDER_ITEMS);
    app.stage.addChild(reel);

    reel.spin(42, PLACEHOLDER_ITEMS[0]);
    await waitForIdle(app, reel);
    snapshot(app, "back to idle");

    expect(reel.state).toBe(ReelState.IDLE);
  });

  it("onReveal fires with the winner item", async () => {
    const reel = new SpotlightReel(app, 700, PLACEHOLDER_ITEMS);
    app.stage.addChild(reel);

    const winner = PLACEHOLDER_ITEMS[3]; // Mana Crystal
    let revealed: ReelItem | null = null;
    reel.onReveal = (item) => {
      revealed = item;
    };

    reel.spin(42, winner);
    await waitForIdle(app, reel);

    expect(revealed).not.toBeNull();
    expect(revealed!.id).toBe(winner.id);
    expect(revealed!.name).toBe(winner.name);
    expect(revealed!.rarity).toBe(winner.rarity);
  });

  it("spin() is no-op during roll", async () => {
    const reel = new SpotlightReel(app, 700, PLACEHOLDER_ITEMS);
    app.stage.addChild(reel);

    const onReveal = vi.fn();
    reel.onReveal = onReveal;

    reel.spin(42, PLACEHOLDER_ITEMS[0]);
    await waitFrames(app, 2);

    // Second spin should be ignored
    reel.spin(99, PLACEHOLDER_ITEMS[1]);
    await waitForIdle(app, reel);

    // Only one reveal should fire
    expect(onReveal).toHaveBeenCalledTimes(1);
  });

  it("deceleration initial velocity matches spin velocity (no speed jump)", async () => {
    const reel = new SpotlightReel(app, 700, PLACEHOLDER_ITEMS);
    app.stage.addChild(reel);

    reel.spin(42, PLACEHOLDER_ITEMS[0]);

    // Wait until we enter DECELERATING
    for (let i = 0; i < 1200; i++) {
      await waitFrames(app, 1);
      if (reel.state === ReelState.DECELERATING) break;
    }
    expect(reel.state).toBe(ReelState.DECELERATING);

    // The effective duration is computed so initial velocity = SPIN_SPEED.
    // v_decel(0) = decelDistance / effectiveDuration * easingDeriv(0)
    // Verify via: effectiveDuration = decelDistance * easingDeriv(0) / SPIN_SPEED
    const decelDistance = reel._decelTargetOffset - reel._decelStartOffset;
    const expectedDuration =
      (decelDistance * reel._easingDerivAtZero) / SPIN_SPEED;

    expect(reel._effectiveDecelDuration).toBeCloseTo(expectedDuration, 5);
  });

  it("decelerates to target without overshooting, then spring-settles", async () => {
    const reel = new SpotlightReel(app, 700, PLACEHOLDER_ITEMS);
    app.stage.addChild(reel);

    reel.spin(42, PLACEHOLDER_ITEMS[0]);

    // Wait until DECELERATING
    for (let i = 0; i < 1200; i++) {
      await waitFrames(app, 1);
      if (reel.state === ReelState.DECELERATING) break;
    }
    expect(reel.state).toBe(ReelState.DECELERATING);

    const target = reel._decelTargetOffset;

    // --- Phase 1: Deceleration must NOT overshoot the target ---
    while (reel.state === ReelState.DECELERATING) {
      expect(reel._scrollOffset).toBeLessThanOrEqual(target + 0.5);
      await waitFrames(app, 1);
    }

    // --- Phase 2: During landing, spring oscillation around target ---
    let maxSpring = 0;
    let minSpring = 0;

    while (reel.state === ReelState.LANDING) {
      const spring = reel._springOffset;
      if (spring > maxSpring) maxSpring = spring;
      if (spring < minSpring) minSpring = spring;
      await waitFrames(app, 1);
    }

    // Spring oscillated past the target (positive) and back (negative)
    expect(maxSpring).toBeGreaterThan(1);
    expect(minSpring).toBeLessThan(-1);

    // --- Final: spring decayed and scroll is on target ---
    expect(Math.abs(reel._springOffset)).toBeLessThan(1);
    expect(reel._scrollOffset).toBeCloseTo(target, 0);
  });

  it("same seed and winner always reveals the same item", async () => {
    const seed = 12345;
    const winner = PLACEHOLDER_ITEMS[5]; // Flame Ring
    const results: ReelItem[] = [];

    for (let run = 0; run < 3; run++) {
      // Fresh reel each run
      const reel = new SpotlightReel(app, 700, PLACEHOLDER_ITEMS);
      app.stage.addChild(reel);

      let revealed: ReelItem | null = null;
      reel.onReveal = (item) => {
        revealed = item;
      };

      reel.spin(seed, winner);
      await waitForIdle(app, reel);

      expect(revealed).not.toBeNull();
      results.push(revealed!);

      // Tear down for next run
      reel.destroy();
    }

    // All three runs produced the identical item
    expect(results[0].id).toBe(results[1].id);
    expect(results[1].id).toBe(results[2].id);
    expect(results[0].id).toBe(winner.id);
  });

  it("different winners reveal different items", async () => {
    const results: ReelItem[] = [];
    const winners = [PLACEHOLDER_ITEMS[0], PLACEHOLDER_ITEMS[9]]; // Iron Sword, Excalibur

    for (const winner of winners) {
      const reel = new SpotlightReel(app, 700, PLACEHOLDER_ITEMS);
      app.stage.addChild(reel);

      let revealed: ReelItem | null = null;
      reel.onReveal = (item) => {
        revealed = item;
      };

      reel.spin(42, winner);
      await waitForIdle(app, reel);

      expect(revealed).not.toBeNull();
      results.push(revealed!);

      reel.destroy();
    }

    // Two different winners must produce different reveals
    expect(results[0].id).not.toBe(results[1].id);
  });

  it("final position centers the target item in the viewport", async () => {
    const reel = new SpotlightReel(app, 700, PLACEHOLDER_ITEMS);
    reel.x = 50;
    reel.y = 100;
    app.stage.addChild(reel);

    const winner = PLACEHOLDER_ITEMS[6]; // Thunder Staff
    let revealed: ReelItem | null = null;
    reel.onReveal = (item) => {
      revealed = item;
    };

    reel.spin(42, winner);
    await waitForIdle(app, reel);
    snapshot(app, "final centered");

    expect(revealed).not.toBeNull();

    // The winning tile should be visually centered in the viewport
    const winnerTile = reel.getWinnerTile();
    expect(winnerTile).toBeDefined();

    // The tile's center-x in the strip should be near the viewport center
    const viewportCenter = reel.viewportWidth / 2;
    const tileCenter = winnerTile!.x + REEL_ITEM_WIDTH / 2 + reel.stripX;
    expect(Math.abs(tileCenter - viewportCenter)).toBeLessThan(5);
  });
});
