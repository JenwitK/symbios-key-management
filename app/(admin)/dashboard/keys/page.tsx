import { Suspense } from "react";
import { createClient as createAdminClient } from "@/lib/supabase/admin";
import { KeysManager, type KeyRow, type ScriptOption } from "./KeysManager";

export default async function KeysPage() {
  const adminClient = createAdminClient();

  const [{ data: keysData }, { data: scriptsData }, { data: keyScriptsData }, { data: settingsData }] =
    await Promise.all([
      adminClient.from("keys").select("*").order("created_at", { ascending: false }),
      adminClient.from("scripts").select("id, name").order("name", { ascending: true }),
      adminClient.from("key_scripts").select("key_id, script_id"),
      adminClient.from("settings").select("default_reset_limit").eq("id", 1).maybeSingle(),
    ]);

  const keys = (keysData ?? []) as KeyRow[];
  const scripts = (scriptsData ?? []) as ScriptOption[];

  const keyScriptMap: Record<string, string[]> = {};
  for (const row of (keyScriptsData ?? []) as {
    key_id: string;
    script_id: string;
  }[]) {
    (keyScriptMap[row.key_id] ??= []).push(row.script_id);
  }

  const defaultResetLimit =
    (settingsData?.default_reset_limit as number | undefined) ?? 3;

  return (
    <Suspense>
      <KeysManager
        keys={keys}
        scripts={scripts}
        keyScriptMap={keyScriptMap}
        defaultResetLimit={defaultResetLimit}
      />
    </Suspense>
  );
}
