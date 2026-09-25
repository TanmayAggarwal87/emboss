import { randomUUID } from "node:crypto";
import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) throw new Error("Database configuration is missing.");

const db = createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } });
const pageCount = Number(process.argv[2] ?? 1);
if (![1, 2, 3].includes(pageCount)) throw new Error("Choose 1, 2, or 3 pages.");
const id = randomUUID();
const result = await db.from("jobs").insert({ id, page_count: pageCount, status: "processing" }).select("id").single();
if (result.error) {
  console.log(JSON.stringify({
    pageCount,
    code: result.error.code,
    pageCountConstraint: result.error.message.includes("jobs_page_count_check"),
  }));
  process.exitCode = 1;
} else {
  const cleanup = await db.from("jobs").delete().eq("id", id);
  console.log(JSON.stringify({ pageCount, inserted: true, cleanup: cleanup.error ? "failed" : "complete" }));
  if (cleanup.error) {
    console.error(`Temporary diagnostic row needs cleanup: ${id}`);
    process.exitCode = 2;
  }
}
