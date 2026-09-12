import type { Metadata } from "next";
import { Navbar } from "@/components/Navbar/Navbar";
import { Footer } from "@/components/Footer/Footer";
import { createClient as createAdminClient } from "@/lib/supabase/admin";
import { getActiveProviderId } from "@/lib/providers";
import { GetKeyPanel } from "./GetKeyPanel";
import styles from "./get-key.module.css";

export const metadata: Metadata = {
  title: "Get a key — SYMBIOS",
};

export default async function GetKeyPage({
  searchParams,
}: PageProps<"/get-key">) {
  const params = await searchParams;
  const issuedKey = typeof params.key === "string" ? params.key : null;
  const error = typeof params.error === "string" ? params.error : null;

  const adminClient = createAdminClient();
  const { data: settings } = await adminClient
    .from("settings")
    .select("providers")
    .eq("id", 1)
    .maybeSingle();

  const providerId = getActiveProviderId(
    settings?.providers as Record<string, { enabled?: boolean }> | undefined,
  );

  return (
    <>
      <Navbar />
      <main className={styles.page}>
        <GetKeyPanel
          issuedKey={issuedKey}
          error={error}
          providerId={providerId}
        />
      </main>
      <Footer />
    </>
  );
}
