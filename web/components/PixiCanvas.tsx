import { useCallback, useEffect, useRef, useState } from "react";
import { Application } from "pixi.js";
import { SpotlightReel } from "./SpotlightReel";
import { REEL_ITEM_HEIGHT } from "./constants";
import { Button } from "./ui/button";
import { Badge } from "./ui/badge";
import type { ReelItem } from "./constants";

// HMR counter — increments each time this module is re-evaluated,
// which forces the useEffect to tear down and re-create the PixiJS app.
let _hmr = 0;
if (import.meta.hot) {
  _hmr = (import.meta.hot.data._hmr ?? 0) + 1;
  import.meta.hot.data._hmr = _hmr;
}

const RARITY_COLORS: Record<string, string> = {
  Common: "bg-gray-500",
  Rare: "bg-blue-500",
  Epic: "bg-purple-500",
  Legendary: "bg-amber-500",
};

export default function PixiCanvas() {
  const containerRef = useRef<HTMLDivElement>(null);
  const reelRef = useRef<SpotlightReel | null>(null);
  const [rolling, setRolling] = useState(false);
  const [result, setResult] = useState<ReelItem | null>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    let cancelled = false;
    let initialized = false;
    const app = new Application();

    (async () => {
      await app.init({
        background: "#0a0a14",
        resizeTo: container,
        antialias: true,
      });

      if (cancelled) {
        app.destroy(true, { children: true });
        return;
      }

      initialized = true;
      container.appendChild(app.canvas);

      // Reel spans the full screen width, centered vertically in the top half
      const reel = new SpotlightReel(app, app.screen.width);
      reel.x = 0;
      reel.y = (app.screen.height / 2 - REEL_ITEM_HEIGHT) / 2;
      app.stage.addChild(reel);

      reel.onReveal = (item) => {
        setRolling(false);
        setResult(item);
      };

      reelRef.current = reel;
    })();

    return () => {
      cancelled = true;
      reelRef.current = null;
      if (initialized) {
        app.destroy(true, { children: true });
      }
    };
  }, [_hmr]);

  const handleRoll = useCallback(() => {
    if (rolling) return;
    const reel = reelRef.current;
    if (!reel) return;
    setRolling(true);
    setResult(null);
    reel.spin();
  }, [rolling]);

  return (
    <div style={{ position: "relative", width: "100%", height: "100%" }}>
      <div ref={containerRef} style={{ width: "100%", height: "100%" }} />

      {/* Roll button + result overlay */}
      <div
        style={{
          position: "absolute",
          bottom: 40,
          left: "50%",
          transform: "translateX(-50%)",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: 12,
        }}
      >
        {result && (
          <div className="flex items-center gap-2">
            <Badge className={RARITY_COLORS[result.rarity]}>
              {result.rarity}
            </Badge>
            <span className="text-white font-bold text-lg">{result.name}</span>
          </div>
        )}
        <Button
          size="lg"
          onClick={handleRoll}
          disabled={rolling}
          className="min-w-[140px]"
        >
          {rolling ? "Rolling..." : "Roll"}
        </Button>
      </div>
    </div>
  );
}
