import { Badge } from "@/components/Badge/Badge";
import { HwidCell } from "@/components/HwidCell/HwidCell";
import { createClient as createAdminClient } from "@/lib/supabase/admin";
import styles from "./customers.module.css";

type KeyStatus = "active" | "paused" | "banned" | "expired";

type KeyRow = {
  id: string;
  key_value: string;
  label: string | null;
  status: KeyStatus;
  hwid: string | null;
  hwid_resets: number;
  hwid_reset_limit: number;
  expires_at: string | null;
  discord_id: string;
  last_seen_at: string | null;
  created_at: string;
};

type CustomerGroup = {
  discordId: string;
  keys: KeyRow[];
};

const STATUS_TONE: Record<KeyStatus, "ok" | "warn" | "err" | "neutral"> = {
  active: "ok",
  paused: "warn",
  banned: "err",
  expired: "neutral",
};

function formatDateTime(iso: string | null) {
  if (!iso) return "-";
  return new Date(iso).toLocaleString("en-US", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Asia/Bangkok",
  });
}

function formatExpiry(iso: string | null) {
  if (!iso) return "Lifetime";
  return new Date(iso).toLocaleDateString("en-US", {
    dateStyle: "medium",
    timeZone: "Asia/Bangkok",
  });
}

function groupByDiscordId(keys: KeyRow[]): CustomerGroup[] {
  const groups: CustomerGroup[] = [];
  const indexByDiscordId = new Map<string, number>();

  for (const key of keys) {
    let index = indexByDiscordId.get(key.discord_id);
    if (index === undefined) {
      index = groups.length;
      indexByDiscordId.set(key.discord_id, index);
      groups.push({ discordId: key.discord_id, keys: [] });
    }
    groups[index].keys.push(key);
  }

  return groups;
}

export default async function CustomersPage({
  searchParams,
}: PageProps<"/dashboard/customers">) {
  const params = await searchParams;
  const q = typeof params.q === "string" ? params.q : "";
  const safeQ = q.replace(/[,()%\\]/g, "");

  const adminClient = createAdminClient();
  let query = adminClient
    .from("keys")
    .select(
      "id, key_value, label, status, hwid, hwid_resets, hwid_reset_limit, expires_at, discord_id, last_seen_at, created_at",
    )
    .not("discord_id", "is", null)
    .order("discord_id", { ascending: true })
    .order("created_at", { ascending: false });

  if (safeQ) {
    query = query.or(`discord_id.ilike.%${safeQ}%,key_value.ilike.%${safeQ}%`);
  }

  const { data } = await query;
  const keys = (data ?? []) as KeyRow[];
  const groups = groupByDiscordId(keys);

  return (
    <div>
      <h1 className={styles.pageTitle}>Customers</h1>
      <p className={styles.pageSubtitle}>
        Keys grouped by the Discord account they are linked to.
      </p>

      <form method="get" className={styles.filters}>
        <label className={styles.field}>
          <span className={styles.label}>Search</span>
          <input
            type="text"
            name="q"
            defaultValue={q}
            placeholder="Discord ID or key"
            className={styles.input}
          />
        </label>

        <button type="submit" className={styles.filterButton}>
          Filter
        </button>
      </form>

      {groups.length === 0 ? (
        <div className={styles.empty}>No Discord-linked keys yet.</div>
      ) : (
        <div className={styles.customerList}>
          {groups.map((group) => (
            <section key={group.discordId} className={styles.customerCard}>
              <div className={styles.customerHeader}>
                <a
                  href={`https://discord.com/users/${group.discordId}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={styles.discordId}
                >
                  {group.discordId}
                </a>
                <span className={styles.keyCount}>
                  {group.keys.length} {group.keys.length === 1 ? "key" : "keys"}
                </span>
              </div>

              <div className={styles.tableWrap}>
                <div className={styles.table}>
                  <div className={styles.row}>
                    <div className={styles.headerCell}>Key</div>
                    <div className={styles.headerCell}>Status</div>
                    <div className={styles.headerCell}>HWID</div>
                    <div className={styles.headerCell}>Resets left</div>
                    <div className={styles.headerCell}>Expires</div>
                    <div className={styles.headerCell}>Last seen</div>
                  </div>

                  {group.keys.map((key) => {
                    const resetsLeft = Math.max(
                      key.hwid_reset_limit - key.hwid_resets,
                      0,
                    );
                    return (
                      <div key={key.id} className={styles.row}>
                        <div className={`${styles.cell} ${styles.mono}`}>
                          {key.key_value}
                        </div>
                        <div className={styles.cell}>
                          <Badge tone={STATUS_TONE[key.status]}>
                            {key.status}
                          </Badge>
                        </div>
                        <div className={`${styles.cell} ${styles.mono}`}>
                          <HwidCell hwid={key.hwid} />
                        </div>
                        <div className={`${styles.cell} ${styles.mono}`}>
                          {resetsLeft}
                        </div>
                        <div className={`${styles.cell} ${styles.mono} ${styles.time}`}>
                          {formatExpiry(key.expires_at)}
                        </div>
                        <div className={`${styles.cell} ${styles.mono} ${styles.time}`}>
                          {formatDateTime(key.last_seen_at)}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
