import { timingSafeEqual } from "node:crypto";
import { sendDueReminders } from "@/lib/jot/reminders";

/**
 * The scheduler calls this every few minutes to send Jot reminders that
 * are due. It must send `Authorization: Bearer <CRON_SECRET>` (Vercel Cron
 * does this by itself). Without CRON_SECRET set, nothing runs.
 */
export const dynamic = "force-dynamic";

function authorized(header: string | null): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret || !header) return false;
  const a = Buffer.from(header);
  const b = Buffer.from(`Bearer ${secret}`);
  return a.length === b.length && timingSafeEqual(a, b);
}

export async function GET(request: Request) {
  if (!process.env.CRON_SECRET) return Response.json({ error: "CRON_SECRET is not set" }, { status: 503 });
  if (!authorized(request.headers.get("authorization"))) return Response.json({ error: "Not allowed" }, { status: 401 });
  const result = await sendDueReminders();
  return Response.json(result);
}
