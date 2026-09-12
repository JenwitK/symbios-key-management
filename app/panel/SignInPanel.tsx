"use client";

import { createClient as createBrowserClient } from "@/lib/supabase/browser";
import { Button } from "@/components/Button/Button";
import { Badge } from "@/components/Badge/Badge";
import styles from "./panel.module.css";

export function SignInPanel() {
  async function handleSignIn() {
    const supabase = createBrowserClient();
    await supabase.auth.signInWithOAuth({
      provider: "discord",
      options: {
        redirectTo: `${window.location.origin}/auth/callback?next=/panel`,
      },
    });
  }

  return (
    <div className={styles.panel}>
      <Badge tone="neutral">Sign in required</Badge>
      <p className={styles.copy}>
        Sign in with Discord to view your keys, link a key to your account,
        or reset your own HWID.
      </p>
      <Button type="button" onClick={handleSignIn}>
        Sign in with Discord
      </Button>
    </div>
  );
}
