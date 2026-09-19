-- INE Price Tracker - Supabase Schema
-- Run this in the Supabase SQL Editor

-- Table 1: Tracked Products
CREATE TABLE tracked_products (
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
CREATE TABLE price_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tracked_product_id uuid NOT NULL REFERENCES tracked_products(id) ON DELETE CASCADE,
  price numeric(10,2) NOT NULL,
  stock_status text,
  scraped_at timestamptz DEFAULT now()
);

CREATE INDEX idx_price_history_product ON price_history(tracked_product_id);
CREATE INDEX idx_price_history_scraped ON price_history(scraped_at);

-- Table 3: Scrape Logs
CREATE TABLE scrape_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tracked_product_id uuid NOT NULL REFERENCES tracked_products(id) ON DELETE CASCADE,
  attempt_number integer NOT NULL,
  status text NOT NULL,
  error_message text,
  duration_ms integer,
  scraped_at timestamptz DEFAULT now()
);

CREATE INDEX idx_scrape_logs_product ON scrape_logs(tracked_product_id);
CREATE INDEX idx_scrape_logs_scraped ON scrape_logs(scraped_at);

-- Enable RLS with permissive policies (no auth)
ALTER TABLE tracked_products ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all on tracked_products" ON tracked_products FOR ALL USING (true) WITH CHECK (true);

ALTER TABLE price_history ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all on price_history" ON price_history FOR ALL USING (true) WITH CHECK (true);

ALTER TABLE scrape_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all on scrape_logs" ON scrape_logs FOR ALL USING (true) WITH CHECK (true);
