
-- Update RLS policies to allow all authenticated users to share data

-- activity_logs
DROP POLICY IF EXISTS "Users manage own activity logs" ON public.activity_logs;
CREATE POLICY "Authenticated users manage activity logs" ON public.activity_logs FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- bills
DROP POLICY IF EXISTS "Users manage own bills" ON public.bills;
CREATE POLICY "Authenticated users manage bills" ON public.bills FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- customers
DROP POLICY IF EXISTS "Users manage own customers" ON public.customers;
CREATE POLICY "Authenticated users manage customers" ON public.customers FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- expenses
DROP POLICY IF EXISTS "Users manage own expenses" ON public.expenses;
CREATE POLICY "Authenticated users manage expenses" ON public.expenses FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- inventory
DROP POLICY IF EXISTS "Users manage own inventory" ON public.inventory;
CREATE POLICY "Authenticated users manage inventory" ON public.inventory FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- invoices
DROP POLICY IF EXISTS "Users manage own invoices" ON public.invoices;
CREATE POLICY "Authenticated users manage invoices" ON public.invoices FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- purchase_orders
DROP POLICY IF EXISTS "Users manage own purchase orders" ON public.purchase_orders;
CREATE POLICY "Authenticated users manage purchase orders" ON public.purchase_orders FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- purchase_payments
DROP POLICY IF EXISTS "Users manage own purchase payments" ON public.purchase_payments;
CREATE POLICY "Authenticated users manage purchase payments" ON public.purchase_payments FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- receipts
DROP POLICY IF EXISTS "Users manage own receipts" ON public.receipts;
CREATE POLICY "Authenticated users manage receipts" ON public.receipts FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- sales_orders
DROP POLICY IF EXISTS "Users manage own sales orders" ON public.sales_orders;
CREATE POLICY "Authenticated users manage sales orders" ON public.sales_orders FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- stock_adjustments
DROP POLICY IF EXISTS "Users manage own stock adjustments" ON public.stock_adjustments;
CREATE POLICY "Authenticated users manage stock adjustments" ON public.stock_adjustments FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- suppliers
DROP POLICY IF EXISTS "Users manage own suppliers" ON public.suppliers;
CREATE POLICY "Authenticated users manage suppliers" ON public.suppliers FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- trash
DROP POLICY IF EXISTS "Users manage own trash" ON public.trash;
CREATE POLICY "Authenticated users manage trash" ON public.trash FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- user_settings
DROP POLICY IF EXISTS "Users manage own settings" ON public.user_settings;
CREATE POLICY "Authenticated users manage settings" ON public.user_settings FOR ALL TO authenticated USING (true) WITH CHECK (true);
