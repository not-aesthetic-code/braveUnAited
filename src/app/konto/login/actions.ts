"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export async function sendMagicLinkAction(formData: FormData) {
  const email = formData.get("email");
  if (typeof email !== "string" || !email) {
    redirect(`/konto/login?error=${encodeURIComponent("Podaj adres e-mail")}`);
  }

  const origin = (await headers()).get("origin") ?? "http://localhost:3000";
  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: { emailRedirectTo: `${origin}/auth/callback` },
  });
  if (error) {
    redirect(
      `/konto/login?error=${encodeURIComponent("Nie udało się wysłać linku — spróbuj ponownie")}`
    );
  }

  redirect("/konto/login?sent=1");
}

export async function googleLoginAction() {
  const origin = (await headers()).get("origin") ?? "http://localhost:3000";
  const supabase = await createClient();
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: { redirectTo: `${origin}/auth/callback` },
  });
  if (error || !data.url) {
    redirect(`/konto/login?error=${encodeURIComponent("Logowanie przez Google niedostępne")}`);
  }
  redirect(data.url);
}
