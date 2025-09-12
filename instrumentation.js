import { initDbOnce } from "./lib/db";

export async function register() {
  // Called once per server start in Next.js 15 app router
  try {
    await initDbOnce();
  } catch (err) {
    // Already logged inside initDbOnce
  }
}


