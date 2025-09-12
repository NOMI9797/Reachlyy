import { NextResponse } from "next/server";
import { dbQuery } from "@/lib/db";

export async function GET() {
  try {
    const result = await dbQuery("select 'ok' as status, now() as ts");
    return NextResponse.json({
      status: result.rows[0]?.status || "ok",
      timestamp: result.rows[0]?.ts,
    });
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}


