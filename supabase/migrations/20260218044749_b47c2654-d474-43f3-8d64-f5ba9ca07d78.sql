
-- Create all main data tables for cross-device sync

-- Customers
CREATE TABLE IF NOT EXISTS public.customers (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  name TEXT NOT NULL DEFAULT '',
  email TEXT DEFAULT '',
  phone TEXT DEFAULT '',
  company TEXT DEFAULT '',
  address TEXT DEFAULT '',
  total_billed NUMERIC DEFAULT 0,
  outstanding NUMERIC DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);
ALTER TABLE public.customers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own customers" ON public.customers FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- Suppliers
CREATE TABLE IF NOT EXISTS public.suppliers (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  name TEXT NOT NULL DEFAULT '',
  email TEXT DEFAULT '',
  phone TEXT DEFAULT '',
  company TEXT DEFAULT '',
  address TEXT DEFAULT '',
  total_paid NUMERIC DEFAULT 0,
  outstanding NUMERIC DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);
ALTER TABLE public.suppliers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own suppliers" ON public.suppliers FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- Inventory
CREATE TABLE IF NOT EXISTS public.inventory (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  name TEXT NOT NULL DEFAULT '',
  sku TEXT DEFAULT '',
  qty NUMERIC DEFAULT 0,
  reorder_level NUMERIC DEFAULT 5,
  price NUMERIC DEFAULT 0,
  category TEXT DEFAULT '',
  date TEXT DEFAULT '',
  cost_price NUMERIC DEFAULT 0,
  sale_price NUMERIC DEFAULT 0,
  unit TEXT DEFAULT 'pcs',
  weight NUMERIC DEFAULT 0,
  stock_asset_account TEXT DEFAULT 'Inventory Asset',
  sale_discount NUMERIC DEFAULT 0,
  purchase_discount NUMERIC DEFAULT 0,
  product_type TEXT DEFAULT 'stock',
  bundle_items JSONB DEFAULT '[]',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);
ALTER TABLE public.inventory ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own inventory" ON public.inventory FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- Invoices
CREATE TABLE IF NOT EXISTS public.invoices (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  number TEXT DEFAULT '',
  document_number TEXT DEFAULT '',
  project_name TEXT DEFAULT '',
  customer TEXT DEFAULT '',
  date TEXT DEFAULT '',
  due_date TEXT DEFAULT '',
  amount NUMERIC DEFAULT 0,
  status TEXT DEFAULT 'pending',
  items JSONB DEFAULT '[]',
  notes TEXT DEFAULT '',
  tax NUMERIC DEFAULT 0,
  payments JSONB DEFAULT '[]',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);
ALTER TABLE public.invoices ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own invoices" ON public.invoices FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- Sales Orders
CREATE TABLE IF NOT EXISTS public.sales_orders (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  number TEXT DEFAULT '',
  project_name TEXT DEFAULT '',
  customer TEXT DEFAULT '',
  date TEXT DEFAULT '',
  delivery_date TEXT DEFAULT '',
  amount NUMERIC DEFAULT 0,
  status TEXT DEFAULT 'pending',
  items JSONB DEFAULT '[]',
  notes TEXT DEFAULT '',
  tax NUMERIC DEFAULT 0,
  advance_payment NUMERIC DEFAULT 0,
  advance_payment_method TEXT DEFAULT '',
  advance_payment_ref TEXT DEFAULT '',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);
ALTER TABLE public.sales_orders ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own sales orders" ON public.sales_orders FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- Receipts
CREATE TABLE IF NOT EXISTS public.receipts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  number TEXT DEFAULT '',
  customer TEXT DEFAULT '',
  date TEXT DEFAULT '',
  invoice_number TEXT DEFAULT '',
  amount NUMERIC DEFAULT 0,
  payment_method TEXT DEFAULT 'cash',
  reference TEXT DEFAULT '',
  notes TEXT DEFAULT '',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);
ALTER TABLE public.receipts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own receipts" ON public.receipts FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- Expenses
CREATE TABLE IF NOT EXISTS public.expenses (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  date TEXT DEFAULT '',
  category TEXT DEFAULT '',
  description TEXT DEFAULT '',
  amount NUMERIC DEFAULT 0,
  payment_method TEXT DEFAULT '',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);
ALTER TABLE public.expenses ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own expenses" ON public.expenses FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- Purchase Orders
CREATE TABLE IF NOT EXISTS public.purchase_orders (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  number TEXT DEFAULT '',
  supplier TEXT DEFAULT '',
  date TEXT DEFAULT '',
  delivery_date TEXT DEFAULT '',
  amount NUMERIC DEFAULT 0,
  status TEXT DEFAULT 'pending',
  items JSONB DEFAULT '[]',
  notes TEXT DEFAULT '',
  tax NUMERIC DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);
ALTER TABLE public.purchase_orders ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own purchase orders" ON public.purchase_orders FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- Bills
CREATE TABLE IF NOT EXISTS public.bills (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  number TEXT DEFAULT '',
  supplier TEXT DEFAULT '',
  date TEXT DEFAULT '',
  due_date TEXT DEFAULT '',
  amount NUMERIC DEFAULT 0,
  status TEXT DEFAULT 'pending',
  items JSONB DEFAULT '[]',
  notes TEXT DEFAULT '',
  tax NUMERIC DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);
ALTER TABLE public.bills ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own bills" ON public.bills FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- Purchase Payments
CREATE TABLE IF NOT EXISTS public.purchase_payments (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  number TEXT DEFAULT '',
  supplier TEXT DEFAULT '',
  date TEXT DEFAULT '',
  bill_number TEXT DEFAULT '',
  amount NUMERIC DEFAULT 0,
  payment_method TEXT DEFAULT 'cash',
  reference TEXT DEFAULT '',
  notes TEXT DEFAULT '',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);
ALTER TABLE public.purchase_payments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own purchase payments" ON public.purchase_payments FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- Stock Adjustments
CREATE TABLE IF NOT EXISTS public.stock_adjustments (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  item_id TEXT DEFAULT '',
  item_name TEXT DEFAULT '',
  type TEXT DEFAULT 'increase',
  qty NUMERIC DEFAULT 0,
  reason TEXT DEFAULT '',
  date TEXT DEFAULT '',
  note TEXT DEFAULT '',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);
ALTER TABLE public.stock_adjustments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own stock adjustments" ON public.stock_adjustments FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- User Settings / Custom Options
CREATE TABLE IF NOT EXISTS public.user_settings (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL UNIQUE,
  settings_data JSONB DEFAULT '{}',
  custom_units JSONB DEFAULT '[]',
  custom_accounts JSONB DEFAULT '[]',
  custom_categories JSONB DEFAULT '[]',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);
ALTER TABLE public.user_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own settings" ON public.user_settings FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- Update triggers
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER update_customers_updated_at BEFORE UPDATE ON public.customers FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_suppliers_updated_at BEFORE UPDATE ON public.suppliers FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_inventory_updated_at BEFORE UPDATE ON public.inventory FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_invoices_updated_at BEFORE UPDATE ON public.invoices FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_sales_orders_updated_at BEFORE UPDATE ON public.sales_orders FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_receipts_updated_at BEFORE UPDATE ON public.receipts FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_expenses_updated_at BEFORE UPDATE ON public.expenses FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_purchase_orders_updated_at BEFORE UPDATE ON public.purchase_orders FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_bills_updated_at BEFORE UPDATE ON public.bills FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_purchase_payments_updated_at BEFORE UPDATE ON public.purchase_payments FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_user_settings_updated_at BEFORE UPDATE ON public.user_settings FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
