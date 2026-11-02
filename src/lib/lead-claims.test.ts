import { describe, it, expect } from "vitest";
import { DatabaseSync } from "node:sqlite";
import { ensureClaimsTable, claimLeadCore, releaseLeadCore, listClaimsCore, type ClaimDatabase } from "./lead-claims.core";

function fixture() {
  const sqlite = new DatabaseSync(":memory:");
  sqlite.exec("CREATE TABLE lead_reviews (id TEXT PRIMARY KEY, lead_id TEXT NOT NULL, type TEXT NOT NULL, description TEXT NOT NULL, created_at INTEGER NOT NULL)");
  const prepare = (sql: string) => {
    let params: any[] = [];
    const st: any = {
      bind(...v: any[]) { params = v; return st; },
      async first() { return sqlite.prepare(sql).get(...params) || null; },
      async all() { return { results: sqlite.prepare(sql).all(...params) }; },
      async run() { return { meta: { changes: Number(sqlite.prepare(sql).run(...params).changes) } }; },
    };
    return st;
  };
  return { sqlite, db: { prepare } as ClaimDatabase };
}

describe("lead claims", () => {
  it("only one of two managers can take a lead", async () => {
    const { db } = fixture();
    await ensureClaimsTable(db);
    const r = await Promise.allSettled([claimLeadCore(db, "L1", "a", "a@x.ru"), claimLeadCore(db, "L1", "b", "b@x.ru")]);
    expect(r.filter(x => x.status === "fulfilled")).toHaveLength(1);
    const rejected = r.find(x => x.status === "rejected") as PromiseRejectedResult;
    expect(String(rejected.reason)).toContain("Заявку уже взял");
    const claims = await listClaimsCore(db, ["L1", "L2"]);
    expect(Object.keys(claims)).toEqual(["L1"]);
  });
  it("re-claim by the same manager is idempotent; release frees the lead", async () => {
    const { db } = fixture();
    await ensureClaimsTable(db);
    expect((await claimLeadCore(db, "L1", "a", "a@x.ru")).created).toBe(true);
    expect((await claimLeadCore(db, "L1", "a", "a@x.ru")).created).toBe(false);
    await expect(releaseLeadCore(db, "L1", "b")).rejects.toThrow();
    await releaseLeadCore(db, "L1", "a");
    expect((await claimLeadCore(db, "L1", "b", "b@x.ru")).claim.managerId).toBe("b");
  });
  it("accepted lead cannot be released", async () => {
    const { db, sqlite } = fixture();
    await ensureClaimsTable(db);
    await claimLeadCore(db, "L1", "a", "a@x.ru");
    sqlite.exec("INSERT INTO lead_reviews VALUES('r','L1','review_accepted','{}',1)");
    await expect(releaseLeadCore(db, "L1", "a")).rejects.toThrow("архиве");
  });
});
