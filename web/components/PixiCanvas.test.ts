import { describe, it, expect, afterEach, beforeEach } from "vitest";
import { Application, Graphics, Container, Text, TextStyle } from "pixi.js";
import { mount, waitFrames, readPixel, snapshot } from "../test-helpers";

describe("PixiJS Rendering", () => {
  let app: Application;

  beforeEach(async () => {
    app = new Application();
    await app.init({
      width: 320,
      height: 240,
      background: "#111111",
      antialias: true,
    });
    mount(app);
  });

  afterEach(() => {
    app.destroy(true, { children: true });
  });

  it("renders a red square", async () => {
    const square = new Graphics();
    square.rect(60, 70, 80, 80);
    square.fill(0xff0000);
    app.stage.addChild(square);

    await waitFrames(app, 2);
    snapshot(app, "red square");

    const [r, g, b] = readPixel(app, 100, 110);
    expect(r).toBeGreaterThan(200);
    expect(g).toBeLessThan(30);
    expect(b).toBeLessThan(30);
  });

  it("renders overlapping shapes with correct z-order", async () => {
    // Blue square behind
    const blue = new Graphics();
    blue.rect(80, 60, 100, 100);
    blue.fill(0x0000ff);

    // Green square in front (added second = on top)
    const green = new Graphics();
    green.rect(120, 80, 100, 100);
    green.fill(0x00ff00);

    app.stage.addChild(blue, green);
    await waitFrames(app, 2);
    snapshot(app, "blue behind green");

    // Sample the overlap region — should be green (on top)
    const [r, g, b] = readPixel(app, 150, 110);
    expect(g).toBeGreaterThan(200);
    expect(r).toBeLessThan(30);
    expect(b).toBeLessThan(30);

    // Sample the blue-only region
    const [r2, g2, b2] = readPixel(app, 90, 70);
    expect(b2).toBeGreaterThan(200);
    expect(r2).toBeLessThan(30);
    expect(g2).toBeLessThan(30);
  });

  it("renders nested containers with transforms", async () => {
    const parent = new Container();
    parent.x = 160;
    parent.y = 120;

    // Child offset from parent center
    const dot = new Graphics();
    dot.circle(0, 0, 20);
    dot.fill(0xffff00);
    parent.addChild(dot);

    app.stage.addChild(parent);
    await waitFrames(app, 2);
    snapshot(app, "yellow dot at center");

    // Center of the canvas should be yellow
    const [r, g, b] = readPixel(app, 160, 120);
    expect(r).toBeGreaterThan(200);
    expect(g).toBeGreaterThan(200);
    expect(b).toBeLessThan(30);

    // Far corner should be background
    const [r2, g2, b2] = readPixel(app, 10, 10);
    expect(r2).toBeLessThan(30);
    expect(g2).toBeLessThan(30);
    expect(b2).toBeLessThan(30);
  });

  it("animates position over multiple frames", async () => {
    const ball = new Graphics();
    ball.circle(0, 0, 15);
    ball.fill(0xff6600);
    ball.x = 20;
    ball.y = 120;
    app.stage.addChild(ball);

    app.ticker.add((ticker) => {
      ball.x += 3 * ticker.deltaTime;
    });

    await waitFrames(app, 2);
    const firstX = ball.x;

    await waitFrames(app, 10);
    snapshot(app, "ball after animation");
    expect(ball.x).toBeGreaterThan(firstX);

    // The ball should have moved right — sample its new position
    const [r] = readPixel(app, Math.round(ball.x), 120);
    expect(r).toBeGreaterThan(150);
  });

  it("renders text", async () => {
    const style = new TextStyle({
      fontSize: 24,
      fill: 0xffffff,
      fontFamily: "sans-serif",
    });
    const text = new Text({ text: "Hello PixiJS", style });
    text.x = 60;
    text.y = 100;
    app.stage.addChild(text);

    await waitFrames(app, 3);
    snapshot(app, "Hello PixiJS text");

    // Sample somewhere inside the text region — should have white-ish pixels
    const [r, g, b] = readPixel(app, 80, 115);
    expect(r).toBeGreaterThan(100);
    expect(g).toBeGreaterThan(100);
    expect(b).toBeGreaterThan(100);
  });

  it("applies alpha transparency", async () => {
    // Solid white background rect
    const bg = new Graphics();
    bg.rect(0, 0, 320, 240);
    bg.fill(0xffffff);

    // Semi-transparent red overlay
    const overlay = new Graphics();
    overlay.rect(60, 60, 100, 100);
    overlay.fill(0xff0000);
    overlay.alpha = 0.5;

    app.stage.addChild(bg, overlay);
    await waitFrames(app, 2);
    snapshot(app, "50% red over white");

    // In the overlay region: red blended with white ≈ (255, ~128, ~128)
    const [r, g, b] = readPixel(app, 110, 110);
    expect(r).toBeGreaterThan(200);
    expect(g).toBeGreaterThan(80);
    expect(g).toBeLessThan(200);
    expect(b).toBeGreaterThan(80);
    expect(b).toBeLessThan(200);
  });
});
