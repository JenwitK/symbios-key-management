import { createClient as createAdminClient } from "@/lib/supabase/admin";
import { ScriptsManager, type ScriptRow } from "./ScriptsManager";

export default async function ScriptsPage() {
  const adminClient = createAdminClient();
  const { data } = await adminClient
    .from("scripts")
    .select("id, name, slug, content, version, status, keyless, updated_at")
    .order("updated_at", { ascending: false });

  const scripts = (data ?? []) as ScriptRow[];

  return <ScriptsManager scripts={scripts} />;
}
