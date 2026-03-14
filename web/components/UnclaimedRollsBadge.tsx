import { useState } from "react";
import { Link } from "react-router";
import { Badge } from "./ui/badge";
import { Popover, PopoverTrigger, PopoverContent } from "./ui/popover";
import type { UnclaimedRoll } from "../lib/unclaimed-rolls";

const RARITY_COLORS: Record<string, string> = {
  Common: "bg-gray-500",
  Rare: "bg-blue-500",
  Epic: "bg-purple-500",
  Legendary: "bg-amber-500",
};

export default function UnclaimedRollsBadge({ rolls }: { rolls: UnclaimedRoll[] }) {
  const [open, setOpen] = useState(false);

  if (rolls.length === 0) return null;

  return (
    <div className="flex flex-col items-center gap-1.5">
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <button
            data-testid="unclaimed-rolls-trigger"
            className="text-gray-400 hover:text-gray-200 text-sm font-medium transition-colors cursor-pointer"
            onMouseEnter={() => setOpen(true)}
            onMouseLeave={() => setOpen(false)}
          >
            🔒 {rolls.length} unclaimed roll{rolls.length !== 1 ? "s" : ""}
          </button>
        </PopoverTrigger>
        <PopoverContent
          side="top"
          align="center"
          className="w-64 p-3 bg-gray-950 border-gray-800"
          onMouseEnter={() => setOpen(true)}
          onMouseLeave={() => setOpen(false)}
        >
          <p className="text-xs text-gray-400 font-medium mb-2">Unclaimed Rolls</p>
          <div className="flex flex-col gap-1.5 max-h-48 overflow-y-auto">
            {rolls.map((roll) => (
              <div key={roll.id} className="flex items-center gap-2">
                <Badge className={`${RARITY_COLORS[roll.rarity] ?? "bg-gray-500"} text-white text-[10px] px-1.5 py-0`}>
                  {roll.rarity}
                </Badge>
                <span className="text-gray-300 text-xs truncate">{roll.name}</span>
              </div>
            ))}
          </div>
        </PopoverContent>
      </Popover>
      <Link
        to="/sign-up"
        data-testid="claim-cta"
        className="text-xs text-blue-400 hover:text-blue-300 hover:underline transition-colors"
      >
        Sign up to claim your collection →
      </Link>
    </div>
  );
}
