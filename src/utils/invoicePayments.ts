import type { Invoice, Receipt } from "@/data/mockData";

const normalizeValue = (value?: string | null) => (value ?? "").trim().toLowerCase();

export function receiptMatchesInvoice(
  receipt: Pick<Receipt, "invoiceNumber" | "customer">,
  invoice: Pick<Invoice, "number" | "customer">
) {
  return (
    normalizeValue(receipt.invoiceNumber) === normalizeValue(invoice.number) &&
    normalizeValue(receipt.customer) === normalizeValue(invoice.customer)
  );
}

export function getInvoiceReceipts(
  receipts: Receipt[],
  invoice: Pick<Invoice, "number" | "customer">,
  excludeReceiptId?: string
) {
  return receipts.filter(
    (receipt) => receipt.id !== excludeReceiptId && receiptMatchesInvoice(receipt, invoice)
  );
}

export function getInvoiceEmbeddedPaid(invoice: Pick<Invoice, "payments" | "amount">) {
  return (invoice.payments || []).reduce((sum, payment) => sum + (payment.amount || 0), 0);
}

export function getInvoicePaymentSummary(
  invoice: Pick<Invoice, "number" | "customer" | "amount" | "payments">,
  receipts: Receipt[],
  excludeReceiptId?: string
) {
  const invoiceReceipts = getInvoiceReceipts(receipts, invoice, excludeReceiptId);
  const receiptsPaid = invoiceReceipts.reduce((sum, receipt) => sum + (receipt.amount || 0), 0);
  const embeddedPaid = getInvoiceEmbeddedPaid(invoice);
  const totalPaid = receiptsPaid + embeddedPaid;
  const rawRemaining = (invoice.amount || 0) - totalPaid;
  // Per-invoice remaining is never negative. Any extra payment is treated as
  // customer advance and shown separately via `overpaid` — it must not turn the
  // invoice's own remaining into a minus value.
  const remaining = rawRemaining > 0 ? rawRemaining : 0;
  const overpaid = rawRemaining < 0 ? -rawRemaining : 0;

  return {
    invoiceReceipts,
    receiptsPaid,
    embeddedPaid,
    totalPaid,
    remaining,
    overpaid,
  };
}
