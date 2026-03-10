
-- Accounts table
CREATE TABLE public.accounts (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL,
  name text NOT NULL DEFAULT '',
  account_title text DEFAULT '',
  code text DEFAULT '',
  currency text DEFAULT 'PKR',
  balance numeric DEFAULT 0,
  reconcile_date text DEFAULT '',
  fx_balance numeric DEFAULT 0,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);
ALTER TABLE public.accounts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users manage accounts" ON public.accounts FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Ledger entries table
CREATE TABLE public.ledger_entries (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL,
  date text DEFAULT '',
  bank text DEFAULT '',
  type text DEFAULT 'incoming',
  amount numeric DEFAULT 0,
  description text DEFAULT '',
  reference text DEFAULT '',
  created_at timestamp with time zone NOT NULL DEFAULT now()
);
ALTER TABLE public.ledger_entries ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users manage ledger entries" ON public.ledger_entries FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Other payments table
CREATE TABLE public.other_payments (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL,
  date text DEFAULT '',
  account text DEFAULT '',
  payee text DEFAULT '',
  amount numeric DEFAULT 0,
  reference text DEFAULT '',
  description text DEFAULT '',
  created_at timestamp with time zone NOT NULL DEFAULT now()
);
ALTER TABLE public.other_payments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users manage other payments" ON public.other_payments FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Other receipts table
CREATE TABLE public.other_receipts (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL,
  date text DEFAULT '',
  account text DEFAULT '',
  received_from text DEFAULT '',
  amount numeric DEFAULT 0,
  reference text DEFAULT '',
  description text DEFAULT '',
  created_at timestamp with time zone NOT NULL DEFAULT now()
);
ALTER TABLE public.other_receipts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users manage other receipts" ON public.other_receipts FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Transfers table
CREATE TABLE public.transfers (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL,
  date text DEFAULT '',
  from_account text DEFAULT '',
  to_account text DEFAULT '',
  amount numeric DEFAULT 0,
  reference text DEFAULT '',
  created_at timestamp with time zone NOT NULL DEFAULT now()
);
ALTER TABLE public.transfers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users manage transfers" ON public.transfers FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Reconcile entries table
CREATE TABLE public.reconcile_entries (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL,
  date text DEFAULT '',
  account text DEFAULT '',
  statement_balance numeric DEFAULT 0,
  book_balance numeric DEFAULT 0,
  difference numeric DEFAULT 0,
  status text DEFAULT 'pending',
  created_at timestamp with time zone NOT NULL DEFAULT now()
);
ALTER TABLE public.reconcile_entries ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users manage reconcile entries" ON public.reconcile_entries FOR ALL TO authenticated USING (true) WITH CHECK (true);
