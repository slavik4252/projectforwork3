-- Outreach workspace foundation. Apply once to LEAD_REVIEWS D1 before enabling the workspace.
-- Existing Lovable CRM and lead_reviews records remain unchanged.
PRAGMA foreign_keys = ON;
CREATE TABLE IF NOT EXISTS outreach_projects (
 id TEXT PRIMARY KEY, name TEXT NOT NULL, owner_id TEXT NOT NULL,
 created_at INTEGER NOT NULL, rate_kopecks INTEGER NOT NULL DEFAULT 0 CHECK(rate_kopecks>=0)
);
CREATE TABLE IF NOT EXISTS outreach_members (
 project_id TEXT NOT NULL REFERENCES outreach_projects(id),
 user_id TEXT NOT NULL, role TEXT NOT NULL CHECK(role IN ('owner','moderator','agent','client')),
 suspended_at INTEGER, suspension_reason TEXT,
 PRIMARY KEY(project_id,user_id)
);
CREATE TABLE IF NOT EXISTS outreach_contacts (
 id TEXT PRIMARY KEY, project_id TEXT NOT NULL REFERENCES outreach_projects(id),
 phone TEXT NOT NULL, name TEXT NOT NULL DEFAULT '',
 channel TEXT NOT NULL DEFAULT 'unknown' CHECK(channel IN ('unknown','telegram','whatsapp','max','email','phone')),
 channel_check TEXT NOT NULL DEFAULT 'unknown' CHECK(channel_check IN ('unknown','found','undetermined')),
 checked_at INTEGER,
 assigned_to TEXT, assigned_at INTEGER,
 state TEXT NOT NULL DEFAULT 'free' CHECK(state IN ('free','assigned','submitted','needs_info','accepted','rejected')),
 created_at INTEGER NOT NULL,
 UNIQUE(project_id,phone),
 FOREIGN KEY(project_id,assigned_to) REFERENCES outreach_members(project_id,user_id)
);
CREATE INDEX IF NOT EXISTS outreach_contacts_queue ON outreach_contacts(project_id,state,created_at);
CREATE INDEX IF NOT EXISTS outreach_contacts_agent ON outreach_contacts(project_id,assigned_to,state);
CREATE TABLE IF NOT EXISTS outreach_templates (
 project_id TEXT NOT NULL REFERENCES outreach_projects(id),
 step TEXT NOT NULL CHECK(step IN ('1','2','3','followup')),
 content TEXT NOT NULL, PRIMARY KEY(project_id,step)
);
CREATE TABLE IF NOT EXISTS outreach_reports (
 id TEXT PRIMARY KEY, contact_id TEXT NOT NULL REFERENCES outreach_contacts(id),
 agent_id TEXT NOT NULL, revision INTEGER NOT NULL CHECK(revision>0),
 category TEXT NOT NULL CHECK(category IN ('application','question','later','declined','undetermined')),
 summary TEXT NOT NULL,
 review_state TEXT NOT NULL DEFAULT 'pending' CHECK(review_state IN ('pending','needs_info','manual_review','accepted','rejected')),
 review_reason TEXT, created_at INTEGER NOT NULL, decided_at INTEGER,
 UNIQUE(contact_id,revision)
);
CREATE TABLE IF NOT EXISTS outreach_evidence (
 id TEXT PRIMARY KEY, report_id TEXT NOT NULL REFERENCES outreach_reports(id),
 storage_key TEXT NOT NULL UNIQUE, mime TEXT NOT NULL, size INTEGER NOT NULL CHECK(size>0),
 sha256 TEXT NOT NULL, created_at INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS outreach_events (
 id TEXT PRIMARY KEY, project_id TEXT NOT NULL REFERENCES outreach_projects(id),
 contact_id TEXT REFERENCES outreach_contacts(id), agent_id TEXT NOT NULL,
 kind TEXT NOT NULL CHECK(kind IN ('claimed','template_copied','sent_confirmed','reply_confirmed','report_submitted','reviewed','released','suspended','restored')),
 channel TEXT, created_at INTEGER NOT NULL, detail TEXT NOT NULL DEFAULT ''
);
CREATE INDEX IF NOT EXISTS outreach_events_stats ON outreach_events(project_id,created_at,channel,kind);
CREATE TABLE IF NOT EXISTS outreach_rewards (
 id TEXT PRIMARY KEY, report_id TEXT NOT NULL UNIQUE REFERENCES outreach_reports(id),
 agent_id TEXT NOT NULL, amount_kopecks INTEGER NOT NULL CHECK(amount_kopecks>=0),
 state TEXT NOT NULL CHECK(state IN ('pending','earned','cancelled','paid')),
 created_at INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS outreach_public_shares (
 id TEXT PRIMARY KEY, project_id TEXT NOT NULL REFERENCES outreach_projects(id),
 token_hash TEXT NOT NULL UNIQUE, expires_at INTEGER, revoked_at INTEGER,
 created_at INTEGER NOT NULL
);
-- A contact is claimed by ONE conditional UPDATE, never by SELECT followed by UPDATE.
-- Bind authenticated user, timestamp, project, contact, project, authenticated user.
-- UPDATE outreach_contacts SET assigned_to=?,assigned_at=?,state='assigned'
-- WHERE project_id=? AND id=? AND state='free' AND assigned_to IS NULL
-- AND EXISTS(SELECT 1 FROM outreach_members WHERE project_id=? AND user_id=?
--   AND role='agent' AND suspended_at IS NULL)
-- RETURNING *;
-- Copying a template is NOT proof of sending. Count only distinct submitted reports
-- and confirmed outcomes. Anomaly rules create a temporary hold, not a fraud verdict.
