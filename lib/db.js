import { Pool } from "pg";

let pool;

export function getDbPool() {
  if (!pool) {
    const connectionString = process.env.DATABASE_URL;
    if (!connectionString) {
      throw new Error("DATABASE_URL is not set. Add it to your .env.local");
    }
    pool = new Pool({ connectionString, ssl: { rejectUnauthorized: false } });
  }
  return pool;
}

export async function dbQuery(text, params) {
  const client = await getDbPool().connect();
  try {
    const res = await client.query(text, params);
    return res;
  } finally {
    client.release();
  }
}

// Initialize a connection once on server start (used by instrumentation.js)
export async function initDbOnce() {
  if (globalThis.__dbInitialized) return;
  const client = await getDbPool().connect();
  try {
    const { rows } = await client.query("select version() as version, now() as ts");
    console.log(
      "[DB] Connected to Postgres:", rows?.[0]?.version?.split(" ")?.[0],
      "at",
      rows?.[0]?.ts
    );
    globalThis.__dbInitialized = true;
  } catch (err) {
    console.error("[DB] Connection failed:", err?.message);
    throw err;
  } finally {
    client.release();
  }
}


