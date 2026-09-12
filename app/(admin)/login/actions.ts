"use server";

import { z } from "zod";
import { redirect } from "next/navigation";
import { createClient as createAdminClient } from "@/lib/supabase/admin";
import { createClient as createServerClient } from "@/lib/supabase/server";

const loginSchema = z.object({
  username: z.string().min(1),
  password: z.string().min(1),
});

export type LoginState = {
  error?: string;
};

const INVALID_CREDENTIALS: LoginState = {
  error: "Invalid username or password.",
};

export async function login(
  _prevState: LoginState,
  formData: FormData,
): Promise<LoginState> {
  const parsed = loginSchema.safeParse({
    username: formData.get("username"),
    password: formData.get("password"),
  });

  if (!parsed.success) {
    return { error: "Enter a username and password." };
  }

  const { username, password } = parsed.data;

  // SPEC.md §3: admins.username maps to the internal auth.users email.
  const adminClient = createAdminClient();
  const { data: admin, error: adminError } = await adminClient
    .from("admins")
    .select("id")
    .eq("username", username)
    .maybeSingle();

  if (adminError || !admin) {
    return INVALID_CREDENTIALS;
  }

  const { data: userData, error: userError } =
    await adminClient.auth.admin.getUserById(admin.id as string);

  if (userError || !userData.user?.email) {
    return INVALID_CREDENTIALS;
  }

  const supabase = await createServerClient();
  const { error: signInError } = await supabase.auth.signInWithPassword({
    email: userData.user.email,
    password,
  });

  if (signInError) {
    return INVALID_CREDENTIALS;
  }

  redirect("/dashboard");
}
