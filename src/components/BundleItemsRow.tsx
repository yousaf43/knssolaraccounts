import { Package } from "lucide-react";
import { Input } from "@/components/ui/input";
import { useSettings } from "@/contexts/SettingsContext";
import type { InventoryItem } from "@/data/mockData";

type Props = {
  item: { inventoryItemId?: string; bundleItemPrices?: { itemId: string; price: number; qty?: number }[] };
  inventory: InventoryItem[];
  colSpan: number;
  lineQty: number;
  editable?: boolean;
  hidePrices?: boolean;
  onBundlePriceChange?: (itemId: string, price: number) => void;
  onBundleQtyChange?: (itemId: string, qty: number) => void;
};

export function BundleItemsRow({ item, inventory, colSpan, lineQty, editable, hidePrices, onBundlePriceChange, onBundleQtyChange }: Props) {
  const { formatCurrency } = useSettings();

  if (!item.inventoryItemId) return null;

  const invItem = inventory.find((i) => i.id === item.inventoryItemId);
  if (!invItem || invItem.productType !== "bundle" || !invItem.bundleItems?.length) return null;

  const getPrice = (bi: { itemId: string; qty: number; price?: number }) => {
    const override = item.bundleItemPrices?.find(p => p.itemId === bi.itemId);
    if (override) return override.price;
    return bi.price ?? inventory.find(i => i.id === bi.itemId)?.salePrice ?? 0;
  };

  const getQty = (bi: { itemId: string; qty: number }) => {
    const override = item.bundleItemPrices?.find(p => p.itemId === bi.itemId);
    if (override?.qty !== undefined) return override.qty;
    return bi.qty;
  };

  const bundleTotal = invItem.bundleItems.reduce((sum, bi) => sum + getPrice(bi) * getQty(bi) * lineQty, 0);

  return (
    <tr className="bg-muted/20">
      <td colSpan={colSpan} className="px-6 py-1.5">
        <div className="flex items-start gap-2">
          <Package className="w-3 h-3 text-primary mt-0.5 shrink-0" />
          <div className="space-y-0.5 w-full">
            <span className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide">Bundle Contents</span>
            {invItem.bundleItems.map((bi, idx) => {
              const subItem = inventory.find((i) => i.id === bi.itemId);
              if (!subItem) return null;
              const price = getPrice(bi);
              const qty = getQty(bi);
              return (
                <div key={idx} className="flex items-center gap-2 text-xs text-muted-foreground">
                  <span className="text-primary">↳</span>
                  <span className="flex-1">{subItem.name}</span>
                  <span className="text-[10px]">({subItem.sku})</span>
                  {editable ? (
                    <Input
                      type="number"
                      min={0}
                      step={1}
                      value={qty}
                      onChange={(e) => onBundleQtyChange?.(bi.itemId, Number(e.target.value))}
                      className="h-6 w-16 text-xs text-right"
                    />
                  ) : (
                    <span className="font-medium text-foreground">× {qty * lineQty}</span>
                  )}
                  {editable && <span className="text-foreground text-[10px]">× {lineQty}</span>}
                  {editable ? (
                    <Input
                      type="number"
                      min={0}
                      step={0.01}
                      value={price}
                      onChange={(e) => onBundlePriceChange?.(bi.itemId, Number(e.target.value))}
                      className="h-6 w-24 text-xs text-right"
                    />
                  ) : (
                    <span className="text-foreground font-medium w-24 text-right">{formatCurrency(price)}</span>
                  )}
                  <span className="text-foreground font-medium w-20 text-right">{formatCurrency(price * qty * lineQty)}</span>
                </div>
              );
            })}
            <div className="flex justify-end text-xs font-bold text-foreground pt-1 border-t border-border/50">
              <span>Bundle Total: {formatCurrency(bundleTotal)}</span>
            </div>
          </div>
        </div>
      </td>
    </tr>
  );
}
