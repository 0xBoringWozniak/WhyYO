import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
  try {
    const payload = (await request.json()) as Record<string, unknown>;
    console.error(
      "[web-client-error]",
      JSON.stringify({
        ...payload,
        ip: request.headers.get("x-forwarded-for") ?? "unknown",
      }),
    );
  } catch (error) {
    console.error("[web-client-error] failed-to-parse", error);
  }

  return NextResponse.json({ ok: true });
}
