import { Loader2 } from "lucide-react";
import StoreInventorySection from "@/components/StoreInventorySection";
import { useInventoryCloud } from "@/hooks/useAppData";

export default function StoreInventory() {
  const { data: inventory, loading } = useInventoryCloud();

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Store Inventory</h1>
        <p className="text-muted-foreground text-sm">Store dashboard & complete product overview</p>
      </div>
      <StoreInventorySection inventory={inventory} />
    </div>
  );
}
