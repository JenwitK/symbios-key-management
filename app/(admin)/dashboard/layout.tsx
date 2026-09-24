import { requireAdminPage } from "@/lib/require-admin";
import type { AdminClient } from "@/lib/require-admin";
import { DashboardChrome } from "./DashboardChrome";

type DashboardCounts = {
  active_keys: number;
  expired_keys: number;
  banned_keys: number;
  paused_keys: number;
  total_keys: number;
  customers: number;
  scripts_total: number;
  scripts_maintenance: number;
};

type ChromeData = {
  username: string;
  envLabel: string;
  region: string;
  apiMs: number | null;
  statusTone: "ok" | "warn" | "err";
  statusLabel: string;
  counts: { keys: number | null; customers: number | null; scripts: number | null };
  initialMaintenance: boolean;
};

const SERVER_ERROR_DEGRADED_THRESHOLD = 5;
const FIFTEEN_MIN_MS = 15 * 60 * 1000;

function envLabelFromVercelEnv(vercelEnv: string | undefined): string {
  if (vercelEnv === "production") return "PROD";
  if (vercelEnv === "preview") return "PREVIEW";
  return "DEV";
}

// Plain data loader, not a component: safe to call Date.now()/performance.now()
// here, since this runs once per request rather than during a render pass.
async function loadChromeData(adminClient: AdminClient, userId: string): Promise<ChromeData> {
  const settingsStart = performance.now();
  const settingsPromise = adminClient
    .from("settings")
    .select("maintenance")
    .eq("id", 1)
    .maybeSingle()
    .then((res) => ({ ...res, ms: Math.round(performance.now() - settingsStart) }));

  const [adminResult, countsResult, settingsResult, serverErrorResult] = await Promise.all([
    adminClient.from("admins").select("username").eq("id", userId).maybeSingle(),
    adminClient.rpc("dashboard_counts").maybeSingle(),
    settingsPromise,
    adminClient
      .from("validation_logs")
      .select("id", { count: "exact", head: true })
      .eq("result", "server_error")
      .gte("created_at", new Date(Date.now() - FIFTEEN_MIN_MS).toISOString()),
  ]);

  const username = (adminResult.data?.username as string | undefined) ?? "admin";

  const counts = (countsResult.error ? null : (countsResult.data as DashboardCounts | null)) ?? null;

  const maintenance = settingsResult.error
    ? false
    : ((settingsResult.data?.maintenance as boolean | undefined) ?? false);
  const apiMs = settingsResult.error ? null : settingsResult.ms;

  const serverErrorCount = serverErrorResult.error ? 0 : (serverErrorResult.count ?? 0);

  let statusTone: "ok" | "warn" | "err" = "ok";
  let statusLabel = "All systems normal";
  if (maintenance) {
    statusTone = "warn";
    statusLabel = "Maintenance mode";
  } else if (serverErrorCount >= SERVER_ERROR_DEGRADED_THRESHOLD) {
    statusTone = "err";
    statusLabel = "Degraded";
  }

  return {
    username,
    envLabel: envLabelFromVercelEnv(process.env.VERCEL_ENV),
    region: process.env.VERCEL_REGION ?? "local",
    apiMs,
    statusTone,
    statusLabel,
    counts: {
      keys: counts?.active_keys ?? null,
      customers: counts?.customers ?? null,
      scripts: counts?.scripts_total ?? null,
    },
    initialMaintenance: maintenance,
  };
}

export default async function DashboardLayout({
  children,
}: LayoutProps<"/dashboard">) {
  const { userId, adminClient } = await requireAdminPage();
  const data = await loadChromeData(adminClient, userId);

  return <DashboardChrome {...data}>{children}</DashboardChrome>;
}
