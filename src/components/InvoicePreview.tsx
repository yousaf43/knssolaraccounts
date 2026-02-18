import { useRef } from "react";
import { Button } from "@/components/ui/button";
import { Printer, X } from "lucide-react";
import type { Invoice, Receipt } from "@/data/mockData";
import { useSettings } from "@/contexts/SettingsContext";
import ksLogo from "@/assets/ks-logo.png";

type Props = {
  invoice: Invoice;
  onClose: () => void;
  receipts?: Receipt[];
  customerOutstanding?: number; // total outstanding balance of the customer
};

// Convert number to words (for PKR amounts)
function numberToWords(num: number): string {
  if (num === 0) return "Zero";
  const ones = ["", "One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine",
    "Ten", "Eleven", "Twelve", "Thirteen", "Fourteen", "Fifteen", "Sixteen", "Seventeen", "Eighteen", "Nineteen"];
  const tens = ["", "", "Twenty", "Thirty", "Forty", "Fifty", "Sixty", "Seventy", "Eighty", "Ninety"];

  function convertHundreds(n: number): string {
    if (n === 0) return "";
    if (n < 20) return ones[n] + " ";
    if (n < 100) return tens[Math.floor(n / 10)] + (n % 10 !== 0 ? " " + ones[n % 10] : "") + " ";
    return ones[Math.floor(n / 100)] + " Hundred " + convertHundreds(n % 100);
  }

  function convert(n: number): string {
    if (n === 0) return "";
    if (n < 100) return convertHundreds(n);
    if (n < 1000) return convertHundreds(n);
    if (n < 100000) return ones[Math.floor(n / 1000)] || convertHundreds(Math.floor(n / 1000)) + "Thousand " + convertHundreds(n % 1000);
    if (n < 10000000) {
      const lacs = Math.floor(n / 100000);
      const rem = n % 100000;
      return convertHundreds(lacs) + "Lac " + (rem > 0 ? convert(rem) : "");
    }
    const crores = Math.floor(n / 10000000);
    const rem = n % 10000000;
    return convertHundreds(crores) + "Crore " + (rem > 0 ? convert(rem) : "");
  }

  const intPart = Math.floor(num);
  const decPart = Math.round((num - intPart) * 100);
  let result = convert(intPart).trim();
  if (decPart > 0) result += " and " + convert(decPart).trim() + " Paisa";
  return result + " Only";
}

export function InvoicePreview({ invoice, onClose, receipts = [], customerOutstanding = 0 }: Props) {
  const { formatCurrency, settings } = useSettings();
  const printRef = useRef<HTMLDivElement>(null);

  const subtotal = invoice.items.reduce((s, i) => s + i.amount, 0);
  const taxRate = invoice.tax ?? 0;
  const taxAmount = subtotal * (taxRate / 100);
  const total = subtotal + taxAmount;

  // Calculate paid and balance
  const invReceipts = receipts.filter((r) => r.invoiceNumber === invoice.number);
  const totalPaid = invReceipts.reduce((s, r) => s + r.amount, 0);
  const invoiceBalance = Math.max(0, total - totalPaid);

  // Account balance = customer's total outstanding (passed in, or fallback to invoice balance)
  const accountBalance = customerOutstanding || invoiceBalance;

  const amountInWords = numberToWords(Math.round(accountBalance));

  const handlePrint = () => {
    const content = printRef.current;
    if (!content) return;
    const win = window.open("", "_blank");
    if (!win) return;
    win.document.write(`
      <html><head><title>Invoice ${invoice.number}</title>
      <style>
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body { font-family: Arial, sans-serif; padding: 30px; color: #111; font-size: 13px; }
        .header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 24px; padding-bottom: 16px; border-bottom: 2px solid #1e3a8a; }
        .company-right { text-align: right; }
        .company-right h2 { font-size: 18px; font-weight: bold; color: #1e3a8a; }
        .company-right p { font-size: 11px; color: #444; margin-top: 2px; }
        .invoice-title { text-align: center; font-size: 22px; font-weight: bold; margin: 16px 0; text-decoration: underline; }
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
        .totals-box .balance-row { display: flex; justify-content: space-between; padding: 3px 0; font-size: 12px; color: #444; border-top: 1px solid #ddd; margin-top: 4px; }
        .words-line { font-size: 11px; margin-top: 10px; font-style: italic; }
        .words-line strong { font-style: normal; }
        .signature-section { display: flex; justify-content: space-between; margin-top: 32px; border-top: 1px solid #ddd; padding-top: 16px; }
        .sig-box { text-align: center; }
        .sig-box .sig-name { font-weight: bold; font-size: 13px; border-bottom: 2px solid #333; padding-bottom: 4px; margin-bottom: 4px; min-width: 120px; }
        .sig-box .sig-label { font-size: 10px; color: #666; }
        .footer-bar { background: #1e3a8a; height: 12px; margin-top: 24px; border-radius: 2px; }
        .logo { max-height: 60px; max-width: 120px; object-fit: contain; }
      </style></head><body>
      ${content.innerHTML}
      </body></html>
    `);
    win.document.close();
    win.print();
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold">Invoice Preview</h2>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={handlePrint}>
            <Printer className="w-4 h-4 mr-1" /> Print / Save PDF
          </Button>
          <Button variant="ghost" size="icon" onClick={onClose}>
            <X className="w-5 h-5" />
          </Button>
        </div>
      </div>

      {/* Invoice Preview Card */}
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

        {/* Invoice Title */}
        <div className="text-center text-2xl font-bold underline my-4 text-gray-900">Invoice</div>

        {/* Customer + Meta Info */}
        <div className="flex justify-between mb-4">
          <div>
            <p className="font-bold text-sm">{invoice.customer}</p>
            {invoice.documentNumber && <p className="text-xs text-gray-500">Doc No. {invoice.documentNumber}</p>}
            {invoice.projectName && <p className="text-xs text-gray-500">Project: {invoice.projectName}</p>}
          </div>
          <div className="text-right text-sm space-y-0.5">
            <div className="flex justify-end gap-4"><span className="text-gray-500">Date</span><span className="font-medium">{invoice.date}</span></div>
            <div className="flex justify-end gap-4"><span className="text-gray-500">Due Date</span><span className="font-medium">{invoice.dueDate}</span></div>
            {invoice.documentNumber && <div className="flex justify-end gap-4"><span className="text-gray-500">Doc No.</span><span className="font-medium">{invoice.documentNumber}</span></div>}
            <div className="flex justify-end gap-4"><span className="text-gray-500">Invoice #</span><span className="font-medium">{invoice.number}</span></div>
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
              <th className="bg-blue-900 text-white px-3 py-2 text-right w-24">UM Rate</th>
              <th className="bg-blue-900 text-white px-3 py-2 text-right w-28">Amount</th>
            </tr>
          </thead>
          <tbody>
            {invoice.items.map((item, i) => (
              <tr key={i} className="border-b border-gray-200">
                <td className="px-3 py-2 text-center text-gray-600">{i + 1}</td>
                <td className="px-3 py-2">{item.description}</td>
                <td className="px-3 py-2 text-center text-gray-600">UNIT</td>
                <td className="px-3 py-2 text-right">{item.qty}</td>
                <td className="px-3 py-2 text-right">{item.rate.toLocaleString()}</td>
                <td className="px-3 py-2 text-right font-medium">{formatCurrency(item.amount)}</td>
              </tr>
            ))}
          </tbody>
        </table>

        {/* Totals + Notes */}
        <div className="totals-section flex justify-between mt-4 gap-6">
          {/* Notes */}
          <div className="flex-1">
            {invoice.notes && (
              <div>
                <p className="text-xs font-semibold text-gray-500 mb-1">Notes</p>
                <p className="text-xs text-gray-600">{invoice.notes}</p>
              </div>
            )}
          </div>

          {/* Totals Box */}
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
            <div className="balance-row flex justify-between py-1 border-t border-gray-200 mt-1 text-xs text-gray-600">
              <span>Paid Amount:</span>
              <span>{formatCurrency(totalPaid)}</span>
            </div>
            <div className="balance-row flex justify-between py-1 text-xs text-gray-600">
              <span>Invoice Balance:</span>
              <span>{formatCurrency(invoiceBalance)}</span>
            </div>
            <div className="balance-row flex justify-between py-1 text-xs font-semibold text-gray-800">
              <span>Account Balance:</span>
              <span>{formatCurrency(accountBalance)}</span>
            </div>
          </div>
        </div>

        {/* Amount in Words */}
        <div className="words-line mt-4 text-xs italic text-gray-700">
          <strong>A/C Balance in Words</strong> {amountInWords}.
        </div>

        {/* Signature Section */}
        <div className="signature-section flex justify-between mt-8 pt-4 border-t border-gray-200">
          <div className="sig-box text-center">
            <div className="sig-name font-bold text-sm border-b-2 border-gray-800 pb-1 mb-1 min-w-[120px]">{settings.companyName || ""}</div>
            <div className="sig-label text-xs text-gray-500">Recieved by:</div>
          </div>
          <div className="sig-box text-center">
            <div className="sig-name text-sm border-b-2 border-gray-800 pb-1 mb-1 min-w-[100px]">&nbsp;</div>
            <div className="sig-label text-xs text-gray-500">Date:</div>
          </div>
          <div className="sig-box text-center">
            <div className="sig-name text-sm border-b-2 border-gray-800 pb-1 mb-1 min-w-[100px]">&nbsp;</div>
            <div className="sig-label text-xs text-gray-500">Signature:</div>
          </div>
          <div className="sig-box text-center">
            <div className="sig-name text-sm border-b-2 border-gray-800 pb-1 mb-1 min-w-[100px]">&nbsp;</div>
            <div className="sig-label text-xs text-gray-500">Stamp:</div>
          </div>
        </div>

        {/* Footer bar */}
        <div className="footer-bar mt-6 h-3 rounded bg-blue-900"></div>
      </div>
    </div>
  );
}
