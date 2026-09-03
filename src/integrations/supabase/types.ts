export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      accounts: {
        Row: {
          account_title: string | null
          balance: number | null
          code: string | null
          company_id: string | null
          created_at: string
          currency: string | null
          fx_balance: number | null
          id: string
          name: string
          reconcile_date: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          account_title?: string | null
          balance?: number | null
          code?: string | null
          company_id?: string | null
          created_at?: string
          currency?: string | null
          fx_balance?: number | null
          id?: string
          name?: string
          reconcile_date?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          account_title?: string | null
          balance?: number | null
          code?: string | null
          company_id?: string | null
          created_at?: string
          currency?: string | null
          fx_balance?: number | null
          id?: string
          name?: string
          reconcile_date?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "accounts_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      activity_logs: {
        Row: {
          action: string
          company_id: string | null
          created_at: string
          details: string | null
          id: string
          item_id: string
          item_label: string
          item_type: string
          user_id: string
        }
        Insert: {
          action?: string
          company_id?: string | null
          created_at?: string
          details?: string | null
          id?: string
          item_id?: string
          item_label?: string
          item_type?: string
          user_id: string
        }
        Update: {
          action?: string
          company_id?: string | null
          created_at?: string
          details?: string | null
          id?: string
          item_id?: string
          item_label?: string
          item_type?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "activity_logs_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      backups: {
        Row: {
          backup_data: Json
          company_id: string | null
          created_at: string
          id: string
          label: string | null
          user_id: string
        }
        Insert: {
          backup_data: Json
          company_id?: string | null
          created_at?: string
          id?: string
          label?: string | null
          user_id: string
        }
        Update: {
          backup_data?: Json
          company_id?: string | null
          created_at?: string
          id?: string
          label?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "backups_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      bills: {
        Row: {
          amount: number | null
          company_id: string | null
          created_at: string
          date: string | null
          due_date: string | null
          id: string
          items: Json | null
          notes: string | null
          number: string | null
          status: string | null
          supplier: string | null
          tax: number | null
          updated_at: string
          user_id: string
        }
        Insert: {
          amount?: number | null
          company_id?: string | null
          created_at?: string
          date?: string | null
          due_date?: string | null
          id?: string
          items?: Json | null
          notes?: string | null
          number?: string | null
          status?: string | null
          supplier?: string | null
          tax?: number | null
          updated_at?: string
          user_id: string
        }
        Update: {
          amount?: number | null
          company_id?: string | null
          created_at?: string
          date?: string | null
          due_date?: string | null
          id?: string
          items?: Json | null
          notes?: string | null
          number?: string | null
          status?: string | null
          supplier?: string | null
          tax?: number | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "bills_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      companies: {
        Row: {
          address: string | null
          contact_email: string | null
          created_at: string
          expires_at: string | null
          id: string
          name: string
          notes: string | null
          phone: string | null
          plan: string
          starts_at: string
          status: string
          updated_at: string
        }
        Insert: {
          address?: string | null
          contact_email?: string | null
          created_at?: string
          expires_at?: string | null
          id?: string
          name: string
          notes?: string | null
          phone?: string | null
          plan?: string
          starts_at?: string
          status?: string
          updated_at?: string
        }
        Update: {
          address?: string | null
          contact_email?: string | null
          created_at?: string
          expires_at?: string | null
          id?: string
          name?: string
          notes?: string | null
          phone?: string | null
          plan?: string
          starts_at?: string
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
      customers: {
        Row: {
          address: string | null
          company: string | null
          company_id: string | null
          created_at: string
          email: string | null
          id: string
          name: string
          outstanding: number | null
          phone: string | null
          total_billed: number | null
          updated_at: string
          user_id: string
        }
        Insert: {
          address?: string | null
          company?: string | null
          company_id?: string | null
          created_at?: string
          email?: string | null
          id?: string
          name?: string
          outstanding?: number | null
          phone?: string | null
          total_billed?: number | null
          updated_at?: string
          user_id: string
        }
        Update: {
          address?: string | null
          company?: string | null
          company_id?: string | null
          created_at?: string
          email?: string | null
          id?: string
          name?: string
          outstanding?: number | null
          phone?: string | null
          total_billed?: number | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "customers_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      expenses: {
        Row: {
          amount: number | null
          category: string | null
          company_id: string | null
          created_at: string
          date: string | null
          description: string | null
          id: string
          payment_method: string | null
          project_name: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          amount?: number | null
          category?: string | null
          company_id?: string | null
          created_at?: string
          date?: string | null
          description?: string | null
          id?: string
          payment_method?: string | null
          project_name?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          amount?: number | null
          category?: string | null
          company_id?: string | null
          created_at?: string
          date?: string | null
          description?: string | null
          id?: string
          payment_method?: string | null
          project_name?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "expenses_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      inventory: {
        Row: {
          bundle_items: Json | null
          category: string | null
          company_id: string | null
          cost_price: number | null
          created_at: string
          date: string | null
          id: string
          location: string
          model: string | null
          name: string
          price: number | null
          product_type: string | null
          purchase_discount: number | null
          qty: number | null
          reorder_level: number | null
          sale_discount: number | null
          sale_price: number | null
          sku: string | null
          stock_asset_account: string | null
          unique_code: string | null
          unit: string | null
          updated_at: string
          user_id: string
          weight: number | null
        }
        Insert: {
          bundle_items?: Json | null
          category?: string | null
          company_id?: string | null
          cost_price?: number | null
          created_at?: string
          date?: string | null
          id?: string
          location?: string
          model?: string | null
          name?: string
          price?: number | null
          product_type?: string | null
          purchase_discount?: number | null
          qty?: number | null
          reorder_level?: number | null
          sale_discount?: number | null
          sale_price?: number | null
          sku?: string | null
          stock_asset_account?: string | null
          unique_code?: string | null
          unit?: string | null
          updated_at?: string
          user_id: string
          weight?: number | null
        }
        Update: {
          bundle_items?: Json | null
          category?: string | null
          company_id?: string | null
          cost_price?: number | null
          created_at?: string
          date?: string | null
          id?: string
          location?: string
          model?: string | null
          name?: string
          price?: number | null
          product_type?: string | null
          purchase_discount?: number | null
          qty?: number | null
          reorder_level?: number | null
          sale_discount?: number | null
          sale_price?: number | null
          sku?: string | null
          stock_asset_account?: string | null
          unique_code?: string | null
          unit?: string | null
          updated_at?: string
          user_id?: string
          weight?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "inventory_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      invoices: {
        Row: {
          amount: number | null
          company_id: string | null
          created_at: string
          customer: string | null
          date: string | null
          discount: number | null
          document_number: string | null
          due_date: string | null
          id: string
          items: Json | null
          notes: string | null
          number: string | null
          payments: Json | null
          project_name: string | null
          status: string | null
          tax: number | null
          updated_at: string
          user_id: string
        }
        Insert: {
          amount?: number | null
          company_id?: string | null
          created_at?: string
          customer?: string | null
          date?: string | null
          discount?: number | null
          document_number?: string | null
          due_date?: string | null
          id?: string
          items?: Json | null
          notes?: string | null
          number?: string | null
          payments?: Json | null
          project_name?: string | null
          status?: string | null
          tax?: number | null
          updated_at?: string
          user_id: string
        }
        Update: {
          amount?: number | null
          company_id?: string | null
          created_at?: string
          customer?: string | null
          date?: string | null
          discount?: number | null
          document_number?: string | null
          due_date?: string | null
          id?: string
          items?: Json | null
          notes?: string | null
          number?: string | null
          payments?: Json | null
          project_name?: string | null
          status?: string | null
          tax?: number | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "invoices_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      ledger_entries: {
        Row: {
          amount: number | null
          bank: string | null
          company_id: string | null
          created_at: string
          date: string | null
          description: string | null
          id: string
          reference: string | null
          type: string | null
          user_id: string
        }
        Insert: {
          amount?: number | null
          bank?: string | null
          company_id?: string | null
          created_at?: string
          date?: string | null
          description?: string | null
          id?: string
          reference?: string | null
          type?: string | null
          user_id: string
        }
        Update: {
          amount?: number | null
          bank?: string | null
          company_id?: string | null
          created_at?: string
          date?: string | null
          description?: string | null
          id?: string
          reference?: string | null
          type?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ledger_entries_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      other_payments: {
        Row: {
          account: string | null
          amount: number | null
          company_id: string | null
          created_at: string
          date: string | null
          description: string | null
          id: string
          payee: string | null
          reference: string | null
          user_id: string
        }
        Insert: {
          account?: string | null
          amount?: number | null
          company_id?: string | null
          created_at?: string
          date?: string | null
          description?: string | null
          id?: string
          payee?: string | null
          reference?: string | null
          user_id: string
        }
        Update: {
          account?: string | null
          amount?: number | null
          company_id?: string | null
          created_at?: string
          date?: string | null
          description?: string | null
          id?: string
          payee?: string | null
          reference?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "other_payments_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      other_receipts: {
        Row: {
          account: string | null
          amount: number | null
          company_id: string | null
          created_at: string
          date: string | null
          description: string | null
          id: string
          received_from: string | null
          reference: string | null
          user_id: string
        }
        Insert: {
          account?: string | null
          amount?: number | null
          company_id?: string | null
          created_at?: string
          date?: string | null
          description?: string | null
          id?: string
          received_from?: string | null
          reference?: string | null
          user_id: string
        }
        Update: {
          account?: string | null
          amount?: number | null
          company_id?: string | null
          created_at?: string
          date?: string | null
          description?: string | null
          id?: string
          received_from?: string | null
          reference?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "other_receipts_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      otp_codes: {
        Row: {
          attempts: number
          code_hash: string
          created_at: string
          email: string
          expires_at: string
          id: string
          used: boolean
          user_id: string
        }
        Insert: {
          attempts?: number
          code_hash: string
          created_at?: string
          email: string
          expires_at: string
          id?: string
          used?: boolean
          user_id: string
        }
        Update: {
          attempts?: number
          code_hash?: string
          created_at?: string
          email?: string
          expires_at?: string
          id?: string
          used?: boolean
          user_id?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          avatar_url: string | null
          company: string | null
          company_id: string | null
          created_at: string
          full_name: string
          id: string
          phone: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          avatar_url?: string | null
          company?: string | null
          company_id?: string | null
          created_at?: string
          full_name?: string
          id?: string
          phone?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          avatar_url?: string | null
          company?: string | null
          company_id?: string | null
          created_at?: string
          full_name?: string
          id?: string
          phone?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "profiles_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      purchase_orders: {
        Row: {
          amount: number | null
          company_id: string | null
          created_at: string
          date: string | null
          delivery_date: string | null
          id: string
          items: Json | null
          notes: string | null
          number: string | null
          status: string | null
          supplier: string | null
          tax: number | null
          updated_at: string
          user_id: string
        }
        Insert: {
          amount?: number | null
          company_id?: string | null
          created_at?: string
          date?: string | null
          delivery_date?: string | null
          id?: string
          items?: Json | null
          notes?: string | null
          number?: string | null
          status?: string | null
          supplier?: string | null
          tax?: number | null
          updated_at?: string
          user_id: string
        }
        Update: {
          amount?: number | null
          company_id?: string | null
          created_at?: string
          date?: string | null
          delivery_date?: string | null
          id?: string
          items?: Json | null
          notes?: string | null
          number?: string | null
          status?: string | null
          supplier?: string | null
          tax?: number | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "purchase_orders_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      purchase_payments: {
        Row: {
          amount: number | null
          bill_number: string | null
          company_id: string | null
          created_at: string
          date: string | null
          id: string
          notes: string | null
          number: string | null
          payment_method: string | null
          reference: string | null
          supplier: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          amount?: number | null
          bill_number?: string | null
          company_id?: string | null
          created_at?: string
          date?: string | null
          id?: string
          notes?: string | null
          number?: string | null
          payment_method?: string | null
          reference?: string | null
          supplier?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          amount?: number | null
          bill_number?: string | null
          company_id?: string | null
          created_at?: string
          date?: string | null
          id?: string
          notes?: string | null
          number?: string | null
          payment_method?: string | null
          reference?: string | null
          supplier?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "purchase_payments_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      quotations: {
        Row: {
          amount: number | null
          company_id: string | null
          created_at: string
          customer: string | null
          date: string | null
          document_number: string | null
          due_date: string | null
          id: string
          items: Json | null
          notes: string | null
          number: string | null
          project_name: string | null
          status: string | null
          tax: number | null
          updated_at: string
          user_id: string
        }
        Insert: {
          amount?: number | null
          company_id?: string | null
          created_at?: string
          customer?: string | null
          date?: string | null
          document_number?: string | null
          due_date?: string | null
          id?: string
          items?: Json | null
          notes?: string | null
          number?: string | null
          project_name?: string | null
          status?: string | null
          tax?: number | null
          updated_at?: string
          user_id: string
        }
        Update: {
          amount?: number | null
          company_id?: string | null
          created_at?: string
          customer?: string | null
          date?: string | null
          document_number?: string | null
          due_date?: string | null
          id?: string
          items?: Json | null
          notes?: string | null
          number?: string | null
          project_name?: string | null
          status?: string | null
          tax?: number | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "quotations_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      receipts: {
        Row: {
          amount: number | null
          company_id: string | null
          created_at: string
          customer: string | null
          date: string | null
          id: string
          invoice_number: string | null
          notes: string | null
          number: string | null
          payment_method: string | null
          reference: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          amount?: number | null
          company_id?: string | null
          created_at?: string
          customer?: string | null
          date?: string | null
          id?: string
          invoice_number?: string | null
          notes?: string | null
          number?: string | null
          payment_method?: string | null
          reference?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          amount?: number | null
          company_id?: string | null
          created_at?: string
          customer?: string | null
          date?: string | null
          id?: string
          invoice_number?: string | null
          notes?: string | null
          number?: string | null
          payment_method?: string | null
          reference?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "receipts_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      reconcile_entries: {
        Row: {
          account: string | null
          book_balance: number | null
          company_id: string | null
          created_at: string
          date: string | null
          difference: number | null
          id: string
          statement_balance: number | null
          status: string | null
          user_id: string
        }
        Insert: {
          account?: string | null
          book_balance?: number | null
          company_id?: string | null
          created_at?: string
          date?: string | null
          difference?: number | null
          id?: string
          statement_balance?: number | null
          status?: string | null
          user_id: string
        }
        Update: {
          account?: string | null
          book_balance?: number | null
          company_id?: string | null
          created_at?: string
          date?: string | null
          difference?: number | null
          id?: string
          statement_balance?: number | null
          status?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "reconcile_entries_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      sales_orders: {
        Row: {
          advance_payment: number | null
          advance_payment_method: string | null
          advance_payment_ref: string | null
          amount: number | null
          company_id: string | null
          created_at: string
          customer: string | null
          date: string | null
          delivery_date: string | null
          id: string
          items: Json | null
          location: string
          notes: string | null
          number: string | null
          project_name: string | null
          status: string | null
          tax: number | null
          updated_at: string
          user_id: string
        }
        Insert: {
          advance_payment?: number | null
          advance_payment_method?: string | null
          advance_payment_ref?: string | null
          amount?: number | null
          company_id?: string | null
          created_at?: string
          customer?: string | null
          date?: string | null
          delivery_date?: string | null
          id?: string
          items?: Json | null
          location?: string
          notes?: string | null
          number?: string | null
          project_name?: string | null
          status?: string | null
          tax?: number | null
          updated_at?: string
          user_id: string
        }
        Update: {
          advance_payment?: number | null
          advance_payment_method?: string | null
          advance_payment_ref?: string | null
          amount?: number | null
          company_id?: string | null
          created_at?: string
          customer?: string | null
          date?: string | null
          delivery_date?: string | null
          id?: string
          items?: Json | null
          location?: string
          notes?: string | null
          number?: string | null
          project_name?: string | null
          status?: string | null
          tax?: number | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "sales_orders_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      solar_washing: {
        Row: {
          amount: number | null
          company_id: string | null
          created_at: string
          customer: string | null
          date: string | null
          id: string
          notes: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          amount?: number | null
          company_id?: string | null
          created_at?: string
          customer?: string | null
          date?: string | null
          id?: string
          notes?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          amount?: number | null
          company_id?: string | null
          created_at?: string
          customer?: string | null
          date?: string | null
          id?: string
          notes?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "solar_washing_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      stock_adjustments: {
        Row: {
          company_id: string | null
          created_at: string
          date: string | null
          id: string
          item_id: string | null
          item_name: string | null
          note: string | null
          qty: number | null
          reason: string | null
          type: string | null
          user_id: string
        }
        Insert: {
          company_id?: string | null
          created_at?: string
          date?: string | null
          id?: string
          item_id?: string | null
          item_name?: string | null
          note?: string | null
          qty?: number | null
          reason?: string | null
          type?: string | null
          user_id: string
        }
        Update: {
          company_id?: string | null
          created_at?: string
          date?: string | null
          id?: string
          item_id?: string | null
          item_name?: string | null
          note?: string | null
          qty?: number | null
          reason?: string | null
          type?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "stock_adjustments_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      super_admins: {
        Row: {
          created_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          user_id?: string
        }
        Relationships: []
      }
      suppliers: {
        Row: {
          address: string | null
          company: string | null
          company_id: string | null
          created_at: string
          email: string | null
          id: string
          name: string
          outstanding: number | null
          phone: string | null
          total_paid: number | null
          updated_at: string
          user_id: string
        }
        Insert: {
          address?: string | null
          company?: string | null
          company_id?: string | null
          created_at?: string
          email?: string | null
          id?: string
          name?: string
          outstanding?: number | null
          phone?: string | null
          total_paid?: number | null
          updated_at?: string
          user_id: string
        }
        Update: {
          address?: string | null
          company?: string | null
          company_id?: string | null
          created_at?: string
          email?: string | null
          id?: string
          name?: string
          outstanding?: number | null
          phone?: string | null
          total_paid?: number | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "suppliers_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      transfers: {
        Row: {
          amount: number | null
          company_id: string | null
          created_at: string
          date: string | null
          from_account: string | null
          id: string
          reference: string | null
          to_account: string | null
          user_id: string
        }
        Insert: {
          amount?: number | null
          company_id?: string | null
          created_at?: string
          date?: string | null
          from_account?: string | null
          id?: string
          reference?: string | null
          to_account?: string | null
          user_id: string
        }
        Update: {
          amount?: number | null
          company_id?: string | null
          created_at?: string
          date?: string | null
          from_account?: string | null
          id?: string
          reference?: string | null
          to_account?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "transfers_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      trash: {
        Row: {
          company_id: string | null
          deleted_at: string
          id: string
          item_data: Json
          item_id: string
          item_type: string
          user_id: string
        }
        Insert: {
          company_id?: string | null
          deleted_at?: string
          id?: string
          item_data?: Json
          item_id?: string
          item_type?: string
          user_id: string
        }
        Update: {
          company_id?: string | null
          deleted_at?: string
          id?: string
          item_data?: Json
          item_id?: string
          item_type?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "trash_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      user_settings: {
        Row: {
          company_id: string | null
          created_at: string
          custom_accounts: Json | null
          custom_categories: Json | null
          custom_units: Json | null
          id: string
          settings_data: Json | null
          updated_at: string
          user_id: string
        }
        Insert: {
          company_id?: string | null
          created_at?: string
          custom_accounts?: Json | null
          custom_categories?: Json | null
          custom_units?: Json | null
          id?: string
          settings_data?: Json | null
          updated_at?: string
          user_id: string
        }
        Update: {
          company_id?: string | null
          created_at?: string
          custom_accounts?: Json | null
          custom_categories?: Json | null
          custom_units?: Json | null
          id?: string
          settings_data?: Json | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_settings_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      current_company_id: { Args: never; Returns: string }
      get_user_role: {
        Args: { _user_id: string }
        Returns: Database["public"]["Enums"]["app_role"]
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_super_admin: { Args: { _user_id: string }; Returns: boolean }
    }
    Enums: {
      app_role: "admin" | "accountant" | "sales"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      app_role: ["admin", "accountant", "sales"],
    },
  },
} as const
