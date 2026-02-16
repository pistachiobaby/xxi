import { useEffect, useRef } from "react";
import { Application } from "pixi.js";
import { Card } from "./Card";
import { SnapArea } from "./SnapArea";

const SUITS = ["♠", "♥", "♦", "♣"] as const;
const RANKS = ["A", "2", "3", "4", "5", "6", "7", "8", "9", "10", "J", "Q", "K"] as const;

const SUIT_COLORS: Record<string, number> = {
  "♠": 0xf0f0f0,
  "♣": 0xf0f0f0,
  "♥": 0xfff0f0,
  "♦": 0xfff0f0,
};

export default function PixiCanvas() {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    let cancelled = false;
    let initialized = false;
    const app = new Application();

    (async () => {
      await app.init({
        background: "#1a472a",
        resizeTo: container,
        antialias: true,
      });

      if (cancelled) {
        app.destroy(true, { children: true });
        return;
      }

      initialized = true;
      container.appendChild(app.canvas);

      // Deal out a shuffled hand of cards
      const deck = SUITS.flatMap((suit) =>
        RANKS.map((rank) => ({ label: `${rank}${suit}`, color: SUIT_COLORS[suit] }))
      );

      // Shuffle
      for (let i = deck.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [deck[i], deck[j]] = [deck[j], deck[i]];
      }

      // Create snap areas
      const hand = new SnapArea("Hand");
      hand.x = 40;
      hand.y = (app.screen.height - 300) / 2;
      app.stage.addChild(hand);

      const table = new SnapArea("Table");
      table.x = app.screen.width - 240;
      table.y = (app.screen.height - 300) / 2;
      app.stage.addChild(table);

      // Deal 10 cards into the hand area
      const cardCount = 10;
      for (let i = 0; i < cardCount; i++) {
        const { label, color } = deck[i];
        const card = new Card(label, color);
        app.stage.addChild(card);
        hand.addCard(card);
      }
    })();

    return () => {
      cancelled = true;
      if (initialized) {
        app.destroy(true, { children: true });
      }
    };
  }, []);

  return <div ref={containerRef} style={{ width: "100%", height: "100%" }} />;
}
