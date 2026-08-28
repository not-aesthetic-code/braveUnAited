"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export async function loginAction(formData: FormData) {
  const email = formData.get("email");
  const password = formData.get("password");
  if (typeof email !== "string" || typeof password !== "string") {
    redirect(`/panel/login?error=${encodeURIComponent("Podaj e-mail i hasło")}`);
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) {
    redirect(`/panel/login?error=${encodeURIComponent("Nieprawidłowy e-mail lub hasło")}`);
  }

  redirect("/panel");
}
