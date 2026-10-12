CREATE TABLE IF NOT EXISTS glacier_surface_frames (
 scenario TEXT NOT NULL,
 id TEXT NOT NULL,
 variable TEXT NOT NULL CHECK(variable IN ('velocity','elevation')),
 start_date TEXT NOT NULL,
 end_date TEXT NOT NULL,
 source TEXT NOT NULL,
 provenance_json TEXT NOT NULL,
 updated_at TEXT NOT NULL,
 PRIMARY KEY(scenario,id)
);
CREATE TABLE IF NOT EXISTS glacier_outline_epochs (
 scenario TEXT NOT NULL,
 acquisition_year INTEGER NOT NULL,
 source TEXT NOT NULL,
 outline_json TEXT NOT NULL,
 PRIMARY KEY(scenario,acquisition_year)
);
