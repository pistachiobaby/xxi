import { useFindMany, useAction, useUser } from "@gadgetinc/react";
import { api } from "../api";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useState } from "react";

const rarityColors: Record<string, string> = {
  Common: "bg-gray-500",
  Rare: "bg-blue-500",
  Epic: "bg-purple-500",
  Legendary: "bg-yellow-500",
};

export default function InventoryPage() {
  const user = useUser();
  const [{ data: items, fetching, error }, refresh] = useFindMany(api.inventoryItem, {
    filter: { soldAt: { isSet: false } },
    select: {
      id: true,
      value: true,
      createdAt: true,
      item: { id: true, name: true, rarity: true, color: true },
      roll: { id: true },
    },
    sort: { createdAt: "Descending" },
  });

  const [{ fetching: selling }, sell] = useAction(api.inventoryItem.sell);
  const [{ fetching: sellingAll }, sellAll] = useAction(api.sellAllDuplicates);
  const [sellResult, setSellResult] = useState<{ sold: number; value: number } | null>(null);

  const handleSell = async (id: string) => {
    await sell({ id });
    refresh();
  };

  const handleSellAll = async () => {
    if (!user?.id) return;
    const result = await sellAll({ userId: user.id });
    if (result.data) {
      setSellResult(result.data);
      refresh();
      setTimeout(() => setSellResult(null), 3000);
    }
  };

  if (error) return <p className="text-destructive p-4">Error loading inventory</p>;

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">Inventory</h1>
          <p className="text-muted-foreground text-sm">
            Balance: <span className="font-mono font-bold text-foreground">{user?.balance ?? 0}</span>
          </p>
        </div>
        <Button
          variant="outline"
          onClick={handleSellAll}
          disabled={sellingAll || !items?.length}
        >
          {sellingAll ? "Selling..." : "Sell All Duplicates"}
        </Button>
      </div>

      {sellResult && sellResult.sold > 0 && (
        <div className="mb-4 p-3 rounded-md bg-green-500/10 text-green-400 text-sm">
          Sold {sellResult.sold} duplicate{sellResult.sold !== 1 ? "s" : ""} for {sellResult.value} credits
        </div>
      )}

      {fetching && !items ? (
        <p className="text-muted-foreground">Loading...</p>
      ) : !items?.length ? (
        <p className="text-muted-foreground">No items yet. Roll to start your collection!</p>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
          {items.map((inv) => (
            <Card key={inv.id} className="p-4 flex flex-col gap-2">
              <div className="flex items-center justify-between">
                <span className="font-medium text-sm truncate">{inv.item?.name}</span>
                <Badge className={`${rarityColors[inv.item?.rarity ?? "Common"]} text-white text-xs`}>
                  {inv.item?.rarity}
                </Badge>
              </div>
              <p className="text-xs text-muted-foreground font-mono">Value: {inv.value}</p>
              <Button
                size="sm"
                variant="secondary"
                onClick={() => handleSell(inv.id)}
                disabled={selling}
              >
                Sell
              </Button>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
