import { NextResponse, type NextRequest } from "next/server";
import { createClient as createAdminClient } from "@/lib/supabase/admin";
import { sendDiscord, buildKeyFieldValue, ALERT_COLORS, type DiscordEmbed } from "@/lib/discord";

export const dynamic = "force-dynamic";

const LOCK_WINDOW_MS = 50 * 1000;
const PASS_A_LIMIT = 2000;

type MismatchSpikeRule = {
  enabled?: boolean;
  threshold?: number;
  window_min?: number;
  cooldown_min?: number;
};
type ServerErrorSpikeRule = MismatchSpikeRule;
type KeySharingRule = {
  enabled?: boolean;
  distinct_hwid?: number;
  distinct_ip?: number;
  window_min?: number;
  cooldown_min?: number;
};
type BannedUseRule = { enabled?: boolean; cooldown_min?: number };
type FirstActivationRule = { enabled?: boolean };

type AlertRules = {
  mismatch_spike?: MismatchSpikeRule;
  server_error_spike?: ServerErrorSpikeRule;
  key_sharing?: KeySharingRule;
  banned_use?: BannedUseRule;
  first_activation?: FirstActivationRule;
};

type AlertState = {
  running_at?: string;
  banned_use?: Record<string, string>;
  key_sharing?: Record<string, string>;
  mismatch_spike?: { last?: string };
  server_error_spike?: { last?: string };
};

const DEFAULT_RULES: Required<AlertRules> = {
  mismatch_spike: { enabled: true, threshold: 10, window_min: 15, cooldown_min: 30 },
  server_error_spike: { enabled: true, threshold: 20, window_min: 15, cooldown_min: 30 },
  key_sharing: {
    enabled: true,
    distinct_hwid: 2,
    distinct_ip: 3,
    window_min: 60,
    cooldown_min: 120,
  },
  banned_use: { enabled: true, cooldown_min: 60 },
  first_activation: { enabled: true },
};

function mergeRules(rules: AlertRules | null | undefined): Required<AlertRules> {
  return {
    mismatch_spike: { ...DEFAULT_RULES.mismatch_spike, ...rules?.mismatch_spike },
    server_error_spike: {
      ...DEFAULT_RULES.server_error_spike,
      ...rules?.server_error_spike,
    },
    key_sharing: { ...DEFAULT_RULES.key_sharing, ...rules?.key_sharing },
    banned_use: { ...DEFAULT_RULES.banned_use, ...rules?.banned_use },
    first_activation: { ...DEFAULT_RULES.first_activation, ...rules?.first_activation },
  };
}

function formatBangkok(iso: string) {
  return new Date(iso).toLocaleString("en-US", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Asia/Bangkok",
  });
}

function trimCooldownMap(
  map: Record<string, string> | undefined,
  cooldownMs: number,
  nowMs: number,
): Record<string, string> {
  if (!map) return {};
  const trimmed: Record<string, string> = {};
  for (const [key, iso] of Object.entries(map)) {
    if (nowMs - new Date(iso).getTime() < cooldownMs) {
      trimmed[key] = iso;
    }
  }
  return trimmed;
}

function checkAuth(request: NextRequest): NextResponse | null {
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) {
    return NextResponse.json({ error: "CRON_SECRET is not configured" }, { status: 500 });
  }
  if (request.headers.get("authorization") !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  return null;
}

type KeyLookup = {
  key_value: string;
  label: string | null;
  status: string;
  first_activated_at: string | null;
};

async function runScan(): Promise<NextResponse> {
  const adminClient = createAdminClient();

  const { data: settingsRow, error: settingsErr } = await adminClient
    .from("settings")
    .select("alert_webhook_url, alerts_enabled, alert_cursor, alert_state, alert_rules")
    .eq("id", 1)
    .maybeSingle();

  if (settingsErr) {
    return NextResponse.json({ error: settingsErr.message }, { status: 500 });
  }

  if (!settingsRow?.alerts_enabled || !settingsRow.alert_webhook_url) {
    return NextResponse.json({ success: true, skipped: "disabled" });
  }

  const webhookUrl = settingsRow.alert_webhook_url as string;
  const alertCursor = (settingsRow.alert_cursor as number) ?? 0;
  const state = (settingsRow.alert_state as AlertState) ?? {};
  const rules = mergeRules(settingsRow.alert_rules as AlertRules | null);

  const now = Date.now();

  if (state.running_at && now - new Date(state.running_at).getTime() < LOCK_WINDOW_MS) {
    return NextResponse.json({ success: true, skipped: "locked" });
  }

  await adminClient
    .from("settings")
    .update({ alert_state: { ...state, running_at: new Date(now).toISOString() } })
    .eq("id", 1);

  const keyCache = new Map<string, KeyLookup | null>();
  async function getKey(keyId: string): Promise<KeyLookup | null> {
    if (keyCache.has(keyId)) return keyCache.get(keyId) ?? null;
    const { data } = await adminClient
      .from("keys")
      .select("key_value, label, status, first_activated_at")
      .eq("id", keyId)
      .maybeSingle();
    const value = (data as KeyLookup | null) ?? null;
    keyCache.set(keyId, value);
    return value;
  }

  const embeds: DiscordEmbed[] = [];
  let maxId = alertCursor;

  // ---- Pass A: per-event, cursor-based ----
  const { data: rows, error: rowsErr } = await adminClient
    .from("validation_logs")
    .select("id, key_id, result, script_slug, hwid, ip, created_at")
    .gt("id", alertCursor)
    .order("id", { ascending: true })
    .limit(PASS_A_LIMIT);

  if (rowsErr) {
    await adminClient.from("settings").update({ alert_state: state }).eq("id", 1);
    return NextResponse.json({ error: rowsErr.message }, { status: 500 });
  }

  const bannedUseState: Record<string, string> = { ...(state.banned_use ?? {}) };
  const firstActivations = new Map<string, string>();

  for (const row of rows ?? []) {
    const rowId = row.id as number;
    if (rowId > maxId) maxId = rowId;

    const keyId = row.key_id as string | null;
    const result = row.result as string;

    if (rules.banned_use.enabled && (result === "banned" || result === "paused") && keyId) {
      const cooldownMs = (rules.banned_use.cooldown_min ?? 60) * 60 * 1000;
      const lastAlert = bannedUseState[keyId];
      const withinCooldown = lastAlert && now - new Date(lastAlert).getTime() < cooldownMs;

      if (!withinCooldown) {
        const key = await getKey(keyId);
        if (key) {
          embeds.push({
            title: result === "banned" ? "Banned key used" : "Paused key used",
            color: ALERT_COLORS.ORANGE,
            description: `A ${result} key attempted to validate.`,
            fields: [
              {
                name: "Key",
                value: buildKeyFieldValue({ id: keyId, key_value: key.key_value, label: key.label }),
              },
              { name: "Script", value: row.script_slug ?? "-", inline: true },
              { name: "HWID", value: row.hwid ?? "-", inline: true },
              { name: "IP", value: row.ip ?? "-", inline: true },
              { name: "Time", value: formatBangkok(row.created_at as string) },
            ],
          });
        }
        bannedUseState[keyId] = new Date(now).toISOString();
      }
    }

    if (
      rules.first_activation.enabled &&
      result === "ok" &&
      keyId &&
      !firstActivations.has(keyId)
    ) {
      const key = await getKey(keyId);
      if (key && key.first_activated_at === null) {
        embeds.push({
          title: "Key first activated",
          color: ALERT_COLORS.GREEN,
          description: "A key was used successfully for the first time.",
          fields: [
            {
              name: "Key",
              value: buildKeyFieldValue({ id: keyId, key_value: key.key_value, label: key.label }),
            },
            { name: "Script", value: row.script_slug ?? "-", inline: true },
            { name: "Time", value: formatBangkok(row.created_at as string) },
          ],
        });
        firstActivations.set(keyId, row.created_at as string);
      }
    }
  }

  // ---- Pass B: window-based spikes ----
  let mismatchLast = state.mismatch_spike?.last;
  if (rules.mismatch_spike.enabled) {
    const windowMin = rules.mismatch_spike.window_min ?? 15;
    const threshold = rules.mismatch_spike.threshold ?? 10;
    const cooldownMs = (rules.mismatch_spike.cooldown_min ?? 30) * 60 * 1000;
    const withinCooldown =
      mismatchLast && now - new Date(mismatchLast).getTime() < cooldownMs;

    if (!withinCooldown) {
      const sinceIso = new Date(now - windowMin * 60 * 1000).toISOString();
      const { data: mismatchRows, count, error: mismatchErr } = await adminClient
        .from("validation_logs")
        .select("key_id, hwid, ip", { count: "exact" })
        .eq("result", "hwid_mismatch")
        .gte("created_at", sinceIso);

      if (!mismatchErr && (count ?? 0) >= threshold) {
        const freq = new Map<
          string,
          { key_id: string | null; hwid: string | null; ip: string | null; count: number }
        >();
        for (const r of mismatchRows ?? []) {
          const k = `${r.key_id ?? "-"}|${r.hwid ?? "-"}|${r.ip ?? "-"}`;
          const entry = freq.get(k);
          if (entry) {
            entry.count += 1;
          } else {
            freq.set(k, {
              key_id: r.key_id as string | null,
              hwid: r.hwid as string | null,
              ip: r.ip as string | null,
              count: 1,
            });
          }
        }

        const top = Array.from(freq.values())
          .sort((a, b) => b.count - a.count)
          .slice(0, 5);

        const topLines: string[] = [];
        for (const entry of top) {
          const keyLabel = entry.key_id
            ? ((await getKey(entry.key_id))?.key_value ?? entry.key_id)
            : "no key";
          topLines.push(`${keyLabel}, ${entry.hwid ?? "-"}, ${entry.ip ?? "-"} (${entry.count})`);
        }

        embeds.push({
          title: "HWID mismatch spike",
          color: ALERT_COLORS.RED,
          description: `${count} mismatches in the last ${windowMin} min (threshold ${threshold}).`,
          fields:
            topLines.length > 0 ? [{ name: "Top offenders", value: topLines.join("\n") }] : [],
        });

        mismatchLast = new Date(now).toISOString();
      }
    }
  }

  let serverErrorLast = state.server_error_spike?.last;
  if (rules.server_error_spike.enabled) {
    const windowMin = rules.server_error_spike.window_min ?? 15;
    const threshold = rules.server_error_spike.threshold ?? 20;
    const cooldownMs = (rules.server_error_spike.cooldown_min ?? 30) * 60 * 1000;
    const withinCooldown =
      serverErrorLast && now - new Date(serverErrorLast).getTime() < cooldownMs;

    if (!withinCooldown) {
      const sinceIso = new Date(now - windowMin * 60 * 1000).toISOString();
      const { count, error: countErr } = await adminClient
        .from("validation_logs")
        .select("id", { count: "exact", head: true })
        .eq("result", "server_error")
        .gte("created_at", sinceIso);

      if (!countErr && (count ?? 0) >= threshold) {
        embeds.push({
          title: "Server error spike",
          color: ALERT_COLORS.RED,
          description: `${count} server errors in the last ${windowMin} min (threshold ${threshold}).`,
          fields: [],
        });
        serverErrorLast = new Date(now).toISOString();
      }
    }
  }

  const keySharingState: Record<string, string> = { ...(state.key_sharing ?? {}) };
  if (rules.key_sharing.enabled) {
    const windowMin = rules.key_sharing.window_min ?? 60;
    const distinctHwidThreshold = rules.key_sharing.distinct_hwid ?? 2;
    const distinctIpThreshold = rules.key_sharing.distinct_ip ?? 3;
    const cooldownMs = (rules.key_sharing.cooldown_min ?? 120) * 60 * 1000;
    const sinceIso = new Date(now - windowMin * 60 * 1000).toISOString();

    const { data: offenders, error: offendersErr } = await adminClient.rpc(
      "key_sharing_offenders",
      {
        since_ts: sinceIso,
        min_hwid: distinctHwidThreshold,
        min_ip: distinctIpThreshold,
      },
    );

    if (!offendersErr) {
      for (const offender of offenders ?? []) {
        const keyId = offender.key_id as string;

        const lastAlert = keySharingState[keyId];
        const withinCooldown = lastAlert && now - new Date(lastAlert).getTime() < cooldownMs;
        if (withinCooldown) continue;

        const key = await getKey(keyId);
        if (!key) continue;

        const hwids = (offender.hwids as string[] | null) ?? [];
        const ips = (offender.ips as string[] | null) ?? [];

        embeds.push({
          title: "Possible key sharing",
          color: ALERT_COLORS.ORANGE,
          description: `${offender.distinct_hwid} distinct HWIDs, ${offender.distinct_ip} distinct IPs in the last ${windowMin} min.`,
          fields: [
            {
              name: "Key",
              value: buildKeyFieldValue({ id: keyId, key_value: key.key_value, label: key.label }),
            },
            { name: "HWIDs", value: hwids.join("\n") || "-" },
            { name: "IPs", value: ips.join("\n") || "-" },
          ],
        });

        keySharingState[keyId] = new Date(now).toISOString();
      }
    }
  }

  // Send before persisting anything that advances state: a failed send must
  // leave the cursor, first_activated_at, and cooldowns untouched so the next
  // run reprocesses the same rows instead of dropping the alert.
  let sendOk = true;
  if (embeds.length > 0) {
    const result = await sendDiscord(webhookUrl, embeds);
    sendOk = result.ok;
  }

  if (!sendOk) {
    await adminClient
      .from("settings")
      .update({ alert_state: { ...state, running_at: undefined } })
      .eq("id", 1);

    return NextResponse.json({ success: false, reason: "discord_failed" });
  }

  await Promise.all(
    Array.from(firstActivations.entries()).map(([keyId, createdAt]) =>
      adminClient
        .from("keys")
        .update({ first_activated_at: createdAt })
        .eq("id", keyId)
        .is("first_activated_at", null),
    ),
  );

  const finalState: AlertState = {
    ...state,
    running_at: undefined,
    banned_use: trimCooldownMap(
      bannedUseState,
      (rules.banned_use.cooldown_min ?? 60) * 60 * 1000,
      now,
    ),
    key_sharing: trimCooldownMap(
      keySharingState,
      (rules.key_sharing.cooldown_min ?? 120) * 60 * 1000,
      now,
    ),
    mismatch_spike: mismatchLast ? { last: mismatchLast } : state.mismatch_spike,
    server_error_spike: serverErrorLast
      ? { last: serverErrorLast }
      : state.server_error_spike,
  };

  await adminClient
    .from("settings")
    .update({ alert_cursor: maxId, alert_state: finalState })
    .eq("id", 1);

  return NextResponse.json({ success: true, sent: embeds.length });
}

export async function GET(request: NextRequest) {
  const authError = checkAuth(request);
  if (authError) return authError;
  return runScan();
}

export async function POST(request: NextRequest) {
  const authError = checkAuth(request);
  if (authError) return authError;
  return runScan();
}
