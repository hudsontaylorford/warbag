import { timingSafeEqual } from "node:crypto";
import { sendDueReminders } from "@/lib/jot/reminders";

/**
 * The scheduler calls this every few minutes to send Jot reminders that
 * are due. It must send `Authorization: Bearer <CRON_SECRET>` (Vercel Cron
 * does this by itself). Without CRON_SECRET set, nothing runs.
 */
export const dynamic = "force-dynamic";

/** The secret without spaces or line breaks a paste can pick up. */
const secretValue = () => (process.env.CRON_SECRET ?? "").replace(/\s+/g, "");

function authorized(header: string | null): boolean {
  const secret = secretValue();
  if (!secret || !header) return false;
  const a = Buffer.from(header.trim());
  const b = Buffer.from(`Bearer ${secret}`);
  return a.length === b.length && timingSafeEqual(a, b);
}

export async function GET(request: Request) {
  if (!secretValue()) return Response.json({ error: "CRON_SECRET is not set" }, { status: 503 });
  if (!authorized(request.headers.get("authorization"))) return Response.json({ error: "Not allowed" }, { status: 401 });
  const result = await sendDueReminders();
  return Response.json(result);
}
