import { createClient as createAdminClient } from "@/lib/supabase/admin";
import { BulkKeys, type ScriptOption } from "./BulkKeys";

export default async function BulkKeysPage() {
  const adminClient = createAdminClient();
  const { data } = await adminClient
    .from("scripts")
    .select("id, name")
    .order("name", { ascending: true });

  const scripts = (data ?? []) as ScriptOption[];

  return <BulkKeys scripts={scripts} />;
}
