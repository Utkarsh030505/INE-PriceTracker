-- INE Price Tracker - Supabase Schema
-- Run this in the Supabase SQL Editor

-- Table 1: Tracked Products
CREATE TABLE IF NOT EXISTS tracked_products (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_name text NOT NULL,
  product_url text NOT NULL UNIQUE,
  current_price numeric(10,2),
  current_stock text,
  last_scraped_at timestamptz,
  last_scrape_status text,
  created_at timestamptz DEFAULT now()
);

-- Table 2: Price History
CREATE TABLE IF NOT EXISTS price_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tracked_product_id uuid NOT NULL REFERENCES tracked_products(id) ON DELETE CASCADE,
  price numeric(10,2) NOT NULL,
  stock_status text,
  scraped_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_price_history_product ON price_history(tracked_product_id);
CREATE INDEX IF NOT EXISTS idx_price_history_scraped ON price_history(scraped_at);

-- Table 3: Scrape Logs
CREATE TABLE IF NOT EXISTS scrape_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tracked_product_id uuid NOT NULL REFERENCES tracked_products(id) ON DELETE CASCADE,
  attempt_number integer NOT NULL,
  status text NOT NULL,
  error_message text,
  duration_ms integer,
  scraped_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_scrape_logs_product ON scrape_logs(tracked_product_id);
CREATE INDEX IF NOT EXISTS idx_scrape_logs_scraped ON scrape_logs(scraped_at);

-- Table 4: Product Alerts (Bonus Feature)
CREATE TABLE IF NOT EXISTS product_alerts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tracked_product_id uuid NOT NULL REFERENCES tracked_products(id) ON DELETE CASCADE,
  alert_type text NOT NULL CHECK (alert_type IN ('price_drop', 'back_in_stock')),
  previous_price numeric(10,2),
  current_price numeric(10,2),
  percentage_change numeric(5,2),
  previous_stock text,
  current_stock text,
  transition_key text UNIQUE,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_product_alerts_product ON product_alerts(tracked_product_id);
CREATE INDEX IF NOT EXISTS idx_product_alerts_created ON product_alerts(created_at);

-- Additive migration for tracked_products settings (Bonus Features)
ALTER TABLE tracked_products ADD COLUMN IF NOT EXISTS price_alert_enabled boolean DEFAULT true;
ALTER TABLE tracked_products ADD COLUMN IF NOT EXISTS stock_alert_enabled boolean DEFAULT true;
ALTER TABLE tracked_products ADD COLUMN IF NOT EXISTS price_drop_threshold_pct numeric(5,2) DEFAULT 0;
ALTER TABLE tracked_products ADD COLUMN IF NOT EXISTS scrape_interval_minutes integer DEFAULT 120;
ALTER TABLE tracked_products ADD COLUMN IF NOT EXISTS next_scrape_at timestamptz DEFAULT now();

-- Enable RLS with restricted policies
ALTER TABLE tracked_products ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all on tracked_products" ON tracked_products FOR ALL USING (true) WITH CHECK (true);

ALTER TABLE price_history ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all on price_history" ON price_history FOR ALL USING (true) WITH CHECK (true);

ALTER TABLE scrape_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all on scrape_logs" ON scrape_logs FOR ALL USING (true) WITH CHECK (true);

ALTER TABLE product_alerts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow select on product_alerts" ON product_alerts FOR SELECT USING (true);
CREATE POLICY "Allow insert on product_alerts" ON product_alerts FOR INSERT WITH CHECK (true);
