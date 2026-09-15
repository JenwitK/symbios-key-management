import { z } from "zod";
import { NextResponse, type NextRequest } from "next/server";
import { requireAdmin } from "@/lib/require-admin";

const mismatchSpikeSchema = z
  .object({
    enabled: z.boolean().optional(),
    threshold: z.number().int().min(1).optional(),
    window_min: z.number().int().min(1).optional(),
    cooldown_min: z.number().int().min(0).optional(),
  })
  .strict();

const serverErrorSpikeSchema = mismatchSpikeSchema;

const keySharingSchema = z
  .object({
    enabled: z.boolean().optional(),
    distinct_hwid: z.number().int().min(1).optional(),
    distinct_ip: z.number().int().min(1).optional(),
    window_min: z.number().int().min(1).optional(),
    cooldown_min: z.number().int().min(0).optional(),
  })
  .strict();

const bannedUseSchema = z
  .object({
    enabled: z.boolean().optional(),
    cooldown_min: z.number().int().min(0).optional(),
  })
  .strict();

const firstActivationSchema = z
  .object({
    enabled: z.boolean().optional(),
  })
  .strict();

const alertRulesSchema = z
  .object({
    mismatch_spike: mismatchSpikeSchema.optional(),
    server_error_spike: serverErrorSpikeSchema.optional(),
    key_sharing: keySharingSchema.optional(),
    banned_use: bannedUseSchema.optional(),
    first_activation: firstActivationSchema.optional(),
  })
  .strict();

const alertWebhookUrlSchema = z.preprocess(
  (val) => (val === "" ? null : val),
  z.string().trim().url().nullable(),
);

const updateSettingsSchema = z.object({
  key_prefix: z
    .string()
    .trim()
    .min(1)
    .max(32)
    .regex(/^[A-Za-z0-9_-]+$/, "key_prefix must be letters, numbers, _ or -")
    .optional(),
  default_reset_limit: z.number().int().min(0).max(999).optional(),
  discord_url: z.string().trim().url().optional(),
  announce_auto_secs: z.number().int().min(0).optional(),
  maintenance: z.boolean().optional(),
  alert_webhook_url: alertWebhookUrlSchema.optional(),
  alerts_enabled: z.boolean().optional(),
  alert_rules: alertRulesSchema.optional(),
});

export async function PATCH(request: NextRequest) {
  const auth = await requireAdmin();
  if (!auth.authorized) return auth.response;

  const body: unknown = await request.json().catch(() => null);
  const parsed = updateSettingsSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid input" },
      { status: 400 },
    );
  }

  if (Object.keys(parsed.data).length === 0) {
    return NextResponse.json({ error: "Nothing to update" }, { status: 400 });
  }

  const { alert_rules: alertRulesPatch, ...rest } = parsed.data;
  const updatePayload: Record<string, unknown> = { ...rest };

  if (alertRulesPatch) {
    // Merge per rule so a partial patch (e.g. just mismatch_spike.threshold)
    // never wipes the other rules stored in the same jsonb column.
    const { data: current } = await auth.adminClient
      .from("settings")
      .select("alert_rules")
      .eq("id", 1)
      .maybeSingle();

    const currentRules = (current?.alert_rules as Record<string, unknown> | null) ?? {};
    const mergedRules: Record<string, unknown> = { ...currentRules };

    for (const [ruleKey, ruleValue] of Object.entries(alertRulesPatch)) {
      const existingRule =
        typeof mergedRules[ruleKey] === "object" && mergedRules[ruleKey] !== null
          ? (mergedRules[ruleKey] as Record<string, unknown>)
          : {};
      mergedRules[ruleKey] = { ...existingRule, ...ruleValue };
    }

    updatePayload.alert_rules = mergedRules;
  }

  const { data: settings, error } = await auth.adminClient
    .from("settings")
    .update({ ...updatePayload, updated_at: new Date().toISOString() })
    .eq("id", 1)
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true, settings });
}
