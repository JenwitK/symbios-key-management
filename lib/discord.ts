// Server-only: fires webhook calls to Discord. Never import into a client
// component (not that it holds secrets, but it has no reason to run there).

export type DiscordEmbedField = {
  name: string;
  value: string;
  inline?: boolean;
};

export type DiscordEmbed = {
  title: string;
  description?: string;
  color: number;
  fields: DiscordEmbedField[];
  timestamp?: string;
  footer?: { text: string };
};

export const ALERT_COLORS = {
  RED: 0xf85149,
  ORANGE: 0xd29922,
  GREEN: 0x3fb950,
} as const;

const TIMEOUT_MS = 8000;
const MAX_EMBEDS_PER_MESSAGE = 10;
const MAX_RETRY_AFTER_SEC = 5;
const MAX_FIELDS = 25;
const MAX_FIELD_NAME = 256;
const MAX_FIELD_VALUE = 1024;
const MAX_DESCRIPTION = 4096;

function truncate(value: string, max: number) {
  return value.length > max ? value.slice(0, max) : value;
}

function sanitizeEmbed(embed: DiscordEmbed): DiscordEmbed {
  return {
    ...embed,
    description:
      embed.description !== undefined
        ? truncate(embed.description, MAX_DESCRIPTION)
        : undefined,
    fields: embed.fields.slice(0, MAX_FIELDS).map((field) => ({
      ...field,
      name: truncate(field.name, MAX_FIELD_NAME),
      value: truncate(field.value, MAX_FIELD_VALUE),
    })),
  };
}

function chunk<T>(items: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < items.length; i += size) {
    chunks.push(items.slice(i, i + size));
  }
  return chunks;
}

function readRetryAfter(body: unknown): number {
  if (typeof body === "object" && body !== null && "retry_after" in body) {
    const value = (body as Record<string, unknown>).retry_after;
    if (typeof value === "number" && Number.isFinite(value)) {
      return Math.min(value, MAX_RETRY_AFTER_SEC);
    }
  }
  return 1;
}

async function postOnce(
  webhookUrl: string,
  embeds: DiscordEmbed[],
): Promise<{ ok: boolean; status: number; retryAfter?: number }> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    const res = await fetch(webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        username: "SYMBIOS",
        embeds: embeds.map(sanitizeEmbed),
      }),
      signal: controller.signal,
    });

    if (res.status === 429) {
      const body: unknown = await res.json().catch(() => null);
      return { ok: false, status: 429, retryAfter: readRetryAfter(body) };
    }

    return { ok: res.ok, status: res.status };
  } finally {
    clearTimeout(timeoutId);
  }
}

/** Sends embeds to a Discord webhook, chunked to 10 per message. Never throws. */
export async function sendDiscord(
  webhookUrl: string,
  embeds: DiscordEmbed[],
): Promise<{ ok: boolean; status: number }> {
  if (embeds.length === 0) {
    return { ok: true, status: 204 };
  }

  try {
    let lastStatus = 0;

    for (const batch of chunk(embeds, MAX_EMBEDS_PER_MESSAGE)) {
      let result = await postOnce(webhookUrl, batch);

      if (result.status === 429) {
        await new Promise((resolve) =>
          setTimeout(resolve, (result.retryAfter ?? 1) * 1000),
        );
        result = await postOnce(webhookUrl, batch);
      }

      lastStatus = result.status;
      if (!result.ok) {
        return { ok: false, status: lastStatus };
      }
    }

    return { ok: true, status: lastStatus };
  } catch {
    return { ok: false, status: 0 };
  }
}

/** "Key" field value: mono key_value + label, plus a link to its dashboard detail page. */
export function buildKeyFieldValue(key: {
  id: string;
  key_value: string;
  label: string | null;
}): string {
  const appUrl = (process.env.APP_URL ?? "").replace(/\/$/, "");
  const labelPart = key.label ? ` (${key.label})` : "";
  const path = `/dashboard/keys/${key.id}`;
  return `\`${key.key_value}\`${labelPart}\nDetail: ${appUrl}${path}`;
}
