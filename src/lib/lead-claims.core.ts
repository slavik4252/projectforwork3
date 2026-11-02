export type ClaimStatement = {
  bind(...values: unknown[]): ClaimStatement;
  first<T = Record<string, any>>(): Promise<T | null>;
  all<T = Record<string, any>>(): Promise<{ results: T[] }>;
  run(): Promise<{ meta: { changes: number } }>;
};
export type ClaimDatabase = { prepare(sql: string): ClaimStatement };
export interface LeadClaim { managerId: string; managerEmail: string; claimedAt: number }

export async function ensureClaimsTable(db: ClaimDatabase) {
  await db.prepare("CREATE TABLE IF NOT EXISTS lead_claims (lead_id TEXT PRIMARY KEY, manager_id TEXT NOT NULL, manager_email TEXT NOT NULL, claimed_at INTEGER NOT NULL)").run();
}

/** Atomically assigns a lead: the PRIMARY KEY guarantees only one manager can hold it. */
export async function claimLeadCore(db: ClaimDatabase, leadId: string, managerId: string, managerEmail: string, now = Date.now()) {
  const inserted = await db.prepare("INSERT INTO lead_claims(lead_id,manager_id,manager_email,claimed_at) VALUES(?,?,?,?) ON CONFLICT(lead_id) DO NOTHING")
    .bind(leadId, managerId, managerEmail, now).run();
  const row = await db.prepare("SELECT manager_id,manager_email,claimed_at FROM lead_claims WHERE lead_id=?").bind(leadId).first<any>();
  if (!row) throw new Error("Не удалось закрепить заявку, попробуйте ещё раз");
  if (row.manager_id !== managerId) throw new Error(`Заявку уже взял ${row.manager_email}`);
  return { created: inserted.meta.changes > 0, claim: { managerId: row.manager_id, managerEmail: row.manager_email, claimedAt: Number(row.claimed_at) } as LeadClaim };
}

export async function releaseLeadCore(db: ClaimDatabase, leadId: string, managerId: string) {
  const accepted = await db.prepare("SELECT id FROM lead_reviews WHERE lead_id=? AND type='review_accepted' LIMIT 1").bind(leadId).first();
  if (accepted) throw new Error("Заявка уже выполнена и в архиве");
  const deleted = await db.prepare("DELETE FROM lead_claims WHERE lead_id=? AND manager_id=?").bind(leadId, managerId).run();
  if (!deleted.meta.changes) throw new Error("Эта заявка закреплена не за вами");
}

export async function listClaimsCore(db: ClaimDatabase, leadIds: string[]) {
  const claims: Record<string, LeadClaim> = {};
  for (let i = 0; i < leadIds.length; i += 100) {
    const ids = leadIds.slice(i, i + 100);
    if (!ids.length) continue;
    const rows = await db.prepare(`SELECT lead_id,manager_id,manager_email,claimed_at FROM lead_claims WHERE lead_id IN (${ids.map(() => "?").join(",")})`).bind(...ids).all<any>();
    for (const r of rows.results) claims[r.lead_id] = { managerId: r.manager_id, managerEmail: r.manager_email, claimedAt: Number(r.claimed_at) };
  }
  return claims;
}
