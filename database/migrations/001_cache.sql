CREATE TABLE IF NOT EXISTS response_cache (
 cache_key TEXT PRIMARY KEY,
 payload TEXT NOT NULL,
 expires_at INTEGER NOT NULL,
 created_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS response_cache_expiry ON response_cache(expires_at);
