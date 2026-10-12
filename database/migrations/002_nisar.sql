CREATE TABLE IF NOT EXISTS nisar_sources (
  scenario TEXT NOT NULL,
  granule_id TEXT NOT NULL,
  product TEXT NOT NULL,
  start_date TEXT,
  stop_date TEXT,
  source_url TEXT NOT NULL,
  source_bytes INTEGER,
  metadata_json TEXT NOT NULL,
  discovered_at TEXT NOT NULL,
  PRIMARY KEY (scenario, granule_id)
);
CREATE TABLE IF NOT EXISTS nisar_subsets (
  id TEXT PRIMARY KEY,
  scenario TEXT NOT NULL,
  granule_id TEXT NOT NULL,
  status TEXT NOT NULL,
  subset_path TEXT,
  output_path TEXT,
  transferred_bytes INTEGER NOT NULL DEFAULT 0,
  saved_bytes INTEGER,
  subset_sha256 TEXT,
  provenance_json TEXT,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (scenario, granule_id) REFERENCES nisar_sources(scenario, granule_id)
);
