import { createClient as createAdminClient } from "@/lib/supabase/admin";
import { PlaygroundClient } from "./PlaygroundClient";

export default async function PlaygroundPage() {
  const adminClient = createAdminClient();
  const { data } = await adminClient
    .from("scripts")
    .select("slug")
    .in("status", ["active", "maintenance"])
    .order("slug", { ascending: true });

  const slugs = (data ?? []).map((row) => row.slug as string);

  return <PlaygroundClient slugs={slugs} />;
}
