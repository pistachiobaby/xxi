import { useCallback, useEffect, useRef, useState } from "react";
import { Application } from "pixi.js";
import { SpotlightReel } from "./SpotlightReel";
import { REEL_ITEM_HEIGHT, Rarity } from "./constants";
import { Button } from "./ui/button";
import { Badge } from "./ui/badge";
import type { ReelItem } from "./constants";
import { api } from "../api";
import { deriveOutcome } from "../lib/verify";
import FairnessPanel, { type RollResult } from "./FairnessPanel";

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

function randomHex(bytes: number): string {
  const arr = new Uint8Array(bytes);
  crypto.getRandomValues(arr);
  return Array.from(arr)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export default function PixiCanvas() {
  const containerRef = useRef<HTMLDivElement>(null);
  const reelRef = useRef<SpotlightReel | null>(null);
  const pendingRollRef = useRef<RollResult | null>(null);
  const [rolling, setRolling] = useState(false);
  const [result, setResult] = useState<ReelItem | null>(null);
  const [bundleId, setBundleId] = useState<string | null>(null);
  const [items, setItems] = useState<ReelItem[] | null>(null);
  const [itemChances, setItemChances] = useState<
    { id: string; name: string; chance: number }[] | null
  >(null);

  // Provably fair state
  const [commitment, setCommitment] = useState<string | null>(null);
  const [clientSeed, setClientSeed] = useState(() => randomHex(16));
  const [lastRoll, setLastRoll] = useState<RollResult | null>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    let cancelled = false;
    let initialized = false;
    const app = new Application();

    (async () => {
      // Fetch bundle and items from the API
      const bundle = await api.bundle.findFirst({
        select: {
          id: true,
          pendingServerSeedHash: true,
          items: {
            edges: {
              node: {
                id: true,
                name: true,
                rarity: true,
                color: true,
                chance: true,
              },
            },
          },
        },
      });

      if (cancelled) return;
      if (!bundle) return;

      const reelItems: ReelItem[] = bundle.items.edges.map((edge: any) => ({
        id: edge.node.id,
        name: edge.node.name,
        rarity: edge.node.rarity as Rarity,
        color: edge.node.color,
      }));

      const chances = bundle.items.edges.map((edge: any) => ({
        id: edge.node.id as string,
        name: edge.node.name as string,
        chance: edge.node.chance as number,
      }));

      setBundleId(bundle.id);
      setItems(reelItems);
      setItemChances(chances);
      setCommitment((bundle as any).pendingServerSeedHash ?? null);

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
      const reel = new SpotlightReel(app, app.screen.width, reelItems);
      reel.x = 0;
      reel.y = (app.screen.height / 2 - REEL_ITEM_HEIGHT) / 2;
      app.stage.addChild(reel);

      reel.onReveal = (item) => {
        setRolling(false);
        setResult(item);
        // Only reveal roll data after animation completes so the panel can't spoil the outcome
        if (pendingRollRef.current) {
          setLastRoll(pendingRollRef.current);
          pendingRollRef.current = null;
        }
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

  const handleRoll = useCallback(async () => {
    if (rolling || !bundleId || !items || !itemChances) return;
    const reel = reelRef.current;
    if (!reel) return;
    setRolling(true);
    setResult(null);
    setLastRoll(null);
    try {
      const roll = await api.roll.create(
        { bundle: { _link: bundleId }, clientSeed },
        {
          select: {
            id: true,
            serverSeed: true,
            clientSeed: true,
            serverSeedHash: true,
            item: {
              id: true,
              name: true,
              rarity: true,
              color: true,
            },
          },
        }
      );
      const winnerItem: ReelItem = {
        id: roll.item!.id,
        name: roll.item!.name!,
        rarity: roll.item!.rarity as Rarity,
        color: roll.item!.color!,
      };

      // Derive visual seed client-side from revealed seeds
      const { visualSeed } = await deriveOutcome(
        roll.serverSeed!,
        roll.clientSeed!
      );
      reel.spin(visualSeed, winnerItem);

      // Stash roll data — revealed only after the animation completes (onReveal)
      pendingRollRef.current = {
        serverSeed: roll.serverSeed!,
        serverSeedHash: roll.serverSeedHash!,
        clientSeed: roll.clientSeed!,
        winnerId: roll.item!.id,
        winnerName: roll.item!.name!,
      };

      // Fetch updated commitment for next roll
      const updated = await api.bundle.findFirst({
        select: { pendingServerSeedHash: true },
      });
      if (updated) {
        setCommitment((updated as any).pendingServerSeedHash ?? null);
      }

      // Auto-generate new client seed for next roll
      setClientSeed(randomHex(16));
    } catch (e) {
      setRolling(false);
    }
  }, [rolling, bundleId, items, itemChances, clientSeed]);

  return (
    <div style={{ position: "relative", width: "100%", height: "100%" }}>
      <div ref={containerRef} style={{ width: "100%", height: "100%" }} />

      {/* Fairness panel trigger — top right */}
      <div className="absolute top-4 right-4 z-10">
        <FairnessPanel
          commitment={commitment}
          clientSeed={clientSeed}
          onClientSeedChange={setClientSeed}
          lastRoll={lastRoll}
          items={itemChances}
          disabled={rolling}
        />
      </div>

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
          disabled={rolling || !bundleId || !clientSeed.trim()}
          className="min-w-[140px]"
        >
          {rolling ? "Rolling..." : "Roll"}
        </Button>
      </div>
    </div>
  );
}
