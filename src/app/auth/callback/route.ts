// Landing point for both the magic-link email and the Google OAuth redirect —
// Supabase appends `code`, we trade it for a session cookie and send the
// patient on to their account.
import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get("code");
  if (code) {
    const supabase = await createClient();
    await supabase.auth.exchangeCodeForSession(code);
  }
  return NextResponse.redirect(new URL("/konto", request.url));
}
