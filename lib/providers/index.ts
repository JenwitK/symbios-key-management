import type { LinkProvider } from "./types";
import { linkvertiseProvider } from "./linkvertise";

export type { LinkProvider };

const PROVIDERS: Record<string, LinkProvider> = {
  linkvertise: linkvertiseProvider,
};

export const KNOWN_PROVIDER_IDS = Object.keys(PROVIDERS);

export function getProvider(id: string): LinkProvider | null {
  return PROVIDERS[id] ?? null;
}

type ProvidersSetting = Record<string, { enabled?: boolean } | undefined> | null | undefined;

/** Picks the first provider that's both known to us and enabled in settings.providers. */
export function getActiveProviderId(providers: ProvidersSetting): string | null {
  if (!providers) return null;
  for (const [id, config] of Object.entries(providers)) {
    if (config?.enabled && PROVIDERS[id]) {
      return id;
    }
  }
  return null;
}

/**
 * Wraps `provider.verify` with the local dev bypass. Gated on NODE_ENV so it
 * can never fire in a real (production) deployment even if the env var is
 * left set by mistake.
 */
export async function verifyRedeem(
  provider: LinkProvider,
  hash: string,
  ip: string,
): Promise<{ ok: boolean; meta?: Record<string, unknown> }> {
  if (process.env.REDEEM_DEV_BYPASS === "1" && process.env.NODE_ENV !== "production") {
    return { ok: true, meta: { devBypass: true } };
  }

  return provider.verify(hash, ip);
}
