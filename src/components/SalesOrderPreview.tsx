import React, { useRef } from "react";
import { Button } from "@/components/ui/button";
import { Printer, X } from "lucide-react";
import type { SalesOrder, Customer, InventoryItem } from "@/data/mockData";
import { useSettings } from "@/contexts/SettingsContext";
import ksLogo from "@/assets/ks-logo.png";

type Props = {
  order: SalesOrder;
  onClose: () => void;
  showPrices?: boolean; // false = delivery challan / packing slip
  customers?: Customer[];
  inventory?: InventoryItem[];
};

export function SalesOrderPreview({ order, onClose, showPrices = false, customers = [], inventory = [] }: Props) {
  const { formatCurrency, settings } = useSettings();
  const printRef = useRef<HTMLDivElement>(null);

  const norm = (v?: string | null) => (v ?? "").trim().toLowerCase();
  const customer = customers.find(
    (c) => norm(c.name) === norm(order.customer) || norm(`${c.name} [${c.company}]`) === norm(order.customer)
  );

  const subtotal = order.items.reduce((s, i) => s + i.amount, 0);
  const taxRate = order.tax ?? 0;
  const taxAmount = subtotal * (taxRate / 100);
  const total = subtotal + taxAmount;

  const handlePrint = () => {
    const content = printRef.current;
    if (!content) return;
    const win = window.open("", "_blank");
    if (!win) return;
    win.document.write(`
      <html><head><title>Sales Order ${order.number}</title>
      <style>
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body { font-family: Arial, sans-serif; padding: 30px; color: #111; font-size: 13px; }
        .header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 24px; padding-bottom: 16px; border-bottom: 2px solid #1e3a8a; }
        .company-right { text-align: right; }
        .company-right h2 { font-size: 18px; font-weight: bold; color: #1e3a8a; }
        .company-right p { font-size: 11px; color: #444; margin-top: 2px; }
        .doc-title { text-align: center; font-size: 22px; font-weight: bold; margin: 16px 0; text-decoration: underline; }
        .customer-info { display: flex; justify-content: space-between; margin-bottom: 16px; }
        .customer-info .left p { font-weight: bold; font-size: 13px; }
        .customer-info .left span { font-size: 11px; color: #555; }
        .customer-info .right { text-align: right; font-size: 12px; }
        .customer-info .right div { display: flex; justify-content: flex-end; gap: 16px; margin-bottom: 2px; }
        table { width: 100%; border-collapse: collapse; margin: 12px 0; }
        th { background: #1e3a8a; color: #fff; padding: 7px 10px; text-align: left; font-size: 12px; }
        th.text-right { text-align: right; }
        th.text-center { text-align: center; }
        td { padding: 6px 10px; border-bottom: 1px solid #e5e7eb; font-size: 12px; }
        td.text-right { text-align: right; }
        td.text-center { text-align: center; }
        .totals-section { display: flex; justify-content: space-between; margin-top: 12px; }
        .notes-box { font-size: 11px; color: #555; flex: 1; padding-right: 20px; }
        .totals-box { width: 260px; border: 1px solid #ddd; padding: 10px; }
        .totals-box .total-row { display: flex; justify-content: space-between; padding: 4px 0; font-size: 13px; }
        .totals-box .grand-total { display: flex; justify-content: space-between; padding: 6px 0; font-size: 15px; font-weight: bold; border-top: 2px solid #1e3a8a; margin-top: 4px; color: #1e3a8a; }
        .footer-bar { background: #1e3a8a; height: 12px; margin-top: 24px; border-radius: 2px; }
        .bundle-row { background: #f9fafb; }
        .bundle-row td { padding: 3px 10px; font-size: 11px; color: #666; border-bottom: 1px solid #f0f0f0; }
        .logo { max-height: 60px; max-width: 120px; object-fit: contain; }
        img { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; color-adjust: exact !important; }
        th { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
        .footer-bar { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
      </style></head><body>
      ${content.innerHTML}
      </body></html>
    `);
    win.document.close();
    win.print();
  };

  const docTitle = showPrices ? "Sales Order" : "Delivery Challan";

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold">{docTitle} Preview</h2>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={handlePrint}>
            <Printer className="w-4 h-4 mr-1" /> Print / Save PDF
          </Button>
          <Button variant="ghost" size="icon" onClick={onClose}>
            <X className="w-5 h-5" />
          </Button>
        </div>
      </div>

      <div ref={printRef} className="bg-white text-gray-900 border rounded-lg p-8 max-w-3xl mx-auto shadow-sm">
        {/* Header */}
        <div className="header flex justify-between items-start mb-6 pb-4 border-b-2 border-blue-900">
          <div>
            <img src={ksLogo} alt="Logo" className="logo h-14 max-w-[120px] object-contain" />
          </div>
          <div className="company-right text-right">
            <h2 className="text-xl font-bold text-blue-900">{settings.companyName || "K & S Solar Energy Pvt. Ltd"}</h2>
            <p className="text-xs text-gray-500 mt-1">{settings.companyAddress}</p>
            {settings.companyPhone && <p className="text-xs text-gray-500"><strong>Phone :</strong> {settings.companyPhone}</p>}
            {settings.companyEmail && <p className="text-xs text-gray-500"><strong>Email :</strong> {settings.companyEmail}</p>}
          </div>
        </div>

        {/* Title */}
        <div className="text-center text-2xl font-bold underline my-4 text-gray-900">{docTitle}</div>

        {/* Customer + Meta */}
        <div className="flex justify-between mb-4">
          <div>
            <p className="font-bold text-sm">{order.customer}</p>
            {customer?.phone && <p className="text-xs text-gray-500">Phone: {customer.phone}</p>}
            {customer?.address && <p className="text-xs text-gray-500">{customer.address}</p>}
            {order.projectName && <p className="text-xs text-gray-500">Project: {order.projectName}</p>}
          </div>
          <div className="text-right text-sm space-y-0.5">
            <div className="flex justify-end gap-4"><span className="text-gray-500">Date</span><span className="font-medium">{order.date}</span></div>
            <div className="flex justify-end gap-4"><span className="text-gray-500">Delivery Date</span><span className="font-medium">{order.deliveryDate}</span></div>
            <div className="flex justify-end gap-4"><span className="text-gray-500">Order #</span><span className="font-medium">{order.number}</span></div>
          </div>
        </div>

        {/* Items Table */}
        <table className="w-full text-sm mb-4 border-collapse">
          <thead>
            <tr>
              <th className="bg-blue-900 text-white px-3 py-2 text-left w-8">Sr.</th>
              <th className="bg-blue-900 text-white px-3 py-2 text-left">Details</th>
              <th className="bg-blue-900 text-white px-3 py-2 text-center w-16">Unit</th>
              <th className="bg-blue-900 text-white px-3 py-2 text-right w-20">Quantity</th>
              {showPrices && <>
                <th className="bg-blue-900 text-white px-3 py-2 text-right w-24">UM Rate</th>
                <th className="bg-blue-900 text-white px-3 py-2 text-right w-28">Amount</th>
              </>}
            </tr>
          </thead>
          <tbody>
            {order.items.map((item, i) => {
              // Find inventory item to check if it's a bundle
              const invItem = item.inventoryItemId ? inventory.find(inv => inv.id === item.inventoryItemId) : null;
              const isBundleItem = invItem?.productType === "bundle" && invItem.bundleItems && invItem.bundleItems.length > 0;
              return (
                <React.Fragment key={i}>
                  <tr className="border-b border-gray-200">
                    <td className="px-3 py-2 text-center text-gray-600">{i + 1}</td>
                    <td className="px-3 py-2">{item.description}</td>
                    <td className="px-3 py-2 text-center text-gray-600">UNIT</td>
                    <td className="px-3 py-2 text-right">{item.qty}</td>
                    {showPrices && <>
                      <td className="px-3 py-2 text-right">{item.rate.toLocaleString()}</td>
                      <td className="px-3 py-2 text-right font-medium">{formatCurrency(item.amount)}</td>
                    </>}
                  </tr>
                  {/* Show bundle components in delivery order */}
                  {isBundleItem && invItem.bundleItems!.map((bi, bIdx) => {
                    const compItem = inventory.find(inv => inv.id === bi.itemId);
                    if (!compItem) return null;
                    return (
                      <tr key={`${i}-bundle-${bIdx}`} className="border-b border-gray-100 bg-gray-50">
                        <td className="px-3 py-1 text-center text-gray-400 text-xs"></td>
                        <td className="px-3 py-1 text-xs text-gray-600 pl-8">↳ {compItem.name} {compItem.model ? `(${compItem.model})` : ""}</td>
                        <td className="px-3 py-1 text-center text-gray-400 text-xs">{compItem.unit || "pcs"}</td>
                        <td className="px-3 py-1 text-right text-xs text-gray-600">{bi.qty * item.qty}</td>
                        {showPrices && <>
                          <td className="px-3 py-1"></td>
                          <td className="px-3 py-1"></td>
                        </>}
                      </tr>
                    );
                  })}
                </React.Fragment>
              );
            })}
          </tbody>
        </table>

        {/* Totals (only if showing prices) */}
        {showPrices && (
          <div className="totals-section flex justify-between mt-4 gap-6">
            <div className="flex-1">
              {order.notes && (
                <div>
                  <p className="text-xs font-semibold text-gray-500 mb-1">Notes</p>
                  <p className="text-xs text-gray-600">{order.notes}</p>
                </div>
              )}
            </div>
            <div className="totals-box w-64 border border-gray-300 rounded p-3 text-sm">
              {taxRate > 0 && (
                <>
                  <div className="total-row flex justify-between py-1">
                    <span className="text-gray-600">Subtotal</span>
                    <span className="font-medium">{formatCurrency(subtotal)}</span>
                  </div>
                  <div className="total-row flex justify-between py-1">
                    <span className="text-gray-600">{settings.taxLabel || "Tax"} ({taxRate}%)</span>
                    <span className="font-medium">{formatCurrency(taxAmount)}</span>
                  </div>
                </>
              )}
              <div className="grand-total flex justify-between py-2 border-t-2 border-blue-900 mt-1 text-base font-bold text-blue-900">
                <span>Total:</span>
                <span>{formatCurrency(total)}</span>
              </div>
            </div>
          </div>
        )}

        {/* Notes (when no prices) */}
        {!showPrices && order.notes && (
          <div className="mt-4 text-xs text-gray-600">
            <strong>Notes:</strong> {order.notes}
          </div>
        )}

        {/* Footer bar */}

        {/* Footer bar */}
        <div className="footer-bar mt-6 h-3 rounded bg-blue-900"></div>
      </div>
    </div>
  );
}
