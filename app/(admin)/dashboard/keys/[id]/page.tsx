import { z } from "zod";
import Link from "next/link";
import { notFound } from "next/navigation";
import { requireAdminPage } from "@/lib/require-admin";
import {
  KeyHeaderCard,
  KeyTimeline,
  type KeyDetailRow,
  type ScriptAccess,
  type TimelineRow,
} from "./KeyTimeline";
import styles from "./keyDetail.module.css";

const PAGE_SIZE = 50;
const idSchema = z.string().uuid();

type KeyScriptRow = {
  scripts: { name: string; slug: string } | null;
};

export default async function KeyDetailPage({
  params,
}: PageProps<"/dashboard/keys/[id]">) {
  const { id } = await params;

  const parsedId = idSchema.safeParse(id);
  if (!parsedId.success) {
    notFound();
  }

  const { adminClient } = await requireAdminPage();

  const { data: keyRow } = await adminClient
    .from("keys")
    .select(
      "id, key_value, label, status, hwid, hwid_resets, hwid_reset_limit, expires_at, discord_id, last_seen_at, last_ip, created_at",
    )
    .eq("id", id)
    .maybeSingle();

  if (!keyRow) {
    notFound();
  }

  const key = keyRow as unknown as KeyDetailRow;

  const [scriptsResult, logsResult] = await Promise.all([
    adminClient.from("key_scripts").select("scripts(name, slug)").eq("key_id", id),
    adminClient
      .from("validation_logs")
      .select("id, result, script_slug, hwid, ip, created_at")
      .eq("key_id", id)
      .order("id", { ascending: false })
      .limit(PAGE_SIZE),
  ]);

  const scripts: ScriptAccess[] = ((scriptsResult.data ?? []) as unknown as KeyScriptRow[])
    .map((row) => row.scripts)
    .filter((script): script is ScriptAccess => script !== null);

  const rows = (logsResult.data ?? []) as unknown as TimelineRow[];
  const nextCursor = rows.length === PAGE_SIZE ? rows[rows.length - 1].id : null;

  return (
    <div className={styles.stack}>
      <Link href="/dashboard/keys" className={styles.backLink}>
        Back to keys
      </Link>

      <KeyHeaderCard keyRow={key} scripts={scripts} />

      <KeyTimeline keyId={id} initialRows={rows} initialNextCursor={nextCursor} />
    </div>
  );
}
