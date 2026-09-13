const BASE_URL = "https://moonveil.cc/api/v2";

export type MoonveilPlan = {
  name: string;
  maxScriptChars: number;
  dailyQuota: number;
  allowedOptions: string[];
};

export type MoonveilUsage = {
  used: number;
  quota: number;
  obfuscationCount: number;
  resetsAt: string;
};

export type MoonveilAccount = {
  id: string;
  email: string;
  username: string;
  plan: MoonveilPlan;
  usage: MoonveilUsage;
};

export type CompileType = "cff" | "vm" | "safeEnv";
export type VmType = "fox" | "skid";
export type SafeEnvLock = "luau" | "rbx";

export type ObfOptions = {
  compileType?: CompileType;
  vmType?: VmType;
  safeEnvLock?: SafeEnvLock;
  cffDecompose?: boolean;
  cffMangleNext?: boolean;
  cffMangleStrings?: boolean;
  cffMangleGlobals?: boolean;
  cffMangleCfPercent?: number;
};

export type MoonveilResult<T> =
  | { ok: true; data: T }
  | { ok: false; status: number; message: string; retryAfter?: number };

function getApiKey(): string {
  const key = process.env.MOONVEIL_API_KEY;
  if (!key) {
    throw new Error("MOONVEIL_API_KEY is not set");
  }
  return key;
}

function statusMessage(status: number): string {
  switch (status) {
    case 400:
      return "Script is invalid or exceeds the character limit.";
    case 401:
      return "MoonVeil rejected the API key.";
    case 403:
      return "That option is not allowed on your plan.";
    case 429:
      return "Quota or rate limit reached, try again later.";
    case 500:
      return "MoonVeil server error.";
    default:
      return "MoonVeil request failed.";
  }
}

async function moonveilFetch(path: string, init: RequestInit): Promise<Response> {
  return fetch(`${BASE_URL}${path}`, {
    ...init,
    headers: {
      ...init.headers,
      Authorization: `Bearer ${getApiKey()}`,
    },
  });
}

function retryAfterFrom(res: Response): number | undefined {
  const header = res.headers.get("Retry-After");
  if (!header) return undefined;
  const seconds = Number(header);
  return Number.isFinite(seconds) ? seconds : undefined;
}

async function errorResult<T>(res: Response): Promise<MoonveilResult<T>> {
  return {
    ok: false,
    status: res.status,
    message: statusMessage(res.status),
    retryAfter: retryAfterFrom(res),
  };
}

export async function getAccount(): Promise<MoonveilResult<MoonveilAccount>> {
  const res = await moonveilFetch("/account", { method: "GET" });

  if (!res.ok) {
    return errorResult(res);
  }

  const data = (await res.json()) as MoonveilAccount;
  return { ok: true, data };
}

export async function obfuscate(
  script: string,
  options?: ObfOptions,
): Promise<MoonveilResult<string>> {
  const res = await moonveilFetch("/obf", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ script, options: options ?? {} }),
  });

  if (!res.ok) {
    return errorResult(res);
  }

  const data = await res.text();
  return { ok: true, data };
}

export async function prettify(script: string): Promise<MoonveilResult<string>> {
  const res = await moonveilFetch("/prettify", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ script }),
  });

  if (!res.ok) {
    return errorResult(res);
  }

  const data = await res.text();
  return { ok: true, data };
}

export async function minify(script: string): Promise<MoonveilResult<string>> {
  const res = await moonveilFetch("/minify", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ script }),
  });

  if (!res.ok) {
    return errorResult(res);
  }

  const data = await res.text();
  return { ok: true, data };
}
