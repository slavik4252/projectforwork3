CREATE TABLE IF NOT EXISTS outreach_settings (
 project_id TEXT PRIMARY KEY REFERENCES outreach_projects(id),
 claim_limit INTEGER NOT NULL DEFAULT 20,
 overdue_hours INTEGER NOT NULL DEFAULT 24,
 anomaly_min_contacts INTEGER NOT NULL DEFAULT 10,
 anomaly_min_ratio REAL NOT NULL DEFAULT 0.2,
 crm_categories TEXT NOT NULL DEFAULT '["application"]'
);
CREATE TABLE IF NOT EXISTS outreach_report_files (
 report_id TEXT NOT NULL REFERENCES outreach_reports(id),
 position INTEGER NOT NULL,
 telegram_file_id TEXT NOT NULL,
 mime TEXT NOT NULL,
 name TEXT NOT NULL,
 PRIMARY KEY(report_id,position)
);
CREATE TABLE IF NOT EXISTS outreach_report_delivery (
 report_id TEXT PRIMARY KEY REFERENCES outreach_reports(id),
 chat_id TEXT,
 message_id INTEGER,
 responded INTEGER NOT NULL DEFAULT 1 CHECK(responded IN (0,1)),
 ai_result TEXT,
 delivery_error TEXT
);
CREATE TABLE IF NOT EXISTS outreach_crm (
 contact_id TEXT PRIMARY KEY REFERENCES outreach_contacts(id),
 report_id TEXT NOT NULL REFERENCES outreach_reports(id),
 project_id TEXT NOT NULL REFERENCES outreach_projects(id),
 stage TEXT NOT NULL DEFAULT 'new' CHECK(stage IN ('new','contacted','negotiating','proposal','paid')),
 updated_at INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS outreach_schema_versions (
 version INTEGER PRIMARY KEY,
 applied_at INTEGER NOT NULL
);
