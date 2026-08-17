import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import ksLogo from "@/assets/ks-logo.png";
import {
  FileText,
  Package,
  BarChart3,
  Landmark,
  ShieldCheck,
  Bot,
  Truck,
  Receipt,
  CheckCircle2,
  ArrowRight,
  Play,
  Search,
  Bell,
  ChevronDown,
  Plus,
  MoreHorizontal,
  Check,
} from "lucide-react";


const features = [
  { icon: FileText, title: "Sales & Invoicing", desc: "Quotations, sales orders, invoices, returns and delivery challans in one flow." },
  { icon: Package, title: "Inventory Control", desc: "Stock, bundles, store inventory, adjustments and full price audit trail." },
  { icon: Truck, title: "Purchases", desc: "Purchase orders, bills and supplier payments with automatic stock updates." },
  { icon: Landmark, title: "Accounts & Ledgers", desc: "Bank, cash and petty cash accounts with dual ledgers and reconciliations." },
  { icon: BarChart3, title: "Reports & P&L", desc: "Income statement, aging, stock valuation and product-wise sale analysis." },
  { icon: Bot, title: "AI Assistant", desc: "Nexia reads your data and scanned quotations to answer instantly." },
];

const benefits = [
  "Role based access for admin, accountant and sales teams",
  "Two factor authentication with email OTP",
  "One click backup, SQL dump and data migration",
  "Print ready invoices, receipts and delivery challans",
];

export default function Landing() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Nav */}
      <header className="sticky top-0 z-40 border-b bg-card/80 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4">
          <div className="flex items-center gap-3">
            <img src={ksLogo} alt="K&S Solar Energy logo" className="h-9 w-auto object-contain" />
            <span className="hidden text-sm font-semibold tracking-tight sm:block">K&amp;S Solar Accounts</span>
          </div>
          <nav className="flex items-center gap-2">
            <a href="#features" className="hidden rounded-md px-3 py-2 text-sm text-muted-foreground hover:text-foreground sm:block">Features</a>
            <a href="#why" className="hidden rounded-md px-3 py-2 text-sm text-muted-foreground hover:text-foreground sm:block">Why us</a>
            <a href="#contact" className="hidden rounded-md px-3 py-2 text-sm text-muted-foreground hover:text-foreground sm:block">Contact</a>
            <Button asChild size="sm">
              <Link to="/auth">Login</Link>
            </Button>
          </nav>
        </div>
      </header>

      <main>
        {/* Hero */}
        <section className="relative flex h-[calc(100vh-4rem)] flex-col overflow-hidden border-b">
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(70%_60%_at_50%_0%,hsl(var(--primary)/0.12),transparent_70%)]" />
          <div className="relative z-10 mx-auto flex w-full max-w-6xl flex-col items-center px-4 pt-10 sm:pt-14">
            <motion.span
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5 }}
              className="mb-6 inline-flex items-center gap-1.5 rounded-full border border-border bg-card px-4 py-1.5 font-body text-sm text-muted-foreground"
            >
              <ShieldCheck className="h-3.5 w-3.5 text-primary" />
              Now with Nexia AI assistant ✨
            </motion.span>

            <motion.h1
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.1 }}
              className="max-w-3xl text-center font-display text-5xl leading-[0.95] tracking-tight text-foreground md:text-6xl lg:text-[5rem]"
            >
              The Future of <span className="italic">Smarter</span> Solar Accounting
            </motion.h1>

            <motion.p
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.2 }}
              className="mt-4 max-w-[650px] text-center font-body text-base leading-relaxed text-muted-foreground md:text-lg"
            >
              Invoicing, purchases, stock and profit reports in one fast system — built from the real
              day-to-day work of a solar energy business in Pakistan.
            </motion.p>

            <motion.div
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.3 }}
              className="mt-5 flex items-center gap-3"
            >
              <Button asChild className="rounded-full px-6 py-5 font-body text-sm font-medium">
                <Link to="/auth">
                  Login to your account
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Link>
              </Button>
              <Button
                asChild
                variant="ghost"
                className="h-11 w-11 rounded-full border-0 bg-card p-0 shadow-[0_2px_12px_rgba(0,0,0,0.08)] hover:bg-card/80"
              >
                <a href="#contact" aria-label="Request a demo">
                  <Play className="h-4 w-4 fill-foreground" />
                </a>
              </Button>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8, delay: 0.5 }}
              className="mt-8 w-full max-w-5xl"
            >
              <div
                className="overflow-hidden rounded-2xl p-3 md:p-4"
                style={{
                  background: "rgba(255, 255, 255, 0.4)",
                  border: "1px solid rgba(255, 255, 255, 0.5)",
                  boxShadow: "var(--shadow-dashboard)",
                }}
              >
                <DashboardPreview />
              </div>
            </motion.div>
          </div>
        </section>


        {/* Features */}
        <section id="features" className="mx-auto max-w-6xl px-4 py-16 sm:py-20">
          <h2 className="text-2xl font-bold tracking-tight sm:text-3xl">Everything in one place</h2>
          <p className="mt-2 max-w-2xl text-muted-foreground">
            Built from real day-to-day work of a solar energy business — practical, not bloated.
          </p>
          <div className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {features.map((f) => (
              <article key={f.title} className="rounded-xl border bg-card p-6 transition-shadow hover:shadow-md">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                  <f.icon className="h-5 w-5 text-primary" />
                </div>
                <h3 className="mt-4 text-base font-semibold">{f.title}</h3>
                <p className="mt-2 text-sm text-muted-foreground">{f.desc}</p>
              </article>
            ))}
          </div>
        </section>

        {/* Why */}
        <section id="why" className="border-y bg-card">
          <div className="mx-auto grid max-w-6xl gap-10 px-4 py-16 sm:py-20 lg:grid-cols-2 lg:items-center">
            <div>
              <h2 className="text-2xl font-bold tracking-tight sm:text-3xl">Why businesses choose us</h2>
              <ul className="mt-6 space-y-3">
                {benefits.map((b) => (
                  <li key={b} className="flex items-start gap-3 text-sm">
                    <CheckCircle2 className="mt-0.5 h-5 w-5 flex-shrink-0 text-primary" />
                    <span>{b}</span>
                  </li>
                ))}
              </ul>
            </div>
            <div className="grid grid-cols-3 gap-4 text-center">
              {[
                { k: "100%", v: "Cloud based" },
                { k: "24/7", v: "Data access" },
                { k: "PKR", v: "Local ready" },
              ].map((s) => (
                <div key={s.v} className="rounded-xl border bg-background p-6">
                  <p className="text-2xl font-bold text-primary">{s.k}</p>
                  <p className="mt-1 text-xs text-muted-foreground">{s.v}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* CTA */}
        <section id="contact" className="mx-auto max-w-6xl px-4 py-16 sm:py-20">
          <div className="rounded-2xl border bg-card p-8 text-center sm:p-12">
            <h2 className="text-2xl font-bold tracking-tight sm:text-3xl">Ready to run your business better?</h2>
            <p className="mx-auto mt-3 max-w-xl text-muted-foreground">
              Get your team on board today, or contact us for a guided demo and pricing.
            </p>
            <div className="mt-8 flex flex-wrap justify-center gap-3">
              <Button asChild size="lg">
                <Link to="/auth">Login</Link>
              </Button>
              <Button asChild size="lg" variant="outline">
                <a href="mailto:info@knssolar.com.pk">info@knssolar.com.pk</a>
              </Button>
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t py-8">
        <div className="mx-auto flex max-w-6xl flex-col items-center gap-2 px-4 text-center">
          <img src={ksLogo} alt="K&S Solar Energy" className="h-8 w-auto object-contain" />
          <p className="text-xs text-muted-foreground">
            © {new Date().getFullYear()} K&amp;S Solar Energy. All rights reserved.
          </p>
          <p className="text-[10px] text-muted-foreground/70">
            Design &amp; Developed by <span className="font-medium">Yousuf Enterprises</span>
          </p>
        </div>
      </footer>
    </div>
  );
}
