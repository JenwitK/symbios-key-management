import { z } from "zod";
import { NextResponse, type NextRequest } from "next/server";
import { requireAdmin } from "@/lib/require-admin";
import {
  getAccount,
  obfuscate,
  prettify,
  minify,
  type MoonveilResult,
} from "@/lib/moonveil";

const optionsSchema = z.object({
  compileType: z.enum(["cff", "vm", "safeEnv"]).optional(),
  vmType: z.enum(["fox", "skid"]).optional(),
  safeEnvLock: z.enum(["luau", "rbx"]).optional(),
  cffDecompose: z.boolean().optional(),
  cffMangleNext: z.boolean().optional(),
  cffMangleStrings: z.boolean().optional(),
  cffMangleGlobals: z.boolean().optional(),
  cffMangleCfPercent: z.number().min(0).max(100).optional(),
});

const postSchema = z.object({
  mode: z.enum(["obf", "prettify", "minify"]),
  script: z.string().min(1, "Script is required"),
  options: optionsSchema.optional(),
});

function badRequest(message: string) {
  return NextResponse.json({ error: message }, { status: 400 });
}

function fromResult(result: MoonveilResult<string>) {
  if (!result.ok) {
    return NextResponse.json(
      {
        error: result.message,
        ...(result.retryAfter !== undefined ? { retryAfter: result.retryAfter } : {}),
      },
      { status: result.status },
    );
  }
  return NextResponse.json({ success: true, output: result.data });
}

export async function GET() {
  const auth = await requireAdmin();
  if (!auth.authorized) return auth.response;

  const result = await getAccount();

  if (!result.ok) {
    return NextResponse.json({ error: result.message }, { status: result.status });
  }

  return NextResponse.json({ success: true, account: result.data });
}

export async function POST(request: NextRequest) {
  const auth = await requireAdmin();
  if (!auth.authorized) return auth.response;

  const body: unknown = await request.json().catch(() => null);
  const parsed = postSchema.safeParse(body);
  if (!parsed.success) {
    return badRequest(parsed.error.issues[0]?.message ?? "Invalid input");
  }

  const { mode, script, options } = parsed.data;

  if (mode === "obf") {
    return fromResult(await obfuscate(script, options));
  }
  if (mode === "prettify") {
    return fromResult(await prettify(script));
  }
  return fromResult(await minify(script));
}
