import { Application, Rectangle } from "pixi.js";

let snapshotContainer: HTMLDivElement | null = null;

function getSnapshotContainer(): HTMLDivElement {
  if (!snapshotContainer) {
    snapshotContainer = document.createElement("div");
    snapshotContainer.id = "pixi-test-snapshots";
    snapshotContainer.style.cssText =
      "display:flex; flex-wrap:wrap; gap:12px; padding:12px; background:#0a0a0a;";
    document.body.appendChild(snapshotContainer);
  }
  return snapshotContainer;
}

/**
 * Capture the current canvas state as a static <img> in the dashboard.
 * Call this at the end of a test (before afterEach destroys the app)
 * to leave a visible record of what was rendered.
 */
export function snapshot(app: Application, label: string) {
  app.render();
  const dataUrl = app.canvas.toDataURL("image/png");

  const wrapper = document.createElement("div");
  wrapper.style.cssText = "display:flex; flex-direction:column; align-items:center;";

  const caption = document.createElement("span");
  caption.textContent = label;
  caption.style.cssText =
    "color:#ccc; font:11px/1.4 monospace; margin-bottom:4px; max-width:320px; text-align:center;";

  const img = document.createElement("img");
  img.src = dataUrl;
  img.style.cssText = `width:${app.screen.width}px; height:${app.screen.height}px; border:1px solid #333; border-radius:4px;`;

  wrapper.appendChild(caption);
  wrapper.appendChild(img);
  getSnapshotContainer().appendChild(wrapper);
}

/** Mount the PixiJS canvas into the test page so the dashboard shows it. */
export function mount(app: Application) {
  app.canvas.style.display = "block";
  app.canvas.style.margin = "8px auto";
  document.body.appendChild(app.canvas);
}

/** Wait for N frames to render. */
export function waitFrames(app: Application, n: number): Promise<void> {
  return new Promise((resolve) => {
    let frames = 0;
    const cb = () => {
      frames++;
      if (frames >= n) {
        app.ticker.remove(cb);
        resolve();
      }
    };
    app.ticker.add(cb);
  });
}

/** Read a pixel from the rendered stage at (x, y) as [r, g, b, a]. */
export function readPixel(
  app: Application,
  x: number,
  y: number
): [number, number, number, number] {
  app.render();
  const canvas = app.renderer.extract.canvas({
    target: app.stage,
    frame: new Rectangle(0, 0, app.screen.width, app.screen.height),
  }) as HTMLCanvasElement;
  const ctx = canvas.getContext("2d")!;
  const { data } = ctx.getImageData(x, y, 1, 1);
  return [data[0], data[1], data[2], data[3]];
}

/**
 * Dispatch a pointer event on the app's canvas at the given stage coordinates.
 * Accounts for the canvas's position on the page.
 */
export function pointerEvent(
  app: Application,
  type: string,
  stageX: number,
  stageY: number,
  options: PointerEventInit = {}
) {
  const rect = app.canvas.getBoundingClientRect();
  const event = new PointerEvent(type, {
    clientX: rect.left + stageX,
    clientY: rect.top + stageY,
    pointerId: 1,
    pointerType: "mouse",
    bubbles: true,
    ...options,
  });
  app.canvas.dispatchEvent(event);
}

/**
 * Simulate a full drag gesture: pointerdown at (fromX, fromY),
 * move through intermediate steps, pointerup at (toX, toY).
 * Waits a frame between each step so PixiJS processes the events.
 */
export async function drag(
  app: Application,
  fromX: number,
  fromY: number,
  toX: number,
  toY: number,
  steps = 5
) {
  pointerEvent(app, "pointerdown", fromX, fromY);
  await waitFrames(app, 1);

  for (let i = 1; i <= steps; i++) {
    const t = i / steps;
    const x = fromX + (toX - fromX) * t;
    const y = fromY + (toY - fromY) * t;
    pointerEvent(app, "pointermove", x, y);
    await waitFrames(app, 1);
  }

  pointerEvent(app, "pointerup", toX, toY);
  await waitFrames(app, 1);
}
