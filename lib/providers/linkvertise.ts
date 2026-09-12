import type { LinkProvider } from "./types";

// Official Anti-Bypass docs:
// https://publisher.linkvertise.dev/documentations/Anti_Bypass_Documentation.pdf
//   POST publisher.linkvertise.com/api/v1/anti_bypassing?token=<secret>&hash=<hash>
//   -> "TRUE"  : hash found (and deleted server-side — single-use by design)
//   -> "FALSE" : hash not found / already consumed
//   -> "Invalid token." : LINKVERTISE_SECRET is wrong
const ANTI_BYPASSING_ENDPOINT = "https://publisher.linkvertise.com/api/v1/anti_bypassing";

/**
 * Linkvertise does not publish a link-creation API — Anti-Bypass Target-Links
 * are meant to be created once in their dashboard with a fixed target. This
 * `dynamic?r=<base64>` redirect format is a widely-used, community
 * reverse-engineered convention (NOT from official docs) that lets a
 * standard Linkvertise ad-link redirect to an arbitrary URL we choose per
 * request. If Linkvertise changes how this is decoded, only this function
 * needs to change — `verify()` below is unaffected since it only depends on
 * the official Anti-Bypass endpoint.
 */
function buildDynamicLink(userId: string, destination: string): string {
  const nonce = Math.floor(Math.random() * 1_000_000_000) / 1000;
  const encoded = Buffer.from(encodeURI(destination)).toString("base64");
  return `https://link-to.net/${userId}/${nonce}/dynamic?r=${encoded}`;
}

export const linkvertiseProvider: LinkProvider = {
  id: "linkvertise",

  buildLink(_token, destination) {
    const userId = process.env.LINKVERTISE_USER_ID;
    if (!userId) {
      throw new Error("LINKVERTISE_USER_ID is not set");
    }

    // `token` is not embedded here directly — the caller is expected to have
    // already put it in `destination` (e.g. `?token=...`) so it survives the
    // round trip and comes back alongside Linkvertise's own `&hash=`.
    return buildDynamicLink(userId, destination);
  },

  async verify(hash) {
    const secret = process.env.LINKVERTISE_SECRET;
    if (!secret) {
      throw new Error("LINKVERTISE_SECRET is not set");
    }

    const url = new URL(ANTI_BYPASSING_ENDPOINT);
    url.searchParams.set("token", secret);
    url.searchParams.set("hash", hash);

    const res = await fetch(url, { method: "POST" });
    const body = (await res.text()).trim().toUpperCase();

    return { ok: body === "TRUE", meta: { raw: body } };
  },
};
