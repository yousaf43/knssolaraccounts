import { Package } from "lucide-react";
import type { InventoryItem } from "@/data/mockData";

type Props = {
  item: { inventoryItemId?: string };
  inventory: InventoryItem[];
  colSpan: number;
  lineQty: number;
};

export function BundleItemsRow({ item, inventory, colSpan, lineQty }: Props) {
  if (!item.inventoryItemId) return null;

  const invItem = inventory.find((i) => i.id === item.inventoryItemId);
  if (!invItem || invItem.productType !== "bundle" || !invItem.bundleItems?.length) return null;

  return (
    <tr className="bg-muted/20">
      <td colSpan={colSpan} className="px-6 py-1.5">
        <div className="flex items-start gap-2">
          <Package className="w-3 h-3 text-primary mt-0.5 shrink-0" />
          <div className="space-y-0.5">
            <span className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide">Bundle Contents</span>
            {invItem.bundleItems.map((bi, idx) => {
              const subItem = inventory.find((i) => i.id === bi.itemId);
              if (!subItem) return null;
              return (
                <div key={idx} className="flex items-center gap-2 text-xs text-muted-foreground">
                  <span className="text-primary">↳</span>
                  <span>{subItem.name}</span>
                  <span className="text-[10px]">({subItem.sku})</span>
                  <span className="font-medium text-foreground">× {bi.qty * lineQty}</span>
                </div>
              );
            })}
          </div>
        </div>
      </td>
    </tr>
  );
}
